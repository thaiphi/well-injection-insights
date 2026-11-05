import {RECONCILIATION_VERSION,LABEL_RECON,SCREENING_TEXT,FORMULAS,LIMITATIONS,type Reconciliation} from './pressureReconciliation.js';
import {SURFACE_BASIS_PROMPT} from './wellAssumptions.js';
import {reconciliationSvg} from './pressureReconciliationChart.js';

export type ReconSource={uic:string;artifactId:string;normalizedSha256:string|null;manifestSha256:string|null;h10Decisions:Record<string,{include:boolean;reason:string|null;byUser:boolean}>;
  tests:{packageFiles:Record<string,string>;uploads:{kind:string;fileName:string;sha256:string}[];inclusions:Record<string,boolean>};jMatches:Record<string,string|null>};
export type SealedReconciliation=Omit<Reconciliation,'version'>&{schemaVersion:'pressure-reconciliation-export/1';method:typeof RECONCILIATION_VERSION;source:ReconSource;
  units:Record<string,string>;formulas:string[];limitations:string[];contentSha256:string};
const UNITS=Object.freeze({pressure:'psia unless named psi (as reported, on the confirmed basis)',margin:'psi',rate:'bbl/day calendar-day average, treated as STB/day',depth:'ft (MD = TVD declared)',gradient:'psi/ft',diameterAndRoughness:'in',temperature:'°F',salinity:'NaCl wt%'});
async function sha256(text:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');}
const body=(s:Omit<SealedReconciliation,'contentSha256'>|SealedReconciliation)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return JSON.stringify(rest);};

export async function sealReconciliation(rec:Reconciliation,source:ReconSource):Promise<SealedReconciliation>{
  if(!rec.surfaceBasis)throw new Error(SURFACE_BASIS_PROMPT);
  const {version:_,...rest}=JSON.parse(JSON.stringify(rec)) as Reconciliation;
  const unsealed={schemaVersion:'pressure-reconciliation-export/1' as const,method:RECONCILIATION_VERSION as typeof RECONCILIATION_VERSION,...rest,label:LABEL_RECON as typeof LABEL_RECON,screening:SCREENING_TEXT as typeof SCREENING_TEXT,
    source:JSON.parse(JSON.stringify(source)) as ReconSource,units:{...UNITS},formulas:[...FORMULAS],limitations:[...LIMITATIONS]};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
export async function verifyReconciliationSealed(sealed:SealedReconciliation):Promise<boolean>{return /^[a-f0-9]{64}$/.test(sealed?.contentSha256??'')&&await sha256(body(sealed))===sealed.contentSha256;}
export const reconciliationJson=(sealed:SealedReconciliation)=>JSON.stringify(sealed,null,2)+'\n';
const cell=(v:unknown)=>{
  if(v===null||v===undefined)return '"unavailable"';
  if(typeof v==='number')return `"${v}"`;
  let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function reconciliationCsv(sealed:SealedReconciliation):string{
  const src=sealed.source,d=sealed.reportDepth;
  const lines:unknown[][]=[['WHP/BHP reconciliation export',sealed.method],['Label',sealed.label],['Screening',sealed.screening],['UIC',src.uic],['Package artifact',src.artifactId],
    ['Normalized SHA-256',src.normalizedSha256],['Manifest SHA-256',src.manifestSha256],...Object.entries(src.tests.packageFiles).map(([name,hash])=>['Package file SHA-256',`${name} ${hash}`]),
    ...src.tests.uploads.map(u=>['Upload (not verified)',`${u.kind} ${u.fileName} ${u.sha256}`]),['Content SHA-256',sealed.contentSha256],['Notice','"unavailable" marks a missing value, never zero'],
    ['Surface basis (H-10 and permit)',sealed.surfaceBasis?`${sealed.surfaceBasis.value} (reason: ${sealed.surfaceBasis.reason})`:null],['BHP basis',sealed.bhpBasis?`${sealed.bhpBasis.value} (reason: ${sealed.bhpBasis.reason})`:null],
    ...Object.entries(sealed.assumptions).map(([k,v])=>['Assumption',`${k} ${v}`]),['Report depth (ft)',d.depthFt],['Report depth source',d.source],
    ['Permit pressure limit (psi)',sealed.permit.surfacePsi],['Permitted top depth (ft)',sealed.permit.topDepthFt],
    ['Declared bottomhole limit (psia)',sealed.declaredLimit?.psia??null],['Declared limit depth (ft)',sealed.declaredLimit?.depthFt??null],['Declared limit reason',sealed.declaredLimit?.reason??null],
    ['Formation margin',sealed.formation],['Readiness',sealed.readiness],...sealed.formulas.map(f=>['Formula',f]),...sealed.limitations.map(l=>['Limitation',l]),[],
    ['Month','Status','Rate (bbl/day)','Average (psi)','Maximum (psi)','Surface (psia)','Regulatory margin (psi)','Regulatory reason','Modelled BHP (psia)','Hydrostatic (psi)','Friction (psi)',
      'Band min (psia)','Band max (psia)','Modelled reason','Permit-equivalent BHP (psia)','Permit-equivalent margin (psi)','Permit-equivalent reason','Declared margin (psi)','Declared reason'],
    ...sealed.rows.map(r=>[r.month,r.status,r.rateBpd,r.avgPsi,r.maxPsi,r.surfacePsia,r.regulatory.marginPsi,r.regulatory.reason,r.modelled.pwfPsia,r.modelled.hydroPsi,r.modelled.frictionPsi,
      r.modelled.band?.min??null,r.modelled.band?.max??null,r.modelled.reason,r.permitEquivalent.pwfPsia,r.permitEquivalent.marginPsi,r.permitEquivalent.reason,r.declared.marginPsi,r.declared.reason]),[],
    ['Test','Month','Date','Depth (ft)','Reported BHP (psi, as reported)','P_res (psia)','Differential (psi)','Band min (psi)','Band max (psi)','Negative','Reason','Test gradient (psi/ft)','Column gradient (psi/ft)'],
    ...sealed.rows.flatMap(r=>r.tests.map(t=>[t.key,r.month,t.date,t.depthFt,t.reportedPsi,t.pResPsia,t.differentialPsi,t.band?.min??null,t.band?.max??null,t.negative?'yes':'no',t.reason,t.testGradientPsiFt,t.columnGradientPsiFt]))];
  return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function reconciliationSvgExport(sealed:SealedReconciliation,rec:Reconciliation):string{
  const a=reconciliationSvg(rec);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${a.height}" width="960" height="${a.height}"><metadata>${escXml(JSON.stringify(sealed))}</metadata><svg y="0" width="960" height="${a.height}">${a.svg}</svg></svg>`;
}
