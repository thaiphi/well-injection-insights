# Phase 3d: ANA-E11 depth-aligned wellbore and pressure context — design

Date: 2026-11-16. Issue: thaiphi/well-injection-insights #10 (PRD `docs/project-2-swd-injection-analytics-expansion-prd.md` §4, ANA-E11).

**Status.** Draft for the owner's review. The owner said the brainstorming questions were already answered (2026-11-16), so this document is written from the recorded decisions:
- D15, D16 and D19 in `docs/project-2-decisions-2026-10-20.md`;
- G20–G22 and the E11 recommendations in `docs/project-2-prd-v1.1-review-2026-10-17.md`;
- the issue text.

Everything else is marked **(main's call)** so the owner can check it.

**Deliverable.** This document is the design. Building it is a later go-ahead.

## Why

**The question it answers:** "For the wells in my disposal case, where do the casing, packer, injection interval, formation tops and pressure tests sit, and how does the modelled pressure in the wellbore line up against them?"

It is a **review aid**. It puts the evidence an engineer already holds next to the pressure the case already models, on one declared depth scale. It calculates nothing new.

**When an engineer reaches for it:**
1. **Before trusting the modelled bottomhole pressure:** where does the case's declared pressure datum (where the modelled curve ends) sit relative to the actual injection interval, and do the measured test points fall near the curve or far from it?
2. **When comparing two wells in the case:** are their intervals and test depths comparable, on the same depth basis and depth reference?
3. **When the depth evidence is incomplete:** what is missing for each well, and why can't it be placed?

**What exists today.**
- The capacity case already models each well's pressure down the wellbore at its allocated rate. Each monthly allocation carries a `HydraulicPoint` (`src/disposalCase.ts`), with the full `traverse.points` (MD, TVD and pressure per node) when the depth-dependent brine model is on.
- Depth charts today plot one well against MD only (`web/disposal-case.mjs`, `web/hydraulics.mjs`). No chart draws casing, intervals or point evidence (review G20).
- Explorer supplies no surveys, TVD, formation tops or casing. Its only depths, the permitted interval, the packer depth and `test_depth_ft`, have an unstated basis and datum (G22, D15).

## Recorded decisions this design follows

| # | Decision | Source |
|---|---|---|
| D15 | All depth evidence comes from a **user-uploaded depth-evidence profile**: casing, interval and test-point rows with a declared MD/TVD basis. Explorer never supplies surveys, TVD or formation tops. The "missing survey blocks conversion" rule applies **only to aligning evidence depths**. The traverse keeps its declared straight-slope MD/TVD assumption. | decisions 2026-10-20 |
| D16 | **No decimation.** Every traverse node and every evidence row is drawn. Gaps are preserved. Exports are built from result objects, not from the drawing. The issue's "preserve extrema when downsampling" is satisfied by never downsampling. | decisions 2026-10-20 |
| D19 | **A panel inside an existing workspace.** No new navigation tab or workspace. | decisions 2026-10-20 |
| D18 | The handoff is one way, Explorer → Analytics. | decisions 2026-10-20 |

## Goals

1. **Load a profile.** In the disposal case, the user uploads one depth-evidence profile (CSV) for the case's wells. Or, for the fictional demo case only, they press **Load fictional example**.
2. **Choose the wells and the scale.**
   - The user ticks up to **4** case wells to show side by side, with no pre-selection.
   - They choose the display basis, **MD** or **TVD**. Both are offered and neither is pre-selected.
3. **Draw one track per well,** all sharing one depth axis (ft below each well's declared depth reference):
   - **Schematic column:**
     - casing strings as rectangles to their shoe depth;
     - the packer as a marker;
     - permitted and perforated intervals as bands;
     - formation tops as points.
   - **Pressure column:**
     - the case's **modelled** pressure-vs-depth curve for that well, as a line;
     - the **measured** test points as markers.

     The two use different marks, colours and legend wording: "modelled (case, assumed inputs)" against "measured (as entered, with source)".
4. **Show gaps with reasons.** Each well has a list of every row that could not be placed and why. Nothing missing is drawn as zero or guessed.
5. **Reference lines across wells.** The user can enter one reference depth and one reference pressure. Each is drawn across every shown track at the same value, so wells can be read against each other.
6. **Inspect the evidence.** Selecting any drawn item opens its detail in the panel:
   - the original row (row number and values as entered);
   - its source reference and content class;
   - its declared depth basis and depth reference;
   - whether it was converted, and how (survey interpolation, with the two stations used);
   - for the modelled curve: the case inputs, the method version, the month, scenario and rate it was drawn at, and the straight-slope note.
7. **Export,** sealed and re-verifiable: JSON, CSV and SVG.

## The depth-evidence profile

A single CSV with one row per item. It is parsed with the existing `parseCsv`. The column names are fixed, and the upload shows the parsed rows for the user to confirm, as the test-record upload does.

**Every row has:**
- `well_id`: must match a case well `id` exactly, with no fuzzy matching;
- `kind`;
- `source_ref` (free text, 1–200 characters, required);
- `content_class`: `public-reported`, `measured`, `assumed` or `literature`, a subset of the existing `ContentKind` vocabulary (`src/importProfile.ts`). It has no label map yet, so this panel defines its own labels **(main's call)**.

**Naming.** The profile's depth reference (KB, GL and so on) is called the **depth reference**, never "datum". This avoids a clash with the case's **declared pressure datum**: the depth where the case states bottomhole pressure and `limitPsia`.

**Kinds:**

| `kind` | Required fields | Drawn as |
|---|---|---|
| `depth-reference` | one per well:<br>• `reference` (free text, e.g. `KB`, `GL`);<br>• `wellhead_below_reference_ft` (the wellhead's depth below that reference; may be 0, never assumed) | the track header |
| `survey` | `md_ft`, `tvd_ft` (one station per row; at least 2 to convert). A vertical well is entered as two sourced stations, (0, 0) and (TD, TD); there is no separate "declared vertical" switch **(main's call)** | not drawn; used for conversion, listed in the detail |
| `casing` | `bottom_depth_ft` (the shoe), `depth_basis`, optional `top_depth_ft`, optional `size_in` | a rectangle from the top (or the depth reference when no top is given) to the shoe |
| `packer` | `top_depth_ft`, `depth_basis` | a marker |
| `permitted-interval`, `perforated-interval` | `top_depth_ft`, `bottom_depth_ft`, `depth_basis` | a band |
| `formation-top` | `top_depth_ft`, `depth_basis`, `label`; optional `bottom_depth_ft` only with its own `source_ref` | a point. A band only when a sourced bottom is given; otherwise "bottom unknown" |
| `test-point` | `top_depth_ft` (gauge depth), `depth_basis`, `pressure_psi`, `pressure_basis` (`psia` or `psig`), `test_date`, `test_type` (`static`, `flowing`, `step-rate` or `other`) | a marker in the pressure column at its own depth |

**Common rules:**
- `depth_basis` is `MD`, `TVD` or `unknown`. Explorer's permitted interval is a typical `unknown` (G22).
- Depths are in ft and non-negative. A top must not be deeper than its bottom.
- The file is limited to 2,000 rows and 20 wells **(main's call)**.

## Placing evidence on the display scale

1. **Same basis as the display:** the row is placed at its depth as entered.
2. **Other basis, with a survey:** it is converted by linear interpolation of TVD against MD between the two bracketing `survey` stations of that well. Outside the stations' range it is a gap: "outside the survey range". The engine does not compute TVD from inclination and azimuth.
3. **Other basis, without a survey:** it is a gap: "no survey for this well; cannot convert MD to TVD".
4. **`unknown` basis:** it is a gap on either display basis: "depth basis not stated". It still appears in the evidence list with its value.
5. **Test points are never moved.** A test point keeps its gauge depth. It is not shifted to the interval or to the modelled curve's end, because that would need a hydrostatic correction (review §2).
6. **Test pressure:**
   - `psig` is shown as psia by adding 14.7 psi, with the existing `toAbsolute` and label.
   - A missing or other pressure basis makes the row a gap: "pressure basis not stated".

## The modelled curve

The curve **reuses the case's own result**, with no new numerical method.

- **Which result:** the user picks the case **scenario** (Base or Compared) and a **month**. The default is the first month of the case **(main's call)**. For each shown well, the curve is that month's allocation `HydraulicPoint`.
- **Depth-dependent brine model on:** the curve is `traverse.points`, every node, plotted at `measuredDepthFt` or `tvdFt` to match the display basis.
- **Uniform brine model:** the curve is the straight line from the required wellhead pressure at depth 0 to the bottomhole pressure at the case's **declared pressure datum**. The case well's `measuredDepthFt` and `tvdFt` are depths to that datum, not total depth. That line is exact for the uniform model under the straight-slope assumption. The detail says so.
- **Where the curve ends:** at the declared pressure datum, labelled as such. If that datum lies above or below the perforated or permitted interval, the gap is visible on the track. Showing that is one of the reasons the view exists.
- **A point that breaks a case limit is still drawn.** A `flowing` point with `operatingFeasible: false` (bottomhole above `limitPsia`, or required wellhead pressure outside its bounds) keeps its curve. The case's reasons are shown with it, and the line is drawn in the flagged style **(main's call)**.
- **No curve for that month:**
  - when the well is shut in or unavailable that month, or its status is `unsupported` (the traverse failed), there is no curve; the case's own reason is shown as the gap;
  - when the result is withdrawn, all curves are withdrawn.
- **Depth-reference alignment:** traverse depths are below the wellhead. On the track they are shifted by the well's `wellhead_below_reference_ft`. Without a `depth-reference` row, nothing is drawn on that track. The curve and every evidence row become gaps reading "wellhead depth below the depth reference not declared", because the shared axis is "ft below each well's depth reference".
- **The curve's depths come from the case's straight-slope MD/TVD (D15).**
  - The detail says: "modelled depths follow the case's declared MD and TVD, not the survey".
  - If the well has a survey and the survey TVD at the case MD differs from the case TVD by more than 10 ft **(main's call)**, a note is shown. The curve is not moved.
- **Reference marker:** the case's declared bottomhole maximum (`limitPsia`) is shown as one marker at the declared pressure datum. It is labelled "declared bottomhole maximum at the pressure datum (case input)". It is not a fracture gradient and not a line.
- **Test dates:** every test point is drawn whatever its date. Its marker label carries the date and test type, and the legend says: "test dates differ from the modelled month; a test is evidence, not a check of the curve" **(main's call)**.

## Non-goals

- No new pressure calculation, no hydrostatic correction of test points, and no fit of the curve to the tests.
- No TVD computed from inclination and azimuth. Surveys are MD/TVD pairs only.
- No subsea or elevation alignment across wells. Each track is below its own declared depth reference.
- No Explorer depths placed automatically.
  - The permitted interval, packer and `test_depth_ft` from a package are not read in v1.
  - The user may enter them in the profile with `depth_basis` = `unknown`, or with a basis they state and source.
- No map, no distances and no wells outside the case.
- No limit evaluation or pass/fail in this view. The capacity case and pressure buildup already do that.
- No saved profiles: they live in the session only (D10).

## Anti-goals (a failure even if it works)

- **Monthly H-10 pressure drawn as a downhole pressure log.** It never appears in this view.
- **Step-rate data shown as a fracture gradient.** Step-rate rows are points with their reported pressures. No line is drawn through them, and no gradient is derived.
- **A line between wells' formation tops,** or any wording suggesting correlation across wells.
- **A formation bottom invented from the next top.**
- **An MD depth placed on a TVD axis** (or the reverse) without a survey.
- **A missing value drawn as 0** or a gap closed by interpolation.
- **Wording that presents the view as a field-calibrated correlation or a regulatory geologic cross-section.** The panel and every export carry: "Review aid: user-supplied depth evidence beside modelled pressure. Not a calibrated correlation or a regulatory cross-section."
- **Real TRRC values committed to the repo.** The example and every test fixture are fictional.

## Where it lives and what withdraws it

- **Placement:** a new **"Depth view (review aid)"** panel in the disposal case results, directly after the `#transient-buildup` section, which contains Nearby wells. It is inserted the way `transient-buildup` is: a DOM insertion plus one mount line in `web/import-ui.mjs`. Like `web/case-insights.mjs`, it takes the case result from the `disposal-case-result` event and withdraws on `disposal-case-invalidated`.
- **Case sources:**
  - it works for the `user` and `demo` cases;
  - for the `sample` case, the user may upload a profile, but no example is offered **(main's call)**: the sample's wells carry public IDs, and fictional depths must not be attached to them.
- **What withdraws what:**
  - **The drawing and exports** are withdrawn on any case recalculation, a scenario or month change, a profile change, or a change of well selection or display basis.
  - **The profile** is kept across case recalculations. Rows whose `well_id` no longer matches a case well are dropped and listed as "dropped: well no longer in the case"; the rest are kept **(main's call)**. The profile is cleared on a source switch.

## Exports

- **Schema:** `depth-context-export/1`.
- **JSON** holds, at full resolution and in the original units:
  - every profile row as entered, with its placement (placed depth or gap reason);
  - the display basis and the selected wells, scenario and month;
  - for each well, the curve nodes (MD, TVD and pressure);
  - the case method version and the source references;
  - the review-aid sentence;
  - `contentSha256`.

  Verification recomputes every placement from the stored rows.

  For each curve, the export stores the case well, the fluid and hydraulics settings and the onstream rate. Verification reruns `caseHydraulicPoint` for that well only, not the whole case.

  The export also references the case result: its schema and method versions, and its `contentSha256` where the case has one **(main's call)**.
- **CSV** uses the existing 4-column long format.
- **SVG** is the drawing, with the full export JSON embedded in `<metadata>`. The SVG and the JSON carry the same `contentSha256`. To verify an SVG, extract the JSON, verify it, regenerate the SVG from it, and require byte equality **(main's call)**.

## Constraints

- **Protected files** must keep their CR bytes: `web/import-ui.mjs` exactly 4, `web/index.html` exactly 3. New files have 0.
- **New logic goes in new files,** for example `src/depthContext.ts` (pure: parsing, placement, curve extraction, export) and `web/depth-context.mjs` (panel and SVG renderer).
- **A preservation layer** is required: `phase-3d-depth-context`. The owner accepts it.
- **Direct `node` paths only.** Tests are written test first with `node --test`.
- **Fluid-model bounds** of 100–10,000 psia are unchanged. The curve inherits the case's own refusals.

## Acceptance (from issue #10)

| Issue criterion | How this design meets it |
|---|---|
| Two independently sourced wells show known casing depths, injection intervals and pressure-test points on a consistent declared depth scale | Two case wells from the fictional example, each with its own `source_ref`s, on one MD or TVD axis below their declared depth references |
| Absent or incompatible depth data show gaps and reasons | The rules in "Placing evidence": no survey, outside the survey range, basis unknown, no depth reference, pressure basis missing |
| Modelled curves and public test observations are visually and semantically distinct | Different mark, colour and legend label; separate `kind` in the export |
| Exported JSON/CSV/SVG keep full-resolution data, original units, calculation versions and source references | The Exports section; no decimation (D16) |
| No diagram is presented as a verified field-calibrated correlation or a regulatory geologic cross-section | The review-aid sentence on the panel and in every export; no line between wells; banned-word test |

**Pure-function guards** (review §3):
- a top-only formation pick has no bottom;
- a missing survey blocks alignment;
- a test point with no stated pressure basis is not placed;
- the plotted node count equals the traverse node count.

## Left to the builder (plan)

- The exact CSV column order, the error messages and the upload confirmation layout.
- The SVG layout: track width, colours, legend and how selection is shown. It must remain readable at 390 px wide, with tracks stacked or horizontally scrollable inside the panel.
- How the reference depth and pressure are entered.
- The content of the fictional example:
  - rows for the demo wells `FICTIONAL-INJ-A` and `FICTIONAL-INJ-B` (`src/planningFixture.ts`);
  - one well with a survey and one without, so that both the conversion and the "no survey" gap show;
  - built for the demo wells' default depths (TVD 3000 ft, MD 3300 ft). If the user has edited those depths, the example still loads, and the survey note appears where it applies **(main's call)**.
