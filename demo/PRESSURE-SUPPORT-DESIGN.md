# Proposed pressure-support investigation — design for review

Status: proposal only; not implemented. Owner requested H-10 monthly injection volumes for nearby disposal wells over each producer's rate and water cut, with frac dates marked on the decline curve, using TRRC data or explicit synthetic data. This extends the current water-only history flow; it is not delivery of SWD-11 transient modelling.

## Engineering purpose and first slice

Help an engineer inspect whether production changes coincide with nearby injection and frac events, then inspect the underlying evidence. The first slice uses a fully synthetic matched example so the demo is coherent without unavailable external data. It must be visibly separate from the preserved public pin and existing capacity assessment. No actual public UIC is assigned to a fictional producer. This is an investigation view, not a numerical determination of pressure support, causation or interwell connectivity.

Add a secondary **Pressure-support context** tab under Production & demand, keeping direct history/forecast access intact. Selecting a producer shows a common calendar axis with producer oil/water rates, selected nearby injection monthly volumes, a water-cut panel and frac-event markers spanning the aligned panels. Injection bbl/month uses its own explicitly labeled scale; producer rates remain stock-tank bbl/day. Legends and toggles identify each well and source. The UI must not compare those raw magnitudes as the same quantity.

Synthetic history includes producer ID, reporting month, oil/water stock-tank volumes, coverage and explicit missing values. Rates derive from monthly volume/calendar days. Water cut is water/(oil+water), shown as a percentage; gas is excluded, zero total liquid gives unavailable water cut, and a missing numerator/denominator stays unavailable. Reported rates must retain their stated calendar/onstream basis rather than being silently combined.

Synthetic injector history includes separate injector ID, month and injected liquid bbl/month. A separate association table declares the fictional producer/injector relationship, distance and distance units; “nearby” describes this declared association, not a GIS inference or hydraulic connection. A multi-injector total is available only for compatible periods with complete selected contributions; missing history is shown explicitly rather than replaced by zero.

Frac events include event ID, producer ID, date, classification, citation/source row and uncertainty where available. Markers are annotations: they do not alter fitting, erase training points, change the cutoff, update frozen forecasts or imply a calibrated treatment response. Out-of-coverage events are listed rather than silently omitted.

## Public-data boundary

The retained artifact has five inventory entries and only one acquired injection history (28 months, Jan 2024–Apr 2026). It does not supply matched producer oil/water histories or frac dates. Preserve SWD-04's current standalone public history flow. A real overlay may be enabled only after supported producer/event inputs, identities, units, coverage and association evidence pass explicit checks. Label it unavailable with the missing input and remedy when those inputs are absent. Do not fetch arbitrary new RRC endpoints, modify Explorer's package contract or silently compose this public dataset with the synthetic example.

Public H-10 volumes and reported pressures remain descriptive observations. The overlay adds no inferred reservoir pressure, injectivity fit, transient model, sustainable-capacity estimate or pressure-support score. Actual TRRC producer/frac acquisition is a separately verified dependency; this proposal does not claim it exists.

## State, evidence and preservation

Give the context dataset an explicit identity, version/hash and classification. Selecting this example must not substitute it into a confirmed customer capacity case. Changes to selected histories, associations or events invalidate the context result and its pending exports. Keep existing dataset confirmation, forecast identity, capacity inputs and original calculations intact.

Export the plotted table and complete evidence as CSV/JSON plus a chart SVG only within the agreed report scope. Carry source rows, hashes, original units, coverage, derived formulas, event provenance, associations and limitations. No new PDF, database persistence, backend migration, permission change or deployment is proposed.

Likely integration surfaces: existing `web/navigation.mjs`, `web/index.html`, `web/import-ui.mjs` and the existing history/readiness components, with separate context schema/calculation/rendering modules and fictional fixtures. Exact file ownership and interfaces must be settled in the implementation plan after this design is approved. Do not add optional fields to the existing import contract without versioning and compatibility tests.

## Acceptance and independent review

- Choose a producer; inspect oil/water rates, water cut, selected injectors and event dates on aligned charts, with correct scales, identifiers and source-row access.
- Independently verify month lengths, rate conversions and water-cut arithmetic; reject incompatible units, duplicate identities and conflicting months.
- Exercise missing versus zero, zero total liquid, missing injection periods, out-of-range events and incompatible coverage. No invalid contribution silently disappears.
- Synthetic classification is visible throughout and survives exports. A public dataset without matching producer/events stays truthfully blocked for this view while its history remains usable.
- Frac markers and context selection cannot change existing fitted parameters, frozen forecasts, schedules or capacity results. Input changes invalidate only actual dependencies.
- Verify actual JSON/CSV/SVG downloads against visible data and hashes. Preserve every original fixture/reference and existing numerical tests.
- Capture desktop/mobile, keyboard interactions and important error states. Obtain an independent feature-preservation and engineering-evidence review before declaring the slice demo-ready.

Requirement relationship: extends existing SWD-01 history, SWD-04 public-source, SWD-08 evidence, SWD-13 import and SWD-14 readiness principles. No new approved requirement ID is invented. Full source composition and actual nearby-well acquisition remain distinct from this synthetic demo slice.

Next stage: owner review of this design, then a written implementation plan with non-overlapping ownership and one-hour checkpoints. No implementation has started.
