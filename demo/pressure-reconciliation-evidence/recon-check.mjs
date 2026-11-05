// Usage: node recon-check.mjs <width> <height> <mobile 0|1> <tag> <mode: synthetic|real> <main.tar>
// Self-contained CDP driver for the Phase 2a Well assumptions + WHP/BHP reconciliation panels (modelled on demo/test-referenced-j-evidence/j-check.mjs).
// Packages live only in the session scratchpad. Server: PORT=4290 node scripts/serve.mjs; Chrome --remote-debugging-port=9333.
// Real mode records counts and reasons only: no per-month or per-test values, no screenshots.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const [w='1280',h='900',mobile='0',tag='desktop',mode='synthetic',TAR]=process.argv.slice(2);
const BASE='http://127.0.0.1:4290/';
if(mode==='synthetic')mkdirSync(join(here,'downloads',tag),{recursive:true});
const t=await (await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const pending=new Map();const events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}else if(m.method)events.push(m);};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send('Emulation.setDeviceMetricsOverride',{width:+w,height:+h,deviceScaleFactor:1,mobile:mobile==='1'});
await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('DOM.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`
window.__dl=[];const _c=URL.createObjectURL.bind(URL),map=new Map();
URL.createObjectURL=b=>{const u=_c(b);map.set(u,b);return u;};
HTMLAnchorElement.prototype.click=function(){if(this.download){const b=map.get(this.href),name=this.download;window.__dl.push({name,type:b&&b.type,p:b?b.text():Promise.resolve(null)});return;}};
`});
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${expr}})()`,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,800));return r.result?.result?.value;};
const wait=async(expr,ms=60000)=>{const s=Date.now();while(Date.now()-s<ms){try{if(await ev('return '+expr))return true;}catch{}await sleep(200);}throw Error('TIMEOUT '+expr);};
const shotOn=mode==='synthetic';
const shot=async name=>{if(!shotOn)return;const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(here,`${tag}-${name}.png`),Buffer.from(r.result.data,'base64'));};
const results={};const rec=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v).slice(0,600));};
const sha=s=>createHash('sha256').update(Buffer.from(s,'utf8')).digest('hex');
let stage='';
const flush=async()=>{const out=await ev(`const o=[];for(const d of window.__dl){o.push({name:d.name,type:d.type,text:await d.p});}window.__dl=[];return o;`);const res=[];for(const d of out){if(mode==='synthetic'&&d.text!=null)writeFileSync(join(here,'downloads',tag,`${stage}__${d.name}`),d.text);res.push({name:d.name,type:d.type,chars:d.text?.length,sha256:d.text!=null?sha(d.text):null,calibrated:d.text!=null&&/calibrated/i.test(d.text)});}return res;};
const nav=view=>ev(`const n=await import('/navigation.mjs');history.pushState(null,'',n.routeFor('${view}'));dispatchEvent(new PopStateEvent('popstate'));return 1;`);
const WA='#well-assumptions',J='#injectivity-estimate',RC='#pressure-reconciliation',H10='#h10-diagnostics';
const scrollTo=(sel,block='start')=>ev(`document.querySelector('${sel}').scrollIntoView({block:'${block}'});await new Promise(r=>setTimeout(r,300));return true;`);
const setFile=async(selector,paths)=>{const doc=await send('DOM.getDocument',{depth:0});const n=await send('DOM.querySelector',{nodeId:doc.result.root.nodeId,selector});if(!n.result.nodeId)throw Error('no node '+selector);await send('DOM.setFileInputFiles',{nodeId:n.result.nodeId,files:paths});};
const txtFn=`const txt=s=>s.textContent.replace(/\\s+/g,' ').trim();`;
const rcInfo=`const p=document.querySelector('${RC}');if(!p)return null;${txtFn}
const ps=[...p.querySelectorAll('p')].map(txt);const tb=p.querySelector('[aria-label="Monthly reconciliation"] tbody');const rows=tb?[...tb.querySelectorAll('tr')]:[];
const status=rows.map(tr=>txt(tr.lastElementChild));const sc=Object.entries(status.reduce((a,s)=>{a[s]=(a[s]||0)+1;return a;},{}));
return {title:p.querySelector('h2')?txt(p.querySelector('h2')):null,counts:ps.find(x=>/^Months in range:/.test(x))||null,readiness:(ps.find(x=>/included months modelled|No H-10 months|Confirm the H-10/.test(x))||'').replace(${mode==='real'?'/at [0-9.]+ ft/':'/$^/'},'at # ft')||null,
 refused:ps.find(x=>/^Refused:/.test(x))||null,summary:[...p.querySelectorAll('li')].map(txt).filter(x=>/margin \\(smallest\\)|Formation margin/.test(x)).map(x=>x.replace(/-?[0-9][0-9,.]*/g,'#')),
 waiting:ps.filter(x=>/Confirm the|Downloads need/.test(x)),screening:ps.includes('Screening only: not a regulatory approval, compliance finding or safe-operating determination.'),
 srtNote:ps.some(x=>/Step-rate records carry fracture-pressure fields/.test(x)),rows:rows.length,statusCounts:Object.fromEntries(sc),
 negativeFlags:(p.textContent.match(/model below measured static pressure/g)??[]).length,abovePermitFlags:rows.filter(tr=>/reported maximum above permit limit/.test(tr.textContent)).length,
 svg:p.querySelectorAll('svg').length,buttons:[...p.querySelectorAll('button')].map(b=>({t:txt(b),disabled:b.disabled})),calibrated:/calibrated/i.test(p.textContent)};`;
