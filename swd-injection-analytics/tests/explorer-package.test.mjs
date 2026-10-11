import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyExplorerPackage,EXPLORER_PACKAGE_LIMITS} from '../web/explorer-package.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=value=>Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
const fixtureRoot=new URL('./fixtures/explorer-packages/',import.meta.url);
const actual=await readFile(new URL('public-uic000056484.tar',fixtureRoot));
const fixtureProof=JSON.parse(await readFile(new URL('provenance.json',fixtureRoot)));
const originalPin=await readFile(new URL('../data/explorer-pin.json',import.meta.url));
function checksum(header){header.fill(32,148,156);header.write(header.reduce((sum,value)=>sum+value,0).toString(8).padStart(6,'0')+'\0 ',148);return header;}
function pack(input){
 const chunks=[];
 for(const [name,value] of input instanceof Map?input:Array.isArray(input)?input:Object.entries(input)){
  const body=bytes(value),header=Buffer.alloc(512),octal=(value,width)=>value.toString(8).padStart(width-1,'0')+'\0';
  header.write(name,0,100);header.write(octal(0o644,8),100);header.write(octal(0,8),108);header.write(octal(0,8),116);header.write(octal(body.length,12),124);header.write(octal(0,12),136);header[156]=48;header.write('ustar\0',257);header.write('00',263);
  chunks.push(checksum(header),body,Buffer.alloc((512-body.length%512)%512));
 }
 return Buffer.concat([...chunks,Buffer.alloc(1024)]);
}
function unpack(archive){
 const files=new Map();
 for(let offset=0;archive[offset]!==0;){
  const name=archive.subarray(offset,offset+100).toString().split('\0')[0],size=parseInt(archive.subarray(offset+124,offset+136).toString(),8);
  files.set(name,Buffer.from(archive.subarray(offset+512,offset+512+size)));offset+=512+Math.ceil(size/512)*512;
 }
 return files;
}
const json=(files,name)=>JSON.parse(files.get(name));
const setJson=(files,name,value)=>files.set(name,bytes(value));
// Recompute every package-controlled digest after adversarial edits. These cases
// must fail semantic/evidence checks even though their own hash inventories agree.
function reseal(files){
 const manifest=json(files,'manifest.json'),normalized=json(files,'normalized.json');
 for(const [name,entry] of Object.entries(manifest.files)){const body=files.get(name);if(body)manifest.files[name]={...entry,sha256:hash(body),bytes:body.length};}
 for(const source of manifest.sources){const body=files.get(source.raw_file);if(body){source.sha256=hash(body);source.bytes=body.length;}}
 const payload={schemaVersion:normalized.schemaVersion,artifactId:normalized.artifactId,inventory:normalized.inventory,injectionMonthly:normalized.injectionMonthly,qualityReport:normalized.qualityReport,dataDictionary:normalized.dataDictionary};
 manifest.normalized_payload_sha256=hash(JSON.stringify(payload));normalized.manifest=manifest;
 setJson(files,'manifest.json',manifest);setJson(files,'normalized.json',normalized);
 if(files.has('version-pins.json')){const pin=json(files,'version-pins.json');pin.manifestSha256=hash(files.get('manifest.json'));pin.normalizedSha256=hash(files.get('normalized.json'));setJson(files,'version-pins.json',pin);}
 return pack(files);
}
async function edited(mutator,{seal=true}={}){const files=unpack(actual);await mutator(files);return seal?reseal(files):pack(files);}
async function legacyPackage(){
 const root=new URL('../data/explorer/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root))),names=new Set(['manifest.json','normalized.json',...Object.keys(manifest.files),...manifest.sources.map(source=>source.raw_file)]),files=[];
 for(const name of [...names].sort((a,b)=>a.localeCompare(b)))files.push([name,await readFile(new URL(name,root))]);return pack(files);
}

test('actual unmodified producer archive verifies with portable fixture provenance and explicit unauthenticated acquisition',async()=>{
 assert.equal(actual.length,fixtureProof.packageBytes);assert.equal(hash(actual),fixtureProof.packageSha256);
 const {artifact,pin,preview,files}=await verifyExplorerPackage(actual);
 assert.equal(artifact.artifactId,fixtureProof.artifactId);assert.equal(pin.manifestSha256,fixtureProof.manifestSha256);assert.equal(pin.normalizedSha256,fixtureProof.normalizedSha256);assert.equal(pin.packageSha256,fixtureProof.packageSha256);assert.equal(pin.filesVerified,25);
 assert.equal(preview.inventoryCount,1);assert.equal(preview.monthlyCount,16);assert.equal(preview.packageFileCount,28);assert.deepEqual(preview.uicNumbers,['000056484']);
 assert.equal(preview.provenance.acquisitionOrigin,'user_upload');assert.equal(preview.provenance.contentKind,'public_reported');assert.equal(preview.provenance.authentication,'not_established');assert.match(preview.warnings[0],/authenticity is not established/);
 assert.ok(files.includes('sources/uic-manual.pdf'));assert.ok(Object.isFrozen(artifact.injectionMonthly[0]));assert.ok(Object.isFrozen(pin));
 assert.equal(preview.periodStart,'2024-01-01');assert.equal(preview.periodEnd,'2025-04-01');
});

test('known legacy complete snapshot retains trusted pins, source pressure anchors and Gregorian divisor',async()=>{
 const result=await verifyExplorerPackage(await legacyPackage()),stored=JSON.parse(originalPin);
 for(const [key,value] of Object.entries(stored))assert.equal(result.pin[key],value,key);
 assert.equal(result.preview.provenance.authentication,'trusted_pinned_digest');assert.equal(result.preview.monthlyCount,28);assert.equal(result.preview.inventoryCount,5);
 const jan=result.artifact.injectionMonthly.find(row=>row.period_start==='2024-01-01'),feb=result.artifact.injectionMonthly.find(row=>row.period_start==='2024-02-01');
 assert.equal(jan.uic_number,'000020838');assert.equal(jan.injected_liquid_bbl,17173);assert.equal(jan.reported_avg_injection_pressure_psi,900);assert.equal(jan.reported_max_injection_pressure_psi,900);assert.equal(feb.calendar_days,29);assert.equal(feb.calculated_calendar_day_avg_bpd,17927/29);
});

test('input bounds and cancellation reject before adoption',async()=>{
 await assert.rejects(verifyExplorerPackage('not bytes'),/TAR bytes/);
 await assert.rejects(verifyExplorerPackage(new Uint8Array(EXPLORER_PACKAGE_LIMITS.packageBytes+1)),/byte limit/);
 const controller=new AbortController();controller.abort();await assert.rejects(verifyExplorerPackage(actual,{signal:controller.signal}),{name:'AbortError'});
});

test('verification owns its input before asynchronous hashing',async()=>{
 const candidate=Buffer.from(actual),pending=verifyExplorerPackage(candidate);candidate.fill(0);const verified=await pending;
 assert.equal(verified.pin.packageSha256,fixtureProof.packageSha256);
});

test('TAR rejects traversal, absolute, Windows, empty-segment and encoded paths',async()=>{
 for(const name of ['../manifest.json','/manifest.json','C:/manifest.json','sources\\evil.json','sources//evil.json','sources/./evil.json','sources/%2e%2e/evil.json'])await assert.rejects(verifyExplorerPackage(pack([[name,'x']])),/path|TAR/);
});

test('TAR rejects duplicate and case-conflicting paths',async()=>{
 for(const name of ['manifest.json','MANIFEST.JSON'])await assert.rejects(verifyExplorerPackage(pack([['manifest.json','x'],[name,'y']])),/Duplicate/);
});

test('TAR refuses links, directory/PAX/GNU extension entries and prefixed names',async()=>{
 for(const type of [0,49,50,53,120,103,76,75]){
  const archive=pack([['manifest.json','x']]);archive[156]=type;checksum(archive.subarray(0,512));await assert.rejects(verifyExplorerPackage(archive),/regular-file/);
 }
 const archive=pack([['manifest.json','x']]);archive.write('prefix',345);checksum(archive.subarray(0,512));await assert.rejects(verifyExplorerPackage(archive),/regular-file/);
});

test('TAR rejects checksum corruption, base-256 sizes, oversize files and excess entry counts',async()=>{
 const corrupt=Buffer.from(actual);corrupt[20]^=1;await assert.rejects(verifyExplorerPackage(corrupt),/checksum/);
 const binary=pack([['manifest.json','x']]);binary[124]=128;checksum(binary.subarray(0,512));await assert.rejects(verifyExplorerPackage(binary),/TAR size/);
 const huge=pack([['manifest.json','x']]);huge.write((10_000_001).toString(8).padStart(11,'0')+'\0',124);checksum(huge.subarray(0,512));await assert.rejects(verifyExplorerPackage(huge),/limit/);
 const tooMany=pack(Array.from({length:104},(_,i)=>[`file-${i}`,Buffer.alloc(0)]));await assert.rejects(verifyExplorerPackage(tooMany),/limit/);
});

test('TAR rejects truncated blocks, missing end markers, nonzero padding and trailing data',async()=>{
 await assert.rejects(verifyExplorerPackage(actual.subarray(0,actual.length-1)),/unaligned/);
 await assert.rejects(verifyExplorerPackage(actual.subarray(0,actual.length-1024)),/end marker/);
 const padding=pack([['manifest.json','x']]);padding[513]=1;await assert.rejects(verifyExplorerPackage(padding),/padding/);
 const trailing=Buffer.concat([actual,Buffer.alloc(512)]);trailing[trailing.length-1]=1;await assert.rejects(verifyExplorerPackage(trailing),/trailing data/);
 const singleEnd=pack([['manifest.json','x']]).subarray(0,1536);await assert.rejects(verifyExplorerPackage(singleEnd),/end marker/);
});

test('all preserved raw bodies and manifest hash/byte inventories are checked',async()=>{
 await assert.rejects(verifyExplorerPackage(await edited(files=>files.get('sources/uic-manual.pdf')[100]^=1,{seal:false})),/hash or byte/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const manifest=json(files,'manifest.json');manifest.sources[0].bytes++;setJson(files,'manifest.json',manifest);const normalized=json(files,'normalized.json');normalized.manifest=manifest;setJson(files,'normalized.json',normalized);},{seal:false})),/Conflicting/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>files.delete('sources/uic-manual.pdf'))),/missing|undeclared/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>files.set('unexpected.html',bytes('<script>bad</script>')))),/undeclared/);
});

