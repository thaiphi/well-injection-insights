# Depth view (#10, ANA-E11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** Add a "Depth view (review aid)" panel to the disposal case results. For up to 4 case wells it places user-uploaded depth evidence on one MD or TVD axis next to the case's own modelled pressure-vs-depth curve, lists every row that cannot be placed with its reason, and exports sealed JSON, CSV and SVG.

**Architecture.**
- **Pure TypeScript modules in `src/`, compiled to `dist/`:**
  - profile parsing and validation;
  - placement and curve extraction;
  - a deterministic SVG builder;
  - the sealed export.
- **One web module** for the session and panel. It listens for the existing `disposal-case-result`, `disposal-case-invalidated` and `workspace-source` events, as `web/transient-buildup.mjs` does.
- **Display only.** Nothing feeds `buildDisposalCase`. No new numerical method: the curve is the case's own `HydraulicPoint` for a well, month and scenario.

**Tech stack.** TypeScript 5.9.3, `node:test`, plain ES modules and Web Crypto. No worker and no new dependencies.

**Spec (binding; read it before any task):** `docs/superpowers/specs/2026-11-16-e11-depth-pressure-context-design.md`.

**Issue:** thaiphi/well-injection-insights #10. The PR says "Closes #10" only after the owner accepts the layer.

**Branch:** `feature/e11-depth-context`, from main `9ff59ae`.

## Global Constraints

**Commands.**
- Direct Node paths only; no npm, npx, vitest or bare python. From `swd-injection-analytics/`:
  - `node ../node_modules/typescript/bin/tsc -p tsconfig.json`
  - `node --test tests/<file>.test.mjs`
- Full gate, from the repo root: `node scripts/check-all.mjs`.

**Git and agents.**
- Workers never stage, commit or push. The orchestrator commits after each task review.
- At most 2 active subagents.

**Data.**
- Fictional data only in tests, the example and evidence: wells `FICTIONAL-INJ-A` and `FICTIONAL-INJ-B` (`src/planningFixture.ts`).
- Never copy an Explorer artifact into the repo.
- Screenshots showing real values stay outside the repo; only their hashes are kept.

**Bytes.** CR bytes: `web/import-ui.mjs` keeps exactly 4, `web/index.html` exactly 3 (and is **not** edited), and every new file has 0.

**Limits:**
- the profile: at most 2,000 data rows and 20 distinct `well_id`s;
- 1–4 shown wells;
- `source_ref` and `bottom_source_ref`: 1–200 characters.

**Fixed copy** (export each string as a named constant from `src/depthContext.ts`):
- `REVIEW_AID`: "Review aid: user-supplied depth evidence beside modelled pressure. Not a calibrated correlation or a regulatory cross-section."
- `GAP_NO_REFERENCE`: "wellhead depth below the depth reference not declared"
- `gapNoSurvey(from,to)`: "no survey for this well; cannot convert MD to TVD", with the bases in order (e.g. "…cannot convert TVD to MD")
- `GAP_OUTSIDE_SURVEY`: "outside the survey range"
- `GAP_HORIZONTAL`: "the survey is horizontal here; this TVD has more than one MD"
- `GAP_BASIS_UNKNOWN`: "depth basis not stated"
- `GAP_PRESSURE_BASIS`: "pressure basis not stated"
- `GAP_SHUT_IN`: "shut in this month; no modelled curve"
- `DROPPED`: "dropped: well no longer in the case"
- `LIMIT_LABEL`: "declared bottomhole maximum at the pressure datum (case input)"
- `CURVE_DEPTH_NOTE`: "modelled depths follow the case's declared MD and TVD, not the survey"
- `UNIFORM_NOTE`: "uniform brine model: a straight line from the required wellhead pressure to the bottomhole pressure at the declared pressure datum, exact for this model under the straight-slope assumption"
- `TEST_DATE_NOTE`: "test dates differ from the modelled month; a test is evidence, not a check of the curve"
- `surveyNote(n)`: "survey TVD at the case's pressure datum differs from the case TVD by N ft; the curve is not moved". N is rounded to 1 ft. The note is shown when the difference is more than 10 ft.
- `EXAMPLE_LABEL`: "fictional example — not typical values"
- `EXAMPLE_ONLY_DEMO`: "The fictional example is only for the demo case."

