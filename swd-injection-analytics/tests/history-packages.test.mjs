import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const load=f=>import(pathToFileURL(resolve(engineDir,f))).catch(()=>({}));
const hp=await load('historyPackages.js');
const {packageFromVerified,addPackage,removePackage,uics,joinedHistory,EMPTY_PACKAGE_SET}=hp;
const row=(month,bbl,uic='000000417')=>({source_row_key:month+uic,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:uic,reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:900,calendar_days:30,calculated_calendar_day_avg_bpd:bbl===null?null:bbl/30});
const months=(a,b)=>{const out=[];let [y,m]=a.split('-').map(Number);for(;;){const s=`${y}-${String(m).padStart(2,'0')}`;out.push(s);if(s===b)return out;m++;if(m>12){m=1;y++;}}};
const verified=({artifactId,sha,uic='000000417',start,end,rows,ready=true,reasons=[],legacy=false,inventory})=>({
 artifact:{schemaVersion:1,artifactId,
  inventory:inventory??[{source_record_key:'inv-'+artifactId,uic_number:uic,api_no:'00000000000000'}],
  injectionMonthly:rows??months(start,end).map(m=>row(m,1000,uic)),
  manifest:legacy?{}:{scope:{uic_number:uic,start:start+'-01',end:end+'-28'}},qualityReport:{},dataDictionary:{}},
 pin:{artifactId,manifestSha256:sha},calculationEligibility:{ready,reasons}});
const pkg=o=>packageFromVerified(verified(o));
test('module exists',()=>assert.equal(typeof packageFromVerified,'function'));
test('refuses not ready with reason',()=>{
 assert.throws(()=>pkg({artifactId:'a',sha:'s',start:'2023-01',end:'2023-02',ready:false,reasons:['r1','r2']}),/Package not calculation-ready: r1; r2/);
});
test('refuses two UICs',()=>{
 assert.throws(()=>pkg({artifactId:'a',sha:'s',start:'2023-01',end:'2023-02',rows:[row('2023-01',1,'000000417'),row('2023-02',1,'000000418')]}));
 assert.throws(()=>pkg({artifactId:'a',sha:'s',start:'2023-01',end:'2023-02',inventory:[{uic_number:'000000417'},{uic_number:'000000418'}]}));
});
test('refuses zero inventory',()=>assert.throws(()=>pkg({artifactId:'a',sha:'s',start:'2023-01',end:'2023-02',inventory:[]})));
test('zero rows accepted, uic from inventory',()=>{
 const p=pkg({artifactId:'a',sha:'s',uic:'000000418',start:'2024-01',end:'2024-03',rows:[]});
 assert.equal(p.uic,'000000418');assert.deepEqual(p.window,{startMonth:'2024-01',endMonth:'2024-03',source:'acquisition'});
 const j=joinedHistory(addPackage(EMPTY_PACKAGE_SET,p),'000000418');
 assert.deepEqual(j.counts,{reported:0,reportedZero:0,gap:3});assert.equal(j.monthly.length,0);
});
test('legacy window from rows',()=>{
 const p=pkg({artifactId:'a',sha:'s',start:'2023-03',end:'2023-05',legacy:true});
 assert.deepEqual(p.window,{startMonth:'2023-03',endMonth:'2023-05',source:'rows'});
});
test('duplicates refused, set unchanged',()=>{
 const s=addPackage(EMPTY_PACKAGE_SET,pkg({artifactId:'a',sha:'s1',start:'2023-01',end:'2023-03'}));
 const before=structuredClone(s);
 assert.throws(()=>addPackage(s,pkg({artifactId:'a',sha:'s2',start:'2024-01',end:'2024-03'})),/a/);
 assert.throws(()=>addPackage(s,pkg({artifactId:'b',sha:'s1',start:'2024-01',end:'2024-03'})),/s1/);
 assert.deepEqual(s,before);
});
test('overlap refused; gap months reported',()=>{
 const s=addPackage(EMPTY_PACKAGE_SET,pkg({artifactId:'a',sha:'s1',start:'2023-01',end:'2023-12'}));
 assert.throws(()=>addPackage(s,pkg({artifactId:'b',sha:'s2',start:'2023-12',end:'2024-06'})),/000000417|b/);
 const t=addPackage(s,pkg({artifactId:'b',sha:'s2',start:'2024-03',end:'2024-08'}));
 const j=joinedHistory(t,'000000417');
 assert.deepEqual(j.window,{startMonth:'2023-01',endMonth:'2024-08'});
 for(const m of ['2024-01','2024-02'])assert.equal(j.months.find(x=>x.month===m).state,'gap');
 assert.equal(j.counts.gap,2);assert.equal(j.months.length,20);
});
test('limits: 11th uic and 21st package',()=>{
 let s=EMPTY_PACKAGE_SET;
 for(let i=0;i<10;i++){const u='0000004'+String(20+i).padStart(2,'0');s=addPackage(s,pkg({artifactId:'u'+i,sha:'h'+i,uic:u,start:'2023-01',end:'2023-02'}));}
 assert.equal(uics(s).length,10);
 assert.throws(()=>addPackage(s,pkg({artifactId:'x',sha:'hx',uic:'000000499',start:'2023-01',end:'2023-02'})),/000000499/);
 let t=EMPTY_PACKAGE_SET;
 for(let i=0;i<20;i++){const y=2000+i;t=addPackage(t,pkg({artifactId:'p'+i,sha:'q'+i,start:y+'-01',end:y+'-02'}));}
 assert.throws(()=>addPackage(t,pkg({artifactId:'p20',sha:'q20',start:'2030-01',end:'2030-02'})),/000000417|p20/);
});
test('month states and counts',()=>{
 const rows=[row('2024-01',null),row('2024-02',0),row('2024-03',5)];
 const j=joinedHistory(addPackage(EMPTY_PACKAGE_SET,pkg({artifactId:'a',sha:'s',start:'2024-01',end:'2024-04',rows})),'000000417');
 assert.deepEqual(j.months.map(m=>m.state),['gap','reported-zero','reported','gap']);
 assert.deepEqual(j.counts,{reported:1,reportedZero:1,gap:2});
 assert.equal(j.counts.reported+j.counts.reportedZero+j.counts.gap,j.months.length);
});
test('join throws for unknown uic; remove; uics sorted',()=>{
 let s=addPackage(EMPTY_PACKAGE_SET,pkg({artifactId:'a',sha:'s',uic:'000000419',start:'2024-01',end:'2024-02'}));
 s=addPackage(s,pkg({artifactId:'b',sha:'t',uic:'000000417',start:'2024-01',end:'2024-02'}));
 assert.deepEqual(uics(s),['000000417','000000419']);
 assert.throws(()=>joinedHistory(s,'000000418'));
 assert.deepEqual(uics(removePackage(s,'a')),['000000417']);assert.equal(s.packages.length,2);
});
test('deterministic regardless of add order',()=>{
 const a=pkg({artifactId:'a',sha:'s1',start:'2023-01',end:'2023-03'}),b=pkg({artifactId:'b',sha:'s2',start:'2023-06',end:'2023-08'});
 const j1=joinedHistory(addPackage(addPackage(EMPTY_PACKAGE_SET,a),b),'000000417');
 const j2=joinedHistory(addPackage(addPackage(EMPTY_PACKAGE_SET,b),a),'000000417');
 assert.deepEqual(j1,j2);assert.equal(j1.monthly[0].period_start,'2023-01-01');
});
