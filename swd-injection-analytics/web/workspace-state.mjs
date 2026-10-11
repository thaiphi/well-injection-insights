/** UI confirmation lifecycle. Calculators and pinned fixtures remain unchanged. */
export function createImportState(){
 return {inputs:{},result:null,revision:0,
  invalidate(profile){if(profile)delete this.inputs[profile];this.result=null;this.revision++;},
  confirm(profile,input){this.inputs[profile]=structuredClone(input);this.result=null;this.revision++;}
 };
}
/** Normalized positions avoid overflowing the span between finite signed limits. */
export function chartAxis(values){
 if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Chart values must be finite');
 const max=Math.max(1,...values),min=Math.min(0,...values),range=max-min,scale=Math.max(Math.abs(min),max);
 const position=Number.isFinite(range)?v=>(v-min)/range:v=>(v/scale-min/scale)/(max/scale-min/scale);
 const ticks=Array.from({length:5},(_,i)=>Number.isFinite(range)?min+range*(i/4):scale*((min/scale)*(1-i/4)+(max/scale)*(i/4)));
 return {min,max,position,ticks};
}
export function presentationGates(bundle){
 const gates=structuredClone(bundle.readiness);
 const block=(key,reason)=>{gates[key]??={ready:false,reasons:[]};gates[key].ready=false;gates[key].reasons.push(reason);};
 const existing=bundle.inputs.producerIds??[],scheduled=bundle.inputs.planningProducerIds??[];
 if(existing.length&&bundle.methodVersion!=='validated-import-analysis/2')block('groupedPlanning',`Acceptance blocker: existing-producer demand is not reconciled (${existing.join(', ')}). Recalculate with current per-producer contribution lineage.`);
 // Retain a result-level safety gate: a new method label alone cannot prove that
 // every selected producer, group and calendar volume reached the portfolio total.
 if(bundle.methodVersion==='validated-import-analysis/2'&&gates.groupedPlanning?.ready){
  const equal=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b));
  const expected=[...existing,...scheduled];
  let reason=expected.length!==new Set(expected).size?'Existing and scheduled producer identities overlap':null;
  for(const month of bundle.monthly){
   const contributions=bundle.producerMonths?.filter(r=>r.month===month.month)??[];
   if(!expected.length||contributions.length!==expected.length)reason??=`Missing or duplicate producer contributions for ${month.month}`;
   for(const id of expected){
    const rows=contributions.filter(r=>r.producerId===id),row=rows[0],isExisting=existing.includes(id);
    const inputs=(isExisting?bundle.inputs.history:bundle.inputs.schedule)?.rows.filter(r=>r.disposition==='accepted'&&r.value?.producerId===id&&(!isExisting||r.value.month<=bundle.inputs.cutoff))??[];
    if(rows.length!==1||!row||row.contribution!==(isExisting?'frozen-forecast':'assumed-schedule')||!inputs.length||row.sourceRowIds?.length!==inputs.length||inputs.some(r=>!row.sourceRowIds?.includes(r.id)||r.value.groupId!==row.groupId)||isExisting&&row.forecastId!==bundle.frozen?.id||!equal(row.calendarDayRateStbd*month.days,row.volumeBbl)||row.days!==month.days)reason??=`Unreconciled ${id}/${month.month} contribution, units or input lineage`;
   }
   const total=contributions.reduce((sum,r)=>sum+r.volumeBbl,0);
   if(!equal(total,month.demandBbl))reason??=`Producer volumes do not reconcile to demand for ${month.month}`;
   const base=contributions.filter(r=>r.contribution==='frozen-forecast').reduce((sum,r)=>sum+r.volumeBbl,0);
   if(existing.length&&!equal(base,month.forecastBbl))reason??=`Existing contributions do not reconcile to the frozen forecast for ${month.month}`;
   const groups=bundle.groups?.filter(r=>r.month===month.month)??[],groupIds=[...new Set(contributions.map(r=>r.groupId))];
   if(groups.length!==groupIds.length||groupIds.some(id=>groups.filter(r=>r.groupId===id).length!==1||!equal(groups.find(r=>r.groupId===id)?.volumeBbl,contributions.filter(r=>r.groupId===id).reduce((sum,r)=>sum+r.volumeBbl,0))))reason??=`Group volumes do not reconcile for ${month.month}`;
  }
  if(!bundle.monthly.length)reason??='No monthly demand results to reconcile';
  if(reason)block('groupedPlanning',`Acceptance blocker: ${reason}. Recalculate and resolve the portfolio inputs before displaying or exporting total demand.`);
 }
 const fields={forecast:['forecastBbl'],reconciliation:['actualBbl','varianceBbl','variancePct','cumulativeVarianceBbl'],groupedPlanning:['demandBbl'],capacity:['availableCapacityBbl']};
 for(const [key,keys] of Object.entries(fields))if(bundle.monthly.some(row=>keys.some(k=>typeof row[k]==='number'&&!Number.isFinite(row[k]))))block(key,'Non-finite supplied or stale calculation output rejected. Correct the inputs and recalculate before display or export.');
 if(bundle.injectors?.some(i=>Object.values(i.capacity??{}).some(v=>typeof v==='number'&&!Number.isFinite(v))||i.curve?.some(p=>Object.values(p).some(v=>typeof v==='number'&&!Number.isFinite(v)))))block('capacity','Acceptance blocker: injector pressure/capacity overflow. Non-finite engineering results cannot be displayed or exported.');
 gates.comparison={ready:!!gates.groupedPlanning?.ready&&!!gates.capacity?.ready,reasons:[...(gates.groupedPlanning?.reasons??[]),...(gates.capacity?.reasons??[])]};
 return gates;
}
export function tableCsv(metadata,headers,rows){
 const quote=value=>{let s=value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);if(/^[=+@\-\t\r]/.test(s)&&typeof value!=='number')s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const prefix=Object.keys(metadata).length?[...Object.entries(metadata).map(([k,v])=>[k,v]),[]]:[];
 return [...prefix,headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
}
/** Do not distribute known-invalid engine outputs beneath an unrelated ready analysis. */
export function exportEvidence(bundle){
 const copy=structuredClone(bundle);if(!copy?.readiness)return copy;
 const gates=presentationGates(copy);copy.readiness=gates;
 const fields={forecast:['forecastBbl'],reconciliation:['actualBbl','varianceBbl','variancePct','cumulativeVarianceBbl'],groupedPlanning:['demandBbl'],capacity:['availableCapacityBbl'],comparison:['shortfallBbl']};
 for(const row of copy.monthly)for(const[key,keys]of Object.entries(fields))if(!gates[key]?.ready)for(const field of keys)row[field]=null;
 if(!gates.groupedPlanning?.ready){copy.producerMonths=[];copy.groups=[];}
 if(!gates.capacity?.ready)copy.injectors=copy.injectors?.map(i=>({...i,ready:false,capacity:null,curve:null,reason:gates.capacity.reasons.join(' ')}));
 copy.outputPolicy='Blocked analysis outputs are withheld as null; readiness retains the blocking reasons and original inputs remain intact.';
 return copy;
}
