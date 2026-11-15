import type {PublicArtifact,PublicMonthly} from './publicArtifact.js';

export const HISTORY_PACKAGES_VERSION='history-packages/1';
export const MAX_UICS=10, MAX_PACKAGES_PER_UIC=20;
export type HistoryWindow={startMonth:string;endMonth:string;source:'acquisition'|'rows'};
export type LoadedPackage={artifactId:string;manifestSha256:string;uic:string;window:HistoryWindow;monthly:readonly PublicMonthly[]};
export type PackageSet={readonly packages:readonly LoadedPackage[]};
export const EMPTY_PACKAGE_SET:PackageSet=Object.freeze({packages:Object.freeze([]) as readonly LoadedPackage[]});

type Verified={artifact:PublicArtifact;pin:{artifactId:string;manifestSha256:string};calculationEligibility:{ready:boolean;reasons:string[]}};
const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const monthOf=(s:unknown)=>typeof s==='string'&&MONTH.test(s.slice(0,7))?s.slice(0,7):null;
const index=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
const fromIndex=(i:number)=>`${String(Math.floor(i/12)).padStart(4,'0')}-${String(i%12+1).padStart(2,'0')}`;

export function packageFromVerified(v:Verified):LoadedPackage{
  const {artifact,pin,calculationEligibility}=v;
  if(!calculationEligibility.ready) throw new Error('Package not calculation-ready: '+calculationEligibility.reasons.join('; '));
  const uicSet=new Set<string>([...artifact.inventory.map(r=>r.uic_number),...artifact.injectionMonthly.map(r=>r.uic_number)]);
  if(uicSet.size>1) throw new Error(`Package ${pin.artifactId} contains more than one UIC: ${[...uicSet].sort().join(', ')}`);
  if(!artifact.inventory.length) throw new Error(`Package ${pin.artifactId} has no inventory rows`);
  const uic=artifact.inventory[0].uic_number;
  const scope=(artifact.manifest as {scope?:{start?:unknown;end?:unknown}}).scope;
  const s=monthOf(scope?.start),e=monthOf(scope?.end);
  let window:HistoryWindow;
  if(s&&e) window={startMonth:s,endMonth:e,source:'acquisition'};
  else {
    const ms=artifact.injectionMonthly.map(r=>monthOf(r.period_start)).filter((m):m is string=>m!==null).sort();
    if(!ms.length) throw new Error(`Package ${pin.artifactId} has no acquisition window and no monthly rows`);
    window={startMonth:ms[0],endMonth:ms[ms.length-1],source:'rows'};
  }
  if(index(window.endMonth)<index(window.startMonth)) throw new Error(`Package ${pin.artifactId} has an inverted window`);
  const monthly=[...artifact.injectionMonthly].sort((a,b)=>a.period_start<b.period_start?-1:a.period_start>b.period_start?1:0);
  return {artifactId:pin.artifactId,manifestSha256:pin.manifestSha256,uic,window,monthly};
}

export function addPackage(set:PackageSet,p:LoadedPackage):PackageSet{
  for(const q of set.packages){
    if(q.artifactId===p.artifactId) throw new Error(`Package ${p.artifactId} is already loaded`);
    if(q.manifestSha256===p.manifestSha256) throw new Error(`Package ${p.artifactId} duplicates loaded manifest ${p.manifestSha256}`);
  }
  const same=set.packages.filter(q=>q.uic===p.uic);
  for(const q of same){
    if(index(p.window.startMonth)<=index(q.window.endMonth)&&index(q.window.startMonth)<=index(p.window.endMonth))
      throw new Error(`Package ${p.artifactId} window ${p.window.startMonth}..${p.window.endMonth} overlaps ${q.artifactId} for UIC ${p.uic}`);
  }
  if(!same.length&&new Set(set.packages.map(q=>q.uic)).size>=MAX_UICS) throw new Error(`Cannot add UIC ${p.uic}: at most ${MAX_UICS} UICs`);
  if(same.length>=MAX_PACKAGES_PER_UIC) throw new Error(`Cannot add package ${p.artifactId}: at most ${MAX_PACKAGES_PER_UIC} packages for UIC ${p.uic}`);
  return {packages:Object.freeze([...set.packages,p])};
}

export function removePackage(set:PackageSet,artifactId:string):PackageSet{
  return {packages:Object.freeze(set.packages.filter(p=>p.artifactId!==artifactId))};
}

export function uics(set:PackageSet):string[]{return [...new Set(set.packages.map(p=>p.uic))].sort();}

export type MonthState='reported'|'reported-zero'|'gap';
export type JoinedHistory={uic:string;packages:readonly LoadedPackage[];window:{startMonth:string;endMonth:string};monthly:readonly PublicMonthly[];
  months:readonly {month:string;state:MonthState}[];counts:{reported:number;reportedZero:number;gap:number}};

export function joinedHistory(set:PackageSet,uic:string):JoinedHistory{
  const packages=set.packages.filter(p=>p.uic===uic).sort((a,b)=>a.window.startMonth<b.window.startMonth?-1:a.window.startMonth>b.window.startMonth?1:0);
  if(!packages.length) throw new Error(`UIC ${uic} is not in the package set`);
  const monthly=packages.flatMap(p=>p.monthly);
  const startMonth=packages[0].window.startMonth;
  const endMonth=packages.reduce((m,p)=>p.window.endMonth>m?p.window.endMonth:m,packages[0].window.endMonth);
  const byMonth=new Map<string,number|null>();
  for(const r of monthly){const m=monthOf(r.period_start);if(m)byMonth.set(m,r.injected_liquid_bbl);}
  const counts={reported:0,reportedZero:0,gap:0};
  const months:{month:string;state:MonthState}[]=[];
  for(let i=index(startMonth);i<=index(endMonth);i++){
    const month=fromIndex(i),v=byMonth.get(month);
    const state:MonthState=typeof v==='number'&&v>0?'reported':v===0?'reported-zero':'gap';
    if(state==='reported')counts.reported++;else if(state==='reported-zero')counts.reportedZero++;else counts.gap++;
    months.push({month,state});
  }
  return {uic,packages,window:{startMonth,endMonth},monthly,months,counts};
}
