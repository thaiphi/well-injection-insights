import { FLAG_REASONS, J_READINESS, LABEL_BHP_BASIS, LIMITATIONS, ORIGIN_LABELS, TEST_RECORDS_VERSION, bhpSeries, hasMarker, rangePosition, testCoverage,
  type MonthRange, type TestCoverage, type TestFlag, type TestKind, type TestOrigin, type TestRow, type TestState } from './testRecords.js';
import { testPressureSvg } from './testRecordsChart.js';

export type TestSource={uic:string;package:{artifactId:string;normalizedSha256:string|null;manifestSha256:string|null;files:Record<string,string>}|null;uploads:{kind:TestKind;fileName:string;sha256:string}[]};
export type ExportRecord={key:string;kind:TestKind;origin:TestOrigin;originLabel:string;identity:string;sourceRowKey:string;date:string|null;dateText:string;rangePosition:'before'|'in'|'after'|null;
  pressures:{field:string;value:number|null;unit:string}[];depthFt:number|null;values:TestRow;qualityFlags:string[];flags:TestFlag[];flagReasons:string[];notes:string[];
  include:boolean;reason:string|null;decidedBy:'system'|'user';contributes:boolean};
export type SealedTestRecords={schemaVersion:'test-records-export/1';method:typeof TEST_RECORDS_VERSION;source:TestSource;coverage:TestCoverage;referenceDepthFt:number|null;referenceTie:boolean;
  range:MonthRange|null;records:ExportRecord[];outOfRange:{before:string[];after:string[]};readiness:string;limitations:string[];contentSha256:string};

async function sha256(text:string) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
const body=(s:Omit<SealedTestRecords,'contentSha256'>|SealedTestRecords)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return JSON.stringify(rest);};
const unit=(field:string)=>field==='bhp_psia'?`psia as named (${LABEL_BHP_BASIS})`:'psig as reported';

export async function sealTestRecords(state:TestState,source:TestSource):Promise<SealedTestRecords> {
  const bhpKeys=new Set(bhpSeries(state).points.map(p=>p.key)),markerKeys=new Set(state.records.filter(r=>hasMarker(state,r)).map(r=>r.key));
  const records:ExportRecord[]=state.records.map(r=>{const d=state.decisions[r.key];return {key:r.key,kind:r.kind,origin:r.origin,originLabel:ORIGIN_LABELS[r.origin],identity:r.identity,sourceRowKey:r.sourceRowKey,
    date:r.date,dateText:r.dateText,rangePosition:rangePosition(r.date,state.range),pressures:r.pressures.map(p=>({...p,unit:unit(p.field)})),depthFt:r.depthFt,values:{...r.values},
    qualityFlags:[...r.qualityFlags],flags:[...r.flags],flagReasons:[...r.reasons],notes:[...r.notes],include:d.include,reason:d.reason,decidedBy:d.byUser?'user':'system',
    contributes:bhpKeys.has(r.key)||markerKeys.has(r.key)};});
  const pos=(p:'before'|'after')=>state.records.filter(r=>rangePosition(r.date,state.range)===p).map(r=>r.key);
  const unsealed={schemaVersion:'test-records-export/1' as const,method:TEST_RECORDS_VERSION as typeof TEST_RECORDS_VERSION,source:JSON.parse(JSON.stringify(source)) as TestSource,coverage:testCoverage(state),
    referenceDepthFt:state.referenceDepthFt,referenceTie:state.referenceTie,range:state.range?{...state.range}:null,records,outOfRange:{before:pos('before'),after:pos('after')},readiness:J_READINESS,limitations:[...LIMITATIONS]};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
export async function verifyTestRecordsSealed(sealed:SealedTestRecords):Promise<boolean> {return /^[a-f0-9]{64}$/.test(sealed?.contentSha256??'')&&await sha256(body(sealed))===sealed.contentSha256;}
export const testRecordsJson=(sealed:SealedTestRecords)=>JSON.stringify(sealed,null,2)+'\n';

const cell=(v:unknown)=>{
  if(v===null||v===undefined) return '"unavailable"';
  if(typeof v==='number') return `"${v}"`;
  let s=String(v);if(/^[=+\-@\t\r]/.test(s)) s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function testRecordsCsv(sealed:SealedTestRecords):string {
  const p=sealed.source.package,pv=(r:ExportRecord,f:string)=>r.pressures.find(x=>x.field===f)?.value??null;
  const lines:unknown[][]=[['Test records export',sealed.method],['UIC',sealed.source.uic],['Package artifact',p?.artifactId??null],['Normalized SHA-256',p?.normalizedSha256??null],['Manifest SHA-256',p?.manifestSha256??null],
    ...Object.entries(p?.files??{}).map(([name,hash])=>['Package file SHA-256',`${name} ${hash}`]),...sealed.source.uploads.map(u=>['Upload (not verified)',`${u.kind} ${u.fileName} ${u.sha256}`]),
    ['Content SHA-256',sealed.contentSha256],['Notice','"unavailable" marks a missing value, never zero; pressures are as reported and never converted'],
    ['Reference depth (ft)',sealed.referenceTie?'none: no single most-common depth':sealed.referenceDepthFt],['H-10 range',sealed.range?`${sealed.range.first} to ${sealed.range.last}`:null],
    ['Readiness',sealed.readiness],...sealed.limitations.map(l=>['Limitation',l]),[],
    ['Record','Type','Origin','Report identity','Test date','Date as published','H-10 range position','BHP (source field named psia)','ISIP (psig)','Frac pressure (psig)','FIRC surface pressure (psig)','Depth (ft)','Flags','Explorer quality flags','Included','Decided by','Reason','Contributes','Source row key'],
    ...sealed.records.map(r=>[r.key,r.kind.toUpperCase(),r.originLabel,r.identity,r.date,r.dateText,r.rangePosition,pv(r,'bhp_psia'),pv(r,'isip_psig'),pv(r,'formation_frac_press_psig'),pv(r,'surface_pressure_firc_psig'),
      r.depthFt,r.flags.join('; ')||'none',r.qualityFlags.join('; ')||'none',r.include?'yes':'no',r.decidedBy,r.reason,r.contributes?'yes':'no',r.sourceRowKey])];
  return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function testRecordsSvg(sealed:SealedTestRecords,state:TestState):string {
  const a=testPressureSvg(state);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${a.height}" width="960" height="${a.height}"><metadata>${escXml(JSON.stringify(sealed))}</metadata><svg y="0" width="960" height="${a.height}">${a.svg}</svg></svg>`;
}
