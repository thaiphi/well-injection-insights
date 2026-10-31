// Browser copies of texas-rrc-explorer src/normalize.mjs and artifact.mjs contracts.
// Keep this bounded v1/v2 adapter aligned with the producer; no network or filesystem access.
export const rowDisposition=row=>row.quality_flags.some(flag=>/^(parse_failure|invalid|inconsistent|duplicate|unmatched|ambiguous|source_scope)/.test(flag))?'quarantined':'accepted';
// Explorer isBounded(): query versions 2 and 4 share the bounded H-10 rules. Version 3 is not accepted here.
export const boundedExplorerScope=scope=>scope?.queryVersion===2||scope?.queryVersion===4;
export const testReportOrder=Object.freeze({bhp:'report_id,tracking_no,test_sequence_no',srt:'report_id,tracking_no'});
export function sourceScopeFlags(kind,row,scope){
 const flags=[];
 if(boundedExplorerScope(scope)){
  if(kind==='bhp'||kind==='srt'){if(row.uic_no!==scope.monthlyUic)flags.push('source_scope:uic_no');return flags;}
  if(kind==='casing'||kind==='plugging'||kind==='wellbore_inventory'){if(row?.api_no!==scope.sourceApiId)flags.push('source_scope:api_no');return flags;}
  if(kind==='inventory'){if(row.uic_number!==scope.monthlyUic)flags.push('source_scope:uic_number');}
  else{
   if(row.uic_no!==scope.monthlyUic)flags.push('source_scope:uic_no');
   if(typeof row.formatted_date!=='string'||row.formatted_date<scope.monthlyStart||row.formatted_date>=scope.monthlyEndExclusive)flags.push('source_scope:formatted_date');
  }
  return flags;
 }
 if(kind==='inventory'){
  if(typeof row.api_no!=='string'||!row.api_no.startsWith(scope.apiPrefix))flags.push('source_scope:api_no_prefix');
  if(row.uic_type_injection!==scope.injectionType)flags.push('source_scope:uic_type_injection');
  for(const key of ['permit_canceled_date','w3_plugged_date'])if(row[key]!==undefined&&row[key]!==null)flags.push(`source_scope:${key}`);
 }else{
  if(row.uic_no!==scope.monthlyUic)flags.push('source_scope:uic_no');
  if(typeof row.formatted_date!=='string'||row.formatted_date<scope.monthlyStart)flags.push('source_scope:formatted_date');
 }
 return flags;
}
export const inventoryColumns=['source_record_key','uic_number','api_no','operator_number','district_code','lease_number','lease_name','well_no_display','county','county_basis','injection_type_code','permit_liquid_pressure_limit_psi','permit_liquid_volume_limit_bpd','permitted_top_depth_ft','permitted_bottom_depth_ft','w14_number','w14_date','permit_canceled_date','plugged_date','source_snapshot_id','quality_flags'];
export const monthlyColumns=['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','reporting_year','reporting_month','period_start','injected_liquid_bbl','injected_gas_mcf','reported_avg_injection_pressure_psi','reported_max_injection_pressure_psi','calendar_days','calculated_calendar_day_avg_bpd','most_recent_record','source_snapshot_id','quality_flags'];
export function numberField(value,flags,name){
  if(value===undefined||value===null||String(value).trim()===''){flags.push(`missing:${name}`);return null;}
  if(!/^-?\d+(\.\d+)?$/.test(String(value))||!Number.isFinite(Number(value))){flags.push(`parse_failure:${name}`);return null;}
  return Number(value);
}
const str=value=>value==null?'':String(value);
const period=value=>{
 const match=/^(\d{4})-(\d{2})-01T00:00:00(?:\.000)?$/.exec(str(value));
 return match&&Number(match[2])>=1&&Number(match[2])<=12?match:null;
};
export function normalizeExplorerRows(inventoryRaw,monthlyRaw,sourceIds,scope=null){
 const inventory=inventoryRaw.map((r,i)=>{
  const flags=[];if(!/^\d{9}$/.test(str(r.uic_number)))flags.push('invalid:uic_number');
  const row={source_record_key:`rrc:uic:${sourceIds.inventory}:${i+1}`,uic_number:str(r.uic_number),api_no:str(r.api_no),operator_number:str(r.operator_number),district_code:str(r.district_code),lease_number:str(r.lease_number),lease_name:str(r.lease_name),well_no_display:str(r.well_no_display),county:str(r.api_no).startsWith('389')?'Reeves':'',county_basis:'API county code 389; not independent location verification',injection_type_code:str(r.uic_type_injection),permit_liquid_pressure_limit_psi:numberField(r.max_liq_inj_pressure,flags,'max_liq_inj_pressure'),permit_liquid_volume_limit_bpd:numberField(r.bbl_vol_inj,flags,'bbl_vol_inj'),permitted_top_depth_ft:numberField(r.top_inj_zone,flags,'top_inj_zone'),permitted_bottom_depth_ft:numberField(r.bot_inj_zone,flags,'bot_inj_zone'),w14_number:str(r.w14_number),w14_date:str(r.w14_date),permit_canceled_date:str(r.permit_canceled_date),plugged_date:str(r.w3_plugged_date),source_snapshot_id:sourceIds.inventory,quality_flags:flags};
  for(const [name,value] of Object.entries({max_liq_inj_pressure:row.permit_liquid_pressure_limit_psi,bbl_vol_inj:row.permit_liquid_volume_limit_bpd,top_inj_zone:row.permitted_top_depth_ft,bot_inj_zone:row.permitted_bottom_depth_ft}))if(value!==null&&value<0)flags.push(`invalid_negative:${name}`);
  if(row.permitted_top_depth_ft!==null&&row.permitted_bottom_depth_ft!==null&&row.permitted_top_depth_ft>row.permitted_bottom_depth_ft)flags.push('inconsistent:top_exceeds_bottom');
  if(scope)flags.push(...sourceScopeFlags('inventory',r,scope));
  if(boundedExplorerScope(scope)&&!str(r.api_no).startsWith('389')){row.county=`API county code ${str(r.api_no).slice(0,3)||'unavailable'}`;row.county_basis='Original source API county prefix; county name not independently verified';}
  return row;
 });
 const byUic=new Map();for(const r of inventory){const a=byUic.get(r.uic_number)??[];a.push(r);byUic.set(r.uic_number,a);}
 for(const rows of byUic.values())if(rows.length>1)for(const r of rows)r.quality_flags.push('ambiguous_parent_identity');
 const periodCounts=new Map(),reportIds=new Map();
 for(const r of monthlyRaw){const month=period(r.formatted_date);if(month){const key=`${str(r.uic_no)}|${month[1]}-${month[2]}`;periodCounts.set(key,(periodCounts.get(key)??0)+1);}reportIds.set(str(r.id),(reportIds.get(str(r.id))??0)+1);}
 const monthly=monthlyRaw.map((r,i)=>{
  const flags=[];const parents=byUic.get(str(r.uic_no))??[];
  const join=parents.length===1?'matched':parents.length===0?'unmatched':'ambiguous';
  if(join!=='matched')flags.push(`${join}:parent`);
  const m=period(r.formatted_date);
  if(m&&periodCounts.get(`${str(r.uic_no)}|${m[1]}-${m[2]}`)>1)flags.push('duplicate_or_revision_period');
  if(!str(r.id).trim())flags.push('invalid:source_report_id');
  if(reportIds.get(str(r.id))>1)flags.push('duplicate_source_report_id');
  const validDate=!!m;
  if(!validDate)flags.push('parse_failure:formatted_date');
  const year=validDate?Number(m[1]):null,month=validDate?Number(m[2]):null;
  const days=validDate?new Date(Date.UTC(year,month,0)).getUTCDate():null;
  const liquid=numberField(r.vol_liq,flags,'vol_liq'),gas=numberField(r.vol_gas,flags,'vol_gas'),avg=numberField(r.inj_press_avg,flags,'inj_press_avg'),max=numberField(r.inj_press_max,flags,'inj_press_max');
  for(const [name,n] of Object.entries({vol_liq:liquid,vol_gas:gas,inj_press_avg:avg,inj_press_max:max}))if(n!==null&&n<0)flags.push(`invalid_negative:${name}`);
  if(avg!==null&&max!==null&&avg>max)flags.push('inconsistent:avg_exceeds_max');
  if(scope)flags.push(...sourceScopeFlags('monthly',r,scope));
  return {source_row_key:`rrc:h10:${sourceIds.monthly}:${i+1}`,parent_key:join==='matched'?parents[0].source_record_key:'',parent_join_status:join,uic_number:str(r.uic_no),source_report_id:str(r.id),reporting_year:year,reporting_month:month,period_start:validDate?`${m[1]}-${m[2]}-01`:'',injected_liquid_bbl:liquid,injected_gas_mcf:gas,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:max,calendar_days:days,calculated_calendar_day_avg_bpd:liquid!==null&&liquid>=0&&days?liquid/days:null,most_recent_record:str(r.most_recent_record),source_snapshot_id:sourceIds.monthly,quality_flags:flags};
 });
 const disposition=rowDisposition;
 const counts=rows=>({raw:rows.length,parsed:rows.length,accepted:rows.filter(r=>disposition(r)==='accepted').length,quarantined:rows.filter(r=>disposition(r)==='quarantined').length,excluded:0});
 const issueCounts={};for(const r of [...inventory,...monthly])for(const f of r.quality_flags)issueCounts[f]=(issueCounts[f]??0)+1;
 return {inventory,monthly,quality:{inventory:counts(inventory),monthly:counts(monthly),parent_join:{matched:monthly.filter(r=>r.parent_join_status==='matched').length,unmatched:monthly.filter(r=>r.parent_join_status==='unmatched').length,ambiguous:monthly.filter(r=>r.parent_join_status==='ambiguous').length},issue_counts:issueCounts,...(inventory.some(r=>disposition(r)==='quarantined')?{inventory_dispositions:inventory.map(r=>({source_record_key:r.source_record_key,disposition:disposition(r),...(disposition(r)==='quarantined'?{reasons:[...r.quality_flags]}:{})}))}:{}),dispositions:monthly.map(r=>({source_row_key:r.source_row_key,disposition:disposition(r),...(disposition(r)==='quarantined'?{reasons:[...r.quality_flags]}:{})})),annulus_fields:'not supplied by ODP dataset; not inferred',revision_policy:'Every source row retained; duplicate period or report ID quarantined without selecting a preferred revision. most_recent_record preserved without using it as a revision selector.',scope:'Bounded inventory candidates and one UIC monthly history; no statewide coverage or current operating-status assertion.'}};
}

