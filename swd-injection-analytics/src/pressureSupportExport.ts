import { CONTEXT_INPUT_VERSION, loadPressureContext, buildPressureContext, type ContextResult, type ContextEvent } from './pressureSupport.js';
import { pressureContextChartSvg } from './pressureSupportChart.js';

/** Sealed evidence for one ready context result: exact source bytes, validated input, lineage and a hash of the compact result body. */
export const CONTEXT_ARTIFACT_VERSION='pressure-support-artifact/1';
export const MAX_CONTEXT_SOURCE_BYTES=1024*1024;
export type ContextPin={sha256:string;bytes?:number;version?:string;datasetId?:string;[key:string]:unknown};
export type RowDisposition={section:string;rowId:string;disposition:'used'|'outside-selected-period'|'not-selected'|'rejected';issues:string[]};
export type ContextArtifact={result:ContextResult;resultSha256:string;evidence:{
  artifactVersion:string;artifactId:string;methodVersion:string;inputVersion:string;datasetId:string;classification:string;
  selection:{producerId:string;injectorIds:string[];firstMonth:string;lastMonth:string};coverage:{firstMonth:string;lastMonth:string};
  source:{sha256:string;bytes:number;base64:string;originalText:string};pin:ContextPin;validatedInput:unknown;issues:unknown[];
  rowDispositions:RowDisposition[];associations:unknown[];events:ContextEvent[];notices:string[];missingReasons:{month:string;reasons:string[]}[];
  units:Record<string,string>;formulas:string[];assumptions:string[];limitations:string[]}};