const rcRow=m=>`const p=document.querySelector('${RC}');${txtFn}const tr=[...p.querySelectorAll('[aria-label="Monthly reconciliation"] tbody tr')].find(tr=>txt(tr.children[0])==='${m}');return tr?[...tr.children].map(txt):null;`;
const jSummary=`const p=document.querySelector('${J}');${txtFn}const ps=[...p.querySelectorAll('p')].map(txt);return {counts:ps.find(x=>/^BHP tests:/.test(x))||null,paras:ps.filter(x=>/Confirm|No H-10|No BHP|no test-referenced/i.test(x)),status:p.querySelector('[role=status]')?txt(p.querySelector('[role=status]')):null};`;
const layout=`const d=document.documentElement;return {innerWidth,docScrollW:d.scrollWidth,pageHScroll:d.scrollWidth>innerWidth};`;
const setReasonAndClick=(panel,boxSel,reasonSel,reason)=>ev(`const p=document.querySelector('${panel}');const b=p.querySelector(${JSON.stringify(boxSel)});b.scrollIntoView({block:'center'});${reasonSel?`const r=p.querySelector(${JSON.stringify(reasonSel)});r.value=${JSON.stringify(reason)};r.dispatchEvent(new Event('input',{bubbles:true}));`:''}b.click();await new Promise(r=>setTimeout(r,600));return 1;`);
const confirmSurface=(value,reason)=>ev(`const p=document.querySelector('${WA}');p.querySelector('input[name=surface-basis][value=${value}]').click();const r=p.querySelector('input[aria-label="Reason for the H-10 and permit basis"]');r.value=${JSON.stringify(reason)};r.dispatchEvent(new Event('input',{bubbles:true}));const b=[...p.querySelectorAll('button')].find(b=>/basis/.test(b.textContent));b.click();await new Promise(r=>setTimeout(r,900));return document.querySelector('${WA} [role=status]').textContent;`);
const confirmJ=reason=>ev(`const p=document.querySelector('${J}');p.querySelector('input[name=j-basis][value=psig]').click();const r=p.querySelector('input[aria-label="Reason for the basis"]');r.value=${JSON.stringify(reason)};r.dispatchEvent(new Event('input',{bubbles:true}));r.nextElementSibling.click();await new Promise(r=>setTimeout(r,900));return 1;`);
const setLimit=(psia,depth,reason)=>ev(`const p=document.querySelector('${RC}');const f=(l,v)=>{const i=p.querySelector('input[aria-label="'+l+'"]');i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));};f('Declared bottomhole limit (psia)',${JSON.stringify(String(psia))});f('Depth of the declared limit (ft)',${JSON.stringify(String(depth))});f('Reason for the declared limit',${JSON.stringify(reason)});
 const b=[...p.querySelectorAll('button')].find(b=>/^(Set|Change) limit$/.test(b.textContent));b.click();await new Promise(r=>setTimeout(r,900));const a=document.activeElement;return {status:document.querySelector('${RC} [role=status]').textContent,focusKey:a?.dataset?.focusKey??null,focusInPanel:!!a&&p.contains(a)};`);
