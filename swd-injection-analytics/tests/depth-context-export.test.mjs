import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const load=f=>import(pathToFileURL(resolve(engineDir,f)));
const dc=await load('depthContext.js');
const dp=await load('depthProfile.js');
const disposal=await load('disposalCase.js');
const summary=await load('caseSummary.js');
const ip=await load('importProfile.js');
const svgMod=await load('depthContextSvg.js');
const ex=await load('depthContextExport.js');
const {parseDepthProfile,pruneProfile,FICTIONAL_DEPTH_PROFILE_CSV,PROFILE_COLUMNS}=dp;
const {buildDepthContext,curveSources}=dc;

// Fixtures follow tests/depth-context.test.mjs. Fictional data only.
const A='FICTIONAL-INJ-A',B='FICTIONAL-INJ-B';
const well={id:A,reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3300,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const caseInput=(over={})=>({caseName:'Fictional depth export',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:0}],evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:B,injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:A,injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8},...over});
const segmented={model:'segmented-brine',surfaceTemperatureF:80,segments:16};
const uniformCase=over=>disposal.buildDisposalCase(caseInput(over));
const segmentedCase=over=>disposal.buildDisposalCase(caseInput({hydraulics:segmented,...over}));
const profile=parseDepthProfile(FICTIONAL_DEPTH_PROFILE_CSV);
const sel=(over={})=>({wellIds:[A,B],basis:'TVD',scenario:'base',month:'2028-02',referenceDepthFt:null,referencePressurePsia:null,...over});
const exportOf=(result,over={},prof=profile,dropped=[])=>{
  const s=sel(over),sources=curveSources(result,s.scenario,s.month,s.wellIds);
  return {profile:prof,dropped,sources,selection:s,caseRef:{schemaVersion:'disposal-case/1',methodVersion:'method/1',contentSha256:'a'.repeat(64)},context:buildDepthContext(prof,sources,s)};
};
const clone=v=>JSON.parse(JSON.stringify(v));
const unsealed=x=>{const {contentSha256:_,schemaVersion:__,versions:___,...b}=x;return b;};
const rejects=p=>assert.rejects(p,/Result changed or stale: /);
const polylines=svg=>[...svg.matchAll(/<polyline[^>]*points="([^"]*)"/g)].map(m=>m[1].trim().split(/\s+/).length);
const visible=svg=>svg.replace(/<metadata>[\s\S]*<\/metadata>/,'').replace(/<[^>]+>/g,' ').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ');
const strip=s=>s.split(dc.REVIEW_AID).join('');
const q=s=>`"${s.replace(/"/g,'""')}"`;
const profileCsv=(...rows)=>[PROFILE_COLUMNS.join(','),...rows.map(r=>PROFILE_COLUMNS.map(c=>r[c]??'').join(','))].join('\n')+'\n';

test('constants and the schema name',()=>{
  assert.equal(ex.DEPTH_EXPORT_SCHEMA,'depth-context-export/1');
  assert.equal(svgMod.CURVE_LABEL,'modelled (case, assumed inputs)');
  assert.equal(svgMod.TEST_LABEL,'measured (as entered, with source)');
});

for(const [name,mk] of [['uniform',uniformCase],['segmented',segmentedCase]]) {
  test(`${name}: a JSON round trip verifies and the seal carries schema, versions and a hash`,async()=>{
    const s=await ex.sealDepth(exportOf(mk()));
    assert.equal(s.schemaVersion,'depth-context-export/1');
    assert.match(s.contentSha256,/^[a-f0-9]{64}$/);
    assert.equal(s.versions.depthContext,dc.DEPTH_CONTEXT_VERSION);
    assert.equal(s.versions.depthProfile,dp.DEPTH_PROFILE_VERSION);
    assert.ok(s.versions.depthExport);
    assert.equal(await ex.verifyDepth(s),s);
    const back=JSON.parse(ex.depthJson(s));
    assert.deepEqual(back,s);
    await ex.verifyDepth(back);
  });
}

test('an edited node pressure is rejected without resealing, and also when resealed (recomputation)',async()=>{
  const s=await ex.sealDepth(exportOf(segmentedCase()));
  const e=clone(s);e.context.tracks[0].curve.nodes[3].pressurePsia+=5;
  await rejects(ex.verifyDepth(e));
  await rejects(ex.verifyDepth(await ex.sealDepth(unsealed(e))));
});

