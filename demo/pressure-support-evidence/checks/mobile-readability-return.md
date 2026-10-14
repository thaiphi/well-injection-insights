BEGIN_PRESSURE_MOBILE_READABILITY

**Summary**

I made the two substitutions in `pressure-support.css`, setting the chart SVG's `min-width` to 960px, but nothing has been checked in a browser or run with Node. Bash is disabled in this session, so I couldn't compute the new SHA-256 or rerun my earlier brace/scope/contrast checks.

**Why it works:** the chart is drawn in a 960-unit viewBox. At a minimum width of 960px, one unit is at least one CSS pixel, so 11px chart labels render at 11px or more instead of about 6.4px (560/960 × 11).

**Effect at each viewport:**
- **Mobile:** the chart is wider than its 349px region, so it scrolls inside it. That region already has `overflow:auto`, `min-width:0` and `max-width:100%`. Your final measurements show the same containment holding a 1324px table inside a 349px region while the workspace stayed at client = scroll = 351.
- **Desktop:** the chart region is wider than 960px, so `width:100%` still decides the size and the desktop layout at 1265 should be unchanged.

**Exact diff (`swd-injection-analytics/web/pressure-support.css`):**
```diff
-#pressure-support-workspace .ps-scroll svg{display:block;width:100%;min-width:640px;height:auto}
+#pressure-support-workspace .ps-scroll svg{display:block;width:100%;min-width:960px;height:auto}
@@ @media (max-width:480px)
- #pressure-support-workspace .ps-scroll svg{min-width:560px}
+ #pressure-support-workspace .ps-scroll svg{min-width:960px}
```
After the edit, a search for `min-width:<n>px` finds exactly these two lines (24 and 33). Every other rule is unchanged, including containment, focus, button states and stacking.

**Files touched**
- Only `swd-injection-analytics/web/pressure-support.css`. Its SHA was `829390d697ac382c8b9c13ab81da6b1a22496f114d9ed6ba45e037fe7faa2a02` before this edit; Main needs to compute the new one.
- The chart source (`f3265359…64ef4`), SVG bytes, values, scales, selections and source/result hashes are not affected: CSS doesn't feed into the SVG or the exports.
- No other file was written. No Git operations.

**Needs judgment**
1. **New CSS SHA is unrecorded.** Main needs to compute it for the baseline and for Fable's review.
2. **Mobile users must scroll the chart sideways.** At 390px only about 36% of it is visible at once. This trade-off is what the brief asks for; the region is already labelled and keyboard-focusable.
3. **One odd measurement, not touched.** Your `layout-final-mobile.json` reports `client: 0` for "Producer monthly rows" while the other source-row regions show 349. It's probably measured inside a collapsed `<details>`, but worth confirming in the rerun.

**Gates**
- Ran: read the current CSS, confirmed only these two substitutions were needed, applied exact-match edits and confirmed the result by search.
- Not run, because Bash is unavailable: computing the SHA, rechecking brace balance and scoped selectors, and the existing focused tests (which don't depend on CSS).
- Not run, because they're Main's job: actual browser checks at 390×844 and 1536×1024 (chart scroll at 960 inside the 349 region, workspace client = scroll, desktop chart region unchanged, rendered label size), and screenshots.

The CSS is frozen and the slot is released. No acceptance, commit, push or deploy.

END_PRESSURE_MOBILE_READABILITY
