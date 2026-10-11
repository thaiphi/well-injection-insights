# SWD Analytics interface

## Design plan

Palette: deep water `#173d54`, steel `#32799c`, pale water `#e9f2f6`, sand `#d2b67a`, paper `#ffffff`, ink `#23343e`. Segoe UI provides locally available, readable engineering text; Georgia is reserved for the opening question. Figures use tabular numerals without a separate decorative monospace face.

Layout: a wide working sheet with a dark identity rail, a compact scenario strip, a dominant capacity chart and a paired forecast/pressure comparison. All explanatory text is left aligned. Public history gets a visibly separate evidence section after the fictional planning work.

```
Identity / educational context                   export tools
Will planned demand fit?              annual case observations
Assumption controls spanning the sheet
Capacity / demand chart                       monthly case table
Frozen forecast comparison                pressure / rate curves
Public reported history / provenance / source table
Method, assumptions and brine reference
```

Principles: geometry comes from reservoir engineering plots and monthly operating schedules. Chart rules and units carry the visual structure. Use a sand demand area against a steel available-capacity line; keep synthetic, assumed, calculated and public-reported labels close to the relevant data. Use horizontal bands and asymmetric plotting areas instead of repeated dashboard cards.

## Brief critique before implementation

An initial equal-sized three-chart grid gave the page a generic dashboard hierarchy. The revised layout prioritizes the capacity decision, moves forecast reconciliation and injectivity into a supporting paired view, and makes the source record a separate full-width section. The headline is a plain engineering question; there is no decorative hero statistic. Offline fonts, native inputs, accessible SVG descriptions, visible focus and a printable technical sheet are part of the base design.

## Implementation critique

The controls remain a single quiet band rather than floating cards. Monthly values remain available in tables because plot geometry alone cannot support reconciliation. Public history is never overlaid on the synthetic forecast, and monthly reported pressure is never presented as bottomhole pressure or used to calibrate injectivity. Narrow screens stack the working areas while preserving horizontal scrolling inside tables. Print suppresses controls and preserves assumptions, figures and source context.

## Downloadable chart sheet

The SVG download uses the same committed `buildExhibit` result as CSV and JSON, and is disabled while a changed case is being prepared. `exhibitSvg` only formats stored chart/output values; it adds no engineering calculations. The standalone sheet includes the capacity/demand, frozen forecast/actual and fictional pressure/rate charts, monthly planning table, readable assumptions, models, units, source IDs and snapshot hashes. Public evidence stays separate; an unloaded artifact is labeled explicitly. Exact unrounded exhibit JSON is XML-escaped inside `metadata#technical-exhibit`. The serializer uses no external assets, scripts or fonts and produces deterministic output. The CLI writes `exhibits/default.svg` alongside the default JSON and CSV. Browser rendering and downloaded-file visual inspection remain integration verification responsibilities.

## Direct PDF download

The owner requested **Download PDF** in place of **Print workbook**. The button captures the committed exhibit, prepares a local vector PDF and checks render version and exhibit identity before starting the download. Controls remain usable during preparation; an intervening edit discards the stale PDF. A visible preparation state prevents duplicate clicks and restores the button after completion or failure.

The four standard landscape pages use the workbook's colors and carry current controls, capacity/demand, reconciliation, fictional pressure curves, monthly tables, source identity and methodology. The original JSON is attached byte-for-byte in the same format as the JSON download. Long content continues onto additional pages; missing public observations remain distinct from zero. The PDF library is bundled locally and loaded on demand, so export works with the independent Node/browser app.
