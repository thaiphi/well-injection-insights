# SWD Injection Analytics in the joint Zoomcamp submission

This page covers the Analytics half of the AI Dev Tools Zoomcamp final project. The submission README, the tracker (ZC-01 to ZC-10) and the system-wide Docker, CD and observability set-up live in [Texas RRC Explorer](https://github.com/thaiphi/texas-rail-sync).

## Section for the joint README

> **SWD Injection Analytics** (https://github.com/thaiphi/well-injection-insights, live at https://swdinjectionanalytics.lovable.app) is the analysis half of the system. Explorer collects and verifies public Texas Railroad Commission data for saltwater-disposal (SWD) wells. Its **Use in Injection Analytics** button hands Analytics a package whose hashes Analytics re-checks before using it.
>
> An engineer uses Analytics to answer: *how much water can my disposal wells take, and how sure am I?* It works through these steps:
> 1. **Forecast** produced water, and reconcile the forecast against reported volumes.
> 2. **Diagnose** reported H-10 injection history: gaps and zero months, which are never counted as zero injection.
> 3. **Estimate** injectivity (J) from test records.
> 4. **Reconcile** wellhead and bottomhole pressure.
> 5. **Build** a multi-well disposal capacity case.
> 6. **Read** "What the case says": history against forecast, uncertainty, and a summary.
> 7. **Link** each case well to its reported history ("Wells compared").
> 8. **Model** pressure buildup over time for one well from assumed rock. A "Nearby wells" section then ranks offset wells by the pressure each adds.
>
> Every result shows its assumptions and labels each value as reported, assumed or calculated. Exports are sealed with SHA-256 and recomputed when they are verified. These are screening calculations, not permitting or regulatory determinations.

## How Analytics meets each rubric criterion

| Criterion | Evidence in this repo |
|---|---|
| Problem description | [README.md](../README.md) and the PRD at `docs/project-2-swd-injection-analytics-expansion-prd.md` |
| Product spec and public tracker | One approved design per feature in [docs/superpowers/specs/](superpowers/specs/). Issues [#1–#10](https://github.com/thaiphi/well-injection-insights/issues) (`ANA-E00` to `ANA-E11`); #1–#9 are done. |
| Agent team spec | [AGENTS.md](../AGENTS.md) and the roles in [.claude/agents/](../.claude/agents/): engineer, QA and reviewer. The main session acts as orchestrator. |
| Context management | AGENTS.md plus modular docs: [HANDOVER.md](../HANDOVER.md), [migration/README.md](../migration/README.md), and the skills `preservation-layer` and `browser-check` in [.claude/skills/](../.claude/skills/). |
| Application | A browser app with a Lovable/TanStack hosting adapter. Each feature is built design first, then planned, implemented test-first by agents, independently reviewed, browser-checked by QA, and accepted by the owner as a preservation layer. |
| Testing | `npm test` (or `node scripts/check-all.mjs`) runs the full offline gate in one command. The engineering suite has 960 unit and integration tests, plus 248 carried numerical oracle comparisons. |
| Containerization | The repo-root `Dockerfile`. The whole system runs with one `docker compose` command from the Explorer repo. |
| Deployment | https://swdinjectionanalytics.lovable.app |
| CI/CD | [CI](../.github/workflows/ci.yml) runs the `test` and `docker` jobs on every PR and on every push to `main`. Dev updates automatically from `main` (Lovable preview); production is published by hand. Rollback is described in the README. |
| Observability, alert and on-call agent | These are on the Explorer side; see the texas-rail-sync ZC-05, ZC-06 and ZC-07 issues. |

## Demo walkthrough (about 3 minutes)

Use only the sample case and fictional data on screen. The sample case uses public TRRC records, with every gap filled by labelled synthetic inputs.

1. **Handoff (30 s).** In Explorer, open a well and press **Use in Injection Analytics**. Analytics opens and shows the package as hash-verified. Point out that nothing is trusted until it is verified.
2. **Sample case (30 s).** Choose the **Sample case** data source. Open the **Disposal capacity** workspace and calculate. Show the constraints table, the capacity envelope, and **What the case says**: history against forecast and the case summary.
3. **Wells compared (20 s).** Show the two sample wells. Each has its coverage, its gap months ("a gap is never zero") and its rate check.
4. **Pressure buildup (50 s).** In **Pressure buildup over time (assumed rock)**, do the following:
   - Pick a well, press **Load fictional example** (it is labelled "fictional example — not typical values") and choose a closed boundary.
   - Press **Copy this well's Base forecast allocation**, then **Calculate**.
   - Show the bottomhole curve against the limit, the first month at the limit, the "of which skin" share, the average rise and the hand-off note.
   - Change k: the result is withdrawn at once. Calculate again.
5. **Nearby wells (40 s).** Load two offset packages.
   - Run is refused until each well is marked connected or not; there is no default.
   - Type the distances and fill the gap months, then run. Show the three views side by side and the signed ranking.
   - Set **Pressure as of** to show the limit month and the effect of removing each well.
6. **Exports (20 s).** Download the JSON and CSV. Every value is labelled, the closing line says it is a screening estimate, and verification recomputes everything from the stored inputs.

**Engineering process (optional, 20 s).** Show one PR, for example [#22](https://github.com/thaiphi/well-injection-insights/pull/22). It has the design, the plan, a reviewed task per agent, QA evidence, the owner-accepted preservation layer and green CI.
