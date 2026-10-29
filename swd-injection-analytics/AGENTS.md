# Scope

Build only the agreed SWD Analytics demonstration: Nexus engineering reuse, synthetic produced-water forecasting/reconciliation, fictional injection curves/capacity, public Explorer artifact import, technical exports and the Project 2 expansion, each phase only after it is accepted under its own reviewed preservation layer (owner decisions: `../docs/project-2-decisions-2026-10-20.md`, which authorize no build by themselves). Screening charts on verified TRRC H-10 data are allowed, including panels for several user-selected wells inside the existing workspaces (no new navigation tabs), each from its own single-UIC package; a calibrated injectivity (J) comes only from qualifying test evidence such as UIC bottomhole-pressure or step-rate test results, never from H-10 monthly reports alone. The Explorer handoff is one-way, Explorer to Analytics. No permitting, GIS (maps or between-well distances), private operating fixtures or portfolio implementation.

Nexus source is the owner's local main checkout. Preserve source hashes, upstream reference tests, assumptions, pressure basis/datum and reported/synthetic/calculated distinctions. Graphify/Luna mapping supplements source inspection; numerical tests establish calculation evidence.

Run checks through direct Node paths. Do not use npm/npx shims, bare Python or Vitest in the restricted sandbox. Main owns integration and Git. Workers must not commit, push, revert other edits or expand scope.


## Coordination and delegation

This is the independent `swd-injection-analytics` repository. Read and explicitly apply [the shared delegation workflow](../phi-analytics/docs/swd-intelligence-lab/agent-workflow.md) before delegation. This entrypoint adopts those rules; the sibling portfolio's AGENTS.md is not automatically inherited.

Use this repository's verified absolute Git root in every seven-field brief; map relevant SWD requirement IDs or explain maintenance N/A, and specify allowed files/ownership and concrete acceptance checks. Main checks slots before dispatch/reactivation: at most two active subagents including Astra, with non-overlapping write ownership. Astra works at bounded design/contract and meaningful review checkpoints, then releases its slot.

Main retains coordination, integration, Git and final verification, checks root/target paths before separately authorized staging or committing, and relays useful results/blockers promptly. Workers never stage, commit or push. These are procedural safeguards; no scheduler or hook enforcement is established.

If the shared reference is unavailable, Main supplies an accessible copy before delegation; continue independent authorized work without silently dropping these safeguards.
