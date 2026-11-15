import type {DisposalCase} from './disposalCase.js';
import {fmtNumber} from './caseSummary.js';
import {joinedHistory,uics} from './historyPackages.js';
import type {HistoryWindow,PackageSet} from './historyPackages.js';
import type {HistoryLink,WellHistoryCheck} from './wellHistoryCheck.js';
import type {BasisConfirmation} from './wellAssumptions.js';

/** Links a case well to a loaded H-10 UIC and assembles read-only comparison rows. Reported history is evidence only; nothing here reads or returns case input. */
export const LINKS_VERSION='case-history-links/1';
export const UNLINKED='No H-10 package linked to this well.';
export const J_SOURCE_ASSUMED='assumed (case input)';
/** Month inclusions behind every linked well's check: E05's diagnoseMonthly default decisions. */
export const INCLUSION_BASIS='default H-10 month inclusions';
export const EVIDENCE_ONLY='Reported history is evidence only; it does not change any case input.';
export type WellLinks=Readonly<Record<string,string>>;

/** Set (or, with null, remove) the UIC linked to a well. A UIC can be linked to one well only. */
export function setLink(links:WellLinks,wellId:string,uic:string|null):WellLinks{
  const next:Record<string,string>={...links};
  if(uic===null){delete next[wellId];return next;}
  for(const [id,u] of Object.entries(links))if(id!==wellId&&u===uic)throw new Error(`UIC ${uic} is already linked to well ${id}`);
  next[wellId]=uic;
  return next;
}

/** Drop links to wells that are not in the case and UICs that are no longer in the package set. */
export function pruneLinks(links:WellLinks,wellIds:readonly string[],set:PackageSet):WellLinks{
  const ids=new Set(wellIds),have=new Set(uics(set));
  const next:Record<string,string>={};
  for(const [id,u] of Object.entries(links))if(ids.has(id)&&have.has(u))next[id]=u;
  return next;
}

export function gapLabel(n:number):string{return `${fmtNumber(n)} gap months in the window; a gap is never zero.`;}

/** One HistoryLink per linked well, in case well order. Unlinked wells are omitted so checkWellHistory reports NO_HISTORY for them. */
export function historyLinksFor(wells:readonly {id:string;label:string}[],links:WellLinks,set:PackageSet,bases:Readonly<Record<string,BasisConfirmation|null>>):HistoryLink[]{
  const out:HistoryLink[]=[];
  for(const w of wells){
    const uic=links[w.id];
    if(uic===undefined)continue;
    out.push({wellId:w.id,label:w.label,uic,monthly:joinedHistory(set,uic).monthly,surfaceBasis:bases[w.id]??null});
  }
  return out;
}

export type ComparedRow={wellId:string;label:string;uic:string|null;coverage:{startMonth:string;endMonth:string;reported:number;reportedZero:number;gap:number}|null;
  gapLabel:string|null;check:WellHistoryCheck|null;jSource:string;inclusionBasis:string|null;packages:{artifactId:string;manifestSha256:string;window:HistoryWindow}[]};

/** One row per case well, in case order. */
export function wellsCompared(result:DisposalCase,links:WellLinks,set:PackageSet,checks:readonly WellHistoryCheck[],jSourceFor:(wellId:string)=>string):ComparedRow[]{
  return result.base.wells.map(bw=>{
    const w=bw.well as {id:string;label?:string};
    const wellId=w.id,label=w.label??w.id,uic=links[wellId]??null;
    const check=checks.find(c=>c.wellId===wellId)??null;
    const jSource=jSourceFor(wellId);
    if(uic===null)return {wellId,label,uic:null,coverage:null,gapLabel:null,check,jSource,inclusionBasis:null,packages:[]};
    const j=joinedHistory(set,uic);
    const coverage={startMonth:j.window.startMonth,endMonth:j.window.endMonth,reported:j.counts.reported,reportedZero:j.counts.reportedZero,gap:j.counts.gap};
    return {wellId,label,uic,coverage,gapLabel:coverage.gap>0?gapLabel(coverage.gap):null,check,jSource,inclusionBasis:INCLUSION_BASIS,
      packages:j.packages.map(p=>({artifactId:p.artifactId,manifestSha256:p.manifestSha256,window:p.window}))};
  });
}
