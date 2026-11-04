import {caseHydraulicPoint, DISPOSAL_CASE_VERSION} from '../dist/disposalCase.js';
import {brineAtPressure, buildBrineSweep} from '../dist/brinePvt.js';
import {SEGMENTED_BRINE_METHOD_VERSION} from '../dist/wellboreTraverse.js';

export const HYDRAULICS_DEFAULTS = Object.freeze({
  caseName:'Assumed brine injector', model:'segmented-brine', datum:'Formation at declared TVD below wellhead',
  reservoirPsia:2000, limitPsia:3500, surfaceLimitPsia:2000, injectivityStbdPerPsi:5,
  rateStbd:5000, curveMaximumStbd:7500, curvePoints:21, operatingCeilingStbd:10000,
  tvdFt:3000, measuredDepthFt:3300, innerDiameterInches:4.5, roughnessInches:0.0006,
  referencePressurePsia:2000, temperatureF:180, surfaceTemperatureF:80, salinityWtPercent:5, segments:32,
});
const numericFields = [
  ['rateStbd','Selected injection rate','STB/day',0,1000000],
  ['injectivityStbdPerPsi','Injectivity J','STB/day/psi',0.000001,10000],
  ['reservoirPsia','Reservoir pressure','psia',100,10000],
  ['limitPsia','Bottomhole pressure limit','psia',100,10000],
  ['surfaceLimitPsia','Wellhead pressure limit','psia',100,10000],
  ['operatingCeilingStbd','Operating rate ceiling','STB/day',0,1000000],
  ['tvdFt','True vertical depth','ft',0,50000],
  ['measuredDepthFt','Measured depth','ft',1,50000],
  ['innerDiameterInches','Tubing inner diameter','in',0.25,30],
  ['roughnessInches','Absolute roughness','in',0,0.1],
  ['temperatureF','Bottomhole / uniform temperature','°F',60,250],
  ['salinityWtPercent','NaCl salinity','wt%',0,20],
  ['referencePressurePsia','Fluid reference pressure','psia',100,10000],
  ['surfaceTemperatureF','Surface temperature','°F',60,250],
  ['segments','Initial traverse intervals','intervals',8,256],
  ['curveMaximumStbd','Pressure-curve maximum rate','STB/day',0,1000000],
  ['curvePoints','Pressure-curve points','points',2,41],
];
const fieldByKey = new Map(numericFields.map(field=>[field[0],field]));
const clone = value=>structuredClone(value);
const esc = value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const fmt = value=>value===null||value===undefined?'Unavailable':typeof value==='number'?value.toLocaleString('en-US',value!==0&&Math.abs(value)<0.01?{maximumSignificantDigits:6}:{maximumFractionDigits:3}):String(value);

/** Validate the complete standalone assumption snapshot before invoking the existing backend. */
export function validateHydraulicsInputs(input) {
  if(!input || typeof input!=='object') throw Error('Supply the hydraulics assumptions.');
  if(!['uniform-brine','segmented-brine'].includes(input.model)) throw Error('Choose uniform brine or depth-dependent brine.');
  const result = {};
  for(const [key,label,unit,min,max] of numericFields) {
    if(input.model==='uniform-brine'&&['surfaceTemperatureF','segments'].includes(key)) continue;
    const value=input[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max) throw Error(`${label} must be between ${min} and ${max} ${unit}.`);
    result[key]=value;
  }
  for(const key of ['segments','curvePoints']) if(key in result&&!Number.isInteger(result[key])) throw Error(`${fieldByKey.get(key)[1]} must be an integer.`);
  for(const [key,label,max] of [['caseName','Case name',100],['datum','Common bottomhole pressure datum',500]]) {
    if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max) throw Error(`${label} requires 1–${max} characters.`);
    result[key]=input[key].trim();
  }
  result.model=input.model;
  if(result.measuredDepthFt<result.tvdFt) throw Error('Measured depth must be at least true vertical depth.');
  if(result.roughnessInches/result.innerDiameterInches>0.05) throw Error('Relative roughness must not exceed 0.05.');
  if(result.curveMaximumStbd<=0) throw Error('Pressure-curve maximum rate must be greater than zero.');
  if(result.model==='segmented-brine'&&result.tvdFt===0&&result.temperatureF!==result.surfaceTemperatureF) throw Error('A horizontal well requires equal surface and bottomhole temperatures.');
  return result;
}

