import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {AREAS,WORKSPACES,routeFor,viewFromHash} from '../web/navigation.mjs';
import {createPressureContextState,loadPinnedExample,realDataAvailability,PINNED_EXAMPLE,MAX_EXAMPLE_BYTES} from '../web/pressure-support.mjs';
import {pressureContextChartSvg} from '../dist/pressureSupportChart.js';
import {loadPressureContext,validatePressureContext,buildPressureContext} from '../dist/pressureSupport.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const bytes=new Uint8Array(readFileSync(join(root,'data/pressure-support/example.json')));
const pin=JSON.parse(readFileSync(join(root,'data/pressure-support/pin.json'),'utf8'));
const P1='PS-DEMO-P01',I1='PS-DEMO-I01',I2='PS-DEMO-I02';
/** Controlled fetch: each call returns a promise the test resolves explicitly; no timing sleeps. */
function controlledFetch() {
  const calls=[];
  const fetch=(url,init)=>new Promise((resolve,reject)=>{const call={url,init,resolve,reject};calls.push(call);init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));});
  return {fetch,calls,respond:(i,body,status=200)=>calls[i].resolve({ok:status===200,status,arrayBuffer:async()=>body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength)})};
}

test('context route roundtrips',()=>{
  assert.equal(viewFromHash(routeFor('pressureSupport')),'pressureSupport');
  assert.equal(routeFor('pressureSupport'),'#production/pressureSupport');
  assert.equal(WORKSPACES.find(w=>w.id==='pressureSupport').label,'Pressure-support context');
});

test('six areas and every existing workspace route are retained',()=>{
  assert.equal(AREAS.length,6);assert.deepEqual(AREAS.map(a=>a.id),['start','data','production','injection','fluid','reports']);
  const existing=['start','legacyCapacity','literature','data','readiness','lineage','history','forecast','reconciliation','curveLibrary','schedules','groupedPlanning','publicTrends','capacity','comparison','scenarios','sensitivity','transient','pvt','hydraulics','profiles','reports','evidence'];
  for(const id of existing) assert.equal(viewFromHash(routeFor(id)),id);
  assert.deepEqual(WORKSPACES.map(w=>w.id).filter(id=>id!=='pressureSupport'),existing);
  assert.equal(new Set(WORKSPACES.map(w=>w.id)).size,WORKSPACES.length);
});

test('pinned example constant matches the Task 2 pin and 1 MiB ceiling',()=>{
  assert.equal(PINNED_EXAMPLE.url,'/data/pressure-support/example.json');
  assert.deepEqual([PINNED_EXAMPLE.sha256,PINNED_EXAMPLE.version],[pin.sha256,pin.version]);
  assert.equal(MAX_EXAMPLE_BYTES,1024*1024);
});

test('verified load initializes first producer, all associated injectors and full coverage, but requires Calculate',async()=>{
  const state=createPressureContextState(),f=controlledFetch(),{revision,signal}=state.beginLoad();
  assert.equal(state.snapshot().pending,true);
  const loading=loadPinnedExample({fetch:f.fetch,signal});
  assert.equal(f.calls[0].url,PINNED_EXAMPLE.url);f.respond(0,bytes);
  assert.equal(state.acceptLoad(revision,await loading),true);
  const snap=state.snapshot();
  assert.deepEqual(snap.selection,{producerId:P1,injectorIds:[I1,I2],firstMonth:'2024-01',lastMonth:'2025-12'});
  assert.equal(snap.result,null);assert.equal(snap.pending,false);assert.equal(snap.exportReady,false);
  assert.deepEqual([snap.input.datasetId,snap.input.sha256,snap.input.classification],['pressure-support-demo/seed-20261012/v1',pin.sha256,'synthetic']);
  const result=state.calculate();assert.equal(result.ready,true);assert.equal(state.snapshot().exportReady,true);
  assert.equal(result.monthly.find(m=>m.month==='2024-02').completeInjectionVolumeBbl,145000);
});

