# Sample tour minors verification

Date: 2026-10-16. Owner instruction: "fix the deferred minors from the review".

- **Plan:** `docs/superpowers/plans/2026-10-16-sample-tour-minors.md`
- **Baseline:** `migration/sample-minors-baseline.json` (`swd-sample-minors-preservation/1`), chained on the accepted line-ending baseline.
- **Before-archives:** `migration/baselines/sample-minors-before/`, copied before any edit and byte-identical to HEAD 9078aa4.

## Fixes and evidence

Browser runs used headless Chrome driven over CDP against the nested app (`node scripts/serve.mjs`). The scripts and their outputs are in `demo/sample-minors-evidence/`.

| ID | RED (before the fix) | GREEN (after the fix) |
|---|---|---|
| M6 | Reload cancelled after *verify* → capacity blocked: "The synthetic producer schedule changed after the sample loaded." | The same cancel: the capacity page opens ready on the sample case, with no block (`green-desktop-m6.txt`). |
| M8 | Tour on "Step 3 of 7", then **Try it with sample data** → panel still visible on step 3 while loading | Panel closes when the load starts. |
| M9 | 390px with the tour open: 506px of the page end covered by the sheet | 0px covered. Bottom padding is 506.4px only while the sheet is open at ≤700px; it is 0 when the tour is closed or at 1280px (`m9-negative.txt`). |
| M10 | The export named the derived assumptions only through the sample ID/SHA | `demand.evidence.derivedInputs` lists each derived input (well, input, value, unit, assumption, derived-from) as loaded, with a note pointing to `inputs.wells` for the values used. It reaches the capacity export through `provenance.demand`. Unit tests are in `tests/sample-minors.test.mjs`. |
| M11 | Injector history in sample mode was labelled "Active dataset" | "Sample case · viewing this well’s TRRC record" |
| M12 | No checker test for a sample-tour baseline without the pressure-support baseline | Test added. The second part (`docSha` being lossy for invalid UTF-8) is set aside because approved docs are UTF-8 text. |

## Independent review (Claude Opus, read-only; GPT-6 Astra unavailable)

The verdict was: ready for owner acceptance as-is. There were no Critical or Important findings.

- **Fix review:** each fix was assessed as correct.
  - M6: superseded runs, first-load cancel, and cancel during *select*.
  - M8: the tour's own start path and focus.
  - M9: the scope of the padding rule.
  - M10: export honesty and spec section 3.
- **Checker layer:** sound, with no bypass found. Acceptance was simulated in a copy and gave 0 violations.

The three Minor findings were fixed before acceptance:
1. **M10 note wording:** reworded so a reader of the export alone knows to compare against `inputs.wells`.
2. **Checker test gaps:** found by mutation testing. Added tests for a deleted archive, a null after-hash, and later edits of the sample-minors test and the preservation test.
3. **M9 negative case:** added the browser check `m9-negative.txt`.

## Checks before acceptance (pending record)

| Check | Result |
|---|---|
| `node scripts/verify-preservation.mjs .` | 182 files checked; exactly one violation, the pending status |
| `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs` | 69 tests: 68 pass and 1 fail. The failure is the real-repo acceptance test, which fails only because of the pending status. |
| Nested `node --test tests/*.test.mjs` | 435 of 435 pass |
| `node scripts/check-carried-oracles.mjs` | 248 comparisons, 0 failures |