test('an edited source point is rejected, resealed (the point is recomputed, never trusted)',async()=>{
  const s=await ex.sealDepth(exportOf(segmentedCase()));
  const e=clone(s);e.sources[0].point.bottomholePsia+=1;
  await rejects(ex.verifyDepth(await ex.sealDepth(unsealed(e))));
});

test('an edited profile depth is rejected, resealed: raw and parsed fields must agree, and the context is recomputed',async()=>{
  const s=await ex.sealDepth(exportOf(uniformCase()));
  const i=s.profile.rows.findIndex(r=>r.kind==='packer'&&r.wellId===A);
  const e1=clone(s);e1.profile.rows[i].topFt+=40;
  await rejects(ex.verifyDepth(await ex.sealDepth(unsealed(e1))));
  const e2=clone(s);e2.profile.rows[i].topFt+=40;e2.profile.rows[i].raw.top_depth_ft=String(e2.profile.rows[i].topFt);
  await rejects(ex.verifyDepth(await ex.sealDepth(unsealed(e2))));
  const e3=clone(s);e3.profile.rows[i].raw.top_depth_ft='3,000';
  await rejects(ex.verifyDepth(await ex.sealDepth(unsealed(e3))));
});

test('an edited onstreamStbd is rejected, resealed',async()=>{
  const s=await ex.sealDepth(exportOf(segmentedCase()));
  const e=clone(s);e.sources[1].onstreamStbd*=1.01;
  await rejects(ex.verifyDepth(await ex.sealDepth(unsealed(e))));
});

test('an edited limit, hydraulics setting, selection or reference shape is rejected, resealed',async()=>{
  const s=await ex.sealDepth(exportOf(segmentedCase()));
  const edits=[e=>{e.sources[0].well.limitPsia+=1;},e=>{e.sources[0].hydraulics.segments=8;},e=>{e.selection.month='2028-03';},e=>{e.selection.wellIds=[A];},e=>{e.caseRef.methodVersion=5;},e=>{e.dropped='x';},e=>{e.sources.pop();}];
  for(const f of edits){const e=clone(s);f(e);await rejects(ex.verifyDepth(await ex.sealDepth(unsealed(e))));}
});

test('a wrong schema, a missing or wrong digest and edited text are rejected',async()=>{
  const s=await ex.sealDepth(exportOf(uniformCase()));
  await rejects(ex.verifyDepth({...s,schemaVersion:'depth-context-export/0'}));
  await rejects(ex.verifyDepth({...s,contentSha256:''}));
  await rejects(ex.verifyDepth({...s,contentSha256:'b'.repeat(64)}));
  await rejects(ex.verifyDepth(null));
  await rejects(ex.verifyDepth({...clone(s),caseRef:{...s.caseRef,contentSha256:'c'.repeat(64)}}));
});

test('a pruned profile (original row numbers with gaps) and the dropped list verify; dropped rows are in the CSV',async()=>{
  const {profile:pruned,dropped}=pruneProfile(profile,[A]);
  assert.ok(dropped.length>0);
  const s=await ex.sealDepth(exportOf(uniformCase(),{wellIds:[A]},pruned,dropped));
  await ex.verifyDepth(s);
  const csv=ex.depthCsv(s);
  assert.equal(csv.split('\r\n').filter(l=>l.startsWith('"dropped",')).length,dropped.length);
  assert.ok(csv.includes('"'+dc.DROPPED+'"'));
  assert.deepEqual(s.profile.rows.map(r=>r.row),pruned.rows.map(r=>r.row));
  // A well kept but with its first rows removed also keeps its numbers.
  const mid={version:profile.version,rows:profile.rows.filter(r=>r.row!==2&&r.row!==5)};
  await ex.verifyDepth(await ex.sealDepth(exportOf(uniformCase(),{},mid)));
});

