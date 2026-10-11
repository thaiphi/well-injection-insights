/** Evidence confirmation does not imply numerical eligibility. Imported evidence fails closed. */
export function explorerCalculationGate(selection,{imported=false}={}){
  if(!selection?.artifact)return {ready:false,reasons:['Explorer evidence is unavailable or failed verification.']};
  if(!imported)return {ready:true,reasons:['Pinned artifact identity, hash and strict calculation contract verified.']};
  const eligibility=selection.calculationEligibility;
  if(eligibility?.ready===true&&Array.isArray(eligibility.reasons)&&eligibility.reasons.length===0)return {ready:true,reasons:['Package integrity, recorded source evidence and strict calculation contract checked. Offline source authentication is not established.']};
  return {ready:false,reasons:['Inspection only: this preserved evidence is not eligible for public-history calculations or result exports.',...(Array.isArray(eligibility?.reasons)&&eligibility.reasons.length?eligibility.reasons:['Calculation eligibility has not been established.']),'Inspect retained rows and quality dispositions. Obtain a corrected complete version; no accepted-row subset is silently substituted.']};
}
export function explorerRowDisposition(artifact,row){
  const dispositions=artifact?.qualityReport?.dispositions??[];
  const disposition=dispositions.find(value=>value.source_row_key===row.source_row_key);
  return disposition?`${disposition.disposition}${disposition.reasons?.length?`: ${disposition.reasons.join(', ')}`:''}`:'See quality report';
}
