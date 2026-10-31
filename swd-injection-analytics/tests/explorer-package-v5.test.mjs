import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';
import {buildV4Files,pack,repin,sha,SYNTHETIC_UIC} from './helpers/explorer-v4.mjs';
import {buildV5Files,buildV5Package,relationsBody} from './helpers/explorer-v5.mjs';

// Same synthetic rows as the v4 test (UIC 000000417, BHP 7101-7103, SRT 7201).
const bhpRaw=(id,date,psia,depth,o={})=>({report_id:String(id),tracking_no:'90000417',report_conducted_date:date,report_received_date:'2024-10-15',bhp_psia:psia,test_depth_ft:depth,gradient_psi_ft:'0.68',tested_formation:'SYNTHETIC',test_sequence_no:'1.0',...o});
const srtRaw={report_id:'7201',tracking_no:'90000418',srt_received_date:'2022-06-20',test_date:'2022-05-16',satisfactory_test:'1',top_perf_ft:'3305.0',bottom_perf_ft:'5120.0',formation_tested:'Synthetic',min_inj_rate_bpm:'0.0',max_inj_rate_bpm:'24.10',formation_frac_press_psig:'1610.0',fracture_gradient_psi_ft:'0.710'};
const rows={bhp:[bhpRaw(7101,'2022-05-16','1512.0','3140.0'),bhpRaw(7102,'2024-02-12','1705.0','3310.0'),bhpRaw(7103,'2024-07-22','1731.0','3310.0')],srt:[srtRaw]};
const RELATIONS_SHA256='88b43327612adc584119ae430588151bd3a7394ff3919d159d83c3984795a648';
const manifestEdit=(f,edit)=>{const m=JSON.parse(f.get('manifest.json'));edit(m);f.set('manifest.json',Buffer.from(JSON.stringify(m,null,2)+'\n'));repin(f);};

test('the copied Explorer relations module is byte-identical to the producer (pinned SHA-256)',async()=>{
 const body=await readFile(new URL('../web/explorer-relations.mjs',import.meta.url));
 assert.equal(sha(body),RELATIONS_SHA256);assert.equal(body.includes(13),false);
});
test('a complete query-version-5 package verifies, keeps the v4 test records and reports its relations',async()=>{
 const r=await verifyExplorerPackage(await buildV5Package(rows));
 assert.equal(r.artifact.injectionMonthly[0].uic_number,SYNTHETIC_UIC);
 assert.deepEqual(r.tests.bhp.map(x=>x.bhp_psia),[1512,1705,1731]);assert.equal(r.tests.srt[0].formation_frac_press_psig,1610);
 assert.ok(r.relations.count>0);assert.match(r.relations.sha256,/^[a-f0-9]{64}$/);assert.equal(Object.isFrozen(r.relations),true);
 const files=await buildV5Files(rows);
 assert.equal(JSON.parse(files.get('tests.json')).scope.query_version,5);
 assert.equal(r.relations.sha256,sha(files.get('evidence_relations.json')));
 assert.equal(r.relations.count,JSON.parse(files.get('evidence_relations.json')).relations.length);
 const v4=await verifyExplorerPackage(pack(await buildV4Files(rows)));
 for(const key of ['bhp','srt','quality'])assert.deepEqual(r.tests[key],v4.tests[key]);
});
test('a query-version-4 package reports no relations',async()=>{
 const r=await verifyExplorerPackage(pack(await buildV4Files(rows)));
 assert.equal(r.relations,null);assert.equal(r.tests.bhp.length,3);
});
const reject=async(edit,pattern)=>{const files=await buildV5Files(rows);await edit(files);await assert.rejects(verifyExplorerPackage(pack(files)),pattern);};
test('one flipped byte in evidence_relations.json is a hash mismatch',async()=>{
 await reject(f=>{const b=Buffer.from(f.get('evidence_relations.json'));b[10]^=1;f.set('evidence_relations.json',b);},/hash or byte count mismatch: evidence_relations\.json/);
});
test('an edited and re-hashed evidence_relations.json contradicts the re-derivation',async()=>{
 await reject(f=>{const r=JSON.parse(f.get('evidence_relations.json'));r.relations[0].status='ambiguous';f.set('evidence_relations.json',Buffer.from(JSON.stringify(r,null,2)+'\n'));repin(f);},/evidence_relations\.json contradicts/);
});
test('evidence_relations.json present but undeclared is rejected',async()=>{
 await reject(f=>{manifestEdit(f,m=>{delete m.files['evidence_relations.json'];});},/undeclared/);
});
test('a v5 manifest without evidence_relations.json is rejected',async()=>{
 await reject(f=>{f.delete('evidence_relations.json');manifestEdit(f,m=>{delete m.files['evidence_relations.json'];});},/declare evidence_relations\.json last/);
});
test('a v4 manifest declaring evidence_relations.json is rejected',async()=>{
 const files=await buildV4Files(rows),v5=await buildV5Files(rows);
 files.set('evidence_relations.json',v5.get('evidence_relations.json'));manifestEdit(files,m=>{m.files['evidence_relations.json']={sha256:'',bytes:0};});
 await assert.rejects(verifyExplorerPackage(pack(files)),/evidence_relations\.json is not part of Explorer query version 4/);
});
test('a wrong last limitation is rejected',async()=>{
 await reject(f=>{manifestEdit(f,m=>{m.limitations[m.limitations.length-1]+=' ';});},/last limitation is not the evidence_relations\.json limitation/);
});
test('evidence_relations.json not declared last is rejected',async()=>{
 await reject(f=>{manifestEdit(f,m=>{const entry=m.files['evidence_relations.json'];delete m.files['evidence_relations.json'];m.files={'evidence_relations.json':entry,...m.files};});},/declare evidence_relations\.json last/);
});
const sidecarEdit=(f,name,edit)=>{const c=JSON.parse(f.get(name));edit(c);f.set(name,Buffer.from(JSON.stringify(c,null,2)+'\n'));f.set('evidence_relations.json',Buffer.from(relationsBody(f)));repin(f);};
test('a missing wellbore link is refused as a sidecar contradiction, not a raw error',async()=>{
 await reject(f=>{const c=JSON.parse(f.get('casing.json'));delete c.link;f.set('casing.json',Buffer.from(JSON.stringify(c,null,2)+'\n'));repin(f);},err=>err.code==='EXPLORER_PACKAGE_INVALID'&&/^casing\.json contradicts the acquisition scope$/.test(err.message));
});
test('a forged link source_api_id is refused even with relations rebuilt to match',async()=>{
 await reject(f=>sidecarEdit(f,'casing.json',c=>{c.link.source_api_id='99999999';for(const row of c.rows)row.source_api_id='99999999';}),/^Error: casing\.json contradicts the acquisition scope$/);
});
test('a wellbore sidecar carrying query_version 4 inside a v5 package is refused',async()=>{
 await reject(f=>sidecarEdit(f,'plugging.json',c=>{c.scope.query_version=4;}),/^Error: plugging\.json contradicts the acquisition scope$/);
});
test('a builder SOURCE_INVALID error is converted into a package refusal with its message',async()=>{
 await reject(f=>{const c=JSON.parse(f.get('casing.json'));c.rows[0].source_snapshot_id='u9m4-xnh6:0000000000000000';f.set('casing.json',Buffer.from(JSON.stringify(c,null,2)+'\n'));repin(f);},err=>err.code==='EXPLORER_PACKAGE_INVALID'&&/^evidence_relations\.json contradicts its re-derivation: Record rrc:casing:\S+ does not carry the snapshot ID of sources\/candidate-casing\.json$/.test(err.message));
});
