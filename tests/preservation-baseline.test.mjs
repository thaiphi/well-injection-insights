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
const stUi=['web/index.html','web/import-ui.mjs','web/workspace-views.mjs','web/disposal-context.mjs','web/disposal-case.mjs'];
const stAdded=['src/sampleCase.ts','scripts/create-sample-case.mjs','data/sample-case/sample-case.json','data/sample-case/pin.json','data/sample-case/public-uic000056484.tar','data/samples/README.md','data/samples/seed417-history.csv','data/samples/seed417-history.xlsx','data/samples/assumed-injectors.csv','data/samples/invalid-history.csv','web/sample-case.mjs','web/sample-steps.mjs','web/sample-tour.mjs','web/sample-tour.css','web/tour-steps.mjs','tests/sample-case.test.mjs','tests/sample-steps.test.mjs','tests/sample-tour.test.mjs'];
const stRoot=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'];
const ST_ARCHIVE='migration/baselines/sample-tour-before/swd-injection-analytics/';
const ST_DOCS=[['docs/superpowers/specs/2026-10-14-sample-case-guided-tour-design.md','approvedSpecSha256'],['docs/superpowers/plans/2026-10-14-sample-case-guided-tour.md','approvedPlanSha256']];
const docSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
async function write(root,p,b){await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),b);}
async function fixture(reviewed=true){
 assert.ok(checker?.verifyPreservation,'Preservation checker is not implemented');
 await mkdir(join(owningRoot,'tmp'),{recursive:true});const root=await mkdtemp(join(owningRoot,'tmp/pressure-preservation-test-'));
 const mb=await readFile(join(owningRoot,'migration/source-manifest.json'));const manifest=JSON.parse(mb);
 await write(root,'migration/source-manifest.json',mb);
 for(const e of manifest.files)await write(root,join('swd-injection-analytics',e.path),await readFile(join(owningRoot,ui.includes(e.path)?'migration/baselines/pressure-support-before/swd-injection-analytics':stUi.includes(e.path)?ST_ARCHIVE.slice(0,-1):'swd-injection-analytics',e.path)));
 if(!reviewed)return {root,manifest};
 const baseline={version:'swd-pressure-preservation/1',status:'accepted',parentManifestSha256:sha(mb),originalCount:182,approvedDesignSha256:'',approvedPlanSha256:'',changes:[],newFiles:[],rootFiles:[]};
 for(const [p,key] of [['demo/PRESSURE-SUPPORT-DESIGN.md','approvedDesignSha256'],['docs/superpowers/plans/2026-10-12-pressure-support-context.md','approvedPlanSha256']]){const b=await readFile(join(owningRoot,p));await write(root,p,b);baseline[key]=sha(b);}
 for(const p of ui){const b=await readFile(join(root,'swd-injection-analytics',p)),archive='migration/baselines/pressure-support-before/swd-injection-analytics/'+p;await write(root,archive,b);const next=Buffer.concat([b,Buffer.from('\n<!-- reviewed test delta -->\n')]);await write(root,'swd-injection-analytics/'+p,next);baseline.changes.push({path:p,beforeSha256:sha(b),beforeBytes:b.length,afterSha256:sha(next),afterBytes:next.length,archive});}
 for(const p of added){const b=Buffer.from('New product fixture: '+p);await write(root,'swd-injection-analytics/'+p,b);baseline.newFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 for(const p of rootFiles){const b=await readFile(join(owningRoot,p));await write(root,p,b);baseline.rootFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 await write(root,'migration/pressure-support-baseline.json',JSON.stringify(baseline));return {root,baseline,manifest};
}
async function persist(f){await write(f.root,'migration/pressure-support-baseline.json',JSON.stringify(f.baseline));}
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
const eolRoot=['.gitattributes','scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'];
const eolDelta=async f=>write(f.root,'.gitattributes',Buffer.concat([await readFile(join(owningRoot,'.gitattributes')),Buffer.from('\n# line-ending test delta\n')]));
async function eolFixture(){
 const f=await sampleTourFixture();await eolDelta(f);
 for(const e of f.st.rootFiles)e.sha256='f'.repeat(64);await persistSt(f);
 const eol={version:'swd-eol-preservation/1',status:'accepted',parentBaselineSha256:sha(await readFile(join(f.root,'migration/sample-tour-baseline.json'))),rootFiles:[]};
 for(const p of eolRoot){const b=await readFile(join(f.root,p));eol.rootFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 await write(f.root,'migration/eol-baseline.json',JSON.stringify(eol));return {...f,eol};
}
async function persistEol(f){await write(f.root,'migration/eol-baseline.json',JSON.stringify(f.eol));}
test('accepted line-ending baseline re-pins .gitattributes over the earlier root pins',async()=>{const f=await eolFixture();const result=await checker.verifyPreservation(f.root);assert.equal(result.checked,182);assert.deepEqual(result.violations,[]);});
test('without the line-ending baseline a changed .gitattributes stays blocked',async()=>{const f=await sampleTourFixture();await eolDelta(f);const result=await checker.verifyPreservation(f.root);assert.ok(result.violations.some(x=>/\.gitattributes/.test(x)),JSON.stringify(result.violations));});
const eolCases=[
 ['pending line-ending baseline never passes',async f=>{f.eol.status='pending-review';await persistEol(f);},/Line-ending baseline is pending/],
 ['editing the sample-tour baseline breaks the line-ending chain',async f=>{f.st.acceptedBy='edited';await persistSt(f);},/Line-ending parent baseline SHA/],
 ['a later .gitattributes edit is rejected',async f=>write(f.root,'.gitattributes','later edit'),/\.gitattributes/],
 ['root checker pins move to the line-ending baseline and stay enforced',async f=>{f.eol.rootFiles[1].sha256='0'.repeat(64);await persistEol(f);},/scripts\/verify-preservation\.mjs/],
 ['unsupported line-ending baseline versions are rejected',async f=>{f.eol.version='swd-eol-preservation/2';await persistEol(f);},/Unsupported line-ending baseline version/],
 ['a null sample-tour baseline cannot anchor the line-ending layer',async f=>{const b=Buffer.from('null');await write(f.root,'migration/sample-tour-baseline.json',b);f.eol.parentBaselineSha256=sha(b);await persistEol(f);},/requires the accepted sample-tour baseline/],
 ['line-ending allowlist cannot be extended',async f=>{f.eol.rootFiles.push({path:'tests/transfer.test.mjs',bytes:0,sha256:'0'.repeat(64)});await persistEol(f);},/allowlist|unapproved/i],
];
for(const [name,change,want]of eolCases)test(name,async()=>{const f=await eolFixture();await change(f);const result=await checker.verifyPreservation(f.root);assert.ok(result.violations.some(x=>want.test(x)),JSON.stringify(result.violations));});
test('a sample-tour baseline without the pressure-support baseline is rejected',async()=>{const f=await sampleTourFixture();await mkdir(join(f.root,'tmp'));await rename(join(f.root,'migration/pressure-support-baseline.json'),join(f.root,'tmp/ps.json'));const result=await checker.verifyPreservation(f.root);assert.ok(result.violations.some(x=>/requires the accepted pressure-support baseline/.test(x)),JSON.stringify(result.violations));});
const smUi=['web/disposal-context.mjs','web/import-ui.mjs','web/sample-tour.css'],smAdded=['tests/sample-minors.test.mjs'],smRoot=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'];
const SM_ARCHIVE='migration/baselines/sample-minors-before/swd-injection-analytics/',SM_PLAN='docs/superpowers/plans/2026-10-16-sample-tour-minors.md';
async function sampleMinorsFixture(){
 const f=await eolFixture();
 // Stale eol pins for the re-pinned checker files prove the sample-minors pins supersede them.
 for(const e of f.eol.rootFiles)if(smRoot.includes(e.path))e.sha256='e'.repeat(64);await persistEol(f);
 const sm={version:'swd-sample-minors-preservation/1',status:'accepted',parentBaselineSha256:sha(await readFile(join(f.root,'migration/eol-baseline.json'))),approvedPlanSha256:'',changes:[],newFiles:[],rootFiles:[]};
 const plan=await readFile(join(owningRoot,SM_PLAN));await write(f.root,SM_PLAN,plan);sm.approvedPlanSha256=docSha(plan);
 for(const p of smUi){const b=await readFile(join(f.root,'swd-injection-analytics',p)),archive=SM_ARCHIVE+p;await write(f.root,archive,b);const next=Buffer.concat([b,Buffer.from('\n/* sample-minors test delta */\n')]);await write(f.root,'swd-injection-analytics/'+p,next);sm.changes.push({path:p,beforeSha256:sha(b),beforeBytes:b.length,afterSha256:sha(next),afterBytes:next.length,archive});}
 for(const p of smAdded){const b=Buffer.from('Sample-minors fixture: '+p);await write(f.root,'swd-injection-analytics/'+p,b);sm.newFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 for(const p of smRoot){const b=await readFile(join(f.root,p));sm.rootFiles.push({path:p,bytes:b.length,sha256:sha(b)});}
 await write(f.root,'migration/sample-minors-baseline.json',JSON.stringify(sm));return {...f,sm};
}
async function persistSm(f){await write(f.root,'migration/sample-minors-baseline.json',JSON.stringify(f.sm));}
test('accepted sample-minors delta chains on the accepted line-ending state',async()=>{const f=await sampleMinorsFixture();const result=await checker.verifyPreservation(f.root);assert.equal(result.checked,182);assert.deepEqual(result.violations,[]);});
test('without the sample-minors baseline its changed files stay blocked',async()=>{const f=await sampleMinorsFixture();await mkdir(join(f.root,'tmp'));await rename(join(f.root,'migration/sample-minors-baseline.json'),join(f.root,'tmp/sm.json'));const v=(await checker.verifyPreservation(f.root)).violations.join('\n');for(const re of [/web\/disposal-context\.mjs/,/web\/sample-tour\.css/,/tests\/sample-minors\.test\.mjs/])assert.match(v,re);});
const smCases=[
 ['pending sample-minors baseline never passes',async f=>{f.sm.status='pending-review';await persistSm(f);},/Sample-minors baseline is pending/],
 ['unsupported sample-minors versions are rejected',async f=>{f.sm.version='swd-sample-minors-preservation/2';await persistSm(f);},/Unsupported sample-minors baseline version/],
 ['editing the line-ending baseline breaks the sample-minors chain',async f=>{f.eol.acceptedBy='edited';await persistEol(f);},/Sample-minors parent baseline SHA/],
 ['a sample-minors layer without the line-ending layer is rejected',async f=>{await mkdir(join(f.root,'tmp'));await rename(join(f.root,'migration/eol-baseline.json'),join(f.root,'tmp/eol.json'));},/requires the accepted line-ending baseline/],
 ['a re-listed sample-tour file must start from its sample-tour pin',async f=>{const c=f.sm.changes.find(x=>x.path==='web/sample-tour.css');c.beforeSha256='0'.repeat(64);await persistSm(f);},/prior accepted state.*web\/sample-tour\.css/],
 ['a UI change must start from the sample-tour after-state',async f=>{const st=f.st.changes.find(x=>x.path==='web/import-ui.mjs');const c=f.sm.changes.find(x=>x.path==='web/import-ui.mjs');c.beforeSha256=st.beforeSha256;await persistSm(f);},/prior accepted state.*web\/import-ui\.mjs/],
 ['a later edit of a re-listed sample-tour file is rejected',async f=>write(f.root,'swd-injection-analytics/web/sample-tour.css','later edit'),/web\/sample-tour\.css/],
 ['a later edit of a sample-minors UI change is rejected',async f=>write(f.root,'swd-injection-analytics/web/disposal-context.mjs','later edit'),/web\/disposal-context\.mjs/],
 ['a deleted sample-minors archive is rejected',async f=>{await mkdir(join(f.root,'tmp'));await rename(join(f.root,SM_ARCHIVE+'web/disposal-context.mjs'),join(f.root,'tmp/dc.mjs'));},/Sample-minors archive missing/],
 ['accepted status cannot bypass a null sample-minors after hash',async f=>{f.sm.changes[0].afterSha256=null;await persistSm(f);},/Unreviewed sample-minors after hash/],
 ['a later edit of the sample-minors test file is rejected',async f=>write(f.root,'swd-injection-analytics/tests/sample-minors.test.mjs','later edit'),/tests\/sample-minors\.test\.mjs/],
 ['a later edit of the preservation test is rejected',async f=>write(f.root,'tests/preservation-baseline.test.mjs','later edit'),/tests\/preservation-baseline\.test\.mjs/],
 ['sample-minors archives cannot be replaced',async f=>write(f.root,SM_ARCHIVE+'web/import-ui.mjs','wrong before'),/Sample-minors archive/],
 ['extra files in the sample-minors archive are rejected',async f=>write(f.root,'migration/baselines/sample-minors-before/unlisted.txt','x'),/Unlisted sample-minors archive/],
 ['approved sample-minors plan bytes must still match',async f=>write(f.root,SM_PLAN,'changed plan'),/Approved document hash mismatch/],
 ['root checker pins move to the sample-minors baseline and stay enforced',async f=>{f.sm.rootFiles[0].sha256='0'.repeat(64);await persistSm(f);},/scripts\/verify-preservation\.mjs/],
 ['.gitattributes stays under the line-ending pin',async f=>write(f.root,'.gitattributes','later edit'),/\.gitattributes/],
 ['sample-minors allowlist cannot be extended',async f=>{f.sm.newFiles.push({path:'src/planning.ts',bytes:0,sha256:'0'.repeat(64)});await persistSm(f);},/allowlist|unapproved/i],
 ['unlisted product files are still rejected with the sample-minors layer',async f=>write(f.root,'swd-injection-analytics/tests/hidden.test.mjs','x'),/tests\/hidden\.test\.mjs/],
];
for(const [name,change,want]of smCases)test(name,async()=>{const f=await sampleMinorsFixture();await change(f);const result=await checker.verifyPreservation(f.root);assert.ok(result.violations.some(x=>want.test(x)),JSON.stringify(result.violations));});
