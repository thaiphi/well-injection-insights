import type { TimelineMarker } from './h10DiagnosticsChart.js';
import type { Table } from './importProfile.js';

/** Phase 1b test records: Explorer-layout BHP/SRT rows, system flags, user decisions. Pure; no DOM. Values stay as published. */
export const TEST_RECORDS_VERSION='test-records/1';
export const DEPTH_TOLERANCE_FT=10;
export const MIN_COMPARABLE_TESTS=2;
export const MAX_REASON_LENGTH=200;
export const MAX_UPLOAD_ROWS=1000;
export const BHP_COLUMNS=Object.freeze(['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','tracking_no','test_sequence_no','report_conducted_date','report_conducted_date_text','report_received_date','report_received_date_text','bhp_psia','test_depth_ft','gradient_psi_ft','tested_formation','source_snapshot_id','quality_flags']);
export const SRT_COLUMNS=Object.freeze(['source_row_key','parent_key','parent_join_status','uic_number','source_report_id','tracking_no','srt_received_date','srt_received_date_text','test_date','test_date_text','satisfactory_test_code','top_perf_ft','bottom_perf_ft','formation_tested','min_inj_rate_bpm','max_inj_rate_bpm','isip_psig','formation_frac_press_psig','frac_inj_rate_capacity_bpd','surface_pressure_firc_psig','fracture_gradient_psi_ft','comments','source_snapshot_id','quality_flags']);
const NUMERIC=new Set(['bhp_psia','test_depth_ft','gradient_psi_ft','top_perf_ft','bottom_perf_ft','min_inj_rate_bpm','max_inj_rate_bpm','isip_psig','formation_frac_press_psig','frac_inj_rate_capacity_bpd','surface_pressure_firc_psig','fracture_gradient_psi_ft']);
const DATES=new Set(['report_conducted_date','report_received_date','srt_received_date','test_date']);
export const LABEL_BHP_BASIS='Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted';
export const LABEL_BHP=`Bottomhole pressure as reported. ${LABEL_BHP_BASIS}. Test type not stated in source. Not a reservoir pressure estimate and not an injectivity index (J).`;
export const LABEL_SRT='Step-rate test values as reported (psig). The satisfactory code is shown verbatim; its meaning is undocumented.';
export const J_READINESS='Calibrated injectivity (J): not available. A test-referenced estimate is shown in the panel below; a calibrated J needs a measured flowing bottomhole pressure at a known rate, for example from step-rate test analysis, which is out of scope.';
export const LIMITATIONS=Object.freeze([LABEL_BHP,LABEL_SRT,J_READINESS,
  'Test records are one published report row each; they are not pressure series and carry no stabilization data.',
  'Depth basis (measured or true vertical) is not stated in the source; no depth correction is applied.',
  "Test markers sit at the actual test date and are never joined to a month's values."]);
export type TestKind='bhp'|'srt';
export type TestOrigin='package'|'upload';
export const ORIGIN_LABELS:Readonly<Record<TestOrigin,string>>=Object.freeze({package:'Explorer package, verified',upload:'User upload, not verified'});
export type TestValue=string|number|null|readonly string[];
export type TestRow=Readonly<Record<string,TestValue>>;
export type TestFlag='no-pressure'|'no-date'|'no-depth'|'depth-differs'|'duplicate-report'|'source-quarantined';
export const FLAG_REASONS:Readonly<Record<TestFlag,string>>=Object.freeze({
  'no-pressure':'No test pressure reported.',
  'no-date':'Test date missing or not a valid date.',
  'no-depth':'No test depth reported; the test is not placed at any depth.',
  'depth-differs':"Tested at a different depth from this well's other tests; not directly comparable.",
  'duplicate-report':'More than one record with this report identity.',
  'source-quarantined':'Explorer quarantined this row.'});
