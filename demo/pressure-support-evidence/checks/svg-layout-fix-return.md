BEGIN_PRESSURE_SVG_LAYOUT_FIX

**Summary**

The clipped chart labels are fixed in `src/pressureSupportChart.ts` only. All 42 existing tests pass, and an old-versus-new comparison shows the plotted numbers didn't move. Nothing has been checked in a real browser or against a downloaded SVG; Main does that. The work was done at 22:02–22:04 UTC, inside the 21:43:15–22:43:15 checkpoint, which I did not renew.

**What changed:**
- **Header:** the old single line at y=38 is now three separate lines, each wrapped if needed:
  - classification and dataset ID;
  - `sha256 <complete 64-character hash>`;
  - `investigation view, not a pressure-support determination`.

  The title also goes through the wrapper.
- **Panels:** both panels move down by one uniform offset worked out from the header height. That is +34 units for the fixture (top of the upper panel goes from 56 to 90). Panel heights, the 44-unit gap, rate/injection/water-cut scales, the separate axes and all x/date positions are unchanged.
- **Wrapping:** long notes, limitations, event citations, missing-value reasons and the "Context unavailable" reasons now wrap.
  - A new exported pure helper, `wrapText`, breaks after a space where it can, and splits a token only when it is longer than a line.
  - Each logical line is one `<text>` element, with each wrapped part as a `<tspan>`. The parts are contiguous, so the element's text content equals the original string character for character.
  - Escaping still happens after splitting, so an entity is never cut in half.
  - The SVG height grows with the number of wrapped lines.
- **Event labels:** a label that would run past the right edge is right-aligned against its marker instead. The full event text is still listed in the notes.
- **Unchanged contract:** the title/desc structure, and the single pure generator shared by the live chart and exports (the export wrapper adds the metadata separately).

**What stays the same, and what doesn't:**
- **Unchanged:** the source and result identity. The model (`pressureSupport.ts` `6d2c258a…3038`), export logic (`pressureSupportExport.ts` `773c2fac…0995`), fixture (`dfb32bed…75ab`), results and `resultSha256` don't depend on chart text. The JSON and CSV downloads are byte-identical.
- **Changed:** the SVG bytes, for both the live chart and the exported SVG. For P01 full range they go from 18,913 to 19,472 bytes. Any previously captured SVG download or chart hash needs regenerating.

**Files touched**
- `swd-injection-analytics/src/pressureSupportChart.ts`: sha256 went from `5ff0727d…7df6` to `de846d29fe73354850bfa977d8c3a8112b38880237836842ed1a7f5e5fda91f0`.
- The CSS is still frozen at `829390d6…2a02`.
- No other source, test, data, pin, controller, export or root file changed. The nested `git status` still shows the same 15 entries.
- I reused the snapshot helper `task4-check/run.sh`, which refreshes that snapshot under tmp. My comparison script, the old compiled chart and logs are in the session scratchpad, outside the repo. A stray backup copy I made in the system temp folder was deleted.

**Needs judgment**
1. **Wrap widths are estimated.** They assume an average glyph width of 0.62 em (conservative for system-ui); the widest estimated line end is 948 of 960 units. Real font metrics can differ, so Main's browser check at 1536×1024 and 390×844 should confirm nothing clips, especially the 71-character SHA line and wrapped citation lines.
2. **Evidence needs refreshing.** The SVG output changed, so the export evidence, the stored chart and SVG downloads, and the baseline/inventory hash for `pressureSupportChart.ts` need updating, and Fable needs to re-review.

**Gates**

| Check | Result |
|---|---|
| Compile (`tsc` into the snapshot `dist`, Node run directly) | exit 0 |
| `node --check` on 5 web modules | all pass |
| Existing tests (Task 2, state, export, navigation) | 42/42 pass |

I compared the old compiled chart with the new one on five cases: P01 full range, P02 with no injectors, P01 with I02 over 2024, a hostile case (markup, quotes, a 300-character unbroken token, a 60-word tail and a `</text><script>` uncertainty) and a blocked result. Every check passed:
- Every old text element's content is present unchanged, and the old identity line equals the three new header lines joined by " · ".
- Wrapped parts join back into the original text exactly, every part's estimated width fits inside 960, and the viewBox height covers the last line.
- All 7 series paths and their points keep identical x. Every y moves by +34; a few print as 33.99 only because coordinates are written to two decimals.
- Month-start and event x positions and all axis tick labels are identical.
- No unescaped or active markup appears.

I added no new tests, as instructed.

**Not run:** any real browser rendering, the regenerated SVG download, the full nested test suite and the preservation baseline. Those belong to Main.

The chart is complete and frozen, and the slot is released. No commit, push, deploy or acceptance claim.

END_PRESSURE_SVG_LAYOUT_FIX