**Labels.** Every drawn evidence item shows its `content_class` label. Curves are labelled "modelled (case, assumed inputs)". Test points are labelled "measured (as entered, with source)".

**Banned words.** Generated text must not contain `proven|sustainable|calibrated|validated|safe` (`BANNED` in `src/caseSummary.ts`). The one exception is the word "calibrated" inside `REVIEW_AID`, which negates it; the banned-word test checks every generated string other than `REVIEW_AID`.

**No decimation (D16).** Every traverse node and every placed row is drawn and exported.

**Exports:**
- sealed SHA-256 over key-sorted canonical JSON, following the pattern of `src/transientExport.ts`;
- verification recomputes, with an exact hash and a 1e-9 relative numeric tolerance;
- downloads re-verify before saving;
- the CSV uses the 4-column long format `section,rule_or_well,field,value`.

## Review Focus

1. **A survey that is not monotonic, or a TVD deeper than its MD.** The upload is refused with a row-numbered reason, and nothing is placed from a bad survey. (Task 1)
2. **A TVD-basis row on an MD display where the survey has a horizontal stretch.** The row is a gap with `GAP_HORIZONTAL` and is never placed at the first matching MD. (Task 2)
3. **A case recalculation that removes one profile well.** Only that well's rows are listed with `DROPPED`; the other well's rows stay, and its selection survives if it is still a case well. (Task 4)
4. **A month where the shown well is shut in (availability 0) on one scenario but flowing on the other.** Switching the scenario redraws; the shut-in side shows `GAP_SHUT_IN`, never a zero-pressure line. (Task 2)
5. **A text value in a numeric column, e.g. "3,250" or "3250 ft".** The upload is refused with the row number. The engine never strips characters or guesses. (Task 1)

---

### Task 0 (orchestrator): branch, layer spec, archive

- [ ] `git checkout -b feature/e11-depth-context` from main `9ff59ae`.
- [ ] Write `migration/layer-specs/phase-3d-depth-context.json`:
  - `purpose`: "#10 (ANA-E11) depth view: user-uploaded depth evidence beside the disposal case's modelled pressure, as a display-only review aid";
  - `acceptanceEvidence`: `demo/E11-DEPTH-CONTEXT-VERIFICATION.md`;
  - `approvedDocs`: the spec and this plan;
  - `changes`: `web/import-ui.mjs`, `web/redesign.css`;
  - `newFiles`: every new `src/`, `web/` and `tests/` file named in Tasks 1–4;
  - `rootFiles`: `migration/layers/index.json`.
- [ ] Archive: `node scripts/record-layer.mjs phase-3d-depth-context archive` from the repo root.
- [ ] Commit the plan, the layer spec and the archive.

### Task 1: `src/depthProfile.ts`, parse and validate the profile, plus the fictional example

**Files:**
- Create `src/depthProfile.ts`.
- Test: `tests/depth-profile.test.mjs`.

