# SWD Injection Analytics — computer handover

Prepared October 11, 2026. Engineering and connection baseline: commit `e5b58e875e0d5030db3da5ebf849ef420c3e0d31`. This handover is an additive documentation change after that baseline. **Clone current `main`, rather than checking out that older commit and missing this handover.**

## 1. Project and boundaries

| Item | Established state |
|---|---|
| GitHub | Private repository: [thaiphi/well-injection-insights](https://github.com/thaiphi/well-injection-insights), branch `main`; user confirmed owner `thaiphi`. |
| Lovable | [Well Injection Insights](https://lovable.dev/projects/c65e0f06-6e8b-4b9c-bb88-45c3aec39927), project `c65e0f06-6e8b-4b9c-bb88-45c3aec39927`, Thai's Lovable workspace. GitHub sync is established. |
| Backend | Existing **Portfolio Supabase**, reference `phxiqnsebqaalvkanljb`, us-east-1, API `https://phxiqnsebqaalvkanljb.supabase.co`. **Not Lovable Cloud.** |
| Hosting | Actual engineering app is served at `/analytics/index.html`; the outer home route forwards query and fragment to it. Preview was verified; project was unpublished at the last check. |
| Persistence | Imported files, mapping confirmations, assumptions and results are browser-session state. No sign-in, saved-case storage, database upload or cloud curve library is implemented. Portfolio had zero public tables at inspection. |
| Product | Educational reservoir/disposal engineering demonstration. Conditional screening results do not establish sustainable disposal capacity, transient pressure evolution or field calibration. |
| Target | Governing documents target delivery **before October 14, 2026**. Product acceptance remains open; the transfer does not satisfy all release gates. |

The original local app was preserved as 182 exact application/data/reference/test files in `swd-injection-analytics/`, following Lovable's existing scaffold history. Its source checkout had no committed history to import. Do not regenerate the app, replace the source manifest, discard fixtures, overwrite existing history or force-push. Only additive commits were used.

**Current task authorization:** this handover and its GitHub delivery. New engineering work, migrations, permission changes, extra charges and deployment need an explicitly agreed scope. The previous 10:37 p.m. CDT correctness deadline was a completed historical checkpoint, not a fresh running timebox. For subsequent authorized implementation, retain one-hour checkpoints and independent review. Keep `phi-analytics` and Texas RRC Explorer untouched unless separately authorized.

## 2. Start on the new computer

1. Sign in to GitHub with an account that already has access to the private repository. Use a new folder. Do not initialize a new project, create another repository or copy this machine's credential/config folders.
2. Install Git, **Node 24 or newer** and Bun from their official distributions. The verified source machine used **Node 24.13.0**. The engineering compiler is pinned to **TypeScript 5.9.3** and the assembly rejects a different version. The root dependency lock is `bun.lock`; `bunfig.toml` retains its existing supply-chain settings. No Bun version pin or clean installation on the destination computer has been verified.
3. In a terminal in your chosen parent folder:

```powershell
git clone https://github.com/thaiphi/well-injection-insights.git
Set-Location well-injection-insights
git status --short
git log -5 --oneline
bun install --frozen-lockfile
node scripts/prepare-swd.mjs
node --test tests/portfolio-connection.test.mjs tests/transfer.test.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4290 --strictPort
```

Open **http://127.0.0.1:4290/analytics/index.html**. Keep the terminal running; Ctrl+C stops the local server. A browser tab pointing to the old computer's `127.0.0.1` is not a remote server. If port 4290 is occupied, choose a free port and use that same port in the URL; do not kill unrelated processes.

Run installation at the **repository root**, not in the nested app. The outer dependencies supply the pinned compiler; no second installation is necessary to use the adapter or the isolated analytics test runner. [Bun's frozen-lockfile option](https://bun.com/docs/pm/cli/install) installs the locked dependencies without updating the lock. If it fails, report the actual error before changing dependencies or lockfiles. Do not substitute `npx tsc` or upgrade packages to get past setup.

On Windows, if a PowerShell shim is blocked, use the real installed executable (for example `node.exe` or its actual absolute installation path). This source machine had broken npm/npx shims and a Vitest traversal restriction; those are historical environment observations, not proof that every other machine has the same failures. Never copy the old machine's `node_modules`.

**First-run smoke:** Load the explicitly labeled synthetic demo; inspect history and fit/holdout; calculate an independent PVT pressure sweep; change an input and confirm stale results/exports clear. In Data & sources expand **Data storage · Portfolio**, then activate **Check API reachability**. A successful result means Auth service reachability only. It must not change the dataset or imply cloud saving. No backend credential is required to run local calculations.

## 3. Read these before continuing work

1. [Root instructions](AGENTS.md) and [preserved engineering instructions](swd-injection-analytics/AGENTS.md). The nested instructions retain their historical sibling path. The accessible equivalent for delegation is now [handover/context/agent-workflow.md](handover/context/agent-workflow.md).
2. [Approved Analytics PRD v1.3](handover/context/01-swd-injection-analytics.md), [completion plan](handover/context/2026-10-09-plan-compliance-completion.md), [architecture/import contract](handover/context/05-architecture-integration.md) and [delivery roadmap](handover/context/06-delivery-roadmap.md).
3. [Owning product specification](swd-injection-analytics/product-spec.md), [requirement tracker](swd-injection-analytics/docs/agents/issue-tracker.md) and [completion ledger](swd-injection-analytics/docs/project-completion-ledger.md).
4. [Feature-preserving redesign record](swd-injection-analytics/docs/2026-10-10-preservation-redesign.md), [brine/parser closeout](swd-injection-analytics/docs/2026-10-10-brine-parser-correctness.md), [receiver closeout](swd-injection-analytics/docs/2026-10-10-receiver-correctness.md), [transfer verification](migration/verification.md) and [Portfolio connection verification](integrations/portfolio/README.md).

The copied governing documents are **unchanged snapshots**, with original bytes/hashes in [handover/source-manifest.json](handover/source-manifest.json). They include historical permissions, statuses, machine paths and links to other initiatives. Later owner instructions and dated verified outcomes supersede historical execution statements. Do not interpret the PRD's old “NOT STARTED” wording, the nested README's old “Git hosting not claimed” wording, or an earlier 188-test count as the latest state. Some upstream/sibling/scratch links remain historical and unavailable in this clone; the copies do not grant authority to edit those projects.

The shared workflow keeps Main responsible for scope, integration, Git and verification; workers have non-overlapping ownership, no Git writes and no child agents. It requires explicit seven-field briefs, at most two active subagents including the independent Astra reviewer, and actual model/role recording. Read the portable workflow before dispatch; do not silently substitute defaults or claim these written safeguards are enforced by hooks.

## 4. Code and feature map

| Location | Responsibility / preservation boundary |
|---|---|
| `swd-injection-analytics/src/` | Actual TypeScript engineering, imports, forecasts, demand, PVT, capacity, hydraulics, sensitivities and evidence construction. |
| `swd-injection-analytics/web/` | Actual browser workflows, six-area navigation, ES modules/workers, CSV/XLSX mapping/validation, tables/charts and export handlers. |
| `swd-injection-analytics/data/` | Seeded demonstration, fictional scenarios and separately pinned public Explorer artifact. Never substitute demo into a customer dataset. |
| `swd-injection-analytics/reference/` | Retained Nexus/library source, hashes, licenses, numerical references and legacy evidence. Historical agreement is not independent physics validation. |
| `swd-injection-analytics/tests/` | Preserved Node engineering regression suite and import fixtures. Some tests write artifacts; use the isolated runner below. |
| `swd-injection-analytics/exhibits/`, `output/pdf/` | Retained original technical evidence and workbook PDF. Do not replace with new test outputs. |
| `migration/source-manifest.json` | Exact 182-file transfer baseline; preserve it. Intentional future engineering changes require an independently reviewed baseline strategy, not weakened tests. |
| `scripts/prepare-swd.mjs`, `scripts/portfolio-entry.mjs`, `vite.config.ts`, `src/routes/index.tsx` | Hosting adapter. Compiles the original source, assembles its original URL roots, and inserts exactly one declared backend entry module. Root `src/` is not the engineering implementation. |
| `integrations/portfolio/` | Explicit public connection configuration, opt-in read-only health check, disclosures and hosted screenshot. No database model or saving workflow. |
| `public/`, `.output/`, nested `dist/` | Generated assets/build products; rebuild rather than edit or commit them. |

The six navigation areas contain twelve workspaces, not twelve sidebar entries:

| Area | Preserved experience |
|---|---|
| Start | Guided capacity entry; independent engineering shortcuts; original workbook with expansion/availability scenarios; separately cited steady pressure/skin study. |
| Data & sources | Demo, customer CSV/XLSX and supported Explorer TAR/pinned evidence; worksheet/profile/mapping/units/preview/row validation/quarantine/confirmation; per-analysis readiness; source lineage and Portfolio check. |
| Production & demand | Distinct producer histories, local exponential fitting, frozen forecasts and independent holdout reconciliation; fitted snapshot inspection; schedules and inspectable existing/additional demand. |
| Injection & capacity | Public injector history kept distinct from pressure-datum engineering assumptions; constant-J screening coupled with applicable hydraulic constraints; deficits/unmet volume; scenarios and one-at-a-time J/diameter/availability sweeps. |
| Fluid & wellbore | Independent four-property brine PVT pressure sweep; bounded gas-free hydraulic calculations; uniform/depth-dependent conditions and inspectable profiles. |
| Reports & evidence | Existing report families and JSON/CSV/SVG downloads; browser original-workbook PDF and preserved offline PDF. Provenance, units, hashes, methods, assumptions and stale-output guards stay intact. |

The preserved black-oil engine, source extraction/import utilities and offline report CLI are also retained; not every backend/CLI capability has a usable frontend workflow. Fitting remains **local exponential fitting**, not integrated pyResToolbox DCA. The live NaCl PVT adapter is separately versioned/source-checked; the incorrect historical Nexus Bw correlation and its fixtures remain historical evidence, excluded from production dependencies. Neither a visual refactor nor a reference-match test blesses that legacy model.

Origin and content remain separate: a user-uploaded synthetic file is **user provided AND synthetic**. Changed files/sheets/mappings/units must invalidate confirmations and dependent results. Keep missing values distinct from zero, quarantined evidence distinct from accepted observations, unavailable percentage differences distinct from zero, and failed contributions out of any misleading “complete” aggregate.

## 5. Design references

All six owner-supplied images are carried as their actual JPEG format, in screen order. The attachment numbers were reversed relative to screen numbering. No JPEG was mislabeled as a PNG or regenerated.

| Reference | Screens |
|---|---|
| [01-start-import.jpg](handover/design/01-start-import.jpg) | 01 Start, 02 Import/readiness |
| [02-history-forecast.jpg](handover/design/02-history-forecast.jpg) | 03 Histories, 04 Fit/reconcile |
| [03-curves-schedules.jpg](handover/design/03-curves-schedules.jpg) | 05 Curve library, 06 Schedules/demand |
| [04-injectivity-capacity.jpg](handover/design/04-injectivity-capacity.jpg) | 07 Injectivity, 08 Capacity |
| [05-sweeps-pvt.jpg](handover/design/05-sweeps-pvt.jpg) | 09 Sweeps, 10 Brine PVT |
| [06-hydraulics-reports.jpg](handover/design/06-hydraulics-reports.jpg) | 11 Hydraulics/profiles, 12 Reports |

These are **concepts, not authoritative specifications or reference solutions**. Preserve engineering tools absent from the pictures, consistent secondary tabs, direct tool access, six-area navigation, readable/keyboard-accessible controls and responsive containment. Do not implement fake saved-case revisions, copy illustrative chart trends/units/statuses, collapse coupled hydraulic/constant-J constraints into mutually exclusive models, or permanently display conditional warnings. The dated redesign report records intentional differences and acceptance limitations; it is not a fresh destination-computer audit.

## 6. Verification baseline and reproduction

Last executable verification was before this documentation-only handover, on the source Windows computer:

| Gate | Observed result / boundary |
|---|---|
| Connection + transfer Node tests | **PASS 11/11**, including all 182 file hashes, static asset preservation and fixed local-config access. |
| Isolated engineering suite | **PASS 350/350**, zero skipped, including listener test outside the restricted sandbox. |
| Carried numerical oracles | **PASS 248 comparisons**; historical reference reproduction, not full-domain physics acceptance. |
| Root type check, targeted lint, production build | **PASS**; existing scaffold plugin-option warnings retained. |
| Local browser | Keyboard connection action, unchanged selected demo dataset after recheck, independent PVT computation/export availability passed. |
| Hosted browser | Fresh editor and standalone preview reached Portfolio; hosted PVT JSON download and numerical parity had passed during transfer. [Connection screenshot](integrations/portfolio/hosted-connection.jpg), [PVT screenshot](migration/hosted-pvt.jpg). |
| Independent review | Astra/high approved the bounded connection and preview-loader fix; reran 11 connection/transfer tests. |
| Unrun | Clean destination install; full twelve-screen hosted acceptance; scaffold/upstream Vitest; fresh optional Python PDF gate; hosted two-app handshake; new persistence workflows. Mobile acceptance for the backend panel is unverified—the viewport override did not yield a narrow capture. |

From the repository root, after dependency installation:

```powershell
node scripts/prepare-swd.mjs
node --test tests/portfolio-connection.test.mjs tests/transfer.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json --noEmit
node node_modules/vite/bin/vite.js build
node scripts/check-analytics.mjs --include-server
node scripts/check-portfolio.mjs
```

`check-analytics.mjs` copies the preserved app into `tmp/analytics-check-*`, compiles that snapshot, runs the explicit owning Node suite and carried oracles, and writes `gates.json` there. This protects retained artifacts from fixture-writing tests. If the environment denies local listening, report that listener gate as blocked; a run without `--include-server` is narrower and cannot be labeled a full-suite pass. Avoid unrestricted `node --test` discovery, which can collect preserved upstream Vitest tests requiring another runner.

`check-portfolio.mjs` is a live network probe of the actual production client; network failure is separate from local engineering gates. It does not upload user data or verify database access. Repeat browser workflows on the destination/actual preview rather than inferring them from unit tests. Optional offline PDF uses an explicitly chosen Python with ReportLab/pypdf; this machine's historical bundled Python path is not portable. Browser PDF requires no Python.

## 7. Known unfinished work and next decisions

| Work | Current boundary / next decision |
|---|---|
| **SWD-11 / P2** | Transient/layered/calibrated capacity is unimplemented. Agree method, inputs, validation and evidence before coding. |
| Parser/dependencies | Reproduced trailing/concatenated DEFLATE, ZIP alias and hidden-dimension defects were repaired. Comprehensive security/decompression/dependency review and hard peak-memory guarantees remain open. |
| Brine correctness | Live adapter has bounded source/physical checks. Broader independent physics validation remains open; retained legacy Bw defect is disclosed, not silently repaired. |
| Curve maintenance | Current fitted snapshots are inspectable. Creating/naming/saving/editing/revising/cloning/comparing/assigning persistent curves is proposed, not delivered. Decide revision immutability and schedule linkage. |
| Source composition | Existing multi-profile customer calculations do not establish general TRRC/customer composition. Identity, units, coverage, conflicts and explicit composition remain separate functional work. |
| Injectivity diagnostics / PVT extensions | Diagnostic-history J fitting, temperature/salinity sweeps and correlation comparisons remain proposals, not mockup-based calculations. |
| Reports | Original-workbook PDF exists. Dedicated connected-case, sweep and worked-study PDFs remain unfinished; agree scope without weakening provenance/staleness guards. |
| Portfolio persistence | Sign-in, saved cases, uploads and curve storage need an agreed schema and access model. No tables/policies/migrations are authorized by the connection check or this handover. Report migrations and additional charges before proceeding. |
| Integration/release | Immutable public refresh enforcement and full two-app G2 remain unverified. Localhost-only Explorer postMessage origins are unchanged; portable TAR import remains available. Hosted origin expansion needs separate contract review. |
| UI acceptance | Earlier local twelve-workspace evidence exists in dated reports, but a fresh hosted desktop/mobile/error-state walkthrough and independent feature-preservation acceptance are still needed. |

Recommended first action on the new computer: reproduce the setup and baseline, then agree the next bounded scope. Do not silently start all proposals. Readiness, numerical validation and full product acceptance are separate statuses. No deployment until release checks pass and deployment is authorized.

## 8. What GitHub does and does not move

**Included:** existing code, lockfiles, tests, fixture archives, public-source pins/licenses/hashes, original evidence/PDF, formal engineering reports, hosting adapter, Portfolio public configuration and two hosted screenshots. This handover adds the governing-context snapshots and six design concepts with hashes.

The handover's [verification record](handover/verification.json) distinguishes fresh documentation checks from the earlier engineering baseline. Git attributes preserve the copied context and image bytes across platforms. Local handover checks verified all sixteen copies against their original sources and all local links in the new/updated root documents; the three transfer tests also passed with all 182 original hashes intact.

**Not included:** original ignored `tmp/` snapshots/logs/downloads and most earlier local screenshots; original attachment folders beyond the six copied concepts; graph caches; Node/Bun/Python installations; dependency/build folders; private environment files; GitHub/Lovable/Supabase/Codex login sessions and MCP settings. Old `C:/Users/thai.phi/...` paths in dated records do not identify locations on the new computer. Formal preserved fixtures are portable; many local scratch links are not.

**Browser imports and current calculations do not travel with a clone.** Keep the original source CSV/XLSX/TAR files and any needed JSON/CSV/SVG/PDF exports separately before leaving the old computer. This task did not recover or upload session data. If any earlier scratch evidence or other files must also move, select them explicitly; do not bulk-push the old workspace or credential folders.

Sign in to Lovable/Supabase on the new computer using the existing accounts. MCP access is optional for ordinary development and is configured/authenticated separately on that computer. Do not copy auth tokens into Git. The checked-in `integrations/portfolio/config.json` contains only the existing browser-safe publishable configuration; do not add service-role/secret keys or browser session tokens.

If Lovable appears stale after a push, verify the GitHub/Lovable commit first and fully reload the editor. Source synchronization alone does not prove preview acceptance. On the source machine, an iframe-only refresh retained stale generated assets; a full editor reload and fresh authenticated standalone link recovered. Use the editor's **Open in new tab** link for private preview access, and do not share its temporary authentication query parameters. Do not publish, enable Lovable Cloud or send a chargeable Lovable AI rebuild prompt merely to resolve a stale preview.

## 9. Resume instruction for the next assistant

```text
Continue SWD Injection Analytics in thaiphi/well-injection-insights only.
Read HANDOVER.md, both AGENTS.md files, handover/context/agent-workflow.md,
the copied approved PRD/completion plan, and the dated closure/transfer records.
Verify the repository root, current main commit, local edits and baseline checks.
Preserve the actual engineering app, data/reference evidence and tests.
Portfolio Supabase is the existing backend; do not enable Lovable Cloud.
Cloud saving/sign-in and SWD-11 are unfinished. Do not infer completion from
health checks, old acceptance claims or illustrative images.
Report setup failures and missing evidence precisely, then agree the next scope.
No deployment, permission changes, paid services, schema migration or unrelated
work without the owner's explicit instruction. Do not rewrite pushed history.
For approved implementation use non-overlapping ownership, independent review
and one-hour checkpoints; run final relevant checks and real browser acceptance.
```
