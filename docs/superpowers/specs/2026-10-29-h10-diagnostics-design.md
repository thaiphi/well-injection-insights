# Phase 1a: H-10 injection diagnostics with guided month review

Date: 2026-10-29. Status: design approved in conversation by the owner; this written spec awaits owner review.
Requirement: Project 2 PRD v1.1 **ANA-E02** (`docs/project-2-swd-injection-analytics-expansion-prd.md`), acceptance scenarios §8 #1 and #5 (and #13 for gaps). Decisions: D5, D16, D19 (`docs/project-2-decisions-2026-10-20.md`). Scope line: `swd-injection-analytics/AGENTS.md:3` as amended by the accepted `governance-scope` layer.

## 1. Purpose

Show a visitor how to read monthly TRRC H-10 injection reports honestly, and **teach them to choose which months are comparable** before looking at any pressure-versus-rate trend. The owner's stated goal: "I want the user to have the experience of how to select and choose the right data and information." The same pattern (the system flags, the user decides, every decision is recorded) is reused for test records in Phase 1b.

This is screening only. Surface-reported H-10 pressure is not bottomhole pressure, and nothing here produces an injectivity index (J), a reservoir pressure, a damage diagnosis or a capacity.

## 2. Where it lives

A new **H-10 diagnostics** panel inside the existing **Injector history** workspace (`publicTrends`), below the existing table and three charts. There is no new navigation tab (D19). The existing table, charts and exports are unchanged byte-for-byte.

It works on whichever H-10 artifact the workspace has selected (`selectedPublic()` in `web/import-ui.mjs`):
- the pinned artifact (UIC 000020838, 28 months);
- sample well B (UIC 000056484, 16 months);
- any Explorer package the user imports and verifies.

## 3. Behaviour

### 3.1 Month calendar and coverage
- Every calendar month from the first to the last reported `period_start` is listed on a real time axis.
- A month with no report row is a **gap**: shown as a gap marker, never as zero, and never interpolated.
- Duplicate rows for one month are not merged. The month is flagged `duplicate-report` (see 3.2), and its values are treated as unavailable for the screening views.
- Coverage summary: first month, last month, months in span, months reported, gap months, flagged months, included months.

### 3.2 Flags (the system proposes)

Each reported month gets zero or more flags, each with a plain-language reason:

| Flag | Rule | Reason shown |
|---|---|---|
| `before-first-injection` | No or zero `injected_liquid_bbl`, and no earlier month has positive volume | "No volume reported before the first reported injection; the well was probably not yet injecting." |
| `no-volume` | No or zero `injected_liquid_bbl` after the first month with positive volume | "No injected volume reported this month (shut-in or missing report)." |
| `no-average-pressure` | `reported_avg_injection_pressure_psi` is null | "No average injection pressure reported." |
| `low-rate` | `calculated_calendar_day_avg_bpd` > 0 and < 25% of the well's median positive calendar-day rate | "Rate is under 25% of this well's median; likely a partial or shut-in month." |
| `max-below-average` | Both pressures present and max < average | "Reported maximum is below the reported average: a reporting inconsistency." |
| `duplicate-report` | More than one row for the month | "More than one report row for this month." |

- The median is taken over months with positive calendar-day rate, before any user decision. With no positive-rate month, `low-rate` is not evaluated and the coverage summary says so.
- Gap months have no flags (there is no row to flag); they are simply absent from comparisons.

### 3.3 Decisions (the user chooses)
- **Initial state:** flagged months start **excluded**, with the reason; unflagged months start **included**.
- The user can re-include a flagged month, or exclude an unflagged month. Excluding an unflagged month requires a short reason (free text, 1–200 characters after trimming).
- A month whose values are unusable (no volume, no average pressure, or a duplicate) can be re-included in the list, but it contributes no point to the screening views; this is stated next to it.
- Decisions are session-only (no storage), and reset when the selected well, source or artifact changes.

### 3.4 Screening views (included months only)
Both views use only included months with positive volume, a positive calendar-day rate and a reported average pressure:
1. **Reported average pressure vs calendar-day rate** (psi against bbl/day), points labelled by month.
2. **Reported pressure per unit rate over time**: `screening_ratio = reported_avg_injection_pressure_psi / calculated_calendar_day_avg_bpd` (psi per bbl/day) on the time axis, with gaps and excluded months visible as breaks.

Fixed labels on both: "Surface-reported pressure (basis as reported), not bottomhole pressure" and "Screening indicator only; not an injectivity index (J)".

If fewer than **3** months qualify, the views show "Not enough comparable months (n of 3 needed)" instead of a trend.

### 3.5 Possible-causes checklist
Static guidance, listing what could lower injection performance and the evidence that would test each:
- reservoir pressure buildup;
- near-wellbore damage or skin;
- fluid viscosity or density change;
- tubing friction or geometry;
- mechanical restriction;
- reporting quality;
- competing nearby injection.

Nothing is ticked automatically and nothing is presented as a diagnosis. The heading says "Questions to investigate, not conclusions".

### 3.6 Readiness and blocking
- The panel uses the workspace's existing gate (`publicCalculationGate()`). If the selected artifact is not calculation-ready (for example an imported package that fails eligibility), the calendar, flags and decisions still show for inspection, but the screening views and all exports are **blocked**, with the gate's reasons.
- No selected artifact: the panel is hidden.

