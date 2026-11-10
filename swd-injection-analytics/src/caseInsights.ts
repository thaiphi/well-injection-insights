import {buildDisposalCase,type DisposalCase} from './disposalCase.js';
import {caseSummary,CASE_SUMMARY_VERSION,type SummaryLine} from './caseSummary.js';
import {checkWellHistory,HISTORY_CHECK_VERSION,type HistoryLink,type WellHistoryCheck} from './wellHistoryCheck.js';
import {buildPerformanceCases,PERFORMANCE_CASES_VERSION,type PerformanceCases,type PerformanceCasesSpec} from './performanceCases.js';

export const CASE_INSIGHTS_SCHEMA='case-insights-export/1';
export type CaseInsights={caseInputs:DisposalCase['inputs'];links:HistoryLink[];performanceSpec:PerformanceCasesSpec|null;
  history:WellHistoryCheck[];performance:PerformanceCases|null;summary:SummaryLine[]};
export type SealedCaseInsights=CaseInsights&{schemaVersion:typeof CASE_INSIGHTS_SCHEMA;versions:Record<string,string>;contentSha256:string};

const STALE='Result changed or stale: ';
function canonical(v:unknown):string{
  if(v===undefined)return 'null';
  if(v===null||typeof v!=='object')return JSON.stringify(v)??'null';
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  return '{'+Object.entries(v as Record<string,unknown>).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';
}
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
async function sha256(text:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');}
const body=(s:SealedCaseInsights|Omit<SealedCaseInsights,'contentSha256'>)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return canonical(rest);};

