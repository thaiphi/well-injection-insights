import {joinedHistory} from './historyPackages.js';
import type {PackageSet} from './historyPackages.js';

export const OFFSET_HISTORY_VERSION='offset-history/1';
export const MAX_OFFSET_MONTHS=600;
export type AfterChoice={kind:'shut-in'}|{kind:'hold-average';lastN:number}|{kind:'typed';rateStbd:number};
export type OffsetChoices={uic:string;distanceFt:number;connected:boolean|null;zerosAreShutIn:boolean;gapRates:Readonly<Record<string,number>>;
  prior:{startMonth:string;rateStbd:number}|null;after:AfterChoice|null};
export type OffsetStatus='complete'|'incomplete'|'excluded';
export type OffsetSchedule={uic:string;status:OffsetStatus;gapMonths:string[];partialHistory:boolean;windowStart:string;windowEnd:string;
  steps:{month:string;rateStbd:number;origin:'reported'|'assumed-gap'|'assumed-prior'|'assumed-after'}[];afterLabel:string|null;labels:string[]};

const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const index=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
const fromIndex=(i:number)=>`${String(Math.floor(i/12)).padStart(4,'0')}-${String(i%12+1).padStart(2,'0')}`;
const nonNegative=(v:unknown,what:string)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new Error(`${what} must be a number of at least 0`);return v;};

export function offsetSchedule(set:PackageSet,c:OffsetChoices,throughMonth:string):OffsetSchedule{
  if(!MONTH.test(throughMonth)) throw new Error(`throughMonth must be YYYY-MM, got ${throughMonth}`);
  const jh=joinedHistory(set,c.uic);
  const wStart=jh.window.startMonth,wEnd=jh.window.endMonth;
  const base={uic:c.uic,windowStart:wStart,windowEnd:wEnd};
  if(c.connected===false) return {...base,status:'excluded',gapMonths:[],partialHistory:!c.prior,steps:[],afterLabel:null,labels:[]};
  if(index(throughMonth)<index(wStart)) throw new Error(`ranking month ${throughMonth} is before the reported window of ${c.uic} (${wStart})`);
  if(c.prior){
    if(!MONTH.test(c.prior.startMonth)) throw new Error('prior.startMonth must be YYYY-MM');
    nonNegative(c.prior.rateStbd,'Prior rate');
    if(index(c.prior.startMonth)>=index(wStart)) throw new Error(`Prior start month ${c.prior.startMonth} must be before the window start ${wStart}`);
  }
  if(c.after?.kind==='typed') nonNegative(c.after.rateStbd,'After-window rate');
  if(c.after?.kind==='hold-average'&&!(Number.isInteger(c.after.lastN)&&c.after.lastN>=1)) throw new Error('lastN must be a whole number of at least 1');
  for(const [m,v] of Object.entries(c.gapRates)) nonNegative(v,`Gap rate for ${m}`);
  const first=index(c.prior?c.prior.startMonth:wStart),last=index(throughMonth);
  if(last-first+1>MAX_OFFSET_MONTHS) throw new Error(`Offset schedule would span ${last-first+1} months; at most ${MAX_OFFSET_MONTHS}`);

  const rateByMonth=new Map<string,number|null>();
  for(const r of jh.monthly){const m=r.period_start.slice(0,7);rateByMonth.set(m,r.calculated_calendar_day_avg_bpd);}
  const stateByMonth=new Map(jh.months.map(x=>[x.month,x.state]));
  const steps:OffsetSchedule['steps']=[];
  const gapMonths:string[]=[];
  let incomplete=false;
  const reportedUsable:{month:string;rate:number}[]=[];
  const lastWindow=Math.min(last,index(wEnd));

  if(c.prior) for(let i=index(c.prior.startMonth);i<=Math.min(last,index(wStart)-1);i++) steps.push({month:fromIndex(i),rateStbd:c.prior.rateStbd,origin:'assumed-prior'});

  for(let i=index(wStart);i<=lastWindow;i++){
    const month=fromIndex(i),state=stateByMonth.get(month),rate=rateByMonth.get(month);
    if(state==='reported'&&typeof rate==='number'){steps.push({month,rateStbd:rate,origin:'reported'});reportedUsable.push({month,rate});continue;}
    if(state==='reported-zero'&&c.zerosAreShutIn){steps.push({month,rateStbd:0,origin:'reported'});reportedUsable.push({month,rate:0});continue;}
    gapMonths.push(month);
    const g=c.gapRates[month];
    if(typeof g==='number') steps.push({month,rateStbd:g,origin:'assumed-gap'});else incomplete=true;
  }
  // Fill-ins of gap months are in order already because each month is visited once, in order.

  let afterLabel:string|null=null;
  if(last>index(wEnd)){
    const a=c.after;
    if(!a) incomplete=true;
    else {
      let rate:number|null=null;
      if(a.kind==='shut-in'){rate=0;afterLabel='assumed, shut in after last report';}
      else if(a.kind==='typed'){rate=a.rateStbd;afterLabel=`assumed, typed rate ${a.rateStbd} stb/d after last report`;}
      else {
        const use=reportedUsable.slice(-a.lastN);
        if(use.length<a.lastN) incomplete=true;
        else {
          rate=use.reduce((s,x)=>s+x.rate,0)/use.length;
          const span=index(use[use.length-1].month)-index(use[0].month)+1;
          afterLabel=`assumed, from reported months ${use[0].month}\u2013${use[use.length-1].month}`+(span===use.length?'':` (${use.length} months used)`);
        }
      }
      if(rate!==null) for(let i=index(wEnd)+1;i<=last;i++) steps.push({month:fromIndex(i),rateStbd:rate,origin:'assumed-after'});
    }
  }
  const labels:string[]=[];
  if(steps.some(s=>s.origin==='reported')) labels.push('reported, public H-10 monthly volumes');
  if(steps.some(s=>s.origin==='assumed-gap')) labels.push('assumed, typed rates for gap months');
  if(steps.some(s=>s.origin==='assumed-prior')) labels.push('assumed, typed rate before the reported window');
  if(afterLabel&&steps.some(s=>s.origin==='assumed-after')) labels.push(afterLabel);
  return {...base,status:incomplete?'incomplete':'complete',gapMonths,partialHistory:!c.prior,steps,afterLabel:steps.some(s=>s.origin==='assumed-after')?afterLabel:null,labels};
}
