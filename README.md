# SWD Injection Analytics — Lovable hosting

The existing engineering application is preserved in [swd-injection-analytics/](swd-injection-analytics/README.md). This project hosts its current interface, calculations, imports and evidence; it does not regenerate them from the Lovable placeholder.

See [migration/README.md](migration/README.md) for source preservation, runtime and acceptance boundaries. [migration/source-manifest.json](migration/source-manifest.json) records the 182 transferred files and their original hashes.

## Development and verification

Install the scaffold dependencies from bun.lock. TypeScript is pinned to the original application's 5.9.3. On this Windows host use actual executable paths instead of npm/npx shims.

- Dev: node node_modules/vite/bin/vite.js --host 127.0.0.1
- Build: node node_modules/vite/bin/vite.js build
- Static transfer check after dev/build assembly: node --test tests/transfer.test.mjs
- Scaffold type check: node node_modules/typescript/bin/tsc --noEmit
- Analytics type check: node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json --noEmit

Run the preserved analytics tests in an isolated copy because some existing tests write reference/exhibit fixtures. Original commands and engineering limitations are in its README and dated correctness reports. The optional offline Python report tool is preserved; it is not a browser or backend dependency.

The home route opens the full original app at /analytics/index.html. Asset paths, module workers and evidence URLs retain the original /dist, /data, /reference and /exhibits roots. Public assets are generated at dev/build; source and tests remain in the private repository.

The external backend is the existing **Portfolio Supabase** project. The app includes a read-only connection check in Data & sources; imported files and results remain session-only because cloud saving is not configured. See [connection scope and verification](integrations/portfolio/README.md). No new database or paid service was provisioned. GitHub synchronization updates Lovable's editor preview; publication remains a separate release-gated action.
