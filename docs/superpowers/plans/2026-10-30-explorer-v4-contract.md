# Explorer query_version 4 contract delta for the SWD Analytics receiver

Read-only research, 2026-10-30, by a Claude Opus subagent for the Phase 1b plan. Producer read only via `git show 3cefa99:<path>`; the proof script lived in the session scratchpad and is not part of this repository.
- **Repo A (receiver):** `C:\Users\thai.phi\Downloads\python\portfolio\swd-injection-analytics\tmp\lovable-transfer\well-injection-insights\swd-injection-analytics`. Files: `web/explorer-evidence.mjs` (EV) and `web/explorer-package.mjs` (PK).
- **Repo B (producer):** `texas-rrc-explorer` at commit `3cefa99`. I read it only through `git show`/`git archive`.
- **Real v4 artifact:** `artifacts/rrc-2026-10-30-uic000125182-d04894d1-5c27-4392-b3f7-42a399c7fbe1` (UIC 000125182, API 10933820, 65 files = 62 manifest.files + manifest.json, normalized.json, version-pins.json).

**Empirical proof.** The script `scratchpad/proto/check.mjs` rebuilds every expected value below and compares it with the real v4 artifact, which was extracted to `scratchpad/b/`. All of the following hold:
- the acquisition scope (including key order) and the targets match exactly;
- every `.source.json` passes A's v2 `retrieval()` rule;
- the rebuilt `manifest.sources` equals the manifest (canonical comparison), and so do `manifest.scope` and `source_revisions`;
- the ordered key list of `manifest.files` matches exactly;
- `tests.json`, `tests_bhp.csv`, `tests_srt.csv` and `tests_dictionary.json` are **byte-identical** to the producer's functions;
- H-10 normalization with A's existing *v2 branch* reproduces `normalized.inventory`, `injectionMonthly` and `qualityReport`, and `createExplorerDictionary(…, true)` reproduces `data_dictionary.json`.

A's *current* code fails on this package. With `queryVersion 4`, `sourceScopeFlags` falls into the legacy branch and flags the inventory row `["source_scope:api_no_prefix","source_scope:uic_type_injection"]`. It also writes county `''` instead of `API county code 109`.

---

## 1. `sources/acquisition.json`: v4 compared with v2

The top-level keys are the same as v2, and the same values are required:
- `schemaVersion: 2` (still 2 in v4)
- `runId` (uuid)
- `mode: 'live_collection'`
- `testFixture: false`
- `status: 'succeeded'`
- `targets` (array of URL strings)
- `scope`

Producer gate (B `src/artifact.mjs:60`): `acquisition.schemaVersion!==2 || JSON.stringify(acquisition.targets)!==JSON.stringify(targets.map(t=>t.url))`. This is an exact ordered string array.

### Scope

B `src/sources.mjs:56-74`:
```js
export function boundedScope(uic,startMonth,endMonth){ ... return Object.freeze({queryVersion:2,monthlyUic:uic,startMonth,endMonth,monthlyStart:startMonth+'-01T00:00:00',monthlyEndExclusive:endExclusive,inventoryLimit:25,monthlyLimit:1000});}
export function boundedTestScope(uic,startMonth,endMonth){
 return Object.freeze({...boundedScope(uic,startMonth,endMonth),queryVersion:3,testReportLimit:1000});}
export function boundedWellboreScope(uic,startMonth,endMonth,apiNo){
 const sourceApiId=typeof apiNo==='string'&&/^\d{8}$/.test(apiNo)?apiNo:null;
 return Object.freeze({...boundedTestScope(uic,startMonth,endMonth),queryVersion:4,sourceApiId,wellboreLimit:1000,wellboreInventoryLimit:25});}
```
`targetsForScope` (sources.mjs:113-114) rebuilds the scope and requires `JSON.stringify(checked)===JSON.stringify(scope)`, so the key order is fixed as well.

**Exact v4 key set, in order:** `queryVersion`(4), `monthlyUic`, `startMonth`, `endMonth`, `monthlyStart`, `monthlyEndExclusive`, `inventoryLimit`(25), `monthlyLimit`(1000), `testReportLimit`(1000), `sourceApiId`, `wellboreLimit`(1000), `wellboreInventoryLimit`(25).

**Derivations:**
- `queryVersion`, `testReportLimit`, `wellboreLimit` and `wellboreInventoryLimit` are constants.
- The month fields are derived exactly as in v2 (same 1–36 month rule).
- `sourceApiId` is the selected inventory row's own `api_no` when it is an 8-digit string, otherwise `null`. The producer enforces this at B `artifact.mjs:95`:
```js
if(wellbore){const api=inventory[0].api_no;if(scope.sourceApiId!==(typeof api==='string'&&/^\d{8}$/.test(api)?api:null))throw ...'Selected inventory API changed'}
```
- A must derive the expected value as `rawInventory[0].api_no` (from `sources/candidate-inventory.json`) and must not trust `scope.sourceApiId`.

Real value: `{"queryVersion":4,"monthlyUic":"000125182","startMonth":"2023-10","endMonth":"2026-09","monthlyStart":"2023-10-01T00:00:00","monthlyEndExclusive":"2026-10-01T00:00:00","inventoryLimit":25,"monthlyLimit":1000,"testReportLimit":1000,"sourceApiId":"10933820","wellboreLimit":1000,"wellboreInventoryLimit":25}`

### Targets

B `sources.mjs:111-120`:
```js
const targets=acquisitionTargets.map(...)   // v2's 7, inventory/monthly URLs rebuilt exactly as A line 115-117
if(scope.queryVersion<3)return targets;
return scope.queryVersion===4?[...targets,...testReportTargets(scope.monthlyUic),...wellboreTargets(scope)]:[...targets,...testReportTargets(scope.monthlyUic)];
```
```js
// sources.mjs:96-110
export const testReportOrder=Object.freeze({bhp:'report_id,tracking_no,test_sequence_no',srt:'report_id,tracking_no'});
export const officialTestDocuments=Object.freeze([
 {name:'srt-guidelines.html',url:'https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/technical-review/step-rate-test-guidelines/'},
 {name:'bhp-permian-nto.pdf',url:'https://www.rrc.texas.gov/media/sm5bzzpg/nto-disposal-well-monitoring-reporting-requirements-in-the-permian-basin-12-19-2023.pdf'}
].map(Object.freeze));
function testReportTargets(uic){
 const query=order=>new URLSearchParams({'$where':`uic_no='${uic}'`,'$limit':'1000','$order':order});
 return [
  {name:'bhp-metadata.json',url:'https://data.texas.gov/api/views/qxfy-wcfs.json'},
  {name:'srt-metadata.json',url:'https://data.texas.gov/api/views/h54t-xnbi.json'},
  {name:'candidate-bhp.json',url:`https://data.texas.gov/resource/qxfy-wcfs.json?${query(testReportOrder.bhp)}`},
  {name:'candidate-srt.json',url:`https://data.texas.gov/resource/h54t-xnbi.json?${query(testReportOrder.srt)}`},
  ...officialTestDocuments ];}
