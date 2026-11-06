# SWD Injection Analytics

**Live:** https://swdinjectionanalytics.lovable.app (opens the app at `/analytics/index.html`)

SWD Injection Analytics is a browser-based engineering demonstration for saltwater-disposal (SWD) injection wells. It covers:
- produced-water forecasting and reconciliation;
- injection diagnostics;
- injectivity (J) estimates referenced to tests;
- wellhead-to-bottomhole pressure reconciliation;
- capacity scenarios;
- technical exports.

It is the analysis half of a two-part system. **[Texas RRC Explorer](https://github.com/thaiphi/texas-rail-sync)** collects and verifies public Railroad Commission data. Its **Use in Injection Analytics** button hands a hash-verified evidence package to this app.

Results are screening calculations with their assumptions shown. They are not field calibration, permitting or regulatory determinations.

## Repository layout

- [swd-injection-analytics/](swd-injection-analytics/README.md): the preserved engineering application (calculations, imports, evidence, tests). [migration/source-manifest.json](migration/source-manifest.json) protects its 182 transferred files by hash. Changes to them go through reviewed preservation layers; see [migration/README.md](migration/README.md).
- The outer TanStack/Vite project is the Lovable hosting adapter. Its home route forwards to the preserved app.
- [HANDOVER.md](HANDOVER.md) covers setup on a new computer, project identities and open work. [AGENTS.md](AGENTS.md) holds the rules for AI agents working here.
- Requirements are tracked as GitHub issues (`ANA-Exx`, [#1–#10](https://github.com/thaiphi/well-injection-insights/issues)). Course work for the combined system is tracked in Explorer's [Zoomcamp final project milestone](https://github.com/thaiphi/texas-rail-sync/milestones).

## Run locally

You need Node 24.13.0 (the version CI uses) and Bun. Run every command from the repository root.

```sh
bun install --frozen-lockfile
node scripts/prepare-swd.mjs                         # assemble the analytics app
node node_modules/vite/bin/vite.js --host 127.0.0.1  # dev server
```

Open the printed URL. The engineering app is at `/analytics/index.html`.

## Test

One command runs the full offline gate:

```sh
npm test            # or: node scripts/check-all.mjs
```

It runs these checks in order, prints a PASS/FAIL summary, and exits non-zero if any check fails:
1. the preservation gate (182 protected files);
2. app assembly;
3. the root transfer and connection tests;
4. the hosting-adapter vitest suite;
5. both TypeScript checks;
6. the site build;
7. the isolated engineering suite with the carried numerical oracles.

No test makes network calls. The live Portfolio probe (`node scripts/check-portfolio.mjs`) is separate on purpose.

[CI](.github/workflows/ci.yml) runs the same script on every pull request and on every push to `main`, as the `test` job.

## Run with Docker

The whole system, Explorer + Analytics + Postgres, starts with one command from the Explorer repository. See [Run the whole system (Docker)](https://github.com/thaiphi/texas-rail-sync#run-the-whole-system-docker). A standalone Analytics image (a `Dockerfile` in this repository) is being added under Zoomcamp ZC-02.

## Release and rollback

| Environment | What it is | How it updates |
|---|---|---|
| Local | Dev server or Docker on your machine | By hand |
| Dev | The Lovable editor preview (requires Lovable sign-in) | **Automatically** when `main` changes on GitHub |
| Production | https://swdinjectionanalytics.lovable.app | **By hand**: the owner presses **Publish** in Lovable |

Release steps:
1. Merge to `main` only with the owner's approval and a green `test` check.
2. Check the editor preview.
3. The owner publishes.
4. After publishing, open the live URL and confirm that `/analytics/index.html` loads.

To roll back, either:
- restore the previous version in Lovable's version history and **Publish**; or
- revert the commit on `main` with a new commit, then publish.

Never force-push or rewrite pushed history: the branch is connected to Lovable.

## Backend

The app uses the existing **Portfolio Supabase** project, and only for a read-only health check in Data & sources. Only the publishable key is used. Imported files and results stay in the browser session, and nothing is saved to the cloud. See [integrations/portfolio/README.md](integrations/portfolio/README.md).

## License

Copyright (c) 2026 Thai Phi. Licensed under the GNU Affero General Public License v3.0 only (AGPL-3.0-only); see [LICENSE](LICENSE). For use under other terms, contact the copyright holder.

Some components carry their own licences: the pyResToolbox brine PVT code (GPL-3.0-or-later, Mark Burgoyne), pdf-lib (MIT) and SheetJS xlsx (Apache-2.0). They are listed with their paths in [NOTICE](NOTICE).