test('invalid UTF-8, duplicate JSON keys and deeply nested structures fail closed',async()=>{
 await assert.rejects(verifyExplorerPackage(await edited(files=>files.set('manifest.json',Buffer.from([0xff])),{seal:false})),/UTF-8/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const text=files.get('sources/acquisition.json').toString();files.set('sources/acquisition.json',bytes(text.replace('"testFixture": false','"testFixture": true, "testFixture": false')));})),/Duplicate JSON/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>files.set('sources/acquisition.json',bytes('['.repeat(65)+'0'+']'.repeat(65))))),/bounded limits/);
});

test('normalized identity, payload digest and publication pins cannot diverge',async()=>{
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const a=json(files,'normalized.json');a.artifactId='invented';setJson(files,'normalized.json',a);})),/identity/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const p=json(files,'version-pins.json');p.classification='test_fixture';setJson(files,'version-pins.json',p);})),/Fixture/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const p=json(files,'version-pins.json');p.artifactId='invented';setJson(files,'version-pins.json',p);})),/publication pins/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const m=json(files,'manifest.json');m.normalized_payload_hash_method='trusted';setJson(files,'manifest.json',m);})),/hash contract/);
});

test('all explicit fixture markers are rejected even with recalculated package hashes',async()=>{
 for(const name of ['sources/acquisition.json','sources/lookup.json','sources/candidate-monthly.source.json','sources/lookup-metadata.source.json'])await assert.rejects(verifyExplorerPackage(await edited(files=>{const value=json(files,name);value.testFixture=true;setJson(files,name,value);if(name==='sources/lookup-metadata.source.json'){const lookup=json(files,'sources/lookup.json');lookup.files['lookup-metadata.source.json']=hash(files.get(name));setJson(files,'sources/lookup.json',lookup);}})),/fixture|Fixture/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const m=json(files,'manifest.json');m.testFixture=true;setJson(files,'manifest.json',m);})),/Fixture/);
});

