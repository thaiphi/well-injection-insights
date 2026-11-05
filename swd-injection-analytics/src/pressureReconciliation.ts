import type {DiagnosticsState,MonthRecord} from './h10Diagnostics.js';
import {DEPTH_TOLERANCE_FT,type TestState} from './testRecords.js';
import {TraverseError} from './wellboreTraverse.js';
import {TUBING_SENSITIVITY_IN,type Estimate,type TestEstimate} from './injectivityEstimate.js';
import {flowingAt,toAbsolute,otherBasis,pickAssumptions,MIN_TRAVERSE_PSIA,SURFACE_BASIS_PROMPT,LIMIT_DATUM_TOLERANCE_FT,
  type Assumptions,type BasisConfirmation,type DeclaredLimit,type Flowing,type WellAssumptions} from './wellAssumptions.js';

/** Phase 2a WHP/BHP reconciliation and pressure-margin screening. Pure; no DOM. Screening only. */
export const RECONCILIATION_VERSION='pressure-reconciliation/1';
export const LABEL_RECON='WHP/BHP reconciliation (screening)';
export const SCREENING_TEXT='Screening only: not a regulatory approval, compliance finding or safe-operating determination.';
export const DIFFERENTIAL_LABEL='flowing minus static differential, not a model error';
export const PERMIT_EQ_LABEL='restates the permit limit at depth; not an independent constraint';
export const FORMATION_TEXT='Not evaluated in this phase';
export const SRT_NOTE='Step-rate records carry fracture-pressure fields; this phase does not use them.';
export const RATE_NOTE='Calendar-day average rate; it understates the rate while the well is actually injecting, so friction is understated and the modelled pressure reads high.';
export const NEGATIVE_FLAG='model below measured static pressure: assumptions or test reading inconsistent';
export const ABOVE_PERMIT_FLAG='reported maximum above permit limit (screening, not a compliance finding)';
export const CAUSE_CHECKLIST=Object.freeze(['Shut-in days included in the monthly average pressure.','Brine column density or salinity differs from the declared assumption.',
  'Test taken with pressure held on the tubing.','Calendar-day rate understates the rate while injecting.']);
export const RECON_REASONS=Object.freeze({
  excluded:'Excluded in the H-10 review',gap:'No H-10 report',noPermit:'No permit pressure limit in the inventory',notApplicable:'Not applicable (no injection)',noMax:'No maximum reported',
  noDepth:'No report depth: no test depth and no permitted top depth',noInjection:'No injection in the month',noAvg:'No average pressure reported',
  floor:'Average below the 100 psia traverse floor (D9)',notConverged:'Traverse did not converge',noModel:'No modelled bottomhole pressure for the month',
  noLimit:'No limit declared',limitDatum:'Limit datum differs from report depth; no comparison',bhpBasis:'Confirm the BHP basis in the J panel',
  testDepth:'Test depth differs from report depth; no differential'});
export const FORMULAS=Object.freeze(['P_bh = P_wh + ΔP_hydrostatic − ΔP_friction (forward surface-boundary traverse at the report depth)',
  'Regulatory margin = permit liquid pressure limit (psi) − reported monthly maximum (psi), same basis, no conversion',
  'Permit-equivalent margin = P_bh(permit pressure at surface) − P_bh(reported average at surface), same month rate',
  'Declared margin = declared bottomhole limit (psia) − modelled P_bh',
  'Differential = modelled flowing P_bh − measured static P_res (BHP test on its confirmed basis)']);
export const LIMITATIONS=Object.freeze([SCREENING_TEXT,
  'Surface pressures are H-10 monthly figures read on the user-confirmed basis; the regulatory margin compares the permit limit with the reported monthly maximum on that same basis.',
  RATE_NOTE,
  'Tubing size, roughness, temperatures and salinity are declared assumptions, not public records; the well is treated as vertical (MD = TVD).',
  `BHP tests are treated as static shut-in readings (RRC Permian guidance); the source does not state the test type. The ${DIFFERENTIAL_LABEL}.`,
  `The permit-equivalent bottomhole pressure ${PERMIT_EQ_LABEL}.`,
  `Formation margin: ${FORMATION_TEXT}; no fracture-pressure or formation-limit evidence is used.`,
  'Rate in bbl/day is treated as STB/day.']);
