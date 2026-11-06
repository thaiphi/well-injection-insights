# ZC-02 Analytics container verification (acceptance evidence for layer zc02-analytics-docker)

Date: 2026-11-05. Branch: `feature/zc02-analytics-docker`, from main `fa5ff3c` (Phase 2a, the ZC-03 CI workflow and the deployment review doc). The owner approved this on 2026-11-05 ("go ahead with ZC-02"). Tracked in thaiphi/texas-rail-sync #38 / #47 (Zoomcamp, Containerization criterion).
- Design: `docs/superpowers/specs/2026-11-05-zc02-analytics-docker-design.md`.
- The layer stays recorded as pending-review until the owner accepts it.

## What changed

- **`swd-injection-analytics/scripts/serve.mjs`** (protected; its before-image is archived under `migration/baselines/zc02-analytics-docker-before/`):
  - It reads an optional `HOST` listen address: `process.env.HOST || '127.0.0.1'`.
  - The startup line prints the address used.
  - It is a two-line change. Routes, the GET/HEAD-only rule and path confinement are unchanged.
- **`Dockerfile`** (repo root), two stages, both `node:24.13.0-alpine` (the Node version CI pins):
  - The build stage runs `npm ci` with TypeScript 5.9.3 only, then compiles with `tsc`.
  - The runtime stage copies `dist/`, `web/`, `data/`, `reference/`, `exhibits/`, `output/pdf/` and `scripts/`, with no `node_modules`.
  - It runs as user `node`, with `HOST=0.0.0.0`, `PORT=4290` and `EXPOSE 4290`.
  - A `HEALTHCHECK` sends `GET /` through Node's `fetch`, on `$PORT` (default 4290).
- **`.dockerignore`** keeps the build context to the app sources.
- **`swd-injection-analytics/tests/serve-host.test.mjs`**, two tests:
  - with `HOST` unset, the server listens on 127.0.0.1;
  - with `HOST=0.0.0.0`, it still serves on loopback and POST returns 405.
- **Root `tests/docker-image.test.mjs`**: static checks of the Dockerfile.

## Commands (direct Node paths only)

From the nested app folder:
- `node ../node_modules/typescript/bin/tsc -p tsconfig.json`: clean.
- `node --test tests/*.test.mjs`: 638 tests, 638 pass, 0 fail. The baseline was 636; this layer adds 2. It also passes in an isolated copy of the app folder, which is how CI runs it.
- `node scripts/check-carried-oracles.mjs`: 248 comparisons, 0 failures.

**RED to GREEN.** Against the archived `serve.mjs`, `tests/serve-host.test.mjs` gives 2 pass, 1 fail: the `HOST=0.0.0.0` test fails because the old server ignores `HOST`. Against the new file it gives 3 pass. (These counts include the Dockerfile check, which has since moved to the root tests; see "CI fix" below.)

From the repository root:
- `node scripts/prepare-swd.mjs`: exit 0.
- `node scripts/record-layer.mjs zc02-analytics-docker`: pending-review.
- Root tests: 121 tests (with the new `tests/docker-image.test.mjs`); all pass once the layer is accepted.

## Container check (Docker 29.9.2, local)

- `docker build -t swd-analytics:zc02 .` from the repo root: built, 236 MB.
- `docker run -p 127.0.0.1:4294:4290 swd-analytics:zc02`:
  - the health status reached `healthy`;
  - the log reads `SWD Analytics http://0.0.0.0:4290`;
  - `id -un` is `node`, and `node -v` is `v24.13.0`.
- Through the published port:

  | Request | Status |
  |---|---|
  | `GET /` | 200 |
  | `/dist/planning.js` | 200 |
  | `/dist/pressureReconciliation.js` (Phase 2a) | 200 |
  | `/reconciliation.mjs` | 200 |
  | `/data/explorer-pin.json` | 200 |
  | `/exhibits/default.json` | 200 |
  | `POST /` | 405 |

- Headless Chrome rendered the page from the container (125 KB DOM, including the Well assumptions panel) with no script errors.

## Independent review

The review (Opus, read-only) returned **CHANGES REQUIRED** with one medium finding. All findings are now fixed except N2, which is cosmetic:
- **M1 (medium):** on a CRLF Dockerfile, which any Windows `core.autocrlf` checkout produces, the static Dockerfile test failed. The test now normalises CRLF before matching. It passes 3/3 against both an LF and a temporary CRLF copy of the Dockerfile.
- **L1:** `/output/pdf/swd-technical-exhibit.pdf` returned 404 in the image. It is now copied in and returns 200.
- **N1:** the health check hard-coded port 4290; it now uses `$PORT`. A container started with `PORT=4300` reached `healthy`.
- **N3:** the test removes an ambient `HOST` variable whatever its case.
- **N2** (not fixed): with `HOST=::` the startup line prints `http://:::4290`. This is cosmetic only.

After the fixes, the rebuilt image (236 MB) is healthy and returns 200 for `/`, `/output/pdf/swd-technical-exhibit.pdf` and `/dist/pressureReconciliation.js`, and 405 for POST.

## CI fix (PR #14, first run)

The first CI run failed one test. CI runs the app suite in an isolated copy of `swd-injection-analytics/`, so the Dockerfile check in `serve-host.test.mjs` could not open `../Dockerfile` (ENOENT). The Dockerfile checks moved to the root test `tests/docker-image.test.mjs`, which CI runs in place. The app test now holds only the two server tests. The pinned test changed, so the layer was re-recorded as pending-review and needs the owner's acceptance again.

## Not covered

- **Explorer's compose stack and compose-smoke CI:** that is Explorer's step. Once this is merged, Explorer switches its `analytics` service to this Dockerfile at the merged commit and drops the socat relay.
- **The in-browser Explorer → Analytics handoff inside the stack:** no automated check yet.
- **Telemetry (ZC-05/06):** on hold until the owner approves the design.
