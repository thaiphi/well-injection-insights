import {plot,table} from './disposal-case.mjs';
import {assertJsonEvidence} from '/dist/exhibitIntegrity.js';
const root=document.getElementById('disposal-sensitivity');
root.innerHTML=`<h3>Which assumption changes capacity?</h3><p>Vary one input for one well while holding the same frozen demand, fluid model and other wells fixed. This sweep evaluates the base scenario; the one-well comparison above remains separate.</p><form id="sensitivity-form" novalidate><div class="disposal-controls"><label>Well to sweep<select id="sensitivity-well"></select></label><label>Parameter<select id="sensitivity-parameter"><option value="injectivityStbdPerPsi">Injectivity (STB/day/psi)</option><option value="innerDiameterInches">Tubing inner diameter (in)</option><option value="availability">Availability (fraction)</option></select></label><label>Minimum<input id="sensitivity-min" type="number" step="any"></label><label>Maximum<input id="sensitivity-max" type="number" step="any"></label><label>Grid points (3–9)<input id="sensitivity-points" type="number" min="3" max="9" step="1" value="5"></label></div><p id="sensitivity-baseline" class="small"></p><button id="sensitivity-calculate" type="submit" disabled>Calculate parameter sweep</button><p id="sensitivity-error" role="alert"></p></form><p id="sensitivity-status" role="status">Calculate the disposal case first.</p><div class="import-actions"><button id="sensitivity-json" disabled>Download sweep JSON</button><button id="sensitivity-csv" disabled>Download sweep CSV</button><button id="sensitivity-svg" disabled>Download sweep chart SVG</button></div><div id="sensitivity-results" hidden><p id="sensitivity-context" class="small"></p><div id="sensitivity-charts" class="pvt-charts"></div><div id="sensitivity-table" class="table-scroll" tabindex="0" role="region" aria-label="Parameter sweep results"></div><details><summary>Monthly results, well limits & evidence</summary><div id="sensitivity-monthly" class="table-scroll" tabindex="0" role="region" aria-label="Parameter sweep monthly results"></div><div id="sensitivity-limits" class="table-scroll" tabindex="0" role="region" aria-label="Parameter sweep well limits"></div><div id="sensitivity-methods"></div></details></div>`;
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const fmt=n=>typeof n==='number'?n.toLocaleString('en-US',{maximumFractionDigits:3}):n??'None';
let caseInput=null,caseHash=null,current=null,resultHash=null,generation=0,worker=null,rejectPending=null;
function cancelWork(){if(worker){worker.terminate();worker=null;}if(rejectPending){rejectPending(Error('Calculation replaced by newer inputs'));rejectPending=null;}}
function request(action,payload){
 cancelWork();assertJsonEvidence(payload,'Sensitivity worker payload');
 return new Promise((resolve,reject)=>{
  const activeWorker=new Worker('/sensitivity-worker.mjs',{type:'module'});worker=activeWorker;rejectPending=reject;
  const finish=()=>{activeWorker.terminate();if(worker===activeWorker){worker=null;rejectPending=null;}};
  activeWorker.onmessage=event=>{const data=event.data;finish();if(data.error)reject(Error(data.error));else resolve(data);};
  activeWorker.onerror=()=>{finish();reject(Error('Sensitivity calculation could not load. Reload the app and try again.'));};
  activeWorker.postMessage({action,...payload});
 });
}
function invalidate(message='Sweep inputs changed. Recalculate before interpreting or exporting.'){
 cancelWork();generation++;current=null;resultHash=null;$('sensitivity-results').hidden=true;
 for(const id of ['sensitivity-charts','sensitivity-table','sensitivity-monthly','sensitivity-limits','sensitivity-methods'])$(id).replaceChildren();
 for(const ext of ['json','csv','svg'])$('sensitivity-'+ext).disabled=true;
 $('sensitivity-error').textContent='';$('sensitivity-status').textContent=message;
}
function defaults(){
 if(!caseInput)return;const well=caseInput.wells.find(w=>w.id===$('sensitivity-well').value),key=$('sensitivity-parameter').value,base=well[key];
 $('sensitivity-min').value=String(base===0?0:base*.5);$('sensitivity-max').value=String(key==='availability'?Math.min(1,Math.max(.1,base*1.5)):base*1.5);
 $('sensitivity-baseline').textContent=`Base ${well.id}: ${String(base)} ${key==='injectivityStbdPerPsi'?'STB/day/psi':key==='innerDiameterInches'?'in':'fraction'}. The range must include this value. An exact base point is added if it falls between grid points.`;
}
document.addEventListener('disposal-case-invalidated',()=>{caseInput=null;caseHash=null;$('sensitivity-calculate').disabled=true;invalidate('Disposal inputs changed. Recalculate the disposal case before running a sweep.');});
document.addEventListener('disposal-case-result',event=>{
 caseInput=structuredClone(event.detail.result.inputs);caseHash=event.detail.contentSha256;$('sensitivity-well').replaceChildren();
 for(const well of caseInput.wells){const opt=node('option',well.id);opt.value=well.id;$('sensitivity-well').append(opt);}
 defaults();$('sensitivity-calculate').disabled=false;invalidate('Base disposal case calculated. Select a well, parameter and bounded range.');
});
$('sensitivity-form').addEventListener('input',()=>invalidate());
for(const id of ['sensitivity-well','sensitivity-parameter'])$(id).addEventListener('change',()=>{defaults();invalidate();});
function number(id){if(!$(id).value.trim())throw Error('Declare '+$(id).closest('label').textContent.trim());const n=Number($(id).value);if(!Number.isFinite(n))throw Error('Sweep values must be finite');return n;}
function charts(result,width=600,metadata=null){const offset=result.inputs.spec.maximum-result.inputs.spec.minimum<.01,base=result.baseline.value,rows=result.points.map(p=>({x:offset?p.value-base:p.value,label:offset?Number((p.value-base).toPrecision(4)).toString():String(p.value),values:[p.summary.totalAvailableStbd,p.summary.totalShortfallBbl]})),axis=(offset?'Change from base '+String(base)+' · ':'')+result.parameter.label+' ('+result.parameter.unit+')';return [plot('Available capacity across the sweep','Available stock-tank rate (STB/day)',axis,rows.map(r=>({...r,values:[r.values[0]]})),[{label:'Base scenario capacity',color:'#1262b5'}],width,metadata),plot('Unmet demand across the sweep','Unmet stock-tank volume (bbl) · selected months',axis,rows.map(r=>({...r,values:[r.values[1]]})),[{label:'Unmet forecast demand',color:'#8b5aab'}],width,metadata)];}
function appendSvg(target,svg){const t=document.createElement('template');t.innerHTML=svg;target.append(t.content);}
function renderCharts(){if(!current)return;const width=matchMedia('(max-width:700px)').matches?360:600;$('sensitivity-charts').replaceChildren();for(const svg of charts(current,width)){const panel=node('div','');panel.className='pvt-plot';appendSvg(panel,svg);$('sensitivity-charts').append(panel);}}
function render(result){
 $('sensitivity-results').hidden=false;$('sensitivity-context').textContent=`${result.inputs.caseInput.caseName} · ${result.inputs.spec.wellId} · ${result.parameter.label} (${result.parameter.unit}) · ${result.caseMethodVersion} · source case SHA-256 ${caseHash} · sweep SHA-256 ${resultHash}`;
 renderCharts();
 $('sensitivity-table').append(table([result.parameter.label+' ('+result.parameter.unit+')','Base point','Available STB/day','Change from base STB/day','Unmet bbl','Change from base unmet bbl','First shortfall month','Operating check'],result.points.map(p=>[String(p.value),p.isBaseline?'Base case':p.isGridPoint?'Grid point':'',p.summary.totalAvailableStbd,p.summary.totalAvailableStbd-result.baseline.summary.totalAvailableStbd,p.summary.totalShortfallBbl,p.summary.totalShortfallBbl-result.baseline.summary.totalShortfallBbl,p.summary.firstShortfallMonth??'None',p.summary.operatingFeasible?'Bounded check passed':'Unsupported allocation — inspect reasons']),'One parameter at a time. Capacity envelopes are screening calculations, not calibrated sustainable rates.'));
 $('sensitivity-monthly').append(table(['Parameter value','Month','Days','Demand bbl','Capacity bbl','Unmet bbl','Operating check / reasons'],result.points.flatMap(p=>p.summary.monthly.map(m=>[String(p.value),m.month,m.days,m.demandBbl,m.capacityBbl,m.shortfallBbl,m.operatingFeasible?'Bounded check passed':m.unsupportedAllocations.map(a=>a.wellId+': '+a.reasons.join(' ')).join(' ')])),'Same frozen demand and calendar basis for every evaluated point.'));
 $('sensitivity-limits').append(table(['Parameter value','Well','Max onstream STB/day','Available STB/day','Binding constraints','Maximum point check'],result.points.flatMap(p=>p.summary.wells.map(w=>[String(p.value),w.wellId,w.maximumStbd,w.availableStbd,w.limitingConstraints.join(' + '),w.maximumOperatingFeasible?'Bounded check passed':'Unsupported'])),'Only the selected parameter of the selected well changes. Availability is applied once.'));
 for(const limitation of result.limitations)$('sensitivity-methods').append(node('p',limitation));
 $('sensitivity-methods').append(node('pre',JSON.stringify({inputs:result.inputs,caseMethods:result.caseMethods,caseProvenance:result.caseProvenance,units:result.units},null,2)));
 const unsupported=result.points.filter(p=>!p.summary.operatingFeasible).length;$('sensitivity-status').textContent=`Calculated ${result.points.length} points including the exact base value. ${unsupported?unsupported+' points have unsupported allocations; inspect their reasons.':'Bounded operating checks passed.'} Full engineering acceptance remains open.`;
 for(const ext of ['json','csv','svg'])$('sensitivity-'+ext).disabled=false;
}
$('sensitivity-form').addEventListener('submit',async event=>{
 event.preventDefault();invalidate('Calculating each point with the selected disposal model…');const token=generation;
 try{if(!caseInput)throw Error('Recalculate the disposal case first.');const spec={wellId:$('sensitivity-well').value,parameter:$('sensitivity-parameter').value,minimum:number('sensitivity-min'),maximum:number('sensitivity-max'),points:number('sensitivity-points')};const computed=await request('calculate',{caseInput,spec});if(token!==generation)return;resultHash=computed.hash;current=computed.result;render(current);}catch(error){if(token===generation){$('sensitivity-error').textContent=error.message;$('sensitivity-status').textContent='Blocked — correct the range or inputs; no partial sweep or download is available.';}}
});
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=node('a','');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
async function exportSweep(format){
 if(!current||!resultHash||!caseInput)return;const token=generation,priorStatus=$('sensitivity-status').textContent;
 for(const ext of ['json','csv','svg'])$('sensitivity-'+ext).disabled=true;$('sensitivity-status').textContent='Verifying every displayed sweep point before download…';
 try{const verified=await request('verify',{result:current,format});if(token!==generation)return;if(verified.hash!==resultHash)throw Error('Displayed sweep hash changed; recalculate before exporting.');const bundle={contentSha256:resultHash,sourceCaseSha256:caseHash,sensitivity:verified.result};
 if(format==='json')download(JSON.stringify(bundle,null,2)+'\n','swd-capacity-sweep.json','application/json');
 else if(format==='csv')download(verified.csv+'"metadata","","","","","sweepSha256","'+resultHash+'"\r\n"metadata","","","","","sourceCaseSha256","'+caseHash+'"\r\n','swd-capacity-sweep.csv','text/csv;charset=utf-8');
 else{const plots=charts(bundle.sensitivity,900);download('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><title>Capacity parameter sweep</title><metadata>'+esc(JSON.stringify(bundle))+'</metadata><rect width="900" height="700" fill="white"/><text x="20" y="23" font-size="16">Capacity parameter sweep · engineering screening</text><text x="20" y="43" font-size="11">'+esc(bundle.sensitivity.inputs.caseInput.demand.origin+' / '+bundle.sensitivity.inputs.caseInput.demand.content)+' · full inputs, units, source hashes and limitations embedded</text>'+plots.map((svg,i)=>'<g transform="translate(0 '+(60+320*i)+')">'+svg+'</g>').join('')+'</svg>','swd-capacity-sweep.svg','image/svg+xml;charset=utf-8');}
 $('sensitivity-status').textContent=priorStatus;
 }catch(error){if(token===generation){invalidate('Export blocked. Recalculate the sweep before downloading.');$('sensitivity-error').textContent=error.message;}}
 finally{if(token===generation&&current)for(const ext of ['json','csv','svg'])$('sensitivity-'+ext).disabled=false;}
}
for(const format of ['json','csv','svg'])$('sensitivity-'+format).onclick=()=>exportSweep(format);
window.addEventListener('resize',renderCharts);