**Interfaces.**
- **Consumes:** `parseCsv` from `src/importProfile.ts`.
- **Produces:**
  ```ts
  export const DEPTH_PROFILE_VERSION='depth-profile/1';
  export const PROFILE_COLUMNS=['well_id','kind','top_depth_ft','bottom_depth_ft','depth_basis','md_ft','tvd_ft','reference','wellhead_below_reference_ft','size_in','label','pressure_psi','pressure_basis','test_date','test_type','source_ref','bottom_source_ref','content_class'] as const;
  export type DepthBasis='MD'|'TVD'|'unknown';
  export type ProfileKind='depth-reference'|'survey'|'casing'|'packer'|'permitted-interval'|'perforated-interval'|'formation-top'|'test-point';
  export type ContentClass='public-reported'|'measured'|'assumed'|'literature';
  export const CONTENT_CLASS_LABELS:Readonly<Record<ContentClass,string>>; // 'Public, as reported' | 'Measured (user, not verified)' | 'Assumed' | 'Literature'
  export type ProfileRow={row:number;wellId:string;kind:ProfileKind;topFt:number|null;bottomFt:number|null;basis:DepthBasis|null;mdFt:number|null;tvdFt:number|null;reference:string|null;wellheadBelowReferenceFt:number|null;sizeIn:number|null;label:string|null;pressurePsi:number|null;pressureBasis:'psia'|'psig'|null;testDate:string|null;testType:'static'|'flowing'|'step-rate'|'other'|null;sourceRef:string;bottomSourceRef:string|null;contentClass:ContentClass;raw:Readonly<Record<string,string>>};
  export type Profile={version:typeof DEPTH_PROFILE_VERSION;rows:ProfileRow[]};
  export class ProfileError extends Error{readonly problems:readonly {row:number|null;reason:string}[]}
  export function parseDepthProfile(text:string):Profile;           // throws ProfileError listing every problem
  export function pruneProfile(p:Profile,caseWellIds:readonly string[]):{profile:Profile;dropped:{row:number;wellId:string}[]};
  export const FICTIONAL_DEPTH_PROFILE_CSV:string;
  ```
- **Rules.** `row` is the original 1-based data-row number. Headers must equal `PROFILE_COLUMNS` exactly as a set; order is free. Empty cells are null. Numbers must match `/^-?\d+(\.\d+)?$/` and be finite. There is no unit stripping and no thousands separator.
- **Refused, as a problem on that row:**
  - an unknown `kind` or `content_class`;
  - a missing field that the spec's table requires for the kind (`depth_basis` must be `MD`, `TVD` or `unknown`; an empty `pressure_basis` is **allowed**, because it becomes a gap later);
  - a negative depth, or a top deeper than its bottom;
  - an empty or over-long `source_ref`;
  - a `formation-top` with `bottom_depth_ft` but no `bottom_source_ref`;
  - `test_date` not `YYYY-MM-DD`, or not a real calendar date;
  - `size_in` or `pressure_psi` ≤ 0;
  - per well: more than one `depth-reference`;
  - per well: a `survey` whose stations, sorted by MD, have a duplicate MD, a falling TVD, or a TVD above its MD + 1e-6.
- **Refused for the whole file:** more than 2,000 rows, more than 20 wells, or an extra or missing column.
- **The example** has a `depth-reference` for both demo wells (`KB`, wellhead 18 ft below it), with every `source_ref` beginning `fictional example`.
  - Well A has a survey (stations 0/0, 1000/1000, 3318/3018 below KB). Its depths match the demo defaults TVD 3000 / MD 3300 plus the 18 ft offset. It has casing, a packer, a perforated interval, two formation tops (one with a sourced bottom) and two test points (one psig, one psia).
  - Well B has no survey. It has MD-basis casing, a TVD-basis permitted interval, an `unknown`-basis packer, and a test point with an empty `pressure_basis`.

- [ ] **Step 1: Write the failing tests:**
  - `FICTIONAL_DEPTH_PROFILE_CSV` parses with no problems into exactly the rows above, with `row` numbers and `raw` kept.
  - Each refusal rule in the list above gives a `ProfileError` whose `problems` name the row and the rule, and all the problems in one file are reported together.
  - `"3,250"` and `"3250 ft"` are refused (Review Focus 5).
  - A non-monotonic survey and a survey with TVD > MD are refused (Review Focus 1).
  - `pruneProfile` drops only the rows of wells not in the list and reports them in row order.
  - Determinism: parsing the same text twice deep-equals.
- [ ] **Step 2:** Run `node --test tests/depth-profile.test.mjs`; expect FAIL (module missing).
- [ ] **Step 3:** Implement `src/depthProfile.ts`.
- [ ] **Step 4:** Compile with tsc, then rerun the test; expect PASS.
- [ ] **Step 5 (orchestrator):** commit.

### Task 2: `src/depthContext.ts`, placement, curves and the result

**Files:**
- Create `src/depthContext.ts`.
- Test: `tests/depth-context.test.mjs`.

