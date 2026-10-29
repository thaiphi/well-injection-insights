# Preservation gate: data-driven layer registry (Phase A, layer 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every later Project 2 phase add a reviewed preservation layer as data (a JSON record plus before-archives), without editing `scripts/verify-preservation.mjs` again.

**Architecture:** The four hand-written layers (pressure-support, sample-tour, eol, sample-minors) keep their code exactly as it is. A new `verifyRegistry` step reads `migration/layers/index.json`, an ordered list of layer records `migration/layers/<name>.json`. Each record chains on the previous one (the first chains on `migration/sample-minors-baseline.json`) and carries its own reviewed allowlists. The final byte checks consult the registry's after-states and root pins before the legacy ones. With no index present the checker behaves exactly as today. This layer (`layer-registry`) is the first registry entry: it pins the new checker, the generic recorder and the new test file.

**Trust-model change (accept knowingly):** today each layer's allowlist lives in the pinned checker, so a counterfeit baseline cannot widen scope without also changing pinned code. After this layer, an `accepted` registry record can change any pinned product file or add files in the seven product trees; the bound becomes independent review + owner acceptance + the parent-SHA chain, not code. That is what D2 trades for "no checker edit per phase". This includes re-pinning `scripts/verify-preservation.mjs` itself, as this layer does: a reviewed record can install a different checker, just as a hand-written layer could. Records still cannot pin files inside the product or `migration/` trees as root files, add product files outside the seven trees, or skip before-archives.

**Tech Stack:** Node ESM (`node:test`, `node:crypto`, `node:fs/promises`), run by direct `node` paths only.

**Spec:** `docs/project-2-decisions-2026-10-20.md` (D2, D13); `docs/project-2-prd-analysis-2026-10-17.md` §4 "Preservation gate" and §5 Phase A.

## Global Constraints

- Owner decision D2: "A one-time, data-driven layer registry, reviewed and accepted as its own layer. After that, one layer per phase."
- Outcomes for the four existing layers must stay identical: the unchanged `tests/preservation-baseline.test.mjs` and `tests/transfer.test.mjs` pass, and a differential run of old vs new checker over every fixture gives identical `{checked, violations}`.
- `tests/preservation-baseline.test.mjs` and `tests/transfer.test.mjs` are **not edited**.
- `scripts/verify-preservation.mjs` has CRLF on its last three lines (136–138) and LF elsewhere. Count CR bytes before and after every edit (`3` expected); the Edit tool flattens CRLF.
- Approved documents are hashed with CRLF normalized to LF (`docSha`).
- This plan is pinned as an approved document. After acceptance it is frozen: track progress in the verification note, not by ticking boxes here (re-recording before acceptance absorbs edits).
- Claude builds to `pending-review` only. The owner runs `accept` via `!`.
- Branch `feature/phase-a-governance`. No staging, commit, push or merge without an explicit owner instruction.
- Reviewer (D13): an independent read-only Claude Opus review, briefed with the seven-field brief from `handover/context/agent-workflow.md`.

## Review Focus

1. A registry record that re-lists a legacy *new* file (e.g. `web/sample-tour.css`) as a change must start from the latest legacy pin, not the original — pinned by the "legacy new file" test in Task 2.
2. Removing `migration/layers/index.json` (or one entry from it) while records remain must fail, not silently fall back to the legacy chain — pinned by the "unlisted layer file" tests.
3. A record that edits an earlier record breaks the next record's parent SHA — pinned by the two-layer chain test.
4. Root-file pins: the latest layer listing a path wins, and stale earlier pins are ignored — pinned by the two-layer test with a stale first pin.
5. On a fresh Windows clone (`core.autocrlf=true`) the new hashed root files keep their bytes — checked in Task 4 by the fresh-clone run.

---

### Task 1: Freeze the legacy checker for differential comparison

**Files:**
- Create (scratchpad, not committed): `<scratchpad>/legacy-verify-preservation.mjs`

- [ ] **Step 1:** Copy the current checker byte-for-byte and record its hash.

```bash
cp scripts/verify-preservation.mjs "$SCRATCH/legacy-verify-preservation.mjs"
node -e "const b=require('fs').readFileSync('scripts/verify-preservation.mjs');console.log(require('crypto').createHash('sha256').update(b).digest('hex'), [...b].filter(x=>x===13).length)"
```
Expected: the SHA equals the checker pin in `migration/sample-minors-baseline.json` `rootFiles`, and `3` CR bytes.

- [ ] **Step 2:** Confirm the starting state is clean: `node scripts/verify-preservation.mjs .` → `"violations": []`.

### Task 2: Registry tests (RED)

**Files:**
- Create: `tests/layer-registry.test.mjs`
- Modify: `tests/.gitattributes` (add `layer-registry.test.mjs -text`)

**Interfaces:**
- Consumes: `verifyPreservation(root) → {checked:number, violations:string[]}` from `scripts/verify-preservation.mjs`.
- Produces: the violation strings Task 3 must emit (listed under Task 3).