test('old load cannot revive state',async()=>{
  const state=createPressureContextState(),validatedInput=await loadPressureContext(bytes);
  const a=state.beginLoad();const b=state.beginLoad();
  assert.equal(a.signal.aborted,true);assert.equal(b.signal.aborted,false);
  const oldRevision=a.revision;
  assert.equal(state.acceptLoad(oldRevision,validatedInput),false);assert.equal(state.snapshot().result,null);
  assert.equal(state.acceptLoad(b.revision,validatedInput),true);state.calculate();assert.ok(state.snapshot().result);
  // A newer load invalidates the accepted context and its result immediately.
  const c=state.beginLoad();assert.equal(state.snapshot().result,null);assert.equal(state.snapshot().input,null);
  assert.equal(state.acceptLoad(b.revision,validatedInput),false);
  // A selection edit while loading orphans the pending load.
  state.changeSelection({producerId:P1,injectorIds:[I1],firstMonth:'2024-01',lastMonth:'2024-12'});
  assert.equal(c.signal.aborted,true);assert.equal(state.acceptLoad(c.revision,validatedInput),false);assert.equal(state.snapshot().result,null);
});

test('load A completing after load B is ignored with controlled promises',async()=>{
  const state=createPressureContextState(),f=controlledFetch();
  const a=state.beginLoad(),loadA=loadPinnedExample({fetch:f.fetch,signal:a.signal}).then(v=>state.acceptLoad(a.revision,v),e=>e.name);
  const b=state.beginLoad(),loadB=loadPinnedExample({fetch:f.fetch,signal:b.signal}).then(v=>state.acceptLoad(b.revision,v));
  f.respond(1,bytes);assert.equal(await loadB,true);
  assert.equal(await loadA,'AbortError');
  assert.equal(state.snapshot().revision,b.revision);
});

test('selection edits clear results and export synchronously',async()=>{
  const state=createPressureContextState(),{revision}=state.beginLoad();
  state.acceptLoad(revision,await loadPressureContext(bytes));state.calculate();assert.equal(state.snapshot().exportReady,true);
  state.changeSelection({producerId:P1,injectorIds:[I1],firstMonth:'2024-01',lastMonth:'2025-12'});
  assert.equal(state.snapshot().result,null);assert.equal(state.snapshot().exportReady,false);
  assert.deepEqual(state.calculate().selection.injectorIds,[I1]);
  state.invalidate('Planning source changed');assert.equal(state.snapshot().result,null);assert.equal(state.snapshot().exportReady,false);
  // Invalid accepted selections return the Task 2 blocked result rather than null.
  state.changeSelection({producerId:P1,injectorIds:['NOPE'],firstMonth:'2024-01',lastMonth:'2025-12'});
  const blocked=state.calculate();assert.equal(blocked.ready,false);assert.deepEqual(blocked.monthly,[]);
  assert.equal(state.snapshot().exportReady,false);assert.ok(state.snapshot().reasons.some(r=>r.includes('NOPE')));
  assert.equal(createPressureContextState().calculate(),null);
});

test('cancel and source change abort pending loads and require explicit reload',async()=>{
  const state=createPressureContextState(),f=controlledFetch();
  const a=state.beginLoad(),pending=loadPinnedExample({fetch:f.fetch,signal:a.signal}).catch(e=>e.name);
  state.cancel();assert.equal(a.signal.aborted,true);assert.equal(await pending,'AbortError');
  const snap=state.snapshot();assert.equal(snap.pending,false);assert.equal(snap.input,null);assert.equal(snap.result,null);
  assert.ok(snap.reasons.some(r=>r.includes('reload')));
  assert.equal(state.acceptLoad(a.revision,await loadPressureContext(bytes)),false);
  const b=state.beginLoad();state.abortPending('Planning source changed while loading');
  assert.equal(b.signal.aborted,true);assert.equal(state.acceptLoad(b.revision,await loadPressureContext(bytes)),false);
  assert.equal(state.snapshot().pending,false);
});

