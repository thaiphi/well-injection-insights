import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseMonthly,applyDecision} from '../dist/h10Diagnostics.js';
import {sealDiagnostics,verifySealed,diagnosticsJson,diagnosticsCsv,diagnosticsSvg} from '../dist/h10DiagnosticsExport.js';

const days=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate();
const row=(month,bbl,avg,max)=>({source_row_key:'r-'+month,parent_key:'p',parent_join_status:'joined',uic_number:'000000001',reporting_year:+month.slice(0,4),reporting_month:+month.slice(5,7),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:max,calendar_days:days(month),calculated_calendar_day_avg_bpd:bbl===null?null:bbl/days(month)});
const source={artifactId:'test-artifact',uic:'000000001',normalizedSha256:'a'.repeat(64),manifestSha256:'b'.repeat(64)};
const state=()=>applyDecision(diagnoseMonthly([row('2024-01',31000,800,900),row('2024-02',29000,null,null),row('2024-04',30000,820,900),row('2024-05',31000,830,900),row('2024-06',30000,840,900)]),'2024-06',false,'=HYPERLINK("x")');

test('sealed export records every month, decision, gap, formula and limitation with a verifiable hash',async()=>{
 const s=await sealDiagnostics(state(),source);
 assert.equal(s.schemaVersion,'h10-diagnostics-export/1');assert.equal(s.method,'h10-diagnostics/1');assert.deepEqual(s.source,source);
 assert.equal(s.months.length,6);assert.deepEqual(s.coverage.gapMonths,['2024-03']);
 const jun=s.months.find(m=>m.month==='2024-06');assert.equal(jun.include,false);assert.equal(jun.reason,'=HYPERLINK("x")');assert.equal(jun.decidedBy,'user');assert.equal(jun.contributes,false);
 const feb=s.months.find(m=>m.month==='2024-02');assert.deepEqual(feb.flags,['no-average-pressure']);assert.equal(feb.decidedBy,'system');assert.ok(feb.flagReasons[0].includes('average'));
 assert.equal(s.screening.length,3);assert.ok(s.formulas.length>=3);assert.ok(s.limitations.some(l=>l.includes('not bottomhole')));assert.equal(s.checklist.length,7);
 assert.match(s.contentSha256,/^[a-f0-9]{64}$/);assert.equal(await verifySealed(s),true);
 assert.equal(await verifySealed({...s,months:s.months.slice(1)}),false);
});
test('JSON round-trips and stays verifiable',async()=>{const s=await sealDiagnostics(state(),source);assert.equal(await verifySealed(JSON.parse(diagnosticsJson(s))),true);});
test('CSV quotes every cell, writes unavailable for missing values and neutralizes formula-like text',async()=>{
 const csv=diagnosticsCsv(await sealDiagnostics(state(),source));
 assert.ok(csv.includes('"Surface-reported pressure (basis as reported), not bottomhole pressure"'));
 assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));assert.ok(csv.includes('"unavailable"'));
 assert.ok(csv.includes('"Gap months","2024-03"\r\n'));assert.ok(csv.includes('"Comparable months","3"\r\n'));assert.ok(csv.includes('"Notice","""unavailable"" marks a missing value, never zero'));
 assert.match(csv,/"2024-03","gap"/);assert.ok(csv.endsWith('\r\n'));
});
test('SVG embeds the sealed JSON in metadata and contains both charts',async()=>{
 const st=state(),s=await sealDiagnostics(st,source),svg=diagnosticsSvg(s,st);
 assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.ok(svg.includes('<metadata>'));
 const meta=svg.slice(svg.indexOf('<metadata>')+10,svg.indexOf('</metadata>')).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 assert.equal(JSON.parse(meta).contentSha256,s.contentSha256);
 assert.ok(svg.includes('Reported average pressure vs calendar-day rate'));assert.ok(svg.includes('Reported pressure per unit rate over time'));
});
