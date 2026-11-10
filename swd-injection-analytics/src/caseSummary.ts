import type {DisposalCase} from './disposalCase.js';
export const CASE_SUMMARY_VERSION='case-summary/1';
export const CLOSING_LINE='Screening estimate from assumed inputs; not proven field capacity.';
export const BANNED=/\b(proven|sustainable|calibrated|validated|safe)\b/i;
export type SummaryRule='A1'|'A2'|'A3'|'A4'|'A5'|'A6'|'A7'|'A8';
export type Cite={label:string;value:number|string|null;unit:string};
export type SummaryLine={rule:SummaryRule;text:string;cites:Cite[];method:string|null};
/** Round to `digits` decimals, then group with fixed 'en-US' rules; U+2212 marks negatives. */
export function fmtNumber(v:number,digits=0):string{
 const scale=10**digits,r=Math.round(Math.abs(v)*scale)/scale*Math.sign(v);
 const body=Math.abs(r).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
 return (r<0?'\u2212':'')+body;
}
const fmtSigned=(v:number)=>(v>0?'+':'')+fmtNumber(v);
const plural=(n:number)=>n===1?'':'s';
/** Rule-based, deterministic summary of a calculated disposal case. `extras` is reserved for later rules (A6, A7) and ignored here. */
export function caseSummary(result:DisposalCase,_extras?:{history?:unknown;performance?:unknown}):SummaryLine[]{
 const lines:SummaryLine[]=[],base=result.base,months=base.monthly;
 const short=months.filter(m=>m.shortfallBbl>0),first=short[0];
 if(!first)lines.push({rule:'A1',text:'All demand is placed in every month.',cites:[],method:result.methods.allocation});
 else lines.push({rule:'A1',text:`Unplaced water starts in ${first.month}: ${fmtNumber(base.totalShortfallBbl)} bbl over ${short.length} month${plural(short.length)}.`,cites:[{label:`Demand ${first.month}`,value:first.demandBbl,unit:'bbl'},{label:`Capacity ${first.month}`,value:first.capacityBbl,unit:'bbl'}],method:result.methods.allocation});
 const a2=base.wells.map(w=>{const c=w.capacity.limitingConstraints;return c.length?`${w.well.id} is limited by its ${c.join(' and ')}`:`${w.well.id} has no single binding limit`;}).join('; ')+'.';
 lines.push({rule:'A2',text:a2,cites:base.wells.map(w=>({label:`${w.well.id} maximum capacity`,value:w.capacity.maximumStbd,unit:'STB/day'})),method:result.methods.capacity});
 const bad=base.wells.map(w=>{
  const hits=months.map(m=>({month:m.month,a:m.allocations.find(x=>x.wellId===w.well.id&&!x.operatingFeasible)})).filter(h=>h.a);
  return {id:w.well.id,hits};
 }).filter(w=>w.hits.length>0);
 lines.push({rule:'A3',text:bad.length?bad.map(w=>`${w.id}: ${w.hits.length} month${plural(w.hits.length)} need a pressure the model does not support (first ${w.hits[0].month}: ${w.hits[0].a!.reason}).`).join(' '):'No unsupported allocated pressures in the base case.',cites:bad.map(w=>({label:`${w.id} unsupported months`,value:w.hits.length,unit:'months'})),method:result.methods.surface});
 const least=months.reduce((b,m)=>m.headroomBbl<b.headroomBbl?m:b,months[0]);
 lines.push({rule:'A4',text:`Least spare capacity: ${least.month}, ${fmtNumber(least.headroomBbl)} bbl.`,cites:[{label:`Headroom ${least.month}`,value:least.headroomBbl,unit:'bbl'}],method:null});
 const c=result.inputs.comparison,delta=result.compared.totalShortfallBbl-base.totalShortfallBbl;
 lines.push({rule:'A5',text:`The compared case (${c.wellId}: J × ${c.injectivityMultiplier}, ID ${c.innerDiameterInches} in, availability ${c.availability}) moves the first shortfall from ${base.firstShortfallMonth??'none'} to ${result.compared.firstShortfallMonth??'none'} and changes unplaced water by ${fmtSigned(delta)} bbl.`,cites:[{label:'Base unplaced water',value:base.totalShortfallBbl,unit:'bbl'},{label:'Compared unplaced water',value:result.compared.totalShortfallBbl,unit:'bbl'}],method:null});
 lines.push({rule:'A8',text:CLOSING_LINE,cites:[],method:null});
 return lines;
}