test('source status/classification, endpoints and bounded range are verified independently',async()=>{
 for(const mutate of [a=>a.status='running',a=>delete a.testFixture,a=>a.mode='replay',a=>a.targets[0]='https://example.com/official.json',a=>a.scope.endMonth='2030-01'])await assert.rejects(verifyExplorerPackage(await edited(files=>{const a=json(files,'sources/acquisition.json');mutate(a);setJson(files,'sources/acquisition.json',a);})),/acquisition|Acquisition|range/);
 for(const mutate of [a=>a.url='http://data.texas.gov/resource/qq2j-f2zm.json',a=>a.http_status=206,a=>a.bytes++,a=>a.retrieved_at='not a date',a=>delete a.testFixture])await assert.rejects(verifyExplorerPackage(await edited(files=>{const a=json(files,'sources/candidate-monthly.source.json');mutate(a);setJson(files,'sources/candidate-monthly.source.json',a);})),/sidecar/);
});

test('selected lookup parent, ordinal and evidence hashes must reconcile',async()=>{
 for(const mutate of [s=>s.ordinal=2,s=>s.lookupSha256='0'.repeat(64),s=>s.sourceRecordKey='lookup:2'])await assert.rejects(verifyExplorerPackage(await edited(files=>{const s=json(files,'sources/selection.json');mutate(s);setJson(files,'sources/selection.json',s);const m=json(files,'manifest.json');m.selection=s;setJson(files,'manifest.json',m);})),/selection|Selected|ordinal|parent/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const s=json(files,'sources/lookup.json');s.files['lookup-inventory.json']='0'.repeat(64);setJson(files,'sources/lookup.json',s);})),/Lookup evidence hash/);
});

