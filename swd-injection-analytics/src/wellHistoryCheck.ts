import type {DisposalCase} from './disposalCase.js';
import {diagnoseMonthly} from './h10Diagnostics.js';
import type {PublicMonthly} from './publicArtifact.js';
import {toAbsolute} from './wellAssumptions.js';
import type {Basis,BasisConfirmation} from './wellAssumptions.js';
import {fmtNumber} from './caseSummary.js';

/** Screening comparison of a well's reported H-10 history with the base-case forecast. Reported monthly figures only; not a pressure match, calibration or capacity proof. */
export const HISTORY_CHECK_VERSION='history-vs-forecast/1';
export const NO_HISTORY='Cannot be checked: no H-10 history loaded for this well.';
export const PRESSURE_NOT_CHECKED="Pressure not checked: confirm this well's H-10 pressure basis (psig or psia).";
export const RATE_CAVEAT='Reported pressures are monthly figures at other rates; this is not a pressure match.';
export type HistoryLink={wellId:string;label:string;uic:string;monthly:readonly PublicMonthly[];surfaceBasis:BasisConfirmation|null};
export type HistoryStatus='within'|'above'|'cannot-check'|'no-injection';
export type PressureCheck={status:'not-checked'|'above-reported'|'not-above';month:string|null;requiredSurfacePsia:number|null;highestReportedPsia:number|null;highestReportedMonth:string|null;basis:Basis|null;note:string};
export type WellHistoryCheck={wellId:string;label:string|null;uic:string|null;status:HistoryStatus;reason:string;includedMonths:number;
 peakReported:{month:string;rateBpd:number}|null;peakForecast:{month:string;averageStbd:number;onstreamStbd:number}|null;
 ratio:number|null;historyMonthsAtOrAbovePeakForecast:number|null;forecastMonthsAbovePeakReported:number|null;onstreamNote:string|null;
 pressure:PressureCheck;series:{reported:{month:string;bbl:number|null;gap:boolean;included:boolean}[];forecast:{month:string;bbl:number}[]}};