const QUARANTINE=/^(parse_failure|invalid|inconsistent|duplicate|unmatched|ambiguous|source_scope)/;
export type TestRecord={key:string;kind:TestKind;origin:TestOrigin;identity:string;sourceRowKey:string;uic:string;date:string|null;dateText:string;
  bhpPsia:number|null;depthFt:number|null;pressures:{field:string;value:number|null}[];values:TestRow;qualityFlags:string[];flags:TestFlag[];reasons:string[];notes:string[];usable:boolean};
export type Decision={include:boolean;reason:string|null;byUser:boolean};
export type MonthRange={first:string;last:string};
export type TestState={version:typeof TEST_RECORDS_VERSION;records:TestRecord[];referenceDepthFt:number|null;referenceTie:boolean;range:MonthRange|null;decisions:Readonly<Record<string,Decision>>};
export type TestInput={package?:{bhp:readonly TestRow[];srt:readonly TestRow[]}|null;upload?:{bhp?:readonly TestRow[];srt?:readonly TestRow[]}};
export type BhpPoint={key:string;date:string;psia:number;depthFt:number};
export type TestCoverage={bhpRecords:number;srtRecords:number;packageRecords:number;uploadRecords:number;flagged:number;included:number;comparableBhp:number;referenceDepthFt:number|null;referenceTie:boolean;beforeRange:number;afterRange:number};

const str=(v:unknown)=>v==null?'':String(v);
function validDate(t:string) {
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);if(!m) return false;
  const mo=Number(m[2]),d=Number(m[3]);return mo>=1&&mo<=12&&d>=1&&d<=new Date(Date.UTC(Number(m[1]),mo,0)).getUTCDate();
}
const num=(v:TestValue|undefined)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const dateOf=(v:TestValue|undefined)=>typeof v==='string'&&validDate(v)?v:null;