export function createExplorerDictionary(normalized,dynamic=false){
const unitSource='https://www.rrc.texas.gov/media/v3onmigl/uic_manual_uia010_3116.pdf';
const dictionary={schema_version:1,row_grain:{inventory:'one retained official source inventory row',injection_monthly:'one retained official source monthly row, including conflicts/revisions'},missing_value:'CSV empty cell / JSON null for absent numbers. Zero remains zero. String identifier absence is empty string.',pressure_basis:'Reported injection pressure, psi as named by RRC manual pp.40–41 (PDF pp.41–42). No datum conversion, BHP, reservoir pressure, or injectivity claim.',annulus:'Not available in ODP dataset qq2j-f2zm; no annulus columns are generated.',revision_policy:normalized.quality.revision_policy,units_source:{url:unitSource,pdf_pages:[18,41,42],note:'Official UIC manual defines liquid barrels, gas MCF, monthly average/maximum psi; public UIC query help names permit limits PSI and BBLS/day.'},fields:{}};
const definitions={source_record_key:['string','calculated','Snapshot plus 1-based raw inventory ordinal; never shortened API'],source_row_key:['string','calculated','Snapshot plus 1-based raw monthly ordinal; preserves duplicate source IDs'],parent_key:['string','calculated','Unique UIC inventory source_record_key if and only if exact string UIC matches one retained parent'],parent_join_status:['enum','calculated','matched / unmatched / ambiguous'],uic_number:['string','public reported','Original nine-character UIC parent/control ID; preserves leading zeros'],api_no:['string','public reported','Original API_NO exactly as source supplies it (eight digits here); never used as join key'],source_report_id:['string','public reported','Original ODP monthly id, retained without assuming global uniqueness'],reporting_year:['year','calculated','Year extracted from source formatted_date'],reporting_month:['month','calculated','Month extracted from source formatted_date'],period_start:['date','calculated','Calendar month start from formatted_date; not a daily observation'],injected_liquid_bbl:['bbl/month','public reported','ODP vol_liq, monthly total liquid volume'],injected_gas_mcf:['MCF/month','public reported','ODP vol_gas, monthly total gas volume'],reported_avg_injection_pressure_psi:['psi','public reported','ODP inj_press_avg; separate reported average injection pressure'],reported_max_injection_pressure_psi:['psi','public reported','ODP inj_press_max; separate reported maximum injection pressure'],calendar_days:['days','calculated','Actual Gregorian days in reporting month'],calculated_calendar_day_avg_bpd:['bbl/day','calculated','injected_liquid_bbl / calendar_days; not measured daily operating rate or operating-day rate'],most_recent_record:['source code','public reported','Original ODP flag; meaning not documented by metadata, no revision-selection inference'],permit_liquid_pressure_limit_psi:['psi','public reported','ODP max_liq_inj_pressure; regulatory authorized maximum, not sustainable capacity'],permit_liquid_volume_limit_bpd:['bbl/day','public reported','ODP bbl_vol_inj; authorized maximum liquid volume, not sustainable capacity'],permitted_top_depth_ft:['ft','public reported','ODP top_inj_zone; permitted injection interval top'],permitted_bottom_depth_ft:['ft','public reported','ODP bot_inj_zone; permitted injection interval bottom'],county:['name','calculated','Reeves from source API county prefix 389; metadata not independently geocoded'],county_basis:['text','calculated','Explicit origin of county label'],quality_flags:['list','calculated','Pipe-delimited issues; issues may overlap'],source_snapshot_id:['string','calculated','Dataset ID plus raw response SHA256 prefix']};
for(const col of [...new Set([...inventoryColumns,...monthlyColumns])]){const [units,status,definition]=definitions[col]??['string','public reported',`Original source ${col}; identifier values preserved as strings`];dictionary.fields[col]={units,status,definition};}

if(dynamic)dictionary.fields.county.definition='Reeves only for source API county prefix 389; other county codes are labeled without inferring an unverified county name.';
return dictionary;
}