// sources.mjs:75-95
export const wellboreOrder='record_sequence,id';
export const officialWellboreDocuments=[
 {name:'wellbore-wba091.pdf',url:'https://www.rrc.texas.gov/media/cx2i4xrm/wba091_well-bore-database.pdf'},
 {name:'form-w2.pdf',url:'https://www.rrc.texas.gov/media/sdbph42m/w-2-0114.pdf'},
 {name:'form-w3.pdf',url:'https://www.rrc.texas.gov/media/lw0bmny4/w-3p.pdf'}];
function wellboreTargets(scope){
 const query=new URLSearchParams({'$where':`api_no='${scope.sourceApiId}'`,'$limit':String(scope.wellboreLimit),'$order':wellboreOrder});
 return [
  {name:'casing-metadata.json',url:'https://data.texas.gov/api/views/u9m4-xnh6.json'},
  {name:'plugging-metadata.json',url:'https://data.texas.gov/api/views/wfzn-9fje.json'},
  ...(scope.sourceApiId===null?[]:[
   {name:'wellbore-inventory.json',url:lookupTarget({kind:'api',value:scope.sourceApiId}).url},   // givw-z9t4 ?$where=api_no='X'&$limit=25&$order=uic_number,api_no
   {name:'candidate-casing.json',url:`https://data.texas.gov/resource/u9m4-xnh6.json?${query}`},
   {name:'candidate-plugging.json',url:`https://data.texas.gov/resource/wfzn-9fje.json?${query}`} ]),
  ...officialWellboreDocuments ];}