/** Upload boundary: exact Explorer header set (any order), Explorer value rules, one selected well. Any problem rejects the whole file. */
export function rowsFromTable(table:Table,expectedUic:string):{kind:TestKind;rows:TestRow[]} {
  const headers=table.headers.map(h=>String(h)),set=new Set(headers);
  const fits=(cols:readonly string[])=>cols.length===headers.length&&set.size===headers.length&&cols.every(c=>set.has(c));
  const kind:TestKind|null=fits(BHP_COLUMNS)?'bhp':fits(SRT_COLUMNS)?'srt':null;
  if(!kind) throw new Error("The header must be exactly Explorer's BHP or SRT test columns (any order).");
  if(!table.rows.length) throw new Error('The file has no test rows.');
  if(table.rows.length>MAX_UPLOAD_ROWS) throw new Error(`At most ${MAX_UPLOAD_ROWS} rows are accepted.`);
  const rows=table.rows.map(r=>{
    if(r.values.length!==headers.length) throw new Error(`Row ${r.originalRow}: wrong number of cells.`);
    const row:Record<string,TestValue>={};
    headers.forEach((h,i)=>{
      const raw=str(r.values[i]);
      if(NUMERIC.has(h)) {if(raw.trim()===''){row[h]=null;return;}if(!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Row ${r.originalRow}: ${h} is not a plain number.`);row[h]=Number(raw);return;}
      if(DATES.has(h)) {if(raw===''){row[h]=null;return;}if(!validDate(raw)) throw new Error(`Row ${r.originalRow}: ${h} is not a valid YYYY-MM-DD date.`);row[h]=raw;return;}
      if(/^[=+\-@\t\r]/.test(raw)) throw new Error(`Row ${r.originalRow}: ${h} starts with a formula character.`);
      row[h]=h==='quality_flags'?(raw?Object.freeze(raw.split('|')):Object.freeze([])):raw;
    });
    if(row.uic_number!==expectedUic) throw new Error(`Row ${r.originalRow}: UIC ${str(row.uic_number)} is not the selected well ${expectedUic}.`);
    return Object.freeze(row);
  });
  return {kind,rows};
}

/** The depth shared (within the tolerance) by the most tests. Separate equally supported depths are a tie: no reference. */
export function referenceDepth(depths:readonly number[]):{reference:number|null;tie:boolean} {
  if(!depths.length) return {reference:null,tie:false};
  const support=depths.map(d=>depths.filter(e=>Math.abs(e-d)<=DEPTH_TOLERANCE_FT).length),max=Math.max(...support);
  const candidates=[...new Set(depths.filter((_,i)=>support[i]===max))].sort((a,b)=>a-b);
  if(candidates.some(c=>Math.abs(c-candidates[0])>DEPTH_TOLERANCE_FT)) return {reference:null,tie:true};
  const freq=(d:number)=>depths.filter(e=>e===d).length;
  return {reference:candidates.reduce((best,d)=>freq(d)>freq(best)?d:best,candidates[0]),tie:false};
}

export function buildTestState(input:TestInput,range:MonthRange|null):TestState {
  const raw:{kind:TestKind;origin:TestOrigin;row:TestRow}[]=[];
  for(const [origin,src] of [['package',input.package],['upload',input.upload]] as const)
    for(const kind of ['bhp','srt'] as const) for(const row of src?.[kind]??[]) raw.push({kind,origin,row});
  const identity=(k:TestKind,r:TestRow)=>k==='bhp'?`bhp|${str(r.source_report_id)}|${str(r.tracking_no)}|${str(r.test_sequence_no)}`:`srt|${str(r.source_report_id)}|${str(r.tracking_no)}`;
  const counts=new Map<string,number>();for(const x of raw){const id=identity(x.kind,x.row);counts.set(id,(counts.get(id)??0)+1);}
  const {reference,tie}=referenceDepth(raw.filter(x=>x.kind==='bhp').map(x=>num(x.row.test_depth_ft)).filter((d):d is number=>d!==null));
  const seq={package:{bhp:0,srt:0},upload:{bhp:0,srt:0}};
  const records=raw.map(({kind,origin,row}):TestRecord=>{
    const key=`${origin}:${kind}:${++seq[origin][kind]}`,id=identity(kind,row);
    const date=dateOf(kind==='bhp'?row.report_conducted_date:row.test_date),dateText=str(kind==='bhp'?row.report_conducted_date_text:row.test_date_text);
    const pressures=(kind==='bhp'?['bhp_psia']:['isip_psig','formation_frac_press_psig','surface_pressure_firc_psig']).map(field=>({field,value:num(row[field])}));
    const bhpPsia=kind==='bhp'?pressures[0].value:null,depthFt=kind==='bhp'?num(row.test_depth_ft):null;
    const qualityFlags=Array.isArray(row.quality_flags)?[...row.quality_flags as readonly string[]]:[];
    const flags:TestFlag[]=[],reasons:string[]=[],add=(f:TestFlag,text=FLAG_REASONS[f])=>{flags.push(f);reasons.push(text);};
    if(pressures.every(p=>p.value===null)) add('no-pressure',kind==='bhp'?'No bottomhole pressure reported.':FLAG_REASONS['no-pressure']);
    if(date===null) add('no-date');
    if(kind==='bhp') {
      if(depthFt===null) add('no-depth');
      else if(tie) add('depth-differs','No single most-common test depth; tests are not directly comparable.');
      else if(reference!==null&&Math.abs(depthFt-reference)>DEPTH_TOLERANCE_FT) add('depth-differs',`Tested at a different depth from this well's other tests (reference ${reference} ft); not directly comparable.`);
    }
    if((counts.get(id)??0)>1) add('duplicate-report');
    const quarantine=qualityFlags.filter(f=>QUARANTINE.test(f));
    if(quarantine.length) add('source-quarantined',`Explorer quarantined this row: ${quarantine.join(', ')}.`);
    const usable=date!==null&&pressures.some(p=>p.value!==null)&&(kind==='srt'||depthFt!==null);
    return {key,kind,origin,identity:id,sourceRowKey:str(row.source_row_key),uic:str(row.uic_number),date,dateText,bhpPsia,depthFt,pressures,values:row,qualityFlags,flags,reasons,notes:qualityFlags.filter(f=>!QUARANTINE.test(f)),usable};
  });
  const decisions:Record<string,Decision>={};for(const r of records) decisions[r.key]={include:r.flags.length===0,reason:null,byUser:false};
  return {version:TEST_RECORDS_VERSION,records,referenceDepthFt:reference,referenceTie:tie,range,decisions:Object.freeze(decisions)};
}

export function applyTestDecision(state:TestState,key:string,include:boolean,reason?:string|null):TestState {
  const record=state.records.find(r=>r.key===key);if(!record) throw new Error(`Not a test record: ${key}`);
  const text=(reason??'').trim();
  if(!include&&text.length>MAX_REASON_LENGTH) throw new Error(`A reason must be at most ${MAX_REASON_LENGTH} characters`);
  if(!include&&record.flags.length===0&&!text) throw new Error('A reason (1-200 characters) is required to exclude a test the system did not flag');
  return {...state,decisions:Object.freeze({...state.decisions,[key]:{include,reason:include?null:(text||null),byUser:true}})};
}
const included=(s:TestState,r:TestRecord)=>s.decisions[r.key]?.include===true;
export function bhpSeries(state:TestState):{points:BhpPoint[];enough:boolean;needed:number} {
  const points=state.records.filter(r=>r.kind==='bhp'&&r.usable&&included(state,r)).map(r=>({key:r.key,date:r.date as string,psia:r.bhpPsia as number,depthFt:r.depthFt as number}))
    .sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  return {points,enough:points.length>=MIN_COMPARABLE_TESTS,needed:MIN_COMPARABLE_TESTS};
}
export function rangePosition(date:string|null,range:MonthRange|null):'before'|'in'|'after'|null {
  if(!date||!range) return null;const m=date.slice(0,7);return m<range.first?'before':m>range.last?'after':'in';
}
export function outOfRange(state:TestState):{before:TestRecord[];after:TestRecord[]} {
  return {before:state.records.filter(r=>rangePosition(r.date,state.range)==='before'),after:state.records.filter(r=>rangePosition(r.date,state.range)==='after')};
}
function markerLabel(r:TestRecord) {
  if(r.kind==='bhp') return `BHP ${r.date}: ${r.bhpPsia} psia as reported (basis unresolved; source field named psia), depth ${r.depthFt===null?'not reported':r.depthFt+' ft'}`;
  return `SRT ${r.date}: `+r.pressures.filter(p=>p.value!==null).map(p=>`${p.field} ${p.value} psig, as reported`).join('; ');
}
/** A marker needs an included record with a valid date inside the range and a pressure; depth matters only for the BHP chart point. */
export const hasMarker=(state:TestState,r:TestRecord)=>included(state,r)&&r.date!==null&&r.pressures.some(p=>p.value!==null)&&rangePosition(r.date,state.range)==='in';
export function timelineMarkers(state:TestState):TimelineMarker[] {
  return state.records.filter(r=>hasMarker(state,r)).map(r=>({kind:r.kind,date:r.date as string,label:markerLabel(r)}));
}
export function testCoverage(state:TestState):TestCoverage {
  const o=outOfRange(state);
  return {bhpRecords:state.records.filter(r=>r.kind==='bhp').length,srtRecords:state.records.filter(r=>r.kind==='srt').length,
    packageRecords:state.records.filter(r=>r.origin==='package').length,uploadRecords:state.records.filter(r=>r.origin==='upload').length,
    flagged:state.records.filter(r=>r.flags.length).length,included:state.records.filter(r=>included(state,r)).length,comparableBhp:bhpSeries(state).points.length,
    referenceDepthFt:state.referenceDepthFt,referenceTie:state.referenceTie,beforeRange:o.before.length,afterRange:o.after.length};
}