**Interfaces.**
- **Consumes:**
  - Task 1 types;
  - `DisposalCase`, `DisposalWell`, `HydraulicPoint` and `caseHydraulicPoint` from `src/disposalCase.ts`;
  - `toAbsolute` from `src/wellAssumptions.ts`.
- **Produces:**
  ```ts
  export const DEPTH_CONTEXT_VERSION='depth-context/1';
  export type Scenario='base'|'compared';
  export type CurveSource={wellId:string;well:DisposalWell;fluid:DisposalCase['inputs']['fluid'];hydraulics:DisposalCase['inputs']['hydraulics']|null;onstreamStbd:number;point:HydraulicPoint};
  export function scenarioWell(result:DisposalCase,scenario:Scenario,wellId:string):DisposalWell;   // compared: apply inputs.comparison exactly as buildDisposalCase does
  export function curveSources(result:DisposalCase,scenario:Scenario,month:string,wellIds:readonly string[]):CurveSource[];
  export type Placement={status:'placed';topFt:number;bottomFt:number|null;conversion:null|{from:'MD'|'TVD';stations:[{mdFt:number;tvdFt:number},{mdFt:number;tvdFt:number}]};pressurePsia?:number}|{status:'gap';reason:string};
  export type CurveNode={mdFt:number;tvdFt:number;depthFt:number;pressurePsia:number};
  export type Curve={status:'drawn';model:'segmented'|'uniform';nodes:CurveNode[];flagged:boolean;reasons:string[];rateStbd:number;limitMarker:{depthFt:number;pressurePsia:number;label:string};notes:string[]}|{status:'gap';reason:string};
  export type Track={wellId:string;reference:{name:string;wellheadBelowReferenceFt:number}|null;items:{row:ProfileRow;placement:Placement}[];curve:Curve;surveyNote:string|null};
  export type DepthSelection={wellIds:string[];basis:'MD'|'TVD';scenario:Scenario;month:string;referenceDepthFt:number|null;referencePressurePsia:number|null};
  export type DepthContext={version:typeof DEPTH_CONTEXT_VERSION;selection:DepthSelection;tracks:Track[];axisMaxFt:number;reviewAid:typeof REVIEW_AID;testDateNote:typeof TEST_DATE_NOTE};
  export function placeRow(row:ProfileRow,basis:'MD'|'TVD',wellRows:readonly ProfileRow[]):Placement;
  export function buildDepthContext(profile:Profile,sources:readonly CurveSource[],selection:DepthSelection):DepthContext;
  ```
- **Selection.** `buildDepthContext` throws when:
  - there are 0 or more than 4 `wellIds`;
  - a source is missing for a selected well;
  - `basis` or `scenario` is invalid.

  `curveSources` throws when the month is not in the case. Tracks follow the order of `selection.wellIds`.
- **Placement.** Follow the spec's "Placing evidence" rules exactly, in this order:
  1. no `depth-reference` for the well → `GAP_NO_REFERENCE`;
  2. `basis` is `unknown` → `GAP_BASIS_UNKNOWN`;
  3. same basis → place the row as entered;
  4. other basis without at least 2 `survey` rows → `gapNoSurvey`;
  5. outside the station range → `GAP_OUTSIDE_SURVEY`;
  6. TVD→MD where the bracketing stations have equal TVD → `GAP_HORIZONTAL`;
  7. otherwise interpolate linearly, recording the 2 stations.

  More rules:
  - **`survey` and `depth-reference` rows** are not items. They are inputs to placement only, and are listed in the evidence detail.
  - **Test points** must also have a `pressureBasis`, else `GAP_PRESSURE_BASIS`. Their `pressurePsia` is `toAbsolute(pressure, basis)`.
