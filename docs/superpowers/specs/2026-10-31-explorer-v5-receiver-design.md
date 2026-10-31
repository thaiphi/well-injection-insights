# Explorer query-version-5 receiver: design record

Status: owner approved in chat on 2026-10-31 (bounded change; no plan document). This record pins that design for the `explorer-v5` preservation layer.

## Goal

The Analytics receiver accepts Explorer query-version-5 packages: every v4 check, plus a byte-for-byte re-derivation of the one new file, `evidence_relations.json`. Relations are verified, not displayed. The adopted dataset and the Test records panel are unchanged from v4.

## Contract delta v4 → v5 (Explorer texas-rail-sync main `b67fe5c`)

- `manifest.scope.query_version` = 5, and `sources/acquisition.json` `scope.queryVersion` = 5. The 21 targets (same order), scope keys and 22 `manifest.sources` are identical to v4.
- `manifest.transformation_version` = `rrc-odp-v2.3.0` (v4 is `rrc-odp-v2.2.0`).
- `tests.json`, `casing.json` and `plugging.json` carry `scope.query_version` 5.
- `manifest.limitations` = the v4 list plus one appended string (Explorer `src/artifact.mjs:219`). Its last element must equal this text exactly:

  `evidence_relations.json lists typed relations derived at export from this version's own records and source files (ADR 004 §3); query version 5 queries exactly the version 4 targets. Relations assert exact string equality of source keys only; matched does not establish one physical wellbore, and no relation states casing, cementing, plugging, compliance or hydraulic communication.`

- `manifest.files` gains `evidence_relations.json`, declared last.
- Re-derivation uses Explorer `src/relations.mjs` at `b67fe5c` (SHA-256 `88b43327612adc584119ae430588151bd3a7394ff3919d159d83c3984795a648`; pure, no imports; catalogue `rrc-relations-v1`):

  ```
  buildRelations({artifactId: manifest.artifact_id, scope: acquisition.scope,
    inventory: normalized.inventory, monthly: normalized.injectionMonthly,
    testRows: {bhp, srt},                      // the receiver's own re-derived test rows
    wellboreRows: {casing: {link, rows}, plugging: {link, rows}},  // from casing.json / plugging.json
    sources: manifest.sources})
  ```

  Bytes = `JSON.stringify(result, null, 2) + "\n"`.
- Any future byte change in this contract becomes query version 6, and Explorer announces it first.

## Receiver changes

- New `web/explorer-relations.mjs`: a byte-identical copy of Explorer `src/relations.mjs` at `b67fe5c`. A test pins its SHA-256.
- `web/explorer-evidence.mjs`:
  - version 5 maps to `rrc-odp-v2.3.0`;
  - version 5 takes the v4 path for scope keys, targets, raw test rows, wellbore bounds and sources;
  - `boundedExplorerScope` accepts 5.
- `web/explorer-package.mjs`:
  - query version 5 is accepted;
  - the test-sidecar block runs for 4 and 5, with `tests.json` `scope.query_version` taken from the package version (it is no longer hard-coded to 4).
  - For v5 only:
    - `evidence_relations.json` must be the last key of `manifest.files`;
    - the last limitation must equal the string above;
    - the file is rebuilt with the recipe and compared byte for byte.
  - A v4 manifest that declares `evidence_relations.json` is refused.
  - The verified result carries `relations: {count, sha256}` for v5, and `null` otherwise.
  - Legacy-pin, v2 and v4 behaviour is unchanged.
- No interface change.

## Known trust boundary

`casing.json` and `plugging.json` are hash-declared but not re-derived from raw rows, in both v4 and v5. Wellbore relations therefore inherit that trust level. Explorer's recipe accepts this, and re-deriving the wellbore sidecars is out of scope.

## Tests

All tests use synthetic, in-memory data on UIC 000000417. No package is committed.

- The relations copy matches the pinned SHA-256.
- A complete v5 package verifies, yields the same test records as v4, and reports its relations count and hash.
- These are refused:
  - one byte flipped in `evidence_relations.json`;
  - the file edited and re-hashed in `manifest.files`;
  - the file present in the package but undeclared;
  - a v5 manifest without the file;
  - a v4 manifest declaring the file;
  - a v5 manifest whose last limitation is wrong.
- Every existing v2, v4 and legacy test passes unchanged.

## Real-package check

The real TRIPPET SWD v5 artifact (`artifacts/rrc-2026-10-30-uic000109605-b7628a71-03fe-4a16-928c-033353e1fce0` at `b67fe5c`) is extracted read-only into the session scratchpad with `git archive` and verified. Expected: 66 files, 16 H-10 rows, 67 relations, relations SHA-256 `40ef1b1c9fd7c7fae5807d88188240b2d914303d98d0da37428e946c5248d9f1`. Nothing from Explorer is copied into this repository except `relations.mjs`, which is code, not an artifact.
