// Test-only. Converts the in-memory synthetic v4 package (helpers/explorer-v4.mjs, UIC 000000417)
// into an Explorer query-version-5 package. Wellbore sidecars follow the producer's link/rows shape
// (Explorer src/wellbore.mjs at b67fe5c); rows are a reduced synthetic projection. Never write to disk.
import {buildV4Files,pack,repin,bytes} from './explorer-v4.mjs';
import {buildRelations} from '../../web/explorer-relations.mjs';

export const V5_LIMITATION='evidence_relations.json lists typed relations derived at export from this version\'s own records and source files (ADR 004 §3); query version 5 queries exactly the version 4 targets. Relations assert exact string equality of source keys only; matched does not establish one physical wellbore, and no relation states casing, cementing, plugging, compliance or hydraulic communication.';
const json=(files,name)=>JSON.parse(files.get(name));
const put=(files,name,value)=>files.set(name,bytes(value));
const str=value=>value==null?'':String(value);
const candidateFields=['uic_number','api_no','operator_number','district_code','lease_number','lease_name','well_no_display','w14_number'];

// Producer-shaped {link,rows} for one dataset (normalizeWellbore: matched / none:no_source_rows / ambiguous).
function wellboreSidecar(dataset,{raw,inventory,selectedKey,selectedRaw,scope,sources}){
 const source=name=>sources.find(s=>s.name===name),snapshot=source('candidate-'+dataset).snapshot_id,inventoryId=source('wellbore-inventory').snapshot_id;
 const [status,reason]=inventory.length>=2?['ambiguous','multiple_inventory_rows']:raw.length?['matched',null]:['none','no_source_rows'];
 const query=(name,rows)=>({url:source(name).url,sha256:source(name).sha256,rows});
 const link={inventory_source_record_key:selectedKey,source_api_id:scope.sourceApiId,basis:'inventory_api_no',status,reason,
  inventory_query:query('wellbore-inventory',inventory.length),wellbore_query:query('candidate-'+dataset,raw.length),
  candidates:inventory.map((row,i)=>({candidate_key:`rrc:uic:${inventoryId}:${i+1}`,selected:JSON.stringify(row)===JSON.stringify(selectedRaw),...Object.fromEntries(candidateFields.map(key=>[key,str(row?.[key])]))})),
  wellbore_row_count:raw.length};
 const rows=raw.map((r,i)=>({source_row_key:`rrc:${dataset}:${snapshot}:${i+1}`,source_api_id:scope.sourceApiId,wellbore_link_status:status,source_id:str(r.id),api_no:str(r.api_no),record_sequence:str(r.record_sequence),on_top_record:null,depth_reference_code:str(r.depth_reference_code),source_snapshot_id:snapshot,quality_flags:[]}));
 return {schemaVersion:1,artifactId:null,dataset,scope:{query_version:5,source_api_id:scope.sourceApiId,wellbore_limit:scope.wellboreLimit,wellbore_inventory_limit:scope.wellboreInventoryLimit,order:'record_sequence,id',returned:rows.length,status:rows.length?'returned_below_cap':'confirmed_empty',window:'exact api_no; not limited to reporting period'},link,rows};
}

/** Rebuild evidence_relations.json from the package's own files with the pinned Explorer builder. */
export function relationsBody(files){
 const manifest=json(files,'manifest.json'),normalized=json(files,'normalized.json'),tests=json(files,'tests.json');
 const casing=json(files,'casing.json'),plugging=json(files,'plugging.json');
 const r=buildRelations({artifactId:manifest.artifact_id,scope:json(files,'sources/acquisition.json').scope,inventory:normalized.inventory,monthly:normalized.injectionMonthly,
  testRows:{bhp:tests.bhp,srt:tests.srt},wellboreRows:{casing:{link:casing.link,rows:casing.rows},plugging:{link:plugging.link,rows:plugging.rows}},sources:manifest.sources});
 return JSON.stringify(r,null,2)+'\n';
}

/** A complete synthetic v5 package: the v4 package with the closed v4 -> v5 manifest delta applied. */
export async function buildV5Files(options){
 const files=await buildV4Files(options);
 // Acquisition scope, tests.json and the wellbore sidecars carry query version 5. No sources/ raw
 // body or retrieval sidecar changes, so manifest.sources and sourceIds stay as v4 derived them.
 const acquisition=json(files,'sources/acquisition.json');acquisition.scope.queryVersion=5;put(files,'sources/acquisition.json',acquisition);
 const tests=json(files,'tests.json');tests.scope.query_version=5;put(files,'tests.json',tests);
 const manifest=json(files,'manifest.json'),normalized=json(files,'normalized.json'),scope=acquisition.scope;
 const inventory=json(files,'sources/wellbore-inventory.json'),selectedRaw=json(files,'sources/candidate-inventory.json')[0];
 for(const dataset of ['casing','plugging']){
  const sidecar=wellboreSidecar(dataset,{raw:json(files,`sources/candidate-${dataset}.json`),inventory,selectedKey:normalized.inventory[0].source_record_key,selectedRaw,scope,sources:manifest.sources});
  sidecar.artifactId=manifest.artifact_id;put(files,dataset+'.json',sidecar);
 }
 manifest.transformation_version='rrc-odp-v2.3.0';manifest.scope.query_version=5;manifest.limitations=[...manifest.limitations,V5_LIMITATION];
 delete manifest.files['evidence_relations.json'];manifest.files['evidence_relations.json']={sha256:'',bytes:0};
 put(files,'manifest.json',manifest);normalized.manifest=manifest;put(files,'normalized.json',normalized);
 files.set('evidence_relations.json',Buffer.from(relationsBody(files)));
 repin(files);
 return files;
}
export const buildV5Package=async options=>pack(await buildV5Files(options));
