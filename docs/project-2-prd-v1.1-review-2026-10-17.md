# Project 2 PRD v1.1 review: ANA-E10, ANA-E11 and the external reference

Read-only follow-up review by Fable 5.1, 2026-10-17. It extends `docs/project-2-prd-analysis-2026-10-17.md`; findings G1–G18 and decisions D1–D13 are there. Repo HEAD `4722d81`. Nothing was built or modified.

- **Labels:** each point is marked FACT (verified in source, docs or a fetched page), ASSUMPTION (not verified) or REC (recommendation).
- **Paths:** `N/` = `swd-injection-analytics/`.
- **Diff checked (FACT):** v1.0 → v1.1 adds 51 lines and rewords the §7 Phase 3 and Phase 5 rows; nothing was deleted. E00–E09, the §5 import classes and the §9 non-goals are byte-identical to v1.0.

## 1. How v1.1 changes the earlier analysis

**Unchanged:**
- Findings G1, G3, G4, G5, G9, G10, G11, G12, G14, G15, G16, G17 and G18.
- Decisions D1, D3, D6, D8, D9, D10, D11 and D13.

**More urgent:**
- **G2 (real H-10 scope):** E10 adds multiwell real-H-10 panels and a "map reference" (see G19).
- **G6 (provenance vocabularies):** v1.1 adds `wellSelection`, `depthContext`, "typed evidence cards" and "source class", still with no mapping onto `N/src/importProfile.ts:3-6` or `N/src/sampleCase.ts:6-8`. A well-key crosswalk is also needed (see G29).
- **G8 (Project 1 contracts):**
  - E10 needs multi-UIC verified identities, location and depth roles, and a distance/geometry object.
  - E11 needs casing, bottom-location, log-pick, completion/interval and test-depth records.
  - FACT: none of these exist in any Explorer contract. The normalized inventory has only `permitted_top_depth_ft` and `permitted_bottom_depth_ft` (`N/web/explorer-evidence.mjs:24-25`). The Explorer source queries only `givw-z9t4` and `qq2j-f2zm`.
  - FACT: the RRC ODP does publish Wellbore Casing (G-1/W-2), Wellbore Plugging (W-3), Well Bottom Location, UIC well location, UIC BHP Test Results and UIC Step Rate Test Results.
  - ASSUMPTION: no public machine-readable directional-survey or log-pick dataset exists, so those would be user-supplied only.
- **G13 (a reported 0 is not missing):** reinforced by §6 "Never interpolate missing source values" and by §8 #13.

**Decisions affected:**
- **D2 (preservation-gate strategy):** E10 and E11 as new workspaces would edit the protected originals `N/web/navigation.mjs:2-9` and `N/web/index.html` (both in the 182-file manifest) and add new `src/`, `web/` and `tests/` files. That means more layers, which makes the registry refactor more valuable.
- **D5 (scope wording):** must now also cover multiwell public-H-10 panels and the GIS boundary.
- **D7 (Project 1 contracts):** expand to cover:
  - multi-UIC packages. FACT: the scope check accepts up to 1,000 UICs (`N/web/explorer-scope.mjs:4`), but recorded acquisition requires exactly one inventory row (`explorer-evidence.mjs:123`);
  - a distance/geometry object;
  - casing, bottom-location, interval and test-depth records.
- **D12 (vocabulary):** more urgent, because of G6 and G29.

### New decisions for the owner

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D14 | E10 scope | (a) a selection-state module plus panels inside the existing Injector history and Capacity assessment workspaces, with no map rendering and the Project 1 distance object shown as a table; (b) a new workspace with a "map reference", which means amending the "No … GIS" line (N/AGENTS.md:3) and product-spec.md:13; (c) defer E10 until E02, E03 and E07 exist, since it has nothing to coordinate before then | (a), and settle G28 (where demand comes from) at the same time |
| D15 | E11 data source and survey rule | (a) a user-supplied depth-evidence profile now: casing, interval and test-point rows with a declared MD/TVD basis, following the SWD-13 pattern; (b) wait for Project 1 casing and bottom-location contracts; (c) defer. Separately: limit "missing survey blocks MD/TVD conversion" to evidence alignment only, keeping the traverse's declared straight-slope assumption (G21) | (a), plus the scoped rule |
| D16 | Downsampling policy | (a) none, which is current behaviour: data is at most 120 months, 41-point curves and 4,097 traverse nodes, so §8 #13 becomes "no decimation" assertions; (b) add extrema-preserving decimation above a threshold | (a) |
| D17 | Record of the external reference | Write "pattern only, no code copied" in a design note under `N/docs/`. FACT: files under the nested `docs/` are not checked by the gate | Yes |
| D18 | "Handoff to/from Project 1" (E10 acceptance) | FACT: only Explorer → Analytics exists. Analytics posts only `ready`, `request-package` and `status` envelopes, never a package (`explorer-handoff.mjs:26,34,43`) | Strike "to/from", or declare the reverse direction out of scope |
| D19 | Workspaces vs panels | New navigation tabs (editing the protected navigation.mjs and index.html) vs panels inside existing workspaces | Panels first |

