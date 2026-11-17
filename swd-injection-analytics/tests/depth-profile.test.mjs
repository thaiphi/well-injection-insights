import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const m=await import(pathToFileURL(resolve(engineDir,'depthProfile.js')));
const {parseDepthProfile,pruneProfile,ProfileError,PROFILE_COLUMNS,FICTIONAL_DEPTH_PROFILE_CSV,CONTENT_CLASS_LABELS,DEPTH_PROFILE_VERSION}=m;

const A='FICTIONAL-INJ-A',B='FICTIONAL-INJ-B';
const csv=(...rows)=>[PROFILE_COLUMNS.join(','),...rows.map(r=>PROFILE_COLUMNS.map(c=>r[c]??'').join(','))].join('\n')+'\n';
const base={well_id:A,source_ref:'fictional test',content_class:'assumed'};
const ref={...base,kind:'depth-reference',reference:'KB',wellhead_below_reference_ft:18};
const cas={...base,kind:'casing',bottom_depth_ft:2800,depth_basis:'MD'};
const sv=(md,tvd)=>({...base,kind:'survey',md_ft:md,tvd_ft:tvd});
function refused(text){
  try{parseDepthProfile(text);}catch(e){assert.ok(e instanceof ProfileError,String(e));return e.problems;}
  assert.fail('expected ProfileError');
}
const has=(problems,row,re)=>assert.ok(problems.some(p=>p.row===row&&re.test(p.reason)),`no row ${row} ${re}: ${JSON.stringify(problems)}`);

test('constants and labels',()=>{
  assert.equal(DEPTH_PROFILE_VERSION,'depth-profile/1');
  assert.equal(PROFILE_COLUMNS.length,18);
  assert.deepEqual({...CONTENT_CLASS_LABELS},{'public-reported':'Public, as reported',measured:'Measured (user, not verified)',assumed:'Assumed',literature:'Literature'});
});

test('fictional example parses into the documented rows',()=>{
  const p=parseDepthProfile(FICTIONAL_DEPTH_PROFILE_CSV);
  assert.equal(p.version,'depth-profile/1');
  assert.ok(!FICTIONAL_DEPTH_PROFILE_CSV.includes('\r'));
  assert.ok(p.rows.every((r,i)=>r.row===i+1&&r.sourceRef.startsWith('fictional example')&&r.raw.well_id===r.wellId));
  const a=p.rows.filter(r=>r.wellId===A),b=p.rows.filter(r=>r.wellId===B);
  assert.equal(a.length+b.length,p.rows.length);
  assert.deepEqual(a.filter(r=>r.kind==='depth-reference').map(r=>[r.reference,r.wellheadBelowReferenceFt]),[['KB',18]]);
  assert.deepEqual(a.filter(r=>r.kind==='survey').map(r=>[r.mdFt,r.tvdFt]),[[0,0],[1000,1000],[3318,3018]]);
  assert.deepEqual(a.map(r=>r.kind).filter(k=>k!=='survey'),['depth-reference','casing','packer','perforated-interval','formation-top','formation-top','test-point','test-point']);
  const tops=a.filter(r=>r.kind==='formation-top');
  assert.equal(tops.filter(r=>r.bottomFt!==null&&r.bottomSourceRef).length,1);
  assert.deepEqual(a.filter(r=>r.kind==='test-point').map(r=>r.pressureBasis).sort(),['psia','psig']);
  assert.deepEqual(b.map(r=>r.kind),['depth-reference','casing','permitted-interval','packer','test-point']);
  assert.equal(b.find(r=>r.kind==='casing').basis,'MD');
  assert.equal(b.find(r=>r.kind==='permitted-interval').basis,'TVD');
  assert.equal(b.find(r=>r.kind==='packer').basis,'unknown');
  assert.equal(b.find(r=>r.kind==='test-point').pressureBasis,null);
  assert.equal(b.find(r=>r.kind==='depth-reference').wellheadBelowReferenceFt,18);
});

test('determinism and column order freedom',()=>{
  assert.deepEqual(parseDepthProfile(FICTIONAL_DEPTH_PROFILE_CSV),parseDepthProfile(FICTIONAL_DEPTH_PROFILE_CSV));
  const rev=[...PROFILE_COLUMNS].reverse();
  const text=rev.join(',')+'\n'+rev.map(c=>({...ref})[c]??'').join(',')+'\n';
  assert.equal(parseDepthProfile(text).rows[0].reference,'KB');
});