```
That gives 21 targets in v4 (18 when `sourceApiId===null`), compared with 7 in v2. The ordered list is:
1. The 7 v2 targets.
2. `bhp-metadata`, `srt-metadata`, `candidate-bhp`, `candidate-srt`, `srt-guidelines.html`, `bhp-permian-nto.pdf`.
3. `casing-metadata`, `plugging-metadata`, then [`wellbore-inventory`, `candidate-casing`, `candidate-plugging`] when the API is present, then `wellbore-wba091.pdf`, `form-w2.pdf`, `form-w3.pdf`.

### What in A's `verifyRecordedExplorerEvidence` breaks for v4 (EV lines)

- **EV:106.** It requires `transformation_version==='rrc-odp-v2.0.0'`. v4 uses `'rrc-odp-v2.2.0'` (v3 uses `'rrc-odp-v2.1.0'`; see B `sources.mjs:10-15`). `provenance` = `{classification:'public_reported',basis:'recorded_official_acquisition_v2'}` and `testFixture:false` are unchanged in v4 (B artifact.mjs:130, 214).
- **EV:108.** `schemaVersion===2` still holds. No change.
- **EV:110-112.** The month checks still hold. No change.
- **EV:113-114.** `expectedScope` is hard-coded with `queryVersion:2` and lacks the four v4 keys, so it **fails**. Make it version-specific, as described above.
- **EV:115-118.** The target list holds only 7 items, so it **fails**. Append the test-report and wellbore targets.
- **EV:123.** The exact-one inventory and monthly cap rule is unchanged. Add the test-report bounds: `bhp`/`srt` are arrays of plain objects with `length < testReportLimit` (1000), matching the producer at artifact.mjs:104-105, which uses `>limit` → invalid and `===limit` → ROW_LIMIT.
- **EV:126.** `sourceScopeFlags` with `queryVersion:4` takes the **legacy** branch (EV:6 `===2`) and flags `api_no_prefix`/`uic_type_injection`, so it **fails**. Use `isBounded`. Add BHP/SRT rows: `row.uic_no===scope.monthlyUic` (producer artifact.mjs:156).
- **EV:128.** `manifest.scope` must change; see §2.
- **EV:129.** `sourceIds` needs `bhp`/`srt` (and wellbore ids for `snapshot_id`); see §3.
- **EV:137-141.** The source list must be extended; see §3. There is also a title bug at EV:139: `json(`sources/${kind}-metadata.json`)` works for bhp, srt, casing and plugging but **not** for `wellbore_inventory`, which the producer maps to `inventory-metadata.json` (artifact.mjs:82).
- **EV:142-158.** The selection and lookup checks are unchanged. In v4 the lookup is still the UIC lookup, and `lookup.json` keeps `schemaVersion:2`. The selection source entry spreads the whole sidecar, including `app_token_used:true` (see the real manifest). A already spreads the full `lookupMetadata`, so this works.
- **EV:160.** `source_revisions` is unchanged (still inventory and monthly only).

## 2. `manifest.scope` and the manifest's top-level keys

The producer starts from the v2 object (artifact.mjs:182), then mutates it in the v3 block (:194) and again in the v4 block (:205):
```js
manifest.scope={query_version:2,uic_number:scope.monthlyUic,start:scope.startMonth+'-01',end:`${scope.endMonth}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`,inventory_limit:25,inventory_returned:normalized.inventory.length,monthly_limit:1000,monthly_returned:normalized.monthly.length,pagination:'Complete bounded response below cap; no statewide coverage'};
// v3: manifest.transformation_version='rrc-odp-v2.1.0';manifest.scope.query_version=3;manifest.scope.test_report_limit=scope.testReportLimit;
// v4: manifest.transformation_version='rrc-odp-v2.2.0';manifest.scope.query_version=4;manifest.scope.wellbore_limit=scope.wellboreLimit;manifest.scope.wellbore_inventory_limit=scope.wellboreInventoryLimit;
```
Expected v4 value: A's EV:128 object with `query_version:4` plus `test_report_limit:1000, wellbore_limit:1000, wellbore_inventory_limit:25`. **There is no `source_api_id` in `manifest.scope`**; it appears only in `casing.json`/`plugging.json`. Real value: `{"query_version":4,"uic_number":"000125182","start":"2023-10-01","end":"2026-09-30","inventory_limit":25,"inventory_returned":1,"monthly_limit":1000,"monthly_returned":31,"pagination":"Complete bounded response below cap; no statewide coverage","test_report_limit":1000,"wellbore_limit":1000,"wellbore_inventory_limit":25}`. A's `requireSame` canonicalizes keys, so the order does not matter.

**Top-level keys.** v4 has `artifact_id, schema_version, transformation_version, real_history_status, scope, source_revisions, sources, documentation, files, limitations, selection, provenance, testFixture, normalized_payload_sha256, normalized_payload_hash_method`. This is **the same key set as the v2 fixture** `tests/fixtures/explorer-packages/public-uic000056484.tar`. I checked by reading `manifest.json` from the tar: v2 also has `selection`, `provenance` `{public_reported, recorded_official_acquisition_v2}` and `testFixture:false`. Only the legacy `data/explorer/manifest.json` (v1.0.0) lacks `selection`/`provenance`/`testFixture`.

The only v4 differences in manifest values:
- `transformation_version` is `rrc-odp-v2.2.0`.
- `scope` is extended (above).
- `limitations` gains 2 appended strings (index 4 is the BHP/SRT text from artifact.mjs:195; index 5 is the casing/plugging text from :206). A does not check `limitations` today, so this is optional.
- `files` gains extra entries (§3).
- `documentation` is unchanged (3 entries).
- `normalized_payload_hash_method` is the identical string (PK:172 matches).

## 3. `manifest.sources` in v4: an exact rebuild algorithm

### The producer's per-entry rule

`loadSource(name,kind)`, B artifact.mjs:72-86:
```js
const filename=name.includes('.')?name:name+'.json';
const metadataName=filename.replace(/\.[^.]+$/,'')+'.source.json';
... url must equal target url (query-param set compare), https, host in {data.texas.gov,www.rrc.texas.gov,webapps2.rrc.texas.gov}, http_status 200, retrieved_at parseable, retrieval.sha256===sha256(body)
const title=kind==='metadata'?JSON.parse(body).name:kind==='documentation'?undefined:JSON.parse(await read((kind==='wellbore_inventory'?'inventory':kind)+'-metadata.json')).name;
const source={snapshot_id:sourceIds[kind]??`${name}:${sha256(body).slice(0,16)}`,name,...(title===undefined?{}:{title}),kind,...Object.fromEntries(Object.entries(retrieval).filter(([key])=>['url','retrieved_at','http_status','last_modified','etag','sha256','bytes','testFixture'].includes(key))),sha256:sha256(body),bytes:body.length,raw_file:'sources/'+filename};
sources.push(source); bodies[source.raw_file]=body; if(dynamic)bodies['sources/'+metadataName]=metadataBytes;
```
`name` is the label. It has no `.json` but keeps `.pdf`/`.html`, so documentation `snapshot_id` looks like `uic-manual.pdf:<sha16>` and metadata looks like `bhp-metadata:<sha16>`. A's v2 `label` column already follows this.

### `sourceIds`

These are 16-hex prefixes of the raw response SHA-256 (artifact.mjs:70, 106, 120):

| kind | snapshot_id | title from |
|---|---|---|
| inventory | `givw-z9t4:<sha16 candidate-inventory.json>` | inventory-metadata.json `.name` |
| monthly | `qq2j-f2zm:<sha16 candidate-monthly.json>` | monthly-metadata.json `.name` |
| bhp | `qxfy-wcfs:<sha16 candidate-bhp.json>` | bhp-metadata.json `.name` ("RRC-UIC Bottom Hole Pressure Test Results") |
| srt | `h54t-xnbi:<sha16 candidate-srt.json>` | srt-metadata.json `.name` ("RRC-UIC Step Rate Test Results") |
| wellbore_inventory | `givw-z9t4:<sha16 wellbore-inventory.json>` | **inventory-metadata.json** `.name` |
| casing | `u9m4-xnh6:<sha16 candidate-casing.json>` | casing-metadata.json `.name` |
| plugging | `wfzn-9fje:<sha16 candidate-plugging.json>` | plugging-metadata.json `.name` |
| metadata | `<label>:<sha16>` | own body `.name` |
| documentation | `<label incl. ext>:<sha16>` | no `title` key |
| selection | `lookup:<selection.lookupSha256 sha16>` | no title; whole lookup-inventory.source.json spread (incl. `app_token_used`) |

### Order (verified: 22 entries)

The order follows the `loadSource` call order, which is **not** the target order:
```
// artifact.mjs:87  (v2 part, same as A EV:137)
candidate-inventory(inventory), candidate-monthly(monthly), inventory-metadata(metadata), monthly-metadata(metadata),
uic-manual.pdf, rrc-resources.html, uic-query-help.html (documentation)
// artifact.mjs:97  selection entry (as A EV:158) — position 8
// artifact.mjs:107 (v3+ test reports)
candidate-bhp(bhp), candidate-srt(srt), bhp-metadata(metadata), srt-metadata(metadata), srt-guidelines.html, bhp-permian-nto.pdf (documentation)
// artifact.mjs:123 (v4 wellbore)
[wellbore-inventory(wellbore_inventory), candidate-casing(casing), candidate-plugging(plugging)]  // only if sourceApiId!==null
casing-metadata, plugging-metadata (metadata), wellbore-wba091.pdf, form-w2.pdf, form-w3.pdf (documentation)
```

### Rebuild algorithm for A

1. Extend the `targets` table to 4-tuples `[file,url,kind,label]`. Add these new rows:
   - `bhp-metadata.json`/metadata/`bhp-metadata`
   - `srt-metadata.json`/metadata/`srt-metadata`
   - `candidate-bhp.json`/bhp/`candidate-bhp`
   - `candidate-srt.json`/srt/`candidate-srt`
   - `srt-guidelines.html` and `bhp-permian-nto.pdf`/documentation/same label
   - `casing-metadata.json`/metadata/`casing-metadata`
   - `plugging-metadata.json`/metadata/`plugging-metadata`
   - `wellbore-inventory.json`/wellbore_inventory/`wellbore-inventory`
   - `candidate-casing.json`/casing/`candidate-casing`
   - `candidate-plugging.json`/plugging/`candidate-plugging`
   - the 3 wellbore PDFs/documentation
2. Build the query-dependent URLs with `new URLSearchParams({...})` in exactly the key order `$where,$limit,$order`. The `$limit` value is the string `'1000'` for bhp/srt/casing/plugging and `'25'` for wellbore-inventory.
3. Compute `sourceIds` for all 7 data kinds. Compute the wellbore ids only when `sourceApiId!==null`.
4. For each file in the order above, run A's existing `retrieval(name,url)`. It is exact `metadata.url===url`, which is stricter than the producer's param-set compare and **passes on all 21 real sidecars**. Then build the entry with A's EV:140 expression, changing the title source to `({wellbore_inventory:'inventory'}[kind]??kind)+'-metadata.json'`. Insert the selection entry after the 7 base entries.
5. Run `requireSame(manifest.sources,expected)`.

### `manifest.files`

The real v4 package has 62 entries; the producer adds every loaded body in insertion order (artifact.mjs:175, 186, 199, 210). A does not check this key set today (PK:303-307 only requires the package file set to equal manifest files ∪ source raw_files ∪ {manifest, normalized, version-pins}). I recommend that A require the exact key set, which is verified to match:
- `inventory.csv, injection_monthly.csv, quality_report.json, data_dictionary.json`
- for each v2 source in load order: `sources/<file>` and `sources/<stem>.source.json`
- `sources/acquisition.json, sources/selection.json, sources/lookup.json, sources/lookup-metadata.json, sources/lookup-metadata.source.json, sources/lookup-inventory.json, sources/lookup-inventory.source.json`
- each test and wellbore source file plus its sidecar, in load order
- `tests.json, tests_bhp.csv, tests_srt.csv, tests_dictionary.json, casing.json, casing.csv, plugging.json, plugging.csv, wellbore_dictionary.json`

When the API is null, the `wellbore-inventory`, `candidate-casing` and `candidate-plugging` pairs are absent, but `casing.*`, `plugging.*` and `wellbore_dictionary.json` are still present (their status is `not_queried`, artifact.mjs:207-209).

## 4. H-10 normalization: places that differ for v4 and every hard-coded `2` in A

The producer's H-10 path is **identical for v2, v3 and v4**. B `normalize.mjs` uses `isBounded(scope)` (`queryVersion` 2, 3 or 4) where A uses `===2`:
```js
// B sources.mjs:7
export const isBounded=scope=>scope?.queryVersion===2||scope?.queryVersion===3||scope?.queryVersion===4;
// B sources.mjs:18-27 (bounded branch, now also covers bhp/srt and wellbore kinds)
 if(isBounded(scope)){
  if(kind==='bhp'||kind==='srt'){if(row.uic_no!==scope.monthlyUic)flags.push('source_scope:uic_no');}
  else if(kind==='casing'||kind==='plugging'||kind==='wellbore_inventory'){if(row?.api_no!==scope.sourceApiId)flags.push('source_scope:api_no');}
  else if(kind==='inventory'){if(row.uic_number!==scope.monthlyUic)flags.push('source_scope:uic_number');}
  else{ /* monthly: uic_no + [monthlyStart, monthlyEndExclusive) */ }
  return flags; }
