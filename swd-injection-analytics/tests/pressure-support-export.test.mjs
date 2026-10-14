import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {validatePressureContext,buildPressureContext,loadPressureContext} from '../dist/pressureSupport.js';
import {sealPressureContext,pressureContextCsv,pressureContextSvg,pressureContextJson} from '../dist/pressureSupportExport.js';
import {pressureContextChartSvg} from '../dist/pressureSupportChart.js';
import {createPressureContextState,exportCurrentContext,PINNED_EXAMPLE} from '../web/pressure-support.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const bytes=new Uint8Array(readFileSync(join(root,'data/pressure-support/example.json')));
const pin=JSON.parse(readFileSync(join(root,'data/pressure-support/pin.json'),'utf8'));
const P1='PS-DEMO-P01',I1='PS-DEMO-I01',I2='PS-DEMO-I02';
const ALL={producerId:P1,injectorIds:[I1,I2],firstMonth:'2024-01',lastMonth:'2025-12'};
const hashUtf8=text=>createHash('sha256').update(Buffer.from(text,'utf8')).digest('hex');
const evidence={originalBytes:bytes,sha256:pin.sha256,pin};
const raw=()=>JSON.parse(Buffer.from(bytes).toString('utf8'));
const days=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).getUTCDate();
/** Independent RFC-4180 style parser for the produced CSV (quoted cells, doubled quotes, CRLF rows). */
function parseCsv(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {const c=text[i];
    if(quoted) {if(c==='"'&&text[i+1]==='"') {cell+='"';i++;} else if(c==='"') quoted=false; else cell+=c;}
    else if(c==='"') quoted=true; else if(c===',') {row.push(cell);cell='';} else if(c==='\r'&&text[i+1]==='\n') {row.push(cell);rows.push(row);row=[];cell='';i++;} else cell+=c;}
  row.push(cell);rows.push(row);return rows;
}
const unescapeXml=s=>s.replace(/&(lt|gt|quot|#39|amp);/g,(_,e)=>({lt:'<',gt:'>',quot:'"','#39':"'",amp:'&'})[e]);
async function ready(selection=ALL,input=raw()) {return buildPressureContext(validatePressureContext(input,{sha256:pin.sha256}),selection);}

test('blocked result cannot be sealed',async()=>{
  const blocked=await ready({...ALL,injectorIds:['NOPE']});assert.equal(blocked.ready,false);
  await assert.rejects(sealPressureContext(blocked,evidence),/blocked/i);
});

test('export embeds current snapshot',async()=>{
  const result=await ready(),artifact=await sealPressureContext(result,evidence);
  assert.equal(hashUtf8(JSON.stringify(artifact.result)),artifact.resultSha256);
  assert.equal(hashUtf8(JSON.stringify(result)),artifact.resultSha256);
  const svg=pressureContextSvg(artifact);
  const extractedSvgMetadata=JSON.parse(unescapeXml(svg.match(/<metadata id="pressure-support-context">([\s\S]*?)<\/metadata>/)[1]));
  assert.deepEqual(extractedSvgMetadata,artifact);
  assert.ok(svg.includes(pressureContextChartSvg(artifact.result).replace(/<\/svg>$/,'').slice(0,4000)),'plotted chart is the shared generator output');
  const json=JSON.parse(pressureContextJson(artifact));assert.deepEqual(json,artifact);assert.equal(hashUtf8(JSON.stringify(json.result)),artifact.resultSha256);
  const csv=parseCsv(pressureContextCsv(artifact));
  const meta=Object.fromEntries(csv.filter(r=>r.length===2&&r[0]).map(r=>r));
  assert.equal(meta.artifact_id,artifact.evidence.artifactId);assert.equal(meta.result_sha256,artifact.resultSha256);
  assert.ok(svg.includes(artifact.evidence.artifactId)||extractedSvgMetadata.evidence.artifactId===artifact.evidence.artifactId);
});

test('exact source bytes are retained and every hash must agree',async()=>{
  const result=await ready(),artifact=await sealPressureContext(result,evidence),src=artifact.evidence.source;
  assert.ok(Buffer.from(src.base64,'base64').equals(Buffer.from(bytes)));
  assert.equal(src.originalText,Buffer.from(bytes).toString('utf8'));assert.equal(src.sha256,pin.sha256);assert.equal(src.bytes,bytes.length);
  assert.equal(createHash('sha256').update(Buffer.from(src.base64,'base64')).digest('hex'),pin.sha256);
  assert.deepEqual(artifact.evidence.validatedInput,raw());assert.deepEqual(artifact.evidence.pin,pin);
  const tampered=bytes.slice();tampered[50]^=1;
  await assert.rejects(sealPressureContext(result,{...evidence,originalBytes:tampered}),/SHA-256/);
  await assert.rejects(sealPressureContext(result,{...evidence,sha256:'1'.repeat(64)}),/SHA-256/);
  await assert.rejects(sealPressureContext(result,{...evidence,pin:{...pin,sha256:'2'.repeat(64)}}),/SHA-256/);
  const other=buildPressureContext(validatePressureContext(raw(),{sha256:'3'.repeat(64)}),ALL);
  await assert.rejects(sealPressureContext(other,evidence),/SHA-256/);
  const bad=new Uint8Array([0x7b,0xff,0x7d]),badSha=createHash('sha256').update(bad).digest('hex');
  const badResult=buildPressureContext(validatePressureContext(raw(),{sha256:badSha}),ALL);
  await assert.rejects(sealPressureContext(badResult,{originalBytes:bad,sha256:badSha,pin:{...pin,sha256:badSha,bytes:3}}),/UTF-8/);
});

test('row dispositions, associations, events and coverage carry complete lineage',async()=>{
  const artifact=await sealPressureContext(await ready({...ALL,injectorIds:[I2],lastMonth:'2024-12'}),evidence),e=artifact.evidence;
  const all=raw(),rowIds=[...all.producerMonthly,...all.injectorMonthly,...all.associations,...all.events].map(r=>r.rowId);
  assert.deepEqual(e.rowDispositions.map(d=>d.rowId).sort(),[...rowIds].sort());
  const d=Object.fromEntries(e.rowDispositions.map(x=>[x.rowId,x.disposition]));
  assert.equal(d['PM-P01-2024-02'],'used');assert.equal(d['PM-P01-2025-02'],'outside-selected-period');assert.equal(d['PM-P02-2024-02'],'not-selected');
  assert.equal(d['IM-I01-2024-02'],'not-selected');assert.equal(d['IM-I02-2024-08'],'used');assert.equal(d['AS-P01-I02'],'used');assert.equal(d['EV-F03'],'used');
  assert.deepEqual(e.associations.map(a=>a.injectorId),[I2]);
  assert.deepEqual(e.events.map(x=>[x.date,x.withinSelection,x.withinCoverage]),[['2024-04-15',true,true],['2026-01-10',false,false]]);
  assert.deepEqual(e.coverage,{firstMonth:'2024-01',lastMonth:'2025-12'});assert.deepEqual(e.selection,{producerId:P1,injectorIds:[I2],firstMonth:'2024-01',lastMonth:'2024-12'});
  assert.deepEqual(e.units,{producerRate:'STB/day',producerVolume:'STB',injectorVolume:'bbl/month',waterCut:'%',distance:'mi',basis:'calendar-month'});
  assert.ok(e.missingReasons.some(m=>m.month==='2024-08'&&m.reasons.some(r=>r.includes(I2))));
  assert.ok(e.missingReasons.some(m=>m.month==='2024-06'&&m.reasons.some(r=>r.includes('Water volume missing'))));
  assert.equal(e.classification,'synthetic');assert.ok(e.limitations.some(l=>/not a (numerical )?determination of pressure support/i.test(l)));
  assert.deepEqual([e.methodVersion,e.inputVersion],['pressure-support-context/1','pressure-support-input/1']);
});

test('CSV monthly values match independent arithmetic and unavailable cells carry reasons',async()=>{
  const artifact=await sealPressureContext(await ready(),evidence),rows=parseCsv(pressureContextCsv(artifact));
  const header=rows.find(r=>r[0]==='record'&&r[1]==='month'),idx=k=>header.indexOf(k);
  for(const k of ['oil_rate_stbd','water_rate_stbd','liquid_rate_stbd','water_cut_pct',`${I1}_bbl_month`,`${I2}_bbl_month`,'complete_injection_bbl_month','missing_reasons']) assert.ok(idx(k)>0,k);
  const monthly=rows.filter(r=>r[0]==='month');assert.equal(monthly.length,24);
  const src=raw();
  for(const r of monthly) {
    const m=r[1],p=src.producerMonthly.find(x=>x.producerId===P1&&x.month===m),d=days(m);
    const check=(cell,expected)=>expected===null?assert.equal(cell,'unavailable',`${m}`):assert.ok(Math.abs(Number(cell)-expected)<=1e-9*Math.max(1,expected),`${m}: ${cell} vs ${expected}`);
    check(r[idx('oil_rate_stbd')],p.oilVolumeBbl===null?null:p.oilVolumeBbl/d);
    check(r[idx('water_rate_stbd')],p.waterVolumeBbl===null?null:p.waterVolumeBbl/d);
    const total=p.oilVolumeBbl===null||p.waterVolumeBbl===null?null:p.oilVolumeBbl+p.waterVolumeBbl;
    check(r[idx('water_cut_pct')],total===null||total===0?null:100*p.waterVolumeBbl/total);
    const inj=[I1,I2].map(id=>src.injectorMonthly.find(x=>x.injectorId===id&&x.month===m).volumeBbl);
    check(r[idx('complete_injection_bbl_month')],inj.includes(null)?null:inj[0]+inj[1]);
  }
  const feb=monthly.find(r=>r[1]==='2024-02');
  assert.deepEqual([feb[idx('oil_rate_stbd')],feb[idx('water_rate_stbd')],feb[idx('liquid_rate_stbd')],feb[idx('water_cut_pct')],feb[idx('complete_injection_bbl_month')]],['1000','250','1250','20','145000']);
  const aug=monthly.find(r=>r[1]==='2024-08');assert.equal(aug[idx(`${I2}_bbl_month`)],'unavailable');assert.match(aug[idx('missing_reasons')],/PS-DEMO-I02 2024-08/);
  assert.ok(rows.some(r=>r[0]==='event'&&r.includes('2026-01-10')&&r.includes('false')));
  assert.ok(rows.filter(r=>r[0]==='source-row').length>=24+48+2+2);
  const blank=await sealPressureContext(await ready({...ALL,injectorIds:[]}),evidence),b=parseCsv(pressureContextCsv(blank));
  assert.ok(b.some(r=>r[0]==='notice'&&r[1]==='Select an associated injector'));
  assert.ok(b.filter(r=>r[0]==='month').every(r=>r.at(-2)==='unavailable'&&r.at(-1).includes('Select an associated injector')));
});

test('hostile text stays inert in CSV, SVG and JSON',async()=>{
  const input=raw();input.events[0].citation='=HYPERLINK("http://x","y")';input.events[0].uncertainty='</metadata><script>alert(1)</script>]]>';
  input.events[0].eventId='+cmd|calc';input.producerMonthly[0].rowId='@SUM(A1)';
  const hostileBytes=new TextEncoder().encode(JSON.stringify(input,null,2)),sha=createHash('sha256').update(hostileBytes).digest('hex');
  const result=buildPressureContext(validatePressureContext(input,{sha256:sha}),ALL);assert.equal(result.ready,true);
  const artifact=await sealPressureContext(result,{originalBytes:hostileBytes,sha256:sha,pin:{...pin,sha256:sha,bytes:hostileBytes.length}});
  const cells=parseCsv(pressureContextCsv(artifact)).flat();
  assert.ok(cells.includes(`'=HYPERLINK("http://x","y")`));assert.ok(cells.includes("'+cmd|calc"));assert.ok(cells.includes("'@SUM(A1)"));
  assert.ok(!cells.some(c=>/^[=+@]/.test(c)));
  const svg=pressureContextSvg(artifact),tags=svg.match(/<[^>]+>/g).join('\n');
  assert.ok(!/<script|<a[\s>]|href=|\son\w+=|<img|<foreignObject|xlink|<style|<!\[CDATA/i.test(tags));
  assert.equal((svg.match(/<\/metadata>/g)??[]).length,1);
  const meta=JSON.parse(unescapeXml(svg.match(/<metadata id="pressure-support-context">([\s\S]*?)<\/metadata>/)[1]));
  assert.equal(meta.result.events[0].uncertainty,'</metadata><script>alert(1)</script>]]>');
});

test('stale hashing is discarded after selection edits and invalidation; one artifact serves all formats',async()=>{
  const state=createPressureContextState(),{revision}=state.beginLoad();
  state.acceptLoad(revision,await loadPressureContext(bytes),{originalBytes:bytes,pin});
  assert.equal(await exportCurrentContext(state,'json'),null,'no result yet');
  state.calculate();
  const [j,c,s]=await Promise.all(['json','csv','svg'].map(f=>exportCurrentContext(state,f)));
  assert.equal(j.artifact,c.artifact);assert.equal(c.artifact,s.artifact);
  assert.deepEqual([j.filename,c.filename,s.filename].map(n=>n.replace(/\.\w+$/,'')),Array(3).fill(`pressure-support-context-${j.artifact.resultSha256.slice(0,16)}`));
  assert.deepEqual([j.mime,c.mime,s.mime],['application/json','text/csv;charset=utf-8','image/svg+xml']);
  // Real hashing interrupted by a selection edit.
  const pending=exportCurrentContext(state,'json');state.changeSelection({...ALL,injectorIds:[I1]});assert.equal(await pending,null);
  state.calculate();const again=exportCurrentContext(state,'csv');state.invalidate('Context input changed');assert.equal(await again,null);
  // Controlled seal: an edit during hashing discards the completed artifact.
  state.calculate();let release;const gate=new Promise(r=>release=r);
  const controlled=exportCurrentContext(state,'svg',{seal:async(result,ev)=>{await gate;return sealPressureContext(result,ev);}});
  state.changeSelection({...ALL});release();assert.equal(await controlled,null);
  // Blocked results never export, even when invoked programmatically.
  state.changeSelection({...ALL,injectorIds:['NOPE']});assert.equal(state.calculate().ready,false);assert.equal(await exportCurrentContext(state,'json'),null);
  // An unrelated planning-source change with no pending load keeps the accepted context exportable.
  state.changeSelection(ALL);state.calculate();assert.equal(state.abortPending('Planning source changed'),false);
  assert.ok(await exportCurrentContext(state,'json'));
});

test('Reports declares the context card with its own controls and route',()=>{
  const views=readFileSync(join(root,'web/workspace-views.mjs'),'utf8');
  assert.match(views,/\{name:'Pressure-support context',description:'Synthetic context, separate from capacity; not a pressure-support determination\.[^']*',view:'pressureSupport',prefix:'pressure-support',formats:\['json','csv','svg'\]\}/);
  assert.equal(PINNED_EXAMPLE.bytes,pin.bytes);
});

test('seal rebuilds from the verified bytes and rejects a result not derived from them',async()=>{
  const genuine=await ready();assert.ok(await sealPressureContext(genuine,evidence));
  const tamper=fn=>{const r=JSON.parse(JSON.stringify(genuine));fn(r);assert.equal(r.source.sha256,pin.sha256);return r;};
  const cases={
    'monthly number':tamper(r=>{r.monthly[1].oilRateStbd=999;}),
    'source rows':tamper(r=>{r.sourceRows.producerMonthly[0].oilVolumeBbl=1;}),
    'dropped source row':tamper(r=>{r.sourceRows.injectorMonthly.pop();}),
    'method':tamper(r=>{r.method.version='pressure-support-context/2';}),
    'events':tamper(r=>{r.events[0].withinSelection=false;}),
    'missing reason':tamper(r=>{r.monthly[5].missingReasons=[];}),
  };
  for(const [label,forged] of Object.entries(cases)) await assert.rejects(sealPressureContext(forged,evidence),/does not match a rebuild/,label);
  // Result built from modified input but claiming the pinned source hash is also rejected.
  const input=raw();input.producerMonthly[1].oilVolumeBbl=29001;
  await assert.rejects(sealPressureContext(buildPressureContext(validatePressureContext(input,{sha256:pin.sha256}),ALL),evidence),/does not match a rebuild/);
  // The accepted result hash is still the compact serialization of the caller's result.
  const artifact=await sealPressureContext(genuine,evidence);assert.equal(artifact.resultSha256,hashUtf8(JSON.stringify(genuine)));
});
