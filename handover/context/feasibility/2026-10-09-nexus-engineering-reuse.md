# ESP Nexus engineering reuse for SWD Analytics

**Recorded:** October 9, 2026  
**Decision:** owner-authorized reuse of the established Nexus calculator, shared PVT/black-oil modules and pyResToolbox MCP workflow in `swd-injection-analytics`.

This supersedes the October 8 recommendation to treat pyResToolbox as a candidate pending a new whole-library adoption spike. Application code still belongs in the separate Analytics repository. This record does not claim that extraction, SWD integration, fresh numerical tests or deployment have occurred.

## Inspected source

The local `esp-nexus-wellbore-pr` checkout reports HEAD `c418bd93bfb8d758df35cc174c4b66c2ab62e5f9`. [Wellbore-potential PR #27](https://github.com/thaiphipetro/esp-nexus/pull/27) is merged. Its historical test report is prior evidence, not a fresh test run; the inspected checkout includes later changes.

**Local-main verification, October 9:** the owner identified the local main branch as the preferred source. Its checkout is `C:/Users/thai.phi/Downloads/python/mclaren/esp-nexus`, branch `main`, HEAD `de631ad2952bf42b80a6738ff980992975be4cdc`. It is three commits beyond the previously mapped snapshot; those commits change ESP Study workspace caching. No committed differences or uncommitted changes were found in the inspected wellbore-potential, black-oil, PVT, nodal and shared engineering paths. All 24 Graphify input files match main's actual working files by SHA-256. Use this main checkout for extraction and subsequent mapping; this verification does not expand the existing 24-file graph or establish numerical correctness.

Nexus calculations run in TypeScript. Its reference tests use pyResToolbox results; the black-oil tests explicitly record MCP-generated values. The configured local `pyrestoolbox-mcp` project registers DCA, brine, nodal and sensitivity tools, and its `uv.lock` records pyResToolbox 3.1.4. Older Nexus test fixtures cite versions 2.5.0, 3.0 and 3.0.1; preserve those fixture versions rather than silently treating them as 3.1.4 results. The MCP is not exposed as a callable tool in this chat, so no live MCP execution is claimed.

Paths below are relative to the named source repository. Line numbers are from the inspected local files; record actual copied-file revisions/hashes when extracting.

See [Luna's bounded dependency map](2026-10-09-nexus-dependency-map.md) for the selected PVT/black-oil import closure and adapter boundaries. It records manual source inspection; Graphify was unavailable in that session.

| Source | Inspected evidence | Reuse |
|---|---|---|
| ESP Nexus `src/App.tsx:151`; `src/pages/BlackOilTables.tsx:14` | Separate `/black-oil-tables` route renders `BlackOilTableGenerator` | Fluid/table UI and interaction patterns |
| ESP Nexus `src/components/black-oil-tables/engine/generateBlackOilTable.ts:62` | Pressure sweep calls shared PVT functions and returns unit-tagged table properties | Table generation and scenario export foundation |
| ESP Nexus `src/utils/pvt/correlations.ts:947`, `:977`, `:995`, `:1016` | Water FVF, brine density/viscosity and water compressibility functions | Relevant water/PVT functions, retaining their method and pressure conventions |
| ESP Nexus `src/utils/iprMath.test.ts:4`; `src/utils/nodal/__tests__/nodalValidation.test.ts:5` | pyResToolbox IPR/VLP reference fixtures | Existing oracle-test pattern and applicable fixtures |
| ESP Nexus `src/components/black-oil-tables/engine/__tests__/pyrtValidation.test.ts:4` | Hardcoded values from recorded MCP calls on April 16, 2026 | Applicable PVT fixtures, conversion rules and documented differences |
| ESP Nexus `src/components/black-oil-tables/export/eclipseExport.ts:164`; `export/excelExport.ts:138` | PVTW and spreadsheet exports | Technical-table/export patterns |
| pyResToolbox MCP `src/pyrestoolbox_mcp/tools/nodal_tools.py:126`, `:361`, `:383` | Injection flag forwarded to `nodal.fbhp`; water-capable injection tables wrap `simtools.make_vfpinj` | Reference pressure/rate calculations for water injectors |
| pyResToolbox MCP `src/pyrestoolbox_mcp/tools/dca_tools.py:24`; `tools/brine_tools.py`; `tools/sensitivity_tools.py` | Existing wrappers for decline/ratio forecasts, brine properties and sweeps | Forecasting/fluid/scenario reference workflow |

## Extraction boundary

1. Extract relevant pure calculation modules and tests into `swd-injection-analytics`, then adapt table/chart/export components. Preserve source attribution and upstream notices. Include only selected code and public/synthetic fixtures.
2. Carry the dependency closure. PVT types/constants are partly re-exported from `src/utils/multiphaseFlow/types.ts`; correlations reference shared constants, sour-gas helpers and `src/types/wellbore.ts`. The black-oil engine also needs pressure-array and Pb/Rsb helpers. Its spreadsheet export imports `src/services/excel/excelAdapter.ts`.
3. Adapt UI bindings instead of assuming the entire Nexus tab is portable unchanged. Its page uses Nexus navbar/sidebar; the route uses protected-route/error/loading wrappers. Inspect hooks and shared components when selecting the UI slice. Give the receiving app its own layout, settings and persistence interfaces.
4. Reuse the water/PVT functions needed for SWD and the existing MCP injection tools. Oil/gas production IPR/Vogel reference tests do not establish water injectivity or actual sustainable disposal capacity. Keep the explicit constant-J reservoir scenario and capacity/demand arithmetic alongside wellbore calculations.
5. Record copied-file revision/hash, selected package versions and original reference-fixture versions. Run carried tests in the receiving application and add targeted SWD cases for psig/psia conversions, salinity conventions, downward hydrostatic/friction direction, datum, calendar volumes and pressure/capacity limits. These are integration checks, not a new decision about adopting the whole toolbox.

## Delivery scope

Shared Nexus/PVT/pyResToolbox reuse is part of the P0 engineering foundation. Additional model choices, sensitivity controls and extended geometry/VFP simulation exports remain subject to the existing feature priorities. A full hydrocarbon tab is available as a reuse source; copying every hydrocarbon feature is not required for the SWD demonstration.

No employer/private records, credentials, saved Nexus operational cases or entire MCP configuration files belong in the public demo. Configure only the required server entry in the receiving development environment. Keep engineering references separate from the official permitting corpus.