// B normalize.mjs:24
  if(isBounded(scope)&&!str(r.api_no).startsWith('389')){row.county=`API county code ${...}`;row.county_basis='Original source API county prefix; county name not independently verified';}
```
- **Dictionary.** It is the same as v2 dynamic. The v4 block does not touch `data_dictionary.json` (artifact.mjs:185 sets the dynamic county definition under `isBounded`). The real v4 `data_dictionary.json` equals `createExplorerDictionary(canonical,true)`.
- **Quality report.** The shape and policies are unchanged. Test and wellbore quality never enter `quality_report.json`.
- **`real_history_status`.** The rule is unchanged (PK:320).
- **Payload hash method.** Unchanged.

Hard-coded v2 assumptions in A:

| Location | Current | v4 change |
|---|---|---|
| EV:2 | comment "bounded v1/v2 adapter" | cosmetic |
| EV:6 | `scope.queryVersion===2` | `isBounded(scope)` (2,3,4) or `[2,4].includes` if v3 stays unsupported; add `bhp`/`srt` (`uic_no`) and optionally `casing`/`plugging`/`wellbore_inventory` (`api_no===scope.sourceApiId`) branches |
| EV:43 | `scope?.queryVersion===2` county rule | same bounded predicate (real v4 row API 109… → `API county code 109`) |
| EV:80 | `dynamic` flag passed by caller | caller must pass true for v4 (PK:325 passes `dynamic`) |
| EV:106 | `transformation_version!=='rrc-odp-v2.0.0'` | per version: 2→`rrc-odp-v2.0.0`, 4→`rrc-odp-v2.2.0` (3→`v2.1.0`) |
| EV:113 | `expectedScope` `queryVersion:2`, no extra keys | §1 |
| EV:117-118 | 7 targets | §1 |
| EV:128 | `manifest.scope` `query_version:2` | §2 |
| EV:137 | 7-file source loop | §3 |
| EV:139 | `${kind}-metadata.json` | wellbore_inventory→inventory |
| PK:295 | `dynamic=manifest.scope?.query_version===2` | `[2,4].includes(...)` (keep v3 refused unless also built) |
| PK:306 | version-pins allowed only if dynamic | same for v4 |
| PK:345 | basis `'recorded_official_acquisition_v2'` | same string is correct for v4 (producer basis unchanged) |
| PK:347 | warning "Public monthly reported pressures are not BHP…" | still true; add a test-sidecar warning (BHP psia vs PSIG guidance conflict, not converted) if exposing tests |

## 5. `version-pins.json`

The shape is unchanged in v4. B `src/exportCore.mjs:63-65` writes it for every `isBounded` scope:
```js
built.files['version-pins.json']=JSON.stringify({schemaVersion:1,artifactId,path:`/artifacts/${artifactId}/`,manifestSha256:sha256(built.files['manifest.json']),normalizedSha256:sha256(built.files['normalized.json']),classification:snapshot.provenance.classification,realHistoryStatus:built.manifest.real_history_status},null,2)+'\n';
```
The real v4 file has exactly these 7 keys, and the hashes match. PK:312's `same(...)` works as written. No change beyond enabling the check for v4 (PK:306/311).

## 6. Test sidecars: the exact producer derivation

The sidecars are written only when `scope.queryVersion>=3` (artifact.mjs:55 `testReports`). They are built from the **loaded proof**, after the H-10 canonical normalization:
```js
// artifact.mjs:154-156
const canonical=normalize(proof.inventory,proof.monthly,proof.sourceIds,proof.scope);
const testRows=proof.tests?normalizeTests(proof.tests,proof.sourceIds,canonical.inventory,proof.scope):null;
if(testRows&&[...testRows.bhp,...testRows.srt].some(row=>row.quality_flags.some(flag=>flag.startsWith('source_scope:'))))throw ...'Test-report rows contradict the exact-UIC query'
// artifact.mjs:193-199
const scope=snapshot.scope,status=rows=>rows.length?'returned_below_cap':'confirmed_empty';
const tests={schemaVersion:1,artifactId,scope:{query_version:scope.queryVersion,uic_number:scope.monthlyUic,test_report_limit:scope.testReportLimit,order:`BHP ${testReportOrder.bhp}; SRT ${testReportOrder.srt}`,bhp_returned:testRows.bhp.length,srt_returned:testRows.srt.length,bhp_status:status(testRows.bhp),srt_status:status(testRows.srt),window:'exact uic_no; not limited to reporting period'},bhp:testRows.bhp,srt:testRows.srt,quality:testRows.quality};
const sidecars={'tests.json':JSON.stringify(tests,null,2)+'\n','tests_bhp.csv':testsCsv(testRows.bhp,'bhp'),'tests_srt.csv':testsCsv(testRows.srt,'srt'),'tests_dictionary.json':JSON.stringify(testsDictionary({testFixture:snapshot.testFixture,provenance:snapshot.provenance}),null,2)+'\n'};
```
- In v4, `tests.scope.query_version` is **4**: it is the true `queryVersion` (OD-2 in docs/superpowers/specs/2026-10-29-phase3-casing-plugging-design.md:184). The order string is `"BHP report_id,tracking_no,test_sequence_no; SRT report_id,tracking_no"`.
- `sourceIds.bhp` is `qxfy-wcfs:${sha256(rawBhpBytes).slice(0,16)}` and `sourceIds.srt` is `h54t-xnbi:…`, both computed over the raw file bytes.
- Raw bounds: both raw files are arrays with `length < 1000` (artifact.mjs:104-105).

### Row normalization

B `src/testReports.mjs`, verbatim; A can copy it nearly as is:
```js
export const testColumns=Object.freeze({
 bhp:Object.freeze(['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','tracking_no','test_sequence_no','report_conducted_date','report_conducted_date_text','report_received_date','report_received_date_text','bhp_psia','test_depth_ft','gradient_psi_ft','tested_formation','source_snapshot_id','quality_flags']),
 srt:Object.freeze(['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','tracking_no','srt_received_date','srt_received_date_text','test_date','test_date_text','satisfactory_test_code','top_perf_ft','bottom_perf_ft','formation_tested','min_inj_rate_bpm','max_inj_rate_bpm','isip_psig','formation_frac_press_psig','frac_inj_rate_capacity_bpd','surface_pressure_firc_psig','fracture_gradient_psi_ft','comments','source_snapshot_id','quality_flags'])});
