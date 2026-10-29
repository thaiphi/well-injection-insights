import { daysInMonth, monthIndex, monthsBetween } from './planning.js';
import type { PublicMonthly } from './publicArtifact.js';

/** Screening-only review of monthly H-10 reports: the system flags months, the user decides which are comparable. Never BHP, J, damage or capacity. */
export const H10_DIAGNOSTICS_VERSION='h10-diagnostics/1';
export const LOW_RATE_FRACTION=0.25;
export const MIN_COMPARABLE_MONTHS=3;
export const MAX_REASON_LENGTH=200;
export const LABEL_SURFACE='Surface-reported pressure (basis as reported), not bottomhole pressure';
export const LABEL_SCREENING='Screening indicator only; not an injectivity index (J)';
export type FlagCode='before-first-injection'|'no-volume'|'no-average-pressure'|'low-rate'|'max-below-average'|'duplicate-report';
export const FLAG_REASONS:Readonly<Record<FlagCode,string>>=Object.freeze({
  'before-first-injection':'No volume reported before the first reported injection; the well was probably not yet injecting.',
  'no-volume':'No injected volume reported this month (shut-in or missing report).',
  'no-average-pressure':'No average injection pressure reported.',
  'low-rate':"Rate is under 25% of this well's median; likely a partial or shut-in month.",
  'max-below-average':'Reported maximum is below the reported average: a reporting inconsistency.',
  'duplicate-report':'More than one report row for this month.',
});
export const FORMULAS=Object.freeze([
  'calendar-day rate (bbl/day) = injected liquid (bbl/month) / calendar days in the month, as carried in the verified artifact',
  'screening ratio (psi per bbl/day) = reported average injection pressure (psi) / calendar-day rate (bbl/day)',
  'low-rate threshold = 0.25 x median positive calendar-day rate of single-report months',
]);
export const LIMITATIONS=Object.freeze([LABEL_SURFACE,LABEL_SCREENING,
  'Monthly calendar-day averages are not observed daily or stabilized test rates.',
  'Missing reports are gaps, never zero; nothing is interpolated.',
  'Month decisions are the user\'s screening choices, recorded with reasons; they are not data corrections.',
  'No reservoir pressure, injectivity index, damage, integrity or capacity is inferred.']);
export const CHECKLIST=Object.freeze([
  {cause:'Reservoir pressure buildup',evidence:'Repeated bottomhole or static pressure tests at the same depth and datum'},
  {cause:'Near-wellbore damage or skin',evidence:'Pressure transient or step-rate tests; treatment history'},
  {cause:'Fluid viscosity or density change',evidence:'Water analyses and temperature over time'},
  {cause:'Tubing friction or geometry',evidence:'Completion records, tubing size and rate-dependent surface pressure'},
  {cause:'Mechanical restriction',evidence:'Workover, scale or fill records; tubing inspection'},
  {cause:'Reporting quality',evidence:'Original filings, revisions and the month review above'},
  {cause:'Competing nearby injection',evidence:'H-10 histories of nearby wells (selected explicitly) and their timing'},
]);
export type MonthRecord={month:string;gap:boolean;sourceRowKeys:string[];injectedBbl:number|null;calendarDays:number;rateBpd:number|null;avgPsi:number|null;maxPsi:number|null;flags:FlagCode[];usable:boolean};
export type Decision={include:boolean;reason:string|null;byUser:boolean};
export type DiagnosticsState={version:typeof H10_DIAGNOSTICS_VERSION;months:MonthRecord[];medianRateBpd:number|null;decisions:Readonly<Record<string,Decision>>};
export type ScreeningPoint={month:string;rateBpd:number;avgPsi:number;ratio:number};
export type Screening={points:ScreeningPoint[];enough:boolean;needed:number};
export type Coverage={firstMonth:string;lastMonth:string;spanMonths:number;reportedMonths:number;gapMonths:string[];flaggedMonths:number;includedMonths:number;comparableMonths:number;medianRateBpd:number|null;lowRateEvaluated:boolean};

const positive=(v:number|null):v is number=>v!==null&&Number.isFinite(v)&&v>0;
function median(values:number[]):number|null {
  if(!values.length) return null;
  const s=[...values].sort((a,b)=>a-b),mid=Math.floor(s.length/2);
  return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
}

