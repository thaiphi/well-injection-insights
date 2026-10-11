import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';
import {normalizeExplorerRows,createExplorerDictionary,inventoryColumns,monthlyColumns} from '../web/explorer-evidence.mjs';
import {validatePublicArtifact} from '../dist/publicArtifact.js';
import {createExplorerReceiver} from '../web/explorer-receiver.mjs';
import {explorerWholeVersionScope} from '../web/explorer-scope.mjs';

// SELF-AUTHORED semantic probes, derived in memory from preserved evidence.
// Resealing proves internal consistency only: these are NOT new public pins or
// evidence of a fresh official acquisition. No fixture/data/reference is written.
const original=await readFile(new URL('./fixtures/explorer-packages/public-uic000056484.tar',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const get=(files,name)=>JSON.parse(files.get(name));
const put=(files,name,value)=>files.set(name,encode(value));
function unpack(archive){
 const files=new Map();
 for(let offset=0;archive[offset]!==0;){
  const name=archive.subarray(offset,offset+100).toString().split('\0')[0],size=parseInt(archive.subarray(offset+124,offset+136).toString(),8);
  files.set(name,Buffer.from(archive.subarray(offset+512,offset+512+size)));offset+=512+Math.ceil(size/512)*512;
 }
 return files;
}
function pack(files){
 const chunks=[];
 for(const [name,body] of files){
  const header=Buffer.alloc(512),octal=(value,width)=>value.toString(8).padStart(width-1,'0')+'\0';
  header.write(name,0,100);header.write(octal(0o644,8),100);header.write(octal(0,8),108);header.write(octal(0,8),116);header.write(octal(body.length,12),124);header.write(octal(0,12),136);header[156]=48;header.write('ustar\0',257);header.write('00',263);header.fill(32,148,156);header.write(header.reduce((sum,value)=>sum+value,0).toString(8).padStart(6,'0')+'\0 ',148);
  chunks.push(header,body,Buffer.alloc((512-body.length%512)%512));
 }
 return Buffer.concat([...chunks,Buffer.alloc(1024)]);
}
function seal(files){
 const manifest=get(files,'manifest.json'),normalized=get(files,'normalized.json');
 for(const [name,entry] of Object.entries(manifest.files)){const body=files.get(name);manifest.files[name]={...entry,sha256:hash(body),bytes:body.length};}
 for(const source of manifest.sources){const body=files.get(source.raw_file);source.sha256=hash(body);source.bytes=body.length;}
 const payload={schemaVersion:normalized.schemaVersion,artifactId:normalized.artifactId,inventory:normalized.inventory,injectionMonthly:normalized.injectionMonthly,qualityReport:normalized.qualityReport,dataDictionary:normalized.dataDictionary};
 manifest.normalized_payload_sha256=hash(JSON.stringify(payload));normalized.manifest=manifest;
 put(files,'manifest.json',manifest);put(files,'normalized.json',normalized);
 const pin=get(files,'version-pins.json');pin.artifactId=manifest.artifact_id;pin.path=`/artifacts/${manifest.artifact_id}/`;pin.manifestSha256=hash(files.get('manifest.json'));pin.normalizedSha256=hash(files.get('normalized.json'));put(files,'version-pins.json',pin);
 return pack(files);
}
const csv=(rows,columns)=>columns.join(',')+'\n'+rows.map(row=>columns.map(key=>{
 const value=Array.isArray(row[key])?row[key].join('|'):String(row[key]??'');return /[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value;
}).join(',')).map(row=>row+'\n').join('');
export function selfAuthoredPackage({monthly=rows=>rows,inventory=rows=>rows,after=()=>{}}={}){
 const files=unpack(original),manifest=get(files,'manifest.json'),normalized=get(files,'normalized.json');
 const rawInventory=inventory(get(files,'sources/candidate-inventory.json')),rawMonthly=monthly(get(files,'sources/candidate-monthly.json'));
 const sourceIds={};
 for(const [kind,rows,dataset] of [['inventory',rawInventory,'givw-z9t4'],['monthly',rawMonthly,'qq2j-f2zm']]){
  const name=`sources/candidate-${kind}.json`;put(files,name,rows);
  const metadata=get(files,`sources/candidate-${kind}.source.json`);metadata.sha256=hash(files.get(name));metadata.bytes=files.get(name).length;put(files,`sources/candidate-${kind}.source.json`,metadata);
  sourceIds[kind]=`${dataset}:${metadata.sha256.slice(0,16)}`;
  Object.assign(manifest.sources.find(source=>source.raw_file===name),{snapshot_id:sourceIds[kind],sha256:metadata.sha256,bytes:metadata.bytes});
 }
 const canonical=normalizeExplorerRows(rawInventory,rawMonthly,sourceIds,get(files,'sources/acquisition.json').scope);
 Object.assign(normalized,{artifactId:'self-authored-evidence-probe',inventory:canonical.inventory,injectionMonthly:canonical.monthly,qualityReport:canonical.quality,dataDictionary:createExplorerDictionary(canonical,true)});
 manifest.artifact_id=normalized.artifactId;manifest.scope.inventory_returned=rawInventory.length;manifest.scope.monthly_returned=rawMonthly.length;
 manifest.real_history_status=canonical.monthly.length&&canonical.quality.inventory.accepted===canonical.inventory.length&&canonical.quality.monthly.accepted===canonical.monthly.length&&canonical.quality.parent_join.matched===canonical.monthly.length?'verified_bounded_linkage':'incomplete';
 put(files,'quality_report.json',normalized.qualityReport);put(files,'data_dictionary.json',normalized.dataDictionary);
 files.set('inventory.csv',Buffer.from(csv(normalized.inventory,inventoryColumns)));files.set('injection_monthly.csv',Buffer.from(csv(normalized.injectionMonthly,monthlyColumns)));
 put(files,'manifest.json',manifest);put(files,'normalized.json',normalized);
 const pin=get(files,'version-pins.json');pin.realHistoryStatus=manifest.real_history_status;put(files,'version-pins.json',pin);
 after(files);return seal(files);
}

test('fully accepted original package keeps strict eligibility and original hashes',async()=>{
 const result=await verifyExplorerPackage(original);
 assert.deepEqual(result.calculationEligibility,{ready:true,reasons:[]});
 assert.equal(result.pin.packageSha256,hash(original));assert.ok(Object.isFrozen(result.calculationEligibility));
 assert.equal(await validatePublicArtifact(result.artifact),result.artifact);
});

for(const [label,options,flag] of [
 ['negative monthly volume',{monthly:rows=>{rows[0].vol_liq='-1';return rows;}},'invalid_negative:vol_liq'],
 ['quarantined parent',{inventory:rows=>{rows[0].max_liq_inj_pressure='-1';return rows;}},'invalid_negative:max_liq_inj_pressure'],
 ['duplicate periods and report IDs',{monthly:rows=>[...rows,structuredClone(rows[0])]},'duplicate_or_revision_period']
])test(`${label} stays complete immutable evidence and cannot calculate`,async()=>{
 const archive=selfAuthoredPackage(options),result=await verifyExplorerPackage(archive);
 assert.equal(result.calculationEligibility.ready,false);assert.ok(result.calculationEligibility.reasons.length);
 assert.ok(result.calculationEligibility.reasons.some(reason=>reason.includes(flag)));
 assert.equal(result.pin.packageSha256,hash(archive));assert.equal(result.artifact.manifest.real_history_status,'incomplete');
 assert.deepEqual(result.artifact,get(unpack(archive),'normalized.json'));
 assert.ok([...result.artifact.inventory,...result.artifact.injectionMonthly].some(row=>row.quality_flags.includes(flag)));
 assert.ok(Object.isFrozen(result.artifact));assert.ok(Object.isFrozen(result.artifact.injectionMonthly[0]));
 await assert.rejects(validatePublicArtifact(result.artifact));
});

test('canonically empty monthly response with successful acquisition is evidence only',async()=>{
 const archive=selfAuthoredPackage({monthly:()=>[]}),result=await verifyExplorerPackage(archive);
 assert.deepEqual(result.artifact.injectionMonthly,[]);assert.equal(result.calculationEligibility.ready,false);
 assert.ok(result.calculationEligibility.reasons.includes('No monthly history is available.'));
 assert.equal(result.artifact.qualityReport.monthly.raw,0);assert.equal(result.pin.packageSha256,hash(archive));
 await assert.rejects(validatePublicArtifact(result.artifact));
});

test('empty response still requires successful acquisition, source sidecars and reconciled row counts',async()=>{
 for(const after of [
  files=>{const value=get(files,'sources/acquisition.json');value.status='failed';put(files,'sources/acquisition.json',value);},
  files=>{const value=get(files,'sources/candidate-monthly.source.json');value.http_status=206;put(files,'sources/candidate-monthly.source.json',value);},
  files=>{const value=get(files,'manifest.json');value.scope.monthly_returned=1;put(files,'manifest.json',value);}
 ])await assert.rejects(verifyExplorerPackage(selfAuthoredPackage({monthly:()=>[],after})),/acquisition|sidecar|Manifest scope/i);
});

test('ambiguous or missing raw parents remain outside the exact selected source contract',async()=>{
 for(const inventory of [()=>[],rows=>[rows[0],structuredClone(rows[0])]])await assert.rejects(verifyExplorerPackage(selfAuthoredPackage({inventory})),/Source row bounds|exact parent/);
});

test('out-of-query raw UIC or dates cannot become inspected evidence through quarantine',async()=>{
 for(const options of [
  {monthly:rows=>{rows[0].uic_no='000000001';return rows;}},
  {monthly:rows=>{rows[0].formatted_date='not a date';return rows;}},
  {monthly:rows=>{rows[0].formatted_date='1899-12-01T00:00:00';return rows;}},
  {monthly:rows=>{rows[0].formatted_date='9999-01-01T00:00:00';return rows;}}
 ])await assert.rejects(verifyExplorerPackage(selfAuthoredPackage(options)),/query predicates/);
});

test('quarantine cannot hide substituted quality, raw values, source retrieval proof or status',async()=>{
 const monthly=rows=>{rows[0].vol_liq='-1';return rows;};
 for(const [after,pattern] of [
  [files=>{const value=get(files,'normalized.json');value.qualityReport.monthly.quarantined=0;put(files,'quality_report.json',value.qualityReport);put(files,'normalized.json',value);},/Quality report/],
  [files=>{const value=get(files,'normalized.json');value.injectionMonthly[0].injected_liquid_bbl=0;put(files,'normalized.json',value);},/contradict/],
  [files=>{const value=get(files,'sources/candidate-monthly.source.json');value.sha256='0'.repeat(64);put(files,'sources/candidate-monthly.source.json',value);},/sidecar/],
  [files=>{const value=get(files,'manifest.json');value.real_history_status='verified_bounded_linkage';put(files,'manifest.json',value);const pin=get(files,'version-pins.json');pin.realHistoryStatus=value.real_history_status;put(files,'version-pins.json',pin);},/status/i],
  [files=>{const pin=get(files,'version-pins.json');pin.realHistoryStatus='verified_bounded_linkage';put(files,'version-pins.json',pin);},/publication pins/]
 ])await assert.rejects(verifyExplorerPackage(selfAuthoredPackage({monthly,after})),pattern);
 const corrupt=selfAuthoredPackage({monthly});corrupt[512]^=1;await assert.rejects(verifyExplorerPackage(corrupt),/JSON|hash|identity/);
});

test('malformed normalized schema is rejected before calculation eligibility is considered',async()=>{
 for(const schemaVersion of [undefined,2,'1'])await assert.rejects(verifyExplorerPackage(selfAuthoredPackage({after:files=>{const value=get(files,'normalized.json');value.schemaVersion=schemaVersion;put(files,'normalized.json',value);}})),/schema/i);
});

test('fully accepted canonical rows cannot be relabeled incomplete by manifest and publication',async()=>{
 await assert.rejects(verifyExplorerPackage(selfAuthoredPackage({after:files=>{
  const manifest=get(files,'manifest.json');manifest.real_history_status='incomplete';put(files,'manifest.json',manifest);
  const pin=get(files,'version-pins.json');pin.realHistoryStatus='incomplete';put(files,'version-pins.json',pin);
 }})),/history status/);
});

test('actual incomplete archive transfers with exact whole-version scope and explicit evidence-only adoption',async()=>{
 for(const monthly of [()=>[],rows=>{rows[0].vol_liq='-1';return rows;}]){
  const archive=selfAuthoredPackage({monthly}),verified=await verifyExplorerPackage(archive),adoptions=[];
  const receiver=createExplorerReceiver({onAdopt:value=>adoptions.push(value)});
  const offer={artifactId:verified.artifact.artifactId,packageBytes:archive.length,hashes:Object.fromEntries(['packageSha256','manifestSha256','normalizedSha256'].map(key=>[key,verified.pin[key]])),scope:explorerWholeVersionScope(verified.artifact)};
  const bytes=archive.buffer.slice(archive.byteOffset,archive.byteOffset+archive.byteLength);
  assert.equal(await receiver.selectTransfer(bytes,offer,{acquisitionOrigin:'explorer_handoff'}),true);
  assert.equal(receiver.state.phase,'preview');assert.equal(adoptions.length,0);
  assert.equal(receiver.state.candidate.calculationEligibility.ready,false);
  assert.equal(receiver.adopt(),true);assert.equal(adoptions.length,1);
  assert.equal(hash(adoptions[0].bytes),hash(archive));assert.deepEqual(adoptions[0].artifact,verified.artifact);
  const changed=structuredClone(offer);changed.scope.periodEnd=changed.scope.periodEnd===null?'2025-01-01':'2025-05-01';
  assert.equal(await receiver.selectTransfer(bytes,changed,{}),false);assert.equal(receiver.state.phase,'error');assert.equal(receiver.state.adopted,adoptions[0]);assert.match(receiver.state.message,/scope/);
 }
});
