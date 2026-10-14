BEGIN_PRESSURE_UNICODE_LAYOUT_CHECK

**Summary**

**The defect was real, and it's fixed.** The previous `wrapText` hard-broke text at UTF-16 code-unit positions, so it could cut an emoji in half and emit invalid XML text. On `'a'` followed by 300 emoji, all 6 of its output pieces contained a lone surrogate, and 2 of 3 did on a 141-character ASCII prefix followed by emoji. The new build produces 0 in both cases.

**Code changed:** only `wrapText` and its new helpers in `src/pressureSupportChart.ts` (done 22:08–22:10 UTC, before the 22:43:15 deadline).
- Text is split into grapheme clusters with `Intl.Segmenter`, falling back to code points, so a break can never land inside a surrogate pair, a ZWJ emoji sequence, a flag or a base letter plus combining mark.
- Width is counted in narrow-glyph units. Plain ASCII counts its code units exactly as before. Wide glyphs (emoji, CJK, Hangul, full-width forms) count 2, and other clusters count 1.
- The output pieces are still contiguous, so they join back into the input exactly, including spaces and any markup. Escaping still happens after splitting.

**What did not change:**
- **ASCII SVG:** byte-identical to the previous build for the 4 fixture selections, the blocked result and a long ASCII hostile citation.
- **Numbers:** no value, x/date coordinate, scale, axis or unit changed. Only wrapping code changed, and every plotted element is unchanged.
- **Results and exports:** the source and result identity, `resultSha256`, and the JSON/CSV downloads are unaffected. The SVG bytes for the current fixture are also unchanged.

**Files touched**
- `swd-injection-analytics/src/pressureSupportChart.ts`: sha256 went from `de846d29…91f0` to `f32653592a9fbec0fb9d283de69cbd26263ca285a6870f40ab9c97266f364ef4`.
- The CSS (`829390d6…2a02`), model (`6d2c258a…3038`), export logic (`773c2fac…0995`) and fixture (`dfb32bed…75ab`) are unchanged. The nested `git status` still shows the same 15 entries.
- No tests, data or other files changed. The snapshot helper refreshed `task4-check` under tmp, and the verification scripts and logs are in the session scratchpad. No Git operations.

**Needs judgment**
1. **Width is an estimate, not a font model.** It assumes 0.62 em for narrow glyphs and treats wide glyphs as about 1.24 em. Real fonts, emoji presentation and fallback fonts can still differ, so Main's bounding-box check on the actual SVG is still needed. The current fixture text is all ASCII.
2. **Two input edge cases.**
   - A lone surrogate that is already in the input is passed through as its own cluster; the wrapper never creates one.
   - A CRLF pair is now kept on one line where the old code could split it. That is the only theoretical difference for ASCII input, and the fuzz test found none.

**Gates**

| Check | Result |
|---|---|
| Compile (`tsc` into the snapshot) | exit 0 |
| `node --check` on 5 web modules | all pass |
| Existing tests (Task 2, state, export, navigation) | 42/42 pass |

Independent Node checks, all passed:
- 8 Unicode inputs (repeated emoji, ZWJ families, flags, CJK, spaced CJK, combining accents, mixed emoji/CJK with `<b>&"`, and a surrogate falling on the line boundary), each at sizes 10, 11, 12 and 15:
  - pieces join back to the input exactly;
  - no lone surrogates, and every piece is well-formed;
  - no break inside a grapheme cluster;
  - no piece exceeds the width budget.
- ASCII parity: 5,000 random strings × 3 sizes gave identical output from the old and new `wrapText`.
- Fixture SVGs are byte-identical between the old and new builds.
- A full chart with emoji, ZWJ and CJK text plus `<i>&</i>` in a citation is well-formed, has no lone-surrogate text nodes, rebuilds the citation line exactly, and contains no raw `<i>`.

No production test file was added, as instructed.

**Not run:** real browser rendering and bounding boxes, the regenerated SVG download and its parity check, the full nested test suite and the preservation baseline. Those belong to Main.

The chart source is frozen and the slot is released. No acceptance, commit, push or deploy.

END_PRESSURE_UNICODE_LAYOUT_CHECK
