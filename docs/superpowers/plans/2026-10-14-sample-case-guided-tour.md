# Sample Case and Guided Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One click loads a pinned sample case (two real TRRC injection wells plus labelled synthetic gaps) and calculates every main tool, and an optional 7-stop guided tour explains each tool and ends with a downloadable gather checklist.

**Architecture:** The sample is a fourth planning source, `sample`, next to `demo`, `public` and `user`.
- **Producers:** it reuses the demo's synthetic seed-417 producers.
- **Injectors:** the two real wells replace the demo's fictional injectors in the capacity tools.
- **Injector history:** shows each real well's TRRC record through the existing single-record view.

A pure TypeScript module (`src/sampleCase.ts`) owns validation, provenance classes, derived values and the checklist. Browser modules verify the pinned files, drive the existing tool forms through the DOM and run the tour. No calculation code changes.

**Tech Stack:**
- Native browser ES modules; no framework and no new dependency.
- TypeScript 5.9.3, compiled to `dist/`.
- Node 24 test runner, run through direct Node paths only. No npm/npx, Vitest or bare Python.

**Spec:** `docs/superpowers/specs/2026-10-14-sample-case-guided-tour-design.md`, owner-approved October 14, 2026.

**Deviations from the spec, for owner awareness** (each was forced by the code as it is today):
1. **More existing files touched.** The spec listed 3 existing files. This plan modifies 5 in the app: `web/index.html`, `web/import-ui.mjs`, `web/workspace-views.mjs`, `web/disposal-context.mjs` (a `sample` branch, so the capacity tools get the real wells) and `web/disposal-case.mjs` (a one-expression source label, so the sample is never called "synthetic demonstration"). It also modifies 2 root files, `scripts/verify-preservation.mjs` and `tests/preservation-baseline.test.mjs`, for the chained preservation baseline.
2. **Packer depth and coordinates are not shown.** They aren't in the normalized TRRC record the app holds, and the spec only allowed displaying them.
3. **Injectivity tab.** In sample mode it points to Capacity assessment instead of showing the demo's fictional injectors. The "Original workbook" stays demo-only.
4. **Producer schedule.** Loading the sample resets the demo producer controls to their page defaults and records the resulting producer fixture SHA-256. If the visitor edits the schedule afterwards, the capacity tools are blocked with "Reload the sample case" until they reload.
5. **Two more new files than spec section 8 lists:** `web/sample-steps.mjs` (the one-click step runner) and `tests/sample-steps.test.mjs`.
6. **Approved-document hashes ignore line endings.** The spec and plan are stored with LF in Git but checked out with CRLF on this machine (`core.autocrlf=true`, and `docs/` has no `-text` rule). The new baseline therefore hashes them with CRLF converted to LF, so another checkout cannot break it. The accepted pressure-support baseline hashes its plan's raw on-disk bytes and has this exposure already; this plan does not change it. Adding a `-text` rule now would break that accepted baseline on this machine.

**Preservation gate, read before starting:**
- `tests/transfer.test.mjs` (root) **will be red on this branch from Task 1 until the owner accepts the new baseline in Task 10**. This is by design; do not weaken it.
- The nested suite, `node scripts/check-analytics.mjs`, must stay green after every task.
- The final baseline pins this plan's SHA-256 and the spec's. Any edit to either file after Task 10 invalidates the baseline.

**Paths used below:**
- `ROOT` = `C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics/tmp/lovable-transfer/well-injection-insights` (the Git root; branch `feature/sample-tour`).
- `APP` = `ROOT/swd-injection-analytics`.
- Compile after any `src/*.ts` change, from ROOT: `node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json`
- Nested tests run from APP: `node --test tests/<name>.test.mjs`

## Global Constraints

- Owner decisions: button label **"Try it with sample data"**; the tour starts **only on click**; **two real TRRC wells**: UIC 000020838, and SAND BEND 2D (UIC 000056484), which replaces the fictional Injector 2.
- TRRC rules (binding):
  - Identifiers stay original strings with leading zeros, and API number is never a join key.
  - Missing stays `null`, never zero.
  - Reported pressure is never relabelled as bottomhole or reservoir pressure, and average and maximum pressure stay distinct.
  - No annulus values are synthesized.
  - Per-field "public reported" and "calculated" labels are kept.
- Exactly five value classes: `trrc-public-record`, `calculated`, `derived-with-assumption`, `synthetic`, `raw-not-verified`.
- Derived values:
  - Surface limit = permit psi + 14.7: **2,614.7 psia** (Well A) and **1,514.7 psia** (Well B). Assumption: the permit is surface gauge pressure, and atmospheric pressure is 14.7 psi.
  - Datum TVD = permitted top: **5,200 ft** (A) and **3,028 ft** (B). Assumption: the top of the permitted interval is the datum, and the well is vertical to it.
- Synthetic values never fill gaps in customer data. The sample is session-only: no persistence, no backend.
- No calculation module (`src/*` engineering code) is modified. `src/sampleCase.ts` is new and contains no engineering methods.
- Workers never stage, commit or push; Main commits on `feature/sample-tour` only. Nothing is pushed until the owner says so.
- Do not edit generated `public/` assets by hand; `node scripts/prepare-swd.mjs` regenerates them.

## Review Focus

1. **The visitor edits the producer schedule after loading the sample** (demo workbook controls or the Schedules tab). Expected: capacity tools block with "Reload the sample case", not silently use the edited demand. Pinned by a disposal-context test in Task 4.
2. **A customer upload or another source is chosen after the sample.** Expected: the sample's wells, banner, well switch and exports disappear, and no sample value reaches the user path. Pinned by a disposal-context test in Task 4, plus the browser checks in Task 9.
3. **Well B has 16 months and Well A has 28.** Expected: each well keeps its own coverage, and each export carries exactly one artifact and its pin. Pinned by a loader test in Task 3 (distinct coverage per selection), plus browser checks in Task 9.
4. **The visitor clicks "Illustrative defaults" or edits a pre-filled field.** Expected: the field's provenance label no longer claims a TRRC or sample value. Pinned by a DOM-free annotation test in Task 3, plus browser checks in Task 9.
5. **The visitor clicks "Try it with sample data" in the first second, double-clicks it, cancels mid-load, or refreshes mid-tour.** Expected:
   - A first click waits for the pinned TRRC record instead of failing.
   - Only the latest run applies, and a cancelled run stops before its next step.
   - A refresh clears everything.

   Pinned by the runner abort tests and the `verify` step's wait in Task 6, plus browser checks in Task 9.

---

### Task 1: Chained preservation baseline (gate first)

The current checker accepts exactly one reviewed change set (pressure-support). This task adds a second, chained baseline whose "before" state must equal the accepted pressure-support "after" state. It also archives the current bytes of the five UI files that this feature will change.

**Files:**
- Modify: `ROOT/scripts/verify-preservation.mjs`
- Modify: `ROOT/tests/preservation-baseline.test.mjs`
- Create: `ROOT/migration/baselines/sample-tour-before/swd-injection-analytics/web/{index.html,import-ui.mjs,workspace-views.mjs,disposal-context.mjs,disposal-case.mjs}` (byte-exact copies of the current files)

**Interfaces:**
- Produces: `verifyPreservation(root)` (same signature), which now also reads `migration/sample-tour-baseline.json` when present. Task 10 writes that file.

- [ ] **Step 1: Archive the before-state bytes and confirm they equal the accepted state**

Run (from ROOT, Git Bash):
```bash
for f in index.html import-ui.mjs workspace-views.mjs disposal-context.mjs disposal-case.mjs; do mkdir -p migration/baselines/sample-tour-before/swd-injection-analytics/web; cp "swd-injection-analytics/web/$f" "migration/baselines/sample-tour-before/swd-injection-analytics/web/$f"; done
node -e "const {createHash}=require('crypto'),fs=require('fs');const sha=b=>createHash('sha256').update(b).digest('hex');const ps=JSON.parse(fs.readFileSync('migration/pressure-support-baseline.json'));const man=JSON.parse(fs.readFileSync('migration/source-manifest.json'));for(const f of ['index.html','import-ui.mjs','workspace-views.mjs','disposal-context.mjs','disposal-case.mjs']){const p='web/'+f,b=fs.readFileSync('migration/baselines/sample-tour-before/swd-injection-analytics/'+p),c=ps.changes.find(x=>x.path===p),o=man.files.find(x=>x.path===p),want=c?c.afterSha256:o.sha256;console.log(p,sha(b)===want?'OK':'MISMATCH')}"
```
Expected: five lines, each ending `OK`. If any says `MISMATCH`, stop: the working tree has unreviewed edits.

- [ ] **Step 2: Write the failing tests**

In `ROOT/tests/preservation-baseline.test.mjs`, make these four edits.

(a) After the line `const rootFiles=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs','tests/transfer.test.mjs','.gitattributes'];`, add:
```js
const stUi=['web/index.html','web/import-ui.mjs','web/workspace-views.mjs','web/disposal-context.mjs','web/disposal-case.mjs'];
const stAdded=['src/sampleCase.ts','scripts/create-sample-case.mjs','data/sample-case/sample-case.json','data/sample-case/pin.json','data/sample-case/public-uic000056484.tar','data/samples/README.md','data/samples/seed417-history.csv','data/samples/seed417-history.xlsx','data/samples/assumed-injectors.csv','data/samples/invalid-history.csv','web/sample-case.mjs','web/sample-steps.mjs','web/sample-tour.mjs','web/sample-tour.css','web/tour-steps.mjs','tests/sample-case.test.mjs','tests/sample-steps.test.mjs','tests/sample-tour.test.mjs'];
const stRoot=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'];
const ST_ARCHIVE='migration/baselines/sample-tour-before/swd-injection-analytics/';
const ST_DOCS=[['docs/superpowers/specs/2026-10-14-sample-case-guided-tour-design.md','approvedSpecSha256'],['docs/superpowers/plans/2026-10-14-sample-case-guided-tour.md','approvedPlanSha256']];
const docSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
```

(b) Replace the original-file copy line inside `fixture()`:
```js
 for(const e of manifest.files)await write(root,join('swd-injection-analytics',e.path),await readFile(join(owningRoot,ui.includes(e.path)?'migration/baselines/pressure-support-before/swd-injection-analytics':'swd-injection-analytics',e.path)));
```
with:
```js
 for(const e of manifest.files)await write(root,join('swd-injection-analytics',e.path),await readFile(join(owningRoot,ui.includes(e.path)?'migration/baselines/pressure-support-before/swd-injection-analytics':stUi.includes(e.path)?ST_ARCHIVE.slice(0,-1):'swd-injection-analytics',e.path)));
```

(c) After the `persist` function, add:
```js
async function sampleTourFixture(){
 const f=await fixture();
 const st={version:'swd-sample-tour-preservation/1',status:'accepted',parentBaselineSha256:'',approvedSpecSha256:'',approvedPlanSha256:'',changes:[],newFiles:[],rootFiles:[]};
 for(const [p,key] of ST_DOCS){const b=await readFile(join(owningRoot,p));await write(f.root,p,b);st[key]=docSha(b);}
 for(const p of stUi){const b=await readFile(join(f.root,'swd-injection-analytics',p)),archive=ST_ARCHIVE+p;await write(f.root,archive,b);const next=Buffer.concat([b,Buffer.from('\n// sample-tour test delta\n')]);await write(f.root,'swd-injection-analytics/'+p,next);st.changes.push({path:p,beforeSha256:sha(b),beforeBytes:b.length,afterSha256:sha(next),afterBytes:next.length,archive});}
 for(const p of stAdded){const b=Buffer.from('Sample-tour fixture: '+p);await write(f.root,'swd-injection-analytics/'+p,b);st.newFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 for(const p of stRoot){const b=await readFile(join(owningRoot,p));st.rootFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 st.parentBaselineSha256=sha(await readFile(join(f.root,'migration/pressure-support-baseline.json')));
 await write(f.root,'migration/sample-tour-baseline.json',JSON.stringify(st));return {...f,st};
}
async function persistSt(f){await write(f.root,'migration/sample-tour-baseline.json',JSON.stringify(f.st));}
```

(d) At the end of the file, add:
```js
test('accepted sample-tour delta chains on the accepted pressure-support state',async()=>{const f=await sampleTourFixture();const result=await checker.verifyPreservation(f.root);assert.equal(result.checked,182);assert.deepEqual(result.violations,[]);});
test('approved sample-tour documents verify with LF or CRLF line endings',async()=>{const f=await sampleTourFixture();for(const [p] of ST_DOCS){const text=(await readFile(join(f.root,p),'utf8')).replace(/\r\n/g,'\n');await write(f.root,p,Buffer.from(text));const r1=await checker.verifyPreservation(f.root);assert.deepEqual(r1.violations,[],'LF '+p);await write(f.root,p,Buffer.from(text.replace(/\n/g,'\r\n')));const r2=await checker.verifyPreservation(f.root);assert.deepEqual(r2.violations,[],'CRLF '+p);}});
const stCases=[
 ['pending sample-tour baseline never passes',async f=>{f.st.status='pending-review';await persistSt(f);},/Sample-tour baseline is pending/],
 ['sample-tour before state must equal the pressure-support after state',async f=>{const ps=f.baseline.changes.find(c=>c.path==='web/index.html');const c=f.st.changes.find(x=>x.path==='web/index.html');c.beforeSha256=ps.beforeSha256;await persistSt(f);},/prior accepted state.*web\/index\.html/],
 ['editing the parent baseline breaks the chain',async f=>{f.baseline.acceptedBy='edited';await persist(f);},/parent baseline SHA/],
 ['unlisted sample-tour product files are rejected',async f=>write(f.root,'swd-injection-analytics/data/sample-case/extra.json','{}'),/data\/sample-case\/extra\.json/],
 ['a later edit after the sample-tour after hash is rejected',async f=>write(f.root,'swd-injection-analytics/web/disposal-context.mjs','later edit'),/web\/disposal-context\.mjs/],
 ['sample-tour archives cannot be replaced',async f=>write(f.root,ST_ARCHIVE+'web/disposal-case.mjs','wrong original'),/Sample-tour archive/],
 ['extra files in the sample-tour archive are rejected',async f=>write(f.root,'migration/baselines/sample-tour-before/unlisted.txt','x'),/Unlisted sample-tour archive/],
 ['root checker pins move to the sample-tour baseline and stay enforced',async f=>{f.st.rootFiles[0].sha256='0'.repeat(64);await persistSt(f);},/scripts\/verify-preservation\.mjs/],
 ['approved sample-tour plan bytes must still match',async f=>write(f.root,ST_DOCS[1][0],'changed plan'),/Approved document hash mismatch/],
 ['sample-tour allowlist cannot be extended',async f=>{f.st.newFiles.push({path:'src/planning.ts',bytes:0,sha256:'0'.repeat(64)});await persistSt(f);},/allowlist|unapproved/i],
];
for(const [name,change,want]of stCases)test(name,async()=>{const f=await sampleTourFixture();await change(f);const result=await checker.verifyPreservation(f.root);assert.ok(result.violations.some(x=>want.test(x)),JSON.stringify(result.violations));});
```

- [ ] **Step 3: Run the tests to verify they fail**

The plan file must exist on disk first; it does, since you are reading it.

Run (ROOT): `node --test tests/preservation-baseline.test.mjs`

Expected: the existing tests PASS, and the new `sample-tour` tests FAIL. The accepted-delta test fails with `Unlisted new product path` violations, and most `stCases` fail because the checker ignores `sample-tour-baseline.json`.

- [ ] **Step 4: Implement the chained baseline in the checker**

In `ROOT/scripts/verify-preservation.mjs`:

(a) After the `const ROOT=[...]` line, add:
```js
const PS_BASELINE='migration/pressure-support-baseline.json',ST_BASELINE='migration/sample-tour-baseline.json';
const ST_UI=['web/index.html','web/import-ui.mjs','web/workspace-views.mjs','web/disposal-context.mjs','web/disposal-case.mjs'];
const ST_NEW=['src/sampleCase.ts','scripts/create-sample-case.mjs','data/sample-case/sample-case.json','data/sample-case/pin.json','data/sample-case/public-uic000056484.tar','data/samples/README.md','data/samples/seed417-history.csv','data/samples/seed417-history.xlsx','data/samples/assumed-injectors.csv','data/samples/invalid-history.csv','web/sample-case.mjs','web/sample-steps.mjs','web/sample-tour.mjs','web/sample-tour.css','web/tour-steps.mjs','tests/sample-case.test.mjs','tests/sample-steps.test.mjs','tests/sample-tour.test.mjs'];
const ST_ROOT=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'];
const ST_ARCHIVE='migration/baselines/sample-tour-before/swd-injection-analytics/';
const ST_DOCS=[['docs/superpowers/specs/2026-10-14-sample-case-guided-tour-design.md','approvedSpecSha256'],['docs/superpowers/plans/2026-10-14-sample-case-guided-tour.md','approvedPlanSha256']];
// Approved documents are hashed with CRLF normalized to LF: docs/ has no -text rule, so checkouts may differ by platform.
const docSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
```

