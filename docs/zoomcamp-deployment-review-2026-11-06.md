# Zoomcamp deployment review: Explorer + Analytics as one system

Date: 2026-11-06. Read-only review requested by the owner.

**Repos**
- Explorer: `thaiphi/texas-rail-sync`
- Analytics: `thaiphi/well-injection-insights`

**Purpose.** Check both repos against the AI Dev Tools Zoomcamp deployment material, so that nothing is missed for the final project (deadline 2026-11-16), and record the practices we want to keep for future development.

**How it was made**
1. Main (the Analytics coordination session) wrote a first gap analysis.
2. An independent Fable reviewer checked it against the primary sources.
3. Main re-checked the reviewer's key claims against GitHub on 2026-11-06:
   - main is not protected in either repo;
   - `deploy-prod` has 0 runs;
   - the only GitHub environment is `dev`;
   - Explorer's `docker/analytics/Dockerfile` pins `ANALYTICS_REF=97fae62`;
   - Explorer's `AGENTS.md:18` links to an agent-workflow doc outside the repo;
   - `swdinjectionanalytics.lovable.app` redirects (307) to `/analytics/index.html`.

**Sources**
- Part 3 article, deploying the app: https://aishippingblog.com/p/deploy-a-full-stack-app-with-ai-coding
- Part 4 article, DevOps and observability: https://aishippingblog.com/p/devops-and-observability-for-an-ai
- Final-project rubric: `project/README.md` in https://github.com/DataTalksClub/ai-dev-tools-zoomcamp
- The workshop recording transcript, "Application Architecture and Full-Stack System Design", 2026-08-10
- Both repos' workflows, compose and Docker files, READMEs, AGENTS.md, and Explorer's `docs/deployment.md`
- ZC issues `texas-rail-sync#37–#44` and `#47`

The state described here is as of 2026-11-06. Analytics main = `6a44f57`.

## 1. Rubric vs ZC issues

The rubric has 12 criteria worth 24 points, and 10 points passes. Peer review of 3 projects is required to pass ("Submitting a project without doing the peer reviews does not pass").

The ZC issues cite the right criterion names and points for 10 of the 12 criteria.

| Criterion (points) | ZC issue | State on 2026-11-06 |
|---|---|---|
| Problem description (2) | ZC-08 #44 | Open. Explorer's README opens with October status banners and an old deadline line; the one-system description must come first |
| Product specification (2) | ZC-01 #37 | Closed |
| **Agent team specification (2)** | **none** | Explorer `AGENTS.md:18` links to `../phi-analytics/docs/swd-intelligence-lab/agent-workflow.md`, which is not in the public repo, so a reviewer hits a dead link. Analytics keeps an in-repo copy at `handover/context/agent-workflow.md` |
| **Context management (2)** | **none** | Not tracked |
| Application (2) | ZC-02 #38 | Closed. Persistence is weak: Explorer's Postgres is a rebuildable index, collections last only as long as the container, and Analytics has no database |
| Containerization (2) | ZC-02 #38, #47 | Closed. #47 (manual check of the handoff inside compose) is open. Compose builds an **old Analytics** (`97fae62`, from before Phase 2a) |
| CI/CD (3) | ZC-03 #39, ZC-04 #40 | CI is green in both repos. "A failing test blocks the merge" is **not met**: main is unprotected in both. `deploy-dev` works but is a throwaway replica that exists only during the job. `deploy-prod` has **never run**, and the `production` environment, reviewer and secret do not exist |
| Testing (2) | ZC-03 #39 | Suites exist, but there is no single test command. Analytics' root `npm test` runs the scaffold's vitest, not the engineering suite. There is no automated browser test of the key journey |
| Deployment (2) | ZC-04 #40, ZC-08 #44 | Analytics is live, but its HANDOVER.md still says "unpublished". Explorer has no public website URL in its README |
| Observability (2) | ZC-05 #41 | Open, with no work started |
| Alerting on user impact (1) | ZC-06 #42 | Open, with no work started |
| On-call agent (2) | ZC-07 #43 | Open, with no work started |

## 2. Findings, ordered by grade impact

1. **Agent team and context-management criteria are untracked (4 points).** Copy the agent-workflow doc into Explorer and point `AGENTS.md` at the copy. Open issues for both criteria. Owner: Explorer.
2. **Observability, alerting and on-call (5 points) have not started.** Before building, add the Part 4 specifics to the three issues:
   - tag telemetry with service, environment and version;
   - run the observability stack as its own Compose project, and secure it;
   - alert payloads carry service, environment, version, owner and dashboard URL;
   - responder guardrails: make the smallest correction, change no code on a false positive, run the tests, save a session log, use isolated compute.

   Owner: Explorer.