const str=value=>value==null?'':String(value);
function dateField(value,flags,name){
 const text=str(value);
 if(value===undefined||value===null||text.trim()===''){flags.push(`missing:${name}`);return {date:null,text};}
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
 const valid=match&&Number(match[2])>=1&&Number(match[2])<=12&&Number(match[3])>=1&&Number(match[3])<=new Date(Date.UTC(Number(match[1]),Number(match[2]),0)).getUTCDate();
 if(!valid){flags.push(`parse_failure:${name}`);return {date:null,text};}
 return {date:text,text};}
const nonNegative=new Set(['bhp_psia','test_depth_ft','top_perf_ft','bottom_perf_ft','min_inj_rate_bpm','max_inj_rate_bpm','frac_inj_rate_capacity_bpd']);
function numbers(row,flags,names){
 const values={};
 for(const name of names){values[name]=numberField(row[name],flags,name);if(nonNegative.has(name)&&values[name]!==null&&values[name]<0)flags.push(`invalid_negative:${name}`);}
 return values;}
const identity={bhp:row=>`${str(row.report_id)}|${str(row.tracking_no)}|${str(row.test_sequence_no)}`,srt:row=>`${str(row.report_id)}|${str(row.tracking_no)}`};
function normalizeKind(kind,rows,sourceIds,byUic,scope){
 const seen=new Map();for(const row of rows)seen.set(identity[kind](row),(seen.get(identity[kind](row))??0)+1);
 return rows.map((r,i)=>{
  const flags=[],parents=byUic.get(str(r.uic_no))??[];
  const join=parents.length===1?'matched':parents.length===0?'unmatched':'ambiguous';
  if(join!=='matched')flags.push(`${join}:parent`);
  if(!str(r.report_id).trim())flags.push('invalid:source_report_id');
  if(seen.get(identity[kind](r))>1)flags.push('duplicate_report_identity');
  const common={source_row_key:`rrc:${kind}:${sourceIds[kind]}:${i+1}`,parent_key:join==='matched'?parents[0].source_record_key:'',parent_join_status:join,uic_number:str(r.uic_no),source_report_id:str(r.report_id),tracking_no:str(r.tracking_no)};
  let row;
  if(kind==='bhp'){
   const conducted=dateField(r.report_conducted_date,flags,'report_conducted_date'),received=dateField(r.report_received_date,flags,'report_received_date');
   const n=numbers(r,flags,['bhp_psia','test_depth_ft','gradient_psi_ft']);
   row={...common,test_sequence_no:str(r.test_sequence_no),report_conducted_date:conducted.date,report_conducted_date_text:conducted.text,report_received_date:received.date,report_received_date_text:received.text,...n,tested_formation:str(r.tested_formation)};
  }else{
   const received=dateField(r.srt_received_date,flags,'srt_received_date'),tested=dateField(r.test_date,flags,'test_date');
   const perf=numbers(r,flags,['top_perf_ft','bottom_perf_ft']),rate=numbers(r,flags,['min_inj_rate_bpm','max_inj_rate_bpm']),rest=numbers(r,flags,['isip_psig','formation_frac_press_psig','frac_inj_rate_capacity_bpd','surface_pressure_firc_psig','fracture_gradient_psi_ft']);
   if(perf.top_perf_ft!==null&&perf.bottom_perf_ft!==null&&perf.top_perf_ft>perf.bottom_perf_ft)flags.push('inconsistent:top_perf_exceeds_bottom');
   if(rate.min_inj_rate_bpm!==null&&rate.max_inj_rate_bpm!==null&&rate.min_inj_rate_bpm>rate.max_inj_rate_bpm)flags.push('inconsistent:min_rate_exceeds_max');
   row={...common,srt_received_date:received.date,srt_received_date_text:received.text,test_date:tested.date,test_date_text:tested.text,satisfactory_test_code:str(r.satisfactory_test),...perf,formation_tested:str(r.formation_tested),...rate,...rest,comments:str(r.comments)};
  }
  if(scope)flags.push(...sourceScopeFlags(kind,r,scope));
  return {...row,source_snapshot_id:sourceIds[kind],quality_flags:flags};});}