(b) Replace `baseline=JSON.parse(await bytesAt(root,'migration/pressure-support-baseline.json'))` with `baseline=JSON.parse(await bytesAt(root,PS_BASELINE))`.

(c) Immediately before the line ` for(const e of manifest.files){`, insert:
```js
 let st=null,stChanges=new Map(),stAdded=new Map(),stRoot=new Map();
 try{st=JSON.parse(await bytesAt(root,ST_BASELINE));}catch(e){if(e.code!=='ENOENT')violations.push('Cannot read sample-tour baseline: '+e.message);}
 if(st){
  if(!baseline)violations.push('Sample-tour baseline requires the accepted pressure-support baseline');
  if(st.version!=='swd-sample-tour-preservation/1')violations.push('Unsupported sample-tour baseline version');
  if(st.status!=='accepted')violations.push('Sample-tour baseline is pending/not accepted after independent review');
  try{if(!HASH.test(st.parentBaselineSha256??'')||sha(await bytesAt(root,PS_BASELINE))!==st.parentBaselineSha256)violations.push('Sample-tour parent baseline SHA mismatch');}catch(e){violations.push('Sample-tour parent baseline unavailable: '+e.message);}
  stChanges=exactEntries(st.changes,ST_UI,'Sample-tour UI changes',violations);stAdded=exactEntries(st.newFiles,ST_NEW,'Sample-tour new files',violations);stRoot=exactEntries(st.rootFiles,ST_ROOT,'Sample-tour root files',violations);
  for(const [p,key]of ST_DOCS){try{if(!HASH.test(st[key]??'')||docSha(await bytesAt(root,p))!==st[key])violations.push('Approved document hash mismatch: '+p);}catch(e){violations.push('Approved document unavailable: '+p+' '+e.message);}}
  const stArchives=new Set(ST_UI.map(p=>ST_ARCHIVE+p));
  for(const p of await listFiles(root,'migration/baselines/sample-tour-before',violations))if(!stArchives.has(p))violations.push('Unlisted sample-tour archive: '+p);
  for(const [p,c]of stChanges){
   const prior=changes.get(p),original=originals.get(p),before=prior?{sha256:prior.afterSha256,bytes:prior.afterBytes}:original?{sha256:original.sha256,bytes:original.bytes}:null;
   if(c.archive!==ST_ARCHIVE+p)violations.push('Unsafe/unapproved sample-tour archive path: '+String(c.archive));
   if(!before||c.beforeSha256!==before.sha256||c.beforeBytes!==before.bytes)violations.push('Sample-tour before hash/bytes must equal the prior accepted state: '+p);
   if(!HASH.test(c.afterSha256??'')||!Number.isSafeInteger(c.afterBytes)||c.afterBytes<0)violations.push('Unreviewed sample-tour after hash/bytes: '+p);
   try{const b=await bytesAt(root,ST_ARCHIVE+p);if(!before||b.length!==before.bytes||sha(b)!==before.sha256)violations.push('Sample-tour archive hash/bytes mismatch: '+p);}catch(e){violations.push('Sample-tour archive missing/unsafe: '+p+' '+e.message);}
  }
 }
```

(d) In the original-file loop, replace `change=changes.get(e.path)` with `change=stChanges.get(e.path)??changes.get(e.path)`.

(e) Replace the line beginning ` for(const [prefix,inventory]of [['swd-injection-analytics/',added],['',rootAdded]])for(const [p,e]of inventory){` with:
```js
 const psRoot=new Map([...rootAdded].filter(([p])=>!(st&&ST_ROOT.includes(p))));
 for(const [prefix,inventory]of [['swd-injection-analytics/',added],['swd-injection-analytics/',stAdded],['',psRoot],['',stRoot]])for(const [p,e]of inventory){
```
The loop body stays unchanged.

(f) In the unlisted-product-path line, replace `if(!originals.has(appPath)&&!added.has(appPath))` with `if(!originals.has(appPath)&&!added.has(appPath)&&!stAdded.has(appPath))`.

(g) Update the doc comment above `verifyPreservation` to: `/** Verify original transfer bytes, the reviewed pressure-context delta, and the chained sample-tour delta when present. */`

- [ ] **Step 5: Run the tests to verify they pass**

Run (ROOT): `node --test tests/preservation-baseline.test.mjs`
Expected: all tests PASS (the existing ~22 plus the 12 new ones).

Run (ROOT): `node --test tests/transfer.test.mjs`
Expected: the first test FAILS, because the root checker's own bytes changed and no sample-tour baseline exists yet. This is the expected red state until Task 10. The other tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-preservation.mjs tests/preservation-baseline.test.mjs migration/baselines/sample-tour-before docs/superpowers/plans/2026-10-14-sample-case-guided-tour.md
git commit -m "Add chained sample-tour preservation baseline checker and before-state archives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sample case contract, generator and pinned data

**Files:**
- Create: `APP/src/sampleCase.ts`
- Create: `APP/scripts/create-sample-case.mjs`
- Create (generated): `APP/data/sample-case/sample-case.json`, `APP/data/sample-case/pin.json`, `APP/data/sample-case/public-uic000056484.tar`
- Test: `APP/tests/sample-case.test.mjs`

**Interfaces:**
- Produces (from `dist/sampleCase.js`):
  - `SAMPLE_CASE_VERSION: 'swd-sample-case/1'`
  - `ATMOSPHERIC_PSI: 14.7`
  - `VALUE_CLASSES` (5 strings)
  - `CLASS_LABELS: Record<ValueClass,string>`
  - `TOOL_LABELS: Record<string,string>`
  - `deriveSurfaceLimitPsia(permitPsi:number):number`
  - `deriveDatumTvdFt(topFt:number):number`
  - `sourceValue(artifact, field):string|number|null`
  - `validateSampleCase(raw:unknown):string[]`
  - `checkTrrcValues(well, artifact, pin):string[]`
  - `checkDerivedValues(well):string[]`
  - `sampleInput(sample, wellIndex:number|'shared', key):SampleInput`
  - `sampleInjector(well):Injector`
  - `sampleGeometry(well)`
  - `sampleFluid(sample)`
  - `gatherChecklist(sample):ChecklistRow[]`
  - `checklistCsv(rows):string`
  - Types: `SampleCase`, `SampleWell`, `SampleInput`, `ChecklistRow`.

- [ ] **Step 1: Write the failing tests**

Create `APP/tests/sample-case.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';
import {validateInjector} from '../dist/engineering.js';
import * as sc from '../dist/sampleCase.js';

const app=new URL('../',import.meta.url),bytes=p=>readFile(new URL(p,app)),json=async p=>JSON.parse(await bytes(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const sample=await json('data/sample-case/sample-case.json'),pin=await json('data/sample-case/pin.json');
const artifactA=await json('data/explorer/normalized.json'),pinA=await json('data/explorer-pin.json');
const pkgB=await verifyExplorerPackage(new Uint8Array(await bytes('tests/fixtures/explorer-packages/public-uic000056484.tar')));
const [wellA,wellB]=sample.wells;

test('sample file verifies against its byte pin',async()=>{const b=await bytes('data/sample-case/sample-case.json');assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);assert.equal(pin.caseId,'swd-sample-case/uic000020838+uic000056484/v1');});
test('served SAND BEND 2D package is a byte-exact copy of the verified fixture',async()=>{const served=await bytes('data/sample-case/public-uic000056484.tar'),fixture=await bytes('tests/fixtures/explorer-packages/public-uic000056484.tar'),prov=await json('tests/fixtures/explorer-packages/provenance.json');assert.deepEqual(served,fixture);assert.equal(sha(served),prov.packageSha256);assert.equal(served.length,prov.packageBytes);assert.deepEqual(wellB.trrc.package,{path:'public-uic000056484.tar',sha256:prov.packageSha256,bytes:prov.packageBytes});});
test('the sample case passes its own contract',()=>assert.deepEqual(sc.validateSampleCase(sample),[]));
test('every TRRC-classed value equals its source record',()=>{assert.deepEqual(sc.checkTrrcValues(wellA,artifactA,pinA),[]);assert.deepEqual(sc.checkTrrcValues(wellB,pkgB.artifact,pkgB.pin),[]);});
test('a changed TRRC value is reported as a mismatch',()=>{const bad=structuredClone(wellA);bad.inputs.find(i=>i.key==='permitPressurePsi').value=2700;assert.match(sc.checkTrrcValues(bad,artifactA,pinA).join(' '),/permitPressurePsi/);const wrongPin={...pinA,manifestSha256:'0'.repeat(64)};assert.match(sc.checkTrrcValues(wellA,artifactA,wrongPin).join(' '),/manifest/i);});
test('known TRRC values for both wells',()=>{const v=(w,k)=>sc.sampleInput(sample,sample.wells.indexOf(w),k).value;assert.equal(v(wellA,'uicNumber'),'000020838');assert.equal(v(wellA,'permitPressurePsi'),2600);assert.equal(v(wellA,'permitVolumeBpd'),14500);assert.equal(v(wellA,'permittedTopFt'),5200);assert.equal(v(wellA,'monthlyRows'),28);assert.equal(v(wellB,'uicNumber'),'000056484');assert.equal(v(wellB,'leaseName'),'SAND BEND');assert.equal(v(wellB,'permitPressurePsi'),1500);assert.equal(v(wellB,'permitVolumeBpd'),1200);assert.equal(v(wellB,'permittedTopFt'),3028);assert.equal(v(wellB,'monthlyRows'),16);assert.equal(wellA.trrc.firstMonth,'2024-01');assert.equal(wellA.trrc.lastMonth,'2026-04');assert.equal(wellB.trrc.lastMonth,'2025-04');});
test('derived values use the stated assumptions per well',()=>{assert.deepEqual(sc.checkDerivedValues(wellA),[]);assert.deepEqual(sc.checkDerivedValues(wellB),[]);assert.deepEqual(sc.sampleGeometry(wellA),{tvdFt:5200,measuredDepthFt:5200,innerDiameterInches:3.958,roughnessInches:0.0006,surfaceLimitPsia:2614.7});assert.equal(sc.sampleGeometry(wellB).surfaceLimitPsia,1514.7);assert.equal(sc.sampleGeometry(wellB).tvdFt,3028);for(const w of sample.wells)for(const i of w.inputs.filter(x=>x.class==='derived-with-assumption')){assert.ok(i.assumption.length>20,i.key);assert.ok(i.derivedFrom.length,i.key);}});
test('every input has exactly one of the five classes',()=>{for(const i of [...sample.wells.flatMap(w=>w.inputs),...sample.shared])assert.ok(sc.VALUE_CLASSES.includes(i.class),i.key);assert.equal(sc.VALUE_CLASSES.length,5);});
test('a derived value without its assumption is rejected',()=>{const bad=structuredClone(sample);delete bad.wells[0].inputs.find(i=>i.key==='surfaceLimitPsia').assumption;assert.match(sc.validateSampleCase(bad).join(' '),/assumption/);});
test('a TRRC value labelled as bottomhole pressure is rejected',()=>{const bad=structuredClone(sample);bad.wells[0].inputs.find(i=>i.key==='permitPressurePsi').label='Permit bottomhole pressure';assert.match(sc.validateSampleCase(bad).join(' '),/never labelled as bottomhole/);});
test('identifiers stay strings and missing TRRC values stay null',()=>{const bad=structuredClone(sample);bad.wells[0].inputs.find(i=>i.key==='uicNumber').value=20838;assert.match(sc.validateSampleCase(bad).join(' '),/original strings/);const blank={...artifactA,inventory:[{...artifactA.inventory[0],permit_canceled_date:''}]};assert.equal(sc.sourceValue(blank,'permit_canceled_date'),null);});
test('an unknown class is rejected',()=>{const bad=structuredClone(sample);bad.shared[0].class='assumed';assert.match(sc.validateSampleCase(bad).join(' '),/exactly one of/);});
test('both injectors validate as bottomhole-absolute at their own datum',()=>{for(const w of sample.wells){const inj=sc.sampleInjector(w);validateInjector(inj);assert.equal(inj.id,w.id);assert.match(inj.datum,/derived from TRRC/);}assert.equal(sc.sampleInjector(wellA).limitPsia,3600);assert.equal(sc.sampleInjector(wellB).injectivityStbdPerPsi,0.5);});
test('the gather checklist covers every non-TRRC input and every gather-only item',()=>{const rows=sc.gatherChecklist(sample);for(const w of sample.wells)for(const i of w.inputs.filter(x=>x.class!=='trrc-public-record'))assert.ok(rows.some(r=>r.item===i.label&&r.well===w.label),i.key);for(const i of sample.shared)assert.ok(rows.some(r=>r.item===i.label),i.key);for(const g of sample.gatherOnly)assert.ok(rows.some(r=>r.item===g.label&&/Not in the sample/.test(r.class)),g.key);assert.equal(rows.length,sample.wells.reduce((n,w)=>n+w.inputs.length,0)+sample.shared.length+sample.gatherOnly.length);});
test('checklist CSV is deterministic, quoted and CRLF-terminated',()=>{const csv=sc.checklistCsv(sc.gatherChecklist(sample));assert.equal(csv,sc.checklistCsv(sc.gatherChecklist(structuredClone(sample))));assert.ok(csv.startsWith('Item,Well,Class,Source,Units and basis,Needed by\r\n'));assert.ok(csv.endsWith('\r\n'));assert.match(csv,/"Synthetic: you'd gather"|Synthetic: you'd gather/);assert.match(sc.checklistCsv([{item:'a,"b"',well:'w',class:'c',source:'s',units:'u',neededBy:'n'}]),/"a,""b"""/);});
test('tool labels match the app navigation',async()=>{const {workspace}=await import('../web/navigation.mjs');for(const [id,label] of Object.entries(sc.TOOL_LABELS))assert.equal(workspace(id).label,label,id);});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (APP): `node --test tests/sample-case.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `dist/sampleCase.js` (or the sample data files).

- [ ] **Step 3: Write `src/sampleCase.ts`**

