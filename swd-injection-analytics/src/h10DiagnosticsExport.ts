import { CHECKLIST, FLAG_REASONS, FORMULAS, H10_DIAGNOSTICS_VERSION, LIMITATIONS, coverage, screening, type Coverage, type DiagnosticsState, type FlagCode, type ScreeningPoint } from './h10Diagnostics.js';
import { pressureRateSvg, ratioOverTimeSvg } from './h10DiagnosticsChart.js';

export type DiagnosticsSource={artifactId:string;uic:string|null;normalizedSha256:string|null;manifestSha256:string|null};
export type ExportMonth={month:string;status:'gap'|'reported';sourceRowKeys:string[];injectedBbl:number|null;calendarDays:number;rateBpd:number|null;avgPsi:number|null;maxPsi:number|null;
  flags:FlagCode[];flagReasons:string[];include:boolean|null;reason:string|null;decidedBy:'system'|'user'|null;contributes:boolean};
export type SealedDiagnostics={schemaVersion:'h10-diagnostics-export/1';method:typeof H10_DIAGNOSTICS_VERSION;source:DiagnosticsSource;coverage:Coverage;months:ExportMonth[];screening:ScreeningPoint[];
  formulas:string[];limitations:string[];checklist:{cause:string;evidence:string}[];contentSha256:string};

async function sha256(text:string) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
const body=(s:Omit<SealedDiagnostics,'contentSha256'>|SealedDiagnostics)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return JSON.stringify(rest);};

export async function sealDiagnostics(state:DiagnosticsState,source:DiagnosticsSource):Promise<SealedDiagnostics> {
  const points=screening(state).points,contributing=new Set(points.map(p=>p.month));
  const months:ExportMonth[]=state.months.map(m=>{const d=state.decisions[m.month];return {month:m.month,status:m.gap?'gap':'reported',sourceRowKeys:[...m.sourceRowKeys],injectedBbl:m.injectedBbl,calendarDays:m.calendarDays,
    rateBpd:m.rateBpd,avgPsi:m.avgPsi,maxPsi:m.maxPsi,flags:[...m.flags],flagReasons:m.flags.map(f=>FLAG_REASONS[f]),include:d?d.include:null,reason:d?d.reason:null,
    decidedBy:d?(d.byUser?'user':'system'):null,contributes:contributing.has(m.month)};});
  const unsealed={schemaVersion:'h10-diagnostics-export/1' as const,method:H10_DIAGNOSTICS_VERSION as typeof H10_DIAGNOSTICS_VERSION,source:{...source},coverage:coverage(state),months,screening:points,
    formulas:[...FORMULAS],limitations:[...LIMITATIONS],checklist:CHECKLIST.map(c=>({...c}))};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
export async function verifySealed(sealed:SealedDiagnostics):Promise<boolean> {return /^[a-f0-9]{64}$/.test(sealed?.contentSha256??'')&&await sha256(body(sealed))===sealed.contentSha256;}
export const diagnosticsJson=(sealed:SealedDiagnostics)=>JSON.stringify(sealed,null,2)+'\n';

const cell=(v:unknown)=>{
  if(v===null||v===undefined) return '"unavailable"';
  if(typeof v==='number') return `"${v}"`;
  let s=String(v);if(/^[=+\-@\t\r]/.test(s)) s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function diagnosticsCsv(sealed:SealedDiagnostics):string {
  const lines:unknown[][]=[['H-10 diagnostics export',sealed.method],['Artifact',sealed.source.artifactId],['UIC',sealed.source.uic],['Normalized SHA-256',sealed.source.normalizedSha256],
    ['Manifest SHA-256',sealed.source.manifestSha256],['Content SHA-256',sealed.contentSha256],['Notice','"unavailable" marks a missing value, never zero; gap months have no report and are not interpolated'],
    ['First month',sealed.coverage.firstMonth],['Last month',sealed.coverage.lastMonth],['Months in span',sealed.coverage.spanMonths],['Months reported',sealed.coverage.reportedMonths],
    ['Gap months',sealed.coverage.gapMonths.join('; ')||'none'],['Flagged months',sealed.coverage.flaggedMonths],['Included months',sealed.coverage.includedMonths],
    ['Comparable months',sealed.coverage.comparableMonths],['Median positive calendar-day rate (bbl/day)',sealed.coverage.medianRateBpd],['Low-rate check evaluated',sealed.coverage.lowRateEvaluated?'yes':'no'],
    ...sealed.limitations.map(l=>['Limitation',l]),...sealed.formulas.map(f=>['Formula',f]),[],
    ['Month','Status','Injected liquid (bbl/month)','Calendar days','Calendar-day rate (bbl/day)','Reported average pressure (psi)','Reported maximum pressure (psi)','Flags','Included','Decided by','Reason','Contributes to screening','Source row IDs'],
    ...sealed.months.map(m=>[m.month,m.status,m.injectedBbl,m.calendarDays,m.rateBpd,m.avgPsi,m.maxPsi,m.flags.join('; ')||'none',m.include===null?null:m.include?'yes':'no',m.decidedBy,m.reason,m.contributes?'yes':'no',m.sourceRowKeys.join('; ')||null])];
  return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function diagnosticsSvg(sealed:SealedDiagnostics,state:DiagnosticsState):string {
  const a=pressureRateSvg(state),b=ratioOverTimeSvg(state),height=a.height+b.height;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${height}" width="960" height="${height}"><metadata>${escXml(JSON.stringify(sealed))}</metadata>`+
    `<svg y="0" width="960" height="${a.height}">${a.svg}</svg><svg y="${a.height}" width="960" height="${b.height}">${b.svg}</svg></svg>`;
}
