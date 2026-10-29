import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rename,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
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

async function recorderFixture(){
 const f=await legacyFixture();
 await write(f.root,'migration/layer-specs/t.json',JSON.stringify({purpose:'p',acceptanceEvidence:'e',approvedDocs:[PLAN],changes:[],newFiles:[],rootFiles:['scripts/record-layer.mjs',INDEX]}));
 return {...f,rec:(...a)=>execFileSync(process.execPath,[join(owningRoot,'scripts/record-layer.mjs'),'t',...a],{cwd:f.root,stdio:'pipe'})};
}
test('accept marks the unchanged reviewed record accepted',async()=>{const f=await recorderFixture();f.rec();const before=JSON.parse(await readFile(join(f.root,'migration/layers/t.json')));f.rec('accept','owner');const after=JSON.parse(await readFile(join(f.root,'migration/layers/t.json')));assert.equal(after.status,'accepted');assert.equal(after.acceptedBy,'owner');assert.deepEqual(after.approvedDocs,before.approvedDocs);assert.deepEqual(after.rootFiles,before.rootFiles);});
test('accept refuses bytes that changed after the pending record was reviewed',async()=>{const f=await recorderFixture();f.rec();await write(f.root,PLAN,'changed after review');assert.throws(()=>f.rec('accept','owner'),/differ from the reviewed pending record/);assert.equal(JSON.parse(await readFile(join(f.root,'migration/layers/t.json'))).status,'pending-review');});
test('accept refuses when no pending record exists',async()=>{const f=await recorderFixture();assert.throws(()=>f.rec('accept','owner'),/no reviewed pending record/);});