export function buildCaseInsights(result:DisposalCase,links:readonly HistoryLink[],performance:PerformanceCases|null):CaseInsights{
  if(performance!==null&&canonical(performance.inputs.caseInput)!==canonical(result.inputs))throw new Error(STALE+'performance cases were built from other inputs');
  const history=checkWellHistory(result.base,links);
  return {caseInputs:clone(result.inputs),links:clone([...links]),performanceSpec:performance?clone(performance.inputs.spec):null,history:clone(history),
    performance:performance?clone(performance):null,summary:clone(caseSummary(result,{history,performance}))};
}
export async function sealCaseInsights(i:CaseInsights):Promise<SealedCaseInsights>{
  const unsealed={...clone(i),schemaVersion:CASE_INSIGHTS_SCHEMA as typeof CASE_INSIGHTS_SCHEMA,
    versions:{caseSummary:CASE_SUMMARY_VERSION,historyCheck:HISTORY_CHECK_VERSION,performanceCases:PERFORMANCE_CASES_VERSION}};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
/** Relative tolerance for numbers when the stored insights are compared with a recomputation (D1): JS engines may differ in the last digit of floating-point results. */
export const VERIFY_RELATIVE_TOLERANCE=1e-9;
/** Structural equality: strings, booleans, null, keys and array lengths exact; finite numbers equal within VERIFY_RELATIVE_TOLERANCE. */
function sameWithin(a:unknown,b:unknown):boolean{
  if(typeof a==='number'&&typeof b==='number'){
    if(!Number.isFinite(a)||!Number.isFinite(b))return Object.is(a,b);
    return Math.abs(a-b)<=VERIFY_RELATIVE_TOLERANCE*Math.max(1,Math.abs(a),Math.abs(b));
  }
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a)){const y=b as unknown[];return a.length===y.length&&a.every((x,i)=>sameWithin(x,y[i]));}
  const ka=Object.keys(a).filter(k=>(a as Record<string,unknown>)[k]!==undefined).sort(),kb=Object.keys(b).filter(k=>(b as Record<string,unknown>)[k]!==undefined).sort();
  return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&sameWithin((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
export async function verifyCaseInsights(s:SealedCaseInsights):Promise<SealedCaseInsights>{
  const fail=()=>new Error(STALE+'recompute before export');
  try{
    if(!/^[a-f0-9]{64}$/.test(s?.contentSha256??'')||s.schemaVersion!==CASE_INSIGHTS_SCHEMA)throw fail();
    // Integrity: the stored body must hash exactly to the stored digest.
    if(await sha256(body(s))!==s.contentSha256)throw fail();
    const result=buildDisposalCase(s.caseInputs);
    const perf=s.performanceSpec?buildPerformanceCases(s.caseInputs,s.performanceSpec):null;
    const rebuilt=await sealCaseInsights(buildCaseInsights(result,s.links,perf));
    // Recomputation: structural match, numbers within relative tolerance (the digests may differ across engines).
    const {contentSha256:_a,...storedBody}=s,{contentSha256:_b,...rebuiltBody}=rebuilt;
    if(!sameWithin(clone(rebuiltBody),clone(storedBody)))throw fail();
    return s;
  }catch(e){
    if(e instanceof Error&&e.message.startsWith(STALE))throw e;
    throw fail();
  }
}
export const caseInsightsJson=(s:SealedCaseInsights)=>JSON.stringify(s,null,2)+'\n';

const cell=(v:unknown)=>{
  if(v===null||v===undefined)return '"unavailable"';
  if(typeof v==='number')return `"${v}"`;
  let s=typeof v==='object'?JSON.stringify(v):String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
/** Per well of a performance case: months whose allocation needs a pressure the model does not support, and the first such month. */
export function unsupportedPressureMonths(c:{summary:{wells:readonly {wellId:string}[];monthly:readonly {month:string;unsupportedAllocations:readonly {wellId:string}[]}[]}}):{wellId:string;count:number;firstMonth:string|null}[]{
  return c.summary.wells.map(w=>{const months=c.summary.monthly.filter(m=>m.unsupportedAllocations.some(a=>a.wellId===w.wellId)).map(m=>m.month);
    return {wellId:w.wellId,count:months.length,firstMonth:months[0]??null};});
}
export function caseInsightsCsv(s:SealedCaseInsights):string{
  const rows:unknown[][]=[['section','rule_or_well','field','value']];
  for(const l of s.summary){
    rows.push(['summary',l.rule,'text',l.text]);
    for(const c of l.cites)rows.push(['summary',l.rule,`cite: ${c.label} (${c.unit})`,c.value]);
  }
  for(const h of s.history){
    rows.push(['history',h.wellId,'status',h.status],['history',h.wellId,'reason',h.reason],['history',h.wellId,'included_months',h.includedMonths],
      ['history',h.wellId,'peak_reported',h.peakReported],['history',h.wellId,'peak_forecast',h.peakForecast],['history',h.wellId,'ratio',h.ratio],
      ['history',h.wellId,'history_months_at_or_above_peak_forecast',h.historyMonthsAtOrAbovePeakForecast],['history',h.wellId,'forecast_months_above_peak_reported',h.forecastMonthsAbovePeakReported],
      ['history',h.wellId,'pressure_status',h.pressure.status],['history',h.wellId,'pressure_note',h.pressure.note]);
  }
  const p=s.performance;
  if(p){
    for(const n of p.notes)rows.push(['performance','all','note',n]);
    for(const hd of p.headroom)rows.push(['performance',hd.wellId,'headroom_psi',hd.headroomPsi]);
    for(const c of p.cases){
      rows.push(['performance',c.label,'factors',c.factors],['performance',c.label,'capped_wells',c.cappedWells.join(' ')],['performance',c.label,'no_headroom_wells',c.noHeadroomWells.join(' ')],
        ['performance',c.label,'summary',c.summary]);
      for(const o of c.offsetPercentOfHeadroom)rows.push(['performance',c.label,`offset_percent_of_headroom ${o.wellId}`,o.percent===null?'no headroom':o.percent]);
      for(const u of unsupportedPressureMonths(c))rows.push(['performance',c.label,`unsupported_pressure_months ${u.wellId}`,u.count],['performance',c.label,`first_unsupported_pressure_month ${u.wellId}`,u.firstMonth??'none']);
      for(const a of c.attribution)rows.push(['performance',c.label,`attribution ${a.factor} change_bbl`,a.changeBbl]);
    }
  }
  rows.push(['metadata','export','schema',s.schemaVersion],...Object.entries(s.versions).map(([k,v])=>['metadata','export',`version ${k}`,v]),['metadata','export','contentSha256',s.contentSha256]);
  return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
