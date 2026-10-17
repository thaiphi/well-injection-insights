# Sample tour: deferred review minors (M6, M8–M12)

Date: 2026-10-16. Owner instruction: "fix the deferred minors from the review". The six minors were deferred by the independent final review of the sample case + guided tour feature, listed in `demo/SAMPLE-TOUR-VERIFICATION.md`.

The work is governed by a fourth chained preservation baseline, `migration/sample-minors-baseline.json` (`swd-sample-minors-preservation/1`). Its parent is the SHA of `migration/eol-baseline.json`. The approved sample-tour spec and plan are not edited.

## Fixes

| ID | Finding | Fix | File(s) | Check |
|---|---|---|---|---|
| M6 | A reload cancelled between *verify* and *select* replaced the loaded session with one whose producer SHA is null. Capacity then stayed blocked with "schedule changed" until a reload. | *Verify* keeps the new session pending. *Select* commits it only after its own cancel check, so a cancelled reload leaves the previous session (and its producer SHA) untouched. | `web/import-ui.mjs` | Browser: load, reload, cancel after verify → capacity not blocked. |
| M8 | Pressing **Try it with sample data** while the tour was open left the panel on a stale stop during loading. | The two load buttons close the tour (the sample stays loaded) before starting the load. The tour's own start path is unchanged. | `web/import-ui.mjs` | Browser: open tour → load button → panel closed. |
| M9 | On narrow screens the tour bottom sheet (≤60vh) could cover the end of the page. | While the tour panel is visible at ≤700px, the page gets bottom padding equal to the sheet's maximum height, so the page end can scroll above it. | `web/sample-tour.css` | Browser at 390px: last element scrolls clear of the sheet. |
| M10 | The capacity export named the derived surface-limit (and datum) assumptions only indirectly, through the sample ID/SHA in the demand evidence. | The sample demand evidence lists each derived-with-assumption input of the sample: well, input, value, unit, assumption, derived-from. These are the values as loaded. A note in the export says the values used are in `inputs.wells`; where they differ, the field was changed on the page and these assumptions do not apply. | `web/disposal-context.mjs` | Unit test on `disposalContext`. |
| M11 | In sample mode the "Active dataset" bar on Injector history showed the selected well's TRRC artifact under the plain "Active dataset" label. | In sample mode on Injector history the label reads "Sample case · viewing this well's TRRC record". | `web/import-ui.mjs` | Browser: label text. |
| M12 | The checker had no test for a sample-tour baseline without the pressure-support baseline. | Added a test (the code already handles it). The second part, `docSha` being lossy for invalid UTF-8, stays set aside: approved docs are UTF-8 text. | `tests/preservation-baseline.test.mjs` | Test passes. |

## Baseline layer

`scripts/verify-preservation.mjs` gains the layer.
- **Requirements:**
  - the eol baseline exists;
  - version and status are `accepted`;
  - the parent SHA matches;
  - the approved plan matches this document (CRLF→LF normalized).
- **UI changes:** `web/disposal-context.mjs`, `web/import-ui.mjs` and `web/sample-tour.css`.
  - Each has a before-archive under `migration/baselines/sample-minors-before/`.
  - Each before-state must equal the prior accepted state: the sample-tour after-state for the two scripts, and the sample-tour new-file pin for the stylesheet.
  - The stylesheet's reviewed after-state supersedes its sample-tour pin.
- **New product file:** `tests/sample-minors.test.mjs`.
- **Root re-pins:** the checker and `tests/preservation-baseline.test.mjs` (superseding the eol pins).

## Acceptance

- `node scripts/verify-preservation.mjs .`: 0 violations.
- `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs`: all pass.
- The nested suite passes.
- Browser checks show RED→GREEN for M6, M8, M9 and M11.
- An independent read-only review is done.
- The owner records acceptance.