const hex=(buffer:ArrayBuffer)=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');
const sha256Hex=async(bytes:Uint8Array)=>hex(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)));
function base64(bytes:Uint8Array) {let s='';for(let i=0;i<bytes.length;i+=0x8000) s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
function deepFreeze<T>(value:T):T {if(typeof value==='object'&&value!==null&&!Object.isFrozen(value)) {Object.freeze(value);for(const v of Object.values(value)) deepFreeze(v);}return value;}
const LIMITATIONS=[
  'Synthetic context, separate from capacity; not a numerical determination of pressure support, causation or interwell connectivity.',
  'Associations and distances are declared assumptions; no GIS inference or hydraulic connection is implied.',
  'Frac events are annotations; they do not change fits, cutoffs, frozen forecasts or capacity results.',
  'Missing observations stay unavailable; aggregates exist only when every selected contribution is present.'];

/** Recompute SHA-256 over the exact original bytes, require agreement with pin, evidence and result, then seal. */
export async function sealPressureContext(result:ContextResult,evidence:{originalBytes:Uint8Array;sha256:string;pin:ContextPin}):Promise<ContextArtifact> {
  if(!result||result.ready!==true) throw new Error(`Blocked context result cannot be sealed: ${(result?.reasons??[]).join('; ')}`);
  const bytes=evidence.originalBytes;
  if(!(bytes instanceof Uint8Array)) throw new Error('Original source bytes are required');
  if(bytes.byteLength>MAX_CONTEXT_SOURCE_BYTES) throw new Error('Original source exceeds 1 MiB');
  const sha256=await sha256Hex(bytes);
  if(sha256!==evidence.pin?.sha256||sha256!==evidence.sha256||sha256!==result.source?.sha256)
    throw new Error(`SHA-256 disagreement: bytes ${sha256}, pin ${evidence.pin?.sha256}, evidence ${evidence.sha256}, result ${result.source?.sha256}`);
  if(evidence.pin.bytes!==undefined&&evidence.pin.bytes!==bytes.byteLength) throw new Error(`Pinned byte length ${evidence.pin.bytes} differs from ${bytes.byteLength}`);
  let originalText:string;
  try {originalText=new TextDecoder('utf-8',{fatal:true}).decode(bytes);} catch {throw new Error('Original source bytes are not valid UTF-8');}
  // Bind the result to the verified bytes: rebuild with the existing model and require an identical serialization.
  const validation=await loadPressureContext(bytes);
  if(validation.sha256!==sha256) throw new Error('Rebuilt validation hash differs from the verified bytes');
  if(validation.datasetBlocked||!validation.dataset) throw new Error(`Original source no longer validates: ${validation.issues.map(i=>i.message).join('; ')}`);
  const body=JSON.stringify(result);
  if(JSON.stringify(buildPressureContext(validation,result.selection as never))!==body)
    throw new Error('Context result does not match a rebuild from the verified original bytes and its selection');
  const parsed:unknown=JSON.parse(originalText),resultSha256=await sha256Hex(new TextEncoder().encode(body));
  const sel=result.selection as ContextArtifact['evidence']['selection'],d=validation.dataset;
  const inRange=(m:string)=>m>=sel.firstMonth&&m<=sel.lastMonth;
  const issuesByRow=new Map<string,string[]>();
  for(const i of validation.issues) if(i.rowId) issuesByRow.set(i.rowId,[...(issuesByRow.get(i.rowId)??[]),i.message]);
  const disposition=(section:string,rowId:string,selected:boolean,inPeriod:boolean):RowDisposition=>{
    const issues=issuesByRow.get(rowId)??[];
    return {section,rowId,disposition:issues.length?'rejected':!selected?'not-selected':inPeriod?'used':'outside-selected-period',issues};
  };
  const rowDispositions=[
    ...d.producerMonthly.map(r=>disposition('producerMonthly',r.rowId,r.producerId===sel.producerId,inRange(r.month))),
    ...d.injectorMonthly.map(r=>disposition('injectorMonthly',r.rowId,sel.injectorIds.includes(r.injectorId),inRange(r.month))),
    ...d.associations.map(r=>disposition('associations',r.rowId,r.producerId===sel.producerId&&sel.injectorIds.includes(r.injectorId),true)),
    ...d.events.map(r=>disposition('events',r.rowId,r.producerId===sel.producerId,true)),
  ];
  const artifact={result,resultSha256,evidence:{
    artifactVersion:CONTEXT_ARTIFACT_VERSION,artifactId:`pressure-support-context/${resultSha256}`,methodVersion:result.method.version,inputVersion:CONTEXT_INPUT_VERSION,
    datasetId:d.datasetId,classification:d.classification,selection:sel,coverage:d.coverage,
    source:{sha256,bytes:bytes.byteLength,base64:base64(bytes),originalText},pin:evidence.pin,validatedInput:parsed,issues:validation.issues,
    rowDispositions,associations:result.sourceRows.associations,events:result.events,notices:result.reasons,
    missingReasons:result.monthly.filter(m=>m.missingReasons.length).map(m=>({month:m.month,reasons:m.missingReasons})),
    units:{producerRate:'STB/day',producerVolume:'STB',injectorVolume:'bbl/month',waterCut:'%',distance:'mi',basis:'calendar-month'},
    formulas:result.method.formulas,assumptions:result.assumptions,limitations:LIMITATIONS}};
  // Plain JSON objects only: the download, SVG metadata and hash all use this same serialization.
  return deepFreeze(JSON.parse(JSON.stringify(artifact)) as ContextArtifact);
}

export function pressureContextJson(artifact:ContextArtifact):string {return JSON.stringify(artifact,null,2)+'\n';}

/** Same quoting convention as the existing workspace CSV: every cell quoted, formula-like text prefixed with an apostrophe. */
const cell=(value:unknown)=>{
  let s=value===null||value===undefined?'unavailable':typeof value==='object'?JSON.stringify(value):String(value);
  if(/^[=+@\-\t\r]/.test(s)&&typeof value!=='number') s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
};
export function pressureContextCsv(artifact:ContextArtifact):string {
  const {result,evidence:e}=artifact,ids=e.selection.injectorIds,rows:unknown[][]=[];
  for(const [k,v] of [['artifact_id',e.artifactId],['result_sha256',artifact.resultSha256],['artifact_version',e.artifactVersion],['method_version',e.methodVersion],
    ['input_version',e.inputVersion],['dataset_id',e.datasetId],['source_sha256',e.source.sha256],['source_bytes',e.source.bytes],['classification',e.classification],
    ['producer_id',e.selection.producerId],['injector_ids',ids.join(' ')],['first_month',e.selection.firstMonth],['last_month',e.selection.lastMonth],
    ['coverage',`${e.coverage.firstMonth} to ${e.coverage.lastMonth}`],['units','rates STB/day; injection bbl/month; water cut %; distance mi; calendar-month basis'],
    ['null_cells','"unavailable" marks a missing or undefined value, never zero']]) rows.push([k,v]);
  rows.push([]);
  for(const n of e.notices) rows.push(['notice',n]);
  for(const l of e.limitations) rows.push(['limitation',l]);
  rows.push([]);
  rows.push(['record','month','oil_rate_stbd','water_rate_stbd','liquid_rate_stbd','water_cut_pct',...ids.map(id=>`${id}_bbl_month`),'complete_injection_bbl_month','missing_reasons']);
  for(const m of result.monthly) rows.push(['month',m.month,m.oilRateStbd,m.waterRateStbd,m.liquidRateStbd,m.waterCutPct,...ids.map(id=>m.injectorVolumesBbl[id]??null),m.completeInjectionVolumeBbl,m.missingReasons.join('; ')||'none']);
  rows.push([]);
  rows.push(['record','event_id','producer_id','date','kind','within_selection','within_coverage','classification','citation','uncertainty','row_id','source_id']);
  for(const v of result.events) rows.push(['event',v.eventId,v.producerId,v.date,v.kind,String(v.withinSelection),String(v.withinCoverage),v.classification,v.citation,v.uncertainty??'none recorded',v.rowId,v.sourceId]);
  rows.push([]);
  rows.push(['record','section','row_id','source_id','disposition','original_row_json']);
  const disp=new Map(e.rowDispositions.map(r=>[`${r.section}|${r.rowId}`,r.disposition]));
  for(const [section,list] of Object.entries(result.sourceRows)) for(const r of list as {rowId:string;sourceId:string}[])
    rows.push(['source-row',section,r.rowId,r.sourceId,disp.get(`${section}|${r.rowId}`)??'used',JSON.stringify(r)]);
  return rows.map(r=>r.map(cell).join(',')).join('\r\n');
}

const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
/** The shared chart plus escaped full-artifact metadata; plotted values and scales are unchanged. */
export function pressureContextSvg(artifact:ContextArtifact):string {
  const chart=pressureContextChartSvg(artifact.result),end=chart.lastIndexOf('</svg>');
  return `${chart.slice(0,end)}<metadata id="pressure-support-context">${escXml(JSON.stringify(artifact))}</metadata></svg>`;
}
