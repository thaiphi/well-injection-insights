# Sample case and guided tour — design

Date: October 14, 2026. Status: **draft for owner review; owner answered the three open questions (section 11)**. No code exists yet.

## 1. Purpose

Some visitors want to look at the app or play with it without gathering inputs first. One click should give them a working analysis in every main tool, and an optional guided tour should explain what each tool shows.

The owner set the data rule: **use real Texas Railroad Commission (TRRC) data wherever TRRC has it, and label everything else synthetic.** At every stop, the tour must tell the visitor which inputs came from TRRC and which they would have to gather for a real analysis.

Success means a first-time visitor:
- clicks once and sees results in every main tool;
- can identify, for every value, whether it came from TRRC, was derived from TRRC with a stated assumption, or is synthetic;
- leaves knowing what they would need to gather for their own analysis, through a downloadable checklist;
- needs about five minutes or less for the whole tour.

## 2. Scope

In scope:
- **A pinned sample case** built around two real TRRC injection wells, with every gap filled by labelled synthetic inputs.
- **One-click load** of that case, which also runs the existing calculations so every tool shows results.
- **A guided tour** of seven stops. Each stop has a "From TRRC / You'd gather" panel. The tour ends with a downloadable gather checklist.
- **Downloadable sample files** for the CSV/XLSX import flow.

Not in scope:
- No new calculation methods, and no changes to forecast, capacity, PVT, hydraulics or pressure-support calculations.
- No backend, Supabase, saved cases or persistence. The sample is session-only like everything else, so a refresh clears it.
- No changes to the TRRC Explorer or its artifacts. Synthetic values live only in this app and are never presented as Explorer records.
- No real-data composition for the pressure-support context view. It keeps its own synthetic dataset; see section 4.4.
- No change to the "Texas RRC Data Intelligence" portfolio card. The TRRC agent owns it.

## 3. What TRRC provides today

The TRRC Explorer confirmed this on October 14, 2026, with source citations retained in its answer. The Explorer reads only two official open-data sets: UIC inventory `givw-z9t4` and monthly H-10 reports `qq2j-f2zm`. The sample uses two verified TRRC records that already exist in this repository. Both are real official data:
- **Well A, UIC 000020838.** Artifact `rrc-2026-10-09-uic000020838-v1`, the app's pinned Explorer default (`data/explorer/`, `data/explorer-pin.json`).
- **Well B, SAND BEND 2D, UIC 000056484.** Artifact `rrc-2026-10-10-uic000056484-df804201-eb4a-4aa5-8ef2-c550c6a70627`. It exists today only as the verified Explorer package test fixture `tests/fixtures/explorer-packages/public-uic000056484.tar` (package SHA-256 `377721ac…6b9d`, 1,377,280 bytes, recorded in `provenance.json`). The sample serves a byte-exact copy, checked against that SHA-256 and then opened with the existing `verifyExplorerPackage`.

| Input | Well A (UIC 000020838) | Well B (SAND BEND 2D, UIC 000056484) | Class shown to the visitor |
|---|---|---|---|
| Identity: UIC, API, operator, lease, county (from the API prefix) | Pinned artifact | Package; Reeves County, District 08 | **TRRC public record** |
| Permit maximum injection pressure | 2,600 psi | 1,500 psi | **TRRC public record** |
| Permit maximum injection volume | 14,500 bbl/day | 1,200 bbl/day | **TRRC public record** (shown for comparison, not used as a model limit) |
| Permitted injection interval | 5,200–6,100 ft | 3,028–3,118 ft | **TRRC public record** |
| Monthly injected liquid (bbl) and reported average/maximum injection pressure (psi, no stated basis) | Jan 2024–Apr 2026, 28 months | Jan 2024–Apr 2025, 16 months | **TRRC public record**; the calendar-day average rate is labelled **calculated** |
| Packer depth and NAD83 coordinates, where present | Raw fields (packer 5,605 ft) | Raw fields, if present | **Raw TRRC field, not verified**; displayed only, never used in a calculation |
| Producer oil and water volumes, producer schedules | Not in TRRC data | Not in TRRC data | **Synthetic: you'd gather** (seed-417 producers) |
| Reservoir pressure, injectivity (J), bottomhole pressure, well tests | Not in TRRC data | Not in TRRC data | **Synthetic: you'd gather** |
| Tubing ID, roughness, measured depth | Not in TRRC data | Not in TRRC data | **Synthetic: you'd gather** |
| Brine salinity and temperatures | Not in TRRC data | Not in TRRC data | **Synthetic: you'd gather** |
| Frac and treatment dates | Not in TRRC data | Not in TRRC data | **Synthetic: you'd gather** |
| Nearby-well associations and distances | Not built in the Explorer (planned, RRC-07) | Same | **Synthetic: you'd gather** |

