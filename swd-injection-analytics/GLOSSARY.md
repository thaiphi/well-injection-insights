# SWD Analytics glossary

These definitions support the approved PRD and [owning specification](product-spec.md). [Requirement status](docs/agents/issue-tracker.md) is separate from a term's definition.

| Term | Meaning and application boundary |
|---|---|
| SWD / produced water | Saltwater disposal / water associated with oil and gas production. This application demonstrates planning and injection calculations; it does not establish disposal authorization. |
| bbl | Barrel of volume. The thermodynamic reference must be declared; the word alone does not establish stock-tank or reservoir conditions. One petroleum barrel is 0.158987294928 m³. |
| STB; STB/day | Stock-tank barrel and average stock-tank barrels per day at the declared standard reference. Used by the planning/constant-J model. A rate is not a monthly volume. |
| Reservoir bbl/day; rb/day | Volumetric rate at reservoir conditions. Used by the literature radial equation after conversion to m³/s. Do not label it STB/day or convert it without a justified volume factor. |
| Bw; rb/STB | Water formation volume factor: reservoir water volume divided by standard volume. Reservoir rate = standard rate × Bw. The source brine reference specifies standard conditions; Bw is not an arbitrary scaling factor inferred from public pressure. |
| Calendar-month volume | Monthly bbl accumulated over the reporting month. Average daily rate × actual calendar days gives volume when the basis is compatible. February can have 28 or 29 days. |
| Calendar-day average | Monthly reported bbl divided by calendar days. H-10 calculated calendar-day averages are not measured daily test rates or onstream averages. |
| Onstream rate | Rate while operating. Calendar-average available rate can differ because of availability/downtime; availability must not be applied twice. |
| psi; pressure difference | Pressure units. A difference in psi is valid when the two pressures share a compatible basis/datum; psi alone does not say absolute or gauge. |
| psia | Absolute pressure, referenced to vacuum. The supported constant-J and fluid/connected-hydraulic calculations require declared absolute pressure. |
| psig | Gauge pressure relative to a stated atmospheric reference. The constant-J import boundary does not infer an atmospheric conversion; unsupported gauge inputs block that calculation. |
| Reported psi | Source pressure whose absolute/gauge basis may be unspecified. Public H-10 values remain reported pressures; literature values retain their source declaration. Neither becomes psia, BHP or reservoir pressure by relabeling. |
| BHP / Pwf | Bottomhole flowing pressure at a declared location/datum. A reported surface/wellhead pressure is not BHP; conversion requires fluid density, depth, geometry, flow/friction and a supported model. |
| Pres / reservoir pressure | Formation pressure at the compatible calculation datum. Here it is an assumed input or explicitly cited literature parameter, not inferred from monthly reports. |
| Datum | Physical reference location/depth for pressure. Reservoir and constraint pressures must be compatible within a calculation. Comparing pressure curves at one claimed common datum requires enforcing that declaration. |
| J / injectivity | `q / (Pwf − Pres)` at a stated rate basis/datum; current constant-J unit is STB/day/psi. Positive assumed J gives a linear pressure-rate curve; it is not fitted from H-10 observations. |
| Pressure-constrained capacity | Assumed `max(0,J*(Plimit−Pres))`, capped by operating ceiling and adjusted once for availability. It is not calibrated sustainable asset capacity. |
| Operating ceiling / pressure constraint | Explicit assumed engineering/facility bound. Regulatory, facility and engineering limits have different provenance; none should be silently substituted for another. |
| Published fracturing reference | The literature example's 4334 reported psi comparison value. It is never an operating, permitted or safe limit in this application. |
| Availability | Fraction of a period/capacity available for operation, between 0 and 1. Zero contributes zero; default availability is an assumption, not observed uptime. |
| Ramp / decline | Explicit scheduled production-rate factors. A ramp controls initial approach to full rate; exponential decline uses a monthly coefficient. These are declared model assumptions. |
| Frozen forecast / cutoff | Model fitted only through a stated last training month; coefficients and training identity are retained. Future actuals and new schedules cannot rewrite that fitted model. |
| Holdout | Observations after the training cutoff used to evaluate the frozen forecast. Missing holdout prevents affected reconciliation, without fabricating zeros or refitting with future data. |
| Variance | Actual minus forecast. Positive means actual exceeds forecast. Percent variance is unavailable when forecast is zero; cumulative variance sums compatible periods. |
| Low/base/high | Named assumptions. They are not P10/P50/P90 probabilities unless a separate uncertainty model supports that interpretation. |
| Skin S | Dimensionless radial-flow pressure-loss parameter. Literature workspace skin is externally assumed, not a calculated oil-damage history or measured well-test value. |
| Mass ppm / NaCl wt% | Mass fraction conventions: 10000 mass ppm = 1 wt%; 50000 mass ppm = 5 wt%. The live engineering adapter uses NaCl mass ppm and the PVT workspace uses NaCl wt%. |
| TDS mg/L | Mass of total dissolved solids per solution volume. It is not mass ppm or pure-NaCl mass percent; a supported composition/density conversion would be required. None is inferred here. |
| Gas-free brine | Selected single-phase NaCl/water source model with zero methane saturation; dissolved CO₂, mixed-ion chemistry and phase behavior are not modeled. |
| Producer / group / cohort | Individual producing identity, aggregation identity and development/age grouping. Stable IDs are required before grouping or summing demand. They are not real assets merely because they resemble operating labels. |
| UIC / API / parent linkage | Public injection-control identifier / well identifier / explicit relationship between inventory and monthly report. A real parent join establishes identity linkage, not engineering capacity or synthetic-property applicability. |
| Acquisition origin | How an input entered the application: synthetic fixture, validated public artifact, user file, literature or assumed entry. User acquisition stays user even if its content is asserted public or measured. |
| Content assertion | User's declared measured/synthetic/public/literature/assumed characterization. It is retained separately and does not establish verification. |
| Calculated | Output derived by a named method from identified inputs. Calculated output keeps its input origins and limitations; it does not become observed data. |
| Provenance / lineage | Source/file identity, exact hashes, original row/column/sheet, mapping/units/versions, dispositions, source citation, assumptions and calculation linkage. Needed to reproduce a result and understand its limits. |
| Accepted / quarantined / excluded | Explicit input dispositions. Accepted rows meet the selected boundary; quarantined rows need correction; excluded rows have a recorded reason. Totals must reconcile and errors cannot silently disappear. |
| Readiness | Per-analysis declaration that required inputs and numerical execution are available, with reasons otherwise. It is neither a global file-valid flag nor full product acceptance. |
| Acceptance | Evidence that a specific requirement's observable criterion passed. Passing component tests or input readiness cannot close unrelated UI, source, export, cross-app or deployment gates. |
| Fixture / version / pin | Reproducible test or demonstration input / its declared revision / exact chosen public artifact and hashes. Immutable identity is the intended contract; current import tooling does not technically prevent every overwrite. |
| SHA-256 / integrity | Digest of exact bytes or canonical serialized content. Detects content changes when checked against a retained expectation; does not prove truth, authorship or authenticity. |
| Oracle / carried reference | Recorded expected values from a source or earlier tool execution. Agreement tests fidelity to that reference; inherited flawed physics can still agree. A recorded oracle is not a fresh MCP call. |
| Technical exhibit | Downloadable inputs, methods, units, assumptions, provenance and calculated tables/charts. Exact exports and displayed results must match; absent PDF coverage is disclosed per workflow. |
| G2 / G3 | Approved completion-plan gates: connected two-app core acceptance / separately authorized delivery and portfolio integration. Owning Analytics component success alone does not close either. |
| MD / TVD | Measured pipe length / true vertical depth below the same wellhead, in ft. The brine traverse assumes straight average deviation; it does not infer a surveyed trajectory. |
| Depth-dependent brine traverse | Local pressure and prescribed linear temperature determine Bw, density and viscosity while gravity and friction are integrated. Stock-tank throughput and mass flow are conserved; local reservoir-condition volume changes with Bw. |
| Darcy / Fanning friction | Dimensionless pipe-friction factors with Darcy = 4 × Fanning. The retained Nexus Serghides utility supplies Fanning; the traverse explicitly converts it before Darcy-Weisbach integration. |
| One-at-a-time sweep | Change one declared parameter of one well, holding the base demand and other physical inputs fixed. Exact baseline and units remain visible. A sensitivity is not a calibrated response forecast or probability interval. |

For the selected literature coefficient, paired-unit decisions and scope, see [the method note](docs/literature-example-method.md). For runtime/license/source identities, see [the architecture decision](docs/adr/001-existing-runtime-and-pin.md).
