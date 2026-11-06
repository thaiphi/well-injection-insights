# ZC-02 follow-up: Analytics container (design)

Date: 2026-11-05. Owner approved on 2026-11-05 ("go ahead with ZC-02"). Tracked in thaiphi/texas-rail-sync #38 / #47 (AI Dev Tools Zoomcamp, Containerization criterion).

## Why

Explorer and Analytics are submitted as one system. Explorer's `docker compose up --build` starts Explorer, Analytics and Postgres. Until now, Analytics ran in Explorer's interim image, built from `97fae62`. That image used a socat relay because `scripts/serve.mjs` binds only to `127.0.0.1`, and the file is protected by the preservation registry.

## Changes

1. **`swd-injection-analytics/scripts/serve.mjs`:**
   - It reads an optional `HOST` environment variable for the listen address.
   - With `HOST` unset, the address stays `127.0.0.1`, so local runs, tests and the Lovable path are unchanged.
   - The startup line prints the address actually used.
   - Nothing else changes: the server still answers GET/HEAD only and keeps the same route roots and confinement checks.
2. **Repo-root `Dockerfile`:** a two-stage build.
   - **Build stage** (`node:24.13.0-alpine`, the Node version CI pins): `npm ci` from `swd-injection-analytics/package-lock.json` (TypeScript 5.9.3 only), then compile with `node node_modules/typescript/bin/tsc -p tsconfig.json`.
   - **Runtime stage** (`node:24.13.0-alpine`, the Node version CI pins):
     - It copies only what the server serves: `dist/`, `web/`, `data/`, `reference/`, `exhibits/`, `output/pdf/` (the technical exhibit PDF), `scripts/` and `package.json`. There is no `node_modules`, because the server uses only Node built-ins.
     - It runs as the image's non-root `node` user.
     - It sets `HOST=0.0.0.0`, `PORT=4290` and `EXPOSE 4290`.
     - A `HEALTHCHECK` sends `GET /` with Node's `fetch`, on `$PORT` (default 4290), so it stays correct if compose overrides `PORT`.
   - The root location lets Explorer's compose build from a pinned git context, `https://github.com/thaiphi/well-injection-insights.git#<commit>`.
3. **`.dockerignore`:** keeps `node_modules`, build output, `.git`, `tmp/`, `.superpowers/` and the Lovable app out of the build context.
4. **`swd-injection-analytics/tests/serve-host.test.mjs`:**
   - With no `HOST`, the server reports `127.0.0.1`.
   - With `HOST=0.0.0.0`, it reports `0.0.0.0` and still serves on loopback.
   - A POST is still refused with 405.
5. **Root `tests/docker-image.test.mjs`** (unpinned, like the Dockerfile): static checks of the Dockerfile, covering the base image, the non-root user, `HOST`/`PORT`, the health check and the entry point. It sits with the root tests because CI runs the app suite in an isolated copy of `swd-injection-analytics/` that has no repo root.

## Not in scope

- Compose wiring, which belongs to Explorer.
- CI, which is ZC-03 and owned by another session.
- Telemetry (ZC-05/06), on hold until the owner approves the design.
- Any change to the Lovable app.

The preservation layer is `zc02-analytics-docker`. It archives the before-image of `serve.mjs` and pins the new test. The `Dockerfile` and `.dockerignore` are not pinned. They are new, unprotected root files, and the root `.gitattributes` (itself pinned) does not mark them `-text`. A Windows `core.autocrlf` checkout would therefore rewrite their line endings and fail a byte pin. The root test in item 5 checks the Dockerfile's content instead.
