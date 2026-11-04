// Usage: node j-check.mjs <width> <height> <mobile 0|1> <tag> <mode: synthetic|barbaro|trippet> <main.tar> [gap.tar]
// Self-contained CDP driver for the Phase 1c test-referenced J panel (modelled on demo/test-records-evidence/tr-check.mjs).
// Packages live only in the session scratchpad. Server: PORT=4290 node scripts/serve.mjs; Chrome --remote-debugging-port=9333.
import {writeFileSync,mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const [w='1280',h='900',mobile='0',tag='desktop',mode='synthetic',TAR,GAP]=process.argv.slice(2);
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
const shotOn=mode==='synthetic'||mode==='trippet';
const shot=async name=>{if(!shotOn)return;const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(here,`${tag}-${name}.png`),Buffer.from(r.result.data,'base64'));};
const results={};const rec=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v).slice(0,500));};
const sha=s=>createHash('sha256').update(Buffer.from(s,'utf8')).digest('hex');
let stage='';
const flush=async()=>{const out=await ev(`const o=[];for(const d of window.__dl){o.push({name:d.name,type:d.type,text:await d.p});}window.__dl=[];return o;`);const res=[];for(const d of out){if(mode==='synthetic'&&d.text!=null)writeFileSync(join(here,'downloads',tag,`${stage}__${d.name}`),d.text);res.push({name:d.name,type:d.type,chars:d.text?.length,sha256:d.text!=null?sha(d.text):null});}return res;};
const nav=view=>ev(`const n=await import('/navigation.mjs');history.pushState(null,'',n.routeFor('${view}'));dispatchEvent(new PopStateEvent('popstate'));return 1;`);
const J='#injectivity-estimate',TR='#test-records',H10='#h10-diagnostics';
const scrollTo=(sel,block='start')=>ev(`document.querySelector('${sel}').scrollIntoView({block:'${block}'});await new Promise(r=>setTimeout(r,300));return true;`);
const setFile=async(selector,paths)=>{const doc=await send('DOM.getDocument',{depth:0});const n=await send('DOM.querySelector',{nodeId:doc.result.root.nodeId,selector});if(!n.result.nodeId)throw Error('no node '+selector);await send('DOM.setFileInputFiles',{nodeId:n.result.nodeId,files:paths});};
const jInfo=`const p=document.querySelector('${J}');if(!p)return null;const txt=s=>s.textContent.replace(/\\s+/g,' ').trim();
const tables=[...p.querySelectorAll('[role=region] table')].map(tb=>({label:tb.parentElement.getAttribute('aria-label'),heads:[...tb.querySelectorAll('thead th')].map(txt),rows:[...tb.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(txt))}));
const st=p.querySelector('[role=status]');const sv=p.querySelector('svg');
return {title:p.querySelector('h2')?txt(p.querySelector('h2')):null,status:st?txt(st):null,statusFirst:!!st&&st===p.querySelector('section').children[1],paras:[...p.querySelectorAll('p')].map(txt),tables,svgCount:p.querySelectorAll('svg').length,chartPoints:sv?sv.querySelectorAll('circle').length:0,chartText:sv?[...sv.querySelectorAll('text')].map(txt):[],buttons:[...p.querySelectorAll('button')].map(b=>({t:txt(b),disabled:b.disabled})),radios:[...p.querySelectorAll('input[name=j-basis]')].map(r=>({v:r.value,checked:r.checked})),calibrated:/calibrated/i.test(p.textContent)};`;
const countsOnly=`const p=document.querySelector('${J}');const txt=s=>s.textContent.replace(/\\s+/g,' ').trim();const ps=[...p.querySelectorAll('p')].map(txt);const tb=p.querySelector('[aria-label="BHP test matches"] tbody');const st=p.querySelector('[role=status]');
return {counts:ps.find(x=>/^BHP tests:/.test(x)),status:st?txt(st):null,statusCol:tb?[...tb.querySelectorAll('tr')].map(tr=>txt(tr.children[16])):[],roundTrip:ps.find(x=>/^Round trip/.test(x))||null,rtRows:[...p.querySelectorAll('[aria-label="Round trip"] tbody tr')].length,chartPoints:p.querySelector('svg')?p.querySelector('svg').querySelectorAll('circle').length:0,paras:ps.filter(x=>/no longer|Chosen|Confirm|No H-10|No BHP|blocked/i.test(x))};`;
const layout=`const d=document.documentElement;const sc=[...document.querySelectorAll('${J} .table-scroll,${J} .analysis-chart-scroll')].map(e=>({cls:e.className,label:e.getAttribute('aria-label'),scrollW:e.scrollWidth,clientW:e.clientWidth}));return {innerWidth,docScrollW:d.scrollWidth,docClientW:d.clientWidth,bodyScrollW:document.body.scrollWidth,pageHScroll:d.scrollWidth>innerWidth,containers:sc};`;
const chartClip=`const sv=document.querySelector('${J} svg');if(!sv)return null;const vb=sv.viewBox.baseVal;const box=sv.parentElement;const texts=[...sv.querySelectorAll('text')];const info=texts.map(x=>{const b=x.getBBox();return {t:x.textContent.slice(0,90),left:Math.round(b.x),right:Math.round(b.x+b.width),y:Math.round(b.y)};});const over=info.filter(x=>x.right>vb.width||x.left<0);
return {vbW:vb.width,vbH:vb.height,svgClientW:sv.getBoundingClientRect().width,containerClientW:box.clientWidth,containerScrollW:box.scrollWidth,textCount:texts.length,clippedTexts:over,topTexts:info.filter(x=>x.y<60).slice(0,6)};`;
const setReasonAndClick=(panel,boxSel,reasonSel,reason)=>ev(`const p=document.querySelector('${panel}');const b=p.querySelector(${JSON.stringify(boxSel)});b.scrollIntoView({block:'center'});${reasonSel?`const r=p.querySelector(${JSON.stringify(reasonSel)});r.value=${JSON.stringify(reason)};r.dispatchEvent(new Event('input',{bubbles:true}));`:''}b.click();await new Promise(r=>setTimeout(r,500));return 1;`);
async function importPkg(file,confirmWait=90000){
 await nav('data');await sleep(500);
 await setFile('#explorer-package-file',[file]);
 await wait("!document.getElementById('explorer-package-confirm').disabled||/refus|reject|not accepted|invalid|fail|cannot/i.test(document.getElementById('explorer-package-status').textContent)",confirmWait);
 const rs=await ev(`return document.getElementById('explorer-package-status').textContent;`);
 const disabled=await ev(`return document.getElementById('explorer-package-confirm').disabled;`);
 if(disabled)return {ok:false,receiver:rs};
 await ev(`document.getElementById('explorer-package-preview').scrollIntoView({block:'start'});return 1`);
 await ev(`document.getElementById('explorer-package-confirm').click();return 1;`);await sleep(800);
 return {ok:true,receiver:rs,adopt:await ev(`return {import:document.getElementById('import-status').textContent,active:document.getElementById('active-dataset').textContent};`)};
}
const open=async()=>{await nav('publicTrends');await wait(`document.querySelector('${J} h2')`,30000);await sleep(800);};
const fresh=async()=>{await send('Page.navigate',{url:BASE});await wait("document.readyState==='complete'&&document.getElementById('source-public')");await sleep(1500);};
try{
await fresh();
if(mode==='synthetic'){
 // c1
 stage='c1';const imp=await importPkg(TAR);rec('c1_import',imp);await shot('c1-package-preview');
 await open();
 rec('c1_order',await ev(`const r=document.getElementById('import-results');const kids=[...r.children].map(c=>c.id||c.className||c.tagName);return {kids,jBelowTests:kids.indexOf('injectivity-estimate')===kids.indexOf('test-records')+1,jLast:kids.indexOf('injectivity-estimate')===kids.length-1};`));
 rec('c1_panel',await ev(jInfo));
 await scrollTo(J);await shot('c1-j-panel-initial');
 // c2 confirm psig
 await ev(`const p=document.querySelector('${J}');p.querySelector('input[name=j-basis][value=psig]').click();const reason=p.querySelector('input[aria-label="Reason for the basis"]');reason.value='RRC Permian guidance: BHP reported in psig (verification)';reason.dispatchEvent(new Event('input',{bubbles:true}));const next=reason.nextElementSibling;window.__confirmIsNext=!!next&&next.tagName==='BUTTON'&&/basis/.test(next.textContent);next.click();await new Promise(r=>setTimeout(r,700));return 1;`);
 rec('c2_confirmButtonFollowsReason',await ev(`return window.__confirmIsNext`));
 rec('c2_panel',await ev(jInfo));rec('c2_summary',await ev(countsOnly));
 await scrollTo(J);await shot('c2-j-values');
 await ev(`document.querySelector('${J} svg').scrollIntoView({block:'center'});return 1`);await shot('c2-j-chart');
 rec('c2_chartClip',await ev(chartClip));rec('c2_layout',await ev(layout));
 await ev(`document.querySelector('${J} [aria-label="Round trip"]').scrollIntoView({block:'center'});return 1`);await shot('c2-round-trip');
 // c3 exclude matched month 2024-07 in 1a
 await setReasonAndClick(H10,'input[aria-label="Include 2024-07"]','input[aria-label="Reason for 2024-07"]','Synthetic: exclude month for J recompute check');
 rec('c3_summary',await ev(countsOnly));
 const c3=await ev(jInfo);rec('c3_match_rows',c3.tables.find(x=>x.label==='BHP test matches').rows.map(r=>[r[0],r[2],r[16]]));
 await scrollTo(`${J} [aria-label="BHP test matches"]`);await shot('c3-j-month-excluded');
 await setReasonAndClick(H10,'input[aria-label="Include 2024-07"]',null,null);
 rec('c3_restored',await ev(countsOnly));
 // c4 choose earlier then exclude it in 1b
 await setReasonAndClick(J,'input[aria-label="Use the J from 2024-02-12"]','input[aria-label="Reason to use the J from 2024-02-12"]','Synthetic: prefer the earlier test');
 rec('c4_chosen',await ev(countsOnly));
 await scrollTo(J);await shot('c4-j-earlier-chosen');
 await setReasonAndClick(TR,'input[aria-label="Include BHP 2024-02-12"]','input[aria-label="Reason for BHP 2024-02-12"]','Synthetic: exclude the chosen test in 1b');
 rec('c4_after1bExclude',await ev(countsOnly));
 await scrollTo(J);await shot('c4-j-choice-dropped');
 await setReasonAndClick(TR,'input[aria-label="Include BHP 2024-02-12"]',null,null);
 rec('c4_restored',await ev(countsOnly));
 // c5 downloads
 stage='c5';
 for(const f of ['JSON','CSV','SVG'])await ev(`const b=[...document.querySelectorAll('${J} button')].find(b=>/Download J estimate ${f}/.test(b.textContent));b.scrollIntoView({block:'center'});if(b.disabled)return 0;b.click();await new Promise(r=>setTimeout(r,1200));return 1;`);
 await sleep(500);rec('c5_downloads',await flush());rec('c5_status',(await ev(countsOnly)).status);
 await shot('c5-after-downloads');
 rec('c5_layout',await ev(layout));
 // c6 hand-off
 await ev(`const b=[...document.querySelectorAll('${J} button')].find(b=>/Use in scenario/.test(b.textContent));b.scrollIntoView({block:'center'});b.click();await new Promise(r=>setTimeout(r,1200));return 1;`);
 await sleep(800);
 rec('c6_after_handoff',await ev(`const ws=document.getElementById('hydraulics-workspace');const o=document.getElementById('hyd-origins');const f=document.getElementById('hyd-form');const vals={};for(const e of f.elements)if(e.name)vals[e.name]=e.value;const r=ws.getBoundingClientRect();return {hash:location.hash,wsVisible:r.width>0&&r.height>0,originsText:o?o.textContent.replace(/\\s+/g,' ').trim():null,originsItems:o?[...o.querySelectorAll('li')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()):null,values:vals,limitEmpty:vals.limitPsia==='',status:document.getElementById('hyd-status').textContent};`));
 await ev(`document.getElementById('hydraulics-workspace').scrollIntoView({block:'start'});return 1`);await shot('c6-hydraulics-prefilled');
 await ev(`document.getElementById('hyd-origins').scrollIntoView({block:'start'});return 1`);await shot('c6-hydraulics-origins');
 await ev(`document.getElementById('hyd-calculate').click();await new Promise(r=>setTimeout(r,800));return 1`);
 rec('c6_calc_blocked',await ev(`return {error:document.getElementById('hyd-error').textContent,status:document.getElementById('hyd-status').textContent,exportsDisabled:[...document.querySelectorAll('[data-hyd-export]')].every(b=>b.disabled)};`));
 await shot('c6-calc-blocked');
 await ev(`const i=document.querySelector('#hyd-form [name=limitPsia]');i.value='4000';i.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('hyd-calculate').click();await new Promise(r=>setTimeout(r,2500));return 1`);
 rec('c6_calc_after_declare',await ev(`return {error:document.getElementById('hyd-error').textContent,status:document.getElementById('hyd-status').textContent,exportsDisabled:[...document.querySelectorAll('[data-hyd-export]')].map(b=>b.disabled)};`));
 await shot('c6-calc-4000');
 stage='c6';
 await ev(`document.querySelector('[data-hyd-export=json]').click();await new Promise(r=>setTimeout(r,1000));return 1`);await sleep(500);
 rec('c6_hyd_export',await flush());
 try{const f=readdirSync(join(here,'downloads',tag)).find(n=>n.startsWith('c6__'));const j=JSON.parse(readFileSync(join(here,'downloads',tag,f),'utf8'));rec('c6_inputOrigins',{present:j.provenance&&j.provenance.inputOrigins!==undefined,keys:j.provenance?.inputOrigins?Object.keys(j.provenance.inputOrigins):null,limitPsia:j.provenance?.inputOrigins?.limitPsia});}catch(e){rec('c6_inputOrigins',{error:e.message});}
 await ev(`const i=document.querySelector('#hyd-form [name=injectivityStbdPerPsi]');i.value=String(Number(i.value)+1);i.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,500));return 1`);
 rec('c6_edit_J',await ev(`const o=document.getElementById('hyd-origins');return {items:[...o.querySelectorAll('li')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()),userOverride:/User override/.test(o.textContent)};`));
 await ev(`document.getElementById('hyd-origins').scrollIntoView({block:'start'});return 1`);await shot('c6-user-override');
 rec('c6_layout_hyd',await ev(layout));
 // c7 panel gap
 stage='c7';
 await fresh();
 const gimp=await importPkg(GAP);rec('c7_gap_import',gimp);
 if(gimp.ok){
  await nav('publicTrends');await wait(`document.querySelector('${TR} h2')`,30000);await sleep(1200);
  rec('c7_gap_panels',await ev(`return {tr:!!document.querySelector('${TR} h2'),j:!!document.querySelector('${J} h2'),jText:document.querySelector('${J}')?document.querySelector('${J}').textContent.replace(/\\s+/g,' ').trim().slice(0,400):null,h10:!!document.querySelector('${H10}'),topLevelMsgs:[...document.querySelectorAll('#import-results > p')].map(p=>p.textContent)};`));
  await scrollTo(J);await shot('c7-panel-gap');
  rec('c7_layout',await ev(layout));
 }
 else{
  // Receiver refused the gap package: mimic import-ui.mountH10 with no H-10 months (range:null, h10:null) through a page script.
  const {unpack}=await import('file:///C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics/tmp/lovable-transfer/well-injection-insights/swd-injection-analytics/tests/helpers/explorer-v4.mjs');
  const files=unpack(readFileSync(TAR));const tj=JSON.parse(files.get('tests.json')),inv=JSON.parse(files.get('normalized.json')).inventory;
  await fresh();await nav('publicTrends');await sleep(800);
  rec('c7_fallback_script',await ev(`const tr=await import('/test-records.mjs'),inj=await import('/injectivity.mjs'),hd=await import('/h10-diagnostics.mjs');
   const selection={artifact:{artifactId:'synthetic-gap',inventory:${JSON.stringify(inv)},injectionMonthly:[]},pin:{},tests:{bhp:${JSON.stringify(tj.bhp)},srt:${JSON.stringify(tj.srt)},sha256:{}}};
   const res=document.getElementById('import-results');res.replaceChildren();const gate={ready:true,reasons:[]};const download=()=>{};
   const p=document.createElement('p');p.textContent='No H-10 monthly rows for this well; H-10 diagnostics and timeline markers are not available.';res.append(p);
   const a=document.createElement('div');a.id='test-records';res.append(a);const tp=tr.mountTestRecords(a,{selection,gate,download,range:null,onMarkers(){},onChange(){}});
   const b=document.createElement('div');b.id='injectivity-estimate';res.append(b);const jp=inj.mountInjectivity(b,{selection,gate,download,h10:null,tests:tp.state,onHandoff(){}});
   await new Promise(r=>setTimeout(r,800));
   const txt=s=>s.textContent.replace(/\\s+/g,' ').trim();
   return {h10Available:hd.h10Available(selection),trTitle:!!a.querySelector('h2'),jTitle:!!b.querySelector('h2'),jParas:[...b.querySelectorAll('p')].map(txt).slice(0,5),hasNoMonthsText:/No H-10 months to match\\./.test(b.textContent),trNoRangeLabels:[...a.querySelectorAll('small')].filter(s=>txt(s)==='No H-10 range; no timeline markers').length,matchRows:[...b.querySelectorAll('[aria-label="BHP test matches"] tbody tr')].map(tr=>txt(tr.children[16]))};`));
  await scrollTo(J);await shot('c7-panel-gap-script');
 }
 // c8 layout summary (page-level horizontal scroll) on the import view after all steps
 rec('c8_layout',await ev(layout));
}else{
 stage='real';const imp=await importPkg(TAR);rec('r_import',{ok:imp.ok,receiver:imp.receiver,adopt:imp.adopt});
 if(imp.ok){await open();
  const base=await ev(`const p=document.querySelector('${J}');const txt=s=>s.textContent.replace(/\\s+/g,' ').trim();const ps=[...p.querySelectorAll('p')].map(txt);return {counts:ps.find(x=>/^BHP tests:/.test(x))||null,paras:ps.filter(x=>/No BHP|no test-referenced|Confirm|No H-10/.test(x)),status:p.querySelector('[role=status]')?txt(p.querySelector('[role=status]')):null,hasTable:!!p.querySelector('[aria-label="BHP test matches"]'),h10:!!document.querySelector('${H10}')};`);
  rec('r_initial',base);
  if(mode==='trippet'){await scrollTo(J);await shot('r-trippet-no-bhp');rec('r_trippet_text',await ev(`return document.querySelector('${J}').textContent.replace(/\\s+/g,' ').trim().slice(0,500);`));}
  else if(base.hasTable){
   await ev(`const p=document.querySelector('${J}');p.querySelector('input[name=j-basis][value=psig]').click();const r=p.querySelector('input[aria-label="Reason for the basis"]');r.value='RRC Permian guidance (verification)';r.dispatchEvent(new Event('input',{bubbles:true}));r.nextElementSibling.click();await new Promise(r=>setTimeout(r,1500));return 1;`);
   rec('r_after_basis',await ev(`const p=document.querySelector('${J}');const txt=s=>s.textContent.replace(/\\s+/g,' ').trim();const ps=[...p.querySelectorAll('p')].map(txt);const rows=[...p.querySelectorAll('[aria-label="BHP test matches"] tbody tr')].map(tr=>txt(tr.children[16]));const st=rows.map(s=>s.split(':')[0]);const reasons=Object.entries(rows.reduce((a,s)=>{a[s]=(a[s]||0)+1;return a;},{}));return {counts:ps.find(x=>/^BHP tests:/.test(x)),statusCounts:Object.fromEntries([...new Set(st)].map(k=>[k,st.filter(x=>x===k).length])),unmatchedReasons:reasons,roundTrip:ps.find(x=>/^Round trip/.test(x))||null,roundTripRows:p.querySelectorAll('[aria-label="Round trip"] tbody tr').length,buttons:[...p.querySelectorAll('button')].map(b=>({t:txt(b),disabled:b.disabled}))};`));
   rec('r_handoff',await ev(`const b=[...document.querySelectorAll('${J} button')].find(b=>/Use in scenario/.test(b.textContent));if(!b||b.disabled)return {clicked:false,disabled:b?b.disabled:null};b.click();await new Promise(r=>setTimeout(r,1500));const f=document.getElementById('hyd-form');const o=document.getElementById('hyd-origins');return {clicked:true,hash:location.hash,originsPresent:!!o,limitEmpty:f.elements.namedItem('limitPsia').value==='',statusMentionsPrefill:/Prefilled/.test(document.getElementById('hyd-status').textContent)};`));
  }
 }
}
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;}
results.console=events.filter(e=>(e.method==='Runtime.consoleAPICalled'&&['error','assert'].includes(e.params.type))||e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error')).map(e=>e.method==='Runtime.consoleAPICalled'?{type:e.params.type,text:e.params.args.map(a=>a.value??a.description).join(' ').slice(0,300)}:e.method==='Runtime.exceptionThrown'?{exception:JSON.stringify(e.params.exceptionDetails).slice(0,300)}:{log:e.params.entry.text,url:e.params.entry.url});
results.warnings=events.filter(e=>(e.method==='Runtime.consoleAPICalled'&&e.params.type==='warning')||(e.method==='Log.entryAdded'&&e.params.entry.level==='warning')).length;
console.log('console errors',JSON.stringify(results.console));
if(mode==='synthetic'||mode==='trippet')writeFileSync(join(here,`results-${tag}.json`),JSON.stringify(results,null,1));
else writeFileSync(join(here,`results-${tag}.json`),JSON.stringify(results,null,1));
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
