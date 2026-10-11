# SWD-12 bounded disposal sensitivity

`buildDisposalSensitivity(caseInput, spec)` evaluates one selected parameter of one selected well against the current connected disposal **Base** scenario. It supports the existing uniform model and opt-in segmented brine model without changing either calculation engine. The result is fictional/assumed engineering screening, not a calibrated sustainable capacity forecast.

## Input and baseline contract

```ts
const spec = {
  wellId: 'FICTIONAL-A',
  parameter: 'injectivityStbdPerPsi',
  minimum: 2.5,
  maximum: 10,
  points: 3
};
```

The selectable parameters are injectivity (`injectivityStbdPerPsi`, 0.000001–10000 STB/day/psi), tubing inner diameter (`innerDiameterInches`, 0.25–30 in) and availability (`availability`, 0–1 fraction of calendar time). These are the existing connected-case application ranges, not validated ranges for every physical combination. Other well inputs, demand, geometry/fluid assumptions and model selection remain unchanged in each Base calculation.

The requested grid contains 3–9 integer points, evenly spaced between the exact finite minimum and maximum. Minimum must be smaller than maximum, and the range must contain the exact original parameter value. A range too narrow to represent strictly increasing floating-point grid values is rejected before calculation. Both grid endpoints are retained. If the exact baseline is absent from the grid, it is inserted as an additional sorted row; the result therefore contains at most 10 points. `isBaseline` marks the original parameter value exactly once, and `isGridPoint` distinguishes an inserted baseline from a requested grid point. No tolerance replaces the original input value.

The original case and specification are cloned into `inputs.caseInput` and `inputs.spec`. Original JSON evidence is validated before cloning: hidden fields, accessors, symbols, sparse/extended arrays, nonfinite values and cyclic structures are rejected rather than silently removed or executed.

## Base-only evaluation and comparison context

Each sweep point invokes `buildDisposalCase` with the selected well parameter changed. The connected case engine also evaluates a Compared scenario. To prevent that unused branch from constraining a valid Base sweep, the internal comparison is an explicit identity of the currently varied well: injectivity multiplier 1, current tubing diameter and current availability. Compared outputs are discarded. Original comparison fields are retained verbatim in inputs and `caseProvenance.sensitivity.originalComparison`, and validated for their ordinary field ranges. The original unused comparison calculation is not required to succeed.

This neutral internal comparison does not change any Base result. Tests compare baseline and point summaries with independently invoked original Base scenarios wherever the original comparison is executable. A separate regression establishes that an original comparison multiplier which would exceed the injectivity bound at a sweep point cannot block that valid Base point.

The baseline summary is calculated at the original parameter value, with the same model, demand and well assumptions. It agrees exactly with the original Base scenario's total available capacity and monthly shortfall. Baseline provenance retains the connected engine's method, property/source hashes, original demand evidence, pressure/datum conventions and model limitations. The sensitivity method identity is `one-at-a-time-base-disposal/1`, schema `disposal-sensitivity/1`.

## Compact results and failure behavior

Each sorted point retains its value, baseline/grid markers and a compact summary:

- Total available stock-tank capacity, total shortfall, first shortfall month and aggregate monthly operating feasibility.
- Each well's maximum onstream envelope, calendar-average available envelope, limiting constraints and maximum operating feasibility.
- Each explicit month's demand, calendar days, capacity, headroom, shortfall and operating feasibility.
- Every monthly well allocation's average/onstream rate, allocated stock-tank volume, operating flag, reasons and endpoint hydraulic status, bottomhole/surface pressure, integrated gravity/friction and regime. Full wellbore profiles are omitted from sensitivity points.
- `unsupportedAllocations` provides a compact flagged subset for display; full allocations remain present for all points.

Availability remains the connected engine's single calendar-time multiplier. The sweep does not apply it again. Unsupported low-flow allocations retain explicit flags and reasons, including null hydraulic values for domain failures and null flowing pressures for shut-in allocations. Those flags do not remove the monthly volume accounting.

A failed Base calculation at any parameter value throws an error naming the selected well, parameter, value and units. No partial sweep is returned and no failed point is omitted or converted to zero. The range must be revised or the underlying unsupported physical/model condition addressed before producing a sweep.

## Export and verification

`verifiedDisposalSensitivity(result)` validates the original bundle's exact finite JSON evidence, clones it, recomputes the entire sweep from the retained original case/specification, and compares all values and metadata before returning the verified snapshot. Changed, stale, hidden or omitted data blocks export. It establishes internal calculation consistency, not authorship or source authenticity.

`disposalSensitivityCsv(result)` uses that verified snapshot. Its seven columns are `section,parameter,unit,value,isBaseline,field,result`. Metadata includes original case/specification, baseline, source provenance, method and units. Point rows include grid markers, overall summaries, each well and every monthly allocation/endpoint summary. Formula-like arbitrary text is neutralized as spreadsheet text. JSON export can serialize the same verified snapshot; external wrappers may add their independently computed exhibit/source-case hashes.

## Executable evidence

`tests/disposal-sensitivity.test.mjs` tests exact uniform and segmented baseline agreement; endpoint and inserted-baseline grids; changes confined to the selected well/parameter; comparison isolation; independent constant-J anchors; diameter and availability direction; availability applied once; positive/zero/unsupported allocation conservation; atomic point failure; parameter/range validation; cloned lineage; and stale/tampered/lossy-evidence export rejection.

Build the isolated engine with `node node_modules/typescript/bin/tsc -p tsconfig.json --outDir tmp/wellbore-extension/sensitivity --declaration false`, then set `DISPOSAL_ENGINE_DIR=tmp/wellbore-extension/sensitivity` and run `node --test tests/disposal-sensitivity.test.mjs`. Browser controls, chart rendering and artifact hash wrappers are Main-owned integration checks.