/** No planning dataset, demand, forecast, saved case or additional physics is used here. */
export function calculateHydraulics(raw) {
  const inputs=validateHydraulicsInputs(raw);
  const well={id:'ASSUMED-STANDALONE-INJECTOR',reservoirPsia:inputs.reservoirPsia,limitPsia:inputs.limitPsia,
    surfaceLimitPsia:inputs.surfaceLimitPsia,injectivityStbdPerPsi:inputs.injectivityStbdPerPsi,
    operatingCeilingStbd:inputs.operatingCeilingStbd,availability:1,datum:inputs.datum,
    reservoirDatum:inputs.datum,limitDatum:inputs.datum,reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',
    tvdFt:inputs.tvdFt,measuredDepthFt:inputs.measuredDepthFt,innerDiameterInches:inputs.innerDiameterInches,roughnessInches:inputs.roughnessInches};
  const fluid={referencePressurePsia:inputs.referencePressurePsia,temperatureF:inputs.temperatureF,salinityWtPercent:inputs.salinityWtPercent};
  const backendInputs={fluid,...(inputs.model==='segmented-brine'?{hydraulics:{model:'segmented-brine',surfaceTemperatureF:inputs.surfaceTemperatureF,segments:inputs.segments}}:{})};
  const fluidProperties=brineAtPressure(fluid.referencePressurePsia,fluid.temperatureF,fluid.salinityWtPercent);
  const point=caseHydraulicPoint(backendInputs,well,inputs.rateStbd);
  const curve=Array.from({length:inputs.curvePoints},(_,i)=>caseHydraulicPoint(backendInputs,well,inputs.curveMaximumStbd*i/(inputs.curvePoints-1)));
  const pvt=buildBrineSweep({caseName:inputs.caseName,minPressurePsia:100,maxPressurePsia:10000,temperatureF:inputs.temperatureF,salinityWtPercent:inputs.salinityWtPercent,points:2});
  const segmented=inputs.model==='segmented-brine';
  return {schemaVersion:'standalone-brine-hydraulics/1',methodVersion:segmented?SEGMENTED_BRINE_METHOD_VERSION:DISPOSAL_CASE_VERSION,
    inputs:clone(inputs),backendInputs,well,fluidProperties,point,curve,
    units:{pressure:'psia absolute',pressureDifference:'psi',rate:'STB/day at retained source standard',injectivity:'STB/day/psi',depth:'ft below wellhead',diameterAndRoughness:'in',temperature:'°F',salinity:'NaCl wt%',bw:'rb/STB',density:'kg/m³',viscosity:'cP',localFlow:'m³/s',massFlow:'kg/s',velocity:'m/s',reynolds:'dimensionless',darcyFrictionFactor:'dimensionless',compressibility:'1/psi'},
    methods:{bottomhole:'P_bh = P_res + q_ST / J at the declared common bottomhole datum.',
      surface:'P_wellhead = P_bh − gravity gain + friction loss; downward injection; no pressure clamping.',
      fluid:segmented?'Pinned gas-free NaCl brine evaluated at local pressure and prescribed temperature; straight TVD/MD slope and temperature linear over TVD. Reference-state properties are context only.':'Pinned gas-free NaCl brine evaluated at the reference pressure and uniform temperature; density, viscosity and Bw held constant throughout the pipe.',
      friction:segmented?'Existing RK4 step-doubling traverse; Darcy-Weisbach with retained Nexus Serghides Fanning factor ×4 to Darcy; custom transition interpolation.':'Existing uniform Darcy-Weisbach model; Swamee-Jain turbulent factor, 64/Re laminar factor, custom transition interpolation.',
      profile:segmented?'Existing backend local depth nodes at the selected onstream rate. Unsupported solves retain null pressure outputs.':'Uniform backend exposes endpoint contributions only; no local depth traverse is calculated.',
      curve:'Existing caseHydraulicPoint evaluated on the explicit requested rate grid. Curves are screening points, not a capacity optimization.'},
    provenance:{inputs:'User-entered assumptions; initial defaults are explicitly assumed fictional values.',outputs:'calculated',planningDatasetUsed:false,forecastUsed:false,liveMcpCall:false,pvt:pvt.provenance,
      ...(segmented?{wellboreFrictionSource:{name:'reference/nexus-wellbore/serghides.ts',sha256:'db934a2a0d850aa3375789e590ad1699fac9611157459a8bed1343da641bc4be',conversion:'Darcy = 4 × Nexus Fanning',reuse:'Owner-authorized local snapshot; source license not established; full Nexus injection/VFP parity not claimed'}}:{}),
      hydraulicsImplementation:segmented?'Existing custom steady single-phase RK4 brine injection traverse and constant-J coupling.':'Existing custom uniform SI Darcy-Weisbach/Swamee-Jain screening model.',
      pressureReferences:{reservoir:inputs.datum,bottomholeLimit:inputs.datum,wellhead:'Wellhead surface reference, 0 ft; related to the bottomhole datum by declared TVD.',basis:'All pressures absolute psia; no gauge conversion or inferred RRC pressure basis.'}},
    limitations:[...pvt.limitations.filter(text=>!text.startsWith('Independent fluid case:')),
      'Assumed engineering screening only; no field calibration, sustainable-capacity acceptance or operating recommendation.',
      'No demand allocation, capacity optimization, availability schedule, saved case or planning forecast is calculated in this workspace.',
      segmented?'Straight geometry and prescribed temperature only; no heat transfer, fittings or pump model. Acceleration omitted; local velocity above 5 m/s is unsupported.':'Uniform properties only; no local pressure/temperature traverse, heat transfer, fittings or pump model.',
      'Reservoir and bottomhole pressure limit share the declared formation datum. Wellhead pressure is at the surface reference and is related through TVD; pressure values at different elevations are not interchangeable.',
      'A zero rate is shut-in: the backend does not calculate a flowing pressure or local traverse.',
      'Pressure below 100 psia, pressure-domain exits and declared limit exceedances remain explicitly flagged. Numerical solver failures block calculation.'],
  };
}