test('corrupt, hash-mismatched, oversize and HTTP failures stay visible and retry succeeds',async()=>{
  const state=createPressureContextState();
  const attempt=async body=>{const f=controlledFetch(),{revision,signal}=state.beginLoad(),p=loadPinnedExample({fetch:f.fetch,signal});
    if(body===404) f.respond(0,new Uint8Array(),404);else f.respond(0,body);
    try {return state.acceptLoad(revision,await p);} catch(error) {state.failLoad(revision,error.message);return error.message;}};
  const tampered=bytes.slice();tampered[100]^=1;
  assert.match(await attempt(tampered),/SHA-256 mismatch/);assert.equal(state.snapshot().input,null);
  assert.ok(state.snapshot().reasons.some(r=>/SHA-256 mismatch/.test(r)));assert.equal(state.snapshot().failed,true);
  assert.match(await attempt(new Uint8Array(MAX_EXAMPLE_BYTES+1)),/exceeds 1 MiB/);
  assert.match(await attempt(new Uint8Array([0xff,0xfe])),/SHA-256 mismatch/);
  assert.match(await attempt(404),/HTTP 404/);
  assert.equal(await attempt(bytes),true);assert.equal(state.snapshot().failed,false);assert.deepEqual(state.snapshot().reasons,[]);
});

test('byte verification happens before decoding; invalid UTF-8 with a matching pin is rejected',async()=>{
  const bad=new Uint8Array([0x7b,0xff,0x7d]);const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bad))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const f=controlledFetch(),p=loadPinnedExample({fetch:f.fetch,signal:new AbortController().signal,pinned:{...PINNED_EXAMPLE,sha256:sha}});
  f.respond(0,bad);await assert.rejects(p,/UTF-8 JSON/);
});

test('chart SVG is self-contained, escaped and shared for live/export use',()=>{
  const raw=JSON.parse(new TextDecoder().decode(bytes));
  raw.events[0].eventId='<script>alert(1)</script>';raw.events[0].citation='<a href="https://x">x</a> & "q"';
  raw.producers[0].name='<img src=x onerror=1>';
  const result=buildPressureContext(validatePressureContext(raw,{sha256:pin.sha256}),{producerId:P1,injectorIds:[I1,I2],firstMonth:'2024-01',lastMonth:'2025-12'});
  assert.equal(result.ready,true);
  const svg=pressureContextChartSvg(result);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  const tags=svg.match(/<[^>]+>/g).join('\n');
  assert.ok(!/<script|<a[\s>]|href=|\son\w+=|<img|<foreignObject|url\(|xlink|<style/i.test(tags),tags.match(/<script|<a[\s>]|href=|\son\w+=|<img/i)?.[0]);
  assert.ok(svg.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(svg.includes('&lt;a href=&quot;https://x&quot;&gt;x&lt;/a&gt; &amp; &quot;q&quot;'));
  assert.ok(/Oil rate.*STB\/day/.test(svg)&&/Injection.*bbl\/month/.test(svg)&&svg.includes('Water cut (%)'));
  assert.ok(svg.includes('2026-01-10')&&/outside the selected period/i.test(svg));
  assert.equal(svg,pressureContextChartSvg(result));
});

test('null observations break lines and events use continuous UTC dates within the month',()=>{
  const result=buildPressureContext(validatePressureContext(JSON.parse(new TextDecoder().decode(bytes)),{sha256:pin.sha256}),{producerId:P1,injectorIds:[I1,I2],firstMonth:'2024-01',lastMonth:'2025-12'});
  const svg=pressureContextChartSvg(result);
  const water=svg.match(/<path[^>]*data-series="water-rate"[^>]*d="([^"]+)"/)[1];
  assert.ok((water.match(/M/g)??[]).length>=2,'missing June water must start a new segment');
  const inj=svg.match(/<path[^>]*data-series="injector-PS-DEMO-I02"[^>]*d="([^"]+)"/)[1];assert.ok((inj.match(/M/g)??[]).length>=2);
  const marker=Number(svg.match(/data-event-date="2024-04-15"[^>]*x1="([\d.]+)"/)[1]);
  const aprStart=Number(svg.match(/data-month-start="2024-04"[^>]*x="([\d.]+)"/)[1]),mayStart=Number(svg.match(/data-month-start="2024-05"[^>]*x="([\d.]+)"/)[1]);
  const fraction=(marker-aprStart)/(mayStart-aprStart);assert.ok(Math.abs(fraction-14.5/30)<0.01,`fraction ${fraction}`);
  const blockedSvg=pressureContextChartSvg(buildPressureContext(validatePressureContext(null),{}));
  assert.ok(blockedSvg.includes('Context unavailable')&&!blockedSvg.includes('data-series'));
});