## 2. E10 and E11

### Requirements extracted

**E10, Integrated multiwell assessment (P1)**
- **Functional:**
  - A bounded explicit group of Project-1-verified UIC/wellbore identities. Each well keeps its case ID, artifact/version, location and depth roles, time range and coverage.
  - Coordinated panels:
    - selection / map reference
    - H-10 rate and pressure trends
    - test markers
    - calibrated vs assumed J
    - per-well source and quality status
    - modeled pressure and interference scenarios, shown only when their own prerequisites are met
  - Selecting a well focuses the PVT and traverse details.
  - Comparison tables carry source class, unit, pressure basis, date window, model version and missing-coverage status.
- **Technical:**
  - Highlights are keyed by a stable well ID or record key.
  - It consumes the Project 1 distance/geometry/evidence object.
  - Multiwell case adapters sit over the existing capacity/scenarios workflow.
- **Constraints:**
  - The public eligibility gates stay; H-10 alone never unlocks a calibrated or complete capacity case.
  - No GIS AOR engine in Project 2.
  - No parallel physics engine and no replacement dashboard.
- **Acceptance:**
  - A two-well case opens and compares eligible history without fabricated model outputs.
  - Switching wells updates every panel or marks the missing dataset.
  - Source changes invalidate dependent results and exports.
  - A missing H-10 or test record for the second well shows `incomplete/not_ready`, not zero.
  - The handoff is hash-verified and user-confirmed.

**E11, Depth-aligned context (P1, source-dependent)**
- **Functional:**
  - Synchronized depth tracks: wellbores, casings, formation markers, injection zones and pressure-test points.
  - A bounded set of wells, with a declared MD/TVD basis, units and datum.
  - The modeled pressure-vs-depth curve is overlaid separately from measured test points.
  - Highlighted references stay consistent across wells.
  - The user can inspect the evidence, assumptions, method and source.
- **Technical:**
  - It reads only reviewed, source-attested depth evidence or labelled user inputs.
  - It uses the `depthContext{basis, reference, sourceRef}` placeholder from §5.
- **Constraints:**
  - Monthly H-10 pressure is never shown as a continuous downhole log.
  - Step-rate test data is never relabelled as a fracture-gradient log without a justified derivation.
  - Unknown bottoms stay unknown.
  - No cross-well correlation from geography alone.
  - A missing deviation survey blocks MD/TVD conversion or alignment.
- **Acceptance:**
  - Two independently sourced wells show casing, intervals and test points on one declared depth scale.
  - Missing data shows gaps with reasons.
  - Modeled and observed data are visually and semantically distinct.
  - Exports keep full resolution, original units, versions and source references.
  - No diagram is presented as a calibrated correlation or a regulatory cross-section.

### Gaps and conflicts

- **G19 FACT:** E10's "map reference" and map highlights conflict with N/AGENTS.md:3 ("No … GIS"), N/product-spec.md:13 and 05-architecture-integration.md:37 ("GIS/location data may extend Explorer later").
  - The raw `latitude_nad83`, `longitude_nad83` and `prod_casing_pkr_depth` fields exist in the pinned raw source but are not normalized.
  - The sample case has no `raw-not-verified` inputs, so the spec §3 intent to display NAD83 coordinates and packer depth was not realized.
  - The Project 1 distance/geometry object does not exist.
- **G20 FACT:** No contract carries casing strings, shoe depths, surveys, log picks or test gauge depths. The only depth evidence today is the TRRC permitted top and bottom, plus synthetic MD/TVD in the sample. E11 is entirely source-dependent or user-supplied.
- **G21 FACT:** This is a tension, not a contradiction.
  - The traverse takes a declared TVD and MD and interpolates with a straight-slope assumption (`disposalCase.ts:8`, `wellboreTraverse.ts:46`, GLOSSARY.md:50, `sampleCase.ts:129`).
  - E11's survey rule bites when an evidence depth, such as a casing shoe MD, has to be placed on a TVD axis.
  - D15 resolves it.
