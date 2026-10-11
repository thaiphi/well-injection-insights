# Demonstration data and public case studies

Owner-confirmed October 8, 2026: generate synthetic produced-water histories and schedules for the engineering demonstration due before October 14, 2026. Use publicly available studies to supply cited subsurface examples. This clarification supersedes treating missing private operating datasets as a prerequisite for the demo.

## Connected demonstration

| Repository | Inputs | Demonstrated workflow |
|---|---|---|
| `texas-rrc-explorer` | Official UIC/H-10 records where extraction and linkage are verified; GIS optional | Download, preserve provenance, parse, validate, export a versioned dataset |
| `swd-injection-analytics` | Explorer export; synthetic water histories and schedules; literature-derived scenario parameters | Type curves, forecasts, reconciliation, injection trends, demand-versus-capacity scenarios, technical charts/exhibits |
| `ai-swd-permitting` | Current official TRRC rules, forms, guidance and notices; fictional applicant facts for examples | Cited procedural research, application/amendment checklist, missing-input identification and draft technical exhibit references |

Generate reproducible water histories with a fixed seed, fictional asset groups/start dates, type-curve behavior, ramp-ups, downtime and variance. Freeze a forecast before its evaluation period and compare it with separately generated synthetic actuals. Schedule changes and low/base/high demand cases should expose their assumptions. Do not describe either series as observed field production.

Real public injection histories and fictional demand can share a dashboard only when their identifiers and provenance remain clear. Do not attach fictional histories or literature parameters to a real API as if reported for that well.

## Candidate engineering sources inspected

### Small parameterized injection example

Jin, Wojtanowicz and Ge (2022), *Prediction of Pressure Increase during Waste Water Injection to Prevent Seismic Events*. [Article DOI](https://doi.org/10.3390/en15062101); [accessible full paper](https://psecommunity.org/wp-content/plugins/wpor/includes/file/2303/LAPSE-2023.14636-1v1.pdf).

Appendix A, Table A1 (PDF page 18) supplies an Entrada formation case in New Mexico: permeability 256 mD, thickness 15 ft, initial formation pressure 2,560 psi, fracturing pressure 4,334 psi and water viscosity 1 cP. These are literature values, not measurements for the Reeves GIS sample. They provide a compact starting point for an educational rate/pressure/injectivity sensitivity calculation; reproduce only the selected, explicitly stated model, rather than claiming to reproduce the paper's full multiphase/geomechanical simulation. Check equations and unit conversions before coding; some table entries contain inconsistent paired units.

### Delaware Mountain Group context

Ge et al. (2022), *Recent water disposal and pore pressure evolution in the Delaware Mountain Group, Delaware Basin, Southeast New Mexico and West Texas, USA*. [Article DOI](https://doi.org/10.1016/j.ejrh.2022.101041); [author paper](https://www.researchgate.net/publication/358803090_Recent_water_disposal_and_pore_pressure_evolution_in_the_Delaware_Mountain_Group_Delaware_Basin_Southeast_New_Mexico_and_West_Texas_USA).

Supports the regional story about disposal, formation properties and pressure buildup. Use cited methods and parameters where explicitly published, with clear provenance. The study used extensive subsurface and operating information; this reconnaissance has not established public access to its entire calibration dataset. Prefer a small sensitivity example over rebuilding a regional simulator before October 14.

### Optional shared geological/model outputs

Smye et al. (2024), *Role of Deep Fluid Injection in Induced Seismicity in the Delaware Basin, West Texas and Southeast New Mexico*. [Full article](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2023GC011260); [linked Texas Data Repository dataset](https://doi.org/10.18738/T8/G8JDAC).

The article's availability statement identifies shared geological and modeled pressure files, permeability information and fault/stress material. The repository link was located but its file inventory and download/license terms were not independently verified during this check. Treat these as optional regional context pending inspection, not an acquired operating dataset. Do not infer availability of every underlying commercial record or licensed modeling tool.

## Permitting sources

Use [TRRC injection/disposal permit procedures](https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/) and its linked technical review, application attachments, Permian disposal review and seismicity material. See the [permitting findings](2026-10-08-permitting-findings.md) for the source register, currentness issues, forms and legacy-code reuse assessment. Engineering papers illustrate methods; current official authority supports procedural claims. Fictional applicant/site details may demonstrate a checklist, with missing evidence shown explicitly.

## Remaining work

Private data is no longer a demo dependency. Implementation still needs a verified real H-10 sample and parent linkage, selected/unit-checked calculation methods, a working retrieval-to-citation path, grounding evaluations and working deployments. Record provenance per input and derived result: public reported, literature-derived, synthetic, assumed or calculated. Do not claim a scenario establishes an actual well's sustainable capacity or permit adequacy.

**October 9 owner correction:** the [current Analytics PRD](../01-swd-injection-analytics.md) selects reuse of the existing ESP Nexus calculator, shared PVT/black-oil modules and pyResToolbox MCP workflow. See [the inspected reuse evidence](2026-10-09-nexus-engineering-reuse.md). This supersedes the earlier whole-library candidacy/adoption recommendation. The [revised roadmap](../06-delivery-roadmap.md), informed by [Astra's planning advice](2026-10-08-planning-update-advice.md), makes GIS optional and starts real-record/citation proof early. Source-gated public integration is separate from the authorized synthetic planning demo.

No synthetic dataset, engineering implementation or public deployment was created by this source-research update. These documentation changes are local until committed and pushed.