test('real-data mode lists missing inputs without synthetic fallback',()=>{
  for(const source of [null,'public','user','demo']) {
    const a=realDataAvailability(source);assert.equal(a.ready,false);
    assert.ok(['producer oil/water','association evidence','frac','composition contract'].every(k=>a.missing.some(m=>m.toLowerCase().includes(k))),source);
    assert.ok(!a.missing.some(m=>m.includes('PS-DEMO')));
  }
  assert.ok(realDataAvailability('public').notes.some(n=>n.includes('Injector history')));
});

test('integration hooks: early route before analysis-select, hide list, labels, section and CSS',()=>{
  const ui=readFileSync(join(root,'web/import-ui.mjs'),'utf8'),html=readFileSync(join(root,'web/index.html'),'utf8');
  const early=ui.indexOf("if(next==='pressureSupport')"),select=ui.indexOf("$('analysis-select').value=key");
  assert.ok(early>0&&select>early,'pressureSupport must return before analysis-select/readiness');
  assert.ok(ui.indexOf("if(next==='pressureSupport')")>ui.indexOf("if(['readiness','lineage'].includes(next))"));
  assert.match(ui,/for\(const id of \[[^\]]*'pressure-support'[^\]]*\]\)\$\(`\$\{id\}-workspace`\)\.hidden=true/);
  assert.match(ui,/\['pvt','literature','hydraulics','profiles','pressureSupport'\]\.includes\(next\)/);
  assert.match(ui,/next==='pvt'\|\|next==='literature'\|\|next==='pressureSupport'/);
  assert.ok(!/switchSource\([^)]*pressure/i.test(ui)&&!/state\.inputs[^;]*pressure/i.test(ui));
  assert.ok(html.includes('<section id="pressure-support-workspace" hidden'));assert.ok(html.includes('<link rel="stylesheet" href="/pressure-support.css">'));
});

test('controller is import-safe and the chart wrapper parses only escaped generated SVG',async()=>{
  assert.equal(typeof globalThis.document,'undefined');
  const mod=await import('../web/pressure-support.mjs');assert.equal(typeof mod.mountPressureContext,'function');
  const {renderPressureContextChart}=await import('../web/pressure-support-chart.mjs');
  const raw=JSON.parse(new TextDecoder().decode(bytes));raw.events[0].citation='<img src=x onerror=alert(1)><script>x()</script>';
  const result=buildPressureContext(validatePressureContext(raw,{sha256:pin.sha256}),{producerId:P1,injectorIds:[I1,I2],firstMonth:'2024-01',lastMonth:'2025-12'});
  const parsed=[],imported=[];let parserError=false;
  globalThis.DOMParser=class{parseFromString(text,type){parsed.push([text,type]);const root={localName:parserError?'html':'svg'};return {documentElement:root,getElementsByTagName:tag=>tag==='parsererror'&&parserError?[{}]:[]};}};
  globalThis.document={importNode:(node,deep)=>{imported.push([node,deep]);return node;}};
  try {
    const node=renderPressureContextChart(result);
    assert.deepEqual(parsed,[[pressureContextChartSvg(result),'image/svg+xml']]);assert.equal(imported.length,1);assert.equal(node.localName,'svg');
    assert.ok(parsed[0][0].includes('&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;x()&lt;/script&gt;'));
    assert.ok(!/<(script|img|a|foreignObject)[s>]/i.test(parsed[0][0]));
    parserError=true;assert.throws(()=>renderPressureContextChart(result),/could not be parsed/);assert.equal(imported.length,1);
  } finally {delete globalThis.DOMParser;delete globalThis.document;}
});