Create `APP/src/sampleCase.ts`:
```ts
import {type Injector,validateInjector} from './engineering.js';

/** Sample case contract: every value carries exactly one provenance class. No engineering method lives here. */
export const SAMPLE_CASE_VERSION='swd-sample-case/1';
export const ATMOSPHERIC_PSI=14.7;
export const VALUE_CLASSES=['trrc-public-record','calculated','derived-with-assumption','synthetic','raw-not-verified'] as const;
export type ValueClass=typeof VALUE_CLASSES[number];
export const CLASS_LABELS:Readonly<Record<ValueClass,string>>=Object.freeze({'trrc-public-record':'TRRC public record',calculated:'Calculated','derived-with-assumption':'Derived from TRRC with a stated assumption',synthetic:"Synthetic: you'd gather",'raw-not-verified':'Raw TRRC field, not verified'});
export const TOOL_LABELS:Readonly<Record<string,string>>=Object.freeze({publicTrends:'Injector history',history:'Histories',forecast:'Fit & forecast',comparison:'Capacity assessment',sensitivity:'Parameter sweeps',pvt:'Brine PVT',hydraulics:'Hydraulics',pressureSupport:'Pressure-support context'});
export type SampleValue=string|number|null;
export type SampleInput={key:string;label:string;value:SampleValue;unit:string|null;class:ValueClass;source:string;tools:string[];trrcField?:string;assumption?:string;derivedFrom?:string[]};
export type GatherItem={key:string;label:string;why:string;tools:string[]};
export type TrrcIdentity={origin:'pinned-explorer'|'explorer-package';artifactId:string;manifestSha256:string;normalizedSha256:string;firstMonth:string;lastMonth:string;package?:{path:string;sha256:string;bytes:number}};
export type SampleWell={id:string;label:string;trrc:TrrcIdentity;inputs:SampleInput[]};
export type SampleCase={version:string;caseId:string;name:string;producers:{fixtureId:string;class:'synthetic'};wells:SampleWell[];shared:SampleInput[];gatherOnly:GatherItem[]};
export type TrrcArtifact={artifactId:string;inventory:Record<string,unknown>[];injectionMonthly:{period_start:string}[]};
export type TrrcPin={manifestSha256?:string;normalizedSha256?:string};
export type ChecklistRow={item:string;well:string;class:string;source:string;units:string;neededBy:string};

const HASH=/^[a-f0-9]{64}$/;
const PRESSURE_RELABEL=/bottom\s*-?\s*hole|\bbhp\b|reservoir pressure/i;
const IDENTIFIER_FIELDS=new Set(['uic_number','api_no','operator_number','district_code','lease_number','well_no_display']);
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);

export function deriveSurfaceLimitPsia(permitPsi:number):number{if(!Number.isFinite(permitPsi)||permitPsi<=0)throw Error('Permit pressure must be a positive finite number');return permitPsi+ATMOSPHERIC_PSI;}
export function deriveDatumTvdFt(permittedTopFt:number):number{if(!Number.isFinite(permittedTopFt)||permittedTopFt<=0)throw Error('Permitted top depth must be a positive finite number');return permittedTopFt;}

/** Missing TRRC values stay null; identifiers keep their original string form. */
export function sourceValue(artifact:TrrcArtifact,field:string):SampleValue{
 if(field==='injectionMonthly.length')return artifact.injectionMonthly.length;
 const value=artifact.inventory[0]?.[field];
 if(value===undefined||value===null||value==='')return null;
 if(typeof value==='string'||typeof value==='number')return value;
 throw Error(`TRRC field ${field} is not a scalar value`);
}

function checkInputs(inputs:unknown,where:string,issues:string[],sharedOnly:boolean){
 if(!Array.isArray(inputs)){issues.push(`${where}: inputs must be an array`);return;}
 const seen=new Map<string,Record<string,unknown>>();
 for(const input of inputs){
  if(!isObject(input)){issues.push(`${where}: each input must be an object`);continue;}
  const key=typeof input.key==='string'?input.key:'',at=`${where}.${key||'?'}`;
  if(!key)issues.push(`${where}: input key is required`);else if(seen.has(key))issues.push(`${at}: duplicate key`);else seen.set(key,input);
  if(!VALUE_CLASSES.includes(input.class as ValueClass))issues.push(`${at}: class must be exactly one of ${VALUE_CLASSES.join(', ')}`);
  if(sharedOnly&&input.class!=='synthetic')issues.push(`${at}: shared inputs are synthetic only`);
  if(!(input.value===null||typeof input.value==='string'||typeof input.value==='number'&&Number.isFinite(input.value)))issues.push(`${at}: value must be a string, a finite number or null`);
  if(typeof input.label!=='string'||!input.label)issues.push(`${at}: label is required`);
  if(typeof input.source!=='string'||!input.source)issues.push(`${at}: source is required`);
  if(!Array.isArray(input.tools)||!input.tools.length||input.tools.some(t=>!(String(t) in TOOL_LABELS)))issues.push(`${at}: tools must name known tools`);
  if(input.class==='trrc-public-record'){
   if(typeof input.trrcField!=='string'||!input.trrcField)issues.push(`${at}: TRRC values must name their source field`);
   if(PRESSURE_RELABEL.test(String(input.label))||PRESSURE_RELABEL.test(key))issues.push(`${at}: a TRRC value is never labelled as bottomhole or reservoir pressure`);
   if(IDENTIFIER_FIELDS.has(String(input.trrcField))&&input.value!==null&&typeof input.value!=='string')issues.push(`${at}: identifiers stay original strings`);
  }
  if(input.class==='derived-with-assumption'){
   if(typeof input.assumption!=='string'||!input.assumption.trim())issues.push(`${at}: derived values must name their assumption`);
   if(!Array.isArray(input.derivedFrom)||!input.derivedFrom.length)issues.push(`${at}: derived values must name their TRRC inputs`);
  }
 }
 for(const [key,input] of seen)if(input.class==='derived-with-assumption'&&Array.isArray(input.derivedFrom))for(const from of input.derivedFrom)if(seen.get(String(from))?.class!=='trrc-public-record')issues.push(`${where}.${key}: derived from ${String(from)}, which is not a TRRC public record in this well`);
}

export function validateSampleCase(raw:unknown):string[]{
 const issues:string[]=[];
 if(!isObject(raw))return ['Sample case must be a JSON object'];
 if(raw.version!==SAMPLE_CASE_VERSION)issues.push(`Unsupported sample case version ${String(raw.version)}`);
 if(typeof raw.caseId!=='string'||!raw.caseId)issues.push('caseId is required');
 if(!Array.isArray(raw.wells)||raw.wells.length!==2)issues.push('Exactly two wells are required');
 else raw.wells.forEach((well,i)=>{
  const where=`wells[${i}]`;
  if(!isObject(well)){issues.push(`${where} must be an object`);return;}
  if(typeof well.id!=='string'||!well.id||typeof well.label!=='string'||!well.label)issues.push(`${where}: id and label are required`);
  const t=well.trrc;
  if(!isObject(t)||typeof t.artifactId!=='string'||!HASH.test(String(t.manifestSha256))||!HASH.test(String(t.normalizedSha256)))issues.push(`${where}: TRRC identity requires artifactId and SHA-256 pins`);
  else if(t.origin==='explorer-package'&&(!isObject(t.package)||!HASH.test(String(t.package.sha256))||!Number.isSafeInteger(t.package.bytes)))issues.push(`${where}: package pin requires sha256 and bytes`);
  checkInputs(well.inputs,where,issues,false);
 });
 checkInputs(raw.shared,'shared',issues,true);
 if(!Array.isArray(raw.gatherOnly)||!raw.gatherOnly.length)issues.push('gatherOnly items are required');
 return issues;
}

export function checkTrrcValues(well:SampleWell,artifact:TrrcArtifact,pin:TrrcPin):string[]{
 const issues:string[]=[],at=well.label;
 if(artifact.artifactId!==well.trrc.artifactId)issues.push(`${at}: TRRC artifact ${artifact.artifactId} does not match ${well.trrc.artifactId}`);
 if(pin.manifestSha256!==well.trrc.manifestSha256)issues.push(`${at}: manifest SHA-256 differs from the sample pin`);
 if(pin.normalizedSha256!==well.trrc.normalizedSha256)issues.push(`${at}: normalized SHA-256 differs from the sample pin`);
 if(artifact.inventory.length!==1)issues.push(`${at}: expected exactly one TRRC inventory record`);
 const months=artifact.injectionMonthly.map(r=>r.period_start).sort();
 if(months[0]?.slice(0,7)!==well.trrc.firstMonth||months.at(-1)?.slice(0,7)!==well.trrc.lastMonth)issues.push(`${at}: monthly coverage differs from the sample pin`);
 for(const input of well.inputs){
  if(input.class!=='trrc-public-record'||!input.trrcField)continue;
  let actual:SampleValue;
  try{actual=sourceValue(artifact,input.trrcField);}catch(error){issues.push(`${at}.${input.key}: ${(error as Error).message}`);continue;}
  if(actual!==input.value)issues.push(`${at}.${input.key}: sample value ${JSON.stringify(input.value)} differs from TRRC ${JSON.stringify(actual)}`);
 }
 return issues;
}

function numberOf(inputs:SampleInput[],key:string,where:string):number{
 const value=inputs.find(i=>i.key===key)?.value;
 if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${where}: ${key} must be a finite number`);
 return value;
}
export function checkDerivedValues(well:SampleWell):string[]{
 try{
  const issues:string[]=[],n=(k:string)=>numberOf(well.inputs,k,well.label);
  if(n('surfaceLimitPsia')!==deriveSurfaceLimitPsia(n('permitPressurePsi')))issues.push(`${well.label}: surface limit is not permit pressure + ${ATMOSPHERIC_PSI} psi`);
  if(n('datumTvdFt')!==deriveDatumTvdFt(n('permittedTopFt')))issues.push(`${well.label}: datum is not the top of the permitted interval`);
  return issues;
 }catch(error){return [(error as Error).message];}
}
export function sampleInput(sample:SampleCase,wellIndex:number|'shared',key:string):SampleInput{
 const inputs=wellIndex==='shared'?sample.shared:sample.wells[wellIndex]?.inputs??[];
 const found=inputs.find(i=>i.key===key)??(wellIndex==='shared'?undefined:sample.shared.find(i=>i.key===key));
 if(!found)throw Error(`Sample input ${key} is not defined`);
 return found;
}
export function sampleInjector(well:SampleWell):Injector{
 const n=(k:string)=>numberOf(well.inputs,k,well.label),tvd=n('datumTvdFt');
 const datum=`Top of permitted interval, ${tvd} ft TVD (derived from TRRC; vertical-well assumption); synthetic bottomhole pressures`;
 const injector:Injector={id:well.id,reservoirPsia:n('reservoirPsia'),limitPsia:n('limitPsia'),injectivityStbdPerPsi:n('injectivityStbdPerPsi'),operatingCeilingStbd:n('operatingCeilingStbd'),availability:n('availability'),datum,reservoirDatum:datum,limitDatum:datum,reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute'};
 validateInjector(injector);
 return injector;
}
export function sampleGeometry(well:SampleWell){
 const n=(k:string)=>numberOf(well.inputs,k,well.label);
 return {tvdFt:n('datumTvdFt'),measuredDepthFt:n('measuredDepthFt'),innerDiameterInches:n('innerDiameterInches'),roughnessInches:n('roughnessInches'),surfaceLimitPsia:n('surfaceLimitPsia')};
}
export function sampleFluid(sample:SampleCase){
 const n=(k:string)=>numberOf(sample.shared,k,'shared');
 return {referencePressurePsia:n('referencePressurePsia'),temperatureF:n('temperatureF'),surfaceTemperatureF:n('surfaceTemperatureF'),salinityWtPercent:n('salinityWtPercent')};
}
export function gatherChecklist(sample:SampleCase):ChecklistRow[]{
 const tools=(t:string[])=>t.map(x=>TOOL_LABELS[x]??x).join('; ');
 const row=(input:SampleInput,well:string):ChecklistRow=>({item:input.label,well,class:CLASS_LABELS[input.class],source:input.class==='derived-with-assumption'?`${input.source}; assumption: ${input.assumption}`:input.source,units:input.unit??'',neededBy:tools(input.tools)});
 return [
  ...sample.wells.flatMap(w=>w.inputs.map(i=>row(i,w.label))),
  ...sample.shared.map(i=>row(i,'All wells')),
  ...sample.gatherOnly.map(g=>({item:g.label,well:'All wells',class:"Not in the sample: you'd gather",source:'You gather',units:'',neededBy:`${tools(g.tools)} — ${g.why}`})),
 ];
}
const csvCell=(v:string)=>/[",\r\n]/.test(v)?`"${v.replaceAll('"','""')}"`:v;
export function checklistCsv(rows:ChecklistRow[]):string{
 return ['Item,Well,Class,Source,Units and basis,Needed by',...rows.map(r=>[r.item,r.well,r.class,r.source,r.units,r.neededBy].map(csvCell).join(','))].join('\r\n')+'\r\n';
}
```

- [ ] **Step 4: Write the generator**

Create `APP/scripts/create-sample-case.mjs`:
```js
// Writes the pinned sample case (two real TRRC injectors + labelled synthetic gaps), a byte-exact copy of the
// verified SAND BEND 2D package, and the case's byte pin. Never edits the source fixtures.
// Usage (after compiling): node scripts/create-sample-case.mjs [--out <dir>]  (default data/sample-case)
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';
import {SAMPLE_CASE_VERSION,deriveSurfaceLimitPsia,deriveDatumTvdFt,validateSampleCase,checkTrrcValues,checkDerivedValues,sourceValue} from '../dist/sampleCase.js';

const app=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,app));
const args=process.argv.slice(2),outAt=args.indexOf('--out');
const out=outAt>=0?args[outAt+1]:fileURLToPath(new URL('data/sample-case/',app));
if(!out)throw new Error('--out requires a directory');
const sha=b=>createHash('sha256').update(b).digest('hex');

const pinA=JSON.parse(read('data/explorer-pin.json')),artifactA=JSON.parse(read('data/explorer/normalized.json'));
const tar=read('tests/fixtures/explorer-packages/public-uic000056484.tar'),provenance=JSON.parse(read('tests/fixtures/explorer-packages/provenance.json'));
if(sha(tar)!==provenance.packageSha256||tar.length!==provenance.packageBytes)throw new Error('SAND BEND 2D package does not match its recorded provenance');
const pkg=await verifyExplorerPackage(new Uint8Array(tar));
const INVENTORY='TRRC UIC inventory givw-z9t4',MONTHLY='TRRC H-10 monthly reports qq2j-f2zm';
const ENGINEERING=['comparison','sensitivity','hydraulics'];

