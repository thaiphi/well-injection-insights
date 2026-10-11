import {assertJsonEvidence,sha256Text} from './exhibitIntegrity.js';

/** Exact UTF-8 fixture bytes, not the source PDF hash. Source verification is recorded in the fixture. */
export const LITERATURE_FIXTURE_SHA256='dddfabcf4386482545a693520786b26eb28e3f9faa311823a742241780178b0f';
export interface LiteratureInputs {skin:number;selectedRateBblPerDay:number}
export interface LiteraturePoint {rateBblPerDay:number;rateM3PerSecond:number;baselinePressurePsi:number;comparedPressurePsi:number;penaltyPsi:number}
interface Fixture {
 id:string;label:string;origin:string;source:Record<string,string>;
 parameters:Record<string,{value:number|number[];origin:string;unit:string;selected:string}>;
 pairedUnitDecisions:string[];assumptions:Record<string,unknown>;
}
const conversions={footToMeter:0.3048,barrelToM3:0.158987294928,secondsPerDay:86400,psiToKpa:6.894757293168,milliDarcyToDarcy:0.001,exactDarcyToM2:9.869233e-13};
const method={name:'Published steady radial pressure equation with assumed constant skin',equations:'Iw = 2e-6 * pi * h_m * K_D / (mu_cP * (ln(re/rw) + S)); deltaP_kPa = q_m3_per_s / Iw; prw = pre + deltaP (Eq. 18, 21, 22)',publishedCoefficient:2e-6,coefficientRounding:'Literal published coefficient approximates 1 D as 1e-12 m2; exact-SI pressure differences are about 1.325% larger.',implementation:'literature-radial-skin/v1',relativePermeability:'Skin represents an externally assumed loss; no saturation or oil-invasion calculation.'};
const limitations=[
 'Educational steady radial example using published parameters and assumed constant skin; calculated outputs are not numerical curves reported by the paper.',
 'No transient oil invasion, geomechanics, seismic prediction, calibrated sustainable capacity, layering or wellbore hydraulics is implemented.',
 'Published fracturing pressure is a comparison reference only, never an operating, permitted or safe pressure limit.',
 'Pressure basis is reported psi; absolute/gauge unspecified; common formation datum. No wellhead pressure is inferred.',
 'No synthetic, public RRC or imported dataset is joined to this example; no real well identity or operational applicability is assigned.',
 'Downloads are JSON, CSV and SVG; this example has no dedicated PDF export.'
];
function finiteRange(value:number,name:string,min:number,max:number):void {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${name} must be finite and between ${min} and ${max}.`);
}
/** q is reservoir volume. The literal Eq.18 coefficient uses h in m, K in D, mu in cP, deltaP in kPa. */
export function literaturePressurePoint(rateBblPerDay:number,skin:number):LiteraturePoint {
 finiteRange(rateBblPerDay,'Reservoir rate (bbl/day)',0,10000);finiteRange(skin,'Assumed skin',0,50);
 const rateM3PerSecond=rateBblPerDay*conversions.barrelToM3/conversions.secondsPerDay;
 const pressurePerSkin=rateM3PerSecond/(method.publishedCoefficient*Math.PI*(15*conversions.footToMeter)*(256*conversions.milliDarcyToDarcy))/conversions.psiToKpa;
 const baselinePressurePsi=2560+pressurePerSkin*Math.log(1000/0.292),penaltyPsi=pressurePerSkin*skin;
 return {rateBblPerDay,rateM3PerSecond,baselinePressurePsi,comparedPressurePsi:2560+pressurePerSkin*(Math.log(1000/0.292)+skin),penaltyPsi};
}
export function buildLiteratureExample(fixtureText:string,inputs:LiteratureInputs){
 if(typeof fixtureText!=='string'||sha256Text(fixtureText)!==LITERATURE_FIXTURE_SHA256)throw Error('Literature fixture hash mismatch; source identity is unverified.');
 assertJsonEvidence(inputs,'literature inputs');
 if(!inputs||Object.keys(inputs).sort().join(',')!=='selectedRateBblPerDay,skin')throw Error('Require only assumed skin and selected reservoir rate.');
 finiteRange(inputs.skin,'Assumed skin',0,50);finiteRange(inputs.selectedRateBblPerDay,'Selected reservoir rate (bbl/day)',2000,10000);
 const fixture=JSON.parse(fixtureText) as Fixture;
 const selected=literaturePressurePoint(inputs.selectedRateBblPerDay,inputs.skin);
 const rows=[...new Set([2000,5000,10000,inputs.selectedRateBblPerDay])].sort((a,b)=>a-b).map(q=>literaturePressurePoint(q,inputs.skin));
 const curve=Array.from({length:11},(_,i)=>literaturePressurePoint(i*1000,inputs.skin));
 const body={schemaVersion:'swd-literature-example/1',scenarioId:fixture.id,scenarioLabel:fixture.label,origin:'literature + assumed + calculated',inputs:{...inputs},
  provenance:{source:fixture.source,fixture:{path:'data/scenarios/literature-example.json',sha256:LITERATURE_FIXTURE_SHA256,exactText:fixtureText},
   publishedParameters:fixture.parameters,pairedUnitDecisions:fixture.pairedUnitDecisions,
   assumptions:{...fixture.assumptions,comparedSkin:inputs.skin,selectedRateBblPerDay:inputs.selectedRateBblPerDay},
   units:{rate:'reservoir bbl/day; reservoir m3/s',pressure:'reported psi',pressureDifference:'psi',skin:'dimensionless',injectivity:'reservoir m3/s/kPa'},
   pressureBasis:'reported psi; absolute/gauge unspecified; common formation datum',conversions:{...conversions},method:{...method},
   outputOrigin:'calculated',referenceRole:'Published reference only; not an operating, permitted or safe limit',integrity:'SHA-256 content consistency, not source authenticity'},
  publishedReferencePressurePsi:4334,selected,rows,curve,limitations:[...limitations]};
 assertJsonEvidence(body);return {...body,contentSha256:sha256Text(JSON.stringify(body))};
}
export type LiteratureExample=ReturnType<typeof buildLiteratureExample>;
function verified(input:LiteratureExample):LiteratureExample {
 assertJsonEvidence(input,'literature exhibit');const snapshot=structuredClone(input),{contentSha256,...body}=snapshot;
 if(contentSha256!==sha256Text(JSON.stringify(body)))throw Error('Literature exhibit integrity hash mismatch.');
 const expected=buildLiteratureExample(snapshot.provenance.fixture.exactText,snapshot.inputs);
 if(JSON.stringify(snapshot)!==JSON.stringify(expected))throw Error('Literature exhibit changed; outputs and provenance must match verified calculation.');
 return snapshot;
}
export function literatureExampleJson(input:LiteratureExample):string{return JSON.stringify(verified(input),null,2);}
const csvCell=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function literatureExampleCsv(input:LiteratureExample):string {
 const r=verified(input),lines:unknown[][]=[['record','value'],['scenario',r.scenarioLabel],['input_origin',r.origin],['content_sha256',r.contentSha256],['inputs_json',JSON.stringify(r.inputs)],['provenance_json',JSON.stringify(r.provenance)],['limitations_json',JSON.stringify(r.limitations)],[],['series','reservoir_rate_bbl_per_day','reservoir_rate_m3_per_s','baseline_pressure_reported_psi','compared_pressure_reported_psi','skin_penalty_psi']];
 for(const [name,points]of [['table',r.rows],['curve',r.curve]] as const)for(const p of points)lines.push([name,p.rateBblPerDay,p.rateM3PerSecond,p.baselinePressurePsi,p.comparedPressurePsi,p.penaltyPsi]);
 lines.push(['published_reference_only_reported_psi',r.publishedReferencePressurePsi]);return lines.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
const xml=(value:unknown)=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
/** A self-contained chart sheet; metadata contains the complete verified exhibit, exact fixture and all assumptions. */
export function literatureExampleSvg(input:LiteratureExample):string {
 const r=verified(input),x=(q:number)=>90+q/10000*760,min=2500,max=Math.ceil(Math.max(4334,...r.curve.map(p=>p.comparedPressurePsi))/500)*500;
 const y=(p:number)=>335-(p-min)/(max-min)*210;
 const path=(key:'baselinePressurePsi'|'comparedPressurePsi')=>r.curve.map((p,i)=>`${i?'L':'M'}${x(p.rateBblPerDay).toFixed(3)},${y(p[key]).toFixed(3)}`).join(' ');
 const ticks=Array.from({length:5},(_,i)=>{const p=min+(max-min)*i/4;return `<line x1="90" y1="${y(p)}" x2="850" y2="${y(p)}" stroke="#dbe3e9"/><text x="78" y="${y(p)+4}" text-anchor="end">${p.toFixed(0)}</text>`;}).join('');
 const table=r.rows.map((p,i)=>`<text x="45" y="${452+i*22}">${p.rateBblPerDay.toFixed(0)}</text><text x="265" y="${452+i*22}">${p.baselinePressurePsi.toFixed(2)}</text><text x="505" y="${452+i*22}">${p.comparedPressurePsi.toFixed(2)}</text><text x="745" y="${452+i*22}">${p.penaltyPsi.toFixed(2)}</text>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 760" role="img" aria-labelledby="literature-svg-title literature-svg-desc"><title id="literature-svg-title">Published Entrada parameters: assumed skin pressure comparison</title><desc id="literature-svg-desc">Required formation pressure versus reservoir rate. Pressure basis reported psi, absolute/gauge unspecified. Baseline skin zero and assumed skin ${r.inputs.skin}. Published reference is not a limit. Full provenance is embedded.</desc><metadata>${xml(JSON.stringify(r))}</metadata><rect width="960" height="760" fill="#fff"/><g font-family="Arial,sans-serif" fill="#203341" font-size="13"><text x="45" y="32" font-size="21">Published Entrada parameters · assumed skin comparison</text><text x="45" y="57">Calculated penalty at ${r.selected.rateBblPerDay} reservoir bbl/day: ${r.selected.penaltyPsi.toFixed(2)} psi (skin 0 → ${r.inputs.skin})</text><text x="45" y="79">Formation pressure: reported psi; absolute/gauge unspecified; common formation datum</text><text x="90" y="108" fill="#176c9c">Baseline skin 0</text><text x="280" y="108" fill="#9b4d16">Assumed skin ${r.inputs.skin}</text>${ticks}<path d="${path('baselinePressurePsi')}" fill="none" stroke="#176c9c" stroke-width="3"/><path d="${path('comparedPressurePsi')}" fill="none" stroke="#9b4d16" stroke-width="3"/><line x1="90" y1="${y(4334)}" x2="850" y2="${y(4334)}" stroke="#60757f" stroke-dasharray="7 5"/><text x="855" y="${y(4334)-7}" font-size="11">4334 psi</text><line x1="90" y1="335" x2="850" y2="335" stroke="#203341"/>${[0,2000,5000,10000].map(q=>`<text x="${x(q)}" y="355" text-anchor="middle">${q}</text>`).join('')}<text x="470" y="378" text-anchor="middle">Reservoir rate (bbl/day)</text><text x="45" y="402">Published reference only: 4334 psi. Not an operating, permitted or safe limit.</text><text x="45" y="429" font-weight="bold">Rate (reservoir bbl/day)</text><text x="265" y="429" font-weight="bold">Baseline (reported psi)</text><text x="505" y="429" font-weight="bold">Compared (reported psi)</text><text x="745" y="429" font-weight="bold">Penalty (psi)</text>${table}<text x="45" y="565">Method: Eq. 18, 21, 22 (PDF p10), literal 2e-6 coefficient; assumed constant skin.</text><text x="45" y="588">Jin, Wojtanowicz &amp; Ge (2022), Energies 15, 2101; Table A1 (PDF p18).</text><a href="https://doi.org/10.3390/en15062101"><text x="45" y="611">DOI: 10.3390/en15062101</text></a><text x="45" y="634">Educational steady radial calculation; no oil-invasion, transient or seismic simulation.</text><text x="45" y="657">JSON, CSV and SVG retain complete inputs, method, units, assumptions and exact fixture.</text><text x="45" y="684" font-size="10">Fixture SHA-256: ${r.provenance.fixture.sha256}</text><text x="45" y="705" font-size="10">Exhibit SHA-256: ${r.contentSha256}</text><text x="45" y="731" font-size="11">No measured RRC pressures, wellhead conversion, operating limit or dedicated PDF is inferred.</text></g></svg>`;
}
