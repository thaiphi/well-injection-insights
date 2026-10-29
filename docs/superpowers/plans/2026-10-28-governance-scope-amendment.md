# Governance: Project 2 scope amendment (Phase A, layer 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Amend the protected scope line (`swd-injection-analytics/AGENTS.md:3`) and the product-spec purpose (`swd-injection-analytics/product-spec.md:13`) so the Project 2 expansion is in scope as the owner decided, and write the two Phase A design notes.

**Architecture:** The first data-only registry layer, `governance-scope`. It needs no checker change: a spec file lists the two changed originals, the approved documents and the index pin; `scripts/record-layer.mjs` archives before-bytes, then records the layer. The two design notes go under `swd-injection-analytics/docs/`, which the gate does not walk.

**Tech Stack:** Markdown; `scripts/record-layer.mjs` and `scripts/verify-preservation.mjs` from the layer-registry plan.

**Spec:** `docs/project-2-decisions-2026-10-20.md` (D1, D3, D5, D12, D14, D17, D18, D19); `docs/project-2-prd-v1.1-review-2026-10-17.md` §5 Phase A.

## Global Constraints

- **Precondition:** the `layer-registry` layer is accepted (`node scripts/verify-preservation.mjs .` → 0 violations).
- Both protected files are LF-only (CR count `0`, measured 2026-10-28). Confirm `0` after every edit.
- Change only the one sentence/paragraph quoted below in each file. Every other byte stays.
- D1: permitting stays out of this repository. D14/D18: no map, no between-well distances; the handoff is one-way, Explorer → Analytics. D19: panels inside existing workspaces, no new navigation tabs.
- This plan is pinned as an approved document. After acceptance it is frozen: track progress in the verification note, not by ticking boxes here (re-recording before acceptance absorbs edits).
- Claude builds to `pending-review`; the owner runs `accept` via `!`. No commit, push or merge without explicit instruction.
- Reviewer (D13): an independent read-only Claude Opus review.

## Review Focus