export function normalizeTests({bhp,srt},sourceIds,inventory,scope=null){
 const byUic=new Map();for(const r of inventory){const a=byUic.get(r.uic_number)??[];a.push(r);byUic.set(r.uic_number,a);}
 const rows={bhp:normalizeKind('bhp',bhp,sourceIds,byUic,scope),srt:normalizeKind('srt',srt,sourceIds,byUic,scope)};
 const counts=list=>({raw:list.length,parsed:list.length,accepted:list.filter(r=>rowDisposition(r)==='accepted').length,quarantined:list.filter(r=>rowDisposition(r)==='quarantined').length,excluded:0});
 const join=list=>({matched:...'matched'..., unmatched:..., ambiguous:...});
 const issues=list=>{const out={};for(const r of list)for(const flag of r.quality_flags)out[flag]=(out[flag]??0)+1;return out;};
 const dispositions=list=>list.map(r=>({source_row_key:r.source_row_key,disposition:rowDisposition(r),...(rowDisposition(r)==='quarantined'?{reasons:[...r.quality_flags]}:{})}));
 return {...rows,quality:{bhp:counts(rows.bhp),srt:counts(rows.srt),parent_join:{bhp:join(rows.bhp),srt:join(rows.srt)},issue_counts:{bhp:issues(rows.bhp),srt:issues(rows.srt)},dispositions:[...dispositions(rows.bhp),...dispositions(rows.srt)],
  duplicate_policy:'Every source row retained. Rows sharing a report identity (BHP report_id|tracking_no|test_sequence_no; SRT report_id|tracking_no) are all flagged duplicate_report_identity and quarantined; no preferred row is selected or merged.',
  empty_result_policy:'An empty exact-UIC response ([]) is recorded as confirmed_empty: no rows were returned by the query. It does not show that no test was conducted.'}};}
```
(The `join` line above is abridged: each of `matched`/`unmatched`/`ambiguous` is `list.filter(r=>r.parent_join_status===X).length`.)
- `numberField` and `rowDisposition` are the same functions A already has (EV:26-30 and EV:3; B `public/quality-validation.js:5-6` uses the identical regex).
- **Parent join:** each row joins to the canonical **normalized H-10 inventory** (`canonical.inventory`, i.e. A's `normalizeExplorerRows(...).inventory`) by an exact string `uic_no === uic_number`. `parent_key` is that row's `source_record_key` (`rrc:uic:givw-z9t4:<sha16>:1`).
- The `quality_flags` order is meaningful because arrays are compared in order. The order is: join, report_id, duplicate, dates, numbers (field by field: missing/parse_failure, then invalid_negative), the inconsistent flags (SRT), then source_scope.

### CSV writer

B `normalize.mjs:54`; `testsCsv=(rows,kind)=>csv(rows,testColumns[kind])`:
```js
export function csv(rows,columns){return columns.join(',')+'\n'+rows.map(r=>columns.map(k=>{const v=r[k];const s=Array.isArray(v)?v.join('|'):v==null?'':String(v);return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}).join(',')).join('\n')+(rows.length?'\n':'');}
```
- **Line endings:** LF only. The header is always followed by `\n`. Rows are joined by `\n` with a trailing `\n` only when there is at least one row, so an empty table is just `header\n`.
- **Quoting:** a cell is quoted only if it contains `"`, `,`, CR or LF, and embedded `"` is doubled.
- **Empty cells:** null/undefined become `''` (e.g. `isip_psig` null shows as `,,`), and an empty `quality_flags` array is `''` (a trailing comma at the end of the line).
- **Pipe join:** `quality_flags` uses `|`.
- **Numbers:** numbers use JS `String(Number(x))`. Raw `"1445.0"` becomes `1445`, `"0.0"` becomes `0`, `"0.6486"` becomes `0.6486`, and string ids stay verbatim (`test_sequence_no` `"1.0"` stays `1.0`).

Real example: `...,0,26.63,,1544,,,0.693,,h54t-xnbi:1b01c6acc0d29b92,missing:isip_psig|missing:frac_inj_rate_capacity_bpd|missing:surface_pressure_firc_psig\n`.

Because the producer's row objects have column-ordered keys and both CSVs and `tests.json` are byte-reproducible (verified), **A can compare bytes**: rebuild the strings and compare them with `decode(name)`. That is stricter and simpler than A's parse-and-compare per cell at PK:327-331. For `tests.json`, a canonical compare of the parsed value (as PK:322-326 does) is also acceptable.

### `tests_dictionary.json`

It is `JSON.stringify(testsDictionary({testFixture:false,provenance}),null,2)+'\n'`. For public packages it does not depend on the data, so it is a **constant**. The real file's SHA-256 is `690574e58f75535d546dd14a1ab51c8bf7e480f0b2674e0eb501ef0cfd9699d4`, and its keys are `schema_version,row_grain,missing_value,date_policy,unit_policy,window,documents,not_cited,order,tables,fields`, with no `provenance` key because `testFixture` is false.

Simplest strict option: pin that hash in A, or embed the generator. Producer source (testReports.mjs:68-125):
```js
const NO_DESCRIPTIONS='ODP publishes no column descriptions.';
const SRT_CONCEPT='Concept per official RRC step rate test guidelines (srt-guidelines.html); units from the ODP field name.';
const fieldDefinitions={ // [units, status, definition, source_field, basis, note]
 source_row_key:['string','calculated','Dataset snapshot plus 1-based raw response ordinal; retained duplicates stay distinct',null,'calculated',''],
 parent_key:['string','calculated','Inventory source_record_key when the exact uic_no string matches exactly one retained inventory parent (ADR 004 inventory_to_test_report)','uic_no','calculated',''],
 parent_join_status:['enum','calculated','matched / unmatched / ambiguous by exact UIC string','uic_no','calculated',''],
 uic_number:['string','public reported','Original nine-character uic_no; preserves leading zeros','uic_no','odp_field_name',''],
 source_report_id:['string','public reported','Original report_id kept as a string; part of the report identity','report_id','odp_field_name','Identity value; meaning undocumented.'],
 tracking_no:['string','public reported','Original tracking_no kept as a string; part of the report identity','tracking_no','odp_field_name','Identity value; meaning undocumented.'],
 test_sequence_no:['string','public reported','Original test_sequence_no kept as a string; part of the BHP report identity','test_sequence_no','odp_field_name','Identity value; meaning undocumented.'],
 report_conducted_date:['date','public reported','report_conducted_date when it is a valid YYYY-MM-DD date; otherwise empty','report_conducted_date','odp_field_name',''],
 report_conducted_date_text:['text','public reported','Original report_conducted_date text exactly as published','report_conducted_date','odp_field_name',''],
 report_received_date:['date','public reported','report_received_date when it is a valid YYYY-MM-DD date; otherwise empty','report_received_date','odp_field_name',''],
 report_received_date_text:['text','public reported','Original report_received_date text exactly as published','report_received_date','odp_field_name',''],
 bhp_psia:['psia as named by the ODP field','public reported','Reported bottom hole pressure as published','bhp_psia','odp_field_name','Official RRC Permian guidance (bhp-permian-nto.pdf p.1) states BHP is reported in PSIG; the ODP field name says psia. The conflict is unresolved; the value is shown as published and never converted. That guidance covers Permian districts 7C, 8, 8A and Fisher County only.'],
 test_depth_ft:['ft','public reported','Reported test depth as published','test_depth_ft','odp_field_name','Reported depth; depth basis unstated (measured or true vertical depth is not documented).'],
 gradient_psi_ft:['psi/ft','public reported','Reported BHP gradient as published','gradient_psi_ft','odp_field_name','Meaning unstated; not the SRT fracture gradient.'],
 tested_formation:['name','public reported','Original tested_formation text','tested_formation','odp_field_name',''],
 srt_received_date:['date','public reported','srt_received_date when it is a valid YYYY-MM-DD date; otherwise empty','srt_received_date','odp_field_name',''],
 srt_received_date_text:['text','public reported','Original srt_received_date text exactly as published','srt_received_date','odp_field_name',''],
 test_date:['date','public reported','test_date when it is a valid YYYY-MM-DD date; otherwise empty','test_date','odp_field_name',''],
 test_date_text:['text','public reported','Original test_date text exactly as published','test_date','odp_field_name',''],
 satisfactory_test_code:['source code','public reported','Original satisfactory_test value shown verbatim','satisfactory_test','odp_field_name','Values 0/1 shown verbatim; code meaning undocumented.'],
 top_perf_ft:['ft','public reported','Reported top perforation depth as published','top_perf_ft','odp_field_name','Depth basis unstated.'],
 bottom_perf_ft:['ft','public reported','Reported bottom perforation depth as published','bottom_perf_ft','odp_field_name','Depth basis unstated.'],
 formation_tested:['name','public reported','Original formation_tested text','formation_tested','odp_field_name',''],
 min_inj_rate_bpm:['bbl/min (bpm as named)','public reported','Reported minimum step injection rate as published','min_inj_rate_bpm','official_document:srt-guidelines.html',SRT_CONCEPT],
 max_inj_rate_bpm:['bbl/min (bpm as named)','public reported','Reported maximum step injection rate as published','max_inj_rate_bpm','official_document:srt-guidelines.html',SRT_CONCEPT],
 isip_psig:['psig','public reported','Reported instantaneous shut-in pressure as published','isip_psig','official_document:srt-guidelines.html',SRT_CONCEPT+' The guidance records ISIP at both the surface and the bottom hole; which one this column holds is unstated.'],
 formation_frac_press_psig:['psig','public reported','Reported formation fracture (parting) pressure as published','formation_frac_press_psig','official_document:srt-guidelines.html',SRT_CONCEPT],
 frac_inj_rate_capacity_bpd:['bbl/day','public reported','Reported value as published','frac_inj_rate_capacity_bpd','odp_field_name','FIRC is not defined in any RRC document found; meaning unverified. Units from the ODP field name.'],
 surface_pressure_firc_psig:['psig','public reported','Reported value as published','surface_pressure_firc_psig','odp_field_name','FIRC is not defined in any RRC document found; meaning unverified. Units from the ODP field name.'],
 fracture_gradient_psi_ft:['psi/ft','public reported','Reported fracture gradient as published','fracture_gradient_psi_ft','official_document:srt-guidelines.html',SRT_CONCEPT],
 comments:['text','public reported','Original comments text verbatim','comments','odp_field_name','Verbatim text; meaning undocumented.'],
 source_snapshot_id:['string','calculated','Dataset ID plus raw response SHA256 prefix',null,'calculated',''],
 quality_flags:['list','calculated','Pipe-delimited issues; issues may overlap',null,'calculated','']};
