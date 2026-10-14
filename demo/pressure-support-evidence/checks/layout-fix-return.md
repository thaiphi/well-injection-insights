BEGIN_PRESSURE_LAYOUT_FIX

**Summary**

I fixed the overflow and the Calculate button contrast in `pressure-support.css` only. It has not been checked in a browser yet; that is Main's job at 1536×1024 and 390×844 after a CSS reload. The fix was done at 21:43–21:46 UTC, inside the 21:43:15–22:43:15 checkpoint. The CSS is frozen for Fable's review.

**What I read and found (before fixing):**
- **Overflow:** `#pressure-support-workspace` is a grid with one implicit `auto` column. Its grid items (`section`, `form`) had the default `min-width:auto`. So the column grew to the min-content width of the monthly table, which is `width:max-content` with `white-space:nowrap`. That matches the measured 1265 vs 1325 px on desktop and 1422 px on mobile. The `overflow:auto` on `.ps-scroll` doesn't shrink that intrinsic width.
- **Pale Calculate button:** `.primary-action` in `redesign.css` has specificity 0,1,0. The global `button:hover{background:#edf5ff}` in `styles.css` has 0,1,1 and wins, so hover gave white text on a pale background (1.10:1). The global `button:disabled` rules (opacity .55/.65) also beat it.
- **Full-width bar:** my own `fieldset{display:grid}` stretched the submit button across the panel.

**The fix (in `web/pressure-support.css`):**
- **Containment:**
  - workspace: `grid-template-columns:minmax(0,1fr)`, `max-width:100%`;
  - `#pressure-support-workspace>*`, `.ps-results>*` and `details`: `min-width:0;max-width:100%`;
  - fieldset: `grid-template-columns:minmax(0,1fr)`;
  - `.ps-scroll`: `width:100%;max-width:100%;min-width:0`;
  - `overflow-wrap:anywhere` on `p, li, dd, caption, legend, summary, label`. This covers long hashes in the method, status and export lines.
- **Kept on purpose:** chart `min-width:640px` (560px under 480px) and table `width:max-content`. Both now scroll inside their own labelled regions.
- **Button:**
  - `fieldset>button{justify-self:start}`;
  - `.primary-action` gets explicit enabled, `:hover:not(:disabled)`, `:active:not(:disabled)`, `:focus-visible` and `:disabled` colors, with `opacity:1`. The disabled state also gets `cursor:not-allowed`.
  - These outrank the global rules through the ID scope. The same fix applies to the Load/Reload button, which uses the same class.

**Files touched**
- Only `swd-injection-analytics/web/pressure-support.css`. sha256 went from `daea132e…99e9` to `829390d697ac382c8b9c13ab81da6b1a22496f114d9ed6ba45e037fe7faa2a02`.
- `styles.css`, `redesign.css`, `index.html`, the controller, the SVG generator, tests, data and dist are unchanged; `git diff` on the global stylesheets is empty.
- I briefly wrote a check log under `tmp/` and then deleted it to honor "no other file edits". Its output is reproduced below. No Git operations.

**Needs judgment**
1. **The CSS can't fix the clipped chart subtitle.** The subtitle "…investigation view, not a p" is cut off inside the SVG itself: the generated text is wider than the 960-unit viewBox. Exported SVGs clip it the same way. Fixing it means wrapping or shortening the line in `src/pressureSupportChart.ts`, which is out of scope here and needs owner approval. It would also change the chart output, so the export evidence and the baseline would have to be updated.
2. **The fix assumes a normal app shell.** It only contains the workspace inside its parent. If the 390px document width still overflows after reload, the cause would be outside the workspace (the separately tracked global navigation clipping). Main's measurement should separate the two.
3. **The new CSS hash needs re-sealing.** The 12-file inventory and baseline need re-sealing, and Fable needs to re-review.

**Gates (all run with Node directly)**

| Check | Result |
|---|---|
| Brace balance | pass |
| Scope | 28 rules, 32 selectors; every selector begins with `#pressure-support-workspace` (unscoped list empty); no `!important` |
| Contrast: white on #0863bd (enabled) | 5.95:1 |
| Contrast: white on #064e96 (hover) | 8.27:1 |
| Contrast: white on #053d75 (active) | 10.88:1 |
| Contrast: #46546a on #e7ecf2 (disabled) | 6.46:1 |
| Contrast: focus ring #1f6feb on white | 4.63:1 |
| Contrast before the fix (hover defect) | 1.10:1 |
| Footprint | `git status` shows only the CSS changed in this round |

As instructed, I did not write a CSS-string test. The focused test suite wasn't rerun because no JS, HTML, test or data file changed.

**Not run:** any actual layout or rendering at 1536×1024 or 390×844, hover/focus/disabled rendering in a browser, and screenshots. All of these wait for Main.

The CSS is complete and frozen, and the slot is released. No commit, push, deploy or acceptance claim.

END_PRESSURE_LAYOUT_FIX
