# One-click Explorer handoff — bounded delivery

Owner approval: October 11, 2026, 01:34:58 UTC. Inspection began 01:36:32 UTC. Fixed hard stop: **02:34:58 UTC**, unchanged. This record covers only Analytics; Explorer is owned by its separate thread. No commits, deployment, permissions, CORS, shared storage or server persistence were introduced.

## Workflow and contract

Explorer → selected version → Downloads → **Use in Injection Analytics** opens a new Analytics window. The transfer includes the **whole preserved version**, independently of Explorer filters. Analytics validates the TAR with its existing source/schema/fixture/hash checks, then compares the offered dataset ID, exact byte count, all three hashes, sorted inventory/history UICs and monthly coverage with the verified artifact. Only **Confirm & use this exact dataset** adopts it. Existing Analytics windows and cases are not reused.

The envelope is `swd-explorer-handoff`, version 1, with transfer UUID and fresh receiver-document UUID. Exact origins are Explorer `http://127.0.0.1:4391` and Analytics `http://127.0.0.1:4290`; the captured opener must be the message source. There is no received-URL fetch. TAR bounds remain 1,024–80,106,496 bytes inclusive, aligned to 512 bytes. Offer metadata is bounded to 200 characters per artifact ID and 10,000 UICs per list; incoming cancellation code/message limits are 64/1,024 characters. Outgoing codes use uppercase underscores (64 characters), and complete outgoing messages including fallback are capped at 500 characters for compatibility with Explorer.

The receiver requests bytes before reporting receipt progress. Offer, delivery and validation deadlines are 15/30/30 seconds. Preview has no adoption timeout. Cancellation, file fallback, source changes, navigation away from Sources & import, reload and opener closure invalidate the candidate. Late results cannot restore it. Reload creates a fresh document identity and requires a new producer action. Portable TAR import remains independent and available without Explorer running.

Acquisition origin is **user-initiated Explorer transfer**, separately from **public reported content**. Transport IDs accompany analysis JSON/CSV/SVG metadata; original hashes, source rows, coverage, units, assumptions and pressure limitations remain intact. This does not authenticate the original acquisition, merge sources, infer bottomhole pressure or enable engineering capacity from public history. Adoption is session-only and does not repin installed artifacts.

Requirements: SWD-04 public-history consumption; SWD-08 consistent technical exports; SWD-13 preservation of customer import; SWD-14 provenance and per-analysis readiness. This owner-authorized transport extension does not redefine the original CSV/XLSX requirement.

## Verification

- **PASS:** direct TypeScript no-emit and three browser-module syntax checks. Final isolated owning-app suite **313/313**, explicitly excluding `tests/server.test.mjs`.
- **COULD NOT RUN:** server listener test. A localhost listener check was previously denied in this sandbox; this task prohibits escalation and denied retries. Actual Analytics/Explorer pages responded through the supported browser. This is not a complete-suite claim.
- **PASS:** seven actual download/preservation checks. Returned TAR equals producer TAR byte-for-byte. All three hashes match verification. All 28 JSON rows match archive values/source identities. CSV reconstructs exactly, and SVG metadata equals JSON lineage.
- **PASS:** preservation of 161 pre-existing files: 158 unchanged; only `web/explorer-receiver.mjs`, `web/import-ui.mjs`, `web/index.html` changed. No missing originals. Reference fixtures, installed datasets, pins, calculations and old documents remain unchanged.
- **PASS:** real legacy and newer-version transfers; legacy whole version retained five inventory wells/28 months despite a Records filter; newer version retained its own 16 months January 2024–April 2025. Preview did not adopt. Keyboard Enter confirmed adoption; producer acknowledged confirmation. Portable preview/cancel preserved the demo. Missing opener showed fallback. Mobile preview contained document overflow. SPA navigation/Back and reload invalidated pending candidates.
- **Initial failures retained:** receiver unit test caught double cancellation (fixed); actual handoff caught progress before package request and incompatible cancellation status codes (both fixed, regression tests added, real replays passed). Two browser assertions failed because one required a particular cancellation phrase and another closed the shared opener before the intended timeout; exact observed states and corrected passing checks are retained. The first independent checkpoint stopped while the transport test file was still being written; subsequent independent focused gate passed. Evidence does not erase these earlier results.
- **PASS:** fresh reload with opener kept alive reached the 15-second offer timeout without restoring a candidate. Opener closure cleared pending candidates via cancellation. Corrected keyboard cancellation was accepted by both real apps. Existing adopted Analytics window survived the other transfers, navigation, reload and closure. Browser record contains **15 passing checks and four retained failed attempts/assertions**, with explicit resolutions; it is not an all-attempts-pass claim.
- **Download-tool interruption:** a browser call awaiting the Analytics/Explorer TAR downloads took approximately 32 minutes. It returned with both files present. No error, permission rationale or pending action was exposed in the tool response; no approval/escalation/retry was performed by Analytics.

Independent final review and remaining lifecycle evidence are recorded in the closeout below. Full product acceptance remains open, including SWD-11, inherited physics/correctness validation, comprehensive security/accessibility review and broader report scope. Popup-blocked and malicious-message behavior is tested with simulated windows rather than forced browser policy changes. Customer CSV/XLSX interactions were not freshly repeated in this transport-only pass; their regression tests passed.

## Evidence and changes

[Screenshot gallery](../tmp/handoff/index.html), [browser checks](../tmp/handoff/browser-checks.json), [gate commands and logs](../tmp/handoff/gates.json), [download/preservation checks](../tmp/handoff/evidence-checks.json).

New implementation: `web/explorer-handoff.mjs`. Existing receiver adds verified-offer comparison, subscriptions and distinct transport lineage. Existing import UI connects lifecycle cancellation and exports; import panel adds transfer status/fallback. New tests: `tests/explorer-handoff.test.mjs`, `tests/explorer-transfer.test.mjs`. No sibling writes.

Sol/high implemented transport and its deterministic tests with exclusive two-file ownership. Main implemented receiver/UI integration and actual browser/export verification. Astra/high independently reviewed read-only; final checkpoint below.

## Closeout

Completed before the unchanged hard stop. Astra/high independently executed the final focused tests (**55/55**) and reviewed the final message ordering, outbound code/message compatibility, screenshots and recorded lifecycle/download/preservation evidence. Both real compatibility defects are resolved; no remaining P1/P2 finding was identified within this scope. Browser actions were performed by Main and inspected by the reviewer, not independently repeated by Astra.

Final results: **313/313 nonnetwork regression tests**, type/syntax checks, **7/7 download/preservation checks**, and **15 passing browser checks**. Four original failed attempts/assertions remain visible with their resolutions. No pending permission request is exposed. The listener gate and broader product acceptance remain open as stated above. Temporary test tabs are closed; the adopted history and Explorer entry remain available. No new task or timebox is started.