- **Curve.** The point is `CurveSource.point`.
  - No `depth-reference` → `GAP_NO_REFERENCE`.
  - `status:'shut-in'` → `GAP_SHUT_IN`.
  - `status:'unsupported'` → a gap with `point.reasons.join(' ')`.
  - Segmented, with `point.traverse` present → nodes from every `traverse.points` entry: `mdFt`/`tvdFt` + offset, and `depthFt` = the MD or TVD on the display basis.
  - Uniform → 2 nodes: (0+offset, `requiredSurfacePsia`) and (case MD/TVD + offset, `bottomholePsia`), with `UNIFORM_NOTE`.
  - `flagged = !point.operatingFeasible`; `reasons = point.reasons`.
  - `limitMarker` is at the datum depth on the display basis, with `pressurePsia = well.limitPsia` and `LIMIT_LABEL`.
  - `notes` always include `CURVE_DEPTH_NOTE`.
- **Survey note.** With ≥ 2 stations covering case MD + offset: if |survey TVD − (case TVD + offset)| > 10, use `surveyNote(diff)`; otherwise null.
- **`axisMaxFt`** is the largest placed depth or curve depth across the tracks; with nothing drawn, 0.

- [ ] **Step 1: Write the failing tests**, using `buildDisposalCase` on a case built from the demo wells in `src/planningFixture.ts` (TVD 3000 ft, MD 3300 ft; see `tests/disposal-case.test.mjs` for how a case input is assembled). Build it once with the depth-dependent model (`hydraulics` set) and once without, and use the Task 1 example:
  - Well A on TVD: an MD casing shoe is converted with the stations recorded; the psig test point is +14.7.
  - Well B on TVD: its MD casing is `gapNoSurvey('MD','TVD')`, the packer is `GAP_BASIS_UNKNOWN`, the test point is `GAP_PRESSURE_BASIS`, and its TVD interval is placed.
  - Segmented curve: node count equals `point.traverse.points.length`, and the first node's depth equals the 18 ft offset.
  - Uniform curve: exactly 2 nodes, with `UNIFORM_NOTE`.
  - A point above `limitPsia` (set `limitPsia` low in the fixture) is drawn with `flagged:true` and the case reason.
  - Review Focus 4: comparison availability 0 makes the compared scenario `GAP_SHUT_IN` while the base is drawn.
  - Review Focus 2: a TVD row on an MD display inside a flat survey stretch gives `GAP_HORIZONTAL`.
  - A row is placed exactly at a station depth and at the range ends; 1e-6 ft beyond the end gives `GAP_OUTSIDE_SURVEY`.
  - Removing well B's `depth-reference` makes all its items and its curve `GAP_NO_REFERENCE`.
  - The survey note appears when the demo well A TVD is edited to 2980 and does not appear at 3000.
  - Selecting 5 wells, or a month not in the case, throws.
  - Banned words: no generated string other than `REVIEW_AID` matches `BANNED`.
- [ ] **Steps 2–4:** as in Task 1.
- [ ] **Step 5 (orchestrator):** commit.

### Task 3: `src/depthContextSvg.ts` and `src/depthContextExport.ts`, the drawing and the sealed exports

**Files:**
- Create `src/depthContextSvg.ts` and `src/depthContextExport.ts`.
- Test: `tests/depth-context-export.test.mjs`.

**Interfaces.**
- **Consumes:** Tasks 1 and 2, and the seal pattern of `src/transientExport.ts`.
- **Produces:**
  ```ts
  // depthContextSvg.ts
  export function depthContextSvg(ctx:DepthContext,metadataJson:string|null):string;  // deterministic; no Date, no random ids
  // depthContextExport.ts
  export const DEPTH_EXPORT_SCHEMA='depth-context-export/1';
  export type DepthExport={profile:Profile;dropped:{row:number;wellId:string}[];sources:CurveSource[];selection:DepthSelection;caseRef:{schemaVersion:string;methodVersion:string;contentSha256:string|null};context:DepthContext};
  export async function sealDepth(x:DepthExport):Promise<SealedDepth>;
  export async function verifyDepth(s:SealedDepth):Promise<SealedDepth>;
  export function depthJson(s:SealedDepth):string;
  export function depthCsv(s:SealedDepth):string;
  export function depthSvg(s:SealedDepth):string;               // depthContextSvg(s.context, depthJson(s))
  export async function verifyDepthSvg(svg:string):Promise<SealedDepth>;
  ```