- **G22 FACT:** The depth basis of the permitted interval is unspecified in the data dictionary (`explorer-evidence.mjs:77`). The sample assumes TVD. E11's "declared basis" must allow "basis unknown".
- **G23 FACT:** No reverse handoff exists (see D18).
- **G24 FACT:** No shared selected-well state exists.
  - Navigation is route-only (`navigation.mjs:1,12-13`).
  - The only selections are `sampleWellIndex` (sample mode, Injector history; `import-ui.mjs:29-30,109`) and the `disposal-target` select (`disposal-case.mjs:93`).
  - The §6 "use the existing workspace/navigation state" premise is false; a new selection-state module is needed.
- **G25 FACT:** E10 and E11 as new workspaces would edit protected files and need a baseline layer. The "21 workspaces" figure comes from the inventory; HANDOVER.md:72 says twelve (older wording).
- **G26 FACT:** The well-count bounds differ. The sample requires exactly two wells (`sampleCase.ts:76`); the capacity case allows 1–20 (`disposalCase.ts:158`); E10 states no bound.
- **G27 FACT:** E10 is P1 in §4 but sits in Phase 3 in §7. It has no panel content before E01–E03 and E07.
- **G28 FACT:** E10's multiwell case has no produced-water demand. A public-only source is blocked for the capacity case (`disposal-context.mjs:13`; `import-ui.mjs:64`), and the PRD does not say where demand comes from. Without an answer, the capacity panel stays `not_ready` permanently.
- **G29 FACT:** Well keys differ. The capacity-case well `id` is free text (`disposalCase.ts:19`); the TRRC key is the nine-digit `uic_number`; the sample bridges them ad hoc (`UIC-000020838` vs `000020838`). A crosswalk is needed, and the `wellIdentity.wellboreCrosswalk` slot in §5 is the right place for it.

### Technical soundness

- **FACT:** Each traverse node carries both `measuredDepthFt` and `tvdFt` (`wellboreTraverse.ts:8,59`), so the modeled curve can be drawn on either basis under the declared slope.
  - Current depth charts plot against MD (`disposal-case.mjs:63`; `hydraulics.mjs:157`).
  - A test point whose gauge depth differs from the datum must carry its own depth and basis, and must not be moved without a hydrostatic correction.
- **FACT:** The existing chart helpers draw only lines and points: `disposal-case.mjs:49-59`, `hydraulics.mjs:141-158`, `import-ui.mjs:197-205` and `exhibitSvg.ts:12-37`. The only interval-like primitive is the event line in `pressureSupportChart.ts:105-109`.
  - REC: E11 needs a new track renderer (casing rectangles, interval bands, point markers) that shares the existing axis and metadata conventions.
- **FACT:** The capacity case is already multiwell (`disposalCase.ts:132-141`, 1–20 wells), and Capacity assessment and Scenarios are one workspace.
  - REC: build E10 as selected-well state plus panels in existing workspaces.
  - E10 overlaps E07 only in the interference panel, which should consume E07's outputs, not recompute them.

## 3. Testability of the §6 bullets and §8 #11–13

**FACT: no chart helper decimates data today.**
- `import-ui.mjs:197-205`: every row is plotted, and the line breaks at null; only the axis labels are thinned.
- `disposal-case.mjs:49-59,63`: every row and every traverse node is plotted (up to 4,097), and the line breaks at null.
- `hydraulics.mjs:145-146,157`: unsupported points are nulled, and every node is plotted.
- `exhibitSvg.ts:25-26`: one polyline over all values, with the full values in `data-values`.
- `pressureSupportChart.ts:18-21,95,103,113-114`: the line breaks at null, and missing months are listed.
- `exhibit-pdf.mjs:109-110`: labels are thinned, and all data points are plotted.
- Exports are built from result objects, not from SVG geometry, and each SVG `<metadata>` embeds the full JSON.

**Consequences (REC):**
- **§8 #13** tests a mechanism that does not exist. Today it can only be tested as regression guards:
  - the plotted-point count equals the finite-value count;
  - a null month breaks the line;
  - exports equal the result objects.

  "Step-rate discontinuity" needs E01 step-rate data first. Rewrite #13 as "no decimation; gaps preserved; exports from result objects", unless D16 chooses (b).