function trrc(artifact,key,label,field,unit,tools,dataset=INVENTORY){return {key,label,value:sourceValue(artifact,field),unit,class:'trrc-public-record',source:`${dataset} (${artifact.artifactId})`,trrcField:field,tools};}
function synthetic(key,label,value,unit,tools){return {key,label,value,unit,class:'synthetic',source:'Synthetic sample value — you gather',tools};}
function well({id,label,artifact,pin,origin,packagePin,eng}){
 const months=artifact.injectionMonthly.map(r=>r.period_start).sort();
 const permit=sourceValue(artifact,'permit_liquid_pressure_limit_psi'),top=sourceValue(artifact,'permitted_top_depth_ft');
 return {id,label,trrc:{origin,artifactId:artifact.artifactId,manifestSha256:pin.manifestSha256,normalizedSha256:pin.normalizedSha256,firstMonth:months[0].slice(0,7),lastMonth:months.at(-1).slice(0,7),...(packagePin?{package:packagePin}:{})},inputs:[
  trrc(artifact,'uicNumber','UIC number','uic_number',null,['publicTrends']),
  trrc(artifact,'apiNo','API number','api_no',null,['publicTrends']),
  trrc(artifact,'operatorNumber','Operator number','operator_number',null,['publicTrends']),
  trrc(artifact,'districtCode','District','district_code',null,['publicTrends']),
  trrc(artifact,'leaseName','Lease name','lease_name',null,['publicTrends']),
  trrc(artifact,'wellNoDisplay','Well number','well_no_display',null,['publicTrends']),
  trrc(artifact,'county','County (from the API prefix)','county',null,['publicTrends']),
  trrc(artifact,'permitPressurePsi','Permit maximum injection pressure','permit_liquid_pressure_limit_psi','psi, as permitted (basis not stated)',['publicTrends',...ENGINEERING]),
  trrc(artifact,'permitVolumeBpd','Permit maximum injection volume (for comparison; not a model limit)','permit_liquid_volume_limit_bpd','bbl/day',['publicTrends']),
  trrc(artifact,'permittedTopFt','Permitted interval top','permitted_top_depth_ft','ft',['publicTrends','comparison','hydraulics']),
  trrc(artifact,'permittedBottomFt','Permitted interval bottom','permitted_bottom_depth_ft','ft',['publicTrends']),
  trrc(artifact,'monthlyRows','Monthly injected liquid and reported injection pressure','injectionMonthly.length','months of H-10 reports; bbl and psi (basis unspecified)',['publicTrends'],MONTHLY),
  {key:'surfaceLimitPsia',label:'Surface pressure limit (absolute)',value:deriveSurfaceLimitPsia(permit),unit:'psia at wellhead',class:'derived-with-assumption',source:'Derived from the TRRC permit maximum injection pressure',derivedFrom:['permitPressurePsi'],assumption:'The permit limit is gauge pressure at the surface, and atmospheric pressure is 14.7 psi.',tools:ENGINEERING},
  {key:'datumTvdFt',label:'Formation datum true vertical depth',value:deriveDatumTvdFt(top),unit:'ft TVD below wellhead',class:'derived-with-assumption',source:'Derived from the TRRC permitted interval top',derivedFrom:['permittedTopFt'],assumption:'The top of the permitted interval is the datum, and the well is vertical to the datum.',tools:ENGINEERING},
  synthetic('reservoirPsia','Reservoir pressure at datum',eng.reservoirPsia,'psia, bottomhole at datum',ENGINEERING),
  synthetic('limitPsia','Bottomhole pressure limit at datum',eng.limitPsia,'psia, bottomhole at datum',ENGINEERING),
  synthetic('injectivityStbdPerPsi','Injectivity index J',eng.j,'STB/day/psi',ENGINEERING),
  synthetic('operatingCeilingStbd','Operating rate ceiling',eng.ceiling,'STB/day',ENGINEERING),
  synthetic('availability','Availability',0.9,'fraction of calendar time',['comparison','sensitivity']),
  synthetic('measuredDepthFt','Measured depth to datum',eng.md,'ft',['comparison','hydraulics']),
  synthetic('innerDiameterInches','Tubing inner diameter',eng.tubingId,'in',ENGINEERING),
  synthetic('roughnessInches','Tubing absolute roughness',0.0006,'in',['comparison','hydraulics']),
 ]};
}
const sample={version:SAMPLE_CASE_VERSION,caseId:'swd-sample-case/uic000020838+uic000056484/v1',name:'Sample case — TRRC record + synthetic gaps',
 producers:{fixtureId:'synthetic-water/seed-417/v1',class:'synthetic'},
 wells:[
  well({id:'UIC-000020838',label:'UIC 000020838',artifact:artifactA,pin:pinA,origin:'pinned-explorer',eng:{reservoirPsia:2400,limitPsia:3600,j:5,ceiling:9000,md:5200,tubingId:3.958}}),
  well({id:'UIC-000056484',label:'SAND BEND 2D · UIC 000056484',artifact:pkg.artifact,pin:pkg.pin,origin:'explorer-package',packagePin:{path:'public-uic000056484.tar',sha256:provenance.packageSha256,bytes:provenance.packageBytes},eng:{reservoirPsia:1400,limitPsia:2100,j:0.5,ceiling:1000,md:3028,tubingId:2.441}}),
 ],
 shared:[
  {key:'producerHistories',label:'Monthly producer water (and oil) volumes',value:'synthetic-water/seed-417/v1',unit:'STB/day, calendar-day basis',class:'synthetic',source:'Synthetic seed-417 producers — you gather',tools:['history','forecast','comparison']},
  {key:'producerSchedules',label:'New-producer schedule (start, ramp, availability)',value:'Seed-417 demo defaults',unit:'date; months; fraction',class:'synthetic',source:'Synthetic schedule — you gather',tools:['comparison','sensitivity']},
  synthetic('referencePressurePsia','Brine reference pressure',2400,'psia',['comparison','pvt','hydraulics']),
  synthetic('temperatureF','Bottomhole temperature',150,'°F',['comparison','pvt','hydraulics']),
  synthetic('surfaceTemperatureF','Surface temperature',80,'°F',['comparison','hydraulics']),
  synthetic('salinityWtPercent','Brine salinity (NaCl)',8,'wt%',['comparison','pvt','hydraulics']),
 ],
 gatherOnly:[
  {key:'pressureBasis',label:'Basis and datum of reported injection pressure',why:'TRRC reports injection pressure without a stated basis; it is never treated as bottomhole pressure',tools:['publicTrends']},
  {key:'bottomholePressure',label:'Measured bottomhole pressure and well tests (step-rate, falloff)',why:'Needed to calibrate J and reservoir pressure',tools:['comparison','sensitivity']},
  {key:'annulusData',label:'Annulus pressure records',why:'Not in the TRRC data the Explorer reads; no annulus values are synthesized',tools:['publicTrends']},
  {key:'fracDates',label:'Frac and treatment dates',why:'Used by the pressure-support context view',tools:['pressureSupport']},
  {key:'associations',label:'Producer–injector associations and distances',why:'Not built in the Explorer yet (planned, RRC-07)',tools:['pressureSupport']},
 ]};
const issues=[...validateSampleCase(sample),...checkTrrcValues(sample.wells[0],artifactA,pinA),...checkTrrcValues(sample.wells[1],pkg.artifact,pkg.pin),...sample.wells.flatMap(checkDerivedValues)];
if(issues.length)throw new Error('Sample case rejected:\n'+issues.join('\n'));
const bytes=Buffer.from(JSON.stringify(sample,null,2)+'\n','utf8');
const pin={file:'sample-case.json',caseId:sample.caseId,version:SAMPLE_CASE_VERSION,sha256:sha(bytes),bytes:bytes.length,
 wells:sample.wells.map(w=>({id:w.id,artifactId:w.trrc.artifactId,origin:w.trrc.origin,...(w.trrc.package?{packageSha256:w.trrc.package.sha256}:{})}))};
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'sample-case.json'),bytes);writeFileSync(join(out,'public-uic000056484.tar'),tar);writeFileSync(join(out,'pin.json'),JSON.stringify(pin,null,2)+'\n');
console.log(`${pin.caseId} ${pin.sha256} ${pin.bytes} bytes`);
```

- [ ] **Step 5: Compile, generate and run the tests**

Run (ROOT): `node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json`
Expected: exit 0, no output.

Run (APP): `node scripts/create-sample-case.mjs`
Expected: one line, `swd-sample-case/uic000020838+uic000056484/v1 <64-hex> <n> bytes`.

Run (APP): `node --test tests/sample-case.test.mjs`
Expected: all tests PASS. If `known TRRC values` fails on `leaseName` for Well B, inspect `pkg.artifact.inventory[0].lease_name` and correct **the test**, never the data: the generator copies TRRC values verbatim.

- [ ] **Step 6: Run the nested suite**

Run (ROOT): `node scripts/check-analytics.mjs`
Expected: PASS. The snapshot runner includes the new test file.

- [ ] **Step 7: Commit**

```bash
git add swd-injection-analytics/src/sampleCase.ts swd-injection-analytics/scripts/create-sample-case.mjs swd-injection-analytics/data/sample-case swd-injection-analytics/tests/sample-case.test.mjs
git commit -m "Add pinned two-well sample case contract, generator and data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Browser sample loader (verify before decode)

**Files:**
- Create: `APP/web/sample-case.mjs`
- Test: `APP/tests/sample-case.test.mjs` (append)

**Interfaces:**
- Consumes: everything listed under Task 2's "Produces"; `verifyExplorerPackage`, `EXPLORER_PACKAGE_LIMITS` from `./explorer-package.mjs`; `explorerCalculationGate` from `./explorer-eligibility.mjs`.
- Produces:
  - `PINNED_SAMPLE` (frozen `{url,sha256,bytes,version}`) and `MAX_SAMPLE_BYTES`.
  - `loadSampleCase({fetch,signal,publicEvidence,pinned}):Promise<SampleSession>`, where `SampleSession` = frozen `{sample, sha256, caseId, injectors:Injector[], geometry:object[], fluid, selections:[{wellId,label,artifact,pin,preview?,calculationEligibility?,imported:boolean}], checklist:ChecklistRow[]}`.
  - `sampleProvenanceRows(sample):string[][]`
  - `annotateInput(input, sampleInput, doc)`
  - `markEdited(scope, text)`
  - `sampleReportCard(session, doc):HTMLElement`

- [ ] **Step 1: Write the failing tests**

Append to `APP/tests/sample-case.test.mjs`:
```js
const loader=await import('../web/sample-case.mjs');
const {explorerCalculationGate}=await import('../web/explorer-eligibility.mjs');
const fileFetch=(tamper)=>async url=>{const b=new Uint8Array(await bytes(url.replace(/^\//,'')));if(tamper&&url.endsWith(tamper))b[b.length-3]^=1;return new Response(b);};
const publicEvidence=()=>({artifact:artifactA,pin:pinA});
test('PINNED_SAMPLE matches the generated pin',()=>{assert.equal(loader.PINNED_SAMPLE.sha256,pin.sha256);assert.equal(loader.PINNED_SAMPLE.bytes,pin.bytes);assert.equal(loader.PINNED_SAMPLE.url,'/data/sample-case/sample-case.json');});
test('loader verifies both wells and builds two real injectors',async()=>{const s=await loader.loadSampleCase({fetch:fileFetch(),publicEvidence});assert.equal(s.caseId,pin.caseId);assert.deepEqual(s.injectors.map(i=>i.id),['UIC-000020838','UIC-000056484']);assert.equal(s.selections.length,2);assert.equal(explorerCalculationGate(s.selections[0],{imported:s.selections[0].imported}).ready,true);assert.equal(explorerCalculationGate(s.selections[1],{imported:s.selections[1].imported}).ready,true);assert.equal(s.geometry[1].surfaceLimitPsia,1514.7);assert.ok(Object.isFrozen(s));});
test('each well keeps its own coverage and artifact',async()=>{const s=await loader.loadSampleCase({fetch:fileFetch(),publicEvidence});const [a,b]=s.selections;assert.equal(a.artifact.injectionMonthly.length,28);assert.equal(b.artifact.injectionMonthly.length,16);assert.notEqual(a.artifact.artifactId,b.artifact.artifactId);});
test('a tampered sample byte is rejected before decoding',async()=>{await assert.rejects(loader.loadSampleCase({fetch:fileFetch('sample-case.json'),publicEvidence}),/SHA-256 mismatch.*not decoded/s);});
test('a tampered package byte is rejected before decoding',async()=>{await assert.rejects(loader.loadSampleCase({fetch:fileFetch('.tar'),publicEvidence}),/SHA-256 mismatch.*not decoded/s);});
test('a TRRC mismatch for either well refuses the load',async()=>{const changed={...artifactA,inventory:[{...artifactA.inventory[0],permit_liquid_pressure_limit_psi:2700}]};await assert.rejects(loader.loadSampleCase({fetch:fileFetch(),publicEvidence:()=>({artifact:changed,pin:pinA})}),/permitPressurePsi/);});
test('the load waits for nothing it cannot verify',async()=>{await assert.rejects(loader.loadSampleCase({fetch:fileFetch(),publicEvidence:()=>({artifact:null,pin:null})}),/not loaded yet/);});
test('provenance rows label every input with one class',()=>{const rows=loader.sampleProvenanceRows(sample);assert.equal(rows.length,sample.wells.reduce((n,w)=>n+w.inputs.length,0)+sample.shared.length);for(const r of rows)assert.ok(Object.values(sc.CLASS_LABELS).includes(r[4]),r.join('|'));});
test('editing an annotated value replaces its provenance claim',()=>{const listeners={};const note={textContent:'',dataset:{},className:''};const input={addEventListener:(name,fn)=>{listeners[name]=fn;},closest:()=>({querySelector:()=>null,append:()=>{}})};const doc={createElement:()=>note};loader.annotateInput(input,{class:'derived-with-assumption',assumption:'A stated assumption.'},doc);assert.match(note.textContent,/Derived from TRRC.*A stated assumption/);listeners.input();assert.match(note.textContent,/Edited by you/);assert.equal(note.dataset.class,'edited');});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (APP): `node --test tests/sample-case.test.mjs`
Expected: the new tests FAIL with `ERR_MODULE_NOT_FOUND` for `web/sample-case.mjs`.

- [ ] **Step 3: Write `web/sample-case.mjs`**

Read `data/sample-case/pin.json` and copy its `sha256` and `bytes` values into `PINNED_SAMPLE` below, replacing the two `PIN_` markers before saving. The test above fails if they drift.

```js
import {validateSampleCase,checkTrrcValues,checkDerivedValues,sampleInjector,sampleGeometry,sampleFluid,gatherChecklist,checklistCsv,CLASS_LABELS} from '../dist/sampleCase.js';
import {verifyExplorerPackage,EXPLORER_PACKAGE_LIMITS} from './explorer-package.mjs';

/** Sample case: two real TRRC injectors + labelled synthetic gaps. Session-only; never mixed with customer data. */
export const PINNED_SAMPLE=Object.freeze({url:'/data/sample-case/sample-case.json',sha256:'PIN_SHA256',bytes:PIN_BYTES,version:'swd-sample-case/1'});
export const MAX_SAMPLE_BYTES=1024*1024;
const hex=buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');

/** Size is checked before hashing, and bytes are verified before any decoding. */
async function pinnedBytes(fetch,url,{sha256,bytes},max,signal,label){
 const response=await fetch(url,{signal,cache:'no-store'});
 if(!response.ok)throw new Error(`${label} unavailable (HTTP ${response.status}).`);
 const buffer=await response.arrayBuffer();signal?.throwIfAborted();
 if(buffer.byteLength>max||buffer.byteLength!==bytes)throw new Error(`${label} has ${buffer.byteLength} bytes; expected ${bytes}. It was not decoded.`);
 const actual=hex(await crypto.subtle.digest('SHA-256',buffer));signal?.throwIfAborted();
 if(actual!==sha256)throw new Error(`${label}: SHA-256 mismatch: expected ${sha256}, received ${actual}. It was not decoded.`);
 return new Uint8Array(buffer);
}

export async function loadSampleCase({fetch=globalThis.fetch,signal,publicEvidence,pinned=PINNED_SAMPLE}={}){
 const caseBytes=await pinnedBytes(fetch,pinned.url,pinned,MAX_SAMPLE_BYTES,signal,'Sample case');
 const sample=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(caseBytes));
 const contract=validateSampleCase(sample);
 if(contract.length)throw new Error(`Sample case rejected: ${contract.join('; ')}`);
 const [wellA,wellB]=sample.wells;
 const pub=publicEvidence?.();
 if(!pub?.artifact||!pub?.pin)throw new Error('The pinned TRRC Explorer record for UIC 000020838 is not loaded yet. Try again in a moment.');
 const packageUrl=new URL(wellB.trrc.package.path,new URL(pinned.url,'http://local/')).pathname;
 const pkgBytes=await pinnedBytes(fetch,packageUrl,wellB.trrc.package,EXPLORER_PACKAGE_LIMITS.packageBytes,signal,'SAND BEND 2D package');
 const pkg=await verifyExplorerPackage(pkgBytes,{signal});
 const issues=[...checkTrrcValues(wellA,pub.artifact,pub.pin),...checkTrrcValues(wellB,pkg.artifact,pkg.pin),...sample.wells.flatMap(checkDerivedValues)];
 if(issues.length)throw new Error(`Sample case does not match its TRRC records; it was not loaded. ${issues.join('; ')}`);
 return Object.freeze({sample,sha256:pinned.sha256,caseId:sample.caseId,injectors:sample.wells.map(sampleInjector),geometry:sample.wells.map(sampleGeometry),fluid:sampleFluid(sample),
  selections:Object.freeze([Object.freeze({wellId:wellA.id,label:wellA.label,artifact:pub.artifact,pin:pub.pin,imported:false}),Object.freeze({wellId:wellB.id,label:wellB.label,...pkg,imported:true})]),
  checklist:gatherChecklist(sample)});
}

const fmtValue=v=>v===null?'Not reported':typeof v==='number'?v.toLocaleString('en-US',{maximumFractionDigits:4}):String(v);
export function sampleProvenanceRows(sample){
 return [...sample.wells.flatMap(w=>w.inputs.map(i=>[w.label,i.label,fmtValue(i.value),i.unit??'',CLASS_LABELS[i.class],i.assumption??''])),
  ...sample.shared.map(i=>['All wells',i.label,fmtValue(i.value),i.unit??'',CLASS_LABELS[i.class],i.assumption??''])];
}

/** Shows a value's class next to a pre-filled field; any later edit removes the sample claim. */
export function annotateInput(input,sampleInput,doc=document){
 if(!input)return;
 const holder=input.closest('label')??input.parentElement;holder?.querySelector('.sample-class')?.remove();
 const note=doc.createElement('small');note.className='sample-class';note.dataset.class=sampleInput.class;
 note.textContent=CLASS_LABELS[sampleInput.class]+(sampleInput.assumption?` — assumption: ${sampleInput.assumption}`:'');
 holder?.append(note);
 input.addEventListener('input',()=>{note.textContent='Edited by you — no longer the sample value';note.dataset.class='edited';},{once:true});
}
export function markEdited(scope,text){for(const note of scope.querySelectorAll('.sample-class')){note.textContent=text;note.dataset.class='edited';}}