Two inputs per well are **derived from TRRC with a stated assumption**. They carry that class label and name the assumption next to the value:
- **Surface pressure limit (absolute) = permit pressure + 14.7 psi**: 2,614.7 psia for Well A and 1,514.7 psia for Well B. Assumption: the permit limit is gauge pressure at the surface, and atmospheric pressure is 14.7 psi.
- **Formation datum true vertical depth (TVD) = top of the permitted interval**: 5,200 ft for Well A and 3,028 ft for Well B. Assumption: the top of the permitted interval is the datum, and the well is vertical to the datum.

The two wells differ greatly in size: Well B reported about 14–15 bbl/day against a 1,200 bbl/day permit. The sample keeps those real numbers and doesn't scale them. The tour uses the contrast to show that capacity depends on inputs the visitor gathers, not on the permit alone.

The TRRC agent's rules are binding:
- Identifiers stay original strings, with leading zeros.
- API number is never a join key.
- Missing values stay null, never zero.
- Reported pressure is never relabelled as bottomhole or reservoir pressure.
- Average and maximum pressure stay distinct.
- No annulus values are synthesized.
- Per-field "public reported" and "calculated" labels are kept.

## 4. The sample case

### 4.1 Identity and pinning

The case is a new pinned file, `swd-injection-analytics/data/sample-case/sample-case.json`, with a `pin.json` recording its SHA-256 and byte count. It uses the same verify-before-decode pattern as the pressure-support example. The case identity is `swd-sample-case/uic000020838+uic000056484/v1`.

Well B's package is copied byte-exact to `data/sample-case/public-uic000056484.tar`. The original test fixture stays where it is, unchanged.

The file records:
- **TRRC part, per well:** the TRRC artifact ID, its manifest SHA-256 and the exact field values it uses. At load these are re-checked against the pinned Explorer files (Well A) and the verified package (Well B); on any mismatch, loading is refused.
- **Synthetic part:** the seed-417 generator identity and every synthetic and derived input, each with its class and assumption text.

A generator script makes it reproducible, `scripts/create-sample-case.mjs`, which follows the pattern of `create-pressure-support-example.mjs`.

### 4.2 Wells

- **Injector 1** is Well A, displayed by UIC `000020838`.
- **Injector 2** is Well B, displayed as SAND BEND 2D, UIC `000056484`. It replaces the fictional seed-417 injector.
- For both injectors:
  - From TRRC: identity, permit limits and interval, plus the two derived inputs above.
  - Synthetic: J, reservoir pressure, availability, tubing and fluid.
  - Their real monthly histories appear in Injector history.
- **Producers and schedules** are the existing seed-417 synthetic producers and scheduled new producer.

No fictional injector remains in the sample.

### 4.3 Calculations

The sample changes only inputs, never methods. The disposal case, capacity assessment, scenarios and sweeps run through the existing coupled J/hydraulics code, with the TRRC-derived surface limit and datum.

Results therefore differ from the plain seed-417 demo. They are a new, labelled case and are not compared with the demo's published numbers.

### 4.4 Pressure-support context

That tool keeps its own synthetic pinned example, and the composition contract for it stays blocked. Its tour stop says so explicitly:
- From TRRC, a real analysis could take the injector monthly volumes.
- The visitor would have to gather producer oil and water rates, frac dates and producer–injector associations.

### 4.5 Separation from customer data

Loading the sample makes it the active planning source, as "Load demo dataset" does today. Choosing any other source exits the sample through the existing source-switch path:
- the demo;
- the Explorer export;
- a customer upload.

