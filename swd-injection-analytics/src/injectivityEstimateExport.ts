import {J_ESTIMATE_VERSION,LABEL_J,LIMITATIONS,type Estimate} from './injectivityEstimate.js';
import {jEstimateSvg} from './injectivityEstimateChart.js';

export type JSource={uic:string;artifactId:string;normalizedSha256:string|null;manifestSha256:string|null;tests:{packageFiles:Record<string,string>;uploads:{kind:string;fileName:string;sha256:string}[]}};
export type SealedEstimate=Omit<Estimate,'version'>&{schemaVersion:'test-referenced-j-export/2';method:typeof J_ESTIMATE_VERSION;label:typeof LABEL_J;source:JSource;
  units:Record<string,string>;limitations:string[];contentSha256:string};
const UNITS=Object.freeze({j:'STB/day/psi',rate:'bbl/day calendar-day average, treated as STB/day',pressure:'psia unless named psi (as reported, on the confirmed basis)',depth:'ft (MD = TVD declared)',diameterAndRoughness:'in',temperature:'°F',salinity:'NaCl wt%'});
async function sha256(text:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');}
const body=(s:Omit<SealedEstimate,'contentSha256'>|SealedEstimate)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return JSON.stringify(rest);};

export async function sealEstimate(est:Estimate,source:JSource):Promise<SealedEstimate>{
  if(est.chosenKey!==null&&!est.roundTripOk)throw new Error('Round trip failed: export refused.');
  const {version:_,...rest}=JSON.parse(JSON.stringify(est)) as Estimate;
  const unsealed={schemaVersion:'test-referenced-j-export/2' as const,method:J_ESTIMATE_VERSION as typeof J_ESTIMATE_VERSION,...rest,label:LABEL_J as typeof LABEL_J,source:JSON.parse(JSON.stringify(source)) as JSource,units:{...UNITS},limitations:[...LIMITATIONS]};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
export async function verifyEstimateSealed(sealed:SealedEstimate):Promise<boolean>{return /^[a-f0-9]{64}$/.test(sealed?.contentSha256??'')&&await sha256(body(sealed))===sealed.contentSha256;}
export const estimateJson=(sealed:SealedEstimate)=>JSON.stringify(sealed,null,2)+'\n';
const cell=(v:unknown)=>{
  if(v===null||v===undefined)return '"unavailable"';
  if(typeof v==='number')return `"${v}"`;
  let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function estimateCsv(sealed:SealedEstimate):string{
  const lines:unknown[][]=[['Test-referenced J export',sealed.method],['Label',sealed.label],['UIC',sealed.source.uic],['Package artifact',sealed.source.artifactId],['Normalized SHA-256',sealed.source.normalizedSha256],['Manifest SHA-256',sealed.source.manifestSha256],
    ...Object.entries(sealed.source.tests.packageFiles).map(([name,hash])=>['Package file SHA-256',`${name} ${hash}`]),...sealed.source.tests.uploads.map(u=>['Upload (not verified)',`${u.kind} ${u.fileName} ${u.sha256}`]),
    ['Content SHA-256',sealed.contentSha256],['Notice','"unavailable" marks a missing value, never zero'],
    ['Basis',sealed.basis?`${sealed.basis.value} (reason: ${sealed.basis.reason})`:null],
    ['Surface basis (H-10 and permit)',sealed.surfaceBasis?`${sealed.surfaceBasis.value} (reason: ${sealed.surfaceBasis.reason})`:null],...Object.entries(sealed.assumptions).map(([k,v])=>['Assumption',`${k} ${v}`]),
    ['Chosen test',sealed.chosenKey],['Chosen by',sealed.choiceBy],['Choice reason',sealed.choiceReason],['J range (STB/day/psi)',sealed.range?`${sealed.range.min} to ${sealed.range.max}`:null],['Round trip within 0.5 psi',sealed.roundTripOk?'yes':'no'],
    ['Readiness',sealed.readiness],...sealed.limitations.map(l=>['Limitation',l]),[],
    ['Test','Date','Depth (ft)','Reported BHP (psi, as reported)','Matched month','Move','Move reason','Status','Reason','Rate (bbl/day)','Surface (psi)','P_res (psia)','P_wf (psia)','Hydrostatic (psi)','Friction (psi)','Delta p (psi)','J','J no-friction','J other basis','Other basis',
      ...[0,1,2].map(i=>`J at ${sealed.tests[0]?.jByTubing[i]?.innerDiameterInches??['3.958','4.892','6.276'][i]} in`)],
    ...sealed.tests.map(t=>[t.key,t.date,t.depthFt,t.reportedPsi,t.month,t.shift,t.shiftReason,t.status,t.reason,t.rateStbd,t.surfacePsi,t.pResPsia,t.pWfPsia,t.hydrostaticPsi,t.frictionPsi,t.deltaPsi,t.j,t.jNoFriction,t.jAlternateBasis,t.alternateBasis,
      ...[0,1,2].map(i=>t.jByTubing[i]?.j??null)]),[],
    ['Round trip','Month','Rate (bbl/day)','Observed surface (psia)','Reproduced surface (psia)','Residual (psi)','Chosen','Reason'],
    ...sealed.roundTrip.map(r=>[r.key,r.month,r.rateStbd,r.observedSurfacePsia,r.reproducedSurfacePsia,r.residualPsi,r.chosen?'yes':'no',r.reason])];
  return lines.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const escXml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function estimateSvg(sealed:SealedEstimate,est:Estimate):string{
  const a=jEstimateSvg(est);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 ${a.height}" width="960" height="${a.height}"><metadata>${escXml(JSON.stringify(sealed))}</metadata><svg y="0" width="960" height="${a.height}">${a.svg}</svg></svg>`;
}
