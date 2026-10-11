/** Display aggregation only. Fits and frozen identities remain owned by the engine. */
export function fitDisplayRows(histories,monthly,cutoff){
 const ids=new Set(histories.map(r=>r.producerId)),totals=new Map();
 for(const r of histories.filter(r=>r.month<=cutoff)){
  if(!totals.has(r.month))totals.set(r.month,{volume:0,producers:new Set(),missing:false});
  const item=totals.get(r.month);item.producers.add(r.producerId);
  if(r.volumeBbl===null||r.volumeBbl===undefined)item.missing=true;
  else{item.volume+=r.volumeBbl;if(!Number.isFinite(item.volume))item.missing=true;}
 }
 const index=month=>{const[y,m]=month.split('-').map(Number);return y*12+m-1;},label=i=>`${String(Math.floor(i/12)).padStart(4,'0')}-${String(i%12+1).padStart(2,'0')}`;
 const first=[...totals.keys()].sort()[0],rows=[];
 if(first)for(let i=index(first);i<=index(cutoff);i++){const month=label(i),item=totals.get(month);rows.push([month,!item||item.missing||item.producers.size!==ids.size?null:item.volume,null,null]);}
 return [...rows,...monthly.map(r=>[r.month,null,r.forecastBbl,r.actualBbl])];
}

/** Explicit missing calendar months for one selected producer; never synthetic observations. */
export function historyDisplayRows(records){
 if(!records.length)return [];const sorted=[...records].sort((a,b)=>a.month.localeCompare(b.month)),byMonth=new Map(sorted.map(r=>[r.month,r]));const first=sorted[0],last=sorted.at(-1),index=m=>{const[y,n]=m.split('-').map(Number);return y*12+n-1;},rows=[];
 for(let i=index(first.month);i<=index(last.month);i++){const month=String(Math.floor(i/12)).padStart(4,'0')+'-'+String(i%12+1).padStart(2,'0'),r=byMonth.get(month);rows.push([month,first.producerId,r?.groupId??first.groupId,r?.rateStbd??null,r?.volumeBbl??null]);}return rows;
}
