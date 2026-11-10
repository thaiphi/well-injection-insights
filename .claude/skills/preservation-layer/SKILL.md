---
name: preservation-layer
description: Use when a change touches a protected file of the Analytics app (anything recorded by migration/layers), when the preservation gate fails, or when a feature needs its own reviewed layer before merge.
---

# Record a preservation layer

The preservation gate (`scripts/verify-preservation.mjs`) byte-pins the protected files. An intentional change to them goes through one reviewed layer per feature. Main runs these steps; workers never touch `migration/`.

## Steps (repo root, direct Node paths)

1. **Spec.** Write `migration/layer-specs/<name>.json` (lower-case, hyphenated name):
   ```json
   {
     "purpose": "One sentence: what changes and why, with the issue number.",
     "acceptanceEvidence": "demo/<FEATURE>-VERIFICATION.md",
     "approvedDocs": ["docs/superpowers/specs/<date>-<topic>-design.md"],
     "changes": ["<protected app paths that change, relative to swd-injection-analytics/>"],
     "newFiles": ["<new app files to pin, relative to swd-injection-analytics/>"],
     "rootFiles": ["migration/layers/index.json"]
   }
   ```
   Pin a new repo-root file in `rootFiles` only if it is marked `-text` in `.gitattributes`; otherwise a Windows `core.autocrlf` checkout breaks the byte pin.
2. **Archive the before-image**, before editing any file in `changes`:
   `node scripts/record-layer.mjs <name> archive`
3. Make and verify the change (tests, carried oracles, browser evidence, independent review).
4. **Record as pending:** `node scripts/record-layer.mjs <name>`. Status is `pending-review`; CI fails until it is accepted, by design.
5. **Owner accepts.** The owner runs this themselves (Claude must not):
   `! node scripts/record-layer.mjs <name> accept "<owner name>"` then `! node scripts/verify-preservation.mjs .`
   Accept only succeeds if the live bytes still match the reviewed pending record.
6. If anything pinned changes after step 4, re-run step 4 and ask the owner to accept again.
7. Full gate: `node scripts/check-all.mjs` must pass before push.

## Pitfalls

- Never weaken, regenerate or hand-edit a baseline to make the gate pass.
- `web/import-ui.mjs` keeps exactly 4 CR bytes; every other changed or new file is LF.
- Pushing or merging needs the owner's explicit instruction; merge by fast-forward so recorded SHAs stay valid.
