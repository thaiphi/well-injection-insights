import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const load=f=>import(pathToFileURL(resolve(engineDir,f))).catch(()=>({}));
const chl=await load('caseHistoryLinks.js');
const {packageFromVerified,addPackage,removePackage,EMPTY_PACKAGE_SET}=await load('historyPackages.js');
const {checkWellHistory,NO_HISTORY}=await load('wellHistoryCheck.js');
const {buildDisposalCase}=await load('disposalCase.js');
const {BANNED}=await load('caseSummary.js');
const {daysInMonth}=await load('planning.js');
const {LINKS_VERSION,UNLINKED,J_SOURCE_ASSUMED,EVIDENCE_ONLY,setLink,pruneLinks,gapLabel,historyLinksFor,wellsCompared}=chl;
const row=(month,bbl,uic='000000417')=>({source_row_key:month+uic,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:uic,reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:900,calendar_days:daysInMonth(month),calculated_calendar_day_avg_bpd:bbl===null?null:bbl/daysInMonth(month)});
const months=(a,b)=>{const out=[];let [y,m]=a.split('-').map(Number);for(;;){const s=`${y}-${String(m).padStart(2,'0')}`;out.push(s);if(s===b)return out;m++;if(m>12){m=1;y++;}}};
const verified=({artifactId,sha,uic='000000417',start,end,rows,bbl=100000000})=>({
 artifact:{schemaVersion:1,artifactId,inventory:[{source_record_key:'inv-'+artifactId,uic_number:uic,api_no:'00000000000000'}],
  injectionMonthly:rows??months(start,end).map(m=>row(m,bbl,uic)),manifest:{scope:{uic_number:uic,start:start+'-01',end:end+'-28'}},qualityReport:{},dataDictionary:{}},
 pin:{artifactId,manifestSha256:sha},calculationEligibility:{ready:true,reasons:[]}});
