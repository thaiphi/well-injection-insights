import type { Exhibit } from './exhibit.js';
import {verifiedExhibit} from './exhibitIntegrity.js';

const ink = '#173d54', blue = '#32799c', sand = '#a98b4d', rust = '#9b432d';
const xml = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const rounded = (value: number) => value.toFixed(3).replace(/\.?0+$/, '');
const display = (value: number | null) => value === null ? 'Not defined' : new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value);
const text = (x: number, y: number, value: unknown, size = 14, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${xml(value)}</text>`;
type Series = {label: string; color: string; values: {x: number; y: number}[]; dashed?: boolean};

/** Presentation only: all plotted values come from the committed technical exhibit. */
function chart(x: number, y: number, width: number, title: string, unit: string, labels: string[], series: Series[], xMax: number, minimumY = 0, shortfalls: number[] = []) {
  const height = 290, left = 76, right = 24, top = 60, bottom = 60;
  const peak=Math.max(minimumY, ...series.flatMap(s => s.values.map(v => v.y)));
  const padded=Math.ceil(peak*1.12/5)*5;
  const max=(Number.isFinite(padded)?padded:peak)||1;
  const px = (v: number) => left + (xMax === 0 ? (width - left - right) / 2 : v / xMax * (width - left - right));
  const py = (v: number) => top + (height - top - bottom) * (1 - v / max);
  const items = [`<g transform="translate(${x} ${y})">`, text(0, 18, title, 19, 'font-weight="bold"'), text(left, 43, unit, 12)];
  for (let tick = 0; tick <= 4; tick++) {
    const value = max * (tick / 4), at = py(value);
    items.push(`<line x1="${left}" x2="${width-right}" y1="${at}" y2="${at}" stroke="#ccd9e0"/>`, text(left-9, at+4, display(value), 11, 'text-anchor="end"'));
  }
  labels.forEach((label, i) => items.push(text(px(labels.length === 1 ? 0 : (i/(labels.length-1))*xMax), height-38, label, 11, 'text-anchor="middle"')));
  series.forEach(s => {
    items.push(`<polyline data-series="${xml(s.label)}" data-values="${xml(JSON.stringify(s.values))}" points="${s.values.map(v => `${rounded(px(v.x))},${rounded(py(v.y))}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.6"${s.dashed ? ' stroke-dasharray="7 5"' : ''}/>`);
  });
  shortfalls.forEach((v, i) => { if (v > 0) items.push(`<circle cx="${px(i)}" cy="${py(series[0].values[i].y)}" r="4" fill="${rust}"><title>${xml(`${labels[i]}: shortfall ${v} bbl`)}</title></circle>`); });
  let legendY = height - 9;
  // Separate legend lines avoid overlap when public/source or injector identifiers are long.
  series.forEach(s => {
    items.push(`<line x1="${left}" x2="${left+24}" y1="${legendY-4}" y2="${legendY-4}" stroke="${s.color}" stroke-width="3"${s.dashed ? ' stroke-dasharray="7 5"' : ''}/>`, text(left+34, legendY, s.label, 12));
    legendY += 20;
  });
  items.push('</g>');
  return items.join('');
}

/** Standalone deterministic SVG, with lossless exhibit JSON in metadata. No external assets. */
export function exhibitSvg(input: Exhibit): string {
  const exhibit=verifiedExhibit(input);
  const fixtureBacked=exhibit.schemaVersion===2;
  const items: string[] = [];
  let cursor = 45;
  const paragraph = (value: string, size = 14) => {
    // Hard wrapping also bounds long source IDs/hashes/URLs without clipping.
    const width = size === 14 ? 130 : 115;
    const words = value.match(new RegExp(`.{1,${width}}(?:\\s|$)|.{1,${width}}`, 'g')) ?? [''];
    for (const line of words) { items.push(text(40, cursor, line.trim(), size)); cursor += size+7; }
  };
  paragraph('SWD Analytics | Technical chart sheet', 24);
  paragraph(`${fixtureBacked?'Synthetic production':'Declared monthly actuals; raw history unverified'} • Fictional assumed injectors • Calculated planning results • Separate public reported evidence`);
  paragraph(exhibit.inputs.forecastEvidence??'Historical exhibit: raw-history verification status was not recorded');
  paragraph(`Exhibit SHA-256: ${exhibit.contentSha256}`);
  paragraph(`Fixture: ${exhibit.inputs.fixtureId} | Forecast: ${exhibit.inputs.forecastId} | Frozen cutoff: ${exhibit.inputs.cutoff}`);
  paragraph(`Models: engineering ${exhibit.modelVersions.engineering}; forecast ${exhibit.modelVersions.forecast}`);
  paragraph(`Forecast training months: ${exhibit.inputs.trainingMonths.join(', ')}`);
  exhibit.inputs.forecastModels.forEach(model=>paragraph(`${fixtureBacked?'Frozen synthetic producer fit':'Supplied unverified producer fit'}: ${JSON.stringify(model)}`));
  paragraph(`Nexus local main source commit: ${exhibit.inputs.nexusSourceCommit}`);
  paragraph(`Case controls (assumed): ${JSON.stringify(exhibit.inputs.controls)}`);
  exhibit.inputs.injectors.forEach(i => paragraph(`${i.id}: reservoir ${i.reservoirPsia} psia; assumed limit ${i.limitPsia} psia; J ${i.injectivityStbdPerPsi} STB/d/psi; operating ceiling ${i.operatingCeilingStbd} STB/d; availability ${i.availability}. ${i.datum}`));
  paragraph(`New producer (assumed): ${exhibit.inputs.newProducerTypeCurve.formula}`);
  paragraph(`Rate units: ${exhibit.units.rate}; monthly volume: ${exhibit.units.monthlyVolume}; injectivity: ${exhibit.units.injectivity}`);
  cursor += 12;
  const rows = exhibit.outputs.monthly, labels = rows.map(r => r.month.slice(5));
  const monthly = (key: 'demandBbl'|'capacityBbl'|'forecastBbl'|'actualBbl') => rows.map((r, i) => ({x:i, y:r[key]}));
  items.push(chart(40, cursor, 1120, 'Capacity versus planned demand — fictional case', 'Monthly water (bbl); x: reporting month, 2026', labels, [
    {label:'Planned demand: frozen forecast + assumed new producer',color:sand,values:monthly('demandBbl')},
    {label:'Available capacity after operating ceiling and availability',color:blue,values:monthly('capacityBbl')},
  ], rows.length-1, 0, rows.map(r=>r.shortfallBbl)));
  cursor += 340;
  paragraph('Rust markers: monthly demand exceeds available capacity. All plotted volumes use actual calendar days.');
  cursor += 10;
  items.push(chart(40, cursor, 540, 'Frozen forecast versus actual', 'Monthly water (bbl); x: month, 2026', labels, [
    {label:'Frozen forecast: original producers only',color:blue,values:monthly('forecastBbl'),dashed:true},
    {label:`${fixtureBacked?'Synthetic':'Declared'} actual: original producers only`,color:ink,values:monthly('actualBbl')},
  ],rows.length-1));
  const curves: Series[] = exhibit.outputs.injectors.map((i,n) => ({label:i.id,color:n===0?blue:sand,values:i.curve.map(p=>({x:p.rateStbd,y:p.bottomholePsia}))}));
  const rateMax = Math.max(...curves.flatMap(s=>s.values.map(p=>p.x)),1);
  // Each limit comes from the corresponding input; shared limits are represented once.
  const limits = [...new Set(exhibit.inputs.injectors.map(i=>i.limitPsia))];
  limits.forEach(limit=>curves.push({label:`Assumed limit: ${limit} psia`,color:rust,dashed:true,values:[{x:0,y:limit},{x:rateMax,y:limit}]}));
  items.push(chart(620,cursor,540,'Pressure required to inject — fictional','Bottomhole pressure (psia); x: injection rate (STB/d)',['0',display(rateMax/4),display(rateMax/2),display(rateMax*0.75),display(rateMax)],curves,rateMax,6000));
  cursor += 365;
  paragraph('Pressure basis: shared formation reference depth. Curves above the assumed limit are excluded rates, not available capacity.');
  paragraph('Monthly planning / reconciliation — bbl unless stated; displayed values rounded, exact values retained in SVG metadata',16);
  const columns = [40,170,300,430,570,710,850,1020];
  ['Month / days','Forecast','Actual','Variance %','Demand','Capacity','Headroom','Shortfall'].forEach((label,i)=>items.push(text(columns[i],cursor,label,13,'font-weight="bold"')));
  cursor += 12;
  for (const row of rows) {
    cursor += 24;
    items.push(`<line x1="40" x2="1160" y1="${cursor+7}" y2="${cursor+7}" stroke="#e5edf1"/>`);
    [`${row.month} / ${row.days}`,display(row.forecastBbl),display(row.actualBbl),display(row.variancePct),display(row.demandBbl),display(row.capacityBbl),display(row.headroomBbl),display(row.shortfallBbl)].forEach((v,i)=>items.push(text(columns[i],cursor,v,13)));
  }
  cursor += 40;
  paragraph('Public reported evidence — separate from fictional planning',18);
  const history = exhibit.publicHistory;
  if (!history) paragraph('Public history not loaded. No public observations or real-well calibration are claimed for this exhibit.');
  else {
    paragraph(`Artifact ID: ${history.artifactId}; ${history.injectionMonthly.length} monthly source rows; ${history.inventory.length} bounded inventory candidates.`);
    const parents = new Set(history.injectionMonthly.map(r=>r.parent_key));
    history.inventory.filter(r=>parents.has(r.source_record_key)).forEach(r=>paragraph(`Acquired-history parent: ${r.source_record_key}; UIC ${r.uic_number}; API ${r.api_no}`));
    const sources = history.manifest.sources as {kind?:string;sha256?:string;url?:string;retrieved_at?:string}[] | undefined;
    for (const source of sources ?? []) {
      paragraph(`Public ${source.kind ?? 'source'} snapshot SHA-256: ${source.sha256 ?? 'not supplied'}`);
      paragraph(`Retrieved ${source.retrieved_at ?? 'not supplied'}; ${source.url ?? 'URL not supplied'}`);
    }
    paragraph('Monthly liquid injection and pressure are public reported; calendar-day average is calculated. Missing observations remain unreported.');
  }
  paragraph(exhibit.units.reportedPressure);
  cursor += 10;
  paragraph('Method and limitations',18);
  Object.entries(exhibit.formulas).forEach(([key,value])=>paragraph(`${key}: ${value}`));
  exhibit.assumptions.forEach(value=>paragraph(value));
  paragraph(`Brine reference (calculated; independent from stock-tank planning): ${JSON.stringify(exhibit.outputs.brine)}`);
  paragraph('Exact case inputs, outputs, public evidence, units, formulas and assumptions are embedded in metadata#technical-exhibit.');
  const height = cursor+28;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="sheet-title sheet-description"><title id="sheet-title">SWD Analytics technical chart sheet</title><desc id="sheet-description">Current fictional case, frozen forecast, capacity and pressure charts, monthly output table, provenance and limitations. Complete exact exhibit JSON in metadata.</desc><metadata id="technical-exhibit">${xml(JSON.stringify(exhibit))}</metadata><rect width="1200" height="${height}" fill="#fff"/><g font-family="Arial, sans-serif" fill="${ink}">${items.join('')}</g></svg>\n`;
}