const documentSupport={'srt-guidelines.html':'SRT purpose, fracture (parting) pressure, fracture gradient in psi/ft, ISIP recorded at shut-in, stepped injection rates','bhp-permian-nto.pdf':'BHP method and unit, p.1; Permian districts 7C, 8, 8A and Fisher County only; states "Operator shall report pressure (PSIG)"'};
export function testsDictionary({testFixture=false,provenance=null}={}){
 const fields={};
 for(const column of [...new Set([...testColumns.bhp,...testColumns.srt])]){
  const [units,status,definition,source_field,basis,note]=fieldDefinitions[column];
  fields[column]={units,status:testFixture&&status==='public reported'?'synthetic':status,definition,source_field,basis,note:(NO_DESCRIPTIONS+(note?' '+note:'')).trim()};}
 return {schema_version:1,row_grain:testFixture?{...}:{bhp:'one retained official BHP report-inventory row (qxfy-wcfs)',srt:'one retained official SRT report-inventory row (h54t-xnbi)'},
  ...(testFixture&&provenance?{provenance:{...provenance}}:{}),
  missing_value:'CSV empty cell / JSON null for absent numbers or dates. Zero remains zero. String absence is empty string.',
  date_policy:'Only valid YYYY-MM-DD dates are parsed; the original text is always kept in the matching _text column.',
  unit_policy:'Units come from the ODP field-name suffix unless an entry cites an official document. Values are shown as reported; psia and psig are kept as labelled and never converted.',
  window:'Exact uic_no; not limited to the reporting period.',
  documents:officialTestDocuments.map(document=>({...document,supports:documentSupport[document.name]})),
  not_cited:'Form W-7 (oil and gas wells, not UIC), conference slides and the versioned review spreadsheet are not used as evidence.',
  order:{...testReportOrder},
  tables:{bhp:[...testColumns.bhp],srt:[...testColumns.srt]},
  fields};}