const pkg=o=>packageFromVerified(verified(o));
const well={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const input=()=>({caseName:'Assumed links',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:['2027-03','2027-04','2027-05'].map((month,i)=>({month,demandBbl:300000*(i+1)})),evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:'FICTIONAL-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:4,availability:0.8}});
const wells=[{id:'FICTIONAL-A',label:'FICTIONAL-A'},{id:'FICTIONAL-B',label:'FICTIONAL-B'}];
const setOf=(...ps)=>ps.reduce(addPackage,EMPTY_PACKAGE_SET);
test('module exists',()=>{assert.equal(typeof setLink,'function');assert.equal(LINKS_VERSION,'case-history-links/1');});
test('setLink refuses a UIC linked to another well; null removes',()=>{
 const l=setLink({},'FICTIONAL-A','000000417'),before=structuredClone(l);
 assert.throws(()=>setLink(l,'FICTIONAL-B','000000417'),/000000417 is already linked/);
 assert.deepEqual(l,before);
 assert.deepEqual(setLink(l,'FICTIONAL-A',null),{});
 assert.deepEqual(setLink(l,'FICTIONAL-A','000000417'),l);
 assert.deepEqual(setLink(l,'FICTIONAL-A','000000418'),{'FICTIONAL-A':'000000418'});
});
test('pruneLinks drops unknown wells and UICs no longer in the set',()=>{
 const set=setOf(pkg({artifactId:'a',sha:'s1',start:'2026-12',end:'2027-02'}));
 const l={'FICTIONAL-A':'000000417','GONE':'000000417','FICTIONAL-B':'000000418'};
 assert.deepEqual(pruneLinks(l,['FICTIONAL-A','FICTIONAL-B'],set),{'FICTIONAL-A':'000000417'});
 assert.deepEqual(pruneLinks({'FICTIONAL-A':'000000417'},['FICTIONAL-A'],removePackage(set,'a')),{});
 assert.deepEqual(pruneLinks({'OTHER':'000000417'},['FICTIONAL-A'],set),{});
});
test('historyLinksFor omits unlinked wells; check gives NO_HISTORY',()=>{
 const set=setOf(pkg({artifactId:'a',sha:'s1',start:'2026-12',end:'2027-02'}));
 const hl=historyLinksFor(wells,{'FICTIONAL-A':'000000417'},set,{});
 assert.equal(hl.length,1);assert.equal(hl[0].wellId,'FICTIONAL-A');assert.equal(hl[0].uic,'000000417');assert.equal(hl[0].surfaceBasis,null);
 const b={value:'psig',reason:'fictional'};
 assert.deepEqual(historyLinksFor(wells,{'FICTIONAL-A':'000000417'},set,{'FICTIONAL-A':b})[0].surfaceBasis,b);
 const r=checkWellHistory(buildDisposalCase(input()).base,hl);
 assert.equal(r[1].reason,NO_HISTORY);
 assert.deepEqual(historyLinksFor(wells,{},set,{}),[]);
});
test('two packages joined in month order',()=>{
 const set=setOf(pkg({artifactId:'b',sha:'s2',start:'2027-03',end:'2027-05'}),pkg({artifactId:'a',sha:'s1',start:'2026-12',end:'2027-02'}));
 const m=historyLinksFor(wells,{'FICTIONAL-A':'000000417'},set,{})[0].monthly;
 assert.equal(m.length,6);
 assert.deepEqual(m.map(r=>r.period_start.slice(0,7)),months('2026-12','2027-05'));
});
test('wells compared: linked A, unlinked B',()=>{
 const set=setOf(pkg({artifactId:'a',sha:'s1',start:'2026-12',end:'2027-02'}));
 const result=buildDisposalCase(input()),links={'FICTIONAL-A':'000000417'};
 const checks=checkWellHistory(result.base,historyLinksFor(wells,links,set,{}));
 const rows=wellsCompared(result,links,set,checks,()=>J_SOURCE_ASSUMED);
 assert.deepEqual(rows.map(r=>r.wellId),['FICTIONAL-A','FICTIONAL-B']);
 const [a,b]=rows;
 assert.ok(['within','above'].includes(a.check.status));
 assert.equal(a.uic,'000000417');assert.equal(a.label,'FICTIONAL-A');
 assert.deepEqual(a.coverage,{startMonth:'2026-12',endMonth:'2027-02',reported:3,reportedZero:0,gap:0});
 assert.equal(a.gapLabel,null);assert.equal(a.jSource,'assumed (case input)');
 assert.deepEqual(a.packages,[{artifactId:'a',manifestSha256:'s1',window:{startMonth:'2026-12',endMonth:'2027-02',source:'acquisition'}}]);
 assert.equal(b.uic,null);assert.equal(b.coverage,null);assert.equal(b.gapLabel,null);assert.deepEqual(b.packages,[]);
 assert.equal(b.check.reason,NO_HISTORY);
 assert.equal(a.inclusionBasis,'default H-10 month inclusions');assert.equal(chl.INCLUSION_BASIS,'default H-10 month inclusions');
 assert.equal(b.inclusionBasis,null);
});
test('zero-row package: gap equals window; cannot-check, no throw',()=>{
 const set=setOf(pkg({artifactId:'z',sha:'sz',start:'2024-01',end:'2024-03',rows:[]}));
 const result=buildDisposalCase(input()),links={'FICTIONAL-A':'000000417'};
 const checks=checkWellHistory(result.base,historyLinksFor(wells,links,set,{}));
 const a=wellsCompared(result,links,set,checks,()=>J_SOURCE_ASSUMED)[0];
 assert.equal(a.coverage.gap,3);
 assert.equal(gapLabel(3),'3 gap months in the window; a gap is never zero.');
 assert.equal(a.gapLabel,gapLabel(3));
 assert.equal(a.check.status,'cannot-check');
});
test('evidence only: case input unchanged by link operations',()=>{
 const inp=input(),before=structuredClone(inp);
 const set=setOf(pkg({artifactId:'a',sha:'s1',start:'2026-12',end:'2027-02'}));
 const l=setLink({},'FICTIONAL-A','000000417');pruneLinks(l,['FICTIONAL-A'],set);
 const result=buildDisposalCase(inp);
 wellsCompared(result,l,set,checkWellHistory(result.base,historyLinksFor(wells,l,set,{})),()=>J_SOURCE_ASSUMED);
 assert.deepEqual(inp,before);
 assert.match(EVIDENCE_ONLY,/evidence only/);
});
test('banned words absent',()=>{
 for(const s of [UNLINKED,EVIDENCE_ONLY,gapLabel(5),J_SOURCE_ASSUMED]) assert.ok(!BANNED.test(s),s);
});
