import {buildBrineSweep,brineSweepCsv} from '/dist/brinePvt.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const properties=[
 {key:'bwRbPerStb',title:'Water formation volume factor',unit:'rb/STB',color:'#1262b5',format:v=>v.toFixed(6)},
 {key:'densityKgPerM3',title:'Brine density',unit:'kg/m³',color:'#087f8c',format:v=>v.toFixed(3)},
 {key:'viscosityCp',title:'Brine viscosity',unit:'cP',color:'#7245a4',format:v=>v.toFixed(5)},
 {key:'compressibilityPerPsi',title:'Brine compressibility',unit:'1/psi',color:'#a76b12',format:v=>v.toExponential(4)},
];
let current;
const compactCharts=matchMedia('(max-width:700px)');
const buttons=[$('pvt-json'),$('pvt-csv'),$('pvt-svg')];
function invalidate(message='Inputs changed. Calculate again to see and download current results.'){
 current=undefined;buttons.forEach(b=>b.disabled=true);$('pvt-results').hidden=true;
 $('pvt-charts').replaceChildren();$('pvt-table').replaceChildren();
 $('pvt-status').textContent=message;$('pvt-status').className='pvt-status';$('pvt-error').textContent='';
}
function context(result){const i=result.inputs;return `${i.caseName} · ${i.temperatureF} °F · ${i.salinityWtPercent} NaCl wt% · ${i.minPressurePsia}–${i.maxPressurePsia} psia (absolute) · ${i.points} points`;}
function chart(result,p,index,compact=false){
 const values=result.rows.map(r=>r[p.key]);const lo=Math.min(...values),hi=Math.max(...values);
 const pad=(hi-lo||Math.abs(lo)*.02)*.08,ylo=Math.max(0,lo-pad),yhi=hi+pad;
 const width=compact?360:600,left=compact?96:112,right=compact?338:578,top=55,bottom=239;
 const x=v=>left+(v-result.inputs.minPressurePsia)/(result.inputs.maxPressurePsia-result.inputs.minPressurePsia)*(right-left);
 const y=v=>bottom-(v-ylo)/(yhi-ylo)*(bottom-top);
 const ticks=Array.from({length:5},(_,i)=>{
  const xv=result.inputs.minPressurePsia+(result.inputs.maxPressurePsia-result.inputs.minPressurePsia)*i/4;
  const yv=ylo+(yhi-ylo)*i/4;
  return `<path d="M${left} ${y(yv)}H${right}" stroke="#e1e7ef"/><text x="${left-9}" y="${y(yv)+5}" text-anchor="end">${esc(p.format(yv))}</text><text x="${x(xv)}" y="${bottom+24}" text-anchor="middle">${esc(Number(xv.toFixed(1)))}</text>`;
 }).join('');
 const title=`${p.title} (${p.unit})`,desc=`${context(result)}. Vertical axis uses the displayed range, not a zero baseline. ${result.methods[p.key==='bwRbPerStb'?'bw':p.key==='densityKgPerM3'?'density':p.key==='viscosityCp'?'viscosity':'compressibility']}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 292" role="img" aria-labelledby="pvt-title-${index} pvt-desc-${index}"><title id="pvt-title-${index}">${esc(title)}</title><desc id="pvt-desc-${index}">${esc(desc)}</desc><rect width="${width}" height="292" fill="white"/><g font-family="system-ui,sans-serif" fill="#33485d" font-size="${compact?13:15}"><text x="18" y="29" fill="#102344" font-weight="650" font-size="${compact?16:18}">${esc(title)}</text>${ticks}<path d="M${left} ${top}V${bottom}H${right}" stroke="#8294a8" fill="none"/><path d="${result.rows.map((r,i)=>`${i?'L':'M'}${x(r.pressurePsia).toFixed(3)},${y(r[p.key]).toFixed(3)}`).join(' ')}" stroke="${p.color}" stroke-width="3" fill="none"/><text x="${(left+right)/2}" y="285" text-anchor="middle">Absolute pressure (psia)</text></g></svg>`;
}
function chartSheet(result){
 const height=200+properties.length*292;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 ${height}" role="img"><title>${esc(context(result))}</title><desc>Calculated gas-free NaCl brine. Full inputs, methods, source hashes, units, numerical rows and limitations are embedded in metadata.</desc><metadata>${esc(JSON.stringify(result))}</metadata><rect width="600" height="${height}" fill="white"/><g font-family="system-ui,sans-serif" fill="#102344"><text x="18" y="28" font-size="20">SWD Analytics · Water / brine PVT</text><text x="18" y="56" font-size="13">${esc(result.inputs.caseName.slice(0,65))}</text><text x="18" y="80" font-size="13">${esc(context(result).slice(result.inputs.caseName.length+3))}</text><text x="18" y="105" font-size="12">Independent assumed case · calculated · gas-free NaCl liquid</text><text x="18" y="128" font-size="12">pyResToolbox source snapshot (metadata 2.5.0) · browser adaptation /1</text><text x="18" y="151" font-size="12">IAPWS-adjusted density; source Spivey Cw is not its derivative.</text><text x="18" y="174" font-size="12">GPL-3.0-or-later · Exact source hashes and limitations in metadata.</text></g>${properties.map((p,i)=>chart(result,p,`export-${i}`).replace('<svg ',`<svg y="${200+i*292}" width="600" height="292" `)).join('')}</svg>`;
}
function render(result){
 $('pvt-context').textContent=context(result);
 $('pvt-charts').innerHTML=properties.map((p,i)=>`<div class="pvt-plot" tabindex="0" role="region" aria-label="${esc(p.title)} chart">${chart(result,p,i,compactCharts.matches)}</div>`).join('');
 const table=document.createElement('table');const caption=document.createElement('caption');caption.textContent=`${context(result)}. Display values are rounded; downloads retain full precision.`;table.append(caption);
 const head=document.createElement('thead');head.innerHTML='<tr><th scope="col">Pressure<br>psia</th><th scope="col">Bw<br>rb/STB</th><th scope="col">Density<br>kg/m³</th><th scope="col">Density<br>lb/ft³</th><th scope="col">Viscosity<br>cP</th><th scope="col">Compressibility<br>1/psi</th></tr>';table.append(head);
 const body=document.createElement('tbody');
 for(const r of result.rows){const tr=document.createElement('tr');for(const value of [r.pressurePsia.toFixed(2),r.bwRbPerStb.toFixed(6),r.densityKgPerM3.toFixed(4),r.densityLbPerFt3.toFixed(4),r.viscosityCp.toFixed(6),r.compressibilityPerPsi.toExponential(6)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}table.append(body);$('pvt-table').replaceChildren(table);
 $('pvt-results').hidden=false;$('pvt-status').textContent=`Calculated ${result.rows.length} pressure points. These outputs use the assumptions shown below; they do not change injection capacity.`;$('pvt-status').className='pvt-status calculated';buttons.forEach(b=>b.disabled=false);
}
$('pvt-form').addEventListener('input',()=>invalidate());
$('pvt-form').addEventListener('submit',event=>{
 event.preventDefault();invalidate();
 try{
  const input={caseName:$('pvt-name').value,minPressurePsia:$('pvt-min').valueAsNumber,maxPressurePsia:$('pvt-max').valueAsNumber,temperatureF:$('pvt-temperature').valueAsNumber,salinityWtPercent:$('pvt-salinity').valueAsNumber,points:$('pvt-points').valueAsNumber};
  current=buildBrineSweep(input);render(current);
 }catch(error){invalidate('Calculation blocked. Correct the inputs and calculate again.');$('pvt-error').textContent=error.message;}
});
function download(kind){
 if(!current)return;
 const text=kind==='json'?JSON.stringify(current,null,2):kind==='csv'?brineSweepCsv(current):chartSheet(current);
 const blob=new Blob([text],{type:kind==='json'?'application/json':kind==='csv'?'text/csv;charset=utf-8':'image/svg+xml;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`swd-brine-pvt.${kind}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const kind of ['json','csv','svg'])$(`pvt-${kind}`).addEventListener('click',()=>download(kind));
compactCharts.addEventListener('change',()=>{if(current)render(current);});
invalidate('Enter an assumed fluid case, then calculate the pressure sweep. No dataset or measured pressure is inferred.');
