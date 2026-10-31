import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';
import {TESTS_DICTIONARY_SHA256,testsDictionary,explorerCsv,testColumns,normalizeExplorerTests} from '../web/explorer-tests.mjs';
import {buildV4Files,buildV4Package,pack,repin,sha,SYNTHETIC_UIC} from './helpers/explorer-v4.mjs';

const bhpRaw=(id,date,psia,depth,o={})=>({report_id:String(id),tracking_no:'90000417',report_conducted_date:date,report_received_date:'2024-10-15',bhp_psia:psia,test_depth_ft:depth,gradient_psi_ft:'0.68',tested_formation:'SYNTHETIC',test_sequence_no:'1.0',...o});
const srtRaw={report_id:'7201',tracking_no:'90000418',srt_received_date:'2022-06-20',test_date:'2022-05-16',satisfactory_test:'1',top_perf_ft:'3305.0',bottom_perf_ft:'5120.0',formation_tested:'Synthetic',min_inj_rate_bpm:'0.0',max_inj_rate_bpm:'24.10',formation_frac_press_psig:'1610.0',fracture_gradient_psi_ft:'0.710'};
const rows={bhp:[bhpRaw(7101,'2022-05-16','1512.0','3140.0'),bhpRaw(7102,'2024-02-12','1705.0','3310.0'),bhpRaw(7103,'2024-07-22','1731.0','3310.0')],srt:[srtRaw]};

test('the copied Explorer test dictionary is byte-identical to the producer (pinned SHA-256)',()=>{
 assert.equal(sha(Buffer.from(JSON.stringify(testsDictionary(),null,2)+'\n')),TESTS_DICTIONARY_SHA256);
});
test('the copied Explorer CSV writer keeps the producer format',()=>{
 const t=normalizeExplorerTests({bhp:[],srt:[{...srtRaw,uic_no:SYNTHETIC_UIC}]},{bhp:'qxfy-wcfs:x',srt:'h54t-xnbi:y'},[{uic_number:SYNTHETIC_UIC,source_record_key:'rrc:uic:p:1'}],null);
 assert.equal(explorerCsv(t.srt,testColumns.srt).split('\n')[1],'rrc:srt:h54t-xnbi:y:1,rrc:uic:p:1,matched,000000417,7201,90000418,2022-06-20,2022-06-20,2022-05-16,2022-05-16,1,3305,5120,Synthetic,0,24.1,,1610,,,0.71,,h54t-xnbi:y,missing:isip_psig|missing:frac_inj_rate_capacity_bpd|missing:surface_pressure_firc_psig');
 assert.equal(explorerCsv([],testColumns.bhp),testColumns.bhp.join(',')+'\n');
});
test('a complete query-version-4 package verifies and yields its test records',async()=>{
 const r=await verifyExplorerPackage(await buildV4Package(rows));
 assert.equal(r.artifact.injectionMonthly[0].uic_number,SYNTHETIC_UIC);
 assert.deepEqual(r.tests.bhp.map(x=>x.bhp_psia),[1512,1705,1731]);assert.equal(r.tests.srt[0].formation_frac_press_psig,1610);
 assert.deepEqual(Object.keys(r.tests.sha256).sort(),['tests.json','tests_bhp.csv','tests_dictionary.json','tests_srt.csv']);
 assert.equal(Object.isFrozen(r.tests.bhp[0]),true);
 assert.match(r.preview.warnings.join(' '),/Source field named psia; RRC Permian guidance says PSIG/);
});
test('the committed v2 fixture still verifies with no test records',async()=>{
 const r=await verifyExplorerPackage(await readFile(new URL('./fixtures/explorer-packages/public-uic000056484.tar',import.meta.url)));
 assert.equal(r.tests,null);
});
const reject=async(edit,pattern)=>{const files=await buildV4Files(rows);await edit(files);await assert.rejects(verifyExplorerPackage(pack(files)),pattern);};
test('a tampered test CSV is rejected even with fresh manifest hashes',async()=>{
 await reject(f=>{f.set('tests_bhp.csv',Buffer.from(f.get('tests_bhp.csv').toString().replace(',1705,',',1706,')));repin(f);},/tests_bhp\.csv contradicts/);
});
test('tests.json that disagrees with the raw rows is rejected',async()=>{
 await reject(f=>{const t=JSON.parse(f.get('tests.json'));t.bhp[0].test_depth_ft=3310;f.set('tests.json',Buffer.from(JSON.stringify(t,null,2)+'\n'));repin(f);},/tests\.json contradicts/);
});
test('an altered test dictionary is rejected',async()=>{
 await reject(f=>{f.set('tests_dictionary.json',Buffer.from(f.get('tests_dictionary.json').toString().replace('never converted','converted')));repin(f);},/tests_dictionary\.json/);
});
test('a raw test row for another well is rejected',async()=>{
 await assert.rejects(verifyExplorerPackage(await buildV4Package({...rows,bhp:[bhpRaw(1,'2024-01-01','1','1',{uic_no:'000000999'})]})),/contradict the declared query|exact-UIC/);
});
test('a missing test sidecar, an undeclared file, an unsupported version or a changed source API are rejected',async()=>{
 await reject(f=>{f.delete('tests.json');const m=JSON.parse(f.get('manifest.json'));delete m.files['tests.json'];f.set('manifest.json',Buffer.from(JSON.stringify(m)));repin(f);},/missing tests\.json/);
 await reject(f=>{f.set('notes.txt',Buffer.from('x'));},/undeclared/);
 await reject(f=>{const m=JSON.parse(f.get('manifest.json'));m.scope.query_version=3;f.set('manifest.json',Buffer.from(JSON.stringify(m)));repin(f);},/Unsupported Explorer query version: 3/);
 await reject(f=>{const a=JSON.parse(f.get('sources/acquisition.json'));a.scope.sourceApiId='99999999';f.set('sources/acquisition.json',Buffer.from(JSON.stringify(a)));repin(f);},/Acquisition scope/);
});
