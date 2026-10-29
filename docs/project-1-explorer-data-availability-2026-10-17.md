# Explorer (Project 1) data availability for Project 2

Answer from the `texas-rrc-explorer` Claude session, received 2026-10-17. It reflects Explorer main `dd48857` and the owner's Oct 17 decisions.

**Explorer's sources:**
- SPEC.md, src/sources.mjs, src/artifact.mjs (the data dictionary);
- docs/expansion-prd-2026-10-17.md (v1.1);
- the two review docs in Explorer's docs/, which are untracked.

Dataset facts come from data.texas.gov `/api/views/<id>.json` metadata, fetched Oct 17–18. No data rows were pulled for the new datasets.

**Status categories:**

| Status | Meaning |
|---|---|
| HAVE NOW | Already acquired and in the package |
| CAN HAVE | TRRC publishes it and Explorer could add it |
| WON'T HAVE | Not published, out of scope or not planned |

Explorer has its own E-numbers, which mean different things from Project 2's E10/E11/E02/E03.

**Owner decisions on the Explorer side (Oct 17) that constrain these answers:**
- Expansion is local-first.
- The allowed scope is being widened to bounded ODP wellbore and test records for explicitly selected wells. The amendment is pending, and nothing is built yet.
- Statewide refresh, GIS/AOR (Explorer E03) and multiwell collection (Explorer E07) stay deferred.
- Identity ADR 004 is pending. Under it, the API/wellbore domain links only through the inventory row's own `api_no`, and it never joins H-10.

## For E10 (multiwell assessment)

| # | Item | Status | Detail |
|---|---|---|---|
| 1 | Multi-UIC packages | WON'T HAVE (for now) | Multiwell collection is deferred (RRC-08 / Explorer E07). What is possible today is several single-UIC packages. Each has a stable artifactId (`rrc-YYYY-MM-DD-uic<UIC>-<uuid>`) and a manifest SHA-256; three public versions exist. |
| 2a | Well latitude/longitude | CAN HAVE, small effort | `latitude_nad83` and `longitude_nad83` are in the raw givw-z9t4 rows and kept in sources/, but they are not normalized: the dictionary has no coordinate fields. Adding them needs a dictionary addition and must not change the six v1 files. |
| 2b | Distance/geometry between wells | WON'T HAVE (now) | This is GIS/AOR (RRC-07 / Explorer E03), which is deferred; it will be NAD83 only if it comes. Don't assume 0.5 mi or 2 mi offset sets from Explorer. |
| 3 | Offset-well H-10 histories | CAN HAVE, partly | Only as separate single-UIC collections that the user explicitly selects. Each uses the same qq2j-f2zm path and is its own package. There is no automatic discovery of nearby UICs. |
| 4 | Well-key crosswalk | HAVE NOW / CAN HAVE / WON'T HAVE | See the breakdown below. |

**Crosswalk breakdown (item 4):**
- **HAVE NOW, per inventory row:** `uic_number`, `api_no` (an 8-character string), `lease_number`, `well_no_display`, `district`, `operator_number`, `field_number`.
- **CAN HAVE:** explicit UIC→API link evidence with a status of matched, none or ambiguous (ADR 004).
- **WON'T HAVE:** API used as a join key for H-10, or any fuzzy name matching. Leading zeros are kept, and IDs are strings.

## For E11 (depth-aligned context)

| # | Item | Status | Detail |
|---|---|---|---|
| 5 | Wellbore casing (G-1/W-2) | CAN HAVE, medium effort, after the scope amendment and ADR 004 | Dataset `u9m4-xnh6`, about 2.4M rows, updated monthly, keyed by `api_no` plus `record_sequence`. |
| 6 | Bottom location | CAN HAVE | Dataset `uumf-5r4y`, keyed by `api`, with `gis_lat27`/`long27` and `gis_lat83`/`long83`. It has no depths at all, so no MD/TVD. |
| 7 | Permitted injection interval | HAVE NOW (values) | `top_inj_zone`/`bot_inj_zone` → `permitted_top/bottom_depth_ft`. The depth basis (MD vs TVD, and the datum) is unknown: ODP has no field descriptions and nothing Explorer holds states it. Treat these as reported depths with an unstated basis. |
| 8a | Packer depth | CAN HAVE, small effort | `prod_casing_pkr_depth` is raw only; it could be normalized. Its basis is unstated. |
| 8b | Plugging (W-3) | CAN HAVE, after the amendment and ADR | Dataset `wfzn-9fje`, about 1.7M rows, keyed by `api_no` plus `record_sequence`. |
| 9 | Directional surveys, formation tops, log picks | WON'T HAVE | See the detail below. |