test('two seals of the same input are byte-identical (JSON, CSV, SVG)',async()=>{
  const r=segmentedCase();
  const a=await ex.sealDepth(exportOf(r)),b=await ex.sealDepth(exportOf(r));
  assert.equal(ex.depthJson(a),ex.depthJson(b));
  assert.equal(ex.depthCsv(a),ex.depthCsv(b));
  assert.equal(ex.depthSvg(a),ex.depthSvg(b));
  assert.equal(a.contentSha256,b.contentSha256);
});

test('the SVG round trip verifies; one changed character outside the metadata is rejected; so is one inside',async()=>{
  const s=await ex.sealDepth(exportOf(segmentedCase(),{referenceDepthFt:1500,referencePressurePsia:1800}));
  const svg=ex.depthSvg(s);
  assert.deepEqual(await ex.verifyDepthSvg(svg),s);
  assert.equal(svg,svgMod.depthContextSvg(s.context,ex.depthJson(s)));
  const meta=svg.indexOf('</metadata>');
  const outside=svg.slice(0,meta+12)+svg.slice(meta+12).replace('<polyline','<polyline data-x="1"');
  assert.notEqual(outside,svg);
  await rejects(ex.verifyDepthSvg(outside));
  const text=svg.replace('Fictional Sand A','Fictional Sand Z');
  assert.notEqual(text,svg);
  await rejects(ex.verifyDepthSvg(text));
  const x=svg.indexOf('<metadata>')+30;
  await rejects(ex.verifyDepthSvg(svg.slice(0,x)+(svg[x]==='a'?'b':'a')+svg.slice(x+1)));
  await rejects(ex.verifyDepthSvg('<svg></svg>'));
});

test('no decimation: every polyline has one point per curve node',async()=>{
  for(const mk of [segmentedCase,uniformCase]){
    const s=await ex.sealDepth(exportOf(mk()));
    const nodes=s.context.tracks.filter(t=>t.curve.status==='drawn').map(t=>t.curve.nodes.length);
    assert.equal(nodes.length,2);
    assert.deepEqual(polylines(ex.depthSvg(s)),nodes);
  }
  const s=await ex.sealDepth(exportOf(segmentedCase()));
  assert.equal(s.context.tracks[0].curve.nodes.length,s.sources[0].point.traverse.points.length);
  assert.ok(s.context.tracks[0].curve.nodes.length>2);
  const csv=ex.depthCsv(s);
  const n=s.context.tracks[0].curve.nodes.length;
  assert.equal(csv.split('\r\n').filter(l=>l.startsWith(`"curve-nodes","${A}","node `)&&l.includes(' pressure_psia"')).length,n);
});

