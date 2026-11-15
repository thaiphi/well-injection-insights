# Phase 3b: ANA-E07 multiwell interference screening — design

Date: 2026-11-15. Issue: thaiphi/well-injection-insights #8 (PRD `docs/project-2-swd-injection-analytics-expansion-prd.md` §4, ANA-E07).

**Status.**
- The purpose, the inputs and the build order are the owner's.
- The rest follows an independent Fable recommendation, which the owner accepted, including owner calls A–C below.
- The owner approved this document as a whole on 2026-11-15, after the builder check and owner call D.

**Deliverable.** This document is the design only. The owner chose to build #7 and #8 together later, sharing one calculator, under a separate go-ahead. Merging this document does not close #8 and is referenced as "Refs #8".

## Why

**Purpose (the owner's words):** "find out which nearby wells matter".

**What that means here:**
- The user supplies a list of nearby disposal wells.
- The tool ranks them by how much pressure each could add at the user's well (the *subject well*), under both "connected" and "not connected" assumptions.
- The result is a screening ranking, not a pressure forecast.

**Two halves of "which matter":**
- **Ranking candidates** is this issue.
- **Finding candidates**, the map search for nearby wells, is out of scope: no map and no computed distances (D14). Explorer has deferred GIS/area-of-review work, and it will not supply between-well distances (`docs/project-1-explorer-data-availability-2026-10-17.md`). The user brings the list.

**PRD rule:** being close is not being connected. The tool never decides connectivity.

## Owner decisions

| # | Decision |
|---|---|
| Purpose | Rank a user-supplied list of nearby wells by the pressure each adds at the subject well; finding candidates is out of scope. |
| Inputs | Each nearby well's history is its own Explorer single-UIC package, picked by the user. Distance is typed by the user and labelled *assumed*, until Explorer adds coordinates. The interval or zone is shown as reported, with an unknown depth basis. |
| Order | Design #8 now; build #7 and #8 together later, sharing one calculator. |
| A | Real H-10 rates may be a model input **for offset wells only**. The subject well stays on its #7 schedule (typed or copied forecast). This lifts #7's "no real H-10 input" only for offsets. |
| B | The subject well's reservoir pressure must carry a user-stated **"pressure as of" month**. Without it, the tool shows only "rise above undisturbed pressure" and makes no limit comparison. |
| C | **#8 builds the multi-package loader** (several single-UIC packages, hash-verified, one-way per D18). #9 reuses it and adds linking to case wells. |
| D | **Several packages per well.** One package covers at most 36 months. A well may have several packages whose windows do not overlap; the app joins them into one history. Months between windows are gaps. A typed prior rate is still allowed before the earliest window. (Owner, 2026-11-15, after the builder check: "ok" to the recommended option.) |

## Goals

1. **Load nearby wells:** load packages for 1–10 offset wells next to a disposal case, with up to 20 packages per well (owner call D). The 10 and the 20 are my call.
2. **Per offset well, the user states:**
   - distance to the subject;
   - connected or not connected;
   - what happens after its reported history ends;
   - rates for any gap months.
3. **Rank the offsets** by the pressure each adds at the subject well at a month the user chooses. Show each well's share of the connected total.
4. **Show three views side by side:**
   - **All assumed connected:** the upper screening case.
   - **Your selection.**
   - **None:** the subject well alone, equal to #7.
5. **Report the first month the subject's limit is reached** (subject's own buildup plus connected offsets), and which offsets move that month.
6. **Sensitivity:** say whether the ranking order changes when diffusivity (k, c_f) and each typed distance go to their low and high values.
7. **Export** sealed JSON and CSV that carry every assumption, status and scenario.

## Non-goals

- **Finding nearby wells:** no map, no candidate search, no computed or GIS distances (D14). Coordinates may replace typed distances later, if Explorer adds them; that is a separate change.
- **Inferring connectivity:** no overlap score, no badge, no pre-selection.
- **Reservoir edges for interference:** infinite-acting only. A closed boundary for off-centre wells would need image wells, which is a new model.
- **Fitting to data, or calibration.**
- **Feeding the disposal engine:** nothing feeds back into `buildDisposalCase`.
- **Linking packages to case wells,** which is #9.
- **A new navigation tab** (D19).