- [ ] **Step 1: Write the test file**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rename,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {verifyPreservation} from '../scripts/verify-preservation.mjs';
const owningRoot=resolve('.'),sha=b=>createHash('sha256').update(b).digest('hex');
const LEGACY=['migration/pressure-support-baseline.json','migration/sample-tour-baseline.json','migration/eol-baseline.json','migration/sample-minors-baseline.json'];
const LEGACY_ARCHIVES=['pressure-support-before','sample-tour-before','sample-minors-before'];
const LEGACY_DOCS=['demo/PRESSURE-SUPPORT-DESIGN.md','docs/superpowers/plans/2026-10-12-pressure-support-context.md','docs/superpowers/specs/2026-10-14-sample-case-guided-tour-design.md','docs/superpowers/plans/2026-10-14-sample-case-guided-tour.md','docs/superpowers/plans/2026-10-16-sample-tour-minors.md'];
const INDEX='migration/layers/index.json',APP='swd-injection-analytics/',PLAN='docs/superpowers/plans/2026-10-28-gate-layer-registry.md';
const REGISTRY_ROOT=['scripts/verify-preservation.mjs','scripts/record-layer.mjs','tests/layer-registry.test.mjs',INDEX];
const docSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
async function write(root,p,b){await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),b);}
const read=p=>readFile(join(owningRoot,p));
// Bytes a product path had before any registry layer: its first registry archive, else the live file.
async function preRegistry(){
 const first=new Map();let index=null;
 try{index=JSON.parse(await read(INDEX));}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const {baseline} of index?.layers??[])for(const c of JSON.parse(await read(baseline)).changes??[])if(!first.has(c.path))first.set(c.path,c.archive);
 return p=>read(first.get(p)??APP+p);
}
/** The live hand-written chain (sample-minors accepted) and the live root files, with no registry layers. */
async function legacyFixture(){
 await mkdir(join(owningRoot,'tmp'),{recursive:true});const root=await mkdtemp(join(owningRoot,'tmp/layer-registry-test-'));
 const before=await preRegistry(),manifest=JSON.parse(await read('migration/source-manifest.json'));
 const apps=new Set(manifest.files.map(e=>e.path)),roots=new Set(REGISTRY_ROOT.filter(p=>p!==INDEX));
 for(const p of ['migration/source-manifest.json',...LEGACY,...LEGACY_DOCS,PLAN])await write(root,p,await read(p));
 for(const p of LEGACY){const b=JSON.parse(await read(p));for(const e of b.newFiles??[])apps.add(e.path);for(const e of b.rootFiles??[])roots.add(e.path);}
 for(const d of LEGACY_ARCHIVES)await cp(join(owningRoot,'migration/baselines',d),join(root,'migration/baselines',d),{recursive:true});
 for(const p of apps)await write(root,APP+p,await before(p));
 for(const p of roots)await write(root,p,await read(p));
 return {root,layers:[]};
}
/** Append an accepted registry layer. changes/newFiles map product paths to their new bytes. */
async function addLayer(f,name,{changes={},newFiles={},rootFiles=[INDEX],docs=[PLAN],status='accepted'}={}){
 const parent=f.layers.length?`migration/layers/${f.layers.at(-1).name}.json`:'migration/sample-minors-baseline.json';
 const L={version:'swd-preservation-layer/1',name,status,purpose:'test layer',parentBaselineSha256:sha(await readFile(join(f.root,parent))),approvedDocs:[],changes:[],newFiles:[],rootFiles:[]};
 for(const p of docs)L.approvedDocs.push({path:p,sha256:docSha(await readFile(join(f.root,p)))});
 const archive=`migration/baselines/${name}-before/${APP}`;
 for(const [p,next] of Object.entries(changes)){const b=await readFile(join(f.root,APP+p));await write(f.root,archive+p,b);await write(f.root,APP+p,next);L.changes.push({path:p,archive:archive+p,beforeSha256:sha(b),beforeBytes:b.length,afterSha256:sha(next),afterBytes:next.length});}
 for(const [p,b] of Object.entries(newFiles)){await write(f.root,APP+p,b);L.newFiles.push({path:p,sha256:sha(b),bytes:b.length});}
 f.layers.push(L);
 await write(f.root,INDEX,JSON.stringify({version:'swd-preservation-layer-index/1',layers:f.layers.map(x=>({name:x.name,baseline:`migration/layers/${x.name}.json`}))}));
 for(const p of rootFiles){const b=await readFile(join(f.root,p));L.rootFiles.push({path:p,sha256:sha(b),bytes:b.length});}
 await persist(f,L);return L;
}
const persist=(f,L)=>write(f.root,`migration/layers/${L.name}.json`,JSON.stringify(L));
const registryFixture=async()=>{const f=await legacyFixture();await addLayer(f,'layer-registry',{rootFiles:REGISTRY_ROOT});return f;};
const run=async f=>(await verifyPreservation(f.root)).violations;
const clean=async f=>{const r=await verifyPreservation(f.root);assert.equal(r.checked,182);assert.deepEqual(r.violations,[]);};
const blocked=async(f,re)=>{const v=await run(f);assert.ok(v.some(x=>re.test(x)),JSON.stringify(v));};

