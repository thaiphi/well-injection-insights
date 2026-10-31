// Test-only. Builds an Explorer query-version-4 package IN MEMORY from the committed v2
// fixture. The UIC is rewritten to the fictional 000000417; every test, casing and plugging
// row and every added document is synthetic. Never write its output into tests/fixtures or data/.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizeExplorerRows,createExplorerDictionary,inventoryColumns,monthlyColumns,testReportOrder} from '../../web/explorer-evidence.mjs';
import {normalizeExplorerTests,explorerCsv,testColumns,testsDictionary} from '../../web/explorer-tests.mjs';

export const SYNTHETIC_UIC='000000417';
const FIXTURE_UIC='000056484',RETRIEVED='2026-10-30T00:00:00.000Z';
const DOC='Synthetic stand-in document for receiver tests; not an RRC publication.\n';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const bytes=v=>Buffer.isBuffer(v)?v:Buffer.from(typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
function checksum(header){header.fill(32,148,156);header.write(header.reduce((sum,value)=>sum+value,0).toString(8).padStart(6,'0')+'\0 ',148);return header;}
export function pack(files){
 const chunks=[];
 for(const [name,value] of files){
  const body=bytes(value),header=Buffer.alloc(512),octal=(v,w)=>v.toString(8).padStart(w-1,'0')+'\0';
  header.write(name,0,100);header.write(octal(0o644,8),100);header.write(octal(0,8),108);header.write(octal(0,8),116);header.write(octal(body.length,12),124);header.write(octal(0,12),136);header[156]=48;header.write('ustar\0',257);header.write('00',263);
  chunks.push(checksum(header),body,Buffer.alloc((512-body.length%512)%512));
 }
 return Buffer.concat([...chunks,Buffer.alloc(1024)]);
}
export function unpack(archive){
 const files=new Map();
 for(let offset=0;archive[offset]!==0;){
  const name=archive.subarray(offset,offset+100).toString().split('\0')[0],size=parseInt(archive.subarray(offset+124,offset+136).toString(),8);
  files.set(name,Buffer.from(archive.subarray(offset+512,offset+512+size)));offset+=512+Math.ceil(size/512)*512;
 }
 return files;
}
const json=(files,name)=>JSON.parse(files.get(name));
const put=(files,name,value)=>files.set(name,bytes(value));

/** Recompute each retrieval sidecar's sha256/bytes from its raw body, then the lookup hash inventory and selection pin. */
export function refreshEvidence(files){
 for(const name of [...files.keys()].filter(n=>n.endsWith('.source.json'))){
  const stem=name.slice(0,-'.source.json'.length),raw=[...files.keys()].find(k=>!k.endsWith('.source.json')&&k.replace(/\.[^./]+$/,'')===stem);
  const meta=json(files,name),body=files.get(raw);meta.sha256=sha(body);meta.bytes=body.length;put(files,name,meta);
 }
 const lookup=json(files,'sources/lookup.json');
 for(const n of ['lookup-inventory.json','lookup-inventory.source.json','lookup-metadata.json','lookup-metadata.source.json'])lookup.files[n]=sha(files.get('sources/'+n));
 put(files,'sources/lookup.json',lookup);
 const selection=json(files,'sources/selection.json');selection.lookupSha256=lookup.files['lookup-inventory.json'];put(files,'sources/selection.json',selection);
}

/** Recompute manifest.files hashes, normalized.manifest and version-pins. Never re-derives content. */
export function repin(files){
 const manifest=json(files,'manifest.json');
 for(const name of Object.keys(manifest.files)){const body=files.get(name);if(body)manifest.files[name]={sha256:sha(body),bytes:body.length};}
 const normalized=json(files,'normalized.json');normalized.manifest=manifest;
 const m=bytes(manifest),n=bytes(normalized);files.set('manifest.json',m);files.set('normalized.json',n);
 put(files,'version-pins.json',{schemaVersion:1,artifactId:manifest.artifact_id,path:`/artifacts/${manifest.artifact_id}/`,manifestSha256:sha(m),normalizedSha256:sha(n),classification:'public_reported',realHistoryStatus:manifest.real_history_status});
}

/** Rebuild every derived file and the manifest from the raw sources, following V4 §2, §3 and §6. */
export function derive(files){
 const hashOf=n=>sha(files.get('sources/'+n)),sid=(id,n)=>`${id}:${hashOf(n).slice(0,16)}`;
 const scope=json(files,'sources/acquisition.json').scope,rawInventory=json(files,'sources/candidate-inventory.json'),rawMonthly=json(files,'sources/candidate-monthly.json');
 const sourceIds={inventory:sid('givw-z9t4','candidate-inventory.json'),monthly:sid('qq2j-f2zm','candidate-monthly.json'),bhp:sid('qxfy-wcfs','candidate-bhp.json'),srt:sid('h54t-xnbi','candidate-srt.json'),
  wellbore_inventory:sid('givw-z9t4','wellbore-inventory.json'),casing:sid('u9m4-xnh6','candidate-casing.json'),plugging:sid('wfzn-9fje','candidate-plugging.json')};
 const canonical=normalizeExplorerRows(rawInventory,rawMonthly,{inventory:sourceIds.inventory,monthly:sourceIds.monthly},scope),dictionary=createExplorerDictionary(canonical,true);
 put(files,'quality_report.json',canonical.quality);put(files,'data_dictionary.json',dictionary);
 files.set('inventory.csv',Buffer.from(explorerCsv(canonical.inventory,inventoryColumns)));files.set('injection_monthly.csv',Buffer.from(explorerCsv(canonical.monthly,monthlyColumns)));
 const manifest=json(files,'manifest.json'),artifactId=manifest.artifact_id;
 const testRows=normalizeExplorerTests({bhp:json(files,'sources/candidate-bhp.json'),srt:json(files,'sources/candidate-srt.json')},sourceIds,canonical.inventory,scope);
 const status=rows=>rows.length?'returned_below_cap':'confirmed_empty';
 const tests={schemaVersion:1,artifactId,scope:{query_version:4,uic_number:scope.monthlyUic,test_report_limit:1000,order:`BHP ${testReportOrder.bhp}; SRT ${testReportOrder.srt}`,bhp_returned:testRows.bhp.length,srt_returned:testRows.srt.length,bhp_status:status(testRows.bhp),srt_status:status(testRows.srt),window:'exact uic_no; not limited to reporting period'},bhp:testRows.bhp,srt:testRows.srt,quality:testRows.quality};
 files.set('tests.json',Buffer.from(JSON.stringify(tests,null,2)+'\n'));
 files.set('tests_bhp.csv',Buffer.from(explorerCsv(testRows.bhp,testColumns.bhp)));files.set('tests_srt.csv',Buffer.from(explorerCsv(testRows.srt,testColumns.srt)));
 files.set('tests_dictionary.json',Buffer.from(JSON.stringify(testsDictionary(),null,2)+'\n'));
 put(files,'casing.json',{artifactId,scope:{query_version:4,source_api_id:scope.sourceApiId},rows:json(files,'sources/candidate-casing.json')});
 put(files,'plugging.json',{artifactId,scope:{query_version:4,source_api_id:scope.sourceApiId},rows:json(files,'sources/candidate-plugging.json')});
 files.set('casing.csv',Buffer.from('synthetic\n'));files.set('plugging.csv',Buffer.from('synthetic\n'));put(files,'wellbore_dictionary.json',{schema_version:1,note:'Synthetic stand-in; receiver tests check hashes only.'});
 const [year,month]=scope.endMonth.split('-').map(Number);
 manifest.transformation_version='rrc-odp-v2.2.0';
 manifest.scope={query_version:4,uic_number:scope.monthlyUic,start:scope.startMonth+'-01',end:`${scope.endMonth}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`,inventory_limit:25,inventory_returned:1,monthly_limit:1000,monthly_returned:rawMonthly.length,pagination:'Complete bounded response below cap; no statewide coverage',test_report_limit:1000,wellbore_limit:1000,wellbore_inventory_limit:25};
 const selection=json(files,'sources/selection.json');manifest.selection=selection;
 const kinds={'candidate-inventory.json':'inventory','candidate-monthly.json':'monthly','candidate-bhp.json':'bhp','candidate-srt.json':'srt','wellbore-inventory.json':'wellbore_inventory','candidate-casing.json':'casing','candidate-plugging.json':'plugging'};
 const entry=file=>{
  const body=files.get('sources/'+file),meta=json(files,'sources/'+file.replace(/\.[^.]+$/,'')+'.source.json'),kind=kinds[file]??(file.endsWith('.json')?'metadata':'documentation'),label=file.endsWith('.json')?file.slice(0,-5):file;
  const title=kind==='metadata'?JSON.parse(body).name:kind==='documentation'?undefined:json(files,`sources/${kind==='wellbore_inventory'?'inventory':kind}-metadata.json`).name;
  return {snapshot_id:sourceIds[kind]??`${label}:${sha(body).slice(0,16)}`,name:label,...(title===undefined?{}:{title}),kind,...Object.fromEntries(Object.entries(meta).filter(([k])=>['url','retrieved_at','http_status','last_modified','etag','sha256','bytes','testFixture'].includes(k))),sha256:sha(body),bytes:body.length,raw_file:'sources/'+file};
 };
 manifest.sources=[...['candidate-inventory.json','candidate-monthly.json','inventory-metadata.json','monthly-metadata.json','uic-manual.pdf','rrc-resources.html','uic-query-help.html'].map(entry),
  {snapshot_id:'lookup:'+selection.lookupSha256.slice(0,16),name:'lookup-inventory',kind:'selection',...json(files,'sources/lookup-inventory.source.json'),raw_file:'sources/lookup-inventory.json'},
  ...['candidate-bhp.json','candidate-srt.json','bhp-metadata.json','srt-metadata.json','srt-guidelines.html','bhp-permian-nto.pdf','wellbore-inventory.json','candidate-casing.json','candidate-plugging.json','casing-metadata.json','plugging-metadata.json','wellbore-wba091.pdf','form-w2.pdf','form-w3.pdf'].map(entry)];
 manifest.files={};for(const name of [...files.keys()].sort())if(!['manifest.json','normalized.json','version-pins.json'].includes(name))manifest.files[name]={sha256:'',bytes:0};
 const payload={schemaVersion:1,artifactId,inventory:canonical.inventory,injectionMonthly:canonical.monthly,qualityReport:canonical.quality,dataDictionary:dictionary};
 manifest.normalized_payload_sha256=sha(Buffer.from(JSON.stringify(payload)));
 put(files,'manifest.json',manifest);put(files,'normalized.json',{...payload,manifest});
 repin(files);
}

/** A complete synthetic v4 package. Rows are raw ODP-shaped objects (strings, as published); uic_no defaults to the synthetic UIC. */
export async function buildV4Files({bhp=[],srt=[],casing=[{record_sequence:'1',id:'1'}],plugging=[]}={}){
 const files=unpack(await readFile(new URL('../fixtures/explorer-packages/public-uic000056484.tar',import.meta.url)));
 for(const [name,body] of [...files])if(/\.(json|csv)$/.test(name))files.set(name,Buffer.from(body.toString('utf8').replaceAll(FIXTURE_UIC,SYNTHETIC_UIC)));
 const acquisition=json(files,'sources/acquisition.json'),rawInventory=json(files,'sources/candidate-inventory.json');
 const apiNo=rawInventory[0].api_no,sourceApiId=/^\d{8}$/.test(apiNo)?apiNo:null;
 if(sourceApiId===null)throw new Error('The v2 fixture inventory api_no must be 8 digits for the wellbore part of the synthetic package.');
 const scope={...acquisition.scope,queryVersion:4,testReportLimit:1000,sourceApiId,wellboreLimit:1000,wellboreInventoryLimit:25};
 const uicQuery=order=>new URLSearchParams({'$where':`uic_no='${SYNTHETIC_UIC}'`,'$limit':'1000','$order':order});
 const apiQuery=new URLSearchParams({'$where':`api_no='${sourceApiId}'`,'$limit':'1000','$order':'record_sequence,id'});
 const apiLookup=new URLSearchParams({'$where':`api_no='${sourceApiId}'`,'$limit':'25','$order':'uic_number,api_no'});
 const withUic=rows=>rows.map(r=>({uic_no:SYNTHETIC_UIC,...r})),withApi=rows=>rows.map(r=>({api_no:sourceApiId,...r}));
 const extra=[ // producer acquisition-target order (V4 §1)
  ['bhp-metadata.json','https://data.texas.gov/api/views/qxfy-wcfs.json',{name:'RRC-UIC Bottom Hole Pressure Test Results'}],
  ['srt-metadata.json','https://data.texas.gov/api/views/h54t-xnbi.json',{name:'RRC-UIC Step Rate Test Results'}],
  ['candidate-bhp.json',`https://data.texas.gov/resource/qxfy-wcfs.json?${uicQuery(testReportOrder.bhp)}`,withUic(bhp)],
  ['candidate-srt.json',`https://data.texas.gov/resource/h54t-xnbi.json?${uicQuery(testReportOrder.srt)}`,withUic(srt)],
  ['srt-guidelines.html','https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/technical-review/step-rate-test-guidelines/',DOC],
  ['bhp-permian-nto.pdf','https://www.rrc.texas.gov/media/sm5bzzpg/nto-disposal-well-monitoring-reporting-requirements-in-the-permian-basin-12-19-2023.pdf',DOC],
  ['casing-metadata.json','https://data.texas.gov/api/views/u9m4-xnh6.json',{name:'Synthetic casing dataset'}],
  ['plugging-metadata.json','https://data.texas.gov/api/views/wfzn-9fje.json',{name:'Synthetic plugging dataset'}],
  ['wellbore-inventory.json',`https://data.texas.gov/resource/givw-z9t4.json?${apiLookup}`,[{...rawInventory[0]}]],
  ['candidate-casing.json',`https://data.texas.gov/resource/u9m4-xnh6.json?${apiQuery}`,withApi(casing)],
  ['candidate-plugging.json',`https://data.texas.gov/resource/wfzn-9fje.json?${apiQuery}`,withApi(plugging)],
  ['wellbore-wba091.pdf','https://www.rrc.texas.gov/media/cx2i4xrm/wba091_well-bore-database.pdf',DOC],
  ['form-w2.pdf','https://www.rrc.texas.gov/media/sdbph42m/w-2-0114.pdf',DOC],
  ['form-w3.pdf','https://www.rrc.texas.gov/media/lw0bmny4/w-3p.pdf',DOC]];
 for(const [file,url,body] of extra){put(files,'sources/'+file,body);put(files,'sources/'+file.replace(/\.[^.]+$/,'')+'.source.json',{url,retrieved_at:RETRIEVED,http_status:200,testFixture:false});}
 acquisition.scope=scope;acquisition.targets=[...acquisition.targets,...extra.map(([,url])=>url)];put(files,'sources/acquisition.json',acquisition);
 refreshEvidence(files);derive(files);
 return files;
}
export const buildV4Package=async options=>pack(await buildV4Files(options));
