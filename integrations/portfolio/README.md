# Portfolio backend connection

This application targets the owner's existing **Portfolio** Supabase project, `phxiqnsebqaalvkanljb`, in us-east-1. It does not use Lovable Cloud. The connection configuration contains only its public API URL and existing browser-safe publishable key. No privileged API key, database password or user token is included.

## Delivered boundary

The hosting assembly adds an independent **Data storage · Portfolio** panel in Data & sources. Its keyboard-accessible **Check API reachability** action calls the live Portfolio Auth health endpoint with the publishable `apikey` header. It sends no files, source identifiers, assumptions, results, cookies or request body. A positive result is labeled service reachability only; sign-in, database permissions and storage are not inferred. Failure and timeout remain visible, with retry available. Calculations and dataset readiness are unaffected by backend availability.

The existing project had no public tables at inspection. **Cloud saving is not configured.** Imported data and results remain session-only. Authentication, saved cases, curve persistence and uploads require separately scoped workflows, schemas and row-level policies; this connection does not claim those features are implemented. No migration, new project, branch, paid service, permission change or public deployment is needed for this bounded connection. Any later cloud use is subject to the owner's existing Supabase plan and usage limits.

## Preservation and hosting

All 182 original application/data/reference/test files retain their migration-manifest hashes. `scripts/prepare-swd.mjs` copies an explicit allowlist of connection assets to `/backend/` and adds one module script to the generated HTML. Its insertion contract fails closed if ambiguous. The transfer gate removes only that exact declared script and compares the rest of the generated HTML to the untouched original. Do not edit generated public files, rewrite the source manifest or put private keys in configuration.

The setup is portable through GitHub synchronization; it requires no Lovable AI instruction or Lovable Cloud provisioning. This is a code-level connection to the existing external Supabase API, not a change to Lovable's dashboard integration metadata.

The local `/backend/config.json` asset uses existing same-origin browser credentials so a private Lovable preview can serve it. Redirects are rejected and the returned project configuration is validated before use. This does not send the preview session to Supabase: the separate external health request always omits credentials. Hosted testing caught the original loader's omitted preview session; its regression test first failed, then passed with this correction.

## Verification commands

Use a direct installed Node executable on this Windows workspace:

```text
node scripts/prepare-swd.mjs
node --test tests/portfolio-connection.test.mjs tests/transfer.test.mjs
node scripts/check-portfolio.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

The first connection test run failed all seven assertions because the behavior was absent; implementation then passed all seven. Tests cover exact origin/key restrictions, no uploads/cookies/redirect following, malformed responses, HTTP failures, timeout, duplicate clicks, retry and unchanged existing source controls. The live probe verifies the actual production client rather than a mock service. Full-product engineering acceptance remains open.

## Current documentation

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys): publishable keys are client-safe; secret/service-role keys must never be bundled.
- [REST API](https://supabase.com/docs/guides/api): requests use the project API URL and `apikey` header.
- [Public OpenAPI access removal](https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key): do not treat anonymous `/rest/v1/` introspection denial as a broken backend or add privileges to bypass it.

Independent contract review by GPT-6 Astra/high identified that OpenAPI restriction before implementation. Final read-only review approved the bounded implementation with no blocking findings and independently passed the ten connection/transfer tests and type check.

Main verification on October 11, 2026: eleven connection/transfer tests passed after the preview-loader correction; all 350 preserved engineering tests and 248 oracle comparisons passed in an isolated snapshot; type check, targeted lint and production build passed. Existing scaffold plugin-option warnings remain. Independent review approved the narrow preview-loader correction and reran all eleven connection/transfer tests. The original scaffold Vitest gate remains unrun because of the documented Windows limitation.

Local browser checks passed keyboard expansion/check activation, live API reachability, repeated checking without changing the selected demo dataset, and independent PVT calculation/export availability. After commit `5260ae5` synchronized, fresh Lovable editor and standalone previews both passed the real API check using keyboard activation. The standalone check passed at 00:47:54 CDT on October 11, 2026; [desktop evidence](hosted-connection.jpg) records the result and session-only disclosure. A full editor reload was necessary to replace stale generated preview assets; source synchronization alone was not treated as hosted acceptance. The preview remains unpublished. No full twelve-screen acceptance walkthrough or new cloud persistence workflow is included. Responsive acceptance is unrun: the attempted viewport override did not produce a narrow screenshot in this browser session.