test('without a registry layer the changed checker stays blocked by its sample-minors pin',async()=>blocked(await legacyFixture(),/scripts\/verify-preservation\.mjs/));
test('the accepted registry layer re-pins the root files over the sample-minors pins',async()=>clean(await registryFixture()));
test('a registry layer changes an original at the application root',async()=>{const f=await registryFixture();await addLayer(f,'scope',{changes:{'AGENTS.md':Buffer.from('# Scope\n\namended\n')}});await clean(f);});
test('a registry layer changes a legacy new file from its latest legacy pin',async()=>{const f=await registryFixture();const b=await readFile(join(f.root,APP+'web/sample-tour.css'));await addLayer(f,'css',{changes:{'web/sample-tour.css':Buffer.concat([b,Buffer.from('\n/* registry delta */\n')])}});await clean(f);});
test('a registry layer adds new product files in permitted trees',async()=>{const f=await registryFixture();await addLayer(f,'feature',{newFiles:{'src/newModule.ts':Buffer.from('export {};\n'),'tests/new-module.test.mjs':Buffer.from('// t\n')}});await clean(f);});
test('two chained registry layers: the later change starts from the earlier after-state and the latest root pin wins',async()=>{
 const f=await registryFixture();await addLayer(f,'one',{changes:{'web/index.html':Buffer.from('one')}});
 f.layers[0].rootFiles.find(e=>e.path===INDEX).sha256='0'.repeat(64);// stale first pin, superseded below
 await persist(f,f.layers[0]);f.layers[1].parentBaselineSha256=sha(await readFile(join(f.root,'migration/layers/layer-registry.json')));await persist(f,f.layers[1]);
 await addLayer(f,'two',{changes:{'web/index.html':Buffer.from('two')}});await clean(f);});
test('approved registry documents verify with LF or CRLF line endings',async()=>{const f=await registryFixture();const text=(await readFile(join(f.root,PLAN),'utf8')).replace(/\r\n/g,'\n');for(const t of [text,text.replace(/\n/g,'\r\n')]){await write(f.root,PLAN,Buffer.from(t));assert.deepEqual(await run(f),[]);}});

