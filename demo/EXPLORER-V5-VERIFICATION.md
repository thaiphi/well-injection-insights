# Explorer v5 receiver verification (acceptance evidence for layer explorer-v5)

Date: 2026-10-31. Branch: feature/explorer-v5-receiver (base b48ce03). Design: docs/superpowers/specs/2026-10-31-explorer-v5-receiver-design.md, a bounded change the owner approved in chat. The layer is recorded as pending-review until the owner accepts it.

## What changed

- **Query version 5 is accepted.** The receiver accepts query version 5 and checks it exactly as it checks v4: scope, the 21 targets, the 22 sources and the test-sidecar re-derivation. `tests.json` `scope.query_version` now follows the package's version instead of being hard-coded to 4.
- **v5 only: `evidence_relations.json`.** It must be the last key declared in `manifest.files`, and the last limitation must equal Explorer's v5 sentence exactly.
  - `casing.json` and `plugging.json` must not contradict the acquisition. The receiver checks their dataset, query version, source API id, link inventory key and row API ids.
  - `evidence_relations.json` is rebuilt with `web/explorer-relations.mjs` and compared byte for byte.
  - If `buildRelations` throws, the error is turned into a package refusal.
- **Other versions.** Any manifest other than v5 that declares `evidence_relations.json` is refused.
- **Result.** The verified result carries `relations: {count, sha256}` for v5, and `null` otherwise.
- **Display.** The interface is unchanged: relations are verified, not displayed.
- **Copied code.** `web/explorer-relations.mjs` is a byte-identical copy of Explorer `src/relations.mjs` at `b67fe5c`. Its SHA-256 is `88b43327612adc584119ae430588151bd3a7394ff3919d159d83c3984795a648`, pinned by a test.

## Commands (run from the nested app folder; direct Node paths only)

- `node ../node_modules/typescript/bin/tsc -p tsconfig.json`: clean.
- `node --test tests/*.test.mjs`: 523 tests, 523 pass, 0 fail. The baseline was 509; this change adds 14 tests in `tests/explorer-package-v5.test.mjs`.
- `node scripts/check-carried-oracles.mjs`: 4 recorded cases, 28 exact pressure points, 248 comparisons, 0 failures.
- CR bytes are 0 in every changed and new file. `web/import-ui.mjs` is untouched and still has 4 CR bytes.

## RED to GREEN

- **RED.** Before the receiver edits, the new v5 test file showed 1 pass and 10 fail. The one pass was the module pin test, because the copy was made first.
- **GREEN.** 11 pass, then 14 after fix round 1.
- **Fix round 1 RED.** With the sidecar guard temporarily removed, 3 tests failed.

## Synthetic tests (UIC 000000417, built in memory by tests/helpers/explorer-v5.mjs; nothing committed)

These pass:
- the relations module pin;
- a complete v5 package verifies, with test records `deepEqual` to the v4 result and relations reported;
- a v4 package reports no relations.

These are refused:
- one flipped byte (hash mismatch);
- the file edited and re-hashed (re-derivation contradiction);
- present in the package but undeclared;
- a v5 manifest without the file;
- a v4 manifest declaring the file;
- a wrong last limitation;
- the file not declared last;
- a missing wellbore link;
- a forged link `source_api_id`, even with the relations rebuilt to match;
- a wellbore sidecar carrying query version 4;
- a builder `SOURCE_INVALID` error (converted into a refusal).

## Real artifact checks (run by Main)

Explorer's repository was read only, at `b67fe5c`, via `git archive` into the session scratchpad. Each artifact was packed in memory and passed to `verifyExplorerPackage`. Nothing was copied into this repository.

| Artifact | Result | Files | H-10 rows | BHP / SRT | Relations |
|---|---|---|---|---|---|
| TRIPPET SWD v5 (`…uic000109605-b7628a71…`) | accepted | 66 | 16 | 0 / 0 | 67, SHA-256 `40ef1b1c9fd7c7fae5807d88188240b2d914303d98d0da37428e946c5248d9f1` (matches Explorer) |
| TRIPPET SWD v4 (`…uic000109605-70983258…`) | accepted | 65 | 16 | 0 / 0 | none |
| Barbaro 23 v4 (`…uic000125182-d04894d1…`) | accepted | 65 | 31 | 4 / 1 | none |
| TRIPPET v5, one byte flipped in `evidence_relations.json` | rejected: "Explorer evidence hash or byte count mismatch: evidence_relations.json" | 66 | | | |
| TRIPPET v5 plus an undeclared `notes.txt` | rejected: "Explorer package has missing or undeclared files" | 67 | | | |

No per-test values from real artifacts appear in this record.

## Review

