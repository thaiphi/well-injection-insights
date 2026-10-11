# Nexus friction source snapshot

Owner-authorized local engineering reuse for SWD-10. `serghides.ts` is an exact retained copy of `esp-nexus/src/utils/multiphaseFlow/serghides.ts`, SHA-256 `db934a2a0d850aa3375789e590ad1699fac9611157459a8bed1343da641bc4be` (2026-10-10).

The source returns **Fanning** friction; the new Darcy-Weisbach implementation explicitly converts it to **Darcy** friction (four times Fanning). Transition treatment and single-phase pressure integration are separately identified application code, not an extracted full Nexus VFP model. Nexus's producing oil/gas Beggs-Brill traverse is not treated as an injection validation oracle.

No root LICENSE was found in the inspected local Nexus checkout; no open-source license is inferred. This snapshot records owner-authorized local reuse only. The separate pyResToolbox PVT adaptation retains its existing GPL-3.0-or-later license, source hashes and standard-volume convention under `../pyrestoolbox-pvt/`.