const cases=[
 ['a pending registry layer never passes',async f=>{f.layers[0].status='pending-review';await persist(f,f.layers[0]);},/Layer layer-registry baseline is pending/],
 ['unsupported registry layer versions are rejected',async f=>{f.layers[0].version='swd-preservation-layer/2';await persist(f,f.layers[0]);},/Layer layer-registry: unsupported version/],
 ['a record whose name differs from its index entry is rejected',async f=>write(f.root,'migration/layers/layer-registry.json',JSON.stringify({...f.layers[0],name:'other'})),/does not match the index/],
 ['editing the sample-minors baseline breaks the registry chain',async f=>{const p='migration/sample-minors-baseline.json',b=JSON.parse(await readFile(join(f.root,p)));b.acceptedBy='edited';await write(f.root,p,JSON.stringify(b));},/Layer layer-registry parent baseline SHA mismatch/],
 ['editing an earlier record breaks the next record parent SHA',async f=>{await addLayer(f,'next',{});f.layers[0].purpose='edited';await persist(f,f.layers[0]);},/Layer next parent baseline SHA mismatch/],
 ['a registry layer without the sample-minors layer is rejected',async f=>{await mkdir(join(f.root,'tmp'));await rename(join(f.root,'migration/sample-minors-baseline.json'),join(f.root,'tmp/sm.json'));},/requires the accepted sample-minors baseline/],
 ['an index entry whose record is missing is rejected',async f=>{await mkdir(join(f.root,'tmp'));await rename(join(f.root,'migration/layers/layer-registry.json'),join(f.root,'tmp/l.json'));},/Layer layer-registry baseline unavailable/],
 ['removing the index while records remain is rejected',async f=>{await mkdir(join(f.root,'tmp'));await rename(join(f.root,INDEX),join(f.root,'tmp/index.json'));},/Unlisted layer file: migration\/layers\/layer-registry\.json/],
 ['an unlisted file in the layer directory is rejected',async f=>write(f.root,'migration/layers/extra.json','{}'),/Unlisted layer file: migration\/layers\/extra\.json/],
 ['a duplicate or mismatched index entry is rejected',async f=>write(f.root,INDEX,JSON.stringify({version:'swd-preservation-layer-index/1',layers:[{name:'layer-registry',baseline:'migration/layers/other.json'}]})),/Invalid or duplicate layer index entry/],
 ['an unsupported index version is rejected',async f=>{const i=JSON.parse(await readFile(join(f.root,INDEX)));i.version='x';await write(f.root,INDEX,JSON.stringify(i));},/Unsupported layer index version/],
 ['the latest layer must pin the index',async f=>{f.layers[0].rootFiles=f.layers[0].rootFiles.filter(e=>e.path!==INDEX);await persist(f,f.layers[0]);},/Layer index must be pinned by the latest layer/],
 ['a later index edit is rejected',async f=>write(f.root,INDEX,Buffer.concat([await readFile(join(f.root,INDEX)),Buffer.from(' ')])),/migration\/layers\/index\.json/],
 ['a layer with no approved document is rejected',async f=>{f.layers[0].approvedDocs=[];await persist(f,f.layers[0]);},/at least one approved document is required/],
 ['approved registry plan bytes must still match',async f=>write(f.root,PLAN,'changed plan'),/Approved document hash mismatch/],
 ['a later edit of a registry-pinned root file is rejected',async f=>write(f.root,'scripts/record-layer.mjs','tampered'),/scripts\/record-layer\.mjs/],
 ['a root pin inside the product tree is rejected',async f=>{f.layers[0].rootFiles.push({path:APP+'src/planning.ts',sha256:'0'.repeat(64),bytes:0});await persist(f,f.layers[0]);},/root file must be outside the product and migration trees/],
 ['a root pin on another migration file is rejected',async f=>{f.layers[0].rootFiles.push({path:'migration/source-manifest.json',sha256:'0'.repeat(64),bytes:0});await persist(f,f.layers[0]);},/root file must be outside the product and migration trees/],
 ['a change must start from the prior accepted state',async f=>{const L=await addLayer(f,'x',{changes:{'web/import-ui.mjs':Buffer.from('x')}});const o=JSON.parse(await readFile(join(f.root,'migration/source-manifest.json'))).files.find(e=>e.path==='web/import-ui.mjs');L.changes[0].beforeSha256=o.sha256;L.changes[0].beforeBytes=o.bytes;await persist(f,L);},/Layer x before hash\/bytes must equal the prior accepted state: web\/import-ui\.mjs/],
 ['a change to an unpinned path is rejected',async f=>{const L=await addLayer(f,'x',{});L.changes.push({path:'src/notThere.ts',archive:'migration/baselines/x-before/swd-injection-analytics/src/notThere.ts',beforeSha256:'0'.repeat(64),beforeBytes:0,afterSha256:'0'.repeat(64),afterBytes:0});await persist(f,L);},/prior accepted state: src\/notThere\.ts/],
 ['a replaced registry archive is rejected',async f=>{await addLayer(f,'x',{changes:{'AGENTS.md':Buffer.from('a')}});await write(f.root,'migration/baselines/x-before/swd-injection-analytics/AGENTS.md','wrong');},/Layer x archive hash\/bytes mismatch: AGENTS\.md/],
 ['a deleted registry archive is rejected',async f=>{await addLayer(f,'x',{changes:{'AGENTS.md':Buffer.from('a')}});await mkdir(join(f.root,'tmp'));await rename(join(f.root,'migration/baselines/x-before/swd-injection-analytics/AGENTS.md'),join(f.root,'tmp/a.md'));},/Layer x archive missing/],
 ['an unlisted registry archive file is rejected',async f=>{await addLayer(f,'x',{changes:{'AGENTS.md':Buffer.from('a')}});await write(f.root,'migration/baselines/x-before/extra.txt','x');},/Layer x unlisted archive/],
 ['an archive path other than the layer archive is rejected',async f=>{const L=await addLayer(f,'x',{changes:{'AGENTS.md':Buffer.from('a')}});L.changes[0].archive='../outside';await persist(f,L);},/Layer x unsafe\/unapproved archive path/],
 ['accepted status cannot bypass a null registry after hash',async f=>{const L=await addLayer(f,'x',{changes:{'AGENTS.md':Buffer.from('a')}});L.changes[0].afterSha256=null;await persist(f,L);},/Layer x unreviewed after hash\/bytes: AGENTS\.md/],
 ['a later edit of a registry-changed original is rejected',async f=>{await addLayer(f,'x',{changes:{'AGENTS.md':Buffer.from('a')}});await write(f.root,APP+'AGENTS.md','later');},/AGENTS\.md/],
 ['a later edit of a registry new file is rejected',async f=>{await addLayer(f,'x',{newFiles:{'src/newModule.ts':Buffer.from('a')}});await write(f.root,APP+'src/newModule.ts','later');},/src\/newModule\.ts/],
 ['duplicate paths inside one layer are rejected',async f=>{const L=await addLayer(f,'x',{changes:{'AGENTS.md':Buffer.from('a')}});L.changes.push({...L.changes[0]});await persist(f,L);},/Layer x duplicate path: AGENTS\.md/],
 ['a new file outside the permitted trees is rejected',async f=>{const L=await addLayer(f,'x',{});L.newFiles.push({path:'docs/note.md',sha256:'0'.repeat(64),bytes:0});await persist(f,L);},/new file must be a new path in a permitted product tree: docs\/note\.md/],
 ['a new file cannot re-pin an original',async f=>{const L=await addLayer(f,'x',{});L.newFiles.push({path:'src/planning.ts',sha256:'0'.repeat(64),bytes:0});await persist(f,L);},/new file must be a new path in a permitted product tree: src\/planning\.ts/],
 ['a traversal path is rejected',async f=>{const L=await addLayer(f,'x',{});L.newFiles.push({path:'../outside',sha256:'0'.repeat(64),bytes:0});await persist(f,L);},/Layer x unsafe path/],
 ['unlisted product files are still rejected with registry layers',async f=>write(f.root,APP+'src/hidden.ts','x'),/src\/hidden\.ts/],
 ['legacy pins stay enforced under the registry',async f=>write(f.root,APP+'web/disposal-context.mjs','later edit'),/web\/disposal-context\.mjs/],
];
for(const [name,change,want] of cases)test(name,async()=>{const f=await registryFixture();await change(f);await blocked(f,want);});
```

- [ ] **Step 2:** Add the line-ending rule so a Windows checkout keeps the hashed bytes. Append to `tests/.gitattributes`:

```
layer-registry.test.mjs -text
```

- [ ] **Step 3: Run and confirm RED**

Run: `node --test tests/layer-registry.test.mjs`
Expected: FAIL. Every fixture copies `scripts/record-layer.mjs`, which does not exist yet; and the unedited checker ignores `migration/layers/`, so even with that file the positive tests would fail. Record the failing list in the verification note.

### Task 3: `verifyRegistry` in the checker (GREEN)

**Files:**
- Modify: `scripts/verify-preservation.mjs` (constants after line 18; new function before `verifyPreservation`; the final section, lines 119–131)
- Create: `scripts/record-layer.mjs`; modify `scripts/.gitattributes` (add `record-layer.mjs -text`)
- Create: `migration/layer-specs/layer-registry.json`

**Interfaces:**
- Produces: layer record schema `swd-preservation-layer/1`:
  `{version, name, status, acceptedAt?, acceptedBy?, acceptanceEvidence?, purpose, parentBaselineSha256, approvedDocs:[{path,sha256}], changes:[{path,archive,beforeSha256,beforeBytes,afterSha256,afterBytes}], newFiles:[{path,sha256,bytes}], rootFiles:[{path,sha256,bytes}]}`.
- Index schema `swd-preservation-layer-index/1`: `{version, layers:[{name, baseline:"migration/layers/<name>.json"}]}`.
- Archive directory per layer: `migration/baselines/<name>-before/swd-injection-analytics/<path>`.
- Spec schema (input to the recorder): `migration/layer-specs/<name>.json` = `{purpose, acceptanceEvidence, approvedDocs:[path], changes:[app path], newFiles:[app path], rootFiles:[root path]}`.
- Violation strings (the tests match these): `Layer <n> baseline is pending/not accepted after independent review`; `Layer <n>: unsupported version`; `Layer <n>: name does not match the index`; `Layer <n> parent baseline SHA mismatch`; `Layer registry requires the accepted sample-minors baseline`; `Layer <n> baseline unavailable: …`; `Unlisted layer file: <p>`; `Invalid or duplicate layer index entry: …`; `Unsupported layer index version`; `Layer index must list at least one layer`; `Layer index must be pinned by the latest layer`; `Layer <n>: at least one approved document is required`; `Approved document hash mismatch: <p>`; `Layer <n> root file must be outside the product and migration trees: <p>`; `Layer <n> before hash/bytes must equal the prior accepted state: <p>`; `Layer <n> archive hash/bytes mismatch: <p>`; `Layer <n> archive missing/unsafe: <p> …`; `Layer <n> unlisted archive: <p>`; `Layer <n> unsafe/unapproved archive path: …`; `Layer <n> unreviewed after hash/bytes: <p>`; `Layer <n> duplicate path: <p>`; `Layer <n> new file must be a new path in a permitted product tree: <p>`; `Layer <n> unsafe path: <p>`.

- [ ] **Step 1:** Add constants after line 18 (`SM_DOCS`):

```js
const INDEX='migration/layers/index.json',LAYER_DIR='migration/layers',TREES=['src','data','web','tests','scripts','reference','exhibits'],NAME=/^[a-z0-9]+(-[a-z0-9]+)*$/;
```

- [ ] **Step 2:** Add the function immediately before the `/** Verify original transfer bytes …` comment:

```js
/** Verify the data-driven layers listed in migration/layers/index.json. Each record chains on the previous one (the first on the sample-minors baseline) and carries its own reviewed allowlists, so a new layer needs no checker change. */
async function verifyRegistry(root,{sm,priorApp},violations){
 const app=new Map(),pins=new Map(),listed=new Set([INDEX]),names=new Set();let index=null;
 try{index=JSON.parse(await bytesAt(root,INDEX));}catch(e){if(e.code!=='ENOENT')violations.push('Cannot read layer index: '+e.message);}
 const entries=Array.isArray(index?.layers)?index.layers:[];
 if(index!==null){
  if(!sm)violations.push('Layer registry requires the accepted sample-minors baseline');
  if(index?.version!=='swd-preservation-layer-index/1')violations.push('Unsupported layer index version');
  if(!entries.length)violations.push('Layer index must list at least one layer');
 }
 for(const x of entries){if(typeof x?.name!=='string'||!NAME.test(x.name)||names.has(x.name)||x.baseline!==LAYER_DIR+'/'+x.name+'.json')violations.push('Invalid or duplicate layer index entry: '+JSON.stringify(x));else{names.add(x.name);listed.add(x.baseline);}}
 for(const p of await listFiles(root,LAYER_DIR,violations))if(!listed.has(p))violations.push('Unlisted layer file: '+p);
 if(names.size!==entries.length)return {app,pins};
 let parent=SM_BASELINE,indexPinned=false;
 for(const {name,baseline} of entries){
  const label='Layer '+name,archive='migration/baselines/'+name+'-before/swd-injection-analytics/';let L;
  try{L=JSON.parse(await bytesAt(root,baseline));}catch(e){violations.push(label+' baseline unavailable: '+e.message);return {app,pins};}
  if(L?.version!=='swd-preservation-layer/1')violations.push(label+': unsupported version');
  if(L?.name!==name)violations.push(label+': name does not match the index');
  if(L?.status!=='accepted')violations.push(label+' baseline is pending/not accepted after independent review');
  try{if(!HASH.test(L?.parentBaselineSha256??'')||sha(await bytesAt(root,parent))!==L.parentBaselineSha256)violations.push(label+' parent baseline SHA mismatch');}catch(e){violations.push(label+' parent baseline unavailable: '+e.message);}
  parent=baseline;
  const list=k=>Array.isArray(L?.[k])?L[k]:(violations.push(label+': '+k+' must be a list'),[]);
  const fresh=(seen,p)=>{if(!safe(p)){violations.push(label+' unsafe path: '+String(p));return false;}if(seen.has(p)){violations.push(label+' duplicate path: '+p);return false;}seen.add(p);return true;};
  const docs=list('approvedDocs');if(!docs.length)violations.push(label+': at least one approved document is required');
  for(const d of docs){try{if(!safe(d?.path)||!HASH.test(d.sha256??'')||docSha(await bytesAt(root,d.path))!==d.sha256)violations.push('Approved document hash mismatch: '+String(d?.path));}catch(e){violations.push('Approved document unavailable: '+String(d?.path)+' '+e.message);}}
  const appSeen=new Set(),rootSeen=new Set(),archives=new Set(),next=new Map();
  // A change moves an already-pinned product file from its prior accepted state to a reviewed after-state.
  for(const c of list('changes')){
   if(!fresh(appSeen,c?.path))continue;const p=c.path,before=app.get(p)??priorApp(p);archives.add(archive+p);
   if(c.archive!==archive+p)violations.push(label+' unsafe/unapproved archive path: '+String(c.archive));
   if(!before||c.beforeSha256!==before.sha256||c.beforeBytes!==before.bytes)violations.push(label+' before hash/bytes must equal the prior accepted state: '+p);
   try{const b=await bytesAt(root,archive+p);if(!before||b.length!==before.bytes||sha(b)!==before.sha256)violations.push(label+' archive hash/bytes mismatch: '+p);}catch(e){violations.push(label+' archive missing/unsafe: '+p+' '+e.message);}
   if(!HASH.test(c.afterSha256??'')||!Number.isSafeInteger(c.afterBytes)||c.afterBytes<0)violations.push(label+' unreviewed after hash/bytes: '+p);else next.set(p,{sha256:c.afterSha256,bytes:c.afterBytes});
  }
  for(const n of list('newFiles')){
   if(!fresh(appSeen,n?.path))continue;const p=n.path,parts=p.split('/');
   if(parts.length<2||!TREES.includes(parts[0])||app.has(p)||priorApp(p))violations.push(label+' new file must be a new path in a permitted product tree: '+p);
   else next.set(p,{sha256:n.sha256,bytes:n.bytes});
  }
  for(const p of await listFiles(root,'migration/baselines/'+name+'-before',violations))if(!archives.has(p))violations.push(label+' unlisted archive: '+p);
  for(const [p,e] of next)app.set(p,e);
  indexPinned=false;
  for(const r of list('rootFiles')){
   if(!fresh(rootSeen,r?.path))continue;const p=r.path;
   if(p.startsWith('swd-injection-analytics/')||(p.startsWith('migration/')&&p!==INDEX))violations.push(label+' root file must be outside the product and migration trees: '+p);
   else{pins.set(p,{sha256:r.sha256,bytes:r.bytes});if(p===INDEX)indexPinned=true;}
  }
 }
 if(entries.length&&!indexPinned)violations.push('Layer index must be pinned by the latest layer');
 return {app,pins};
}
```

New-file and root-pin hash format is validated by the existing final inventory loop (`Invalid reviewed file entry`).

- [ ] **Step 3:** Replace the final section of `verifyPreservation` (from `for(const e of manifest.files){` through the `Unlisted new product path` loop). The changes are: the three new lines before the originals loop (`after`, `priorApp`, `reg`), `reg.app.get(e.path)??` in the originals loop, the `notApp`/`notRoot`/`regNew` line, the two registry inventories, and `&&!reg.app.has(appPath)` in the unlisted-path check. Every legacy violation string stays the same:

```js
 // Prior accepted state of a product path after the hand-written layers: latest layer first, then the original.
 const after=c=>c&&{sha256:c.afterSha256,bytes:c.afterBytes};
 const priorApp=p=>after(smChanges.get(p))??smAdded.get(p)??after(stChanges.get(p))??stAdded.get(p)??after(changes.get(p))??added.get(p)??originals.get(p)??null;
 const reg=await verifyRegistry(root,{sm,priorApp},violations);
 for(const e of manifest.files){
  checked++;try{const b=await bytesAt(root,'swd-injection-analytics/'+e.path),change=smChanges.get(e.path)??stChanges.get(e.path)??changes.get(e.path),expected=reg.app.get(e.path)??(change&&HASH.test(change.afterSha256??'')&&Number.isSafeInteger(change.afterBytes)?{sha256:change.afterSha256,bytes:change.afterBytes}:e);if(b.length!==expected.bytes||sha(b)!==expected.sha256)violations.push('Unapproved original file bytes/hash: '+e.path);}catch(err){violations.push('Original file missing/unsafe: '+e.path+' '+err.message);}
 }
 const bySm=p=>sm&&SM_ROOT.includes(p),byEol=p=>(eol&&EOL_ROOT.includes(p))||bySm(p),superseded=p=>(st&&ST_ROOT.includes(p))||byEol(p);
 const psRoot=new Map([...rootAdded].filter(([p])=>!superseded(p))),stRootLive=new Map([...stRoot].filter(([p])=>!byEol(p))),eolRootLive=new Map([...eolRoot].filter(([p])=>!bySm(p)));
 // A sample-tour new file re-listed as a sample-minors change is checked against its reviewed after-state instead.
 const stAddedLive=new Map([...stAdded].filter(([p])=>!smChanges.has(p))),smChangedNew=new Map([...smChanges].filter(([p])=>!originals.has(p)).map(([p,c])=>[p,{sha256:c.afterSha256,bytes:c.afterBytes}]));
 // Registry after-states and root pins supersede every hand-written pin of the same path.
 const notApp=m=>new Map([...m].filter(([p])=>!reg.app.has(p))),notRoot=m=>new Map([...m].filter(([p])=>!reg.pins.has(p))),regNew=new Map([...reg.app].filter(([p])=>!originals.has(p)));
 for(const [prefix,inventory]of [['swd-injection-analytics/',notApp(added)],['swd-injection-analytics/',notApp(stAddedLive)],['swd-injection-analytics/',notApp(smChangedNew)],['swd-injection-analytics/',notApp(smAdded)],['swd-injection-analytics/',regNew],['',notRoot(psRoot)],['',notRoot(stRootLive)],['',notRoot(eolRootLive)],['',notRoot(smRoot)],['',reg.pins]])for(const [p,e]of inventory){
  if(!HASH.test(e.sha256??'')||!Number.isSafeInteger(e.bytes)||e.bytes<0){violations.push('Invalid reviewed file entry: '+p);continue;}
  try{const b=await bytesAt(root,prefix+p);if(b.length!==e.bytes||sha(b)!==e.sha256)violations.push('Reviewed added file hash/bytes mismatch: '+p);}catch(err){violations.push('Reviewed added file missing/unsafe: '+p+' '+err.message);}
 }
 for(const dir of ['src','data','web','tests','scripts','reference','exhibits'])for(const p of await listFiles(root,'swd-injection-analytics/'+dir,violations)){const appPath=p.slice('swd-injection-analytics/'.length);if(!originals.has(appPath)&&!added.has(appPath)&&!stAdded.has(appPath)&&!smAdded.has(appPath)&&!reg.app.has(appPath))violations.push('Unlisted new product path: '+appPath);}
```

Update the `verifyPreservation` doc comment to: `/** Verify original transfer bytes, the reviewed pressure-context delta, the chained sample-tour, line-ending and sample-minors baselines, and the data-driven registry layers when present. */`

- [ ] **Step 4:** Restore the CRLF tail and confirm: CR count of `scripts/verify-preservation.mjs` is `3`, on its last three lines.

- [ ] **Step 5:** Create `scripts/record-layer.mjs`:

```js
// Record a data-driven preservation layer from migration/layer-specs/<name>.json.
//   node scripts/record-layer.mjs <name> archive            copy each listed change's current bytes to its before-archive; run BEFORE editing
//   node scripts/record-layer.mjs <name>                    write the pending-review record and list it in the index
//   node scripts/record-layer.mjs <name> accept "<owner>"   the same record, marked accepted (owner only)
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {dirname} from 'node:path';import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),r=p=>readFileSync(p);
const docSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
const put=(p,b)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);};
const [name,mode,by]=process.argv.slice(2);
if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name??''))throw Error('Usage: node scripts/record-layer.mjs <name> [archive | accept "<owner>"]');
if(mode&&mode!=='archive'&&mode!=='accept')throw Error('Unknown mode: '+mode);
if(mode==='accept'&&!by)throw Error('accept needs the accepting owner name');
const spec=JSON.parse(r('migration/layer-specs/'+name+'.json')),APP='swd-injection-analytics/',ARCH='migration/baselines/'+name+'-before/'+APP,INDEX='migration/layers/index.json';
if(mode==='archive'){for(const p of spec.changes){if(existsSync(ARCH+p))throw Error('Archive exists; refusing to overwrite: '+ARCH+p);put(ARCH+p,r(APP+p));}console.log('archived '+spec.changes.length);process.exit(0);}
const index=existsSync(INDEX)?JSON.parse(r(INDEX)):{version:'swd-preservation-layer-index/1',layers:[]};
const at=index.layers.findIndex(x=>x.name===name);
if(at===-1)index.layers.push({name,baseline:'migration/layers/'+name+'.json'});else if(at!==index.layers.length-1)throw Error('Only the latest layer can be re-recorded: '+name);
put(INDEX,JSON.stringify(index,null,2)+'\n');
const prev=index.layers.length>1?index.layers.at(-2).baseline:'migration/sample-minors-baseline.json',accept=mode==='accept';
const layer={version:'swd-preservation-layer/1',name,status:accept?'accepted':'pending-review',
 ...(accept?{acceptedAt:new Date().toISOString().slice(0,10),acceptedBy:by,acceptanceEvidence:spec.acceptanceEvidence}:{}),
 purpose:spec.purpose,parentBaselineSha256:sha(r(prev)),
 approvedDocs:spec.approvedDocs.map(p=>({path:p,sha256:docSha(r(p))})),
 changes:spec.changes.map(p=>{const b=r(ARCH+p),a=r(APP+p);return {path:p,archive:ARCH+p,beforeSha256:sha(b),beforeBytes:b.length,afterSha256:sha(a),afterBytes:a.length};}),
 newFiles:spec.newFiles.map(p=>{const b=r(APP+p);return {path:p,sha256:sha(b),bytes:b.length};}),
 rootFiles:spec.rootFiles.map(p=>{const b=r(p);return {path:p,sha256:sha(b),bytes:b.length};})};
