import {planningFixture,planningDetails} from '/dist/planningFixture.js';
import { INJECTORS, capacity, pressureRateCurve, brineProperties } from '/dist/engineering.js';
import { syntheticActuals, freezeForecast, planningCase, CUTOFF, FIXTURE_ID } from '/dist/planning.js';
import { buildExhibit, exhibitCsv } from '/dist/exhibit.js';
import { exhibitSvg } from '/dist/exhibitSvg.js';
import { validatePublicArtifact } from '/dist/publicArtifact.js';

const $ = (id) => document.getElementById(id);
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const format = (n) => n === null || n === undefined ? 'Not reported' : number.format(n);
const monthLabel = (month) => new Date(`${month}-15T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
// Fit only once. Changing scenario assumptions never changes observations or forecast coefficients.
const actuals = syntheticActuals();
const frozen = freezeForecast(actuals);
let publicArtifact = null;
let publicPin = null;
let current = null;
let renderVersion = 0;
let currentVersion = 0;
let pdfBusy = false;
// The workspace selects sources explicitly; imports never inherit demo results.
export function publicEvidence(){return {artifact:publicArtifact,pin:publicPin};}
export function demoEvidence(){return currentVersion===renderVersion?current:null;}
let workspaceSource = null;
let workspaceVersion = 0;
document.addEventListener('workspace-source', event => { workspaceSource=event.detail; workspaceVersion++; });

function element(name, text, className) {
  const node = document.createElement(name);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function definition(target, label, value) {
  const group = element('div');
  group.append(element('dt', label), element('dd', value));
  target.append(group);
  return group.lastChild;
}
function svgElement(name, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function plot(targetId, title, description, xLabels, yMax, unit, width = 720, height = 330) {
  const margin = { left: 62, right: 22, top: 30, bottom: 46 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': `${targetId}-title ${targetId}-desc` });
  svg.append(svgElement('title', { id: `${targetId}-title` }, title), svgElement('desc', { id: `${targetId}-desc` }, description));
  const max = Math.ceil(yMax / 5) * 5 || 1;
  const x = (i) => margin.left + (xLabels.length < 2 ? w / 2 : i * w / (xLabels.length - 1));
  const y = (value) => margin.top + h - value / max * h;
  for (let i = 0; i <= 4; i++) {
    const value = max * i / 4;
    svg.append(svgElement('line', { x1: margin.left, x2: width - margin.right, y1: y(value), y2: y(value), stroke: '#d9e3e8', 'stroke-width': 1 }));
    svg.append(svgElement('text', { x: margin.left - 10, y: y(value) + 4, 'text-anchor': 'end' }, format(value)));
  }
  svg.append(svgElement('text', { x: margin.left, y: 15, class: 'axis-title' }, unit));
  xLabels.forEach((label, i) => svg.append(svgElement('text', { x: x(i), y: height - 21, 'text-anchor': 'middle' }, label)));
  $(targetId).replaceChildren(svg);
  return { svg, x, y, max, base: y(0) };
}
function line(chart, values, color, dashed = false, yKey, xKey) {
  const points = values.map((value, i) => `${chart.x(xKey ? value[xKey] : i)},${chart.y(yKey ? value[yKey] : value)}`).join(' ');
  const node = svgElement('polyline', { points, fill: 'none', stroke: color, 'stroke-width': 2.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  if (dashed) node.setAttribute('stroke-dasharray', '7 5');
  chart.svg.append(node);
}
function drawCapacity(rows) {
  const chart = plot('capacity-chart', 'Monthly available capacity and planned water demand', rows.map(r => `${r.month}: demand ${format(r.demandBbl)} bbl; capacity ${format(r.capacityBbl)} bbl; shortfall ${format(r.shortfallBbl)} bbl.`).join(' '), rows.map(r => monthLabel(r.month)), Math.max(...rows.flatMap(r => [r.capacityBbl, r.demandBbl])) * 1.12, 'Monthly water (bbl)', 920, 280);
  const path = [`${chart.x(0)},${chart.base}`, ...rows.map((r, i) => `${chart.x(i)},${chart.y(r.demandBbl)}`), `${chart.x(rows.length - 1)},${chart.base}`].join(' ');
  chart.svg.append(svgElement('polygon', { points: path, fill: '#8bd4dc', opacity: 0.3 }));
  line(chart, rows.map(r => r.demandBbl), '#1596a3');
  line(chart, rows.map(r => r.capacityBbl), '#1262b5');
  rows.forEach((r, i) => {
    if (r.shortfallBbl > 0) {
      const marker = svgElement('circle', { cx: chart.x(i), cy: chart.y(r.demandBbl), r: 4.5, fill: '#b54735', stroke: '#fff', 'stroke-width': 1.5 });
      marker.append(svgElement('title', {}, `${r.month}: shortfall ${format(r.shortfallBbl)} bbl`));
      chart.svg.append(marker);
    }
  });
}
function drawForecast(rows) {
  const chart = plot('forecast-chart', 'Frozen forecast compared with synthetic actuals', rows.map(r => `${r.month}: forecast ${format(r.forecastBbl)} bbl; synthetic actual ${format(r.actualBbl)} bbl.`).join(' '), rows.map(r => monthLabel(r.month)), Math.max(...rows.flatMap(r => [r.forecastBbl, r.actualBbl])) * 1.12, 'Monthly water (bbl)', 570, 290);
  line(chart, rows.map(r => r.forecastBbl), '#1262b5', true);
  line(chart, rows.map(r => r.actualBbl), '#102e52');
  rows.forEach((r, i) => chart.svg.append(svgElement('circle', { cx: chart.x(i), cy: chart.y(r.actualBbl), r: 3, fill: '#102e52' })));
}
function drawPressure(injectors) {
  const chart = plot('pressure-chart', 'Fictional injector pressure versus rate', `Both injectors start at 2,000 bottomhole psia. Injector A injectivity is ${injectors[0].injectivityStbdPerPsi} STB/d/psi; Injector B is ${injectors[1].injectivityStbdPerPsi}. Dashed limit is 3,500 bottomhole psia. All share the same formation reference depth.`, ['0', '2,500', '5,000', '7,500', '10,000'], 6000, 'Bottomhole pressure (psia)', 570, 290);
  const position = { ...chart, x: (rate) => chart.x(rate / 2500) };
  injectors.forEach((injector, i) => line(position, pressureRateCurve(injector), i === 0 ? '#1262b5' : '#1596a3', false, 'bottomholePsia', 'rateStbd'));
  chart.svg.append(svgElement('line', { x1: chart.x(0), x2: chart.x(4), y1: chart.y(3500), y2: chart.y(3500), stroke: '#b54735', 'stroke-width': 1.8, 'stroke-dasharray': '6 4' }));
  chart.svg.append(svgElement('text', { x: chart.x(4), y: chart.y(3500) - 8, 'text-anchor': 'end' }, 'Assumed limit · 3,500 psia'));
  chart.svg.append(svgElement('text', { x: chart.x(4), y: 285, 'text-anchor': 'end', class: 'axis-title' }, 'Injection rate (STB/d)'));
}
function readControls() {
  return { newWellStart: $('new-well-start').value, expansionMonth: $('expansion-month').value, expansionStbd: Number($('expansion-rate').value), availability: Number($('availability').value), injectorAInjectivity: Number($('injectivity').value), newWellRamp:Number($('new-well-ramp').value), newWellAvailability:Number($('new-well-availability').value) };
}
function summary(label, value, alert = false) {
  const item = element('div', undefined, `summary-item${alert ? ' alert' : ''}`);
  item.append(element('strong', value), element('span', label));
  return item;
}
function renderTable(rows) {
  let cumulative=0;
  const body = $('case-table').tBodies[0];
  body.replaceChildren();
  for (const row of rows) {
    const tr = element('tr');
    const month = element('th', row.month);
    month.scope = 'row';
    tr.append(month);
    cumulative+=row.varianceBbl;
    const values = [String(row.days), format(row.forecastBbl), format(row.actualBbl), format(row.varianceBbl), format(cumulative), row.variancePct === null ? 'Not defined' : `${row.variancePct >= 0 ? '+' : ''}${decimal.format(row.variancePct)}%`, format(row.demandBbl), format(row.capacityBbl), format(row.headroomBbl)];
    values.forEach((value, i) => tr.append(element('td', value, i === 8 && row.headroomBbl < 0 ? 'negative' : undefined)));
    body.append(tr);
  }
}
function renderInputTable(id,headers,records) {
 const table=$(id);table.replaceChildren();const head=element('thead'),hr=element('tr');for(const title of headers){const th=element('th',title);th.scope='col';hr.append(th);}head.append(hr);table.append(head);const body=element('tbody');for(const record of records){const tr=element('tr');for(const value of record)tr.append(element('td',value));body.append(tr);}table.append(body);
}
function renderPlanningInputs(fixture,details) {
 const groups=new Map(fixture.producers.map(p=>[p.id,p.groupId]));
 renderInputTable('history-inputs',['Producer','Group','Month','Rate STB/day','Volume STB','Content','Period'],fixture.actuals.map(r=>[r.producerId,groups.get(r.producerId),r.month,format(r.rateStbd),format(r.volumeBbl),r.kind,r.month<=frozen.cutoff?'Training':'Independent holdout']));
 renderInputTable('producer-contributions',['Producer','Group','Month','Demand STB','Contribution'],details.producerMonths.map(r=>[r.producerId,r.groupId,r.month,format(r.volumeBbl),r.contribution]));
 renderInputTable('group-contributions',['Group','Month','Demand STB'],details.groups.map(r=>[r.groupId,r.month,format(r.volumeBbl)]));
 $('planning-metadata').textContent=JSON.stringify({fixtureId:fixture.id,actualsId:fixture.actualsId,generator:fixture.generator,cutoff:frozen.cutoff,groups:fixture.groups,producers:fixture.producers,schedules:fixture.schedules,fitModels:frozen.models},null,2);
}
async function render() {
  const version = ++renderVersion;
  $('demo-workbook').dataset.current='false';
  document.dispatchEvent(new Event('demo-updated'));
  $('download-csv').disabled = true;
  $('download-json').disabled = true;
  $('download-svg').disabled = true;
  $('download-pdf').disabled = true;
  $('export-status').textContent = 'Preparing exhibit for the displayed case…';
  try {
    if (!$('controls').checkValidity()) {
      const invalid=$('controls').querySelector(':invalid');
      $('app-error').textContent = `Correct the scenario input: ${invalid?.labels?.[0]?.textContent.trim()??'invalid control'}. ${invalid?.validationMessage??''}`;
      $('app-error').hidden = false;
      $('export-status').textContent = 'Export unavailable until all scenario inputs are valid.';
      return;
    }
    const controls = readControls();
    $('availability-value').textContent = `${Math.round(controls.availability * 100)}%`;
    $('current-assumptions').textContent = `Current case: new producer starts ${controls.newWellStart}; injector availability ${Math.round(controls.availability * 100)}%; Injector A injectivity ${controls.injectorAInjectivity} STB/d/psi; ${format(controls.expansionStbd)} STB/d of available expansion starts ${controls.expansionMonth}.`;
    const injectors = INJECTORS.map((injector, i) => ({ ...injector, availability: controls.availability, injectivityStbdPerPsi: i === 0 ? controls.injectorAInjectivity : injector.injectivityStbdPerPsi }));
    const fixture=planningFixture(controls.newWellStart);
    fixture.schedules[0].rampMonths=controls.newWellRamp;
    fixture.schedules[0].availabilityByMonth=Object.fromEntries(months.map(m=>[m,controls.newWellAvailability]));
    const details=planningDetails(fixture,frozen);
    const rows = planningCase(frozen, actuals, injectors, controls.newWellStart, controls.expansionMonth, controls.expansionStbd).map(row=>{
      const newDemandStbd=details.producerMonths.filter(r=>r.month===row.month&&r.contribution==='assumed-schedule').reduce((sum,r)=>sum+r.rateStbd,0);
      const demandStbd=row.forecastStbd+newDemandStbd,demandBbl=demandStbd*row.days;
      return {...row,newDemandStbd,demandStbd,demandBbl,headroomBbl:row.capacityBbl-demandBbl,shortfallBbl:Math.max(0,demandBbl-row.capacityBbl)};
    });
    renderPlanningInputs(fixture,details);
    const deficient = rows.filter(r => r.shortfallBbl > 0);
    const shortfall = rows.reduce((sum, r) => sum + r.shortfallBbl, 0);
    const actualTotal = rows.reduce((sum, r) => sum + r.actualBbl, 0);
    const forecastTotal = rows.reduce((sum, r) => sum + r.forecastBbl, 0);
    const peak = rows.reduce((max, r) => r.demandStbd > max.demandStbd ? r : max, rows[0]);
    $('case-summary').replaceChildren(summary('months with a capacity shortfall', `${deficient.length} of 12`, deficient.length > 0), summary('annual unmet planned volume', `${format(shortfall)} bbl`, shortfall > 0), summary('peak planned demand', `${format(peak.demandStbd)} STB/d`));
    $('case-reading').textContent = deficient.length ? `Demand first exceeds available capacity in ${monthLabel(deficient[0].month)} 2026. The largest monthly shortfall is ${format(Math.max(...rows.map(r => r.shortfallBbl)))} bbl. Try shifting the producer start, restoring injectivity, or increasing available expansion.` : 'Available capacity covers planned demand in all twelve months under these assumptions. Positive headroom remains sensitive to injectivity, downtime and the new producer schedule.';
    $('injector-capacities').replaceChildren();
    injectors.forEach((injector, i) => definition($('injector-capacities'), `Injector ${i === 0 ? 'A' : 'B'} available`, `${format(capacity(injector).availableStbd)} STB/d`));
    $('forecast-note').textContent = `Frozen through ${CUTOFF}; 2026 is the holdout. Annual synthetic actual minus forecast: ${format(actualTotal - forecastTotal)} bbl (${decimal.format(100 * (actualTotal - forecastTotal) / forecastTotal)}%). Schedule edits leave this comparison unchanged.`;
    drawCapacity(rows);
    drawForecast(rows);
    drawPressure(injectors);
    renderTable(rows);
    $('app-error').hidden = true;
    const exhibit = await buildExhibit({ frozen, rows, injectors, controls, publicArtifact, planningFixture:fixture });
    if (version !== renderVersion) return;
    current = exhibit;
    currentVersion = version;
    $('demo-workbook').dataset.current='true';
    $('download-csv').disabled = false;
    $('download-json').disabled = false;
    $('download-svg').disabled = false;
    $('download-pdf').disabled = pdfBusy;
    $('export-status').textContent = publicArtifact ? 'Exhibit includes this case and pinned public history.' : 'Exhibit includes this case. Public history is not loaded.';
  } catch (error) {
    if (version !== renderVersion) return;
    $('app-error').textContent = `The planning case could not be prepared: ${error.message}`;
    $('app-error').hidden = false;
    $('export-status').textContent = 'Export unavailable until the case can be prepared.';
  } finally {
    if(version===renderVersion)document.dispatchEvent(new Event('demo-updated'));
  }
}
function download(contents, name, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = element('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadPublic() {
  try {
    const [pinResponse, response] = await Promise.all([
      fetch('/data/explorer-pin.json', { cache: 'no-store' }),
      fetch('/data/explorer/normalized.json', { cache: 'no-store' }),
    ]);
    if (!pinResponse.ok) throw new Error(`Explorer artifact pin returned HTTP ${pinResponse.status}`);
    if (!response.ok) throw new Error(`Pinned public artifact returned HTTP ${response.status}`);
    const pin = await pinResponse.json();
    if (typeof pin.artifactId !== 'string' || !pin.artifactId || !/^[a-f0-9]{64}$/i.test(pin.normalizedSha256 ?? '')) throw new Error('Explorer artifact pin is missing its identity or SHA-256');
    const bytes = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const normalizedSha256 = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
    if (normalizedSha256 !== pin.normalizedSha256.toLowerCase()) throw new Error('Explorer artifact bytes do not match the pinned SHA-256');
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (parsed.artifactId !== pin.artifactId) throw new Error('Explorer artifact identity does not match the pin');
    publicArtifact = await validatePublicArtifact(parsed);
    publicPin = pin;
    renderPublic(publicArtifact);
  } catch (error) {
    publicArtifact = null;
    publicPin = null;
    $('public-status').classList.add('error');
    $('public-status').textContent = `Public history unavailable: ${error.message}. The fictional planning case remains usable. Restore the pinned Explorer export and reload to include its evidence.`;
    $('public-content').hidden = true;
  }
  await render();
}
function renderPublic(artifact) {
  const body = $('public-table').tBodies[0];
  body.replaceChildren();
  const rows = [...artifact.injectionMonthly].sort((a, b) => a.period_start.localeCompare(b.period_start) || a.source_row_key.localeCompare(b.source_row_key));
  for (const row of rows) {
    const tr = element('tr');
    const month = element('th', `${row.reporting_year}-${String(row.reporting_month).padStart(2, '0')}`);
    month.scope = 'row';
    tr.append(month, element('td', format(row.injected_liquid_bbl)), element('td', format(row.reported_avg_injection_pressure_psi)), element('td', format(row.reported_max_injection_pressure_psi)), element('td', row.source_row_key));
    body.append(tr);
  }
  const provenance = $('public-provenance');
  provenance.replaceChildren();
  definition(provenance, 'Pinned artifact', artifact.artifactId);
  definition(provenance, 'Verified normalized SHA-256', publicPin.normalizedSha256);
  const usedParents = new Set(rows.map(r => r.parent_key));
  const parents = artifact.inventory.filter(r => usedParents.has(r.source_record_key));
  definition(provenance, 'Parent with acquired history', parents.map(r => `UIC ${r.uic_number} / API ${r.api_no} / ${r.lease_name ?? 'Lease not reported'} / well ${r.well_no_display ?? 'not reported'}`).join('; '));
  definition(provenance, 'Reported period', `${rows[0].period_start} to ${rows.at(-1).period_start}`);
  definition(provenance, 'Monthly liquid total', `${format(rows.reduce((sum, r) => sum + (r.injected_liquid_bbl ?? 0), 0))} bbl across ${rows.length} source rows`);
  const manifest = definition(provenance, 'Acquisition & provenance', '');
  const link = element('a', 'Open the source manifest');
  link.href = '/data/explorer/manifest.json';
  manifest.append(link);
  manifest.append(document.createTextNode(' · '));
  const qualityLink = element('a', 'Quality report');
  qualityLink.href = '/data/explorer/quality_report.json';
  manifest.append(qualityLink);
  definition(provenance, 'Evidence labels', 'Monthly liquid and pressure: public reported. Calendar-day average: calculated. Missing values remain unreported.');
  for (const source of artifact.manifest.sources ?? []) {
    if (source.kind !== 'inventory' && source.kind !== 'monthly') continue;
    const sourceValue = definition(provenance, `${source.kind === 'monthly' ? 'Monthly history' : 'Inventory'} source`, '');
    let url;
    try { url = new URL(source.url); } catch { url = null; }
    if (url?.protocol === 'https:') {
      const sourceLink = element('a', 'Official source query');
      sourceLink.href = url.href;
      sourceValue.append(sourceLink, document.createTextNode(`. Retrieved ${source.retrieved_at}. SHA-256: ${source.sha256}`));
    } else sourceValue.textContent = `Source URL not usable. Retrieved ${source.retrieved_at}. SHA-256: ${source.sha256}`;
  }
  definition(provenance, 'Acquisition scope', `${parents.length} UIC with acquired monthly history; ${artifact.inventory.length} bounded inventory candidates. Other candidates have no acquired history here and are not represented as zero injection.`);
  definition(provenance, 'Source limitations', (artifact.manifest.limitations ?? []).join(' '));
  $('public-status').textContent = `${rows.length} public monthly rows loaded with matched parent identities. Source acquisition and independent reconciliation are documented in the manifest and quality report. Reported pressures remain source-reported psi with an unspecified pressure basis.`;
  $('public-content').hidden = false;
}

for (const id of ['new-well-start', 'expansion-month']) {
  const select = $(id);
  for (const month of months) {
    const option = element('option', `${monthLabel(month)} 2026`);
    option.value = month;
    select.append(option);
  }
}
$('new-well-start').value = '2026-04';
$('expansion-month').value = '2026-08';
$('fixture-note').textContent = `Synthetic fixture: ${FIXTURE_ID}. Forecast cutoff: ${CUTOFF}. Training: ${frozen.trainingMonths.length} months for each of ${frozen.models.length} fictional producers.`;
const brine = brineProperties(3000, 180, 50000);
definition($('brine-reference'), 'Formation volume factor', `${brine.bwRbPerStb.toFixed(4)} rb/STB`);
definition($('brine-reference'), 'Brine density', `${brine.densityLbPerFt3.toFixed(2)} lb/ft³`);
definition($('brine-reference'), 'Viscosity', `${brine.viscosityCp.toFixed(3)} cP`);
definition($('brine-reference'), 'Compressibility', `${brine.compressibilityPerPsi.toExponential(3)} psi⁻¹`);
$('controls').addEventListener('input', render);
$('controls').addEventListener('submit', (event) => event.preventDefault());
$('download-json').addEventListener('click', () => { if (current) download(`${JSON.stringify(current, null, 2)}\n`, 'swd-technical-exhibit.json', 'application/json'); });
$('download-csv').addEventListener('click', () => { if (current) download(exhibitCsv(current), 'swd-technical-exhibit.csv', 'text/csv;charset=utf-8'); });
$('download-svg').addEventListener('click', () => { if (current) download(exhibitSvg(current), 'swd-technical-exhibit.svg', 'image/svg+xml;charset=utf-8'); });
$('download-pdf').addEventListener('click', async () => {
  const button = $('download-pdf');
  if (!current || pdfBusy || button.disabled) return;
  const exhibit = current;
  const version = renderVersion;
  const sourceVersion = workspaceVersion;
  pdfBusy = true;
  button.disabled = true;
  button.textContent = 'Preparing PDF…';
  $('export-status').textContent = 'Preparing a PDF of the displayed case…';
  try {
    const { exhibitPdf } = await import('./exhibit-pdf.mjs');
    const bytes = await exhibitPdf(exhibit);
    // A control edit during PDF generation must never download the old case.
    if (version !== renderVersion || exhibit !== current || workspaceSource !== 'demo' || sourceVersion !== workspaceVersion) return;
    download(bytes, 'swd-technical-exhibit.pdf', 'application/pdf');
    $('export-status').textContent = 'PDF download started for the displayed case.';
  } catch (error) {
    if (version === renderVersion) $('export-status').textContent = `The PDF could not be prepared: ${error.message}. Try Download PDF again.`;
  } finally {
    pdfBusy = false;
    button.textContent = 'Download PDF';
    button.disabled = !current || currentVersion !== renderVersion;
  }
});
document.querySelectorAll('.table-scroll').forEach((node) => { node.tabIndex = 0; node.setAttribute('role', 'region'); if(!node.hasAttribute('aria-label'))node.setAttribute('aria-label', 'Scrollable monthly data table'); });
await render();
await loadPublic();

