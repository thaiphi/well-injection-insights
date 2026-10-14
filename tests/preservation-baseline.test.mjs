import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,copyFile,symlink,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
let checker;
try{checker=await import('../scripts/verify-preservation.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const owningRoot=resolve('.'),sha=b=>createHash('sha256').update(b).digest('hex');
const ui=['web/navigation.mjs','web/index.html','web/import-ui.mjs','web/workspace-views.mjs'];
const added=['src/pressureSupport.ts','src/pressureSupportChart.ts','src/pressureSupportExport.ts','data/pressure-support/example.json','data/pressure-support/pin.json','scripts/create-pressure-support-example.mjs','web/pressure-support.mjs','web/pressure-support-chart.mjs','web/pressure-support.css','tests/pressure-support.test.mjs','tests/pressure-support-state.test.mjs','tests/pressure-support-export.test.mjs'];
const rootFiles=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs','tests/transfer.test.mjs','.gitattributes'];
async function write(root,p,b){await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),b);}
async function fixture(reviewed=true){
 assert.ok(checker?.verifyPreservation,'Preservation checker is not implemented');
 await mkdir(join(owningRoot,'tmp'),{recursive:true});const root=await mkdtemp(join(owningRoot,'tmp/pressure-preservation-test-'));
 const mb=await readFile(join(owningRoot,'migration/source-manifest.json'));const manifest=JSON.parse(mb);
 await write(root,'migration/source-manifest.json',mb);
 for(const e of manifest.files)await write(root,join('swd-injection-analytics',e.path),await readFile(join(owningRoot,ui.includes(e.path)?'migration/baselines/pressure-support-before/swd-injection-analytics':'swd-injection-analytics',e.path)));
 if(!reviewed)return {root,manifest};
 const baseline={version:'swd-pressure-preservation/1',status:'accepted',parentManifestSha256:sha(mb),originalCount:182,approvedDesignSha256:'',approvedPlanSha256:'',changes:[],newFiles:[],rootFiles:[]};
 for(const [p,key] of [['demo/PRESSURE-SUPPORT-DESIGN.md','approvedDesignSha256'],['docs/superpowers/plans/2026-10-12-pressure-support-context.md','approvedPlanSha256']]){const b=await readFile(join(owningRoot,p));await write(root,p,b);baseline[key]=sha(b);}
 for(const p of ui){const b=await readFile(join(root,'swd-injection-analytics',p)),archive='migration/baselines/pressure-support-before/swd-injection-analytics/'+p;await write(root,archive,b);const next=Buffer.concat([b,Buffer.from('\n<!-- reviewed test delta -->\n')]);await write(root,'swd-injection-analytics/'+p,next);baseline.changes.push({path:p,beforeSha256:sha(b),beforeBytes:b.length,afterSha256:sha(next),afterBytes:next.length,archive});}
 for(const p of added){const b=Buffer.from('New product fixture: '+p);await write(root,'swd-injection-analytics/'+p,b);baseline.newFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 for(const p of rootFiles){const b=await readFile(join(owningRoot,p));await write(root,p,b);baseline.rootFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 await write(root,'migration/pressure-support-baseline.json',JSON.stringify(baseline));return {root,baseline,manifest};
}
async function persist(f){await write(f.root,'migration/pressure-support-baseline.json',JSON.stringify(f.baseline));}
test('original transfer without an evolution baseline checks every preserved file',async()=>{const f=await fixture(false);const result=await checker.verifyPreservation(f.root);assert.equal(result.checked,182);assert.deepEqual(result.violations,[]);});
test('reviewed four-file delta preserves all originals through exact before archives',async()=>{const f=await fixture();const result=await checker.verifyPreservation(f.root);assert.equal(result.checked,182);assert.deepEqual(result.violations,[]);});
const cases=[
 ['new served reference files cannot bypass the reviewed inventory',async f=>write(f.root,'swd-injection-analytics/reference/unreviewed.txt','new reference'),/reference\/unreviewed\.txt/],
 ['approved design bytes must still match their recorded hash',async f=>write(f.root,'demo/PRESSURE-SUPPORT-DESIGN.md','changed design'),/Approved document hash mismatch/],
 ['deleted originals remain blocking even with an accepted baseline',async f=>{await mkdir(join(f.root,'tmp'));await rename(join(f.root,'swd-injection-analytics/src/planning.ts'),join(f.root,'tmp/removed-planning.ts'));},/Original file missing.*src\/planning\.ts/],
 ['extra files inside original archive directory cannot hide outside inventory',async f=>write(f.root,'migration/baselines/pressure-support-before/unlisted.txt','extra archive'),/Unlisted original archive/],
 ['accepted status cannot bypass a null after hash',async f=>{f.baseline.changes[0].afterSha256=null;await persist(f);},/Unreviewed after hash/],
 ['correct after hash cannot bypass an incorrect after byte length',async f=>{f.baseline.changes[0].afterBytes++;await persist(f);},/web\/navigation\.mjs/],
 ['protected reference content cannot be changed',async f=>write(f.root,'swd-injection-analytics/reference/pyrestoolbox-pvt/brine.py','tampered'),/reference\/pyrestoolbox-pvt\/brine\.py/],
 ['an unlisted calculation edit cannot masquerade as a UI delta',async f=>write(f.root,'swd-injection-analytics/src/planning.ts','tampered'),/src\/planning\.ts/],
 ['original archives cannot be replaced by the current modified UI',async f=>write(f.root,f.baseline.changes[0].archive,'wrong original'),/archive|before/i],
 ['a reviewed after hash rejects a later unreviewed UI edit',async f=>write(f.root,'swd-injection-analytics/web/index.html','later edit'),/web\/index\.html/],
 ['pending baseline never reports preservation acceptance',async f=>{f.baseline.status='pending-review';await persist(f);},/pending|reviewed/i],
 ['duplicate baseline paths cannot hide missing originals',async f=>{f.baseline.changes[1]={...f.baseline.changes[0]};await persist(f);},/duplicate|four|allowlist/i],
 ['unapproved delta paths cannot extend the allowlist',async f=>{f.baseline.changes.push({path:'src/planning.ts',beforeSha256:'0'.repeat(64),afterSha256:'0'.repeat(64),archive:'migration/baselines/x'});await persist(f);},/allowlist|four|unapproved/i],
 ['archive traversal is rejected before reading outside its boundary',async f=>{f.baseline.changes[0].archive='../outside';await persist(f);},/archive|traversal|path/i],
 ['new product files omitted from the reviewed inventory are rejected',async f=>write(f.root,'swd-injection-analytics/src/hidden.ts','unreviewed'),/src\/hidden\.ts/],
 ['new-file entries outside permitted trees cannot be approved',async f=>{f.baseline.newFiles.push({path:'../outside',bytes:0,sha256:'0'.repeat(64)});await persist(f);},/path|allowlist|unapproved/i],
 ['parent manifest cannot be repinned together with a counterfeit baseline',async f=>{f.manifest.files[0].sha256='0'.repeat(64);const b=Buffer.from(JSON.stringify(f.manifest));await write(f.root,'migration/source-manifest.json',b);f.baseline.parentManifestSha256=sha(b);await persist(f);},/manifest.*(hash|SHA|pin)/i],
 ['changed new product bytes fail even when their names are permitted',async f=>write(f.root,'swd-injection-analytics/src/pressureSupport.ts','later change'),/src\/pressureSupport\.ts/],
 ['unreviewed root checker changes are detected',async f=>write(f.root,'scripts/verify-preservation.mjs','tampered checker'),/scripts\/verify-preservation\.mjs/],
];
for(const [name,change,want]of cases)test(name,async()=>{const f=await fixture();await change(f);const result=await checker.verifyPreservation(f.root);assert.ok(result.violations.some(x=>want.test(x)),JSON.stringify(result.violations));});
test('snapshot and generated trees are excluded from new product inventory',async()=>{const f=await fixture();for(const p of ['tmp/check/src/unrelated.ts','dist/generated.js','output/generated.json','node_modules/example/index.js'])await write(f.root,'swd-injection-analytics/'+p,'ignored generated/snapshot');const result=await checker.verifyPreservation(f.root);assert.deepEqual(result.violations,[]);});
test('symlink or junction paths do not bring external bytes into evidence',async()=>{const f=await fixture();const outside=join(f.root,'separate-target');await mkdir(outside);await write(f.root,'separate-target/file.txt','not product data');await symlink(outside,join(f.root,'swd-injection-analytics/data/junction'),process.platform==='win32'?'junction':'dir');const result=await checker.verifyPreservation(f.root);assert.ok(result.violations.some(x=>/symlink|junction/i.test(x)),JSON.stringify(result.violations));});