const R=RECON_REASONS;
export type ReportDepth={depthFt:number|null;source:string};
export type ReconPermit={surfacePsi:number|null;topDepthFt:number|null};
export type ReconInputs={h10:DiagnosticsState|null;tests:TestState;well:WellAssumptions;j:Estimate|null;permit:ReconPermit;declaredLimit:DeclaredLimit|null};
export type Deps={flowingAt:typeof flowingAt};
export type Band={min:number;max:number};
export type TestMonth={key:string;date:string;depthFt:number;reportedPsi:number;pResPsia:number|null;differentialPsi:number|null;band:Band|null;negative:boolean;reason:string|null;
  testGradientPsiFt:number;columnGradientPsiFt:number|null;checklist:string[]};
export type MonthRow={month:string;status:'included'|'excluded'|'gap';rateBpd:number|null;avgPsi:number|null;maxPsi:number|null;surfacePsia:number|null;
  regulatory:{marginPsi:number|null;reason:string|null;abovePermit:boolean};
  modelled:{pwfPsia:number|null;hydroPsi:number|null;frictionPsi:number|null;band:Band|null;reason:string|null};
  permitEquivalent:{pwfPsia:number|null;marginPsi:number|null;reason:string|null};declared:{marginPsi:number|null;reason:string|null};tests:TestMonth[]};