const plural=(n:number)=>n===1?'':'s';
/** Ratio with two decimals; a ratio above 1 that would round to "1.00" prints ">1.00". */
export function fmtRatio(ratio:number):string{const t=fmtNumber(ratio,2);return ratio>1&&t==='1.00'?'>1.00':t;}
const notChecked=(note:string):PressureCheck=>({status:'not-checked',month:null,requiredSurfacePsia:null,highestReportedPsia:null,highestReportedMonth:null,basis:null,note});
export function checkWellHistory(base:DisposalCase['base'],links:readonly HistoryLink[]):WellHistoryCheck[]{
 return base.wells.map(w=>{
  const id=w.well.id,link=links.find(l=>l.wellId===id);
  const empty=(status:HistoryStatus,reason:string,extra:Partial<WellHistoryCheck>={},pnote='Pressure not compared: no usable history month.'):WellHistoryCheck=>({wellId:id,label:link?.label??null,uic:link?.uic??null,status,reason,includedMonths:0,peakReported:null,peakForecast:null,ratio:null,historyMonthsAtOrAbovePeakForecast:null,forecastMonthsAbovePeakReported:null,onstreamNote:null,pressure:link&&link.surfaceBasis?{...notChecked(pnote),basis:link.surfaceBasis.value}:notChecked(PRESSURE_NOT_CHECKED),series:{reported:[],forecast:[]},...extra});
  if(!link)return empty('cannot-check',NO_HISTORY);
  if(!link.monthly.length)return empty('cannot-check','Cannot be checked: no H-10 monthly rows.');
  const state=diagnoseMonthly(link.monthly);
  const included=state.months.filter(m=>!m.gap&&state.decisions[m.month]?.include&&m.rateBpd!==null&&m.rateBpd>0);
  const incl=new Set(included.map(m=>m.month));
  const reported=state.months.map(m=>({month:m.month,bbl:m.injectedBbl,gap:m.gap,included:incl.has(m.month)}));
  const allocs=base.monthly.map(m=>({month:m.month,a:m.allocations.find(x=>x.wellId===id)})).filter((x):x is {month:string;a:NonNullable<typeof x.a>}=>x.a!==undefined);
  const forecast=allocs.map(x=>({month:x.month,bbl:x.a.allocatedBbl}));
  const series={reported,forecast};
  if(!state.months.some(m=>!m.gap&&((m.injectedBbl??0)>0||m.sourceRowKeys.length>1)))return empty('no-injection','No injection reported in the loaded H-10 history.',{series});
  if(!included.length)return empty('cannot-check','Cannot be checked: no H-10 month passes the default inclusions.',{series});
  if(!allocs.length)return empty('cannot-check','Cannot be checked: no forecast allocation for this well.',{series},'Pressure not compared: no forecast allocation for this well.');
  let pr=included[0];for(const m of included)if((m.rateBpd as number)>(pr.rateBpd as number))pr=m;
  let pf=allocs[0];for(const x of allocs)if(x.a.averageStbd>pf.a.averageStbd)pf=x;
  const peakReported={month:pr.month,rateBpd:pr.rateBpd as number};
  const peakForecast={month:pf.month,averageStbd:pf.a.averageStbd,onstreamStbd:pf.a.onstreamStbd};
  const ratio=peakForecast.averageStbd/peakReported.rateBpd;
  const status:HistoryStatus=ratio<=1?'within':'above';
  const historyMonthsAtOrAbovePeakForecast=included.filter(m=>(m.rateBpd as number)>=peakForecast.averageStbd).length;
  const forecastMonthsAbovePeakReported=allocs.filter(x=>x.a.averageStbd>peakReported.rateBpd).length;
  const counts=`${fmtNumber(historyMonthsAtOrAbovePeakForecast)} of ${fmtNumber(included.length)} included history month${plural(included.length)} at or above the peak forecast rate; ${fmtNumber(forecastMonthsAbovePeakReported)} of ${fmtNumber(allocs.length)} forecast month${plural(allocs.length)} above the reported peak.`;
  const reason=status==='within'
   ?`Within reported history: peak forecast ${fmtNumber(peakForecast.averageStbd)} STB/day vs highest reported ${fmtNumber(peakReported.rateBpd)} bbl/day treated as STB/day (${peakReported.month}); ${counts}`
   :`${fmtRatio(ratio)}× the highest reported month (${fmtNumber(peakReported.rateBpd)} bbl/day treated as STB/day, ${peakReported.month}); not shown in reported history. ${counts}`;
  const onstreamNote=w.well.availability<1?`Onstream rate ${fmtNumber(peakForecast.onstreamStbd)} STB/day while available; H-10 monthly data cannot show onstream rates.`:null;
  let pressure:PressureCheck;
  if(!link.surfaceBasis)pressure=notChecked(PRESSURE_NOT_CHECKED);
  else{
   const basis=link.surfaceBasis.value;
   const withMax=included.filter(m=>m.maxPsi!==null);
   if(!withMax.length)pressure={...notChecked('No reported maximum pressure in the included months.'),basis};
   else{
    let hm=withMax[0];for(const m of withMax)if((m.maxPsi as number)>(hm.maxPsi as number))hm=m;
    const highest=toAbsolute(hm.maxPsi as number,basis);
    const req=allocs.filter(x=>x.a.onstreamStbd>0&&x.a.hydraulics.requiredSurfacePsia!==null);
    if(!req.length)pressure={...notChecked('No supported required surface pressure in the forecast.'),basis,highestReportedPsia:highest,highestReportedMonth:hm.month};
    else{
     let rq=req[0];for(const x of req)if((x.a.hydraulics.requiredSurfacePsia as number)>(rq.a.hydraulics.requiredSurfacePsia as number))rq=x;
     const required=rq.a.hydraulics.requiredSurfacePsia as number,above=required>highest;
     pressure={status:above?'above-reported':'not-above',month:rq.month,requiredSurfacePsia:required,highestReportedPsia:highest,highestReportedMonth:hm.month,basis,
      note:above?`Requires more surface pressure (${fmtNumber(required)} psia, ${rq.month}) than any reported month (${fmtNumber(highest)} psia, ${hm.month}).`:RATE_CAVEAT};
    }
   }
  }
  return {wellId:id,label:link.label,uic:link.uic,status,reason,includedMonths:included.length,peakReported,peakForecast,ratio,
   historyMonthsAtOrAbovePeakForecast,forecastMonthsAbovePeakReported,onstreamNote,pressure,series};
 });
}