function csvCell(value) {
  let text=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');
  if(typeof value==='string'&&(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function hydraulicsCsv(result) {
  const rows=[['section','position','field','value'],['metadata','','caseName',result.inputs.caseName],['metadata','','bottomholeDatum',result.inputs.datum]];
  for(const [key,value] of Object.entries(result)) if(!['curve','point'].includes(key)) rows.push(['metadata','',key,value]);
  for(const [key,value] of Object.entries(result.point)) if(key!=='traverse') rows.push(['selected-point',result.point.rateStbd,key,value]);
  for(const point of result.curve) for(const [key,value] of Object.entries(point)) if(key!=='traverse') rows.push(['pressure-curve',point.rateStbd,key,value]);
  if(result.point.traverse) {
    for(const [key,value] of Object.entries(result.point.traverse)) if(key!=='points') rows.push(['traverse-summary','',key,value]);
    for(const node of result.point.traverse.points) for(const [key,value] of Object.entries(node)) rows.push(['depth-profile',node.measuredDepthFt,key,value]);
  }
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

function plotSvg(title,xLabel,yLabel,series,{depth=false,height=360}={}) {
  const width=760,left=85,right=28,top=58,bottom=height-90;
  const pairs=series.flatMap(line=>line.points).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y));
  if(!pairs.length) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><rect width="100%" height="100%" fill="white"/><text x="28" y="48" fill="#23343e" font-family="sans-serif">No supported points are available for ${esc(title.toLowerCase())}.</text></svg>`;
  const xmin=Math.min(0,...pairs.map(p=>p[0])),xmax=Math.max(1,...pairs.map(p=>p[0]));
  const ymin=Math.min(0,...pairs.map(p=>p[1])),ymax=Math.max(1,...pairs.map(p=>p[1]));
  const x=value=>left+(value-xmin)/(xmax-xmin)*(width-left-right);
  const y=value=>depth?top+(value-ymin)/(ymax-ymin)*(bottom-top):bottom-(value-ymin)/(ymax-ymin)*(bottom-top);
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title+'; '+xLabel+'; '+yLabel)}"><title>${esc(title)}</title><rect width="100%" height="100%" fill="white"/><g font-family="Segoe UI,Arial,sans-serif" font-size="11" fill="#536773"><text x="${left}" y="24" font-size="16" font-weight="600" fill="#173d54">${esc(title)}</text>`;
  for(let i=0;i<=4;i++) {
    const xv=xmin+(xmax-xmin)*i/4,yv=ymin+(ymax-ymin)*i/4;
    svg+=`<path d="M${left} ${y(yv)}H${width-right}" stroke="#e0e7ec"/><text x="${left-10}" y="${y(yv)+4}" text-anchor="end">${esc(fmt(yv))}</text><text x="${x(xv)}" y="${bottom+21}" text-anchor="middle">${esc(fmt(xv))}</text>`;
  }
  svg+=`<path d="M${left} ${top}V${bottom}H${width-right}" stroke="#8195a2" fill="none"/><text x="${(left+width-right)/2}" y="${bottom+41}" text-anchor="middle">${esc(xLabel)}</text><text transform="translate(17 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
  series.forEach((line,index)=> {
    let path='',active=false;
    for(const [px,py] of line.points) {
      if(!Number.isFinite(px)||!Number.isFinite(py)) {active=false;continue;}
      path+=`${active?'L':'M'}${x(px).toFixed(3)},${y(py).toFixed(3)} `;active=true;
    }
    svg+=`<path d="${path}" stroke="${line.color}" stroke-width="${line.dashed?1.5:2.5}" ${line.dashed?'stroke-dasharray="6 5"':''} fill="none"/>`;
    if(line.markers) for(const [px,py] of line.points) if(Number.isFinite(px)&&Number.isFinite(py)) svg+=`<circle cx="${x(px)}" cy="${y(py)}" r="4" fill="${line.color}"/>`;
    svg+=`<text x="${left+(index%3)*215}" y="${height-27+Math.floor(index/3)*15}" fill="${line.color}">${esc(line.label)}</text>`;
  });
  return svg+'</g></svg>';
}
export function pressureCurveSvg(result) {
  const valid=point=>point.status!=='unsupported';
  const max=result.inputs.curveMaximumStbd;
  return plotSvg('Required injection pressure','Injection rate (STB/day)','Absolute pressure (psia)',[
    {label:'Required bottomhole',color:'#276e9e',points:result.curve.map(p=>[p.rateStbd,valid(p)?p.bottomholePsia:null])},
    {label:'Required wellhead',color:'#087f8c',points:result.curve.map(p=>[p.rateStbd,valid(p)?p.requiredSurfacePsia:null])},
    {label:'Bottomhole limit',color:'#96642f',dashed:true,points:[[0,result.inputs.limitPsia],[max,result.inputs.limitPsia]]},
    {label:'Wellhead limit',color:'#795486',dashed:true,points:[[0,result.inputs.surfaceLimitPsia],[max,result.inputs.surfaceLimitPsia]]},
    {label:'Flagged wellhead points',color:'#b63d31',markers:true,points:result.curve.filter(p=>!p.operatingFeasible).map(p=>[p.rateStbd,p.requiredSurfacePsia])},
    {label:'Selected wellhead point',color:'#173d54',markers:true,points:[[result.point.rateStbd,result.point.requiredSurfacePsia]]},
  ],{height:385});
}
export function depthProfileSvg(result,property='pressurePsia') {
  const options={pressurePsia:['Pressure','Absolute pressure (psia)','#276e9e'],temperatureF:['Temperature','Temperature (°F)','#96642f'],densityKgPerM3:['Density','Density (kg/m³)','#087f8c'],viscosityCp:['Viscosity','Viscosity (cP)','#795486'],velocityMPerSecond:['Velocity','Velocity (m/s)','#276e9e']};
  if(!options[property]) throw Error('Unsupported profile property.');
  const [title,label,color]=options[property];
  return plotSvg(`${title} by measured depth`,label,'Measured depth below wellhead (ft)',[{label:`${fmt(result.point.rateStbd)} STB/day`,color,points:(result.point.traverse?.points??[]).map(p=>[p[property],p.measuredDepthFt])}],{depth:true});
}
export function hydraulicsSvg(result) {
  const charts=[pressureCurveSvg(result),...(result.point.traverse?[depthProfileSvg(result)]:[])];
  const height=135+charts.length*385;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${height}" viewBox="0 0 760 ${height}"><title>${esc(result.inputs.caseName)}</title><metadata>${esc(JSON.stringify(result))}</metadata><rect width="100%" height="100%" fill="white"/><g font-family="Segoe UI,Arial,sans-serif" fill="#173d54"><text x="25" y="30" font-size="20">${esc(result.inputs.caseName)}</text><text x="25" y="54" font-size="12">Assumed inputs · calculated screening · ${esc(result.inputs.model)}</text><text x="25" y="75" font-size="12">${esc(result.point.operatingFeasible?'Selected point: '+result.point.status:'Selected point: unsupported / outside declared limits')}</text><text x="25" y="96" font-size="11">Complete inputs, units, pressure references, source provenance and limitations embedded.</text><text x="25" y="116" font-size="11">No field calibration or sustainable-capacity acceptance.</text></g>${charts.map((svg,i)=>`<g transform="translate(0 ${135+i*385})">${svg}</g>`).join('')}</svg>`;
}

function inputMarkup(key) {
  const [,,unit,min,max]=fieldByKey.get(key),label=fieldByKey.get(key)[1];
  return `<label for="hyd-${key}"><span>${esc(label)} <small>${esc(unit)}</small></span><input id="hyd-${key}" name="${key}" type="number" min="${min}" max="${max}" step="${['segments','curvePoints'].includes(key)?1:'any'}" value="${HYDRAULICS_DEFAULTS[key]}" required></label>`;
}
function fields(title,keys,extra='') {
  return `<fieldset><legend>${title}</legend><div class="hyd-fields">${keys.map(inputMarkup).join('')}</div>${extra}</fieldset>`;
}
function workspaceMarkup() {
  return `<div class="hyd-heading"><div><h1 id="hydraulics-title">Wellbore hydraulics</h1><p>Calculate injection pressure and inspect brine properties along the well.</p></div><span class="hyd-assumed">Independent assumed case</span></div>
  <p class="hyd-boundary">Enter well geometry, fluid assumptions and a common bottomhole datum. All defaults are fictional assumptions. A planning dataset or forecast is not required.</p>
  <div class="hyd-tabs" role="tablist" aria-label="Hydraulics views"><button type="button" role="tab" id="hyd-tab-hydraulics" aria-selected="true" aria-controls="hyd-panel-hydraulics" tabindex="0" data-hyd-tab="hydraulics">Hydraulics</button><button type="button" role="tab" id="hyd-tab-profiles" aria-selected="false" aria-controls="hyd-panel-profiles" tabindex="-1" data-hyd-tab="profiles">Profiles</button></div>
  <div class="hyd-layout"><form class="hyd-form" id="hyd-form" novalidate><div class="hyd-form-top"><h2>Calculation inputs</h2><button type="button" id="hyd-reset" class="hyd-link-button">Reset assumed values</button></div>
  <label for="hyd-caseName">Case label<input id="hyd-caseName" name="caseName" value="${HYDRAULICS_DEFAULTS.caseName}" maxlength="100" required></label>
  <label for="hyd-model">Wellbore model<select id="hyd-model" name="model"><option value="segmented-brine">Depth-dependent brine</option><option value="uniform-brine">Uniform reference brine</option></select></label><p class="hyd-note" id="hyd-model-note"></p>
  ${fields('Operating point',['rateStbd','injectivityStbdPerPsi'])}
  ${fields('Pressure references & constraints',['reservoirPsia','limitPsia','surfaceLimitPsia','operatingCeilingStbd'],`<label for="hyd-datum">Common bottomhole datum<input id="hyd-datum" name="datum" value="${HYDRAULICS_DEFAULTS.datum}" maxlength="500" required></label><p class="hyd-note">Reservoir and bottomhole limit share this datum. Wellhead pressure is at 0 ft; TVD relates it to the formation. All pressures are absolute psia, including limits.</p>`)}
  ${fields('Well geometry',['tvdFt','measuredDepthFt','innerDiameterInches','roughnessInches'],'<p class="hyd-note">TVD controls gravity; measured depth controls friction. Constant tubing diameter and straight deviation are assumed.</p>')}
  ${fields('Gas-free NaCl brine',['temperatureF','salinityWtPercent','referencePressurePsia'])}
  <div id="hyd-segmented-inputs">${fields('Depth-dependent settings',['surfaceTemperatureF','segments'],'<p class="hyd-note">Temperature varies linearly with TVD. The solver refines intervals automatically. Local pressure 100–10,000 psia; temperature 60–250 °F; NaCl 0–20 wt%. NaCl wt% is not TDS mg/L.</p>')}</div>
  <details class="hyd-curve-settings"><summary>Pressure-curve range</summary><div class="hyd-fields">${['curveMaximumStbd','curvePoints'].map(inputMarkup).join('')}</div><p class="hyd-note">Requested rates are evaluated individually. Flagged points do not establish feasible capacity.</p></details>
  <div class="hyd-calculate"><button type="submit" id="hyd-calculate">Calculate hydraulics</button><p id="hyd-error" role="alert"></p></div></form>
  <div class="hyd-output"><div class="hyd-result-toolbar"><p id="hyd-status" role="status">Ready for an assumed calculation. Review inputs, then calculate.</p><div class="hyd-exports" aria-label="Local calculation exports"><button type="button" data-hyd-export="json" disabled>JSON</button><button type="button" data-hyd-export="csv" disabled>CSV</button><button type="button" data-hyd-export="svg" disabled>SVG</button></div></div>
  <div class="hyd-empty" id="hyd-empty"><svg viewBox="0 0 160 110" aria-hidden="true"><path d="M27 10v77h113M27 80c30-15 67-27 104-58"/><path d="M27 35h110" stroke-dasharray="5 5"/><circle cx="90" cy="40" r="4"/></svg><h2>Your injection-pressure calculation</h2><p>Calculate a selected rate and a pressure curve using the assumptions on the left. Profiles are available with the depth-dependent brine model.</p></div>
  <div id="hyd-results" hidden><div id="hyd-selected-status" class="hyd-selected-status"></div><div id="hyd-summary" class="hyd-summary"></div>
  <section id="hyd-panel-hydraulics" role="tabpanel" aria-labelledby="hyd-tab-hydraulics"><div class="hyd-chart" id="hyd-pressure-chart"></div><p class="hyd-note">Dashed lines are declared constraints. Red markers show calculated points outside the checks. Unsupported pressure solves remain gaps; a connecting line does not prove feasibility between sampled rates.</p><details><summary>Pressure-curve values & flags</summary><div id="hyd-curve-table" class="hyd-table-scroll" tabindex="0" role="region" aria-label="Pressure curve values"></div></details><details><summary>Fluid properties at the reference state</summary><div id="hyd-fluid-table" class="hyd-table-scroll" tabindex="0" role="region" aria-label="Reference brine properties"></div></details></section>
  <section id="hyd-panel-profiles" role="tabpanel" aria-labelledby="hyd-tab-profiles" hidden><h2>Local depth profiles</h2><p id="hyd-profile-context" class="hyd-note"></p><label class="hyd-profile-select" for="hyd-profile-property">Plot property<select id="hyd-profile-property"><option value="pressurePsia">Absolute pressure (psia)</option><option value="temperatureF">Temperature (°F)</option><option value="densityKgPerM3">Density (kg/m³)</option><option value="viscosityCp">Viscosity (cP)</option><option value="velocityMPerSecond">Velocity (m/s)</option></select></label><div id="hyd-depth-chart" class="hyd-chart"></div><div id="hyd-traverse-diagnostics" class="hyd-note"></div><details><summary>Depth intervals & local properties</summary><div id="hyd-depth-table" class="hyd-table-scroll" tabindex="0" role="region" aria-label="Local wellbore properties"></div></details></section>
  <details class="hyd-evidence"><summary>Methods, provenance & limitations</summary><div id="hyd-evidence"></div><p><a href="/reference/pyrestoolbox-pvt/provenance.json" target="_blank" rel="noopener">Pinned PVT source record</a> · <a href="/reference/pyrestoolbox-pvt/oracles.json" target="_blank" rel="noopener">Reference cases</a> · <a href="/reference/pyrestoolbox-pvt/LICENSE">Source license</a></p></details></div></div></div>`;
}
function makeTable(doc,headers,rows,caption) {
  const table=doc.createElement('table'),cap=doc.createElement('caption');cap.textContent=caption;table.append(cap);
  const head=doc.createElement('thead'),hrow=doc.createElement('tr');
  for(const label of headers) {const th=doc.createElement('th');th.scope='col';th.textContent=label;hrow.append(th);}head.append(hrow);table.append(head);
  const body=doc.createElement('tbody');
  for(const values of rows) {const tr=doc.createElement('tr');for(const value of values) {const td=doc.createElement('td');td.textContent=fmt(value);tr.append(td);}body.append(tr);}table.append(body);return table;
}
function putSvg(target,svg) {target.innerHTML=svg;}
function download(doc,text,name,type) {
  const url=URL.createObjectURL(new Blob([text],{type}));const anchor=doc.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function mountHydraulicsWorkspace(root=globalThis.document?.getElementById('hydraulics-workspace')) {
  if(!root) return null;
  if(root.hydraulicsWorkspace) return root.hydraulicsWorkspace;
  const doc=root.ownerDocument;root.classList.add('hyd-workspace');root.setAttribute('aria-labelledby','hydraulics-title');root.innerHTML=workspaceMarkup();
  const $=id=>root.querySelector('#'+id),form=$('hyd-form');
  // Main may have dispatched initial navigation before this module mounted.
  // Recover the explicit current route without restoring any calculation state.
  const initialHash=doc.defaultView?.location?.hash??doc.location?.hash??'';
  let current=null,revision=0,activeTab=initialHash==='#fluid/profiles'?'profiles':'hydraulics';
  const exports=[...root.querySelectorAll('[data-hyd-export]')];
  function switchTab(tab,focus=false) {
    if(!['hydraulics','profiles'].includes(tab)) return;
    activeTab=tab;
    for(const name of ['hydraulics','profiles']) {const button=$('hyd-tab-'+name);button.setAttribute('aria-selected',String(name===tab));button.tabIndex=name===tab?0:-1;$('hyd-panel-'+name).hidden=name!==tab;}
    if(focus)$('hyd-tab-'+tab).focus();
  }
  function invalidate(message='Inputs changed. Recalculate to update results and exports.') {
    revision++;current=null;exports.forEach(button=>button.disabled=true);$('hyd-results').hidden=true;$('hyd-empty').hidden=false;$('hyd-status').textContent=message;$('hyd-error').textContent='';
    for(const id of ['hyd-summary','hyd-pressure-chart','hyd-curve-table','hyd-fluid-table','hyd-depth-chart','hyd-depth-table','hyd-traverse-diagnostics','hyd-evidence','hyd-selected-status']) $(id).replaceChildren();
  }
  function modelControls() {
    const segmented=$('hyd-model').value==='segmented-brine';$('hyd-segmented-inputs').hidden=!segmented;
    $('hyd-model-note').textContent=segmented?'Local pressure and temperature update brine density, viscosity and volume along the well.':'Density, viscosity and volume factor stay fixed at the reference pressure and uniform temperature. Local depth profiles are unavailable.';
  }
  function snapshot() {
    const values={},model=form.elements.namedItem('model').value;
    for(const [key,label] of numericFields) {if(model==='uniform-brine'&&['surfaceTemperatureF','segments'].includes(key))continue;const raw=form.elements.namedItem(key).value.trim();if(!raw)throw Error(`Enter ${label.toLowerCase()}.`);values[key]=Number(raw);}
    for(const key of ['caseName','datum','model'])values[key]=form.elements.namedItem(key).value;
    return values;
  }
  function render(result) {
    current=result;$('hyd-results').hidden=false;$('hyd-empty').hidden=true;exports.forEach(button=>button.disabled=false);
    const point=result.point,status=$('hyd-selected-status');status.className='hyd-selected-status '+(point.operatingFeasible?'hyd-supported':'hyd-flagged');
    status.textContent=point.status==='shut-in'?'Shut-in at zero rate. Flowing pressures and local profiles are unavailable.':point.operatingFeasible?'Selected point passes the bounded model checks. Engineering screening; acceptance remains open.':`Selected point is unsupported or outside declared constraints. ${point.reasons.join(' ')}`;
    const cards=[['Required wellhead',point.requiredSurfacePsia,'psia'],['Required bottomhole',point.bottomholePsia,'psia'],['Gravity gain',point.hydrostaticPsi,'psi'],['Friction loss',point.frictionPsi,'psi']];
    $('hyd-summary').innerHTML=cards.map(([label,value,unit])=>`<div><span>${label}</span><strong>${esc(fmt(value))} <small>${value===null?'':unit}</small></strong></div>`).join('');
    putSvg($('hyd-pressure-chart'),pressureCurveSvg(result));
    const flagged=result.curve.filter(p=>!p.operatingFeasible).length;
    $('hyd-status').textContent=`Calculated ${result.inputs.model==='segmented-brine'?'depth-dependent':'uniform'} brine · ${fmt(point.rateStbd)} STB/day selected · ${flagged} flagged curve points. Downloads match these assumptions.`;
    $('hyd-curve-table').replaceChildren(makeTable(doc,['Rate STB/day','BHP psia','WHP psia','Gravity psi','Friction psi','Regime','Check / flags'],result.curve.map(p=>[p.rateStbd,p.bottomholePsia,p.requiredSurfacePsia,p.hydrostaticPsi,p.frictionPsi,p.regime,p.status==='shut-in'?'Shut-in':p.reasons.join(' ')||(p.operatingFeasible?'Bounded checks passed':'Unsupported')]),'Calculated pressure points; pressure references are distinct elevations linked by TVD.'));
    $('hyd-fluid-table').replaceChildren(makeTable(doc,['Reference property','Value','Unit'],[['Pressure',result.fluidProperties.pressurePsia,'psia'],['Temperature',result.inputs.temperatureF,'°F'],['NaCl salinity',result.inputs.salinityWtPercent,'wt%'],['Bw',result.fluidProperties.bwRbPerStb,'rb/STB'],['Density',result.fluidProperties.densityKgPerM3,'kg/m³'],['Viscosity',result.fluidProperties.viscosityCp,'cP'],['Compressibility',result.fluidProperties.compressibilityPerPsi,'1/psi']],'Reference-state properties; depth-dependent calculations use local states instead.'));
    const traverse=point.traverse;
    $('hyd-profile-property').disabled=!traverse;
    if(traverse) {
      $('hyd-profile-context').textContent=`Selected rate ${fmt(point.rateStbd)} STB/day. Depth increases downward from the wellhead. Local volumes are at local pressure/temperature; injection rate stays in stock-tank units.`;
      putSvg($('hyd-depth-chart'),depthProfileSvg(result,$('hyd-profile-property').value));
      $('hyd-traverse-diagnostics').textContent=`${traverse.segmentsUsed} refined intervals; convergence residual ${traverse.convergenceResidualPsi.toExponential(3)} psi; maximum velocity ${fmt(traverse.maximumVelocityMPerSecond)} m/s; maximum kinetic head ${fmt(traverse.maximumKineticHeadPsi)} psi. ${traverse.diagnostics.join(' ')}`;
      const keys=['measuredDepthFt','tvdFt','temperatureF','pressurePsia','bwRbPerStb','densityKgPerM3','viscosityCp','localFlowM3PerSecond','massFlowKgPerSecond','velocityMPerSecond','reynolds','darcyFrictionFactor','regime'];
      const precise=value=>typeof value==='number'&&value!==0&&Math.abs(value)<0.01?value.toPrecision(6):value;
      $('hyd-depth-table').replaceChildren(makeTable(doc,['MD ft','TVD ft','T °F','P psia','Bw rb/STB','Density kg/m³','Viscosity cP','Local flow m³/s','Mass flow kg/s','Velocity m/s','Reynolds','Darcy factor','Regime'],traverse.points.map(p=>keys.map(key=>precise(p[key]))),'Calculated local depth nodes; exact precision retained in JSON and CSV.'));
    } else {
      $('hyd-profile-context').textContent=point.status==='shut-in'?'No flowing profile at zero rate. Enter a positive rate and calculate.':result.inputs.model==='uniform-brine'?'Uniform brine calculates endpoint contributions. Choose depth-dependent brine and recalculate to inspect local depth nodes.':`No local depth profile is available for this unsupported point. ${point.reasons.join(' ')}`;
      $('hyd-depth-chart').replaceChildren();$('hyd-depth-table').replaceChildren();$('hyd-traverse-diagnostics').replaceChildren();
    }
    const evidence=$('hyd-evidence');
    for(const [title,text] of Object.entries(result.methods)) {const p=doc.createElement('p');const strong=doc.createElement('strong');strong.textContent=title[0].toUpperCase()+title.slice(1)+': ';p.append(strong,doc.createTextNode(text));evidence.append(p);}
    for(const text of result.limitations) {const p=doc.createElement('p');p.textContent=text;evidence.append(p);}
    const pre=doc.createElement('pre');pre.textContent=JSON.stringify({methodVersion:result.methodVersion,inputs:result.inputs,units:result.units,provenance:result.provenance},null,2);evidence.append(pre);
    switchTab(activeTab);
  }
  form.addEventListener('input',()=>{modelControls();invalidate();});
  form.addEventListener('change',()=>{modelControls();invalidate();});
  form.addEventListener('submit',event=> {
    event.preventDefault();invalidate('Calculating the declared wellbore and rate grid…');
    try {const result=calculateHydraulics(snapshot());render(result);} catch(error) {$('hyd-error').textContent=error.message;$('hyd-status').textContent='Calculation blocked. Correct the input or unsupported numerical condition and calculate again.';}
  });
  $('hyd-reset').addEventListener('click',()=>{for(const [key,value] of Object.entries(HYDRAULICS_DEFAULTS))form.elements.namedItem(key).value=String(value);modelControls();invalidate('Fictional assumed defaults restored. Review them and calculate.');});
  root.querySelectorAll('[data-hyd-tab]').forEach(button=> {
    button.addEventListener('click',()=>switchTab(button.dataset.hydTab));
    button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();switchTab(event.key==='Home'?'hydraulics':event.key==='End'?'profiles':activeTab==='hydraulics'?'profiles':'hydraulics',true);}});
  });
  $('hyd-profile-property').addEventListener('change',()=>{if(current?.point.traverse)putSvg($('hyd-depth-chart'),depthProfileSvg(current,$('hyd-profile-property').value));});
  exports.forEach(button=>button.addEventListener('click',()=> {
    if(!current)return;
    try {
      if(JSON.stringify(validateHydraulicsInputs(snapshot()))!==JSON.stringify(current.inputs)){invalidate();return;}
      const kind=button.dataset.hydExport;
      const content=kind==='json'?JSON.stringify(current,null,2)+'\n':kind==='csv'?hydraulicsCsv(current):hydraulicsSvg(current);
      download(doc,content,`swd-standalone-hydraulics.${kind}`,kind==='json'?'application/json':kind==='csv'?'text/csv;charset=utf-8':'image/svg+xml;charset=utf-8');
    } catch(error) {invalidate('The export is blocked. Review current assumptions and recalculate.');$('hyd-error').textContent=error.message;}
  }));
  const navigation=event=>switchTab(event.detail?.view);
  doc.addEventListener('workspace-navigation',navigation);
  const api={switchTab,invalidate,getResult:()=>current?clone(current):null,getRevision:()=>revision,destroy:()=>{doc.removeEventListener('workspace-navigation',navigation);root.replaceChildren();delete root.hydraulicsWorkspace;}};
  root.hydraulicsWorkspace=api;modelControls();switchTab(activeTab);return api;
}

if(typeof document!=='undefined') mountHydraulicsWorkspace();