test('whole-file refusals',()=>{
  const hdr=PROFILE_COLUMNS.join(',');
  const row=PROFILE_COLUMNS.map(c=>cas[c]??'').join(',');
  const many=(n,wells)=>hdr+'\n'+Array.from({length:n},(_,i)=>row.replace(A,`W${i%wells}`)).join('\n')+'\n';
  assert.equal(parseDepthProfile(many(2000,20)).rows.length,2000);
  assert.ok(/2000/.test(refused(many(2001,1))[0].reason));
  assert.ok(/20 wells/.test(refused(many(21,21))[0].reason));
  assert.ok(/missing column/.test(refused(hdr.replace(',label','')+'\n'+row.split(',').filter((_,i)=>PROFILE_COLUMNS[i]!=='label').join(',')+'\n')[0].reason));
  assert.ok(/unexpected column/.test(refused(hdr+',extra\n'+row+',x\n')[0].reason));
  assert.equal(refused('')[0].row,null);
});

test('row-level refusals name the row and the rule',()=>{
  const p=refused(csv(
    ref,                                                                  // 1 fine
    {...cas,kind:'bogus'},                                                // 2 kind
    {...cas,content_class:'verified'},                                    // 3 class
    {...cas,bottom_depth_ft:''},                                          // 4 missing required
    {...cas,depth_basis:'md'},                                            // 5 bad basis
    {...cas,depth_basis:''},                                              // 6 missing basis
    {...cas,bottom_depth_ft:-5},                                          // 7 negative
    {...cas,top_depth_ft:3000},                                           // 8 top below bottom
    {...cas,source_ref:''},                                               // 9 empty source
    {...cas,source_ref:'x'.repeat(201)},                                  // 10 long source
    {...base,kind:'formation-top',top_depth_ft:3000,bottom_depth_ft:3100,depth_basis:'TVD',label:'F'}, // 11
    {...base,kind:'test-point',top_depth_ft:3000,depth_basis:'MD',pressure_psi:1000,pressure_basis:'psia',test_date:'2028-02-30',test_type:'static'}, // 12
    {...base,kind:'test-point',top_depth_ft:3000,depth_basis:'MD',pressure_psi:1000,pressure_basis:'psia',test_date:'15/01/2028',test_type:'static'}, // 13
    {...cas,size_in:0},                                                   // 14
    {...base,kind:'test-point',top_depth_ft:3000,depth_basis:'MD',pressure_psi:0,pressure_basis:'psia',test_date:'2028-01-01',test_type:'static'}, // 15
    {...ref},                                                             // 16 second depth-reference
    {...base,kind:'test-point',top_depth_ft:3000,depth_basis:'MD',pressure_psi:1000,pressure_basis:'abs',test_date:'2028-01-01',test_type:'static'}, // 17
    {...base,kind:'test-point',top_depth_ft:3000,depth_basis:'MD',pressure_psi:1000,test_date:'2028-01-01',test_type:'weekly'}, // 18
    {...base,kind:'depth-reference',well_id:B,reference:'KB'},            // 19 missing offset
  ));
  has(p,2,/unknown kind/);has(p,3,/content_class/);has(p,4,/requires bottom_depth_ft/);
  has(p,5,/depth_basis/);has(p,6,/requires depth_basis/);has(p,7,/negative/);has(p,8,/deeper than bottom/);
  has(p,9,/source_ref is required/);has(p,10,/longer than 200/);has(p,11,/requires bottom_source_ref/);
  has(p,12,/real/);has(p,13,/YYYY-MM-DD/);has(p,14,/size_in/);has(p,15,/pressure_psi/);
  has(p,16,/more than one depth-reference/);has(p,17,/pressure_basis/);has(p,18,/test_type/);has(p,19,/wellhead_below_reference_ft/);
  assert.ok(!p.some(x=>x.row===1));
  assert.ok(p.length>=18,'all problems reported together');
});

