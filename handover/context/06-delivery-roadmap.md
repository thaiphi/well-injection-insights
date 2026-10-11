# Delivery Roadmap — Before October 14, 2026

**Version:** 1.3, October 9 measurable sample-backed milestones, user imports and confirmed read-only collection map. Dates are targets, not delivery guarantees. New/completion implementation is NOT STARTED under this documentation revision.

**October 9 owner direction:** today's active work is limited to Analytics and Explorer. [Today's scope](2026-10-09-analytics-explorer-scope.md) supersedes the earlier permitting assignment and worker distribution for this day. Later milestone rows are planning targets, not authorization to expand today's work.

## 1. Connected engineering demonstration

Three separate applications build on a shared story: Explorer exports verified public injection records; Analytics forecasts fictional incoming water, inspects injection history and compares demand with assumed capacity; Permitting supports TRRC produced-water/Class II disposal procedures and example technical records. The existing portfolio links the applications and retains the WPX narrative.

One method/example per workflow. Synthetic water histories/schedules and literature-derived fictional engineering cases are authorized; private operating data is not a demo dependency. GIS/maps, statewide history and advanced reservoir modeling are later work.

## 2. Milestone control and wider initiative targets

The [completion plan §8](2026-10-09-plan-compliance-completion.md#8-bounded-milestones-and-evidence-ledger) controls the active Analytics/Explorer goals: M0 requirement tracker -> M1 imports/readiness -> M2 planning inspection -> M3 engineering/study example -> M4 source inspection/read-only actual-run map -> M5 exhibits/pinned consumer -> M6 integrated acceptance -> M7 separately authorized delivery. Its dependency column permits independent work; the sequence does not require serializing unrelated tasks. Existing seed-417, fictional presets/reference fixtures and the real 5-record/28-report artifact are reusable inputs. Private data is not a milestone dependency. All new features are NOT STARTED until implementation is separately authorized.

The original calendar targets below retain the wider initiative scope. They are not new assignments or evidence that any application is complete. Each active goal has a one-hour maximum: report completion sooner, or report evidence/status/blockers/next step and pause for owner direction at one hour. No automatic repeated hours or recurring reports through the deadline. See [completion plan §9](2026-10-09-plan-compliance-completion.md#9-per-goal-one-hour-checkpoint-and-scope-control); the parent/main coordinator owns any one-shot reminder. Scope/priority/acceptance changes require an explicit recorded owner decision.

| Date | Data/Analytics workstream | Permitting workstream | Main/advisor |
|---|---|---|---|
| Oct 8 | Freeze source/fixture/export contracts | Freeze disposal scope and corpus manifest | Update PRDs, obtain Astra advice; retain truthful status |
| Oct 9 | Focus on Nexus-based Analytics workflow and one verified UIC -> H-10 export consumed by Analytics; see daily scope | Deferred by owner for today | Enforce the two-app boundary; review source linkage, reused modules and connected numerical/export evidence |
| Oct 10 | Repeatable parser/quality/export; reuse Nexus/PVT foundation in Analytics; synthetic forecast and holdout reconciliation | Expand selected sources toward 20-25; build source viewer and narrow checklist | Review extraction, units, identities, privacy and reference checks |
| Oct 11 | Import pinned artifact; injection curve, assumed capacity timeline and one schedule/expansion case | Complete five supported interactions and missing-fact cases | Integrate example exhibits and portfolio metadata |
| Oct 12 | Technical export and app deployment; finish connected data path | Grounding/currentness/adversarial evaluation and deployment | Feature freeze; select labeled fallbacks if gates fail |
| Oct 13 | Reproduce inputs/calculations, inspect exports and rehearse | Resolve sources/citations and rehearse | Fresh-browser links/mobile checks; record fallback walkthrough |
| Before Oct 14 | Delivery complete | Delivery complete | Finish verification, critical fixes and presentation assets before October 14, 2026 |

Do not postpone public-record linkage to October 12 or citation proof to October 13. Analytics fixtures and Permitting proceed independently of unresolved live-data ingestion.

## 3. Agent distribution

- Main agent: owner discussion, scope, contracts, integration, Git and overall verification.
- Advisor/reviewer: GPT-6 Astra, high reasoning effort; bounded advice/review with evidence packets.
- Feature implementer: GPT-6.1 Sol, medium effort by default; high effort may be explicitly assigned for integration-heavy work.
- Explorer: GPT-6 Luna, medium effort, read-only bounded source/interface investigation.
- Mechanical worker: GPT-6 Luna, low effort, exact one/two-file edits.

At most two active subagents, including Astra. Main checks active assignments before every dispatch/reactivation; a progress message does not release a slot. Wait for completion or confirm an assignment has stopped before using its slot for bounded Astra design/contract advice or a meaningful review checkpoint. Release the reviewer after that checkpoint instead of keeping it active through routine implementation. For October 9, worker A owns Explorer acquisition/linkage/export and worker B owns Nexus reuse and the Analytics workflow; both use the same versioned file contract. Main owns integration and final checks. Permitting and portfolio implementation are outside today's assignments.

Each assignment includes Project, Task class, Brief, Scope, Validation, Report and Return. Use [the shared delegation workflow and brief template](agent-workflow.md) to specify exact roots, requirement IDs (or explained maintenance N/A), allowed files/ownership and concrete acceptance checks. Workers edit only assigned repo/files; Main retains Git and verifies the owning root/target paths before any separately authorized staging or commit. Reuse feature implementers for fixes and relay useful findings promptly. The slot and ownership rules are procedural safeguards, not established scheduler enforcement.

## 4. Objective evidence gates and fallback

| Gate | Passing evidence | If unmet |
|---|---|---|
| Explorer real-data slice | Real UIC record and parent-linked monthly H-10 rows reconcile to official sources; repeatable export and row dispositions | Verified inventory slice if available, history incomplete; otherwise in-development methodology/source view. GIS does not pass this gate |
| Analytics synthetic planning | Fixed seed, frozen cutoff/holdout, correct calendar volumes, group sums and one schedule change | Simplify to one method/cohort; do not claim untested forecasting |
| Injection/capacity scenario | Independent constant-J fixtures and compatible pressure datum; scenario demand/capacity/exhibit agree | Keep tested assumed scenarios; omit unverified hydraulics/transient methods |
| Nexus engineering reuse | Source/dependency record, carried reference fixtures and focused SWD unit/injection/scenario checks; see the [reuse record](feasibility/2026-10-09-nexus-engineering-reuse.md) | Keep working reused components and tested constant-J scenarios; defer only extended features whose integration is incomplete |
| Permitting source/citation | One PDF/HTML path, official manifest/currentness, correct supported excerpts | Dated official-source search with currentness limitations |
| Generated answers | Five supported interactions plus at least 10 reviewed supported/conditional/absent/conflicting/injected cases; no critical unsupported claims | Explicitly labeled deterministic search, with independently verified checklist where possible |
| User imports/readiness — SWD-13/SWD-14 | Generated CSV/XLSX equivalents, explicit columns/units, row validation and per-analysis ready/not-ready reasons; user/public/synthetic lineage reaches exports | Keep existing fixture workflow usable; importer/readiness requirement remains open; real user files are not required |
| Read-only collection map — RRC-09/RRC-10 | Actual instrumented replay/failure events, node status/errors/counts/source/output hashes; historical absent events unrecorded; no editing or trigger controls | Show existing manifest evidence honestly; visualization/event requirements remain open, with no fabricated successful runs |
| Delivery | Fresh browser opens deployed app, data/export/source path and portfolio return link; server-side secrets/request bounds for public LLM | Explicit local demo and recording; no invented public URL |

These gates are independent. A functioning synthetic example does not establish real RRC ingestion. Search does not establish AI generation, and an assumed curve does not establish actual sustainable capacity.

## 5. Focused verification fixtures

- Complete 31-day month, 31,000 injected bbl -> 1,000 bbl/day calculated calendar-day average. February uses the actual year. Blanks differ from zero; average/max injection pressure and annulus fields remain separate.
- Preserve leading-zero parent IDs, conflicting/revised rows and unmatched children. Accepted/quarantined dispositions reconcile with input counts; issue counts can overlap.
- Frozen forecast [90, 150] and synthetic actual [100, 120] -> actual-minus-forecast variance [10, -30], MAE 20 in displayed units. No holdout values enter fitting; future schedule edits do not change frozen history.
- Pres 2000 psi, J 5 bbl/day/psi, q 5000 bbl/day -> BHP 3000 psi; half J -> 4000 psi. Assumed BHP constraint 3500 psi -> capacities 7500 and 3750 bbl/day. Nonpositive J is rejected; a pressure constraint at/below reservoir pressure gives zero.
- Availability zero contributes zero; expansion begins on its stated date; demand/capacity use matching period volumes.
- Citation cases cover missing productive-zone/site facts, absent approval/capacity evidence, stale/conflicting sources, fabricated IDs and document-injected instructions. Inspect claim support, not merely clickable links.
- Analytics imports pinned Explorer files without Explorer running. Permitting works independently. Downloaded exhibit retains IDs, sources, units, assumptions and method/version.

## 6. Delivery checklist

- [ ] Separate repo ownership and file contracts respected.
- [ ] Synthetic forecast/type-curve, reconciliation and schedule demonstration work.
- [ ] Two fictional injector cases, pressure-rate curve and assumed capacity/demand comparison work.
- [ ] Explorer real-source status reflects its actual proof, with GIS optional.
- [ ] Nexus engineering source/dependencies and reference fixtures carried; SWD integration and paper/table/unit decisions documented.
- [ ] Technical export reproduces displayed outputs and input lineage.
- [ ] SWD-13/SWD-14: CSV/XLSX mapping, supported units, invalid/conflicting row handling, per-analysis readiness and public/user/synthetic provenance pass generated-fixture and browser gates. **NOT STARTED.**
- [ ] RRC-09/RRC-10: confirmed read-only node map shows actual run events/status/errors/outputs/provenance, historical unrecorded fields and controlled failure; no editor, drag/drop or new Run/Retry/Schedule control. **NOT STARTED.**
- [ ] Per-goal completion report or one-hour checkpoint identifies completed evidence/current status/blockers/drift/next step; unfinished goals pause for explicit owner direction with no automatic repeated hours. All scope/priority/acceptance changes cite an explicit owner decision.
- [ ] Permitting corpus has actual source count, dates/classification and resolvable excerpts.
- [ ] Generated answers pass their gate or fallback is accurately labeled.
- [ ] Portfolio/app/source/export/return links work; statuses and local fallback are truthful.
- [ ] WPX narrative factual claims are owner-verified; no confidential/private sources copied.
- [ ] Feature freeze, desktop/mobile checks and three-minute walkthrough completed.

The unchecked items retain full initiative acceptance scope. Reusable bounded tests/components do not check a whole item off. Analytics/Explorer core and original P1/P2 are tracked separately in the completion plan; permitting/WPX/portfolio work is not authorized by this revision.

## 7. Later extensions

County GIS/proximity, statewide/refresh ingestion, additional forecasting methods, layering/relative permeability, transient aquifer/pressure models, calibrated capacity, geomechanics/seismicity models, multi-state corpus, advanced chat/monitoring/orchestration and elaborate reports need separate scopes and evidence. The legacy LLM platform stays intact.
