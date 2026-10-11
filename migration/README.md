# Existing application transfer

The original SWD Injection Analytics working files are retained in `../swd-injection-analytics/`. The source manifest records 182 exact files, including all application modules, existing tests, public data pins, reference/vendor evidence, source licenses, recorded exhibit artifacts and the original-workbook PDF. Their source checkout had no commits; this import adds them after Lovable's scaffold history without rewriting either repository.

The outer TanStack scaffold remains the hosting runtime. Vite configuration calls `scripts/prepare-swd.mjs` before dev/build, compiles the exact nested TypeScript source with its 5.9.3 pin, and copies the existing web assets to their original root URLs. Only the HTML entry is placed at `/analytics/index.html`; the home route redirects there while retaining query/fragment navigation. Calculations, dataset state, imports, browser workers, charts and download handlers are unchanged. No iframe or replacement engineering UI is introduced.

## Runtime and cost boundaries

No database, authentication, Python service, Cloud backend provisioning or paid API is needed. Browser PDF generation remains bundled and offline; the original optional Python PDF script remains in the nested source. Existing scaffold development dependencies are installed locally to verify hosting. No Lovable AI build message or publish/deploy API is part of this transfer.

The original localhost-only Explorer postMessage contract remains unchanged and does not become a hosted two-app integration. Portable TAR-file import and the separate pinned public evidence path remain available. Changing cross-app origins is separate work. Static hosting response/header behavior must be verified on the actual preview; `_headers` expresses no-store/nosniff intent for hosts that support that format.

## Evidence exclusions

Original `node_modules`, generated `dist`, private environment/credential files, QA-only output PDFs, graph caches and the large local `tmp` tree are not uploaded. They remain unchanged in the original local checkout. Some historical documents link to local `tmp` verification screenshots/logs; those links are historical local evidence and are not represented as portable repository attachments. The retained numerical references, fixture archives, data/source hashes and formal workbook PDF are included. New transfer verification is recorded separately here.

## Acceptance boundaries

Passing transfer checks establishes source preservation and adapter compatibility, not whole-product engineering acceptance. Existing SWD-11 transient/layered/calibrated modelling, the broader parser/dependency audit and full two-app acceptance remain open. Original literature, fluid-domain, history and correlation limitations remain visible. A hosted preview must not be described as a released or calibrated field tool.
