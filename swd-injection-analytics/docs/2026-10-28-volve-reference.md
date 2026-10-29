# External reference: Volve Operational Intelligence (pattern only)

Date: 2026-10-28. Owner decision D17 (`../../docs/project-2-decisions-2026-10-20.md`).

PRD v1.1 cites `gabrielserrao/spe-2026-challenge` ("Volve Operational Intelligence", Equinor Volve data, SPE GCS 2026 ML Challenge). It is licensed GNU GPL v3, and its README notes an AGPL-3.0 PyMuPDF dependency. It was reviewed on 2026-10-17 (`../../docs/project-2-prd-v1.1-review-2026-10-17.md` §4).

**It is used as a pattern reference only. No code, markup, styles or data from it are copied into this repository.**

## What was looked at

| File | Observation |
|---|---|
| `correlation.py` | Matches wells by name with a regex. |
| `pressure.py` | TVD only; stride-decimates to 300 points per well; rounds to 4 dp. |
| `CorrelationCanvas.tsx` | Plain SVG with a scroll-synced header and body; depth range hard-coded to 0–5,000 m and axis to "m MD"; data keyed by well name. |
| `CasingTrack.tsx` | A missing bottom gives NaN coordinates; a missing OD falls back to half the maximum width. |

## Ideas that may be reused (re-implemented from scratch)

- A shared depth axis with one column per well.
- Track presets keyed by id.
- A header/body split for a sticky axis.
- A per-well evidence shape: identity, optional trajectory, intervals, markers, points.

`src/pressureSupportChart.ts` already draws hand-built SVG, so none of this needs a new dependency.

## Not reused

Name matching, stride decimation, the hard-coded depth range and basis, NaN for missing data, and the server stack (Neo4j, LangGraph, FastAPI, Next.js). Several of these contradict this repository's rules: gaps are preserved with no decimation (D16), and unknown depths stay unknown (E11).

## Licensing

Copying nothing creates no GPL obligation. By contrast, this repository *does* ship GPL source on purpose: the pyResToolbox snapshot used by `src/brinePvt.ts` retains its license and file hashes (`license:'GPL-3.0-or-later'` in its provenance; ADR 001). If any Volve code were ever wanted, it would need its own license review first.