test('drawing: one track per well, shared depth axis, labels, legend, desc, marker and test points',async()=>{
  const s=await ex.sealDepth(exportOf(uniformCase(),{referenceDepthFt:1500,referencePressurePsia:1800}));
  const svg=ex.depthSvg(s);
  assert.match(svg,/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal([...svg.matchAll(/<g data-well="/g)].length,2);
  assert.ok(svg.includes(`data-well="${A}"`)&&svg.includes(`data-well="${B}"`));
  assert.ok(svg.includes(`<desc>${dc.REVIEW_AID}</desc>`));
  for(const t of [svgMod.CURVE_LABEL,svgMod.TEST_LABEL,dc.TEST_DATE_NOTE,'Fictional Sand A','Fictional Shale B','2028-01-15 static'])assert.ok(svg.includes(t),t);
  for(const l of ['Measured (user, not verified)','Assumed','Literature','Public, as reported'])assert.ok(svg.includes(l),l);
  assert.ok(visible(svg).includes(dc.CURVE_DEPTH_NOTE));
  assert.ok(visible(svg).includes(dc.LIMIT_LABEL));
  assert.ok(visible(svg).includes(dc.REVIEW_AID));
  assert.equal([...svg.matchAll(/<polygon[^>]*class="limit"/g)].length,2);
  assert.equal([...svg.matchAll(/<circle[^>]*class="test-point"/g)].length,2);  // A: two tests; B test has no pressure basis, so it is a gap and not drawn
  assert.equal([...svg.matchAll(/class="ref-depth"/g)].length,2);
  assert.equal([...svg.matchAll(/class="ref-pressure"/g)].length,2);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(!svg.includes('\r'));
});

test('the uniform-model note is drawn when a uniform curve is shown',async()=>{
  const svg=ex.depthSvg(await ex.sealDepth(exportOf(uniformCase())));
  // The legend wraps long notes into lines; every word is still present in order.
  assert.ok(svg.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').includes(dc.UNIFORM_NOTE.slice(0,60)));
  const seg=ex.depthSvg(await ex.sealDepth(exportOf(segmentedCase())));
  assert.ok(!seg.includes('uniform brine model'));
});

test('a flagged curve is dashed and red; a shut-in curve is not drawn',async()=>{
  const r=uniformCase({wells:[{...well,tvdFt:5000,measuredDepthFt:5500}],demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:29}],evidence:{fixture:'seed-417/v1'}}});
  const f=ex.depthSvg(await ex.sealDepth(exportOf(r,{wellIds:[A]})));
  assert.match(f,/<polyline[^>]*stroke="#c62828"[^>]*stroke-dasharray="/);
  const ok=ex.depthSvg(await ex.sealDepth(exportOf(uniformCase())));
  assert.ok(!/<polyline[^>]*stroke-dasharray/.test(ok));
  const shut=uniformCase({comparison:{wellId:A,injectivityMultiplier:0.5,innerDiameterInches:5,availability:0}});
  const sv=ex.depthSvg(await ex.sealDepth(exportOf(shut,{scenario:'compared'})));
  assert.equal(polylines(sv).length,1);
});

test('user text is XML-escaped in the drawing and the metadata unescapes exactly',async()=>{
  const evil='a<b>&"q"\'s</title><script>x</script>';
  const p=parseDepthProfile(profileCsv(
    {well_id:A,kind:'depth-reference',reference:'KB',wellhead_below_reference_ft:18,source_ref:'ref',content_class:'assumed'},
    {well_id:A,kind:'formation-top',top_depth_ft:2000,depth_basis:'TVD',label:q(evil),source_ref:q(evil),content_class:'literature'}));
  assert.equal(p.rows[1].label,evil);
  const s=await ex.sealDepth(exportOf(uniformCase(),{wellIds:[A]},p));
  const svg=ex.depthSvg(s);
  assert.ok(!svg.includes('<script>')&&!svg.includes(evil));
  assert.ok(svg.includes('a&lt;b&gt;&amp;&quot;q&quot;'));
  assert.deepEqual(await ex.verifyDepthSvg(svg),s);
});

test('CSV: every line has 4 fields, the review-aid sentence and the placements are present',async()=>{
  const s=await ex.sealDepth(exportOf(segmentedCase(),{basis:'MD'}));
  const csv=ex.depthCsv(s);
  assert.ok(csv.endsWith('\r\n'));
  const t=ip.parseCsv(csv);
  assert.deepEqual(t.headers,['section','rule_or_well','field','value']);
  assert.ok(t.rows.length>50);
  for(const r of t.rows)assert.equal(r.values.length,4);
  assert.ok(csv.includes(dc.REVIEW_AID));
  const sections=new Set(t.rows.map(r=>r.values[0]));
  for(const k of ['selection','case-ref','rows','curve-nodes','curve-notes','review-aid'])assert.ok(sections.has(k),k);
  const b=await ex.sealDepth(exportOf(uniformCase(),{basis:'TVD'}));
  const bc=ex.depthCsv(b);
  assert.ok(bc.includes(dc.gapNoSurvey('MD','TVD')));
  assert.ok(bc.includes('conversion_stations')&&bc.includes('conversion_top_stations'));
  assert.ok(bc.includes('"'+b.caseRef.contentSha256+'"'));
  assert.ok(bc.includes('"'+b.contentSha256+'"'));
});

test('CSV cells are neutralised for spreadsheets and never contain a bare newline',async()=>{
  const p=parseDepthProfile(profileCsv(
    {well_id:A,kind:'depth-reference',reference:'KB',wellhead_below_reference_ft:18,source_ref:'ref',content_class:'assumed'},
    {well_id:A,kind:'formation-top',top_depth_ft:2000,depth_basis:'TVD',label:'"=SUM(1,1)"',source_ref:'"line1\nline2"',content_class:'literature'}));
  const s=await ex.sealDepth(exportOf(uniformCase(),{wellIds:[A]},p));
  const csv=ex.depthCsv(s);
  assert.ok(csv.includes('"\'=SUM(1,1)"'));
  for(const r of ip.parseCsv(csv).rows)assert.equal(r.values.length,4);
  assert.equal(csv.split('\r\n').length,csv.split('\n').length);
});

test('banned words do not appear in any generated text other than the review-aid sentence',async()=>{
  for(const mk of [uniformCase,segmentedCase]){
    const s=await ex.sealDepth(exportOf(mk(),{referenceDepthFt:1500,referencePressurePsia:1800}));
    const svg=ex.depthSvg(s),csv=ex.depthCsv(s);
    for(const t of [strip(visible(svg)),strip(csv)])assert.ok(!summary.BANNED.test(t),(t.match(summary.BANNED)||[])[0]);
  }
});

test('the drawing code reads no clock and makes no random ids',()=>{
  const src=svgMod.depthContextSvg.toString()+ex.depthSvg.toString();
  assert.ok(!/new Date|Date\.(now|UTC)|Math\.random|crypto/.test(src));
});

test('a drawing at the maximum depth has a bounded tick count on every axis; niceStep is open-ended',async()=>{
  assert.equal(svgMod.niceStep(1e12,8)<=1e12,true);
  for(const v of [1,7,999,5e4,3e6,1e12,1e300])assert.ok(v/svgMod.niceStep(v,8)<=8,String(v));
  assert.throws(()=>svgMod.niceStep(Infinity,8),/not finite/);
  const deep=uniformCase({wells:[{...well,tvdFt:50000,measuredDepthFt:50000,reservoirPsia:9000,limitPsia:9900,surfaceLimitPsia:9900}]});
  const svg=ex.depthSvg(await ex.sealDepth(exportOf(deep,{wellIds:[A]})));
  const ticks=svg.match(/<g class="depth-axis"[\s\S]*?<\/g>/)[0].match(/<line /g).length;
  assert.ok(ticks<30,`depth ticks ${ticks}`);
  assert.ok((svg.match(/<line [^>]*y1="78" [^>]*y2="498"/g)??[]).length<30);
  assert.ok(svg.length<200000);
});

test('a track with no curve says why in the drawing (escaped, deterministic)',async()=>{
  const shut=uniformCase({comparison:{wellId:A,injectivityMultiplier:0.5,innerDiameterInches:5,availability:0}});
  const s1=ex.depthSvg(await ex.sealDepth(exportOf(shut,{scenario:'compared'}))),s2=ex.depthSvg(await ex.sealDepth(exportOf(shut,{scenario:'compared'})));
  assert.equal(s1,s2);
  const txt=[...s1.matchAll(/<text class="curve-gap"[^>]*>([^<]*)<\/text>/g)].map(x=>x[1]).join(' ');
  assert.ok(txt.includes('no modelled curve:')&&txt.includes('shut in'),txt);
  assert.deepEqual(await ex.verifyDepthSvg(s1),await ex.sealDepth(exportOf(shut,{scenario:'compared'})));
  assert.ok(!/<text class="curve-gap"/.test(ex.depthSvg(await ex.sealDepth(exportOf(uniformCase())))));
});

test('the depth-axis title is inside the left margin (rotated, not anchored past x=0)',async()=>{
  const svg=ex.depthSvg(await ex.sealDepth(exportOf(uniformCase())));
  assert.match(svg,/<text transform="translate\(12,288\) rotate\(-90\)" text-anchor="middle">TVD depth below the depth reference \(ft\)<\/text>/);
});

test('a reference depth or pressure above the limits is refused by buildDepthContext',()=>{
  const r=uniformCase(),sources=curveSources(r,'base','2028-02',[A]);
  assert.throws(()=>buildDepthContext(profile,sources,sel({wellIds:[A],referenceDepthFt:50001})),/at most 50000 ft/);
  assert.throws(()=>buildDepthContext(profile,sources,sel({wellIds:[A],referencePressurePsia:50001})),/at most 50000 psia/);
  assert.ok(buildDepthContext(profile,sources,sel({wellIds:[A],referenceDepthFt:50000,referencePressurePsia:50000})));
});