## Anti-goals (a failure even if it works)

- **A not-connected well shown as 0 psi.** It shows as "excluded by assumption".
- **A gap month, a missing package or an unknown period treated as zero injection.**
- **Connectivity decided or suggested by the tool,** for example from distance, interval or field.
- **A ranking presented as a pressure forecast,** or wording that implies safe, permitted, sustainable, calibrated, validated or proven. The banned-word test from E05 and #7 applies.
- **Past offset injection counted twice:** once in the subject's declared reservoir pressure, and again as an added rise.
- **Skin applied to an offset well's contribution.**

## Amendments to the #7 design (the shared calculator)

These are stated here and noted in the #7 spec:
1. **Unit response at any distance.** The line-source unit response is exposed at any distance r ≥ r_w, not only at r_w and for the distance curve.
2. **Schedules up to 600 months for offset histories.** One Explorer package covers at most 36 months (`web/explorer-evidence.mjs`), so long offset histories come only from typed prior rates or several packages per well (owner question D). The subject schedule keeps 1–120 months. The 600 is my call.
3. **Subject-wellbore terms only.** Skin, the effective radius and the t_D ≥ 100 guard apply only at the subject's own wellbore. Offset contributions use the plain line source at the typed distance. Their validity is the line-source condition at that distance, which monthly steps satisfy at any distance the floor allows.
4. **Real H-10 rates as input** for offset wells only (owner call A).

## Model

**Assumptions (shown on screen and in exports):**
- One shared, homogeneous, infinite-acting layer, with #7's k, h, φ and c_f.
- Fluid properties from the subject well's disposal case.
- Every connected well injects into that same layer.
- Single-phase, slightly compressible flow.
- Linear superposition in space and time.