export function sampleReportCard(session,doc=document){
 const card=doc.createElement('article');card.className='panel sample-report';card.id='sample-report';
 const h=doc.createElement('h2');h.textContent='Sample case: what you would gather';
 const p=doc.createElement('p');p.textContent=`${session.caseId}. Every input this sample used, with its class, source, units and the tools that need it. TRRC public records came from the pinned Explorer data; for a real analysis you would gather everything else.`;
 const button=doc.createElement('button');button.type='button';button.id='sample-checklist-csv';button.textContent='Download gather checklist (CSV)';
 button.onclick=()=>{const url=URL.createObjectURL(new Blob([checklistCsv(session.checklist)],{type:'text/csv;charset=utf-8'}));const a=doc.createElement('a');a.href=url;a.download='swd-sample-gather-checklist.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
 const table=doc.createElement('table'),caption=doc.createElement('caption'),head=doc.createElement('thead'),body=doc.createElement('tbody');
 caption.textContent='Gather checklist';const hr=doc.createElement('tr');
 for(const label of ['Item','Well','Class','Source','Units and basis','Needed by']){const th=doc.createElement('th');th.scope='col';th.textContent=label;hr.append(th);}
 head.append(hr);
 for(const r of session.checklist){const tr=doc.createElement('tr');for(const v of [r.item,r.well,r.class,r.source,r.units,r.neededBy]){const td=doc.createElement('td');td.textContent=v;tr.append(td);}body.append(tr);}
 table.append(caption,head,body);const wrap=doc.createElement('div');wrap.className='table-wrap';wrap.append(table);
 card.append(h,p,button,wrap);return card;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (APP): `node --test tests/sample-case.test.mjs`
Expected: all tests PASS.

Then run (ROOT): `node scripts/check-analytics.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add swd-injection-analytics/web/sample-case.mjs swd-injection-analytics/tests/sample-case.test.mjs
git commit -m "Add verify-before-decode browser loader for the two-well sample case

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `sample` planning source

**Files:**
- Modify: `APP/web/disposal-context.mjs` (adds a `sample` branch)
- Modify: `APP/web/disposal-case.mjs` (line 39 source label only)
- Modify: `APP/web/workspace-views.mjs` (schedules condition; Reports sample card)
- Modify: `APP/web/import-ui.mjs` (source mode, readiness, metadata, lineage, routing)
- Modify: `APP/web/index.html` (buttons, banner, stylesheet link)
- Test: `APP/tests/sample-case.test.mjs` (append)

**Interfaces:**
- Consumes: `loadSampleCase`, `sampleProvenanceRows`, `sampleReportCard` (Task 3).
- Produces:
  - `disposalContext({source,demo,imported,sample})`. With `source==='sample'`, `sample` is `{caseId, sha256, injectors, producerFixtureSha256}`, and the result has `demand.origin==='sample'`.
  - Module state in `import-ui.mjs`: `sampleSession`, `sampleWellIndex`, `sampleRun`, `sampleTour`, plus a `renderSampleBanner()` function.
  - DOM ids: `sample-load`, `sample-load-data`, `sample-tour-start-home`, `sample-banner`, `sample-banner-detail`, `sample-tour-start`, `sample-cancel`, `sample-clear`, `sample-progress`, `sample-error`.

- [ ] **Step 1: Write the failing tests**

Append to `APP/tests/sample-case.test.mjs`:
```js
const {disposalContext}=await import('../web/disposal-context.mjs');
const {planningFixture}=await import('../dist/planningFixture.js');
const {freezeForecast,planningCase}=await import('../dist/planning.js');
const {INJECTORS}=await import('../dist/engineering.js');
const {buildExhibit}=await import('../dist/exhibit.js');
async function demoEvidence(){const fixture=planningFixture(),frozen=freezeForecast(fixture.actuals);return buildExhibit({frozen,rows:planningCase(frozen,fixture.actuals,INJECTORS),injectors:INJECTORS,controls:{newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000},planningFixture:fixture});}
const sessionFor=demo=>({caseId:sample.caseId,sha256:pin.sha256,injectors:sample.wells.map(sc.sampleInjector),producerFixtureSha256:demo.inputs.planningFixtureSha256});
test('sample context uses the real injectors and the synthetic producer demand',async()=>{const demo=await demoEvidence();const c=disposalContext({source:'sample',demo,sample:sessionFor(demo)});assert.equal(c.ready,true,c.reasons.join(' '));assert.equal(c.demand.origin,'sample');assert.match(c.demand.id,/swd-sample-case/);assert.deepEqual(c.wells.map(w=>w.id),['UIC-000020838','UIC-000056484']);assert.equal(c.demand.evidence.sampleCaseId,sample.caseId);assert.equal(c.demand.monthly.length,demo.outputs.planningDetails.monthly.length);assert.ok(!JSON.stringify(c.wells).includes('FICTIONAL-INJ'));});
test('editing the producer schedule after loading blocks the sample capacity case',async()=>{const demo=await demoEvidence();const c=disposalContext({source:'sample',demo,sample:{...sessionFor(demo),producerFixtureSha256:'0'.repeat(64)}});assert.equal(c.ready,false);assert.match(c.reasons.join(' '),/Reload the sample case/);});
test('sample context without a loaded sample is blocked',async()=>{const c=disposalContext({source:'sample',demo:await demoEvidence(),sample:null});assert.equal(c.ready,false);assert.match(c.reasons.join(' '),/Load the sample case/);});
test('other sources never receive sample wells',async()=>{const demo=await demoEvidence(),s=sessionFor(demo);const d=disposalContext({source:'demo',demo,sample:s});assert.ok(d.wells.every(w=>w.id.startsWith('FICTIONAL-INJ')));for(const source of [null,'public','user'])assert.equal(disposalContext({source,demo,sample:s}).wells.length,0);});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (APP): `node --test tests/sample-case.test.mjs`
Expected: the four new tests FAIL. The sample source is blocked with "Select the synthetic demonstration…", so `ready` is false.

- [ ] **Step 3: Add the `sample` branch in `web/disposal-context.mjs`**

Replace `export function disposalContext({source,demo=null,imported=null}){` with `export function disposalContext({source,demo=null,imported=null,sample=null}){`.

Then insert the following immediately before the line ` if(source!=='user'||!imported)return blocked(`:
```js
 if(source==='sample'){
  if(!sample?.injectors?.length)return blocked('Load the sample case first (Start → Try it with sample data).');
  if(!demo?.inputs?.planningFixture)return blocked('The synthetic sample producers are preparing. Try again in a moment.');
  if(demo.inputs.planningFixtureSha256!==sample.producerFixtureSha256)return blocked('The synthetic producer schedule changed after the sample loaded. Reload the sample case to restore it.');
  try{
   const fixture=demo.inputs.planningFixture;
   const detail=planningDetails(fixture,freezeForecast(fixture.actuals,fixture.cutoff,fixture.actualsId));
   if(JSON.stringify(detail)!==JSON.stringify(demo.outputs.planningDetails))return blocked('Acceptance blocker: sample producer demand does not match its frozen history and schedules. Reload the sample case.');
   sample.injectors.forEach(validateInjector);
   return {ready:true,reasons:[],demand:{id:`${sample.caseId} · ${fixture.id}`,origin:'sample',content:'synthetic producer histories + assumed schedules',monthly:detail.monthly.map(r=>({month:r.month,demandBbl:r.demandBbl})),evidence:evidenceSnapshot({sampleCaseId:sample.caseId,sampleSha256:sample.sha256,planningFixtureSha256:demo.inputs.planningFixtureSha256,planningFixture:fixture,planningDetails:detail})},wells:structuredClone(sample.injectors)};
  }catch(error){return blocked(`Sample input check: ${error.message}`);}
 }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (APP): `node --test tests/sample-case.test.mjs tests/disposal-context.test.mjs`
Expected: all tests PASS. The existing disposal-context tests are unchanged.

- [ ] **Step 5: Label the sample correctly in `web/disposal-case.mjs`**

Replace exactly:
```
${context.demand.origin==='user'?'Confirmed user profiles':'Selected synthetic demonstration'}
```
with:
```
${{user:'Confirmed user profiles',sample:'Sample case (TRRC records + labelled synthetic gaps)'}[context.demand.origin]??'Selected synthetic demonstration'}
```

- [ ] **Step 6: Edit `web/workspace-views.mjs`**

(a) Replace ` if(ctx.source==='demo'){` (in `renderSchedules`; there is one occurrence, so confirm with `grep -c "ctx.source==='demo'" web/workspace-views.mjs` → `1`) with ` if(ctx.source==='demo'||ctx.source==='sample'){`.

(b) In `renderReports`, replace `'Download current result snapshots. Each report retains its own source identity, assumptions and supported formats.');` with:
```js
'Download current result snapshots. Each report retains its own source identity, assumptions and supported formats.');
 if(!evidence&&ctx.sampleReport)root.append(ctx.sampleReport());
```

- [ ] **Step 7: Edit `web/index.html`**

(a) After `<link rel="stylesheet" href="/pressure-support.css">`, add `<link rel="stylesheet" href="/sample-tour.css">`. (Task 7 creates the stylesheet; until then the request 404s harmlessly.)

(b) Replace `<button id="start-guided" class="primary-action" type="button">Start guided assessment</button>` with:
```html
<button id="start-guided" class="primary-action" type="button">Start guided assessment</button><div class="sample-actions"><button id="sample-load" class="primary-action" type="button">Try it with sample data</button><button id="sample-tour-start-home" type="button">Take the guided tour</button><p class="session-note">The sample uses real TRRC records for two injection wells; every other input is labelled synthetic.</p></div>
```

(c) Insert immediately before `<section id="start-workspace" aria-labelledby="start-title">`:
```html
    <section id="sample-banner" class="sample-banner" hidden aria-label="Sample case"><p><strong>Sample case — TRRC record + synthetic gaps</strong> <span id="sample-banner-detail"></span></p><div class="workspace-actions"><button id="sample-tour-start" type="button">Take the guided tour</button><button id="sample-cancel" type="button" hidden>Cancel loading</button><button id="sample-clear" type="button">Clear sample</button></div><ol id="sample-progress" class="sample-progress" role="status" aria-live="polite" hidden></ol><p id="sample-error" class="error" role="alert"></p></section>
```

(d) Insert immediately before `<div class="source-cards">`:
```html
      <div class="sample-source"><button id="sample-load-data" class="primary-action" type="button">Try it with sample data</button><p>Loads two real TRRC injection wells with every gap filled by labelled synthetic inputs, then calculates every main tool.</p></div>
```

- [ ] **Step 8: Edit `web/import-ui.mjs`**

Each edit names the exact existing text. Confirm uniqueness first: run `grep -c "<text>" web/import-ui.mjs` for each anchor and expect `1`.

(a) Imports. After `import {explorerCalculationGate,explorerRowDisposition} from './explorer-eligibility.mjs';`, add:
```js
import {loadSampleCase,sampleProvenanceRows,sampleReportCard} from './sample-case.mjs';
```

(b) State. Replace:
```js
const selectedPublic=()=>importedPublic??publicEvidence();
const publicCalculationGate=()=>explorerCalculationGate(selectedPublic(),{imported:importedPublic!==null});
```
with:
```js
let sampleSession=null,sampleWellIndex=0,sampleRun=null,sampleTour=null;
const sampleSelection=()=>source==='sample'&&sampleSession?sampleSession.selections[sampleWellIndex]:null;
const selectedPublic=()=>sampleSelection()??importedPublic??publicEvidence();
const publicCalculationGate=()=>explorerCalculationGate(selectedPublic(),{imported:sampleSelection()?sampleSelection().imported:importedPublic!==null});
```

(c) Readiness. Insert a new line immediately **after** the line that begins ` if(source==='demo')for(const key of ['history','forecast','reconciliation','groupedPlanning','capacity','comparison'])out[key]=demoEvidence()?`:
```js
 if(source==='sample'){for(const key of ['history','forecast','reconciliation','groupedPlanning'])out[key]=demoEvidence()?{ready:true,reasons:['Sample case: synthetic seed-417 producers.']}:unavailable('The synthetic sample producers are being recalculated.');const c=capacityWorkspaceContext();for(const key of ['capacity','comparison'])out[key]=c.ready?{ready:true,reasons:['Sample case: TRRC records for two real injectors plus labelled synthetic inputs.']}:unavailable(c.reasons.join(' '));out.publicTrends=publicCalculationGate();}
```

(d) Metadata. Insert a new line immediately **before** the line that begins ` if(source==='public'){const p=selectedPublic(),periods=`:
```js
 if(source==='sample'&&sampleSession){if(view==='publicTrends'){const p=selectedPublic(),periods=p.artifact.injectionMonthly.map(r=>r.period_start).sort();return {dataset:p.artifact.artifactId,origin:'sample case · TRRC public record',content:'public reported',sha256:p.pin?.normalizedSha256,manifestSha256:p.pin?.manifestSha256,packageSha256:p.pin?.packageSha256??null,sampleCaseId:sampleSession.caseId,calculationEligibility:publicCalculationGate(),coverage:`${periods[0]} to ${periods.at(-1)}`,units:'Monthly injected liquid bbl; calculated calendar-day bbl/day; reported psi, basis unspecified',assumptions:'No BHP conversion, injectivity inference, source composition or calibrated capacity'};}const demo=demoEvidence();return {dataset:sampleSession.caseId,sha256:sampleSession.sha256,historyId:'synthetic-water/seed-417/v1',origin:'sample case',content:'TRRC public records for two injectors + synthetic producers and engineering inputs',units:'Monthly bbl; STB/day; bottomhole psia',coverage:demo?.inputs.dateRange,assumptions:'Synthetic seed-417 producers; TRRC permit limits converted with stated assumptions; every other engineering input synthetic'};}
```

(e) Data preview. Insert a new line immediately **after** the line that begins ` if(source==='demo'&&demoEvidence()){const fixture=demoEvidence().inputs.planningFixture;preview.append(`:
```js
 if(source==='sample'&&sampleSession)preview.append(table(['Well','Input','Value','Units','Class','Assumption'],sampleProvenanceRows(sampleSession.sample),`${sampleSession.caseId} · every input with its provenance class`));
```

(f) Lineage. Replace:
```
title:source==='demo'?'Synthetic demonstration':importedPublic?'Imported RRC Explorer package':'Pinned RRC Explorer export',cls:source==='demo'?'synthetic':'rrc'
```
with:
```
title:source==='demo'?'Synthetic demonstration':source==='sample'?'Sample case — TRRC record + synthetic gaps':importedPublic?'Imported RRC Explorer package':'Pinned RRC Explorer export',cls:source==='demo'||source==='sample'?'synthetic':'rrc'
```

(g) Capacity context. Replace:
```js
export function capacityWorkspaceContext(){return disposalContext({source,demo:source==='demo'?demoEvidence():null,imported:source==='user'?state.result:null});}
```
with:
```js
export function capacityWorkspaceContext(){return disposalContext({source,demo:source==='demo'||source==='sample'?demoEvidence():null,imported:source==='user'?state.result:null,sample:source==='sample'?sampleSession:null});}
function renderSampleBanner(){$('sample-banner').hidden=!(source==='sample'||sampleRun);if(source!=='sample'&&!sampleRun){$('sample-progress').hidden=true;$('sample-banner-detail').textContent='';}}
```

(h) Source switch. Replace `function switchSource(next){calculationError=null;` with:
```js
function switchSource(next){calculationError=null;if(next!=='sample'){sampleSession=null;sampleWellIndex=0;sampleTour?.exit();}
```
Then replace:
```js
$('import-status').textContent=next==='user'?'Choose a file, inspect original rows, then map fields and original units.':next==='demo'?'Synthetic demo selected. Choose an analysis below; all engineering inputs remain fictional.':'Pinned Explorer export selected. Public injection trends use source-reported observations only.';
```
with:
```js
$('import-status').textContent={user:'Choose a file, inspect original rows, then map fields and original units.',demo:'Synthetic demo selected. Choose an analysis below; all engineering inputs remain fictional.',public:'Pinned Explorer export selected. Public injection trends use source-reported observations only.',sample:'Sample case selected: TRRC records for UIC 000020838 and SAND BEND 2D, with every gap filled by labelled synthetic inputs.'}[next]??'No planning source selected.';renderSampleBanner();
```

(i) Context for workspace views. Replace:
```js
const ctx={source,demo:source==='demo'?demoEvidence():null,bundle:source==='user'?state.result:null,inputs:state.inputs,navigate,preserveControls:!focus};
```
with:
```js
const ctx={source,demo:source==='demo'||source==='sample'?demoEvidence():null,bundle:source==='user'?state.result:null,inputs:state.inputs,navigate,preserveControls:!focus,sampleReport:source==='sample'&&sampleSession?()=>sampleReportCard(sampleSession):null};
```

(j) Injector history routing. Replace `if(next==='publicTrends'&&source!=='public'){` with `if(next==='publicTrends'&&source!=='public'&&source!=='sample'){`.

(k) Sample views. Replace exactly (two lines):
```js
 if(source==='demo'){
  if(next==='capacity'){
```
with:
```js
 if(source==='sample'&&next==='publicTrends'){$('analysis-workspace').hidden=false;$('period-controls').hidden=true;renderPublicResult();return;}
 if(source==='sample'&&(next==='capacity'||next==='legacyCapacity')){$('analysis-workspace').hidden=false;$('period-controls').hidden=true;$('analysis-title').textContent=next==='capacity'?names.capacity:'Original workbook';$('result-message').textContent=next==='capacity'?'In the sample case, each injector’s injectivity, pressures and geometry are entered and checked in Capacity assessment, where every value is labelled TRRC record, derived from TRRC with a stated assumption, or synthetic.':'The original workbook belongs to the synthetic demo. Choose the synthetic demo in Data & sources to open it.';return;}
 if(source==='demo'||source==='sample'&&['history','forecast','reconciliation','groupedPlanning'].includes(next)){
  if(next==='capacity'){
```

(l) Demo refresh. Replace `document.addEventListener('demo-updated',()=>{if(source==='demo'){` with `document.addEventListener('demo-updated',()=>{if(source==='demo'||source==='sample'){`.

(m) Download guard. Replace `source==='public'&&!publicCalculationGate().ready` (one occurrence) with `(source==='public'||source==='sample'&&view==='publicTrends')&&!publicCalculationGate().ready`.

(n) Buttons, a minimal load without the tool steps (Task 6 replaces the body of `startSample`). Insert new lines immediately **after** the line containing `$('change-source').onclick=()=>navigate('data');`:
```js
async function startSample(){
 explorerHandoff?.cancel('source-changed','Sample case selected.');packageReceiver.cancel();
 sampleRun?.abort();const run=new AbortController();sampleRun=run;$('sample-error').textContent='';renderSampleBanner();
 try{const session=await loadSampleCase({signal:run.signal,publicEvidence});if(sampleRun!==run)return;sampleSession={...session,producerFixtureSha256:demoEvidence()?.inputs.planningFixtureSha256??null};sampleWellIndex=0;switchSource('sample');}
 catch(error){if(error?.name!=='AbortError'&&sampleRun===run)$('sample-error').textContent=error.message;}
 finally{if(sampleRun===run){sampleRun=null;renderSampleBanner();}}
}
for(const id of ['sample-load','sample-load-data'])$(id).onclick=()=>{startSample();};
$('sample-clear').onclick=()=>{sampleRun?.abort();sampleRun=null;switchSource(null);};
```

- [ ] **Step 9: Run the tests and the nested suite**

Run (APP): `node --test tests/sample-case.test.mjs tests/disposal-context.test.mjs tests/workspace.test.mjs tests/navigation.test.mjs tests/readiness.test.mjs`
Expected: all PASS.

Run (ROOT): `node scripts/check-analytics.mjs`
Expected: PASS.

- [ ] **Step 10: Browser smoke check**

Run (ROOT):
```bash
node scripts/prepare-swd.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4290 --strictPort
```
The second command runs in the background. Open `http://127.0.0.1:4290/analytics/index.html#start/start` and click **Try it with sample data**.

Expected:
- The banner shows "Sample case — TRRC record + synthetic gaps".
- Data & sources lists every input with its class.
- Histories shows the seed-417 producers.
- Capacity assessment lists two wells, `UIC-000020838` and `UIC-000056484`, with the source label "Sample case (TRRC records + labelled synthetic gaps)".
- **Clear sample** returns the active dataset to "None selected".

Stop the server afterwards.

- [ ] **Step 11: Commit**

```bash
git add swd-injection-analytics/web/disposal-context.mjs swd-injection-analytics/web/disposal-case.mjs swd-injection-analytics/web/workspace-views.mjs swd-injection-analytics/web/import-ui.mjs swd-injection-analytics/web/index.html swd-injection-analytics/tests/sample-case.test.mjs
git commit -m "Add sample planning source with two real TRRC injectors and labelled synthetic producers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Injector history well switch

**Files:**
- Modify: `APP/web/index.html`
- Modify: `APP/web/import-ui.mjs`

**Interfaces:**
- Consumes: `sampleSession.selections`, `sampleWellIndex` (Task 4).
- Produces: DOM `#sample-well-switch` (a fieldset with radios `name="sample-well"`, values `0` and `1`). Task 7's tour targets it.

- [ ] **Step 1: Add the switch to `web/index.html`**

Replace `<p id="result-context"></p>` (one occurrence) with:
```html
<p id="result-context"></p><fieldset id="sample-well-switch" class="sample-well-switch" hidden><legend>Well</legend><label><input type="radio" name="sample-well" value="0" checked> UIC 000020838 · 28 months</label><label><input type="radio" name="sample-well" value="1"> SAND BEND 2D · UIC 000056484 · 16 months</label></fieldset>
```

- [ ] **Step 2: Wire it in `web/import-ui.mjs`**

(a) Replace `$('main').dataset.view=next;` (one occurrence) with:
```js
$('main').dataset.view=next;$('sample-well-switch').hidden=!(source==='sample'&&next==='publicTrends');
```

(b) After the `$('sample-clear').onclick=...` line added in Task 4, add:
```js
for(const radio of document.querySelectorAll('input[name="sample-well"]'))radio.onchange=()=>{if(source!=='sample'||!sampleSession)return;sampleWellIndex=Number(radio.value);clearResults();readiness();navigate('publicTrends',{record:false});};
```

(c) In `startSample`, after `sampleWellIndex=0;`, add `document.querySelector('input[name="sample-well"][value="0"]').checked=true;`.

- [ ] **Step 3: Browser check**

Rebuild and serve as in Task 4, Step 10. Load the sample, then open **Injector history**.

Expected:
- The **Well** switch is visible, and the chart shows 28 months for UIC 000020838.
- Switching to SAND BEND 2D shows 16 months, Jan 2024–Apr 2025.
- Downloading JSON on each well gives a file whose `metadata.dataset` is that well's artifact ID, and only that well's rows.
- On the **Demo** source, the switch is hidden.

- [ ] **Step 4: Run the nested suite and commit**

Run (ROOT): `node scripts/check-analytics.mjs`
Expected: PASS.

```bash
git add swd-injection-analytics/web/index.html swd-injection-analytics/web/import-ui.mjs
git commit -m "Add sample-only Injector history well switch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: One-click tool steps (progress, failure, cancel)

**Files:**
- Create: `APP/web/sample-steps.mjs`
- Modify: `APP/web/import-ui.mjs` (replaces the body of `startSample`)
- Test: `APP/tests/sample-steps.test.mjs`

**Interfaces:**
- Consumes: `annotateInput`, `markEdited` (Task 3); `sampleInput` from `dist/sampleCase.js`; existing DOM ids:
  - `disposal-form`, `disposal-wells`, `disposal-name`, `disposal-pressure`, `disposal-temperature`, `disposal-salinity`, `disposal-model`, `disposal-surface-temperature`, `disposal-error`, `disposal-illustrative`
  - `sensitivity-form`, `sensitivity-calculate`, `sensitivity-json`, `sensitivity-error`
  - `pvt-form`, `pvt-name`, `pvt-temperature`, `pvt-salinity`, `pvt-min`, `pvt-max`, `pvt-error`, `pvt-status`
  - `hyd-form`, `hyd-error`
  - `pressure-support-workspace`, `pressure-support-json`
  - The document event `disposal-case-result`.
- Produces:
  - `runSampleSteps(steps,{signal,onProgress}):Promise<string[]>`
  - `waitFor(check,{signal,timeoutMs,intervalMs,label})`
  - `waitForEvent(target,name,{signal,timeoutMs,failWhen})`
  - `resetDemoControls(doc)`
  - `sampleSteps({verify,select,navigate,session,doc}):{label,run}[]` (7 steps)

- [ ] **Step 1: Write the failing tests**

Create `APP/tests/sample-steps.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {runSampleSteps,waitFor,sampleSteps} from '../web/sample-steps.mjs';

const step=(label,log,fn=async()=>{})=>({label,run:async ctx=>{log.push(label);await fn(ctx);}});
test('steps run in order and report progress',async()=>{const log=[],progress=[];const done=await runSampleSteps([step('a',log),step('b',log)],{onProgress:p=>progress.push(`${p.index}:${p.status}`)});assert.deepEqual(log,['a','b']);assert.deepEqual(done,['a','b']);assert.deepEqual(progress,['0:running','0:done','1:running','1:done']);});
test('the first failure stops the run and names the failed step',async()=>{const log=[];await assert.rejects(runSampleSteps([step('a',log),step('b',log,async()=>{throw Error('boom');}),step('c',log)]),e=>{assert.match(e.message,/Step 2 of 3 failed — b: boom/);assert.deepEqual(e.completed,['a']);return true;});assert.deepEqual(log,['a','b']);});
test('cancelling stops before the next step',async()=>{const log=[],controller=new AbortController();await assert.rejects(runSampleSteps([step('a',log,async()=>controller.abort()),step('b',log)],{signal:controller.signal}),{name:'AbortError'});assert.deepEqual(log,['a']);});
test('waitFor resolves, times out and aborts',async()=>{let n=0;assert.equal(await waitFor(()=>++n>2&&'ok',{intervalMs:1}),'ok');await assert.rejects(waitFor(()=>false,{timeoutMs:20,intervalMs:5,label:'thing'}),/Timed out waiting for thing/);const c=new AbortController();const p=waitFor(()=>false,{signal:c.signal,intervalMs:5});c.abort();await assert.rejects(p,{name:'AbortError'});});
test('the one-click sequence follows the spec order',()=>{const labels=sampleSteps({verify:async()=>{},select:async()=>{},navigate:()=>{},session:()=>null,doc:{}}).map(s=>s.label);assert.deepEqual(labels,['Verify the sample and both TRRC records','Select the sample as the planning source','Load and calculate the pressure-support example','Calculate the capacity assessment','Run the default parameter sweep','Calculate brine PVT','Calculate hydraulics']);});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (APP): `node --test tests/sample-steps.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write `web/sample-steps.mjs`**

```js
import {sampleInput} from '../dist/sampleCase.js';
import {annotateInput,markEdited} from './sample-case.mjs';

const aborted=signal=>signal?.reason instanceof Error&&signal.reason.name==='AbortError'?signal.reason:new DOMException('Sample loading cancelled.','AbortError');

/** Runs existing workspace actions in order; stops at the first failure and names it. */
export async function runSampleSteps(steps,{signal,onProgress=()=>{}}={}){
 const done=[];
 for(const [index,step] of steps.entries()){
  if(signal?.aborted)throw aborted(signal);
  onProgress({index,total:steps.length,label:step.label,status:'running'});
  try{await step.run({signal});}
  catch(error){
   if(error?.name==='AbortError'||signal?.aborted)throw aborted(signal);
   onProgress({index,total:steps.length,label:step.label,status:'failed'});
   const failure=new Error(`Step ${index+1} of ${steps.length} failed — ${step.label}: ${error.message}`);failure.step=step.label;failure.completed=done.slice();throw failure;
  }
  done.push(step.label);onProgress({index,total:steps.length,label:step.label,status:'done'});
 }
 return done;
}
export function waitFor(check,{signal,timeoutMs=20000,intervalMs=50,label='the expected result'}={}){
 return new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(signal?.aborted){reject(aborted(signal));return;}let value;try{value=check();}catch(error){reject(error);return;}if(value){resolve(value);return;}if(Date.now()-started>timeoutMs){reject(new Error(`Timed out waiting for ${label}`));return;}setTimeout(tick,intervalMs);};tick();});
}
export function waitForEvent(target,name,{signal,timeoutMs=60000,failWhen=()=>null}={}){
 return new Promise((resolve,reject)=>{let timer=null,poll=null;const finish=fn=>value=>{target.removeEventListener(name,onEvent);clearTimeout(timer);clearInterval(poll);fn(value);};const onEvent=finish(resolve);const fail=finish(reject);
  target.addEventListener(name,onEvent,{once:true});timer=setTimeout(()=>fail(new Error(`Timed out waiting for ${name}`)),timeoutMs);
  poll=setInterval(()=>{if(signal?.aborted)fail(aborted(signal));else{const message=failWhen();if(message)fail(new Error(message));}},50);});
}
/** Restores the demo producer controls to the page defaults so the sample's producers are reproducible. */
export function resetDemoControls(doc=document){
 const form=doc.getElementById('controls');
 for(const control of form.querySelectorAll('input,select')){if(control.tagName==='SELECT'){const d=[...control.options].find(o=>o.defaultSelected)??control.options[0];if(d)control.value=d.value;}else control.value=control.defaultValue;}
 form.querySelector('input,select')?.dispatchEvent(new Event('input',{bubbles:true}));
}
function setValue(input,value){if(!input)throw new Error('A required sample field is missing from the page.');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
const text=el=>el?.textContent.trim()??'';

export function sampleSteps({verify,select,navigate,session,doc=document}){
 const $=id=>doc.getElementById(id);
 const fill=(input,wellIndex,key)=>{const s=session(),meta=sampleInput(s.sample,wellIndex,key);setValue(input,meta.value);annotateInput(input,meta,doc);};
 return [
  {label:'Verify the sample and both TRRC records',run:verify},
  {label:'Select the sample as the planning source',run:select},
  {label:'Load and calculate the pressure-support example',run:async({signal})=>{
   navigate('pressureSupport');const root=$('pressure-support-workspace');
   const load=[...root.querySelectorAll('button')].find(b=>/synthetic example$|^Retry load$/.test(text(b)));
   if(!load)throw new Error('The pressure-support load button was not found.');
   if(!/^Reload/.test(text(load))){load.click();await waitFor(()=>{const e=[...root.querySelectorAll('.error')].map(text).find(Boolean);if(e)throw new Error(e);return /Verified pinned example loaded/.test(root.textContent);},{signal,label:'the pressure-support example to load'});}
   const form=root.querySelector('form');if(!form)throw new Error('The pressure-support form was not found.');form.requestSubmit();
   await waitFor(()=>$('pressure-support-json')&&!$('pressure-support-json').disabled,{signal,label:'the pressure-support result'});
  }},
  {label:'Calculate the capacity assessment',run:async({signal})=>{
   navigate('comparison');const s=session();
   await waitFor(()=>doc.querySelectorAll('#disposal-wells [data-well]').length>=s.injectors.length*5,{signal,label:'the sample wells in Capacity assessment'});
   setValue($('disposal-name'),'Sample case · UIC 000020838 + SAND BEND 2D');
   if($('disposal-model').value!=='segmented-brine')setValue($('disposal-model'),'segmented-brine');
   fill($('disposal-pressure'),'shared','referencePressurePsia');fill($('disposal-temperature'),'shared','temperatureF');fill($('disposal-salinity'),'shared','salinityWtPercent');
   if($('disposal-surface-temperature'))fill($('disposal-surface-temperature'),'shared','surfaceTemperatureF');
   const fields={tvdFt:'datumTvdFt',measuredDepthFt:'measuredDepthFt',innerDiameterInches:'innerDiameterInches',roughnessInches:'roughnessInches',surfaceLimitPsia:'surfaceLimitPsia'};
   s.injectors.forEach((_,i)=>{for(const [field,key] of Object.entries(fields))fill(doc.querySelector(`#disposal-wells [data-well="${i}"][data-field="${field}"]`),i,key);});
   $('disposal-illustrative').addEventListener('click',()=>markEdited($('disposal-wells'),'Illustrative default applied — not the sample value'),{once:true});
   const result=waitForEvent(doc,'disposal-case-result',{signal,failWhen:()=>text($('disposal-error'))});
   $('disposal-form').requestSubmit();await result;
  }},
  {label:'Run the default parameter sweep',run:async({signal})=>{
   navigate('sensitivity');await waitFor(()=>$('sensitivity-calculate')&&!$('sensitivity-calculate').disabled,{signal,label:'the parameter sweep to be ready'});
   $('sensitivity-form').requestSubmit();
   await waitFor(()=>{const e=text($('sensitivity-error'));if(e)throw new Error(e);return $('sensitivity-json')&&!$('sensitivity-json').disabled;},{signal,timeoutMs:120000,label:'the parameter sweep'});
  }},
  {label:'Calculate brine PVT',run:async()=>{
   navigate('pvt');setValue($('pvt-name'),'Sample case brine');fill($('pvt-temperature'),'shared','temperatureF');fill($('pvt-salinity'),'shared','salinityWtPercent');setValue($('pvt-min'),1000);setValue($('pvt-max'),4000);
   $('pvt-form').requestSubmit();const e=text($('pvt-error'));if(e)throw new Error(e);if(!$('pvt-status').classList.contains('calculated'))throw new Error(text($('pvt-status'))||'Brine PVT did not calculate.');
  }},
  {label:'Calculate hydraulics',run:async({signal})=>{
   navigate('hydraulics');const form=await waitFor(()=>$('hyd-form'),{signal,label:'the hydraulics form'});const at=name=>form.elements.namedItem(name);
   setValue(at('caseName'),'Sample case · UIC 000020838');setValue(at('datum'),session().injectors[0].datum);
   const map={reservoirPsia:'reservoirPsia',limitPsia:'limitPsia',surfaceLimitPsia:'surfaceLimitPsia',injectivityStbdPerPsi:'injectivityStbdPerPsi',operatingCeilingStbd:'operatingCeilingStbd',tvdFt:'datumTvdFt',measuredDepthFt:'measuredDepthFt',innerDiameterInches:'innerDiameterInches',roughnessInches:'roughnessInches',referencePressurePsia:'referencePressurePsia',temperatureF:'temperatureF',surfaceTemperatureF:'surfaceTemperatureF',salinityWtPercent:'salinityWtPercent'};
   for(const [name,key] of Object.entries(map))fill(at(name),0,key);
   form.requestSubmit();const e=text($('hyd-error'));if(e)throw new Error(e);
  }},
 ];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (APP): `node --test tests/sample-steps.test.mjs`
Expected: all PASS.

- [ ] **Step 5: Use the steps in `startSample` (`web/import-ui.mjs`)**

(a) After the import added in Task 4, add `import {runSampleSteps,sampleSteps,resetDemoControls,waitFor,waitForEvent} from './sample-steps.mjs';`.

Verified facts this step relies on:
- `disposal-case.mjs` `sync()` returns early when the capacity context is unchanged (`if(key===contextKey)return;`). Navigating from Capacity assessment to Parameter sweeps, during loading or in the tour, therefore keeps the capacity result and the sweep stays enabled.
- `app.mjs` `render()` dispatches `demo-updated` from its `finally` block.

(b) Replace the whole `async function startSample(){ ... }` block from Task 4 with:
```js
async function startSample(){
 explorerHandoff?.cancel('source-changed','Sample case selected.');packageReceiver.cancel();
 sampleRun?.abort();const run=new AbortController();sampleRun=run;
 const progress=$('sample-progress'),items=new Map();progress.replaceChildren();progress.hidden=false;$('sample-error').textContent='';$('sample-cancel').hidden=false;$('sample-banner-detail').textContent='Loading…';renderSampleBanner();
 const onProgress=({index,total,label,status})=>{if(sampleRun!==run)return;let li=items.get(index);if(!li){li=el('li');items.set(index,li);progress.append(li);}li.dataset.status=status;li.textContent=`${index+1}/${total} ${label} — ${{running:'running…',done:'done',failed:'failed'}[status]}`;};
 const steps=sampleSteps({
  verify:async({signal})=>{await waitFor(()=>publicEvidence().artifact&&publicEvidence().pin,{signal,label:'the pinned TRRC record for UIC 000020838'});const session=await loadSampleCase({signal,publicEvidence});if(sampleRun!==run)throw new DOMException('Superseded by a newer sample load.','AbortError');sampleSession={...session,producerFixtureSha256:null};},
  // Subscribe before resetting: demo-updated fires from render()'s finally block, so the hash is never a stale exhibit's.
  select:async({signal})=>{const updated=waitForEvent(document,'demo-updated',{signal});resetDemoControls(document);await updated;const demo=demoEvidence();if(!demo)throw new Error($('app-error').hidden?'The synthetic sample producers could not be prepared.':$('app-error').textContent);sampleSession={...sampleSession,producerFixtureSha256:demo.inputs.planningFixtureSha256};sampleWellIndex=0;document.querySelector('input[name="sample-well"][value="0"]').checked=true;switchSource('sample');},
  navigate,session:()=>sampleSession,doc:document});
 try{await runSampleSteps(steps,{signal:run.signal,onProgress});if(sampleRun===run){$('sample-banner-detail').textContent=`${sampleSession.caseId} · every main tool has results.`;navigate('publicTrends');}}
 catch(error){if(sampleRun!==run)return;if(error?.name==='AbortError')$('sample-banner-detail').textContent='Loading cancelled. Results already calculated stay labelled with the sample identity.';else $('sample-error').textContent=error.message;}
 finally{if(sampleRun===run){sampleRun=null;$('sample-cancel').hidden=true;renderSampleBanner();}}
}
```

(c) After the `$('sample-clear').onclick=...` line, add:
```js
$('sample-cancel').onclick=()=>sampleRun?.abort();
```

- [ ] **Step 6: Browser check**

Rebuild and serve (Task 4, Step 10). Click **Try it with sample data**.

Expected:
- The progress list shows 7 steps reaching "done", and the page ends on Injector history.
- Pressure-support context, Capacity assessment, Parameter sweeps, Brine PVT and Hydraulics each show results.
- Capacity assessment fields show their class labels.
- Editing a field changes its label to "Edited by you…", and **Illustrative defaults** changes every well label.
- Click again and press **Cancel loading** mid-run: the progress list stops, the banner says cancelled, and no later step runs.

If a step fails, the error names it. Fix the selector against the live DOM; do not loosen the check.

- [ ] **Step 7: Run the nested suite and commit**

Run (ROOT): `node scripts/check-analytics.mjs`
Expected: PASS.

```bash
git add swd-injection-analytics/web/sample-steps.mjs swd-injection-analytics/web/import-ui.mjs swd-injection-analytics/tests/sample-steps.test.mjs
git commit -m "Run every main tool on sample load with progress, failure naming and cancel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Guided tour

**Files:**
- Create: `APP/web/tour-steps.mjs`, `APP/web/sample-tour.mjs`, `APP/web/sample-tour.css`
- Modify: `APP/web/index.html` (tour panel)
- Modify: `APP/web/import-ui.mjs` (mount and buttons)
- Test: `APP/tests/sample-tour.test.mjs`

**Interfaces:**
- Consumes: `navigate` and `startSample` from import-ui; `WORKSPACES`, `routeFor` from `./navigation.mjs`.
- Produces:
  - `TOUR_STEPS` (7 frozen objects `{view,target,heading,body:string[],fromTrrc:string[],gather:string[]}`)
  - `createTourState(steps)` → `{start,next,back,exit,current,active}`
  - `mountSampleTour({navigate,ensureSample,doc,steps})` → `{start():Promise,exit(),active}`

- [ ] **Step 1: Write the failing tests**

Create `APP/tests/sample-tour.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOUR_STEPS} from '../web/tour-steps.mjs';
import {createTourState} from '../web/sample-tour.mjs';
import {WORKSPACES,routeFor} from '../web/navigation.mjs';

const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
test('seven stops in the spec order and routes',()=>{assert.deepEqual(TOUR_STEPS.map(s=>routeFor(s.view)),['#injection/publicTrends','#production/history','#production/forecast','#injection/comparison','#injection/sensitivity','#production/pressureSupport','#reports/reports']);for(const s of TOUR_STEPS)assert.ok(WORKSPACES.some(w=>w.id===s.view),s.view);});
test('every highlight target exists in index.html',()=>{for(const s of TOUR_STEPS)assert.match(html,new RegExp(`id="${s.target}"`),s.target);});
test('every stop has a heading, plain sentences and a From TRRC / You\'d gather box',()=>{for(const s of TOUR_STEPS){assert.ok(s.heading);assert.ok(s.body.length>=1&&s.body.length<=3,s.heading);assert.ok(s.fromTrrc.length,s.heading);assert.ok(s.gather.length,s.heading);}});
test('stop copy keeps the TRRC rules',()=>{const all=JSON.stringify(TOUR_STEPS);assert.match(TOUR_STEPS[0].body.join(' '),/never treated as bottomhole pressure/);assert.match(TOUR_STEPS[1].fromTrrc[0],/no producer data/);assert.match(TOUR_STEPS[5].body.join(' '),/synthetic/);assert.match(TOUR_STEPS[6].body.join(' '),/checklist/);assert.doesNotMatch(all,/annulus pressure (was|is) (synthesized|estimated)/i);});
test('tour state moves within bounds and exits cleanly',()=>{const t=createTourState(TOUR_STEPS);assert.equal(t.active,false);assert.equal(t.start().number,1);assert.equal(t.back().number,1);for(let i=0;i<10;i++)t.next();assert.equal(t.current().number,7);assert.equal(t.current().last,true);assert.equal(t.exit(),null);assert.equal(t.active,false);});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (APP): `node --test tests/sample-tour.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write `web/tour-steps.mjs`**

```js
/** Guided tour stops: plain data. Each stop is an existing route plus a highlight target. */
export const TOUR_STEPS=Object.freeze([
 {view:'publicTrends',target:'sample-well-switch',heading:'Real injection history from TRRC',body:['These are the real monthly injection reports for two Reeves County disposal wells: 28 months for UIC 000020838 and 16 months for SAND BEND 2D. Use the Well switch to change wells.','Reported pressure has no stated basis, so it is shown as reported and never treated as bottomhole pressure.'],fromTrrc:['Well identity, operator and lease','Permit pressure and volume limits','Permitted injection interval','Monthly injected volume and reported pressure'],gather:['Basis and datum of the reported pressure','Bottomhole pressure and well tests','Annulus pressure records']},
 {view:'history',target:'analysis-workspace',heading:'Produced-water histories',body:['The producers feeding these injectors are synthetic and labelled as such.','A real analysis starts from your own monthly producer volumes.'],fromTrrc:['Nothing: TRRC has no producer data in the sources we read'],gather:['Monthly water (and oil) volumes for each producer','Units and calendar basis for each volume']},
 {view:'forecast',target:'analysis-workspace',heading:'Fit and forecast',body:['Each producer’s history is fitted up to a training cutoff, then frozen.','The months after the cutoff are a holdout that checks the forecast.'],fromTrrc:['Nothing'],gather:['At least 3 positive months of history per producer']},
 {view:'comparison',target:'disposal-results',heading:'Capacity assessment',body:['Forecast water demand is compared with what both injectors can take each month; shortfall months are where demand exceeds capacity.','Every input is labelled: TRRC record, derived from TRRC with a stated assumption, or synthetic.','SAND BEND 2D reported about 14 bbl/day against a 1,200 bbl/day permit: capacity depends on what you gather, not on the permit alone.'],fromTrrc:['Surface pressure limit: permit pressure + 14.7 psi (assumes the permit is surface gauge pressure)','Datum depth: top of the permitted interval (assumes a vertical well)'],gather:['Reservoir pressure and injectivity (J)','Tubing size and roughness','Availability and producer schedules']},
 {view:'sensitivity',target:'disposal-sensitivity',heading:'Scenarios and parameter sweeps',body:['A sweep re-runs the capacity case across a range of one input, here 0.5× to 1.5× of its base value in 5 points.','Use it on the inputs you are least sure of.'],fromTrrc:['The same permit-derived limits as the capacity assessment'],gather:['Measured ranges for the inputs you are unsure of']},
 {view:'pressureSupport',target:'pressure-support-workspace',heading:'Pressure-support context',body:['This view uses its own synthetic example, not the sample wells.','It lines up producer rates, water cut, injection volumes and frac dates on one time axis.'],fromTrrc:['In a real analysis: injector monthly volumes'],gather:['Producer oil and water rates','Frac and treatment dates','Producer–injector associations']},
 {view:'reports',target:'reports-workspace',heading:'Reports and your checklist',body:['Every result keeps its sources and can be exported.','The gather checklist lists every input this sample used, its class and which tools need it. Download it from the Sample case card.'],fromTrrc:['A summary of everything above'],gather:['Everything in the downloadable checklist']},
].map(Object.freeze));
```

- [ ] **Step 4: Write `web/sample-tour.mjs`**

```js
import {TOUR_STEPS} from './tour-steps.mjs';

/** Bounded tour position; no stored visit state (session-only). */
export function createTourState(steps=TOUR_STEPS){
 let index=-1;
 const current=()=>index<0?null:{...steps[index],number:index+1,total:steps.length,first:index===0,last:index===steps.length-1};
 return {start(){index=0;return current();},next(){if(index>=0&&index<steps.length-1)index++;return current();},back(){if(index>0)index--;return current();},exit(){index=-1;return null;},current,get active(){return index>=0;}};
}
/** Non-modal step panel: never traps focus; Escape exits; exiting keeps the sample loaded. */
export function mountSampleTour({navigate,ensureSample,doc=document,steps=TOUR_STEPS}){
 const $=id=>doc.getElementById(id),panel=$('sample-tour'),state=createTourState(steps);let highlighted=null;
 const items=(id,list)=>$(id).replaceChildren(...list.map(t=>{const li=doc.createElement('li');li.textContent=t;return li;}));
 const clear=()=>{highlighted?.classList.remove('tour-highlight');highlighted=null;};
 function render(step){
  clear();
  if(!step){panel.hidden=true;$('sample-tour-live').textContent='Tour closed. The sample stays loaded.';return;}
  navigate(step.view);
  panel.hidden=false;$('sample-tour-count').textContent=`Step ${step.number} of ${step.total}`;$('sample-tour-heading').textContent=step.heading;
  $('sample-tour-body').replaceChildren(...step.body.map(t=>{const p=doc.createElement('p');p.textContent=t;return p;}));
  items('sample-tour-trrc',step.fromTrrc);items('sample-tour-gather',step.gather);
  $('sample-tour-back').disabled=step.first;$('sample-tour-next').textContent=step.last?'Finish':'Next';
  $('sample-tour-live').textContent=`Step ${step.number} of ${step.total}: ${step.heading}`;
  // After navigate()'s own heading focus (queued microtask), so the panel heading wins.
  setTimeout(()=>{const target=$(step.target);if(target&&target.getClientRects().length){target.classList.add('tour-highlight');highlighted=target;}$('sample-tour-heading').focus({preventScroll:true});},0);
 }
 $('sample-tour-next').onclick=()=>render(state.current()?.last?state.exit():state.next());
 $('sample-tour-back').onclick=()=>render(state.back());
 $('sample-tour-exit').onclick=()=>render(state.exit());
 doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.active){event.preventDefault();render(state.exit());}});
 return {async start(){await ensureSample();render(state.start());},exit(){if(state.active)render(state.exit());},get active(){return state.active;}};
}
```

- [ ] **Step 5: Write `web/sample-tour.css`**

```css
/* Sample case banner, provenance labels, well switch and the non-modal tour panel. */
.sample-banner{margin:0 0 1rem;padding:.75rem 1rem;border:1px solid #bb7830;border-radius:8px;background:#fff8ef;display:grid;gap:.5rem}
.sample-banner p{margin:0}
.sample-progress{margin:0;padding-left:1.25rem;font-size:.9rem}
.sample-progress li[data-status="failed"]{color:#a12a1f;font-weight:600}
.sample-actions{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.75rem}
.sample-actions .session-note{flex-basis:100%;margin:0}
.sample-source{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;margin:0 0 1rem}
.sample-source p{margin:0;max-width:48ch}
.sample-class{display:block;margin-top:.15rem;font-size:.78rem;color:#5b4a2f}
.sample-class[data-class="trrc-public-record"]{color:#0f5296}
.sample-class[data-class="derived-with-assumption"]{color:#7a4a00}
.sample-class[data-class="edited"]{color:#a12a1f}
.sample-well-switch{display:flex;flex-wrap:wrap;gap:1rem;margin:.5rem 0 1rem;border:1px solid #c9d2dc;border-radius:6px;padding:.5rem .75rem}
.sample-well-switch label{display:flex;gap:.35rem;align-items:center}
.sample-tour{position:fixed;right:1rem;bottom:1rem;z-index:40;width:min(26rem,calc(100vw - 2rem));max-height:calc(100vh - 2rem);overflow:auto;padding:1rem;border-radius:10px;border:1px solid #c9d2dc;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.18)}
.sample-tour h2{margin:.25rem 0 .5rem;font-size:1.1rem}
.sample-tour h2:focus{outline:2px solid #1262b5;outline-offset:2px}
.sample-tour-count{margin:0;font-size:.85rem;color:#4d5b6a}
.sample-tour-box{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:.75rem 0;padding:.75rem;border-radius:8px;background:#f3f6f9}
.sample-tour-box h3{margin:0 0 .25rem;font-size:.9rem}
.sample-tour-box ul{margin:0;padding-left:1.1rem;font-size:.88rem}
.sample-tour-actions{display:flex;gap:.5rem;justify-content:flex-end}
.sample-tour-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.tour-highlight{outline:3px solid #bb7830;outline-offset:4px;border-radius:6px}
@media (max-width:700px){.sample-tour{left:0;right:0;bottom:0;width:auto;max-height:60vh;border-radius:12px 12px 0 0}.sample-tour-box{grid-template-columns:1fr}}
@media (prefers-color-scheme:dark){.sample-banner{background:#2b2116}.sample-tour{background:#1b2027;border-color:#3a4552}.sample-tour-box{background:#232a33}.sample-tour-count{color:#aab6c3}}
```
If `styles.css` defines dark mode differently (for example, a class on `html`), match that selector instead of the media query. Check with `grep -n "prefers-color-scheme\|data-theme" web/styles.css web/redesign.css`.

- [ ] **Step 6: Add the tour panel to `web/index.html`**

Insert immediately before `<script type="module" src="/hydraulics.mjs"></script>`:
```html
  <aside id="sample-tour" class="sample-tour" hidden aria-labelledby="sample-tour-heading"><p id="sample-tour-count" class="sample-tour-count"></p><h2 id="sample-tour-heading" tabindex="-1"></h2><div id="sample-tour-body"></div><div class="sample-tour-box"><div><h3>From TRRC</h3><ul id="sample-tour-trrc"></ul></div><div><h3>You'd gather</h3><ul id="sample-tour-gather"></ul></div></div><div class="sample-tour-actions"><button id="sample-tour-back" type="button">Back</button><button id="sample-tour-next" class="primary-action" type="button">Next</button><button id="sample-tour-exit" type="button">Exit tour</button></div><p id="sample-tour-live" class="sample-tour-live" aria-live="polite"></p></aside>
```

- [ ] **Step 7: Mount the tour in `web/import-ui.mjs`**

(a) Add `import {mountSampleTour} from './sample-tour.mjs';` after the sample-steps import.

(b) After the `$('sample-cancel').onclick=...` line, add:
```js
sampleTour=mountSampleTour({navigate,ensureSample:async()=>{if(!(source==='sample'&&sampleSession))await startSample();if(!(source==='sample'&&sampleSession))throw new Error($('sample-error').textContent||'The sample case did not load, so the tour cannot start.');}});
for(const id of ['sample-tour-start','sample-tour-start-home'])$(id).onclick=()=>sampleTour.start().catch(error=>{$('sample-error').textContent=error.message;renderSampleBanner();$('sample-banner').hidden=false;});
```

- [ ] **Step 8: Run the tests and the nested suite**

Run (APP): `node --test tests/sample-tour.test.mjs`
Expected: all PASS.

Run (ROOT): `node scripts/check-analytics.mjs`
Expected: PASS.

- [ ] **Step 9: Browser check (keyboard only)**

Rebuild and serve. On Start, Tab to **Take the guided tour** and press Enter.

Expected:
- The sample loads first, then the panel shows "Step 1 of 7" with focus on its heading, and the well switch is outlined.
- Next, Back and Exit all work by keyboard; Escape exits; the page underneath stays usable.
- After Exit, the banner still shows the sample.
- At 390×844 the panel is a bottom sheet.

- [ ] **Step 10: Commit**

```bash
git add swd-injection-analytics/web/tour-steps.mjs swd-injection-analytics/web/sample-tour.mjs swd-injection-analytics/web/sample-tour.css swd-injection-analytics/web/index.html swd-injection-analytics/web/import-ui.mjs swd-injection-analytics/tests/sample-tour.test.mjs
git commit -m "Add click-only 7-stop guided tour with From TRRC / You'd gather boxes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sample import files

**Files:**
- Create: `APP/data/samples/{seed417-history.csv,seed417-history.xlsx,assumed-injectors.csv,invalid-history.csv,README.md}`
- Modify: `APP/web/index.html` (download links in the import editor)
- Test: `APP/tests/sample-case.test.mjs` (append)

- [ ] **Step 1: Write the failing test**

Append to `APP/tests/sample-case.test.mjs`:
```js
test('sample import files are byte-exact copies of the import fixtures',async()=>{for(const f of ['seed417-history.csv','seed417-history.xlsx','assumed-injectors.csv','invalid-history.csv'])assert.deepEqual(await bytes('data/samples/'+f),await bytes('tests/fixtures/import/'+f),f);const readme=(await bytes('data/samples/README.md')).toString('utf8');assert.match(readme,/synthetic/i);assert.match(readme,/Producer -> producerId/);});
test('the import editor links every sample file',async()=>{const html=(await bytes('web/index.html')).toString('utf8');for(const f of ['seed417-history.csv','seed417-history.xlsx','assumed-injectors.csv','invalid-history.csv'])assert.match(html,new RegExp(`href="/data/samples/${f.replace('.','\\.')}" download`),f);});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (APP): `node --test tests/sample-case.test.mjs`
Expected: the two new tests FAIL with `ENOENT` and no match.

- [ ] **Step 3: Copy the fixtures and write the README**

Run (APP):
```bash
mkdir -p data/samples && for f in seed417-history.csv seed417-history.xlsx assumed-injectors.csv invalid-history.csv; do cp "tests/fixtures/import/$f" "data/samples/$f"; done
```

Create `APP/data/samples/README.md`:
```markdown
# Sample import files

These are synthetic educational files for trying the importer. They are not field data, not calibration data and not TRRC records.

- `seed417-history.csv` / `seed417-history.xlsx`: 48 synthetic producer-month rows from generator `synthetic-water/seed-417/v1`. Group `FICTIONAL-GROUP` is a fictional assumption.
- `assumed-injectors.csv`: the two fictional constant-J injector presets. Every value is assumed.
- `invalid-history.csv`: five deliberately malformed rows, for seeing validation reject bad data.

History mapping: `Producer -> producerId`, `Group -> groupId`, `Month -> month`, `Water -> water`. Declare `water: STB/day`, `timeBasis: calendar-day`, a mapping version and confirmation. Months are ISO `YYYY-MM`. IDs stay text, keeping leading zeros.

Injector mapping: `id`, `j -> injectivity` (STB/day/psi), `pres -> reservoirPressure` and `limit -> limitPressure` (psia), `rb`/`lb -> reservoirBasis`/`limitBasis` (`bottomhole-absolute`), `rd`/`ld -> reservoirDatum`/`limitDatum` (equal within an injector), `ceiling -> operatingCeiling` (STB/day), `availability` (fraction).

Copied byte-for-byte from `tests/fixtures/import/`; the tests check that they stay identical.
```

- [ ] **Step 4: Add the links to `web/index.html`**

Replace `<input id="import-file" type="file" accept=".csv,.xlsx">` with:
```html
<input id="import-file" type="file" accept=".csv,.xlsx"><p class="session-note" id="sample-files">Download a sample file (synthetic): <a href="/data/samples/seed417-history.csv" download>history CSV</a> · <a href="/data/samples/seed417-history.xlsx" download>history XLSX</a> · <a href="/data/samples/assumed-injectors.csv" download>assumed injectors CSV</a> · <a href="/data/samples/invalid-history.csv" download>invalid history CSV (shows validation)</a> · <a href="/data/samples/README.md" download>column mapping</a></p>
```

- [ ] **Step 5: Run the tests and the nested suite**

Run (APP): `node --test tests/sample-case.test.mjs`
Expected: all PASS.

Run (ROOT): `node scripts/check-analytics.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add swd-injection-analytics/data/samples swd-injection-analytics/web/index.html swd-injection-analytics/tests/sample-case.test.mjs
git commit -m "Add downloadable synthetic sample import files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Gates and browser evidence

**Files:**
- Create: `ROOT/demo/sample-tour-evidence/` (snapshots, screenshots, `checks.json`)
- Create: `ROOT/demo/SAMPLE-TOUR-VERIFICATION.md`

- [ ] **Step 1: Run every automated gate**

Run (ROOT), one at a time, recording each result:
```bash
node scripts/prepare-swd.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/typescript/bin/tsc -p swd-injection-analytics/tsconfig.json --noEmit
node node_modules/vite/bin/vite.js build
node scripts/check-analytics.mjs --include-server
node --test tests/portfolio-connection.test.mjs tests/preservation-baseline.test.mjs tests/transfer.test.mjs
```

Expected:
- All PASS, except `tests/transfer.test.mjs` test 1 (preservation), which stays red until Task 10.
- `check-analytics` reports the engineering tests (390+ before this feature, plus the new ones) and **248 carried reference comparisons**, all passing.

If the listener gate is blocked by the sandbox, record it as blocked, not passed.

- [ ] **Step 2: Desktop browser acceptance (1536×1024)**

Serve with Vite as before. Use the Chrome DevTools MCP: `new_page`, `resize_page`, `take_snapshot`, `take_screenshot`. For each check, save an accessibility snapshot `.txt` and a `.jpg` in `demo/sample-tour-evidence/browser/`.

1. Start → **Try it with sample data** → all 7 progress steps done.
2. Every main tool shows results: Injector history (both wells), Histories, Fit & forecast, Reconciliation, Demand, Capacity assessment, Parameter sweeps, Pressure-support context, Brine PVT, Hydraulics. The Reports cards show current results.
3. The banner and provenance labels are visible: the Data preview table, and the Capacity assessment field labels.
4. Injector history JSON exports for each well contain exactly one artifact and its pin, with 28 and 16 rows respectively.
5. The tour can be completed by keyboard only, and Exit keeps the sample.
6. **Clear sample** → "None selected".
7. Choose **User upload** and import `seed417-history.csv`. The capacity tools then show user-path blocking reasons only, and no `UIC-0000…` well appears anywhere.
8. Downloads have exact bytes:
   - The gather checklist must equal `node -e "import('./swd-injection-analytics/dist/sampleCase.js').then(async sc=>{const s=JSON.parse(require('fs').readFileSync('swd-injection-analytics/data/sample-case/sample-case.json'));process.stdout.write(sc.checklistCsv(sc.gatherChecklist(s)))})" > tmp/expected-checklist.csv`. Compare with `cmp`.
   - Each sample file must equal its `data/samples/` source.
9. Review Focus checks:
   - Edit the demo schedule after loading → Capacity assessment says "Reload the sample case".
   - Illustrative defaults → the labels change.
   - Double-click Try → one completed run.
   - Refresh mid-tour → the tour and sample are gone.

- [ ] **Step 3: Mobile browser acceptance (390×844)**

Repeat checks 1, 3 and 5 with `resize_page` at 390×844. Confirm the tour is a bottom sheet with no horizontal page scroll. Save snapshots.

- [ ] **Step 4: Write the verification record**

Create `ROOT/demo/SAMPLE-TOUR-VERIFICATION.md`. List every gate command with its observed result (counts, pass/fail, blocked), and every browser check with its evidence file name. Also record the known red root preservation test, pending the owner's baseline. State results exactly as observed; do not summarize a blocked gate as passing.

Write `demo/sample-tour-evidence/checks.json` with the same results in machine-readable form: `{gate, command, result, evidence}`.

- [ ] **Step 5: Independent read-only review**

Dispatch a fresh reviewer, using the superpowers:requesting-code-review skill, over `git diff a317aa3..HEAD` with this plan and the spec.

First apply this repository's delegation rules: read `handover/context/agent-workflow.md`, and give the reviewer the seven-field brief with the verified absolute Git root, the SWD requirement IDs (or a maintenance N/A), read-only scope and concrete acceptance checks. Respect the two-active-subagent limit.

Fix the confirmed findings in follow-up commits and re-run Step 1.

- [ ] **Step 6: Commit the evidence**

```bash
git add demo/SAMPLE-TOUR-VERIFICATION.md demo/sample-tour-evidence
git commit -m "Record sample tour gates and browser evidence

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Record the baseline and get owner acceptance

**Files:**
- Create: `ROOT/migration/sample-tour-baseline.json`

- [ ] **Step 1: Generate the pending baseline**

Create `ROOT/tmp/record-sample-tour-baseline.mjs` (not committed; `/tmp/` is git-ignored):
```js
import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),r=p=>readFileSync(p);
const docSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
const UI=['web/index.html','web/import-ui.mjs','web/workspace-views.mjs','web/disposal-context.mjs','web/disposal-case.mjs'];
const NEW=['src/sampleCase.ts','scripts/create-sample-case.mjs','data/sample-case/sample-case.json','data/sample-case/pin.json','data/sample-case/public-uic000056484.tar','data/samples/README.md','data/samples/seed417-history.csv','data/samples/seed417-history.xlsx','data/samples/assumed-injectors.csv','data/samples/invalid-history.csv','web/sample-case.mjs','web/sample-steps.mjs','web/sample-tour.mjs','web/sample-tour.css','web/tour-steps.mjs','tests/sample-case.test.mjs','tests/sample-steps.test.mjs','tests/sample-tour.test.mjs'];
const ROOTF=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'],ARCH='migration/baselines/sample-tour-before/swd-injection-analytics/';
const entry=(p,full)=>{const b=r(full);return {path:p,bytes:b.length,sha256:sha(b)};};
const baseline={version:'swd-sample-tour-preservation/1',status:process.argv[2]==='accept'?'accepted':'pending-review',
 ...(process.argv[2]==='accept'?{acceptedAt:new Date().toISOString().slice(0,10),acceptedBy:process.argv[3]??'',acceptanceEvidence:'demo/SAMPLE-TOUR-VERIFICATION.md'}:{}),
 parentBaselineSha256:sha(r('migration/pressure-support-baseline.json')),
 approvedSpecSha256:docSha(r('docs/superpowers/specs/2026-10-14-sample-case-guided-tour-design.md')),approvedPlanSha256:docSha(r('docs/superpowers/plans/2026-10-14-sample-case-guided-tour.md')),
 changes:UI.map(p=>{const before=r(ARCH+p),after=r('swd-injection-analytics/'+p);return {path:p,beforeSha256:sha(before),archive:ARCH+p,afterSha256:sha(after),beforeBytes:before.length,afterBytes:after.length};}),
 newFiles:NEW.map(p=>entry(p,'swd-injection-analytics/'+p)),rootFiles:ROOTF.map(p=>entry(p,p))};
writeFileSync('migration/sample-tour-baseline.json',JSON.stringify(baseline,null,2)+'\n');console.log(baseline.status);
```

Run (ROOT): `node tmp/record-sample-tour-baseline.mjs`
Expected: prints `pending-review`.

Then run (ROOT): `node --test tests/transfer.test.mjs`
Expected: test 1 still FAILS, with only `Sample-tour baseline is pending/not accepted…`. **Any other violation is a real problem; fix it before asking the owner.**

- [ ] **Step 2: Ask the owner for baseline approval**

Give the owner a plain-language summary: what changed, gate results, browser evidence, review findings, and the deviations listed at the top of this plan. Ask for an explicit approval of the new preservation baseline. Do not proceed without it.

- [ ] **Step 3: Accept and verify**

After explicit owner approval, run (ROOT): `node tmp/record-sample-tour-baseline.mjs accept "Owner (Thai Phi), explicit approval in Claude Code session after independent review"`
Expected: prints `accepted`.

Run (ROOT): `node --test tests/transfer.test.mjs tests/preservation-baseline.test.mjs`
Expected: all PASS, with `checked` equal to 182 and no violations.

- [ ] **Step 4: Commit**

```bash
git add migration/sample-tour-baseline.json
git commit -m "Accept sample tour preservation baseline after owner approval

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Merging to `main` (which syncs to Lovable) and pushing need a separate explicit owner instruction. Publishing is done by the owner.