```
Note that the `fields` iteration order is the BHP columns, then the SRT-only columns (deduplicated).

## 7. The producer's own verification of v4 packages: hash-only, no re-derivation

- **`public/browser-library.js` `verifyVersionPackage` and `public/archive-bytes.js` `buildVersionArchiveFromReader`.** These check `manifest.json`/`normalized.json` against pins, the identity, `normalized.manifest===manifest`, and non-fixture provenance. Then every `manifest.files` and `sources[].raw_file` entry is checked for SHA-256 and byte count (cap `expected.size>100`), and `version-pins.json` against `publicationPinsSha256`. There is nothing specific to v4.
- **`public/artifact-integrity.js:26-38` `loadVerifiedSidecar(artifact,integrity,name)`.** The name must be in the verified `manifest.files`, and its SHA-256 and byte count must match. `public/app.js:146-147` loads `tests.json` and `tests_dictionary.json` this way and requires `tests.artifactId===artifact.artifactId`. Wellbore (`casing.json`, `plugging.json`, `wellbore_dictionary.json`) is handled the same way (app.js:158).
- **Re-derivation exists only at publication** (`buildArtifact`, artifact.mjs:150-160), comparing deep equality against canonical `normalize`/`normalizeTests`/`normalizeSnapshotWellbore` and failing on any `source_scope:` flag.
- **Analytics gate.** The producer itself refuses to hand off `query_version>=3` packages to Analytics ("until the receiver accepts additive files (D10, Phase 6)", app.js:35-37, 116).

So A's planned check (re-deriving H-10 plus tests, with hash and sidecar checks for wellbore) is **strictly stronger** than the producer's own consumer verification. Mirror the hash-only rule for wellbore files, and the `tests.artifactId`/`artifactId` identity check for test sidecars.

## 8. Implementation checklist for A

**explorer-evidence.mjs**
1. Add `const boundedVersion=s=>s?.queryVersion===2||s?.queryVersion===4;` (also 3 if v3 is ever accepted). At EV:6 replace `===2` with it. Add branches before `inventory`:
   - `bhp`/`srt`: `row.uic_no!==scope.monthlyUic` → `source_scope:uic_no`.
   - optionally `casing`/`plugging`/`wellbore_inventory`: `row?.api_no!==scope.sourceApiId` → `source_scope:api_no`.
2. EV:43: the county relabel applies under the same bounded predicate.
3. EV:106: `transformation_version` must equal `{2:'rrc-odp-v2.0.0',4:'rrc-odp-v2.2.0'}[manifest.scope.query_version]`. Provenance and `testFixture` are unchanged.
4. EV:113: for v4, `expectedScope` is the v2 object with `queryVersion:4` plus `testReportLimit:1000, sourceApiId:<8-digit rawInventory[0].api_no or null>, wellboreLimit:1000, wellboreInventoryLimit:25`. The version is chosen from `manifest.scope.query_version` and must equal `scope.queryVersion`. The raw inventory has to be read before this check (move EV:119 up).
5. EV:117-118: for v4, append the 6 test-report targets and the 5 or 8 wellbore targets (§1). Compare them as an ordered exact list.
6. EV:123/126: add raw `candidate-bhp.json`/`candidate-srt.json`: arrays of plain objects, `length<1000`, and every row `uic_no===scope.monthlyUic`.
   - Optional, cheap and not required by the brief: `wellbore-inventory` length `<25`, casing/plugging `<1000`, all rows `api_no===sourceApiId`. This matches the producer refusing at artifact.mjs:118-119 and 159.
7. EV:128: for v4, add `test_report_limit:1000, wellbore_limit:1000, wellbore_inventory_limit:25`, with `query_version:4`.
8. EV:129: `sourceIds` gains `bhp`/`srt` for v4, plus `wellbore_inventory`/`casing`/`plugging` when `sourceApiId!==null`. Only `inventory`, `monthly`, `bhp` and `srt` are passed to normalizers; the wellbore ids are used only for `snapshot_id`.
9. EV:137-141 and 158: build the expected sources in this order: v2 7 → selection → 6 test sources → wellbore. Use `retrieval()` for each (it checks the sidecar url, status, `testFixture`, `retrieved_at`, SHA-256 and bytes). Fix the title file name for `wellbore_inventory` → `inventory-metadata.json`.
10. Return `{scope,sourceIds,rawInventory,rawMonthly,rawBhp,rawSrt}`.
11. New export `normalizeExplorerTests({bhp,srt},sourceIds,canonicalInventory,scope)` and `testsDictionary()`, plus `testColumns`, `explorerCsv` (the producer's `csv`), `testReportOrder` and `officialTestDocuments`. Copy them verbatim from §6, or pin the dictionary SHA-256 `690574e5…`.
12. Optional: require that `Object.keys(manifest.files)` equals the expected ordered list from §3 (verified exact on the real package).

**explorer-package.mjs**
13. PK:295: `dynamic=[2,4].includes(manifest.scope?.query_version)`. PK:306 and PK:311-313 then apply to v4 unchanged, because the version-pins shape is the same.
14. After PK:331, when `query_version===4`:
    - (a) Run `testRows=normalizeExplorerTests({bhp:evidence.rawBhp,srt:evidence.rawSrt},evidence.sourceIds,canonical.inventory,evidence.scope)`, and fail if any row has a `source_scope:` flag.
    - (b) Build the expected `tests` object exactly as artifact.mjs:197 (`query_version:4`). Require `decode('tests.json')===JSON.stringify(tests,null,2)+'\n'`, or at least `same(json('tests.json'),tests)`.
    - (c) Require `decode('tests_bhp.csv')===explorerCsv(testRows.bhp,testColumns.bhp)`, and the same for SRT.
    - (d) Require `decode('tests_dictionary.json')===JSON.stringify(testsDictionary(),null,2)+'\n'` (or its pinned hash).
    - (e) All four must be present as `manifest.files` keys. Their hash and byte checks are already done at PK:308.
15. Wellbore sidecars (`casing.json`, `casing.csv`, `plugging.json`, `plugging.csv`, `wellbore_dictionary.json`) and their sources/documents: rely on PK:308 hash/byte checks plus the §3 `retrieval()` sidecar checks. Do not parse or expose them. If wanted, a sanity check is `json('casing.json').artifactId===manifest.artifact_id`, with `scope.query_version===4` and `scope.source_api_id===sourceApiId`.
16. PK:345: keep basis `'recorded_official_acquisition_v2'` (the producer's v4 basis is identical). Consider adding a `queryVersion` field to `provenance`/`preview`.
17. PK:347: when test rows are exposed, add a warning that BHP is a public report inventory, not a pressure series. The source's psia versus PSIG guidance conflict is unresolved and the values are not converted.
18. Limits are fine: the v4 package has 65 files (PK:168 cap is 103), 62 `manifest.files` entries (cap 100) and 22 sources (cap 100). Its largest file is `uic-manual.pdf` at 1.08 MB.
19. Tests: add the real v4 package as a fixture, built with `git archive 3cefa99 artifacts/<id>` and then tarred in the producer's USTAR form (sorted names, mode 0644, mtime 0). Add negative cases: a tampered `tests_srt.csv` cell with its manifest hash updated, `tests.json` `query_version:3`, a missing test target, a BHP row with the wrong `uic_no`, `sourceApiId` differing from the inventory `api_no`, and v3 refused.