**Pressure rise at the subject well:**

    Δp_subject(t) = Δp_own(t)  [#7, with skin]
                   + Σ over connected offsets i of  Σ_j (q_i,j − q_i,j−1) · u(d_i, t − t_i,j−1)

where u(r, t) is #7's line-source unit response at distance r, without skin.
- Offsets use the subject's B and μ.
- Reported bbl is treated as STB, with one stated assumption: "reported bbl/day treated as STB/day; Bw from the subject's fluid".

**Distance:**
- Typed in ft, labelled *assumed*.
- Floor: 100 · r_w of the subject (blocked below).
- Ceiling: 50 miles.

**Pressure "as of" (owner call B):**
- The subject's declared reservoir pressure P_i is taken as of a user-stated month t_ref.
- The added offset rise is reported **since t_ref**: `Δp_offsets(t) − Δp_offsets(t_ref)`, computed from each offset's full history.
  - The part already inside P_i is not counted again.
- The subject's own schedule must start the month after t_ref; any other start is blocked with a message.
- **The subject's own injection before t_ref** may be typed as one assumed prior rate and start month. Without it, the stated assumption is "the subject's own injection before t_ref is not modelled". Main's call after the builder check.
- **Without t_ref:** results show "rise above undisturbed pressure" for each well and in total, with no absolute pressure, no limit line and no limit month.

## Offset-well history (H-10 packages)

**Rate per month:** the package's `calculated_calendar_day_avg_bpd`. Steps are calendar months, as in #7.

**Coverage is the package's acquisition window** (`scope.startMonth` to `scope.endMonth`; the pinned legacy package uses its fixed scope), not its first and last rows. Main's call after the builder check: "before" and "after" are measured from the window, so a missing month inside the window is always a gap, never "after last report". With several packages for one well (owner call D), "the window" means the span from the earliest window's start to the latest window's end, and months between windows are gaps.

**Only calculation-ready packages load** (`calculationEligibility.ready` true; Main's call after the builder check). `validatePublicArtifact` already refuses repeated periods, so duplicate months never reach this tool, and there is no second, weaker eligibility path.

**How each month is classed:**

| Month state in the package | Treatment |
|---|---|
| Reported volume > 0 | that rate (*reported* volume, *calculated* rate) |
| Reported volume 0 | the app already labels this "shut-in or missing report". It is a **gap** unless the user ticks, per well, "treat this well's reported zero months as shut in" (no default); then it is a zero step. Main's call after the builder check. |
| Missing row or null volume inside the window | **gap**: the well is *incomplete* until the user types an assumed rate for each gap month (0 allowed, meaning shut in) |
| Before the window | **unknown**: see "History before the window" below. |
| After the window | the user chooses, per well: "shut in after last report", "hold the average of the last N reported months" (N typed, labelled "assumed, from reported months X–Y"), or "typed rate". **There is no default.** |

**History before the window (Main's call after the builder check; see owner question D).**
- The user may type one assumed prior rate and start month, labelled *assumed*.
- Without it, the well is marked **partial history: injection before the window start not included**.
- **Without t_ref**, the shown rise is a lower bound.
- **With t_ref**, the missing earlier injection can push the shown rise since t_ref either way, so the label reads "direction unknown". The well is still ranked, flagged.

**Status and ranking:**
- An *incomplete* well gets no number and no rank. It appears in the list as "incomplete: N gap months".
- The case status is *incomplete* while any connected well is incomplete.
  - The "all connected" view is *incomplete* if any loaded well is.
  - Wells marked not connected do not block "your selection".

**Ranking date:**
- The default is the last month covered by every loaded package, which needs no future assumption.
- A later date is allowed only after every connected well has a choice for "after its last report".

## Connected or not connected

- **Each offset well has a connected / not connected choice with no default.** The ranking does not run until each well has one.
- **Evidence shown beside each well, for display only:**
  - typed distance (*assumed*);
  - permitted injection interval, top and bottom, "as reported; depth basis unknown", where the package has it;
  - the months the package covers (its window).
  - No field number: packages do not carry one (Main's call after the builder check).
- **Nothing in the evidence changes the choice or ranks wells.**
- **Not connected** shows as "excluded by assumption" in every view and export.

## Outputs

**Ranking table**, for the chosen month and for each scenario view:
- **Columns:**
  - well (UIC, as in the package);
  - status (complete, incomplete, partial history, not felt yet, excluded by assumption);
  - added psi at the subject well;
  - share of the connected total;
  - typed distance.
- **Order:** connected wells with a number, by signed added psi (highest first), then the rest by status.
- **Signs:** with t_ref, an offset's rise since t_ref can be negative (falloff) and is shown as negative psi.
- **Share of the connected total** is shown only when every connected contribution is ≥ 0 and the total is > 0. Otherwise it reads "share not shown: mixed signs". Main's call after the builder check.
- **Labels:** "screening ranking under the stated assumptions; not a pressure forecast".

**Limit month** (only with t_ref):
- The first month that P_i + own rise + connected offsets' rise since t_ref reaches the subject's `limitPsia`. The search runs to the end of the subject's schedule.
- It needs an "after last report" choice only for connected wells whose window ends before the subject's schedule does. Not-connected wells need none.
- Shown for each view, and with each connected offset removed in turn ("removing well X moves it from M1 to M2").
- Labelled one at a time, not additive.

**Sensitivity:**
- k, c_f and each typed distance at user-typed low and high values (no defaults), one at a time.
- Reports whether the rank order changes, and the added psi range per well.
- Two wells whose added-psi ranges overlap are marked "order not distinguishable".

**Warnings:**
- **"Not felt yet":** distance exceeds the radius of investigation from that well's injection to the chosen month. This is information, not an error.
- **Below the distance floor:** blocked.
- **Incomplete history** and **partial history** (as above).
- **The subject's #7 run uses a closed boundary:** "interference uses the no-edge assumption".
- **Radius of investigation** of any offset passes a stated extent (the #7 optional stated extent).

**Exports:** sealed JSON and CSV, as in #7 and E05.
- SHA-256 over key-sorted canonical JSON.
- Recompute on verify, with exact hash plus 1e-9 relative numeric tolerance; re-verified before download.
- Contents:
  - per-well inputs, statuses and choices;
  - package IDs and manifest SHA-256s;
  - all three views;
  - sensitivity;
  - all labels.
- No package content beyond the monthly rates used and the reported interval values.

**Fixed closing line:** "Screening ranking from assumed reservoir properties and typed distances; closeness is not connectivity."

## Multi-package loader (owner call C)

- **What it loads:** the existing single-UIC Explorer package format (the `publicArtifact.ts` validation), up to 10 at once. Each is verified by its manifest SHA-256 and recorded by stable `artifactId`.
- **Direction:** one-way, Explorer to Analytics (D18).
- **Refusals:**
  - two packages for the same UIC whose windows overlap (owner call D). Packages for the same UIC with separate windows are joined in month order, and months between windows are gaps;
  - the same package (same `artifactId` or manifest SHA-256) loaded twice;
    - any package that fails validation (the existing refusal messages).
- **Storage:** loaded packages stay in the session only (D10, no saved cases).
- **#9** reuses this loader and adds linking packages to case wells.
- Never copy an Explorer artifact into the repo; test fixtures are fictional.

## Placement (my call)

- **Where:** a section inside the #7 panel in the Disposal capacity workspace, "Nearby wells (interference screening)", under the subject well's buildup results.
- **Why there:** it uses the same subject well, rock description and worker.
- **Before #7 has a subject well and rock:** the section reads "Set up the subject well's buildup first".

## Constraints

- **Determinism, and edits withdraw results and downloads,** as in #7.
- **Labels (E01, D12):**
  - offset volumes are *reported*;
  - rates and pressures are *calculated*;
  - distances, connectivity, gap and future rates, rock and t_ref are *assumed*.
- **Pressure basis (D8):** rises are basis-free. Absolute values are psia `bottomhole-absolute` at the subject's declared datum, as in #7. Offset wells' own pressures are not used.
- **Data:** fictional only in tests and evidence (fictional UIC `000000417` and other fictional UICs). No Explorer artifact in the repo. Screenshots showing real package values stay out of the repo, with hashes only, as in E05.
- **Preservation:** built with #7 under one reviewed layer (name chosen at plan time).
- **Checks:** direct Node paths only; the CR-byte rules as in #7.

## Benchmarks

These add to #7's ten. They are identities and independent methods, with no remembered textbook numbers.

1. **One offset at distance r** equals #7's pressure-against-distance value at r, for the same schedule.
2. **N wells** equal the hand sum, and the result does not depend on well order.
3. **Reciprocity:** A's effect at B equals B's effect at A, for equal rates and rock.
4. **Similarity:** the same r²/t gives the same rise.
5. **Late-time log difference:** the difference between distances r1 and r2 tends to `141.2055·qBμ/(kh)·ln(r2/r1)`.
6. **Independent point-source check** (PRD acceptance): Stehfest-inverted Laplace solution, or a radial finite-difference run, against the Ei result for a multi-step offset schedule.
7. **Incomplete, never zero:**
   - a gap month, missing package or unanswered "after last report" gives *incomplete*, never a number;
   - a reported zero is a gap until the user confirms it as a shut-in; after that it gives a falloff;
   - a missing month inside the window is a gap, never "after last report".
8. **Not connected and "none":** a not-connected well changes nothing, and the "none" view equals #7 alone.
9. **As-of subtraction:** with t_ref, the reported rise equals Δp(t) − Δp(t_ref) from the full history. Setting t_ref before every offset's first month equals the undisturbed rise.
10. **No skin on offsets:** changing the subject's skin changes the subject's own term only.

## Acceptance (from issue #8)

| Criterion | How it is shown |
|---|---|
| Benchmark independent point-source tests | Benchmarks 1–6 and 10 |
| Missing histories give incomplete status, not zero | Benchmark 7, plus browser evidence |
| Uncertainties and alternate scenarios in exports | All three views, sensitivity, statuses and every assumed label in JSON and CSV (tests) |

**Also required** (with #7, at build time):
- the full gate (`node scripts/check-all.mjs`);
- browser evidence at desktop and mobile widths;
- independent review, then QA, then the owner accepts the layer.

## Left to the builder (plan)

- **Module split.** A loader module, an offset-history module (month classes, gap filling, after-history choices) and an interference module on #7's unit response. The panel section and the worker follow the #7 and E05 patterns.
- **Ranking-date and chart layout** (D16: no thinning).
- **Sentence templates,** within the banned words.
- **How #7 and #8 split into plan tasks.**
