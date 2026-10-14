# Sample import files

These are synthetic educational files for trying the importer. They are not field data, not calibration data and not TRRC records.

- `seed417-history.csv` / `seed417-history.xlsx`: 48 synthetic producer-month rows from generator `synthetic-water/seed-417/v1`. Group `FICTIONAL-GROUP` is a fictional assumption.
- `assumed-injectors.csv`: the two fictional constant-J injector presets. Every value is assumed.
- `invalid-history.csv`: five deliberately malformed rows, for seeing validation reject bad data.

History mapping: `Producer -> producerId`, `Group -> groupId`, `Month -> month`, `Water -> water`. Declare `water: STB/day`, `timeBasis: calendar-day`, a mapping version and confirmation. Months are ISO `YYYY-MM`. IDs stay text, keeping leading zeros.

Injector mapping: `id`, `j -> injectivity` (STB/day/psi), `pres -> reservoirPressure` and `limit -> limitPressure` (psia), `rb`/`lb -> reservoirBasis`/`limitBasis` (`bottomhole-absolute`), `rd`/`ld -> reservoirDatum`/`limitDatum` (equal within an injector), `ceiling -> operatingCeiling` (STB/day), `availability` (fraction).

Copied byte-for-byte from `tests/fixtures/import/`; the tests check that they stay identical.