Synthetic values never fill gaps in customer data. A persistent banner shows "Sample case — TRRC record + synthetic gaps" with a **Clear sample** button.

## 5. One-click load

A primary button on Start, **Try it with sample data**, plus the same action on the Data page, does this:
1. Fetch the sample file and verify it against its pin, Well A's pinned Explorer files and Well B's package.
2. Select it as the planning source.
3. Load and calculate the pressure-support example.
4. Calculate the disposal case, then a default parameter sweep (existing defaults: 0.5×–1.5× of base, 5 points).
5. Calculate Brine PVT and Hydraulics with the sample's fluid and wellbore inputs.

It drives the existing workspace actions; it adds no duplicate calculation code. Each step reports progress. If a step fails, loading stops and names the failed step, and the earlier results stay labelled with the sample identity. The load can be cancelled, which reuses the existing stale-result protection.

## 6. Guided tour

### 6.1 Method

The tour is a **small custom in-app step panel**: one new browser module and its stylesheet, with the steps written as plain data. It does not use a third-party tour library such as Shepherd, Intro.js or driver.js. Reasons:
- **No new dependency.** The engineering app uses native browser modules with no framework, and a library would add a package and an upgrade burden.
- **Preservation and review.** Everything stays in reviewable first-party files.
- **It fits the app's navigation.** The app already moves between tools by route (`#area/tool`), so each step is just a route plus a highlight target. Libraries assume single-page overlays.
- **Accessibility under our control.** The panel is not a modal and does not trap focus; it is keyboard-operable and has a live region.

### 6.2 Behaviour

- **Start.** It starts only when the visitor clicks **Take the guided tour** (owner decision); it never starts automatically. The button is offered after the sample loads and also on Start. The tour loads the sample first if it isn't already loaded.
- **Panel.** The panel is bottom-right on desktop and a bottom sheet on narrow screens. It shows:
  - "Step n of 7";
  - a heading;
  - two or three plain sentences;
  - a **From TRRC / You'd gather** box;
  - Back, Next and Exit.
- **Navigation.** Each step navigates with the existing router. A step's highlight is an outline on a named element; if that element is missing, the step still shows without the highlight.
- **Exit.** Exiting keeps the sample loaded. The state lives in memory only, so a refresh ends the tour.
- **Keyboard.** Escape exits, focus moves to the panel heading on each step, and nothing blocks use of the page underneath.

### 6.3 Stops

| # | Tool (route) | What the visitor sees | From TRRC | You'd gather |
|---|---|---|---|---|
| 1 | Injector history (`#injection/publicTrends`) | Real injected volume and reported pressure for both wells against their permit limits: 28 months for UIC 000020838 and 16 months for SAND BEND 2D, with a well switch | Identity, permit pressure and volume, interval, monthly volumes, reported pressures | Pressure basis/datum, bottomhole pressure, annulus data |
| 2 | Histories (`#production/history`) | Produced-water histories for the sample producers | None: TRRC has no producer data in our source | Monthly producer water (and oil) by well, with units and calendar basis |
| 3 | Fit & forecast (`#production/forecast`) | Frozen forecast with training cutoff and holdout | None | Enough history: at least 3 positive months per producer |
| 4 | Capacity assessment (`#injection/comparison`) | Demand against capacity, and shortfall months | Permit surface limit and datum, derived with the stated assumptions | Reservoir pressure, J, tubing, availability, schedules |
| 5 | Scenarios and Parameter sweeps (`#injection/sensitivity`) | How J, tubing ID or availability move capacity | Same as stop 4 | Measured ranges for the parameters you're unsure of |
| 6 | Pressure-support context (`#production/pressureSupport`) | Producer rates, water cut, injection volumes and frac dates on one axis (synthetic example) | Injector monthly volumes, in a real analysis | Producer oil and water rates, frac dates, producer–injector associations |
| 7 | Reports & evidence (`#reports/reports`) | Every result with its sources and exports, plus the **gather checklist** download | A summary of everything above | The complete checklist |

### 6.4 Gather checklist

This is a downloadable CSV, plus the same content as a printable on-page list. It covers every input the sample used, with:
- class;
- source (TRRC dataset ID, or "you gather");
- units and basis;
- which tools need it.