### 3.7 Exports
Three downloads: JSON (sealed), CSV and SVG. They follow the `pressureSupportExport.ts` pattern.
- **Content:**
  - method version `h10-diagnostics/1`;
  - source artifact ID, normalized SHA-256 and manifest SHA-256;
  - every month: values as reported, calculated rate, flags, decision, reason, whether it contributed;
  - gap months;
  - coverage summary;
  - formulas;
  - fixed limitations.
- **Integrity:**
  - The JSON carries its own content SHA-256.
  - The CSV has a metadata, notice and limitation header, quotes every cell, prefixes formula-like text with `'`, and writes `unavailable` for null.
  - The SVG embeds the full JSON in an escaped `<metadata>` block.
- **Invalidation:** a revision counter increments on any decision change, well change or source change. A download whose revision is no longer current is refused, so no stale export is possible (§8 #5).

## 4. Architecture

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/h10Diagnostics.ts` (new) | Pure functions: `buildCalendar(artifact)`, `flagMonths(calendar)`, `initialDecisions(flags)`, `applyDecision(state, month, include, reason?)`, `screeningSeries(state)`, `coverage(state)`. No DOM. | `src/planning.ts` (`monthIndex`, `monthsBetween`, `daysInMonth`), `src/publicArtifact.ts` types |
| `src/h10DiagnosticsChart.ts` (new) | `pressureRateSvg(series)` and `ratioOverTimeSvg(series, calendar)`: string SVG on a real time axis, with null breaks, gap markers and escaped text. | Patterns from `src/pressureSupportChart.ts` (no import coupling required) |
| `src/h10DiagnosticsExport.ts` (new) | `sealDiagnostics(state, source)`, `diagnosticsCsv(sealed)`, `diagnosticsSvg(sealed)`. | `src/h10Diagnostics.ts` |
| `web/h10-diagnostics.mjs` (new) | `mountH10Diagnostics({root, getSelection, getGate})` returns `{render(), reset()}`. It renders the coverage line, the review list with include/exclude controls, the two charts, the checklist and the three downloads. It holds the revision counter. No DOM work at import time, so it is testable in Node. | compiled `dist/*` of the three modules |
| `web/import-ui.mjs` (protected; edit) | Mount the panel inside the Injector history result; call `reset()` wherever results are cleared today (navigation, `switchSource`, sample-well change, package adoption). Also re-check the gate in the CSV and SVG downloads for the sample case (existing gap). | — |
| `web/index.html` (protected; edit only if needed) | A stylesheet `<link>` for `web/h10-diagnostics.css`, only if existing classes (`.panel`, `.table-scroll`, `.analysis-chart-scroll`, `<details>`) are not enough. | — |

Data flow: selected artifact → calendar → flags → decisions → screening series → sealed export. A change at any step clears everything downstream.

## 5. Testing and acceptance
- **Unit (Node, `tests/h10-diagnostics*.test.mjs`):**
  - **Flag fixture:** a synthetic month set, defined inline in the test, that triggers every flag including `before-first-injection` vs `no-volume`, plus a gap month. It checks the exact flags, the initial decisions and the coverage counts.
  - **Real wells:** the pinned artifact gives 28 months, 0 gaps, 0 flags; sample well B gives 16 months, 0 gaps, 0 flags.
  - **Decisions:** re-including a flagged month; excluding an unflagged month without a reason is rejected; an unusable month that is re-included contributes no point.
  - **Screening:** the ratio equals pressure ÷ rate for each qualifying month; fewer than 3 qualifying months gives "not enough"; nothing is ever zero-filled.
  - **Export:** sealed JSON hash round-trip; CSV escaping and `unavailable`; the SVG metadata holds the JSON; a stale revision is refused.
  - **Blocked gate:** no screening and no exports.
- **Regression:**
  - nested suite: `node --test tests/*.test.mjs` inside `swd-injection-analytics/` (435 + new);
  - `node scripts/check-carried-oracles.mjs` (248/0);
  - root suites: transfer, preservation-baseline, layer-registry;
  - `node scripts/prepare-swd.mjs`, then the transfer static-assembly test;
  - existing Injector history table, charts and exports unchanged.
- **Browser (desktop and 390px mobile):** pinned well, sample well B and an imported package. Exclude and re-include a month, export, switch wells and confirm the review resets and the old export is refused. Check the gap marker and the "not enough comparable months" state using the flag fixture through the unit path.
- **Preservation:** a registry layer `h10-diagnostics`. `changes`: `web/import-ui.mjs` (and `web/index.html` only if edited). `newFiles`: the units in §4 plus their tests. `approvedDocs`: this spec and its plan. Then an independent Opus review and owner acceptance.

## 6. Out of scope (later steps)
- Barbaro 23 SWD (UIC 000125182) as a built-in sample well: a separate small step after Explorer produces its H-10 package. Until then a user can import that package through the existing receiver.
- Test-record import (BHP/SRT), the evidence schema and readiness states beyond the existing gate: Phase 1b.
- Calibrated J: Phase 1c.
- Persisting decisions across sessions (D10 deferred).
- Any automatic cause diagnosis (PRD E02 forbids it).
