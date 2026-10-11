# SWD-13 / SWD-14 import foundation samples

These are educational import fixtures, not calibration data. Run from the owning repository:

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.json
node tests/fixtures/import/generate.mjs
node --test tests/import.test.mjs tests/readiness.test.mjs
```

- `seed417-history.csv`: 48 synthetic producer-month rows regenerated from `syntheticActuals(417)`, generator `synthetic-water/seed-417/v1`. The generated group `FICTIONAL-GROUP` is an explicit fictional assumption, not a source field.
- `invalid-history.csv`: five intentionally malformed rows (missing producer/group, invalid month, negative number, boolean text). This fixed hand-authored corruption sample is not rewritten by the generator.
- `assumed-injectors.csv`: the existing two fictional constant-J presets; all inputs remain assumed.
- `parsed-sheet-contract.json`: synthetic multi-sheet **adapter contract only**, not an XLSX workbook. History cells equal the CSV; the formula sheet must be quarantined. No XLSX binary parsing, formula evaluation or cached-value substitution is implemented.
- `public-reported-observations.csv`: exact byte copy of the pinned public monthly observations; the generator preserves their UIC/source IDs and makes no fictional scenarios for them. This uses the existing public-observation consumer, not the producer-history profile. The provenance file records the source SHA256.
- `provenance.json`: distinct source labels and generator/preset references.

History mapping: `Producer -> producerId`, `Group -> groupId`, `Month -> month`, `Water -> water`. Explicitly declare `water: STB/day`, `timeBasis: calendar-day`, a mapping version and confirmation. Other supported pairs are `STB/hour + calendar-hour` and `STB + calendar-month`. Plain `bbl`, operating-day rates, reservoir barrels, locale-formatted numbers and date serials are rejected. Reporting months are ISO `YYYY-MM`; schedule starts are valid ISO `YYYY-MM-DD` dates. IDs remain text, retaining leading zeros.

Schedule fields: producerId, groupId, startDate, initialRate (`STB/day`), monthlyDecline (`fraction/month`, nonnegative exponential slope magnitude), availability (`fraction`, 0..1). Injector fields: id, injectivity (`STB/day/psi`), reservoirPressure and limitPressure (`psia`), separate reservoirBasis/limitBasis (`bottomhole-absolute`), separate reservoirDatum/limitDatum (equal within the injector), operatingCeiling (`STB/day`) and availability (`fraction`). See test mappings for concrete column selections. Each injector can have its own internally consistent datum.

`createSource` hashes original bytes. Low-level `validateImport` takes a parsed table and its source record; the adapter/caller must pair that table with those exact original bytes. A future XLSX adapter must hash the actual workbook, select the named sheet/header explicitly and preserve formulas as formula cells for rejection. UTF-8 CSV decoding is the caller's responsibility. There is no browser upload or persistence workflow in this slice.

A file acquired from a user always has origin `user`, with content assertion stored separately and `verified: false`; reimporting these samples does not establish measured/public verification. Original values/headers, units, mapping, source hash/reference, sheet/header and row numbers survive normalization. `calculatedFields` and transformation notes link derived rate/volume fields to that original row. Missing values normalize to null; explicit zero stays zero, and original empty versus null cells remain inspectable.

Readiness is a library contract, not yet wired to UI/calculations. History gates descriptive availability; the exponential-fit/forecast gate requires at least three positive distinct training months for each selected producer. Reconciliation additionally requires every selected producer/holdout-month actual. Grouped planning requires all selected schedules and consistent groups. Constant-J capacity requires all selected compatible injectors. Generic imports cannot establish public evidence: the new readiness object's public gate remains unavailable pending connection to the existing verified Explorer consumer. Extended wellbore readiness remains unavailable (SWD-10). Accepted rows remain inspectable even when an affected gate is blocked. There are no manual exclusion controls; excluded count is zero.