export function diagnoseMonthly(rows:readonly PublicMonthly[]):DiagnosticsState {
  if(!rows.length) throw new Error('No H-10 monthly rows to diagnose');
  const byMonth=new Map<string,PublicMonthly[]>();
  for(const row of rows) {
    const month=String(row.period_start).slice(0,7);monthIndex(month);
    const list=byMonth.get(month);if(list) list.push(row);else byMonth.set(month,[row]);
  }
  const keys=[...byMonth.keys()].sort();
  const base:MonthRecord[]=monthsBetween(keys[0],keys[keys.length-1]).map(month=>{
    const list=byMonth.get(month)??[],one=list.length===1?list[0]:null;
    return {month,gap:list.length===0,sourceRowKeys:list.map(r=>r.source_row_key),injectedBbl:one?one.injected_liquid_bbl:null,calendarDays:daysInMonth(month),
      rateBpd:one?one.calculated_calendar_day_avg_bpd:null,avgPsi:one?one.reported_avg_injection_pressure_psi:null,maxPsi:one?one.reported_max_injection_pressure_psi:null,flags:[],usable:false};
  });
  const single=(m:MonthRecord)=>m.sourceRowKeys.length===1;
  const medianRateBpd=median(base.filter(single).map(m=>m.rateBpd).filter(positive));
  const firstInjection=base.findIndex(m=>(byMonth.get(m.month)??[]).some(r=>positive(r.injected_liquid_bbl)));
  const months=base.map((m,i)=>{
    if(m.gap) return m;
    const flags:FlagCode[]=[];
    if(!single(m)) flags.push('duplicate-report');
    else {
      if(!positive(m.injectedBbl)) flags.push(firstInjection===-1||i<firstInjection?'before-first-injection':'no-volume');
      if(m.avgPsi===null) flags.push('no-average-pressure');
      const rate=m.rateBpd;
      if(medianRateBpd!==null&&positive(rate)&&rate<LOW_RATE_FRACTION*medianRateBpd) flags.push('low-rate');
      if(m.avgPsi!==null&&m.maxPsi!==null&&m.maxPsi<m.avgPsi) flags.push('max-below-average');
    }
    return {...m,flags,usable:single(m)&&positive(m.injectedBbl)&&positive(m.rateBpd)&&m.avgPsi!==null};
  });
  const decisions:Record<string,Decision>={};
  for(const m of months) if(!m.gap) decisions[m.month]={include:m.flags.length===0,reason:null,byUser:false};
  return {version:H10_DIAGNOSTICS_VERSION,months,medianRateBpd,decisions:Object.freeze(decisions)};
}

export function applyDecision(state:DiagnosticsState,month:string,include:boolean,reason?:string|null):DiagnosticsState {
  const record=state.months.find(m=>m.month===month);
  if(!record||record.gap) throw new Error(`Not a reported month: ${month}`);
  const text=(reason??'').trim();
  if(text.length>MAX_REASON_LENGTH) throw new Error(`A reason must be at most ${MAX_REASON_LENGTH} characters`);
  if(!include&&record.flags.length===0&&!text) throw new Error('A reason (1-200 characters) is required to exclude a month the system did not flag');
  return {...state,decisions:Object.freeze({...state.decisions,[month]:{include,reason:include?null:(text||null),byUser:true}})};
}

export function screening(state:DiagnosticsState):Screening {
  const points=state.months.filter(m=>m.usable&&state.decisions[m.month]?.include).map(m=>({month:m.month,rateBpd:m.rateBpd as number,avgPsi:m.avgPsi as number,ratio:(m.avgPsi as number)/(m.rateBpd as number)}));
  return {points,enough:points.length>=MIN_COMPARABLE_MONTHS,needed:MIN_COMPARABLE_MONTHS};
}

export function coverage(state:DiagnosticsState):Coverage {
  const reported=state.months.filter(m=>!m.gap);
  return {firstMonth:state.months[0].month,lastMonth:state.months[state.months.length-1].month,spanMonths:state.months.length,reportedMonths:reported.length,
    gapMonths:state.months.filter(m=>m.gap).map(m=>m.month),flaggedMonths:reported.filter(m=>m.flags.length>0).length,
    includedMonths:reported.filter(m=>state.decisions[m.month]?.include).length,comparableMonths:screening(state).points.length,
    medianRateBpd:state.medianRateBpd,lowRateEvaluated:state.medianRateBpd!==null};
}