1. The amended line must not read as permission to calibrate J from H-10 data — wording check by the reviewer against D5.
2. The amendment must not read as permitting approval, a map, or between-well distances — wording check against D1, D14.
3. Archives must hold the pre-edit bytes — `record-layer.mjs <name> archive` runs before any edit and refuses to overwrite.
4. The decision record is pinned; editing it afterwards must fail the gate — checked in Task 3 Step 3. PRD v1.1 is not pinned by default, because the owner may still issue a v1.2 (decision record, "Still open" #2); if the owner settles v1.2 first, add it to `approvedDocs`. Every pinned document must be committed, or a fresh clone fails with `Approved document unavailable`.
5. A stray CRLF in either protected file changes its hash — CR count checked in Task 2.
6. The legacy test fixture must rebuild the pre-chain state for every path class: never changed; changed only by a hand-written layer; changed only by a registry layer; changed by both; a legacy new file changed by a registry layer — see "Ruling" below.

---

### Task 1: Spec file and before-archives

**Files:**
- Create: `migration/layer-specs/governance-scope.json`
- Create (generated): `migration/baselines/governance-scope-before/swd-injection-analytics/{AGENTS.md,product-spec.md}`

- [ ] **Step 1:** Create the spec:

```json
{
  "purpose": "Phase A governance: amend the scope line and the product-spec purpose for the Project 2 expansion (owner decisions D1, D3, D5, D14, D18, D19), and re-pin the two root gate tests whose fixtures now follow the registry chain.",
  "acceptanceEvidence": "demo/GOVERNANCE-SCOPE-VERIFICATION.md",
  "approvedDocs": [
    "docs/superpowers/plans/2026-10-28-governance-scope-amendment.md",
    "docs/project-2-decisions-2026-10-20.md"
  ],
  "changes": ["AGENTS.md", "product-spec.md"],
  "newFiles": [],
  "rootFiles": ["migration/layers/index.json", "tests/preservation-baseline.test.mjs", "tests/layer-registry.test.mjs"]
}
```

- [ ] **Step 2:** `node scripts/record-layer.mjs governance-scope archive` → `archived 2`. Confirm each archive's SHA equals the manifest entry for that path.

### Task 2: Amend the two protected files

**Files:**
- Modify: `swd-injection-analytics/AGENTS.md:3`
- Modify: `swd-injection-analytics/product-spec.md:13`

- [ ] **Step 1:** Replace `AGENTS.md` line 3.

Current:
> Build only the agreed SWD Analytics demonstration: Nexus engineering reuse, synthetic produced-water forecasting/reconciliation, fictional injection curves/capacity, public Explorer artifact import and technical exports. No permitting, GIS, private operating fixtures or portfolio implementation.

Proposed:
> Build only the agreed SWD Analytics demonstration: Nexus engineering reuse, synthetic produced-water forecasting/reconciliation, fictional injection curves/capacity, public Explorer artifact import, technical exports and the Project 2 expansion, each phase only after it is accepted under its own reviewed preservation layer (owner decisions: `../docs/project-2-decisions-2026-10-20.md`, which authorize no build by themselves). Screening charts on verified TRRC H-10 data are allowed, including panels for several user-selected wells inside the existing workspaces (no new navigation tabs), each from its own single-UIC package; a calibrated injectivity (J) comes only from qualifying test evidence such as UIC bottomhole-pressure or step-rate test results, never from H-10 monthly reports alone. The Explorer handoff is one-way, Explorer to Analytics. No permitting, GIS (maps or between-well distances), private operating fixtures or portfolio implementation.

- [ ] **Step 2:** Append to `product-spec.md` line 13 (the existing two closing sentences stay; shown for context).

Current:
> Live SCADA, autonomous operating recommendations, permitting/GIS and portfolio implementation are outside this repository's current work. P1/P2 engineering extensions remain in the approved full scope at their original priorities.

Proposed:
> Live SCADA, autonomous operating recommendations, permitting/GIS and portfolio implementation are outside this repository's current work. P1/P2 engineering extensions remain in the approved full scope at their original priorities. The Project 2 expansion ([PRD v1.1](../docs/project-2-swd-injection-analytics-expansion-prd.md), as amended by the [owner decision record](../docs/project-2-decisions-2026-10-20.md)) extends this purpose phase by phase: screening diagnostics on verified public TRRC H-10 data, including panels for several user-selected wells inside the existing workspaces, with no new navigation tabs, no map and no between-well distances. A calibrated J comes only from qualifying test evidence, and the Explorer handoff stays one-way. Each phase needs its own reviewed preservation layer and owner acceptance; the decision record alone authorizes no build.

- [ ] **Step 3:** CR count of both files is `0`; `git diff --stat` shows one changed line in each.

### Task 3: Record pending and verify

**Files:**
- Create: `demo/GOVERNANCE-SCOPE-VERIFICATION.md`
- Create (generated): `migration/layers/governance-scope.json`; `migration/layers/index.json` gains the entry

- [ ] **Step 1:** `node scripts/record-layer.mjs governance-scope` → `pending-review`.
- [ ] **Step 2:** `node scripts/verify-preservation.mjs .` → exactly one violation: `Layer governance-scope baseline is pending/not accepted after independent review`. `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs tests/layer-registry.test.mjs` → the layer-registry and preservation-baseline tests pass; the transfer live-root test fails with that same single pending violation until acceptance. The legacy fixture in `tests/layer-registry.test.mjs` takes the pre-registry bytes of `AGENTS.md` and `product-spec.md` from this layer's archives.
- [ ] **Step 3:** Tamper check in a scratch copy, not the repo: append one byte to `docs/project-2-decisions-2026-10-20.md` → `Approved document hash mismatch`; append one byte to `swd-injection-analytics/AGENTS.md` → `Unapproved original file bytes/hash: AGENTS.md`.
- [ ] **Step 4:** Write `demo/GOVERNANCE-SCOPE-VERIFICATION.md` with the commands, outputs, the before/after SHAs and the CR counts.

### Task 4: Design notes (no layer needed)

**Files:**
- Create: `swd-injection-analytics/docs/2026-10-28-e01-data-labels.md` (D12)
- Create: `swd-injection-analytics/docs/2026-10-28-volve-reference.md` (D17)

- [ ] **Step 1:** D12 note. Map every label in PRD §5 ("Data contracts and calculation prerequisites") to the existing classes, citing source lines: `ContentKind` in `src/importProfile.ts:3` (`synthetic`, `public-reported`, `measured`, `literature`, `assumed`) and `ValueClass` in `src/sampleCase.ts:6` (`trrc-public-record`, `calculated`, `derived-with-assumption`, `synthetic`, `raw-not-verified`). State that the PRD's snake_case list is not adopted (D12); a PRD label with no existing class is listed as "no class yet; to be added in the phase that first needs it", never invented here. Include the D8 rule: each imported record declares its pressure basis (psia/psig), and a record without one is blocked; the sample keeps its stated +14.7 psi conversion (`ATMOSPHERIC_PSI`, `src/sampleCase.ts:5`).
- [ ] **Step 2:** D17 note. Record that the Volve repository (GPL-3.0) was used as a pattern reference only and no code was copied; list what was looked at and what PRD v1.1 review §4 marked "not reusable" (name matching, stride decimation, hard-coded range and basis, NaN on missing data, the server stack). Note that copying nothing creates no license obligation, unlike the retained pyResToolbox source (`src/brinePvt.ts:24`, ADR 001).
- [ ] **Step 3:** `node scripts/verify-preservation.mjs .` still shows only the pending violation (the notes are outside the walked trees).

### Task 5: Independent review and owner acceptance

- [ ] **Step 1:** Dispatch the D13 reviewer (seven-field brief per `handover/context/agent-workflow.md`; absolute root `C:\Users\thai.phi\Downloads\python\portfolio\swd-injection-analytics\tmp\lovable-transfer\well-injection-insights`; requirement map: governance, D1/D3/D5/D14/D18/D19; read-only). Ask it to check the two wordings against Review Focus 1–2 and the notes against D12/D17.
- [ ] **Step 2:** Fix confirmed findings. A wording change after archiving is fine (archives hold before-bytes); re-run Task 3 Steps 1–2.
- [ ] **Step 3:** Owner runs `! node scripts/record-layer.mjs governance-scope accept "<owner>"`; then `node scripts/verify-preservation.mjs .` → 0 violations.
- [ ] **Step 4:** Commit only on explicit owner instruction.

## Ruling (2026-10-29): legacy test fixture re-pinned

**Found while executing Task 3.** After the two protected files were amended, 7 tests in `tests/preservation-baseline.test.mjs` failed with `Unapproved original file bytes/hash: AGENTS.md` / `product-spec.md`. Cause: a registry design gap. The legacy fixture builds originals from the live tree, except for paths in its two hard-coded lists (pressure-support and sample-tour UI), which it takes from their archives. Any registry layer that changes an original outside those lists therefore broke it. This is the first such layer.

**Fix.** `fixture()` now takes each original from: the pressure-support archive for its list, then the sample-tour archive for its list, then the **first** registry layer's before-archive for that path (walking `migration/layers/index.json` in order), and only then the live file. This is the same rule as `preRegistry()` in `tests/layer-registry.test.mjs`. The legacy lists stay first so they keep resolving to original bytes. Result: 66/66 again (RED 7 → GREEN).

**Same gap in `tests/layer-registry.test.mjs`.** Once the legacy test was re-pinned, 7 registry tests failed with `Reviewed added file hash/bytes mismatch: tests/preservation-baseline.test.mjs`. Their fixture copies live root files but rebuilt only the registry's own pins. Fix: the fixture copies every root file a live registry layer pins, and the fixture's first layer re-pins them (`liveRegistryRoots()`). Result: 43/43.

**Consequence.** This layer also re-pins `tests/preservation-baseline.test.mjs` (superseding its sample-minors pin) and `tests/layer-registry.test.mjs` (superseding its layer-registry pin) as root files. The accepted `layer-registry` record is not touched. Its "test file not edited" constraint applied to that layer's identical-outcomes proof, which is accepted and committed.

## Review fix (2026-10-29): AGENTS.md wording tightened before acceptance

The independent review was clean (no Critical or Important findings). Its top Minor was re-graded by effect, because `AGENTS.md` is the scope file every worker reads and any wording fix after acceptance needs a new layer. As first written, "the Project 2 expansion phases accepted in <decision record>" could be read as authorizing building now, and D18 and D19 appeared only in `product-spec.md`. The Task 2 proposed text above is now the tightened line:
- each phase is in scope only after its own reviewed layer is accepted, and the decisions authorize no build by themselves;
- panels go in the existing workspaces, with no new navigation tabs (D19);
- qualifying test evidence is named (UIC bottomhole-pressure or step-rate results, never H-10 monthly reports alone, D5);
- the handoff is one-way (D18).

The `product-spec.md` text is unchanged.