- **§8 #11** can be tested with the existing Node DOM-module pattern (`N/tests/sample-tour.test.mjs:1-12`), but only once a selection-state module exists (G24). Export synchronization can be checked through the dataset identity in the SVG `<desc>`/`<metadata>`.
- **§8 #12** can be tested as pure-function guards in a new depth-context module:
  - a top-only pick gives a null interval;
  - a missing survey makes alignment `blocked`;
  - an unknown gauge depth leaves the point unplaced.

  This mirrors how `sampleCase.ts:21,60` enforces the no-relabel rule.
- **§6 "Linked views":** the premise is false. Rewrite it to "introduce one selection-state module; navigation stays route-only".
- **§6 "Data preservation in plots":** consistent with current behaviour. State "no decimation" as the default.

## 4. External reference (gabrielserrao/spe-2026-challenge)

### What the repo is (FACT, fetched)

"Volve Operational Intelligence" is an agentic drilling-intelligence system built on the Equinor Volve data for the SPE GCS 2026 ML Challenge.

- **Stack:** Neo4j, LangGraph, FastAPI with SSE, Next.js 16 with TypeScript, Tailwind and Zustand, plus Cytoscape, Leaflet, Three.js and Recharts.
- **Activity:** 9 stars, 4 forks, 1 commit.
- **License:** GNU GPL v3. The README notes a PyMuPDF dependency, which is AGPL-3.0. The PRD's licensing statement is accurate.

### The four files the PRD cites

| File | What it does | Fit with our PRD |
|---|---|---|
| `correlation.py` | Matches wells by name with a regex; returns full-resolution trajectory, formations and hole sections; `events` is always empty | Name matching is the fragile approach E10 rejects |
| `pressure.py` | TVD only; stride-decimates to 300 points per well, which does not preserve peaks; rounds to 4 dp | Contradicts PRD §6; do not copy |
| `CorrelationCanvas.tsx` | Plain SVG with a scroll-synced header and body; depth range hard-coded to 0–5,000 m; axis hard-coded to "m MD"; the `depthBasis` prop is unused; data keyed by `well.name` | Layout is a usable pattern; the hard-coding is not |
| `CasingTrack.tsx` | A missing bottom gives NaN coordinates; a missing OD falls back to half the maximum width | Contradicts E11 "unknown bottoms stay unknown" |

### What is reusable as a pattern (REC)

- **Reusable:**
  - a shared depth axis with per-well columns;
  - track presets keyed by id;
  - a header/body split for a sticky axis;
  - a per-well evidence shape `{identity, trajectory?, intervals, markers, points}`.

  `pressureSupportChart.ts` already uses the same hand-built-SVG approach, so no dependency is needed.
- **Not reusable:** name matching, stride decimation, the hard-coded range and basis, NaN on missing data, and the server stack.

FACT: the repo already ships GPL pyResToolbox source with its license retained (`brinePvt.ts:24`; ADR 001:28). The PRD's "no copying without license review" rule is consistent with that practice, and copying nothing creates no obligation.

## 5. Changes to the plan and success criteria (only where v1.1 changes them)

- **Phase A:**
  - add decisions D14–D19;
  - the scope amendment names multiwell public-H-10 views and the GIS boundary;
  - record the external reference (D17).
- **Phase 1:** if D15 is (a), add a user-supplied depth-evidence profile (casing, interval and test-point rows, with a declared MD/TVD basis). This unblocks E11 without Project 1.
  - **Success criterion:** a row with an unknown basis or unknown bottom validates as "unknown" and is never coerced.
- **Phase 2:** unchanged. The E11 modeled-curve overlay can be prototyped on the existing traverse profiles once the selection module exists.
- **Phase 3:** E10 panels and E11 tracks come after E01–E03, and after E07 for the interference panel.
  - **Project 1 prerequisites:** multi-UIC packages, a distance/geometry object, and casing, bottom-location, interval and test-depth records.
  - **Success criteria:**
    - §8 #11: switching the selected well updates every panel or marks its missing dataset, and each export carries only that well's artifact and pin;
    - §8 #12: the fabrication guards pass;
    - §8 #13: rewritten per D16;
    - the demand source for the capacity panel is declared (G28);
    - the layer lists any edits to navigation.mjs or index.html.
- **Phase 5:** "linked evidence cards" display the E01 evidence records.
  - **Success criterion:** card content equals the exported JSON record.
- **Phase 0′:** contract v2 states that the handoff is one-way, unless D18 decides otherwise.
