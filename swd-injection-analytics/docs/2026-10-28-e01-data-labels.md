# E01 data labels: mapping onto the existing classes

Date: 2026-10-28. Owner decision D12 (`../../docs/project-2-decisions-2026-10-20.md`): E01 maps onto the classes already in `src/importProfile.ts` and `src/sampleCase.ts`. The snake_case list in the PRD §5 example contract (`public_reported`, `measured_unverified`, `assumed`, `calculated`, `unavailable`) is **not** adopted as an interface. The PRD itself marks that JSON as placeholders, not committed names.

## Existing classes

- **Import content kind:** `ContentKind` (`src/importProfile.ts:3`): `synthetic`, `public-reported`, `measured`, `literature`, `assumed`. This is the kind the user *asserts* for an imported file. Each `Source` (`src/importProfile.ts:4-7`) also carries an acquisition `origin` (`user`, `synthetic`, `public`, `literature`, `assumed`) and `verified:false`.
- **Sample-case value class:** `ValueClass` (`src/sampleCase.ts:7`, values in `VALUE_CLASSES` at line 6): `trrc-public-record`, `calculated`, `derived-with-assumption`, `synthetic`, `raw-not-verified`. The display labels are in `CLASS_LABELS` (`src/sampleCase.ts:8`).

## PRD §5 import classes → existing classes

| PRD §5 class | Import path (`ContentKind`) | Sample case (`ValueClass`) | Notes |
|---|---|---|---|
| Project 1 evidence (verified public, as retrieved) | `public-reported` | `trrc-public-record` | A raw field not yet checked is `raw-not-verified`. Verification of an Explorer artifact is the existing pin/manifest check; it does not make a value site-calibrated. |
| User measurements (claimed measured, unverified until audited) | `measured` (with `verified:false` on the source) | no class yet | Added by the phase that first brings measured test evidence into a sample-style case (Phase 1, E02/E03). |
| Assumptions | `assumed` | `derived-with-assumption` when derived from a TRRC value with a stated assumption | A free-standing assumption with no TRRC origin has no sample class yet. |
| Calculated | (not an import kind) | `calculated` | Calculated results carry method, units and provenance in their own result/export objects. |
| Unavailable | (not a kind) | no class | Missing stays missing: `null` values and not-ready reasons (`src/analysisReadiness.ts`), never zero. A class is added only if a phase needs to label it in a table. |
| (not in PRD §5) | `synthetic`, `literature` | `synthetic` | Kept as they are. |

"No class yet" means the phase that first needs the class adds it, under that phase's preservation layer. This note does not invent one.

## Pressure basis (D8)

This is a rule for the phase that adds test-evidence import (no psia/psig field exists in `src/importProfile.ts` today): every imported pressure record will declare its basis (psia or psig), and a record without one will be blocked rather than assumed. UIC BHP test results arrive in psia and step-rate test results in psig; each will be handled per record. The sample case keeps its stated conversion: `ATMOSPHERIC_PSI = 14.7` (`src/sampleCase.ts:5`), applied as a `derived-with-assumption` value.