const fail=message=>{throw Error(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const sameExplorerValue=(left,right)=>JSON.stringify(canonical(left))===JSON.stringify(canonical(right));
const requireSame=(left,right,message)=>{if(!sameExplorerValue(left,right))fail(message);};
const identityFields=['uic_number','api_no','operator_number','district_code','lease_number','lease_name','well_no_display','w14_number'];
const hashPattern=/^[a-f0-9]{64}$/;
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const targets=[
 ['inventory-metadata.json','https://data.texas.gov/api/views/givw-z9t4.json','metadata','inventory-metadata'],
 ['monthly-metadata.json','https://data.texas.gov/api/views/qq2j-f2zm.json','metadata','monthly-metadata'],
 ['candidate-inventory.json','','inventory','candidate-inventory'],
 ['candidate-monthly.json','','monthly','candidate-monthly'],
 ['uic-manual.pdf','https://www.rrc.texas.gov/media/v3onmigl/uic_manual_uia010_3116.pdf','documentation','uic-manual.pdf'],
 ['rrc-resources.html','https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/resources/','documentation','rrc-resources.html'],
 ['uic-query-help.html','https://webapps2.rrc.texas.gov/EWA/help/UICGeneralHowTo.html','documentation','uic-query-help.html']
];

const transformationVersions={2:'rrc-odp-v2.0.0',4:'rrc-odp-v2.2.0'};
// V4 §1: producer acquisition-target order after the 7 v2 targets.
function v4Targets(scope){
 const byUic=order=>new URLSearchParams({'$where':`uic_no='${scope.monthlyUic}'`,'$limit':'1000','$order':order});
 const byApi=new URLSearchParams({'$where':`api_no='${scope.sourceApiId}'`,'$limit':'1000','$order':'record_sequence,id'});
 const apiLookup=new URLSearchParams({'$where':`api_no='${scope.sourceApiId}'`,'$limit':'25','$order':'uic_number,api_no'});
 return [
  ['bhp-metadata.json','https://data.texas.gov/api/views/qxfy-wcfs.json','metadata','bhp-metadata'],
  ['srt-metadata.json','https://data.texas.gov/api/views/h54t-xnbi.json','metadata','srt-metadata'],
  ['candidate-bhp.json',`https://data.texas.gov/resource/qxfy-wcfs.json?${byUic(testReportOrder.bhp)}`,'bhp','candidate-bhp'],
  ['candidate-srt.json',`https://data.texas.gov/resource/h54t-xnbi.json?${byUic(testReportOrder.srt)}`,'srt','candidate-srt'],
  ['srt-guidelines.html','https://www.rrc.texas.gov/oil-and-gas/applications-and-permits/injection-storage-permits/oil-and-gas-waste-disposal/injection-disposal-permit-procedures/technical-review/step-rate-test-guidelines/','documentation','srt-guidelines.html'],
  ['bhp-permian-nto.pdf','https://www.rrc.texas.gov/media/sm5bzzpg/nto-disposal-well-monitoring-reporting-requirements-in-the-permian-basin-12-19-2023.pdf','documentation','bhp-permian-nto.pdf'],
  ['casing-metadata.json','https://data.texas.gov/api/views/u9m4-xnh6.json','metadata','casing-metadata'],
  ['plugging-metadata.json','https://data.texas.gov/api/views/wfzn-9fje.json','metadata','plugging-metadata'],
  ...(scope.sourceApiId===null?[]:[
   ['wellbore-inventory.json',`https://data.texas.gov/resource/givw-z9t4.json?${apiLookup}`,'wellbore_inventory','wellbore-inventory'],
   ['candidate-casing.json',`https://data.texas.gov/resource/u9m4-xnh6.json?${byApi}`,'casing','candidate-casing'],
   ['candidate-plugging.json',`https://data.texas.gov/resource/wfzn-9fje.json?${byApi}`,'plugging','candidate-plugging']]),
  ['wellbore-wba091.pdf','https://www.rrc.texas.gov/media/cx2i4xrm/wba091_well-bore-database.pdf','documentation','wellbore-wba091.pdf'],
  ['form-w2.pdf','https://www.rrc.texas.gov/media/sdbph42m/w-2-0114.pdf','documentation','form-w2.pdf'],
  ['form-w3.pdf','https://www.rrc.texas.gov/media/lw0bmny4/w-3p.pdf','documentation','form-w3.pdf']];
}
// V4 §3: producer loadSource order after the selection entry.
const v4SourceOrder=api=>['candidate-bhp.json','candidate-srt.json','bhp-metadata.json','srt-metadata.json','srt-guidelines.html','bhp-permian-nto.pdf',...(api===null?[]:['wellbore-inventory.json','candidate-casing.json','candidate-plugging.json']),'casing-metadata.json','plugging-metadata.json','wellbore-wba091.pdf','form-w2.pdf','form-w3.pdf'];

/** Checks recorded acquisition evidence, not cryptographic source authenticity.
 * A local archive cannot establish who fetched its bytes or authenticate a
 * self-authored acquisition log. Callers must preserve that distinction. */
export async function verifyRecordedExplorerEvidence(manifest,{json,read,hash}){
 const version=manifest.scope?.query_version;
 if(!transformationVersions[version]||manifest.transformation_version!==transformationVersions[version]||manifest.provenance?.classification!=='public_reported'||manifest.provenance?.basis!=='recorded_official_acquisition_v2'||manifest.testFixture!==false)fail('Package has no supported recorded public acquisition evidence');
 const acquisition=json('sources/acquisition.json'),scope=acquisition.scope;
 if(acquisition.schemaVersion!==2||acquisition.mode!=='live_collection'||acquisition.status!=='succeeded'||acquisition.testFixture!==false||!uuidPattern.test(acquisition.runId)||!object(scope))fail('Public acquisition is incomplete or fixture classified');
 const monthIndex=value=>{const m=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);if(!m||+m[1]<1900||+m[1]>9998)fail('Invalid acquisition reporting range');return +m[1]*12 + +m[2]-1;};
 if(typeof scope.startMonth!=='string'||typeof scope.endMonth!=='string'||typeof scope.monthlyUic!=='string'||!/^\d{9}$/.test(scope.monthlyUic))fail('Invalid acquisition scope');
 const start=monthIndex(scope.startMonth),end=monthIndex(scope.endMonth),next=end+1;
 if(end<start||end-start>=36)fail('Acquisition reporting range exceeds 36 months');
 const rawInventory=json('sources/candidate-inventory.json'),rawMonthly=json('sources/candidate-monthly.json');
 // A successful bounded acquisition may canonically return zero monthly rows.
 // Its acquisition, manifest count, retrieval sidecars and source hashes still
 // reconcile below; exact-one selected inventory and the monthly cap stay strict.
 if(!Array.isArray(rawInventory)||rawInventory.length!==1||!Array.isArray(rawMonthly)||rawMonthly.length>=1000||[...rawInventory,...rawMonthly].some(row=>!object(row)))fail('Source row bounds or exact parent identity invalid');
 const api=rawInventory[0].api_no,sourceApiId=typeof api==='string'&&/^\d{8}$/.test(api)?api:null;
 const expectedScope={queryVersion:version,monthlyUic:scope.monthlyUic,startMonth:scope.startMonth,endMonth:scope.endMonth,monthlyStart:scope.startMonth+'-01T00:00:00',monthlyEndExclusive:`${String(Math.floor(next/12)).padStart(4,'0')}-${String(next%12+1).padStart(2,'0')}-01T00:00:00`,inventoryLimit:25,monthlyLimit:1000,
  ...(version===4?{testReportLimit:1000,sourceApiId,wellboreLimit:1000,wellboreInventoryLimit:25}:{})};
 requireSame(scope,expectedScope,'Acquisition scope does not match its bounded query contract');
 const inventoryQuery=new URLSearchParams({'$where':`uic_number='${scope.monthlyUic}'`,'$limit':'25','$order':'uic_number,api_no'});
 const monthlyQuery=new URLSearchParams({'$where':`uic_no='${scope.monthlyUic}' AND formatted_date >= '${scope.monthlyStart}' AND formatted_date < '${scope.monthlyEndExclusive}'`,'$limit':'1000','$order':'formatted_date,id'});
 const actualTargets=[...targets.map(([name,url,kind,label])=>[name,name==='candidate-inventory.json'?`https://data.texas.gov/resource/givw-z9t4.json?${inventoryQuery}`:name==='candidate-monthly.json'?`https://data.texas.gov/resource/qq2j-f2zm.json?${monthlyQuery}`:url,kind,label]),...(version===4?v4Targets(scope):[])];
 requireSame(acquisition.targets,actualTargets.map(item=>item[1]),'Acquisition targets contradict the official bounded query');
 const rawTests=version===4?{bhp:json('sources/candidate-bhp.json'),srt:json('sources/candidate-srt.json')}:null;
 if(rawTests&&Object.values(rawTests).some(rows=>!Array.isArray(rows)||rows.length>=1000||rows.some(row=>!object(row))))fail('Test-report row bounds invalid');
 // Producer publication refuses raw rows outside its declared query even when
 // normalization could retain them with quarantine reasons.
 if(rawInventory.some(row=>sourceScopeFlags('inventory',row,scope).length)||rawMonthly.some(row=>sourceScopeFlags('monthly',row,scope).length)||(rawTests&&['bhp','srt'].some(kind=>rawTests[kind].some(row=>sourceScopeFlags(kind,row,scope).length))))fail('Source rows contradict the declared query predicates');
 if(version===4&&sourceApiId!==null){
  const wellbore=[['wellbore_inventory','wellbore-inventory.json',25],['casing','candidate-casing.json',1000],['plugging','candidate-plugging.json',1000]];
  for(const [kind,name,limit] of wellbore){const rows=json('sources/'+name);if(!Array.isArray(rows)||rows.length>=limit||rows.some(row=>!object(row)||sourceScopeFlags(kind,row,scope).length))fail('Wellbore rows contradict the exact-API query');}
 }
 const [year,month]=scope.endMonth.split('-').map(Number);
 requireSame(manifest.scope,{query_version:version,uic_number:scope.monthlyUic,start:scope.startMonth+'-01',end:`${scope.endMonth}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`,inventory_limit:25,inventory_returned:1,monthly_limit:1000,monthly_returned:rawMonthly.length,pagination:'Complete bounded response below cap; no statewide coverage',
  ...(version===4?{test_report_limit:1000,wellbore_limit:1000,wellbore_inventory_limit:25}:{})},'Manifest scope contradicts preserved acquisition');
 const sid=(id,name)=>hash('sources/'+name).then(h=>`${id}:${h.slice(0,16)}`);
 const sourceIds={inventory:await sid('givw-z9t4','candidate-inventory.json'),monthly:await sid('qq2j-f2zm','candidate-monthly.json'),
  ...(version===4?{bhp:await sid('qxfy-wcfs','candidate-bhp.json'),srt:await sid('h54t-xnbi','candidate-srt.json')}:{}),
  ...(version===4&&sourceApiId!==null?{wellbore_inventory:await sid('givw-z9t4','wellbore-inventory.json'),casing:await sid('u9m4-xnh6','candidate-casing.json'),plugging:await sid('wfzn-9fje','candidate-plugging.json')}:{})};
 async function retrieval(name,url){
  const sidecar=name.replace(/\.[^.]+$/,'')+'.source.json',metadata=json('sources/'+sidecar),body=read('sources/'+name);
  if(metadata.url!==url||metadata.http_status!==200||metadata.testFixture!==false||!Number.isFinite(Date.parse(metadata.retrieved_at))||!hashPattern.test(metadata.sha256)||metadata.sha256!==await hash('sources/'+name)||metadata.bytes!==body.length)fail(`Invalid public retrieval sidecar: ${sidecar}`);
  return metadata;
 }
 async function sourceEntry(filename){
  const [name,url,kind,label]=actualTargets.find(item=>item[0]===filename),metadata=await retrieval(name,url);
  const title=kind==='metadata'?json('sources/'+name).name:kind==='documentation'?undefined:json(`sources/${kind==='wellbore_inventory'?'inventory':kind}-metadata.json`).name;
  return {snapshot_id:sourceIds[kind]??`${label}:${(await hash('sources/'+name)).slice(0,16)}`,name:label,...(title===undefined?{}:{title}),kind,...Object.fromEntries(Object.entries(metadata).filter(([key])=>['url','retrieved_at','http_status','last_modified','etag','sha256','bytes','testFixture'].includes(key))),sha256:await hash('sources/'+name),bytes:read('sources/'+name).length,raw_file:'sources/'+name};
 }
 const expectedSources=[];
 // Producer source order differs from acquisition-request order.
 for(const filename of ['candidate-inventory.json','candidate-monthly.json','inventory-metadata.json','monthly-metadata.json','uic-manual.pdf','rrc-resources.html','uic-query-help.html'])expectedSources.push(await sourceEntry(filename));
 const selection=json('sources/selection.json'),lookup=json('sources/lookup.json');
 if(!object(selection)||!sameExplorerValue(Object.keys(selection).sort(),['lookupId','lookupSha256','ordinal','sourceRecordKey'])||!uuidPattern.test(selection.lookupId)||!Number.isSafeInteger(selection.ordinal)||selection.ordinal<1||selection.sourceRecordKey!==`lookup:${selection.ordinal}`||!hashPattern.test(selection.lookupSha256))fail('Invalid persisted parent selection');
 requireSame(selection,manifest.selection,'Manifest selected identity contradicts preserved lookup');
 const request=lookup.request;
 if(lookup.schemaVersion!==2||lookup.status!=='ready'||lookup.testFixture!==false||lookup.lookupId!==selection.lookupId||!object(request)||!['uic','api'].includes(request.kind)||typeof request.value!=='string'||!(request.kind==='uic'?/^\d{9}$/:/^\d{8}$/).test(request.value)||!sameExplorerValue(Object.keys(request).sort(),['kind','value']))fail('Lookup evidence is incomplete or fixture classified');
 const lookupNames=['lookup-inventory.json','lookup-inventory.source.json','lookup-metadata.json','lookup-metadata.source.json'];
 if(!object(lookup.files))fail('Lookup hash inventory is missing');
 requireSame(Object.keys(lookup.files).sort(),lookupNames,'Lookup hash inventory is incomplete');
 for(const name of lookupNames)if(lookup.files[name]!==await hash('sources/'+name))fail('Lookup evidence hash mismatch');
 const lookupQuery=new URLSearchParams({'$where':`${request.kind==='uic'?'uic_number':'api_no'}='${request.value}'`,'$limit':'25','$order':'uic_number,api_no'});
 const lookupMetadata=await retrieval('lookup-inventory.json',`https://data.texas.gov/resource/givw-z9t4.json?${lookupQuery}`);
 await retrieval('lookup-metadata.json','https://data.texas.gov/api/views/givw-z9t4.json');
 const lookupRows=json('sources/lookup-inventory.json'),field=request.kind==='uic'?'uic_number':'api_no';
 if(!Array.isArray(lookupRows)||!lookupRows.length||lookupRows.length>=25||lookupRows.some(row=>!object(row)||row[field]!==request.value))fail('Lookup candidates contradict their exact identifier query');
 const selected=lookupRows[selection.ordinal-1];
 if(!selected||!/^\d{9}$/.test(selected.uic_number)||lookupRows.filter(row=>row.uic_number===selected.uic_number).length!==1||selection.lookupSha256!==lookup.files['lookup-inventory.json']||rawInventory[0].uic_number!==scope.monthlyUic||identityFields.some(field=>rawInventory[0][field]!==selected[field]))fail('Selected parent is missing, ambiguous or changed');
 expectedSources.push({snapshot_id:'lookup:'+selection.lookupSha256.slice(0,16),name:'lookup-inventory',kind:'selection',...lookupMetadata,raw_file:'sources/lookup-inventory.json'});
 if(version===4)for(const filename of v4SourceOrder(sourceApiId))expectedSources.push(await sourceEntry(filename));
 requireSame(manifest.sources,expectedSources,'Manifest source evidence contradicts preserved retrieval sidecars');
 requireSame(manifest.source_revisions,{inventory_rows_updated_at:json('sources/inventory-metadata.json').rowsUpdatedAt,monthly_rows_updated_at:json('sources/monthly-metadata.json').rowsUpdatedAt},'Source revision evidence mismatch');
 return {scope,sourceIds,rawInventory,rawMonthly,rawTests,queryVersion:version};
}