export type ReconCounts={months:number;included:number;modelled:number;refused:Record<string,number>;testMonths:number;negativeDifferentials:number;abovePermit:number};
export type Reconciliation={version:typeof RECONCILIATION_VERSION;label:typeof LABEL_RECON;screening:typeof SCREENING_TEXT;surfaceBasis:BasisConfirmation|null;bhpBasis:BasisConfirmation|null;
  assumptions:Assumptions;reportDepth:ReportDepth;permit:ReconPermit;declaredLimit:DeclaredLimit|null;srtPresent:boolean;formation:typeof FORMATION_TEXT;notes:string[];
  rows:MonthRow[];summary:{minRegulatoryPsi:number|null;minPermitEquivalentPsi:number|null;minDeclaredPsi:number|null};counts:ReconCounts;readiness:string};

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function reportDepth(tests:Pick<TestState,'referenceDepthFt'|'referenceTie'>,permittedTopFt:number|null):ReportDepth{
  if(tests.referenceDepthFt!==null&&!tests.referenceTie)return {depthFt:tests.referenceDepthFt,source:'BHP test depth'};
  const top=finite(permittedTopFt)&&permittedTopFt>=1&&permittedTopFt<=50000?permittedTopFt:null,tie=tests.referenceTie?'; BHP test depths tie':'';
  return top!==null?{depthFt:top,source:'permitted top of interval (RRC guidance)'+tie}:{depthFt:null,source:'none'+tie};
}
function run(deps:Deps,depth:number,a:Assumptions,rate:number,surfacePsia:number,id?:number):Flowing|{reason:string}{
  if(surfacePsia<MIN_TRAVERSE_PSIA)return {reason:R.floor};
  try{return deps.flowingAt(depth,a,rate,surfacePsia,id);}
  catch(error){if(error instanceof TraverseError&&error.code==='numerical')return {reason:R.notConverged};throw error;}
}
type Modelled=Flowing&{band:Band}|{reason:string};
function model(deps:Deps,depth:number,a:Assumptions,rate:number,avgPsi:number,basis:'psig'|'psia'):Modelled{
  const surfacePsia=toAbsolute(avgPsi,basis),f=run(deps,depth,a,rate,surfacePsia);
  if('reason' in f)return f;
  const values=[f.pwf];
  const alt=run(deps,depth,a,rate,toAbsolute(avgPsi,otherBasis(basis)));if(!('reason' in alt))values.push(alt.pwf);
  for(const id of TUBING_SENSITIVITY_IN){if(id===a.innerDiameterInches)continue;const t=run(deps,depth,a,rate,surfacePsia,id);if(!('reason' in t))values.push(t.pwf);}
  return {...f,band:{min:Math.min(...values),max:Math.max(...values)}};
}
const minOf=(values:(number|null)[])=>{const f=values.filter(finite);return f.length?Math.min(...f):null;};
export function reconcile(inputs:ReconInputs,deps:Deps={flowingAt}):Reconciliation{
  const {h10,tests,well,j,permit,declaredLimit}=inputs,a=pickAssumptions(well),depth=reportDepth(tests,permit.topDepthFt),srtPresent=tests.records.some(r=>r.kind==='srt');
  const head={version:RECONCILIATION_VERSION,label:LABEL_RECON,screening:SCREENING_TEXT,surfaceBasis:well.surfaceBasis?{...well.surfaceBasis}:null,bhpBasis:j?.basis?{...j.basis}:null,
    assumptions:a,reportDepth:depth,permit:{...permit},declaredLimit:declaredLimit?{...declaredLimit}:null,srtPresent,formation:FORMATION_TEXT,notes:[RATE_NOTE,...(srtPresent?[SRT_NOTE]:[])]} as const;
  const empty=(readiness:string):Reconciliation=>({...head,notes:[...head.notes],rows:[],summary:{minRegulatoryPsi:null,minPermitEquivalentPsi:null,minDeclaredPsi:null},
    counts:{months:0,included:0,modelled:0,refused:{},testMonths:0,negativeDifferentials:0,abovePermit:0},readiness});
  if(!h10||!h10.months.length)return empty('No H-10 months; nothing to reconcile.');
  if(!well.surfaceBasis)return empty(SURFACE_BASIS_PROMPT);
  const basis=well.surfaceBasis.value,permitPsi=finite(permit.surfacePsi)&&permit.surfacePsi>0?permit.surfacePsi:null;
  const jTests:TestEstimate[]=(j?.tests??[]).filter(t=>t.month!==null&&t.status!=='unmatched'&&t.date!==null&&finite(t.depthFt)&&finite(t.reportedPsi)&&tests.records.some(r=>r.key===t.key)&&tests.decisions[t.key]?.include===true);
  const rows=h10.months.map((m:MonthRecord):MonthRow=>{
    const status:MonthRow['status']=m.gap?'gap':h10.decisions[m.month]?.include===true?'included':'excluded';
    const why=status==='gap'?R.gap:R.excluded;
    const row:MonthRow={month:m.month,status,rateBpd:m.rateBpd,avgPsi:m.avgPsi,maxPsi:m.maxPsi,surfacePsia:null,regulatory:{marginPsi:null,reason:why,abovePermit:false},
      modelled:{pwfPsia:null,hydroPsi:null,frictionPsi:null,band:null,reason:why},permitEquivalent:{pwfPsia:null,marginPsi:null,reason:why},declared:{marginPsi:null,reason:why},tests:[]};
    if(status!=='included')return row;
    const injecting=finite(m.rateBpd)&&m.rateBpd>0;
    row.regulatory=permitPsi===null?{marginPsi:null,reason:R.noPermit,abovePermit:false}:!injecting?{marginPsi:null,reason:R.notApplicable,abovePermit:false}:
      !finite(m.maxPsi)?{marginPsi:null,reason:R.noMax,abovePermit:false}:{marginPsi:permitPsi-m.maxPsi,reason:null,abovePermit:permitPsi-m.maxPsi<0};
    const refuse=(reason:string)=>{row.modelled={pwfPsia:null,hydroPsi:null,frictionPsi:null,band:null,reason};};
    if(depth.depthFt===null)refuse(R.noDepth);
    else if(!injecting)refuse(R.noInjection);
    else if(!finite(m.avgPsi))refuse(R.noAvg);
    else{
      const d=depth.depthFt,q=m.rateBpd!,surfacePsia=toAbsolute(m.avgPsi,basis);row.surfacePsia=surfacePsia;
      const f=model(deps,d,a,q,m.avgPsi,basis);
      if('reason' in f)refuse(f.reason);
      else row.modelled={pwfPsia:f.pwf,hydroPsi:f.hydro,frictionPsi:f.friction,band:f.band,reason:null};
    }
    const pwf=row.modelled.pwfPsia;
    if(pwf===null){row.permitEquivalent={pwfPsia:null,marginPsi:null,reason:R.noModel};row.declared={marginPsi:null,reason:R.noModel};}
    else{
      if(permitPsi===null)row.permitEquivalent={pwfPsia:null,marginPsi:null,reason:R.noPermit};
      else{const pe=run(deps,depth.depthFt!,a,m.rateBpd!,toAbsolute(permitPsi,basis));row.permitEquivalent='reason' in pe?{pwfPsia:null,marginPsi:null,reason:pe.reason}:{pwfPsia:pe.pwf,marginPsi:pe.pwf-pwf,reason:null};}
      row.declared=declaredLimit===null?{marginPsi:null,reason:R.noLimit}:Math.abs(declaredLimit.depthFt-depth.depthFt!)>LIMIT_DATUM_TOLERANCE_FT?{marginPsi:null,reason:R.limitDatum}:{marginPsi:declaredLimit.psia-pwf,reason:null};
    }
    row.tests=jTests.filter(t=>t.month===m.month).map((t):TestMonth=>{
      const out:TestMonth={key:t.key,date:t.date!,depthFt:t.depthFt!,reportedPsi:t.reportedPsi!,pResPsia:null,differentialPsi:null,band:null,negative:false,reason:null,
        testGradientPsiFt:t.reportedPsi!/t.depthFt!,columnGradientPsiFt:row.modelled.hydroPsi===null?null:row.modelled.hydroPsi/depth.depthFt!,checklist:[]};
      if(pwf===null)return {...out,reason:R.noModel};
      if(!j!.basis)return {...out,reason:R.bhpBasis};
      if(Math.abs(t.depthFt!-depth.depthFt!)>DEPTH_TOLERANCE_FT)return {...out,reason:R.testDepth};
      const pRes=toAbsolute(t.reportedPsi!,j!.basis.value);
      let at:{pwf:number;hydro:number;band:Band|null};
      if(t.depthFt===depth.depthFt)at={pwf,hydro:row.modelled.hydroPsi!,band:row.modelled.band};
      else{
        const g=model(deps,t.depthFt!,a,m.rateBpd!,m.avgPsi!,basis);
        if('reason' in g)return {...out,reason:g.reason};
        at={pwf:g.pwf,hydro:g.hydro,band:g.band};
      }
      const diff=at.pwf-pRes,band=at.band;
      return {...out,pResPsia:pRes,differentialPsi:diff,band:band?{min:band.min-pRes,max:band.max-pRes}:null,negative:diff<0,checklist:diff<0?[...CAUSE_CHECKLIST]:[],
        columnGradientPsiFt:at.hydro/t.depthFt!};
    });
    return row;
  });
  const inc=rows.filter(r=>r.status==='included'),refused:Record<string,number>={};
  for(const r of inc)if(r.modelled.pwfPsia===null)refused[r.modelled.reason!]=(refused[r.modelled.reason!]??0)+1;
  const counts:ReconCounts={months:rows.length,included:inc.length,modelled:inc.filter(r=>r.modelled.pwfPsia!==null).length,refused,testMonths:rows.filter(r=>r.tests.length>0).length,
    negativeDifferentials:rows.reduce((s,r)=>s+r.tests.filter(t=>t.negative).length,0),abovePermit:rows.filter(r=>r.regulatory.abovePermit).length};
  return {...head,notes:[...head.notes],rows,
    summary:{minRegulatoryPsi:minOf(inc.map(r=>r.regulatory.marginPsi)),minPermitEquivalentPsi:minOf(inc.map(r=>r.permitEquivalent.marginPsi)),minDeclaredPsi:minOf(inc.map(r=>r.declared.marginPsi))},
    counts,readiness:`${counts.modelled} of ${counts.included} included months modelled at ${depth.depthFt===null?'no report depth':`${depth.depthFt} ft (${depth.source})`}.`};
}
