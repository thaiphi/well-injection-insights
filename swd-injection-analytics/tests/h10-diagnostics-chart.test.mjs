import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseMonthly,applyDecision,LABEL_SURFACE,LABEL_SCREENING} from '../dist/h10Diagnostics.js';
import {pressureRateSvg,ratioOverTimeSvg} from '../dist/h10DiagnosticsChart.js';

const days=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).getUTCDate();
const row=(month,bbl,avg,max)=>({source_row_key:'r-'+month,parent_key:'p',parent_join_status:'joined',uic_number:'1',reporting_year:+month.slice(0,4),reporting_month:+month.slice(5,7),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:max,calendar_days:days(month),calculated_calendar_day_avg_bpd:bbl===null?null:bbl/days(month)});
const state=()=>diagnoseMonthly([row('2024-01',31000,800,900),row('2024-02',29000,810,900),row('2024-04',30000,820,900),row('2024-05',31000,830,900),row('2024-06',300,900,950)]);

test('both charts carry the fixed labels and declare their height',()=>{
 for(const c of [pressureRateSvg(state()),ratioOverTimeSvg(state())]){
  assert.match(c.svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.ok(c.svg.includes(`height="${c.height}"`));
  assert.ok(c.svg.includes(LABEL_SURFACE));assert.ok(c.svg.includes(LABEL_SCREENING));
  assert.doesNotMatch(c.svg,/<script|href=|javascript:/i);
 }
});
test('pressure-rate chart plots one point per comparable month with its month as title',()=>{
 const c=pressureRateSvg(state());
 assert.equal((c.svg.match(/<circle /g)??[]).length,4);for(const m of ['2024-01','2024-02','2024-04','2024-05'])assert.ok(c.svg.includes(`<title>${m}`));
});
test('ratio chart breaks the line at the gap and marks it',()=>{
 const c=ratioOverTimeSvg(state());
 const d=c.svg.match(/<path d="([^"]*)"/)[1];assert.equal((d.match(/M/g)??[]).length,2,'two segments: 2024-01..02 and 2024-04..05');
 assert.ok(c.svg.includes('data-gap="2024-03"'));assert.ok(c.svg.includes('Gap months (no report): 2024-03'));
});
test('excluded months are marked, not plotted',()=>{
 const c=ratioOverTimeSvg(state());
 assert.ok(c.svg.includes('data-excluded="2024-06"'));assert.ok(c.svg.includes('Excluded months: 2024-06'));
});
test('fewer than three comparable months shows the not-enough message instead of a trend',()=>{
 let s=state();for(const m of ['2024-01','2024-02'])s=applyDecision(s,m,false,'test');
 for(const c of [pressureRateSvg(s),ratioOverTimeSvg(s)]){assert.ok(c.svg.includes('Not enough comparable months (2 of 3 needed)'));assert.doesNotMatch(c.svg,/<circle |<path /);}
});
test('text is escaped',()=>{
 let s=state();s=applyDecision(s,'2024-01',false,'<b>&"x"</b>');
 assert.doesNotMatch(ratioOverTimeSvg(s).svg,/<b>/);
});