- **Opus task review.** Spec ✅, quality ✅. Critical 0, Important 0, Minor 4.
  - Minors 1, 3 and 4 were fixed in fix round 1:
    - Minor 1: sidecar identity checks;
    - Minor 3: a tighter error-path test, plus a builder-error case;
    - Minor 4: a full `deepEqual` against v4.
- **Sonnet scoped re-review.** All three fixes confirmed. No regression against Explorer's `sidecar()` and `normalizeWellbore` at `b67fe5c`, including the not-queried shape (reasoned from code). New findings: 0.
- **Final review.** The single task covered the whole branch diff, so the Opus task review also served as the final whole-change review.

## Known limits (rulings)

- `casing.json`, `plugging.json`, their CSV files and `wellbore_dictionary.json` are checked against their declared hashes and, after fix round 1, for internal consistency with the acquisition. They are not re-derived from raw rows, in v4 or v5. Wellbore relations therefore inherit that trust level. Explorer's recipe accepts this.
- Only the last (v5) limitation is pinned. The earlier v4 limitations are displayed as provided ("Source limitations"), as they were for v4 before this change.
- The v5 case where the wellbore was never queried (`sourceApiId` null) has no synthetic test, because the v4 helper requires an 8-digit API. By code reading, which the re-reviewer confirmed, the receiver accepts the producer's not-queried sidecar shape: null source API ids and empty rows.
- Any v2 or legacy manifest that declares `evidence_relations.json` is refused (stricter than v4-only; the legacy pin is fixed bytes).

## Two-window walkthrough with Explorer (2026-10-31, after merge)

Analytics served main 227ebab locally on http://127.0.0.1:4290. Explorer served its unpushed branch phase6/v5-gate (allow list 2, 4 and 5) on http://127.0.0.1:4391, and the Explorer session drove both windows. Explorer's `src/relations.mjs` on its main is still `88b43327…a648`, matching our pin.

| Step | Result reported by Explorer |
|---|---|
| TRIPPET SWD v5 (`…b7628a71…`), two-window transfer | Validated and adopted. rrc-odp-v2.3.0. The package SHA-256 `6bffedb175d236017b881f46bd742d91ece3a389df11c4fcff030340ad36e881` is identical to the TAR Explorer's server returns. Manifest `89586fc1…6308`, normalized `73084284…aeda`. 63 verified files: the 66 package files minus manifest, normalized and version-pins. 16 monthly rows. |
| Barbaro 23 v4 (`…d04894d1…`), two-window transfer | Validated and adopted. rrc-odp-v2.2.0. Package `d92ae4fd…`, manifest `aada0de5…`, normalized `08614422…`, 62 files: identical to the 2026-10-30 walkthrough. |
| Tampered v5: one byte changed in `evidence_relations.json`, manifest unchanged, manual import | Refused: "Explorer evidence hash or byte count mismatch: evidence_relations.json. Your current dataset and stored pin are unchanged." |
| Tampered v5, re-hashed: same edit, with manifest.files, normalized.manifest and both version-pins hashes updated | Refused: "evidence_relations.json contradicts its re-derivation from package records and sources." |
| Explorer v3 (`a8606089`) | Transfer stays disabled on Explorer's side ("…accepts query versions 2, 4 and 5 and the original pinned version (ADR 005)"). |

The edit changed `scope.source_api_id` from 38934609 to 38934608.

Each page loaded resources only from its own origin. The Analytics server was stopped afterwards.

Not covered: a v5 package where the wellbore was not queried (no real one exists, and making one needs a new acquisition run), hosted transfer and screen-reader checks.

## Query-version-2 and legacy-pin check (2026-11-02)

Explorer's reviewer noted that neither walkthrough had sent a query-version-2 package, and that the legacy pin had last been checked against b48ce03. Analytics served main 9f2ce40 on http://127.0.0.1:4290. That commit contains the same receiver code as 227ebab: `git diff 227ebab 9f2ce40` touches only this record. The Explorer session drove the check.

| Step | Result reported by Explorer |
|---|---|
| v2, UIC 000020838 (`7aecd619`), two-window transfer | Validated and adopted. rrc-odp-v2.0.0, 25 verified files. Package `69a93781…`, manifest `7271eb48…` and normalized `50c4acc8…` all match Explorer. |
| Legacy pin `rrc-2026-10-09-uic000020838-v1` | Validated and adopted. rrc-odp-v1.0.0, 11 files. Package `492ebaa6…` (the same as on 2026-10-30), manifest `3a523cad…`, normalized `4f243138…`. |

Each page loaded resources only from its own origin. The server was stopped afterwards.

This completed Explorer's RRC-17 acceptance set on 227ebab. Explorer merged its sender gate as texas-rail-sync main `0933590` (PR #15). It offers query versions 2, 4 and 5 plus the legacy pin; v3 and unknown versions stay local. Any future v5 byte change becomes query version 6, and Explorer announces it to Analytics first.