test('empty pressure_basis is allowed; a test-point still needs the rest',()=>{
  const ok={...base,kind:'test-point',top_depth_ft:3000,depth_basis:'TVD',pressure_psi:1000,test_date:'2028-02-29',test_type:'other'};
  assert.equal(parseDepthProfile(csv(ok)).rows[0].pressureBasis,null);
});

test('text in a numeric cell is refused, never stripped (Review Focus 5)',()=>{
  for(const v of ['3,250','3250 ft','1e3','.5','3250.','+5','NaN']) {
    const text=csv({...cas,bottom_depth_ft:`"${v}"`});
    has(refused(text),1,/bottom_depth_ft is not a plain number/);
  }
  assert.equal(parseDepthProfile(csv({...cas,bottom_depth_ft:'3250.5'})).rows[0].bottomFt,3250.5);
});

test('surveys: non-monotonic, duplicate MD and TVD>MD are refused (Review Focus 1)',()=>{
  has(refused(csv(sv(0,0),sv(1000,1000),sv(2000,900))),3,/falls/);
  has(refused(csv(sv(0,0),sv(1000,1000),sv(1000,1000))),3,/duplicate MD/);
  has(refused(csv(sv(0,0),sv(1000,1100))),2,/deeper than its MD/);
  // unsorted rows are sorted by MD, so a valid shuffled survey is accepted
  assert.equal(parseDepthProfile(csv(sv(1000,1000),sv(0,0),sv(3318,3018))).rows.length,3);
  // a flat TVD (horizontal) is allowed; a TVD within 1e-6 above MD is allowed
  assert.equal(parseDepthProfile(csv(sv(0,0),sv(1000,1000),sv(2000,1000))).rows.length,3);
  assert.equal(parseDepthProfile(csv(sv(1000,1000.0000001))).rows.length,1);
  // surveys are per well
  assert.equal(parseDepthProfile(csv(sv(0,0),{...sv(0,0),well_id:B})).rows.length,2);
});

test('pruneProfile drops only absent wells, in row order',()=>{
  const p=parseDepthProfile(FICTIONAL_DEPTH_PROFILE_CSV);
  const r=pruneProfile(p,[A]);
  assert.ok(r.profile.rows.every(x=>x.wellId===A));
  assert.equal(r.profile.rows.length,p.rows.filter(x=>x.wellId===A).length);
  assert.deepEqual(r.dropped,p.rows.filter(x=>x.wellId===B).map(x=>({row:x.row,wellId:B})));
  assert.deepEqual(r.profile.rows,p.rows.filter(x=>x.wellId===A));
  assert.equal(pruneProfile(p,[A,B]).dropped.length,0);
  assert.equal(pruneProfile(p,[]).profile.rows.length,0);
});

test('input bounds: depth and pressure above the limits are refused with the row; the limits are named constants',()=>{
  assert.equal(m.MAX_DEPTH_FT,50000);assert.equal(m.MAX_PRESSURE_PSI,50000);
  assert.equal(parseDepthProfile(csv(ref,{...cas,bottom_depth_ft:50000})).rows.length,2);
  has(refused(csv(ref,{...cas,bottom_depth_ft:50001})),2,/bottom_depth_ft is above the 50000 ft limit/);
  has(refused(csv({...ref,wellhead_below_reference_ft:50001})),1,/wellhead_below_reference_ft is above/);
  has(refused(csv(ref,sv(50001,50001))),2,/md_ft is above/);
  has(refused(csv(ref,sv(10,50001))),2,/tvd_ft is above/);
  has(refused(csv(ref,{...base,kind:'packer',top_depth_ft:1e12,depth_basis:'MD'})),2,/not a plain number|above/);
  has(refused(csv(ref,{...base,kind:'packer',top_depth_ft:'99999999999999',depth_basis:'MD'})),2,/top_depth_ft is above/);
  const tp={...base,kind:'test-point',top_depth_ft:3000,depth_basis:'MD',pressure_basis:'psia',test_date:'2028-01-01',test_type:'static'};
  assert.equal(parseDepthProfile(csv(ref,{...tp,pressure_psi:50000})).rows.length,2);
  has(refused(csv(ref,{...tp,pressure_psi:50001})),2,/pressure_psi is above the 50000 psi limit/);
});
