# Implementation decisions

1. Use TypeScript for the Nexus-derived calculation closure, a static browser module UI and Node scripts. This keeps the first workflow reproducible with one pinned compiler dependency.
2. Keep a constant-J stock-tank-rate model with one bottomhole pressure basis. The production IPR API does not establish an injector model. Wellbore hydraulics require dedicated injection-direction benchmarks before inclusion.
3. Pin file artifacts instead of a live Explorer service. Retain raw official snapshots, manifest, CSVs, dictionary and quality report. Verify normalized JSON against CSVs so the convenient browser representation cannot silently diverge.
4. Keep frozen model inputs and seeded actuals separate from future schedule controls. Reconciliation compares the existing producer forecast to its holdout; the new-producer scenario changes planning demand only.
5. Expansion means additional available stock-tank capacity after downtime. Base injector availability is applied before expansion; the interface/export must use this same definition.
6. Carry unmodified upstream tests as reference evidence and execute selected numerical/integration cases with Node's test runner. Do not claim full Vitest or a fresh pyResToolbox MCP run.
