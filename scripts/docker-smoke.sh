#!/usr/bin/env bash
# Build the standalone Analytics image and smoke-test it (Zoomcamp ZC-02/ZC-03).
# Run from the repository root:  bash scripts/docker-smoke.sh
# CI runs this as the `docker` job. Needs Docker and curl; makes no external calls
# beyond pulling the node base image.
set -euo pipefail

IMAGE="${IMAGE:-swd-analytics:smoke}"
NAME="swd-analytics-smoke-$$"
PORT="${SMOKE_PORT:-4290}"
BASE="http://127.0.0.1:${PORT}"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "--- container logs ---"
    docker logs "$NAME" 2>&1 || true
  fi
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

docker build -t "$IMAGE" .
docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:4290" "$IMAGE" >/dev/null

# Wait for the image's own HEALTHCHECK to report healthy (up to 120 s).
for i in $(seq 1 60); do
  health=$(docker inspect -f '{{.State.Health.Status}}' "$NAME")
  [ "$health" = "healthy" ] && break
  if [ "$health" = "unhealthy" ] || [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" != "true" ]; then
    echo "Container is $health / not running"; exit 1
  fi
  sleep 2
done
[ "$health" = "healthy" ] || { echo "Container never became healthy (last: $health)"; exit 1; }
echo "Container healthy after ~$((i * 2))s"

fail=0
expect() {
  local want=$1 method=$2 path=$3 got
  got=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "${BASE}${path}")
  if [ "$got" = "$want" ]; then echo "PASS  $method $path -> $got"
  else echo "FAIL  $method $path -> $got (expected $want)"; fail=1; fi
}

expect 200 GET  /
expect 200 GET  /dist/pressureReconciliation.js
expect 200 GET  /output/pdf/swd-technical-exhibit.pdf
expect 405 POST /

user=$(docker exec "$NAME" id -un)
if [ "$user" = "node" ]; then echo "PASS  runs as non-root user: $user"
else echo "FAIL  runs as $user (expected node)"; fail=1; fi

exit "$fail"
