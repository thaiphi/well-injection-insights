import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const {checkWellHistory,NO_HISTORY,PRESSURE_NOT_CHECKED,RATE_CAVEAT,HISTORY_CHECK_VERSION}=await import(pathToFileURL(resolve(engineDir,'wellHistoryCheck.js')));
const {buildDisposalCase}=await import(pathToFileURL(resolve(engineDir,'disposalCase.js')));
const {daysInMonth}=await import(pathToFileURL(resolve(engineDir,'planning.js')));
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const build=(demandBbl=300_000,wellExtra={})=>buildDisposalCase({caseName:'Assumed history',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:['2027-03','2027-04','2027-05'].map((month,i)=>({month,demandBbl:demandBbl*(i+1)})),evidence:{fixture:'seed-417/v1'}},wells:[{...well,...wellExtra},{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:4,availability:0.8}});
const row=(month,bbl,avg,max,key)=>({source_row_key:key??month,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:'000000417',reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:max,calendar_days:daysInMonth(month),calculated_calendar_day_avg_bpd:bbl/daysInMonth(month)});
const hist=(bbl,avg=500,max=900)=>['2026-12','2027-01','2027-02'].map(m=>row(m,bbl,avg,max));
const link=(monthly,surfaceBasis=null)=>({wellId:'FICTIONAL-A',label:'Fictional A',uic:'000000417',monthly,surfaceBasis});
const first=(c,links)=>checkWellHistory(c.base,links)[0];
test('unlinked well cannot be checked',()=>{
 const c=build(),r=checkWellHistory(c.base,[]);
 assert.equal(r.length,2);
 for(const x of r){assert.equal(x.status,'cannot-check');assert.equal(x.reason,NO_HISTORY);assert.equal(x.pressure.status,'not-checked');assert.equal(x.ratio,null);assert.equal(x.peakReported,null);assert.deepEqual(x.series,{reported:[],forecast:[]});}
 assert.equal(HISTORY_CHECK_VERSION,'history-vs-forecast/1');
});
test('within when the forecast peak is at or below the reported peak',()=>{
 const c=build(),r=first(c,[link(hist(100_000_000))]);
 assert.equal(r.status,'within');assert.ok(r.ratio<=1);assert.ok(r.reason.startsWith('Within reported history: peak forecast '));
 assert.equal(r.historyMonthsAtOrAbovePeakForecast,3);assert.equal(r.forecastMonthsAbovePeakReported,0);
});
test('above when the forecast peak exceeds the reported peak',()=>{
 const c=build(),r=first(c,[link(hist(300))]);
 assert.equal(r.status,'above');assert.match(r.reason,/× the highest reported month \(.+, 2027-\d\d\); not shown in reported history\./);
 assert.ok(Math.abs(r.ratio-r.peakForecast.averageStbd/r.peakReported.rateBpd)<1e-12);
 assert.equal(r.historyMonthsAtOrAbovePeakForecast,0);assert.ok(r.forecastMonthsAbovePeakReported>0);
 const avgs=c.base.monthly.map(m=>m.allocations[0].averageStbd),max=Math.max(...avgs);
 assert.equal(r.peakForecast.averageStbd,max);assert.equal(r.peakForecast.month,c.base.monthly[avgs.indexOf(max)].month);
});
test('gap months are never zero',()=>{
 const r=first(build(),[link([row('2027-01',9000,500,900),row('2027-03',9000,500,900)])]);
 assert.deepEqual(r.series.reported.find(m=>m.month==='2027-02'),{month:'2027-02',bbl:null,gap:true,included:false});
 assert.equal(r.includedMonths,2);
});
test('all months excluded gives cannot-check',()=>{
 const r=first(build(),[link(hist(9000,null,null))]);
 assert.equal(r.status,'cannot-check');assert.ok(r.reason.startsWith('Cannot be checked: no H-10 month'));
});
test('reported zero injection gives no-injection',()=>{
 const r=first(build(),[link(hist(0))]);assert.equal(r.status,'no-injection');assert.equal(r.reason,'No injection reported in the loaded H-10 history.');
});
test('zero forecast allocation is within, no division error',()=>{
 const r=first(build(300_000,{availability:0}),[link(hist(9000))]);
 assert.equal(r.status,'within');assert.equal(r.ratio,0);
});
test('duplicate month is excluded from the peak',()=>{
 const rows=[row('2027-04',9000,500,900),row('2027-05',9000,500,900,'a'),row('2027-05',90_000_000,500,900,'b'),row('2027-06',9000,500,900)];
 const r=first(build(),[link(rows)]);
 assert.notEqual(r.peakReported.month,'2027-05');
});
test('pressure not checked without basis',()=>{
 const r=first(build(),[link(hist(9000))]);assert.equal(r.pressure.status,'not-checked');assert.equal(r.pressure.note,PRESSURE_NOT_CHECKED);
});
test('pressure above reported',()=>{
 const c=build(),r=first(c,[link(hist(9000,50,100),{value:'psig',reason:'test'})]);
 assert.equal(r.pressure.status,'above-reported');assert.equal(r.pressure.highestReportedPsia,100+14.7);
 assert.ok(r.pressure.requiredSurfacePsia>r.pressure.highestReportedPsia);assert.match(r.pressure.note,/^Requires more surface pressure \(.+ psia, .+\) than any reported month \(.+ psia, .+\)\.$/);
});
test('pressure not above gives only the caveat',()=>{
 const r=first(build(),[link(hist(9000,500,900_000),{value:'psia',reason:'test'})]);
 assert.equal(r.pressure.status,'not-above');assert.equal(r.pressure.note,RATE_CAVEAT);
});
test('onstream note when availability < 1',()=>{
 const r=first(build(),[link(hist(9000))]);assert.match(r.onstreamNote,/^Onstream rate .+ STB\/day while available; H-10 monthly data cannot show onstream rates\.$/);
 assert.equal(first(build(300_000,{availability:1}),[link(hist(9000))]).onstreamNote,null);
});
test('deterministic',()=>{
 const c=build(),l=[link(hist(300),{value:'psig',reason:'t'})];
 assert.equal(JSON.stringify(checkWellHistory(c.base,l)),JSON.stringify(checkWellHistory(c.base,l)));
});
test('confirmed basis with no usable month says pressure not compared',()=>{
 const r=first(build(),[link(hist(9000,null,null),{value:'psig',reason:'t'})]);
 assert.equal(r.status,'cannot-check');assert.equal(r.pressure.status,'not-checked');
 assert.equal(r.pressure.note,'Pressure not compared: no usable history month.');assert.equal(r.pressure.basis,'psig');
 const z=first(build(),[link(hist(0),{value:'psia',reason:'t'})]);
 assert.equal(z.pressure.note,'Pressure not compared: no usable history month.');
 assert.equal(first(build(),[link(hist(0))]).pressure.note,PRESSURE_NOT_CHECKED);
});
test('duplicate-only history is cannot-check, not no-injection',()=>{
 const rows=['2027-01','2027-02'].flatMap(m=>[row(m,9000,500,900,m+'a'),row(m,9000,500,900,m+'b')]);
 const r=first(build(),[link(rows)]);
 assert.equal(r.status,'cannot-check');assert.equal(r.reason,'Cannot be checked: no H-10 month passes the default inclusions.');
});
test('well without base allocations is cannot-check, no throw',()=>{
 const c=build(),base=structuredClone(c.base);
 for(const m of base.monthly)m.allocations=m.allocations.filter(a=>a.wellId!=='FICTIONAL-A');
 const r=checkWellHistory(base,[link(hist(9000))])[0];
 assert.equal(r.status,'cannot-check');assert.equal(r.reason,'Cannot be checked: no forecast allocation for this well.');assert.equal(r.peakForecast,null);
 const b=checkWellHistory(base,[link(hist(9000),{value:'psig',reason:'test'})])[0];
 assert.equal(b.pressure.note,'Pressure not compared: no forecast allocation for this well.');assert.equal(b.pressure.basis,'psig');
 assert.equal(r.pressure.note,PRESSURE_NOT_CHECKED);
});
test('linked well with empty monthly rows is cannot-check, no throw',()=>{
 const c=build();let r;
 assert.doesNotThrow(()=>{r=first(c,[link([])]);});
 assert.equal(r.status,'cannot-check');assert.equal(r.reason,'Cannot be checked: no H-10 monthly rows.');assert.equal(r.pressure.status,'not-checked');assert.equal(r.pressure.note,PRESSURE_NOT_CHECKED);
 const b=first(c,[link([],{value:'psig',reason:'RRC H-10 reports gauge pressure'})]);
 assert.equal(b.pressure.note,'Pressure not compared: no usable history month.');assert.equal(b.pressure.basis,'psig');
});
const {fmtRatio}=await import(pathToFileURL(resolve(engineDir,'wellHistoryCheck.js')));
const {fmtNumber}=await import(pathToFileURL(resolve(engineDir,'caseSummary.js')));
test('I2/M1: within reason states treated as STB/day and both month counts',()=>{
 const c=build(),r=first(c,[link(hist(100_000_000))]);
 assert.equal(r.reason,`Within reported history: peak forecast ${fmtNumber(r.peakForecast.averageStbd)} STB/day vs highest reported ${fmtNumber(r.peakReported.rateBpd)} bbl/day treated as STB/day (${r.peakReported.month}); 3 of 3 included history months at or above the peak forecast rate; 0 of 3 forecast months above the reported peak.`);
});
test('I2/M1: above reason states treated as STB/day and both month counts',()=>{
 const c=build(),r=first(c,[link(hist(300))]);
 assert.equal(r.reason,`${fmtRatio(r.ratio)}× the highest reported month (${fmtNumber(r.peakReported.rateBpd)} bbl/day treated as STB/day, ${r.peakReported.month}); not shown in reported history. 0 of 3 included history months at or above the peak forecast rate; ${r.forecastMonthsAbovePeakReported} of 3 forecast months above the reported peak.`);
});
test('M2: fmtRatio never prints a ratio above 1 as 1.00',()=>{
 assert.equal(fmtRatio(1.004),'>1.00');assert.equal(fmtRatio(1.0000001),'>1.00');assert.equal(fmtRatio(1.5),'1.50');assert.equal(fmtRatio(2),'2.00');assert.equal(fmtRatio(12.345),'12.35');
 assert.equal(fmtRatio(1),'1.00');assert.equal(fmtRatio(0.5),'0.50');
});
test('M2: a ratio just above 1 reads ">1.00×", never "1.0×"',()=>{
 const c=build(),peak=first(c,[link(hist(100_000_000))]).peakForecast.averageStbd;
 const rows=['2026-12','2027-01','2027-02'].map(m=>row(m,peak/1.001*daysInMonth(m),500,900));
 const r=first(c,[link(rows)]);
 assert.equal(r.status,'above');assert.ok(r.ratio>1&&r.ratio<1.005,String(r.ratio));
 assert.ok(r.reason.startsWith('>1.00× the highest reported month ('),r.reason);
 assert.ok(!/\b1\.0×/.test(r.reason));
});