put('migration/layers/'+name+'.json',JSON.stringify(layer,null,2)+'\n');console.log(layer.status);
```

Append `record-layer.mjs -text` to `scripts/.gitattributes`. (`migration/.gitattributes` already has `*.json -text`, which covers `migration/layers/` and `migration/layer-specs/`.)

- [ ] **Step 6:** Create `migration/layer-specs/layer-registry.json`:

```json
{
  "purpose": "One-time data-driven layer registry (owner decision D2): later layers are JSON records chained after the sample-minors baseline, with no further checker change.",
  "acceptanceEvidence": "demo/LAYER-REGISTRY-VERIFICATION.md",
  "approvedDocs": ["docs/superpowers/plans/2026-10-28-gate-layer-registry.md"],
  "changes": [],
  "newFiles": [],
  "rootFiles": ["scripts/verify-preservation.mjs", "scripts/record-layer.mjs", "tests/layer-registry.test.mjs", "migration/layers/index.json"]
}
```

- [ ] **Step 7: Run GREEN**

Run: `node --test tests/layer-registry.test.mjs` → all pass.
Run: `node --test tests/preservation-baseline.test.mjs` → all pass (unchanged file).
Run: `node --test tests/transfer.test.mjs` → the live-root test fails with exactly one violation, `Reviewed added file hash/bytes mismatch: scripts/verify-preservation.mjs` (the new checker against its sample-minors pin); the other two tests pass. This is expected until the registry layer is recorded.

### Task 4: Prove identical legacy outcomes, record pending, verify

**Files:**
- Create (scratchpad): `<scratchpad>/differential.mjs`
- Create: `demo/LAYER-REGISTRY-VERIFICATION.md`
- Create (generated): `migration/layers/index.json`, `migration/layers/layer-registry.json`

- [ ] **Step 1:** Differential run. After Task 3 Step 7 the legacy test run has left one fixture directory per case under `tmp/pressure-preservation-test-*`. Compare the frozen and new checkers on every one of them and on the pre-registry live tree:

```js
// node <scratchpad>/differential.mjs <repo root>
import {readdir} from 'node:fs/promises';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const root=resolve(process.argv[2]);
const oldC=await import(pathToFileURL(join(import.meta.dirname,'legacy-verify-preservation.mjs')));
const newC=await import(pathToFileURL(join(root,'scripts/verify-preservation.mjs')));
const dirs=(await readdir(join(root,'tmp'))).filter(d=>d.startsWith('pressure-preservation-test-')).map(d=>join(root,'tmp',d));
let n=0;for(const d of dirs){assert.deepEqual(await newC.verifyPreservation(d),await oldC.verifyPreservation(d),d);n++;}
console.log('identical outcomes on',n,'fixtures');
```
Expected: `identical outcomes on N fixtures`, no assertion error. (Live tree is not compared: the new checker bytes legitimately differ from the sample-minors pin until the registry layer exists.)

- [ ] **Step 2:** Record pending: `node scripts/record-layer.mjs layer-registry` → prints `pending-review`.
- [ ] **Step 3:** `node scripts/verify-preservation.mjs .` → exactly one violation: `Layer layer-registry baseline is pending/not accepted after independent review`. `tests/transfer.test.mjs` fails its live-root test with that same single violation until acceptance; after the owner accepts, all 69 root tests pass.
- [ ] **Step 4:** Nested suite `cd swd-injection-analytics && node --test tests/*.test.mjs` (435 pass) and `node scripts/check-carried-oracles.mjs` (248/0); nothing in the app changed, so these confirm no collateral edits.
- [ ] **Step 5:** Fresh-clone check after the owner authorizes a commit: `git -c core.autocrlf=true -c core.longpaths=true clone . C:/Users/thai.phi/cc-wii`, then `node scripts/verify-preservation.mjs .` inside it gives the same single pending violation (or 0 after acceptance); delete the clone.
- [ ] **Step 6:** Write `demo/LAYER-REGISTRY-VERIFICATION.md`: commands, counts, the differential result, the RED list from Task 2 Step 3, and the CR counts.

### Task 5: Independent review and owner acceptance

- [ ] **Step 1:** Dispatch the D13 reviewer (independent, read-only Claude Opus), with a seven-field brief per `handover/context/agent-workflow.md`: absolute root `C:\Users\thai.phi\Downloads\python\portfolio\swd-injection-analytics\tmp\lovable-transfer\well-injection-insights`; requirement map D2 (maintenance of the preservation gate; no SWD requirement ID applies); read-only; acceptance = this plan's Global Constraints and Review Focus. Ask specifically whether any record shape lets a layer widen scope silently.
- [ ] **Step 2:** Fix confirmed findings; rerun Tasks 3 Step 7 and 4 Steps 1–3. Record the outcome in the verification note.
- [ ] **Step 3:** Owner runs `! node scripts/record-layer.mjs layer-registry accept "<owner>"`, then `node scripts/verify-preservation.mjs .` → 0 violations.
- [ ] **Step 4:** Commit only on explicit owner instruction.

## Review fixes (2026-10-28)

The independent review found no Critical or Important issues. One Minor was re-graded to Important by effect: `accept` recomputed every hash from the live tree, so bytes changed after review would have been accepted silently. Fix: `scripts/record-layer.mjs` `accept` now requires an existing `pending-review` record and refuses unless the recomputed record equals it apart from the status and acceptance fields. Three tests were added to `tests/layer-registry.test.mjs` (accept unchanged → accepted; accept after a change → refused, record stays pending; accept with no pending record → refused). The code blocks above show the pre-fix recorder and test file; the files on disk are authoritative. The remaining Minors are deferred and listed in `demo/LAYER-REGISTRY-VERIFICATION.md`.