**Casing fields (item 5):** `csg_depth`, `toc`, `multi_stg_depth`, `cmt_sacks`, `csg_size`, `hole_size`, `total_depth_g1w2`, `completion_date`, `depth_reference`, `depth_reference_code`, `on_top_record`. The ODP metadata does not describe units (none of its columns has a description), so the units must be taken from the G-1/W-2 form instructions.

**Bottom location (item 6):** no TVD, elevation or KB datum exists in any of the 7 ODP UIC datasets.

**Plugging fields (item 8b):** `plug_top_depth`, `plug_bottom_depth`, `plug_cmt_sacks`, `total_depth_w3`, `w3_date`, `depth_reference`, `depth_reference_code`.

**Surveys and formation tops (item 9):**
- None of the 7 ODP datasets has surveys, deviation, TVD, or formation tops or log picks.
- The only structured RRC source is the statewide bulk Well Bore file, which is in EBCDIC format.
  - Its WBFORM segment holds one completed-formation name and depth.
  - Surveys appear only as a Y/N flag.
- That source is out of scope: the owner decided not to build a bulk parser for it.
- Explorer's depth view will show "reported depths" for a single well only. Multiwell formation correlation is out of Project 1.

## For E02/E03 (pressure diagnostics and J)

**Item 10, test datasets: CAN HAVE.**
- These are the smallest new connectors. They are keyed by UIC and are planned first once approved.
- They are summary inventories: one row per report, with no pressure series, no stabilization data and no document pointers.

**BHP test results, dataset `qxfy-wcfs` (about 581 rows):**
- Fields: `uic_no`, `report_id`, `tracking_no`, `test_sequence_no`, `report_conducted_date` (text), `report_received_date` (text), `bhp_psia`, `test_depth_ft`, `gradient_psi_ft`, `tested_formation`.
- There is no gauge-type or datum field.

**Step-rate test results, dataset `h54t-xnbi` (about 337 rows):**
- Fields:
  - identity and dates: `uic_no`, `report_id`, `tracking_no`, `srt_received_date` (text), `test_date` (text);
  - test details: `satisfactory_test`, `top_perf_ft`, `bottom_perf_ft`, `formation_tested`, `min_inj_rate_bpm`, `max_inj_rate_bpm`;
  - pressures and results: `isip_psig`, `formation_frac_press_psig`, `frac_inj_rate_capacity_bpd`, `surface_pressure_firc_psig`, `fracture_gradient_psi_ft`;
  - `comments`.
- Note the different bases: BHP results are in psia, step-rate results in psig.

## Item 11: hosted Explorer and a v2 handoff

- **Hosted URL:** https://texasrrcexplorer.lovable.app exists, but its data routes return 503 until the owner republishes the bridge fix. The fix is merged in PR #3 but not yet published.
- **Hosted guest collection** has been rolled back (it is off). Guest datasets have no Analytics handoff; that is out of scope.
- **A v2 handoff with hosted origins** is possible later (Explorer E06). It is blocked on:
  - (a) Analytics' v1 receiver acceptance of the existing 127.0.0.1:4391 → :4290 handoff (ADR 003), which has still not been run end to end;
  - (b) a negotiated, reviewed origin allowlist.
- **How new evidence would arrive:**
  - as additive sidecar files in `manifest.files`;
  - the six v1 files stay byte-unchanged;
  - `schemaVersion` stays 1 until the Analytics receiver tolerates extra files;
  - expect the manifest hash to change for new versions; old versions are never rewritten.

## Item 12: never assume any of these from Explorer

- That an absent monthly row means zero injection. It means "not acquired".
- That H-10 `inj_press_avg`/`max` is BHP. They are reported surface "psi"; their basis is set by the UIC manual.
- That `max_liq_inj_pressure` is an available pressure margin. It is a regulatory constraint.
- That calendar-day rates are observed daily rates.
- Coverage beyond the chosen 1–36-month window, or beyond the 1,000-row cap (Explorer refuses at the cap).
- Annulus pressure, original H-10 document revisions, scanned report links, or a "preferred revision". Duplicates and conflicts are kept quarantined, not resolved.
- AOR completeness, casing or cement integrity, compliance, or permit readiness. Flags will only ever say whether a record is present or absent.
- MD/TVD conversion, datum normalization, or NAD27 → NAD83 conversion.
- Any data licence: the ODP metadata states none.