- **The SVG.**
  - One track group per well (`<g data-well="…">`), sharing one depth scale from 0 to `axisMaxFt`, with depth increasing downwards.
  - **Schematic column:**
    - casing is a rectangle from its top (or 0) to the shoe;
    - the packer is a marker;
    - intervals are bands;
    - formation tops are a tick with their label, and a band only with a sourced bottom.
  - **Pressure column:**
    - the curve is a polyline over every node; the flagged style is dashed and red;
    - test points are circles labelled with the date and type;
    - the limit marker is a diamond.
  - Optional reference depth and pressure lines are drawn across every track.
  - A legend carries the curve label, the test label and `TEST_DATE_NOTE`.
  - `<desc>` holds `REVIEW_AID`.
  - When `metadataJson` is given, it is placed XML-escaped in `<metadata>`.
  - Gaps are not drawn; they are listed in the panel and the exports.
- **Verify** recomputes everything:
  - the profile from its rows: re-run the row validation by re-serialising `raw` through `parseDepthProfile`;
  - each `source.point` with `caseHydraulicPoint({fluid,hydraulics},well,onstreamStbd)`;
  - the context with `buildDepthContext`.

  It compares with a 1e-9 relative tolerance and requires an exact hash.
- **`verifyDepthSvg`** extracts and unescapes the metadata, runs `verifyDepth`, regenerates `depthSvg` and requires byte equality.
- **The CSV** has the sections `selection`, `case-ref`, `rows` (every row with its placement or gap), `curve-nodes`, `curve-notes`, `dropped` and `review-aid`.

- [ ] **Step 1: Write the failing tests:**
  - A JSON round trip verifies.
  - Rejected:
    - an edited node pressure without resealing;
    - the same edit resealed (by recomputation);
    - an edited profile depth, resealed;
    - an edited `onstreamStbd`, resealed.
  - The SVG round trip verifies. An SVG with one changed character outside the metadata is rejected.
  - The polyline point count equals the node count (no decimation).
  - Every CSV line has 4 fields, and the CSV contains `REVIEW_AID`.
  - Two seals of the same input are byte-identical.
- [ ] **Steps 2–5:** as in Task 1.

### Task 4: the panel (protected `web/import-ui.mjs`, `web/redesign.css`)

**Files:**
- Create `web/depth-context.mjs`, with a DOM-free `createDepthSession` and `mountDepthContext(anchor,{getSource})`.
- Modify `web/import-ui.mjs`:
  - one import line;
  - one call `mountDepthContext($('transient-buildup'),{getSource:()=>source});` appended to the existing line 331.

  Keep exactly 4 CR bytes.
- Modify `web/redesign.css`: add `main[data-view="sensitivity"] #depth-context` to the existing sensitivity hide rule.
- Test: `tests/depth-session.test.mjs`.

**Interfaces.**
- **Consumes:** Tasks 1–3.
- **`createDepthSession({getSource,onChange})`** returns:
  ```ts
  {snapshot():{ready:boolean;profile:Profile|null;problems:ProfileError['problems'];dropped:{row:number;wellId:string}[];caseWellIds:string[];months:string[];selection:Partial<DepthSelection>;context:DepthContext|null;message:string|null};
   loadProfileText(text:string):void; loadExample():void; clearProfile():void;
   select(partial:Partial<DepthSelection>):void; draw():void;
   onCaseResult(result:DisposalCase,contentSha256:string|null):void; onInvalidated():void; onSourceSwitch():void;
   exportDepth(format:'json'|'csv'|'svg'):Promise<{text:string;filename:string;mime:string}|{cancelled:true}>}
  ```
- **`mountDepthContext`** creates `<section id="depth-context" class="panel" hidden aria-labelledby="depth-context-title">` and inserts it after the anchor.

**Behaviour.**
- **Title:** "Depth view (review aid)". `REVIEW_AID` sits under it.
- **Visibility:** the panel is hidden until a case result exists.
- **Controls:**
  - a file input (`.csv`);
  - "Load fictional example", enabled only when `getSource()==='demo'` (otherwise `EXAMPLE_ONLY_DEMO`), labelled `EXAMPLE_LABEL`;
  - "Clear profile";
  - a checkbox per case well, none ticked, with a maximum of 4 (a 5th tick is refused with a message);
  - MD / TVD radios with no default;
  - a scenario select (Base by default);
  - a month select (first case month by default);
  - optional reference depth and reference pressure inputs;
  - "Draw".