async function importPkg(file,confirmWait=90000){
 await nav('data');await sleep(500);
 await setFile('#explorer-package-file',[file]);
 await wait("!document.getElementById('explorer-package-confirm').disabled||/refus|reject|not accepted|invalid|fail|cannot/i.test(document.getElementById('explorer-package-status').textContent)",confirmWait);
 const rs=await ev(`return document.getElementById('explorer-package-status').textContent;`);
 if(await ev(`return document.getElementById('explorer-package-confirm').disabled;`))return {ok:false,receiver:rs};
 await ev(`document.getElementById('explorer-package-confirm').click();return 1;`);await sleep(800);
 return {ok:true,receiver:rs};
}
const fresh=async()=>{await send('Page.navigate',{url:BASE});await wait("document.readyState==='complete'&&document.getElementById('source-public')");await sleep(1500);};
try{
await fresh();
stage='r1';const imp=await importPkg(TAR);rec('r1_import',{ok:imp.ok,receiver:imp.receiver});
await nav('publicTrends');await wait(`document.querySelector('${RC} h2')`,30000);await sleep(800);
// 1. order
rec('r1_order',await ev(`const r=document.getElementById('import-results');const ids=[...r.children].map(c=>c.id).filter(Boolean);return {ids,order:['test-records','well-assumptions','injectivity-estimate','pressure-reconciliation'].map(x=>ids.indexOf(x))};`));
// 2. before the basis
rec('r2_j_before',await ev(jSummary));rec('r2_rc_before',await ev(rcInfo));
if(shotOn){await scrollTo(WA);await shot('c2-before-basis');await scrollTo(RC);await shot('c2-recon-waiting');}
// 3. confirm psig in Well assumptions and psig in J
rec('r3_surface_status',await confirmSurface('psig','RRC H-10 reports gauge pressure (verification)'));
await confirmJ('RRC Permian guidance (verification)');
rec('r3_j',await ev(jSummary));rec('r3_rc',await ev(rcInfo));
if(shotOn){await scrollTo(RC);await shot('c3-recon-counts');await ev(`document.querySelector('${RC} svg')?.scrollIntoView({block:'center'});return 1`);await shot('c3-recon-chart');await ev(`document.querySelector('${RC} [aria-label="Monthly reconciliation"]').scrollIntoView({block:'center'});return 1`);await shot('c3-recon-table');}
rec('r3_layout',await ev(layout));
if(mode==='real'){
 // Review Focus 2: include every month the 1a default review excluded, then record refusal counts by reason (counts only).
 rec('r9_included',await ev(`const p=document.querySelector('${H10}');if(!p)return 0;let n=0;const tried=new Set();
  for(;;){const b=[...document.querySelector('${H10}').querySelectorAll('input[type=checkbox][aria-label^="Include "]')].find(b=>!b.checked&&!tried.has(b.getAttribute('aria-label')));if(!b)break;tried.add(b.getAttribute('aria-label'));const m=b.getAttribute('aria-label').slice(8);const p=document.querySelector('${H10}');const r=p.querySelector('input[aria-label="Reason for '+m+'"]');if(r){r.value='Verification: include to see refusal reasons';r.dispatchEvent(new Event('input',{bubbles:true}));}b.click();n++;await new Promise(r=>setTimeout(r,150));}
  await new Promise(r=>setTimeout(r,1500));return n;`));
 const all=await ev(rcInfo);rec('r9_rc',{counts:all.counts,refused:all.refused,statusCounts:all.statusCounts,abovePermitFlags:all.abovePermitFlags,console:null});
}
if(mode==='synthetic'){
 rec('r3_negative',{counts:(await ev(rcInfo)).counts,checklist:await ev(`return /Shut-in days included in the monthly average pressure\\./.test(document.querySelector('${RC}').textContent)`),flag:await ev(`return [...document.querySelectorAll('${RC} td p')].filter(p=>/model below measured static pressure/.test(p.textContent)).length`)});
 if(shotOn){await ev(`[...document.querySelectorAll('${RC} td p')].find(p=>/model below measured static/.test(p.textContent))?.scrollIntoView({block:'center'});return 1`);await shot('c3-negative-differential');}
 const depth=await ev(`${txtFn}const ps=[...document.querySelectorAll('${RC} p')].map(txt);const m=ps.map(x=>x.match(/modelled at ([0-9.]+) ft/)).find(Boolean);return m?Number(m[1]):null;`);rec('r4_reportDepth',depth);
 // 4. declared limit at the report depth, then 2 ft off
 rec('r4_set',await setLimit(4000,depth,'Synthetic design limit (verification)'));
 rec('r4_at',await ev(rcInfo));rec('r4_row_2024_02',(await ev(rcRow('2024-02')))?.[10]?.replace(/-?[0-9][0-9,.]*/g,'#'));
 rec('r4_off_set',await setLimit(4000,depth+2,'Synthetic design limit, 2 ft off (verification)'));
 rec('r4_row_off',(await ev(rcRow('2024-02')))?.[10]);
 rec('r4_handoff_limit_note','see J hand-off unit tests; declared limit datum 2 ft off is not prefilled');
 if(shotOn){await scrollTo(RC);await shot('c4-limit-datum-off');}
 await setLimit(4000,depth,'Synthetic design limit (verification)');
 // 5. exclude a month in 1a
 await setReasonAndClick(H10,'input[aria-label="Include 2024-09"]','input[aria-label="Reason for 2024-09"]','Synthetic: exclude month for reconciliation check');
 rec('r5_row_2024_09',(await ev(rcRow('2024-09')))?.slice(-1));rec('r5_counts',(await ev(rcInfo)).counts);
 if(shotOn){await ev(`document.querySelector('${RC} [aria-label="Monthly reconciliation"]').scrollIntoView({block:'center'});return 1`);await shot('c5-month-excluded');}
 await setReasonAndClick(H10,'input[aria-label="Include 2024-09"]',null,null);
 rec('r5_restored',(await ev(rcInfo)).counts);
 // 6. switch to psia: values move; an export started before the switch is refused
 stage='c6';
 const before=await ev(rcRow('2024-02'));const jBefore=await ev(jSummary);
 rec('r6_inflight',await ev(`const p=document.querySelector('${RC}');const b=[...p.querySelectorAll('button')].find(b=>/Download reconciliation JSON/.test(b.textContent));b.click();
  const wp=document.querySelector('${WA}');wp.querySelector('input[name=surface-basis][value=psia]').click();const r=wp.querySelector('input[aria-label="Reason for the H-10 and permit basis"]');r.value='Synthetic: read as absolute (verification)';r.dispatchEvent(new Event('input',{bubbles:true}));[...wp.querySelectorAll('button')].find(b=>/basis/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,1500));return {status:document.querySelector('${RC} [role=status]').textContent,downloads:window.__dl.length};`));
 const after=await ev(rcRow('2024-02'));rec('r6_row_moved',{surfaceChanged:before?.[5]!==after?.[5],modelledChanged:before?.[5]!==after?.[5]});rec('r6_j',{before:jBefore.counts,after:(await ev(jSummary)).counts});
 rec('r6_rc',await ev(rcInfo));
 await flush();
 // back to psig for downloads
 await confirmSurface('psig','RRC H-10 reports gauge pressure (verification)');
 // 7. downloads
 stage='c7';
 for(const f of ['JSON','CSV','SVG'])await ev(`const b=[...document.querySelectorAll('${RC} button')].find(b=>/Download reconciliation ${f}/.test(b.textContent));b.scrollIntoView({block:'center'});if(b.disabled)return 0;b.click();await new Promise(r=>setTimeout(r,1500));return 1;`);
 await sleep(500);rec('r7_downloads',await flush());
 if(shotOn)await shot('c7-after-downloads');
}
rec('r8_layout',await ev(layout));
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;}
results.console=events.filter(e=>(e.method==='Runtime.consoleAPICalled'&&['error','assert'].includes(e.params.type))||e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error')).map(e=>e.method==='Runtime.consoleAPICalled'?{type:e.params.type,text:e.params.args.map(a=>a.value??a.description).join(' ').slice(0,300)}:e.method==='Runtime.exceptionThrown'?{exception:JSON.stringify(e.params.exceptionDetails).slice(0,300)}:{log:e.params.entry.text,url:e.params.entry.url});
results.externalRequests='see server log';
console.log('console errors',JSON.stringify(results.console));
writeFileSync(join(here,`results-${tag}.json`),JSON.stringify(results,null,1));
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
