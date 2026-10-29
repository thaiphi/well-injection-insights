# Project 2 expansion: owner decisions

Date: 2026-10-20.

The owner's instruction was "go with your recommend", which accepts the recommendation on all 19 decisions. These were presented in the Claude Code session that day. They draw on:
- `docs/project-2-prd-analysis-2026-10-17.md` (D1–D13);
- `docs/project-2-prd-v1.1-review-2026-10-17.md` (D14–D19);
- `docs/project-1-explorer-data-availability-2026-10-17.md` (Explorer's answers).

The PRD is `docs/project-2-swd-injection-analytics-expansion-prd.md` (v1.1). These decisions do not authorize building anything by themselves. Each phase still follows the process: plan doc → review → owner baseline acceptance → merge, push and publish only on explicit instruction.

| # | Decision | Accepted outcome |
|---|---|---|
| D1 | Permitting workbook (E08) | Not in this repo. If it is ever wanted, the separate permitting project owns it, and Analytics supplies only reviewed engineering inputs. |
| D2 | Preservation-gate strategy | A one-time, data-driven layer registry, reviewed and accepted as its own layer. After that, one layer per phase. |
| D3 | PRD positioning | A standalone expansion PRD in this repo's `docs/`. The app's product-spec purpose is updated through a governance layer. |
| D4 | Order of work | Decoupled: Phase A, then Phases 1–2, start without Explorer. The hosted handoff (Phase 0′) runs when Explorer is ready. The first step toward it is an end-to-end test of the existing local v1 handoff (127.0.0.1:4391 → :4290; Explorer ADR 003), which Explorer needs before a v2 handoff. |
| D5 | Scope wording for real TRRC data | Screening charts on verified TRRC H-10 data are allowed, including views of several user-selected wells. A calibrated J comes only from qualifying test evidence. Both points go into the amended scope line. |
| D6 | Transient model (E06) | Design spec first, code later. The spec must add the wellbore radius r_w, an explicit skin treatment and a benchmark list. |
| D7 | What to ask Explorer for | First: the UIC BHP test results (qxfy-wcfs) and UIC step-rate test results (h54t-xnbi). Then casing (u9m4-xnh6), plugging (wfzn-9fje) and normalized coordinates and packer depth. Don't ask for multi-UIC packages or between-well distances; those are deferred on the Explorer side. |
| D8 | psig vs psia basis | Each imported record declares its basis, and records without one are blocked. The sample keeps its stated "+14.7 psi" conversion. BHP tests (psia) and step-rate tests (psig) are handled per record. |
| D9 | Real wells outside the physics limits | Block with an explicit reason: WHP < 100 psia, NaCl > 20 wt%, or TDS without a conversion. Extending the bounds is a separate, later, validated item. |
| D10 | Saved cases (E09) | Deferred. If it is ever built, browser-local save with digest verification comes first. |
| D11 | Hall-plot diagnostic | Not added. The recommendation was "only if the owner wants it", and the owner has not asked for it. |
| D12 | Data labels | E01 maps onto the existing `importProfile.ts` and `sampleCase.ts` classes. The PRD §5 snake_case list is not adopted. |
| D13 | Reviewer for each phase | One reviewer is named for each phase before dispatch. Default: an independent read-only Claude Opus review, as used for the last three layers. |
| D14 | E10 scope | Panels inside the existing tools for user-selected wells, each from its own single-UIC package. There is no map and no between-well distances, because Explorer will not supply those. **Open:** where the produced-water demand comes from (G28); without it, the multiwell capacity panel stays `not_ready`. |
| D15 | E11 data | A user-uploaded depth-evidence profile (casing, interval and test-point rows with a declared MD/TVD basis). Explorer will never supply surveys, TVD or formation tops. The "missing survey blocks conversion" rule applies only to aligning evidence depths; the traverse keeps its declared straight-slope assumption. |
| D16 | Chart thinning | None, which is current behaviour. PRD §8 #13 is reworded to "no decimation; gaps preserved; exports from result objects". |
| D17 | External reference | A design note under `swd-injection-analytics/docs/` records that the Volve repo (GPL-3.0) was used as a pattern only and no code was copied. |
| D18 | Handoff direction | One-way, Explorer → Analytics. "To/from" is removed from the E10 acceptance criterion. |
| D19 | Workspaces vs panels | Panels inside existing workspaces first. No new navigation tabs, which would edit protected files. |

## Still open

1. **D14 / G28:** the demand source for the multiwell capacity panel.
2. **PRD v1.1 edits:** the PRD text still says Phase 0 comes first, "to/from" handoff, "existing navigation state" for linked views, and §8 #13 as written. It needs a v1.2 to match D4, D16, D18 and G24. The PRD belongs to the owner, so the owner decides whether to make those edits or whether this record supersedes them.
3. **Phase A's scope amendment** edits files protected by the 182-file manifest (`swd-injection-analytics/AGENTS.md`, `product-spec.md`). It needs its own reviewed layer and owner acceptance.
