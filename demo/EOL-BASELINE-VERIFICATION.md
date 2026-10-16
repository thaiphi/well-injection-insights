# Line-ending baseline verification

Date: 2026-10-15. Baseline: `migration/eol-baseline.json` (`swd-eol-preservation/1`), chained on the accepted sample-tour baseline.

## Why

On Windows with `core.autocrlf=true`, a fresh clone checked out the root `.gitattributes` as CRLF. That file has no `-text` rule, so the pressure-support root pin failed (`Reviewed added file hash/bytes mismatch: .gitattributes`). Commit 4ea3c35 added folder-level `-text` rules for the other hashed files. The root file is pinned by the accepted pressure-support baseline, so it needed its own reviewed layer.

## Change

- `.gitattributes`: added `.gitattributes -text`. The pattern matches at every level, so it also covers the nested `.gitattributes` files.
- `scripts/verify-preservation.mjs`: a third chained layer.
  - It requires the sample-tour baseline, version `swd-eol-preservation/1` and status `accepted`.
  - Its parent is the SHA of the sample-tour baseline.
  - Its root-file list is exact: `.gitattributes`, `scripts/verify-preservation.mjs`, `tests/preservation-baseline.test.mjs`. These pins supersede the earlier pressure-support and sample-tour pins for the same paths.
  - `tests/transfer.test.mjs` remains under the pressure-support pin.
- `tests/preservation-baseline.test.mjs`: added cases for:
  - acceptance;
  - a changed `.gitattributes` staying blocked without the layer;
  - pending status;
  - a broken parent chain;
  - a later `.gitattributes` edit;
  - the checker pin being enforced;
  - an unsupported version;
  - a `null` sample-tour anchor;
  - extending the allowlist.

  The fixture gives the old sample-tour checker pins a stale hash, which proves that they are superseded.

## Independent review (Claude Opus, read-only; GPT-6 Astra unavailable)

The verdict was: ready for owner acceptance; no way found to weaken the gate.

- **Soundness:**
  - A missing or `null` sample-tour baseline is blocked.
  - A pending layer always fails.
  - Pins are checked against exact allowlists.
  - Supersession filters are correct.
  - There are no regressions in the earlier pressure-support and sample-tour layers.
- **Empirical check:** in a throwaway copy, the reviewer simulated acceptance, committed, and made a fresh `core.autocrlf=true` clone. Result:
  - `.gitattributes`: `i/lf w/lf attr/-text`
  - checker: `"violations": []`
- **Findings fixed before acceptance:**
  - The pending record was stale after three CRLF lines were restored in the checker, so it was re-recorded.
  - Three test gaps were found by mutation testing: superseded sample-tour pins, the version check, and a `null` sample-tour anchor. Tests were added for each.
  - This evidence file was missing; it now exists.
- **Not verified:** how an existing working copy that already has a CRLF `.gitattributes` behaves when it pulls this change.

## Checks before acceptance (pending record)

- `node scripts/verify-preservation.mjs .` reported 182 files checked and exactly one violation: `Line-ending baseline is pending/not accepted`.
- `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs` reported 47 tests: 46 pass and 1 fail. The failure is the real-repo acceptance test, which fails only because of the pending status.
