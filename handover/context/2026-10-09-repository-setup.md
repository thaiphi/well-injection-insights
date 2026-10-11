# Repository setup for Analytics and Explorer

**Reviewed:** October 9, 2026. This applies the owner's supplied development-workflow references to [today's two-app scope](2026-10-09-analytics-explorer-scope.md). It records setup guidance; neither application is scaffolded by this document.

## Sources verified

- [Shared conversation: Course Capstone Requirements](https://chatgpt.com/share/6ac87722-d42c-83ea-9789-4d23e52da1f9), read in Chrome. Its unconventional oil/gas project is reference context, not a replacement for our produced-water/disposal goals.
- [DataTalksClub course repository](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp), main inspected at `49b7a73b013fb82e5e93eb189345a940b1ed24b1` (September 26). [Project requirements](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/blob/49b7a73b013fb82e5e93eb189345a940b1ed24b1/project/README.md) are explicitly draft.
- [Matt Pocock's canonical skills repository](https://github.com/mattpocock/skills), main inspected at `b0618bc436ad893b3c5e84e55fba86586d34a404` (October 8). The shared conversation also links forks; use the canonical source for current guidance.

The course expects documented specifications, architecture and AI development/review evidence, a frontend/backend API contract, persistence, tests, containers, CI and deployment. Its later rubric includes operations and an agent extension pack. That is a course completion checklist, not a requirement to implement every module today. The course allows choosing the stack; its tutorial's database/hosting choices do not select ours. [Draft rubric](https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/blob/49b7a73b013fb82e5e93eb189345a940b1ed24b1/project/README.md).

## Practical setup in each owning repository

Create useful files as their work begins; an empty folder or placeholder workflow is not implementation evidence.

| File/area | Analytics responsibility | Explorer responsibility |
|---|---|---|
| `README.md` | Goal, actual readiness, run/test instructions, Nexus attribution, input labels | Acquisition/export workflow, verified source coverage and run/test instructions |
| `product-spec.md` | Today's forecast/reconciliation, injection/capacity and exhibit acceptance | One real UIC parent/history, source validation and artifact acceptance |
| `AGENTS.md` | Scope, module ownership, engineering invariants, supported gate commands | Scope, source/identity rules, parser/export invariants and gate commands |
| `GLOSSARY.md` | Volume/rate, pressure basis, datum, injectivity, capacity and forecast cutoff | UIC parent/control ID, source row/revision, reported pressure and calendar average |
| `docs/adr/` | Record material runtime, reuse, numerical-method and persistence decisions | Record verified source format, linkage keys and revision/disposition policy |
| `docs/agents/issue-tracker.md` | One declared ticket location and acceptance/status convention | Same convention; owning app and cross-app dependency explicit |
| Calculation/pipeline modules and tests | Extract Nexus dependency closure plus reference fixtures; isolate SWD logic from UI | Separate acquisition, raw decoding, linkage/QC and versioned export |
| Contracts | Explorer artifact consumer; frontend/backend API contract when services are added | Artifact producer: manifest, inventory, monthly history, quality report and dictionary |
| UI and export adapters | Centralize service/file access; keep displayed and downloaded results consistent | Inspect source-linked records and download the artifact |

Keep each application's implementation in its own repo. Choose runtime/package versions from actual extracted dependencies, record them and preserve a lockfile. Follow the [Nexus extraction record](feasibility/2026-10-09-nexus-engineering-reuse.md) and [file contract](05-architecture-integration.md). A course-compatible service/storage boundary can be added without making Explorer-to-Analytics integration depend on a live service.

## Use the referenced skills selectively

- [Setup guidance](https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/setup-matt-pocock-skills/SKILL.md) configures ticket operations and domain docs. The current domain convention is `GLOSSARY.md` plus `docs/adr/`. Skill installation, tracker selection and setup execution are not claimed here.
- [Architecture assessment](https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/docs/engineering/improve-codebase-architecture.md) is read-only. For us, bound it to extracting the needed Nexus modules; it does not authorize refactoring Nexus or redesigning the entire platform.
- [Grill With Docs](https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/grill-with-docs/SKILL.md) supports resolving an actual ambiguity and documenting vocabulary/decisions. Existing owner decisions remain in force.
- [Wayfinder](https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/docs/engineering/wayfinder.md) is for unresolved multi-session decisions. It is not a mandatory restart of planning; clear implementation tickets can proceed through the normal build/check/review workflow.

## First implementation tickets

### Codebase mapping: Graphify with Luna

Owner-requested workflow: GPT-6 Luna handles bounded dependency mapping and relevant graph queries as these two apps are built. Start with the Nexus modules selected for extraction; add each owning application's source map once its implementation exists. Main integrates the result, while feature implementers keep their existing responsibilities. Mapping must explain imports/call relationships with source locations and distinguish pure engineering modules from UI/settings/export adapters.

Refresh the relevant map after dependency/interface changes, then use it to check extraction completeness and callers affected by a change. A dependency graph is structural evidence; numerical correctness still requires deterministic reference/scenario tests. Keep mapping within today's scope rather than surveying unrelated Nexus features.

**Initial availability check:** the previous turn exposed no Graphify tools, Plugin Management returned no matching entry and the local CLI was not on PATH. The separate `gsd-graphify` CLI wrapper was not invoked. Luna prepared a manual map; no Graphify graph run occurred.

**Follow-up connection check, October 9:** the Graphify plugin is now present locally and its hosted tools are exposed. Both workspace discovery and repository discovery **FAILED**, returning HTTP 403: `No workspace is selected for this agent.` Repository access/index readiness remains unverified. The dashboard opened at its sign-in page; no account or workspace was selected by main.

The [official plugin guide](https://graphify.com/blog/graphify-chatgpt-plugin) explains that the plugin connects Codex to repositories already indexed in Graphify Cloud. No additional CLI or API key is required for this hosted workflow. Setup:

1. Sign in at [Graphify Cloud](https://app.graphify.com) with the account used for the plugin connection and choose or create the intended workspace.
2. Connect the GitHub repositories selected for indexing, using the account that has access. `thaiphi/phi-analytics` and the selected `thaiphipetro/esp-nexus` source live under different GitHub owners; verify access to each rather than assuming the Codex GitHub connector grants Graphify access. Add the two new app repositories when they exist.
3. Wait for each selected repository's status to become **Indexed**. Use the dashboard to set the intended agent default workspace, or provide its actual handle so main can select it through the plugin.
4. If the plugin sign-in did not select a workspace, complete its Connect/sign-in flow in Codex. Verify with workspace/repository discovery and a bounded source query. Record the indexed commit and compare it with the extraction source.

The [hosted MCP guide](https://graphify.com/mcp) documents workspace selection and index readiness. Do not guess a workspace handle, install a second MCP server to bypass this error, or treat hosted results as including uncommitted local changes. A local graph would require the separate open-source setup.

**Owner-selected local setup:** the owner subsequently supplied [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) and chose its open-source workflow. [Local installation and verification](2026-10-09-local-graphify.md) are complete: Graphify 0.9.82, registered Codex skill, a bounded Nexus source graph and successful Luna queries. This workflow does not depend on the unresolved Cloud workspace connection.

Luna's [initial Nexus dependency map](feasibility/2026-10-09-nexus-dependency-map.md) records the selected engineering imports, reciprocal sour-gas dependency, type-only leaf and UI/export adapter boundaries. It is a manual map with explicit coverage limits, ready to guide A-01 and compare with a later Graphify run.

### Implementation sequence

| Ticket | Owner | Done evidence |
|---|---|---|
| E-01: verified source slice | Explorer | One official UIC parent and linked H-10 rows; independently checked IDs/values |
| E-02: reproducible artifact | Explorer | Repeatable export with hashes, units, dictionary and accounted-for row dispositions |
| A-01: Nexus engineering extraction | Analytics | Selected source/dependencies/versions recorded; applicable reference fixtures carried and run |
| A-02: planning and injector cases | Analytics | Frozen forecast/holdout reconciliation, schedule-driven demand, two fictional pressure/capacity cases |
| I-01: connection and exhibit | Both, main integrates | Analytics imports E-02; downloaded technical record matches UI and preserves input lineage |

E-01 precedes final E-02 schema selection. A-01/A-02 can develop using a labeled contract fixture; I-01 requires the verified artifact. Record actual commands/results and independent review with each ticket. Stop at today's connected workflow before adding further models or course-extension features.

Engineering calculations remain deterministic. Existing pyResToolbox/MCP reference work supports verification; an LLM explanation is not a numerical oracle. Preserve public/synthetic/assumed distinctions and isolate monthly reported surface pressures from fictional bottomhole scenarios.

## Current status

The shared conversation and current repository sources were inspected, including the draft course rubric and canonical skill setup. This workspace currently contains the portfolio checkout; the two application checkouts, runtime selection, skill installation and implementation gates remain outstanding. No course-completion, deployment or numerical-test result is claimed.
