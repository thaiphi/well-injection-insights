import {buildLiteratureExample,literatureExampleJson,literatureExampleCsv,literatureExampleSvg} from '/dist/literatureExample.js';

/** Independent literature workspace. No active planning/import/public data is consumed. */
export function mountLiteratureCase(section){
 if(section.dataset.literatureMounted==='true')return;
 section.dataset.literatureMounted='true';section.classList.add('literature-workspace');
 section.innerHTML=`
  <div class="literature-heading"><p class="literature-eyebrow">Literature example · independent inputs</p><h2>How much pressure does assumed skin add?</h2><p>Explore published Entrada formation parameters with an assumed steady skin factor. This example uses its own cited fixture and inputs.</p><p class="literature-lead-result" hidden></p></div>
  <div class="literature-boundary"><strong>Educational steady radial calculation</strong><p>Formation pressure is <strong>reported psi; absolute/gauge unspecified</strong>, at a common formation datum. Rate is reservoir bbl/day. No wellhead pressure, oil-invasion history, geomechanics or seismic prediction is calculated.</p></div>
  <div class="literature-grid"><form class="literature-form" novalidate aria-label="Literature example assumptions">
   <h3>Choose the comparison</h3><p><span class="literature-tag assumed">Assumed</span> Baseline skin: 0. The comparison skin is your assumption; it is not a measured value or a skin result from the paper. The full 15 ft formation thickness is assumed to contribute to flow.</p>
   <label for="literature-skin">Comparison skin (dimensionless)</label><input id="literature-skin" name="skin" type="number" min="0" max="50" step="any" value="5" required aria-describedby="literature-skin-help"><small id="literature-skin-help">Supported comparison range: 0–50.</small>
   <label for="literature-rate">Selected rate (reservoir bbl/day)</label><input id="literature-rate" name="rate" type="number" min="2000" max="10000" step="any" value="5000" required aria-describedby="literature-rate-help"><small id="literature-rate-help">Table A1 rate range: 2,000–10,000. No stock-tank conversion is applied.</small>
   <button type="submit" class="literature-calculate" disabled>Calculate pressure comparison</button><p class="literature-status" role="status" aria-live="polite">Checking the cited fixture…</p><p class="literature-error" role="alert"></p>
  </form><aside class="literature-source" aria-label="Published parameters and source"><h3>Published parameters <span class="literature-tag">Literature</span></h3><dl><dt>Permeability</dt><dd>256 mD</dd><dt>Formation thickness</dt><dd>15 ft (4.572 m)</dd><dt>Well / formation radius</dt><dd>0.292 / 1,000 ft</dd><dt>Formation pressure</dt><dd>2,560 reported psi</dd><dt>Water viscosity</dt><dd>1 cP</dd><dt>Published fracturing reference</dt><dd>4,334 reported psi — comparison reference only</dd></dl><p>Jin, Wojtanowicz &amp; Ge (2022), <em>Energies</em> 15, 2101. Appendix A, Table A1 (PDF p18); equations 18, 21 and 22 (PDF p10).</p><p><a href="https://doi.org/10.3390/en15062101" target="_blank" rel="noopener noreferrer">DOI: 10.3390/en15062101</a> · <a href="https://psecommunity.org/wp-content/plugins/wpor/includes/file/2303/LAPSE-2023.14636-1v1.pdf" target="_blank" rel="noopener noreferrer">Full paper (PDF)</a></p><p class="literature-reference-note">The published reference is never an operating, permitted or safe pressure limit.</p></aside></div>
  <div class="literature-results" hidden><div class="literature-answer" aria-live="polite"></div><div class="literature-downloads" aria-label="Download literature example"><button type="button" data-literature-download="json" disabled>Download JSON</button><button type="button" data-literature-download="csv" disabled>Download CSV</button><button type="button" data-literature-download="svg" disabled>Download SVG</button></div><p class="literature-download-note">Each download includes the complete input, method, units, source, assumptions and exact fixture hash. No dedicated PDF export is available for this example.</p><div class="literature-chart" role="region" tabindex="0" aria-label="Literature pressure and rate chart"></div><div class="literature-table-wrap" role="region" tabindex="0" aria-label="Literature numerical results"></div><details class="literature-method"><summary>Method, paired units and provenance</summary><p>Equation 18: Iw = 2×10⁻⁶ π h K / [μ (ln(re/rw) + S)]. Equations 21–22: Δp = q/Iw, prw = pre + Δp. Use h in m, K in Darcy, μ in cP, q in reservoir m³/s and Δp in kPa.</p><p>The literal published coefficient approximates 1 Darcy as 10⁻¹² m². Exact Darcy conversion would raise pressure differences by about 1.325%. This example retains the published coefficient.</p><p>Field-side Table A1 parameters are converted consistently. The inconsistent oil-density and depth pairs are excluded; neither enters this calculation.</p><div class="literature-provenance"></div></details></div>`;
 const $=selector=>section.querySelector(selector),form=$('form'),status=$('.literature-status'),error=$('.literature-error'),results=$('.literature-results'),buttons=[...section.querySelectorAll('[data-literature-download]')];
 let fixtureText=null,current=null,revision=0;
 function invalidate(message='Inputs changed. Calculate again to refresh results and downloads.'){
  $('.literature-lead-result').hidden=true;$('.literature-lead-result').textContent='';
  current=null;results.hidden=true;$('.literature-chart').replaceChildren();$('.literature-table-wrap').replaceChildren();$('.literature-answer').replaceChildren();buttons.forEach(b=>b.disabled=true);error.textContent='';status.textContent=message;
 }
 function render(r){
  const f=n=>n.toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2});
  $('.literature-lead-result').textContent=`Calculated: +${f(r.selected.penaltyPsi)} psi at ${r.selected.rateBblPerDay.toLocaleString('en-US')} reservoir bbl/day · assumed skin 0 → ${r.inputs.skin}`;
  $('.literature-lead-result').hidden=false;
  const answer=$('.literature-answer');answer.innerHTML='<span class="literature-tag calculated">Calculated</span><h3 class="literature-penalty"></h3><p class="literature-pressure-summary"></p>';
  answer.querySelector('h3').textContent=`${f(r.selected.penaltyPsi)} psi added at ${r.selected.rateBblPerDay.toLocaleString('en-US')} reservoir bbl/day`;
  answer.querySelector('p').textContent=`Required formation pressure rises from ${f(r.selected.baselinePressurePsi)} to ${f(r.selected.comparedPressurePsi)} reported psi as assumed skin changes from 0 to ${r.inputs.skin}. This is a calculated comparison, not a paper curve or measured field result.`;
  $('.literature-chart').innerHTML=literatureExampleSvg(r);
  const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Calculated steady pressure comparison · common formation datum';table.append(caption);
  const head=document.createElement('thead'),tr=document.createElement('tr');for(const title of ['Rate (reservoir bbl/day)','Baseline skin 0 (reported psi)',`Assumed skin ${r.inputs.skin} (reported psi)`,'Added pressure (psi)']){const th=document.createElement('th');th.scope='col';th.textContent=title;tr.append(th);}head.append(tr);table.append(head);
  const body=document.createElement('tbody');for(const p of r.rows){const row=document.createElement('tr');for(const value of [p.rateBblPerDay,p.baselinePressurePsi,p.comparedPressurePsi,p.penaltyPsi]){const td=document.createElement('td');td.textContent=f(value);row.append(td);}body.append(row);}table.append(body);$('.literature-table-wrap').replaceChildren(table);
  const provenance=$('.literature-provenance');provenance.replaceChildren();for(const [label,value]of [['Fixture SHA-256',r.provenance.fixture.sha256],['Exhibit SHA-256',r.contentSha256],['Source verification',r.provenance.source.verification],['Scope',r.provenance.assumptions.scope]]){const p=document.createElement('p');p.textContent=`${label}: ${value}`;provenance.append(p);}
  for(const text of r.limitations){const p=document.createElement('p');p.textContent=text;provenance.append(p);}
  current=r;results.hidden=false;buttons.forEach(b=>b.disabled=false);status.textContent='Calculation current. Downloads match the displayed assumptions and results.';
 }
 function calculate(){
  invalidate('Calculating the literature example…');
  try{if(fixtureText===null)throw Error('The cited fixture is not available.');render(buildLiteratureExample(fixtureText,{skin:$('#literature-skin').valueAsNumber,selectedRateBblPerDay:$('#literature-rate').valueAsNumber}));}
  catch(e){invalidate('Calculation blocked. Correct the inputs and calculate again.');error.textContent=e.message;}
 }
 form.addEventListener('input',()=>{revision++;invalidate();});form.addEventListener('change',()=>{revision++;invalidate();});form.addEventListener('submit',e=>{e.preventDefault();calculate();});
 for(const button of buttons)button.addEventListener('click',()=>{
  if(!current)return;
  const kind=button.dataset.literatureDownload;
  try{const serialize={json:literatureExampleJson,csv:literatureExampleCsv,svg:literatureExampleSvg},mime={json:'application/json',csv:'text/csv;charset=utf-8',svg:'image/svg+xml;charset=utf-8'};
   const blob=new Blob([serialize[kind](current)],{type:mime[kind]}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`swd-literature-entrada-skin.${kind}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){invalidate('Export blocked. Calculate again to refresh the technical record.');error.textContent=e.message;}
 });
 return fetch('/data/scenarios/literature-example.json').then(response=>{if(!response.ok)throw Error(`Cited fixture unavailable (HTTP ${response.status}).`);return response.text();}).then(text=>{
  // Builder verifies exact bytes before this fixture becomes available to the form.
  buildLiteratureExample(text,{skin:5,selectedRateBblPerDay:5000});fixtureText=text;$('.literature-calculate').disabled=false;
  if(revision===0)calculate();else status.textContent='Cited fixture verified. Calculate with the current assumptions.';
 }).catch(e=>{invalidate('Literature example unavailable: its cited fixture could not be verified.');error.textContent=e.message;});
}