test('fresh package hashes cannot hide changed raw-derived numbers, identities, dates or zero/null semantics',async()=>{
 for(const change of [a=>a.injectionMonthly[0].injected_liquid_bbl++,a=>a.injectionMonthly[0].reported_avg_injection_pressure_psi=0,a=>a.injectionMonthly[0].parent_key='invented',a=>a.injectionMonthly[0].period_start='2024-02-01',a=>a.injectionMonthly[0].injected_gas_mcf=null,a=>a.inventory[0].permit_liquid_pressure_limit_psi=null])await assert.rejects(verifyExplorerPackage(await edited(files=>{const a=json(files,'normalized.json');change(a);setJson(files,'normalized.json',a);})),/contradict/);
 const verified=await verifyExplorerPackage(actual),row=verified.artifact.injectionMonthly[0],raw=json(unpack(actual),'sources/candidate-monthly.json')[0];
 assert.equal(row.injected_gas_mcf,Number(raw.vol_gas));assert.equal(row.injected_gas_mcf,0);
});

test('CSV parity requires every column, exact quoted values, row counts and missing-vs-zero',async()=>{
 for(const mutate of [text=>text.replace('source_row_key,',''),text=>text.replace(/\n[^\n]+\n/,'\n'),text=>text.replace(',0,',',,'),text=>text+'"unterminated',text=>text.replace('source_row_key','source_row_key,source_row_key')])await assert.rejects(verifyExplorerPackage(await edited(files=>files.set('injection_monthly.csv',bytes(mutate(files.get('injection_monthly.csv').toString()))))),/CSV|csv|record count|normalized value/);
});

test('quality and dictionary semantics must match raw evidence even when duplicate documents agree',async()=>{
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const a=json(files,'normalized.json');a.qualityReport.monthly.accepted--;setJson(files,'quality_report.json',a.qualityReport);setJson(files,'normalized.json',a);})),/Quality report/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const a=json(files,'normalized.json');a.dataDictionary.pressure_basis='Bottomhole pressure';setJson(files,'data_dictionary.json',a.dataDictionary);setJson(files,'normalized.json',a);})),/dictionary/);
 await assert.rejects(verifyExplorerPackage(await edited(files=>{const a=json(files,'normalized.json');a.dataDictionary.fields.reported_avg_injection_pressure_psi.status='synthetic';setJson(files,'data_dictionary.json',a.dataDictionary);setJson(files,'normalized.json',a);})),/dictionary/);
});

test('legacy proof cannot be recreated by repinning an arbitrary self-consistent snapshot',async()=>{
 const files=unpack(await legacyPackage()),a=json(files,'normalized.json');a.artifactId='self-asserted-public';const m=json(files,'manifest.json');m.artifact_id=a.artifactId;setJson(files,'manifest.json',m);setJson(files,'normalized.json',a);
 await assert.rejects(verifyExplorerPackage(reseal(files)),/source proof unavailable/);
});

test('verification never changes the original persistent pin',async()=>{
 await verifyExplorerPackage(actual);assert.deepEqual(await readFile(new URL('../data/explorer-pin.json',import.meta.url)),originalPin);
});