3. **Production deploy is unproven.** Create the `production` environment with the owner as required reviewer, add the `SUPABASE_ACCESS_TOKEN` secret, and run `deploy-prod` once. The workshop advises deploying through CI/CD "a few times" before trusting it. Owner: owner.
4. **"A failing test blocks the merge" is unmet.** Require `test` (Analytics) and `test` + `compose` (Explorer) on main. Before enabling, confirm that Lovable never pushes directly to main, because required checks would reject that. Owner: owner.
5. **Compose demos an old Analytics.** Bump `ANALYTICS_REF` to current Analytics main, pin Node to `24.13.0` in `docker/analytics/Dockerfile` (it floats `node:24-alpine` today, and Node 24.22.x fails a protected Analytics test), and re-run compose-smoke. Owner: Explorer.
6. **Deployment documentation.**
   - Explorer README: add the public website URL.
   - Analytics root README: add the live URL, the Docker command, and the Lovable release and rollback steps, and remove the "unpublished" contradiction. The nested `swd-injection-analytics/README.md` is protected, so it stays as it is.

   Owners: Explorer, and Main for Analytics.
7. **One test command per repo.** Add an aggregate script to each root `package.json` (Analytics' root `package.json` is not protected). Owners: Explorer, and Main for Analytics.
8. **No automated browser test of the key journey.** compose-smoke only fetches the Analytics home page (`/`). Add a Playwright test of Explorer → "Use in Injection Analytics" → package verifies, run against compose in CI. Testing (2) can be met without it, but long-term value is high. Owner: Explorer.
9. **Persistence.** Add named volumes for Explorer's runs, artifacts and collected sources, or state the limitation in the system README. The workshop practice is a volume, so that "every time I run the container I get the old data". Owner: Explorer.
10. **Dev environment wording.** State in the README that Lovable's preview, which follows main, is the website's dev environment, and that the throwaway replica is the function's dev environment. Owner: Explorer.
11. **Deploy gating.** `deploy-dev` waits only on `ci`, not on compose-smoke, and `deploy-prod` checks only `test`. The article's order is tests, then compose, then integration and e2e, then deploy. Low priority. Owner: Explorer.
12. **Analytics CI image build.** After session e0's Dockerfile merges, CI should build and smoke-test the image. The `HOST` change touches the protected `scripts/serve.mjs`, so it ships with its own reviewed preservation layer. Owners: e0, then Main.

**Corrections to Main's first draft**
- Explorer's `deploy-dev.yml` ("Smoke-test the deployed function") and `deploy-prod.yml` ("Smoke-test production") already health-check after deploy. Only Lovable Publish lacks a post-publish check.
- The article's OIDC advice is AWS-specific. For Supabase, the real action is item 3 above.

**Nice-to-haves**
- Check actual cost a day or two after a deploy.
- Back up the database, and test that the backups restore.
- Run repeated agent security audits before release.

## 3. Standing rules for future development

These are prioritised. Conflicts with existing repo rules are named, and none of these rules overrides the existing ones.

1. **Production changes go only through the deploy workflows.** After the first CI release, no MCP or dashboard deploys. The workshop's point is to revoke agent access once CI/CD works, and `docs/deployment.md` records that function v2 was uploaded through MCP.
2. **Required `test` check on main in both repos** (plus `compose` in Explorer). Before enabling, confirm how Lovable writes to the branch. In Analytics, a protected-file change ships with its preservation layer in the same PR, because the gate runs inside `test`.
3. **The on-call agent opens a PR and never pushes.** In Analytics it may not touch the protected manifest files without a layer. This resolves the rubric's "wakes up and fixes the issue" as alert → agent → fix PR → owner merge, which ZC-07 allows.
4. **Cross-repo pin rule.** Whenever Analytics main moves, bump Explorer's `ANALYTICS_REF` (or pin a tag) and re-run compose-smoke.
5. **Every deploy or publish ends with a smoke test.** This is already true for both Supabase workflows. Add a manual post-Publish check to the Lovable step.
6. **One toolchain version everywhere.** CI, Dockerfiles and HANDOVER all use Node 24.13.0. Raising the Analytics pin requires a preservation layer that updates `tests/xlsx-boundary.test.mjs`.
7. **Telemetry hygiene.** No customer data, tokens or credentials in logs, metrics or alerts. Tag telemetry with service, environment and version.
8. **In-repo copies.** Keep a copy, inside the repo, of every document that `AGENTS.md` links to.
9. **Longer term.** Build once and promote the same artifact, tagged with timestamp and SHA (this conflicts with `deploy-prod` rebuilding from a ref today). Run periodic cost and teardown checks.

These rules still need the usual approvals: owner approval for merge, push and publish; no history rewrite on Lovable-connected branches; and reviewed layers for protected files.
