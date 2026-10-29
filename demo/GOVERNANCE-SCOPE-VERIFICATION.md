# Governance scope amendment: verification record

Date: 2026-10-29. Branch `feature/phase-a-governance`. Plan: `docs/superpowers/plans/2026-10-28-governance-scope-amendment.md`. Layer `governance-scope` (`migration/layers/governance-scope.json`), the first data-only registry layer; parent = SHA of `migration/layers/layer-registry.json` (`a47d9566…`). No checker change.

## Changes

| Path | Before (archive) | After |
|---|---|---|
| `swd-injection-analytics/AGENTS.md` (line 3, scope) | `173e639f…`, 2060 B, equal to the manifest original | `ec0a7136…`, 2726 B (after the review fix) |
| `swd-injection-analytics/product-spec.md` (line 13, purpose; appended) | `c4a7a3d5…`, 16745 B, equal to the manifest original | `760fbffc…`, 17389 B |

Both files are LF-only before and after (0 CR bytes). `git diff --stat`: one line changed in each.

Approved documents (hashed after normalizing CRLF to LF): the plan (`ec7be69d…`) and `docs/project-2-decisions-2026-10-20.md` (`ecf07a1a…`). PRD v1.1 is not pinned (owner choice, 2026-10-28).

Root pins: `migration/layers/index.json` (`bbf96632…`), `tests/preservation-baseline.test.mjs` (`cace7a2f…`) and `tests/layer-registry.test.mjs` (`9695c209…`). The two test files are re-pinned because of the ruling below.

## Ruling: test fixtures assumed unlisted originals were unchanged

After the amendment, 7 legacy tests failed (`Unapproved original file bytes/hash: AGENTS.md` / `product-spec.md`). Their fixture took every original outside its two hard-coded lists from the live tree. The fixture now takes such a path from the first registry layer's before-archive (RED 7 → GREEN 66/66).

Re-pinning that test then failed 7 registry tests (`Reviewed added file hash/bytes mismatch: tests/preservation-baseline.test.mjs`). The registry fixture now copies and re-pins every root file the live registry layers pin (`liveRegistryRoots()`), giving 43/43. The full write-up is in the plan's "Ruling" section.

## Checks

| Check | Result |
|---|---|
| `node scripts/record-layer.mjs governance-scope archive` (before editing) | `archived 2`; both archives equal their manifest SHA. |
| `node scripts/verify-preservation.mjs .` (pending) | 182 checked; exactly one violation: `Layer governance-scope baseline is pending/not accepted after independent review`. |
| `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs tests/layer-registry.test.mjs` | 111/112; the only failure is the transfer live-root test on that same pending violation (expected until acceptance). |
| Tamper, on a scratch copy: append 1 byte to the decision record | `Approved document hash mismatch: docs/project-2-decisions-2026-10-20.md` |
| Tamper: append 1 byte to `AGENTS.md` / `product-spec.md` | `Unapproved original file bytes/hash: AGENTS.md` / `…: product-spec.md` |
| Product suite, inside `swd-injection-analytics/`: `node --test tests/*.test.mjs` | 435/435 pass. |
| `node scripts/check-carried-oracles.mjs` | 248 comparisons, 0 failures. |

## Design notes (not walked by the gate; no layer needed)

- `swd-injection-analytics/docs/2026-10-28-e01-data-labels.md`: D12 label mapping and the D8 pressure basis.
- `swd-injection-analytics/docs/2026-10-28-volve-reference.md`: D17, pattern only, no code copied.

## Review

Independent read-only Claude Opus review (D13), 2026-10-29: ready for owner acceptance; no Critical or Important findings. It confirmed:
- the archives equal the manifest originals, and the after-hashes, parent SHA, approved docs and pins all match;
- only the two intended lines changed;
- the tamper cases fail as intended;
- both test-fixture source rules rebuild every path class correctly and mask no regression;
- the re-pins weaken no guarantee of the accepted registry layer;
- the D12 and D17 notes are accurate.

**Fixed before acceptance (re-graded by effect):** the `AGENTS.md` wording. As first written, "phases accepted in <decision record>" could be read as authorization to build now, and `AGENTS.md` did not repeat D18/D19. The line now says:
- each phase is in scope only after its own reviewed layer is accepted, and the decisions authorize no build;
- panels go in the existing workspaces, with no new tabs;
- qualifying test evidence means UIC BHP or step-rate results, never H-10 monthly reports alone;
- the handoff is one-way.

Also fixed: the D12 note's line citation and tense (the D8 basis rule is future work), and the record's `purpose` now mentions the test re-pins. Re-recorded and re-run: gate shows only the pending violation; 111/112 (transfer pending only).

**Left as is (minor):** "GIS (maps or between-well distances)" could be read as allowing coordinates, which D7 anticipates. "PRD v1.1, as amended by the decision record" slightly overstates the PRD's status while v1.2 is still open.

## Acceptance

Accepted 2026-10-29 by Thai Phi with the post-review wording: `node scripts/record-layer.mjs governance-scope accept "Thai Phi"` → `accepted`; `node scripts/verify-preservation.mjs .` → 182 checked, 0 violations; root suites (transfer, preservation-baseline, layer-registry) 112/112.

Fresh Windows clone (`core.autocrlf=true`, commit 4a02a89): 182 checked, 0 violations; registry + preservation tests 109/109. Clone deleted.