It is generated from the sample file itself, so the checklist always matches the case.

### 6.5 Injector history with two wells

Injector history currently shows one TRRC record at a time. While the sample is active, a small **Well** switch (UIC 000020838 / SAND BEND 2D) appears above the chart. Each choice renders through the existing single-record view and its export path, so each export still carries exactly one artifact and its pin. The two wells are never merged into one series. Outside the sample, the page behaves exactly as it does today.

## 7. Sample import files

The real fixtures from `tests/fixtures/import/` are copied, byte-exact, to `swd-injection-analytics/data/samples/`, which the app already serves:
- seed-417 history CSV and XLSX;
- assumed-injectors CSV;
- the invalid-history CSV, which demonstrates validation.

A `samples/README` gives the column mapping. The Import panel gets **Download a sample file** links. These files are labelled synthetic, apart from any public observations, which keep their public label.

## 8. Files

New:
- `data/sample-case/sample-case.json` and `data/sample-case/pin.json`
- `data/sample-case/public-uic000056484.tar`: a byte-exact copy of the existing test fixture
- `scripts/create-sample-case.mjs`
- `src/sampleCase.ts`: verification, provenance classes and the checklist builder; pure and tested
- `web/sample-tour.mjs` and `web/sample-tour.css`
- `web/tour-steps.mjs`: step data
- `data/samples/*`
- tests `tests/sample-case.test.mjs` and `tests/sample-tour.test.mjs`

Existing files touched, kept small:
- `web/index.html`: buttons and a stylesheet link
- `web/import-ui.mjs`: a `sample` source mode in the existing source switch, plus the banner, download links and the sample-only Injector history well switch
- possibly `web/workspace-views.mjs`: the Reports checklist card

No calculation module (`src/*` engineering code) is modified.

## 9. Testing and acceptance

Unit tests (Node test runner, direct Node paths):
- The sample file verifies against its pin, and a tampered byte is rejected before decoding.
- Every TRRC-classed value equals its source: Well A's pinned Explorer artifact and Well B's verified package. A mismatch for either well refuses the load.
- Well B's served package matches the recorded package SHA-256 and byte count. The original test fixture is unchanged.
- Each injector's derived surface limit and datum match its own permit values (2,614.7 psia / 5,200 ft and 1,514.7 psia / 3,028 ft).
- Every input has exactly one class: TRRC public record, calculated, derived-with-assumption, synthetic, or raw not verified.
- Every derived input names its assumption.
- No TRRC value is relabelled as bottomhole pressure, and null stays null.
- Tour steps reference valid routes, and every element they target exists in `index.html`.
- The checklist covers every non-TRRC input.
- The one-click sequence stops at the first failure, and cancelling leaves no stale downloadable result.

Browser acceptance (local, desktop 1536×1024 and mobile 390×844, accessibility snapshots saved as evidence):
- One click gives results in every main tool, and Reports cards are current.
- The banner and provenance labels are visible.
- The Injector history well switch shows each well's own history, and each export carries only that well's artifact and pin.
- The full tour can be done by keyboard only; Exit keeps the sample.
- Clear sample returns to "None selected".
- Uploading a customer file exits the sample and never mixes values.
- The checklist and sample files download with exact bytes.

Existing gates stay green:
- 390+ engineering tests;
- 248 carried reference comparisons;
- type checks;
- static assembly;
- the root suite.

## 10. Process

Work happens on branch `feature/sample-tour`. Because existing UI files change, the preservation gate requires a new reviewed baseline. The sequence is:
1. The owner approves the spec, then an implementation plan.
2. Implementation.
3. Gates and browser evidence.
4. Independent read-only review.
5. Owner baseline approval.
6. Merge to `main`, which syncs to Lovable.
7. The owner publishes.

Nothing reaches `main` or Lovable before that point.

## 11. Owner decisions (October 14, 2026)

1. Button label: **"Try it with sample data"**.
2. Tour start: **only on click**. There is no automatic start and no stored visit state.
3. Wells: **two real TRRC wells in version 1**. SAND BEND 2D (UIC 000056484) replaces the fictional Injector 2; see sections 3, 4.2 and 6.5.