- **Draw** is refused until there is a profile, 1–4 wells and a basis.
- **Output:**
  - the SVG;
  - a per-well list of gaps (row number, kind, reason), plus the `dropped` list;
  - per-well notes (curve notes, survey note, case reasons when flagged);
  - an evidence detail (`<details>` per placed item) showing the row's raw values, `source_ref`, content-class label, basis, depth reference and the conversion stations;
  - a curve detail per well: the case well inputs, the method version, the scenario, month and onstream rate, and the curve notes;
  - JSON, CSV and SVG downloads, each re-verified before saving.
- **Withdrawal (spec "What withdraws what"):**
  - any `select`, profile change, `onCaseResult` or `onInvalidated` clears `context` and bumps a generation, so an in-flight export returns `{cancelled:true}`;
  - `onCaseResult` keeps the profile through `pruneProfile` and drops ticked wells that are no longer in the case;
  - `onSourceSwitch` clears the profile and the selection.
- **Mobile:** tracks stack vertically below 600 px, with no horizontal page scroll.

- [ ] **Step 1: Write the failing session tests** (DOM-free):
  - Without a case result, the session is not ready.
  - `loadExample` on a `user` source gives `EXAMPLE_ONLY_DEMO`; on a `demo` source it loads the 2 wells.
  - Draw is refused without a basis, and with 5 wells.
  - Each `select` change withdraws the context and cancels an in-flight export.
  - Review Focus 3: `onCaseResult` without well B lists B's rows as `DROPPED`, keeps A's, and keeps A ticked.
  - `onSourceSwitch` clears the profile.
  - The export round trip goes through `verifyDepth` / `verifyDepthSvg`.
  - The CR byte counts: `import-ui.mjs` 4 and `index.html` 3 (read the files).
- [ ] **Steps 2–4:** as in Task 1. Then run the full suite and `node scripts/check-carried-oracles.mjs` (248 comparisons, 0 failures).
- [ ] **Step 5 (orchestrator):** commit.

### Task 5 (orchestrator + qa): verification, evidence, layer

- [ ] **Browser check** (skill `browser-check`, agent `qa`), at 1280×900 and at 390×844:
  1. Demo case: calculate, then load the fictional example, tick A and B, choose TVD, and Draw. On A: casing, packer, perforations, tops and test points show, with a curve from 18 ft down to the datum. On B: the gaps list shows "no survey…", "depth basis not stated" and "pressure basis not stated".
  2. Switch to MD, then switch the scenario. Each change withdraws the drawing until Draw is pressed again.
  3. Set a low bottomhole limit in the case and recalculate: the profile is kept, the curve is flagged with the case reason, and the limit marker shows.
  4. Edit well A's TVD to 2980 and recalculate: the survey note appears.
  5. JSON, CSV and SVG download; each verifies in Node, and every CSV line has 4 fields.
  6. A `user` case: the example button is refused, and a hand-written profile (in the scratchpad) uploads.
  7. A source switch clears the profile.
  8. The sample case: the existing panels (E05, E10, #7/#8) are unchanged.
  9. No console errors.
  10. Mobile: no horizontal page scroll.
- [ ] **Write `demo/E11-DEPTH-CONTEXT-VERIFICATION.md`** in the E10 format.
- [ ] **Full gate:** expect 6/8 before the accept; the two failures are the pending-layer checks, as by design. Check the CR byte counts.
- [ ] **Record the layer as pending,** then commit.
- [ ] **The owner accepts,** from the repo root: `! node scripts/record-layer.mjs phase-3d-depth-context accept "Thai Phi"`. Then run verify (0 violations) and check-all (8/8), and commit.
- [ ] **Push and PR only on the owner's instruction,** with "Closes #10". A Lovable publish follows the merge.
