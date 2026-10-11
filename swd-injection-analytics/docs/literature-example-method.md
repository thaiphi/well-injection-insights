# Published Entrada parameters: bounded steady radial skin example

This separately identified educational example addresses completion-plan A6 and PRD §§1–2. It supplies a cited calculation/curve and provenance evidence relevant to SWD-05, SWD-08 and SWD-09. It does not close the broader SWD-10, SWD-11 or SWD-12 gates, or full P0 acceptance.

## Source verification

Jin, L.; Wojtanowicz, A.K.; Ge, J. (2022), *Prediction of Pressure Increase during Waste Water Injection to Prevent Seismic Events*, **Energies 15**, 2101. [DOI: 10.3390/en15062101](https://doi.org/10.3390/en15062101). [Full PDF](https://psecommunity.org/wp-content/plugins/wpor/includes/file/2303/LAPSE-2023.14636-1v1.pdf). CC BY 4.0.

The implementer independently retrieved full PDF text on October 10, 2026 and checked:

- Equation 15 and its units, PDF p9: injectivity in m³/s/kPa, rate in m³/s, permeability in Darcy, contributing interval in m and viscosity in cP.
- Equations 18, 21 and 22, PDF p10: radial injectivity with skin, pressure rise and formation pressure plus pressure rise.
- Appendix A Table A1, PDF p18: Entrada parameters and their paired field/SI values.

The source PDF pixels were unavailable through the retrieval tool. No numerical paper curves were digitized or reproduced. The source title concerns seismic events; this implementation makes no seismic prediction. The retained fixture hash identifies the exact UTF-8 scenario fixture, not the PDF bytes or source authenticity.

## Equation and unit choices

The literal published equation is:

```
Iw = 2e-6 * pi * h_m * K_D / (mu_cP * (ln(re/rw) + S))
deltaP_kPa = q_m3_per_s / Iw
prw = pre + deltaP                  [common pressure units]
```

The UI answers the pressure penalty from externally assumed skin at a selected rate. Baseline S = 0 and initial comparison S = 5 are assumptions; the comparison domain is 0–50. No oil concentration, oil-front radius or elapsed time is converted into skin. The full published 15 ft thickness is assumed to be the contributing completion interval h. Fixed formation pressure, viscosity, homogeneous steady single-phase radial flow and no partial-penetration correction are explicit assumptions.

| Quantity | Published field value used | Conversion / decision |
|---|---:|---|
| K | 256 mD | 0.256 Darcy in the literal published equation |
| Formation thickness | 15 ft | 4.572 m; full interval contributes by assumption |
| Well radius | 0.292 ft | 0.0890016 m; source SI column rounds to 0.089002 m |
| Formation radius | 1000 ft | 304.8 m; use ln(1000/0.292) consistently |
| Formation pressure | 2560 psi | Field-side value retained; paired 17656 kPa is rounded |
| Water viscosity | 1 cP | Both source columns agree |
| Rate range | 2000–10000 bpd | Interpreted as reservoir bbl/day because equation q is volumetric m³/s; no stock-tank claim |
| Fracturing reference | 4334 psi | Published comparison reference only; never operating/permitted/safe limit |

Conversions: 1 ft = 0.3048 m; 1 bbl = 0.158987294928 m³; 1 day = 86400 seconds; 1 psi = 6.894757293168 kPa. The rate table uses 2000, 5000 and 10000 reservoir bbl/day, adding the selected rate if different. The chart uses 0–10000 reservoir bbl/day; zero flow is the analytical endpoint, while the selectable example range stays within Table A1.

The coefficient 2e-6 approximates 1 Darcy as 1e-12 m². The conventional SI conversion 9.869233e-13 m²/D instead produces a pressure rise approximately 1.325% larger. This implementation preserves the literal paper coefficient. It does not silently replace it with exact-SI Darcy law or mix in the rounded Table A1 permeability of 2.5e-13 m². The numeric checks explicitly distinguish the two.

Pressure remains **reported psi; absolute/gauge unspecified; common formation datum**. Neither psia nor psig is inferred. A common offset cancels in pressure differences. No wellhead pressure, hydrostatic correction or operational limit is inferred. The paper's oil-density pair (7.18 lbm/ft³, 860 kg/m³) is inconsistent and rejected; its depth pair (5914 ft, 1797 m) is also inconsistent and unused. Neither enters the bounded calculation.

## Independent anchors and behavior checks

At 5000 reservoir bbl/day, q = 0.009200653641666667 m³/s. The independent logarithmic geometry factor is 8.138756755695992. Using the literal published coefficient:

| Assumed skin | Calculated formation pressure (reported psi) | Calculated penalty versus S = 0 (psi) |
|---|---:|---:|
| 0 | 4036.8341031789294 | 0 |
| 5 | 4944.118930278199 | 907.2848270992693 |

These are newly calculated benchmarks, not values reported numerically by the paper. An independent SI Darcy-law calculation uses q, μ = 0.001 Pa·s, h = 4.572 m and K = 0.256 × 9.869233e-13 m². The published-coefficient rise divided by the independent SI rise equals 0.9869233. Zero flow returns the published formation pressure and zero skin penalty; pressure and skin penalty increase monotonically with rate and skin. Nonfinite values, unsupported domains, extra input keys and changed fixture bytes are rejected.

## Independence, exports and integration

`web/literature-case.mjs` exports `mountLiteratureCase(section)`; Main owns routing and stylesheet integration. The module verifies `/data/scenarios/literature-example.json` before calculating. It never consumes an active synthetic, public RRC or imported dataset. No literature property is assigned to a real UIC/API. All adjustable inputs are visibly assumed; source values are visibly literature; results are calculated.

Form edits invalidate results and all three downloads until recalculation. Fixture load/verification failure blocks the workspace. JSON, CSV and SVG carry all inputs, units, equations, paired-unit decisions, assumptions, limitations, DOI/PDF links, the exact fixture text and SHA-256, and a content-integrity SHA-256. SVG embeds the complete exhibit in XML-escaped metadata and includes visible source/method labels. CSV includes the full provenance JSON plus unrounded table and curve values. Exporters validate the hash and recompute the expected result from the verified fixture and inputs, rejecting both simple mutation and mutation with a recomputed hash.

The shared `exhibitIntegrity.ts` supplies SHA-256 and JSON-evidence validation read-only. No copied Nexus/reference/vendor file or Explorer pin is changed. This is a small published radial equation adapter in the existing TypeScript/browser architecture, not a replacement for the retained Nexus/PVT foundation.

This example has JSON/CSV/SVG downloads and **no dedicated PDF export**. The selected-example gate can pass with these explicit exports; broader multi-workflow PDF acceptance remains Main's integration responsibility. Full-paper transient/oil-invasion simulation, layering, geomechanics, calibrated capacity and additional model-choice workflows remain outside this implementation.

## Reproducible checks

`node tmp/project-completion/study/verify.mjs` compiles into a study-owned isolated run, runs the focused and full Node test suites, records outputs and snapshots default/changed/zero-skin JSON/CSV/SVG artifacts. `node node_modules/typescript/bin/tsc --noEmit` and `node --check web/literature-case.mjs` check the live owning repository without generating files outside the assigned paths. Browser integration and fresh keyboard/mobile/export checks are performed by Main and must be reported independently; this note does not claim their outcome.
