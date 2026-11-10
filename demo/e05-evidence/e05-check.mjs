// Usage: node e05-check.mjs <width> <height> <mobile 0|1> <tag> <downloadDir>
// CDP driver for the E05 "What the case says" panel. Downloads go to <downloadDir> (outside the repo; the sample case holds real TRRC wells).
// Records statuses, counts and rule IDs only; no per-month or reported values. History tables are hidden during screenshots.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const [w='1280',h='900',mobile='0',tag='desktop',dlRoot]=process.argv.slice(2);
if(!dlRoot)throw Error('downloadDir required');
const dlDir=join(dlRoot,tag);mkdirSync(dlDir,{recursive:true});
const t=await (await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const pending=new Map();const consoleErrors=[];const requests=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
 if(m.method==='Runtime.consoleAPICalled'&&['error','assert'].includes(m.params.type))consoleErrors.push('console.'+m.params.type+': '+m.params.args.map(a=>a.value??a.description).join(' ').slice(0,300));
 if(m.method==='Runtime.exceptionThrown')consoleErrors.push('exception: '+(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text).slice(0,300));
 if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')consoleErrors.push('log: '+m.params.entry.text.slice(0,300)+' '+(m.params.entry.url??''));
 if(m.method==='Network.responseReceived')requests.push({url:m.params.response.url,status:m.params.response.status});
};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send('Emulation.setDeviceMetricsOverride',{width:+w,height:+h,deviceScaleFactor:1,mobile:mobile==='1'});
await send('Emulation.setFocusEmulationEnabled',{enabled:true});
for(const d of ['Page','Runtime','Log','Network'])await send(d+'.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`
window.__dl=[];const _c=URL.createObjectURL.bind(URL),map=new Map();
URL.createObjectURL=b=>{const u=_c(b);map.set(u,b);return u;};
const _click=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download){const b=map.get(this.href);window.__dl.push({name:this.download,type:b&&b.type,p:b?b.text():Promise.resolve(null)});return;}return _click.call(this);};
`});
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${expr}})()`,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,800));return r.result?.result?.value;};
const wait=async(expr,ms=60000)=>{const s=Date.now();while(Date.now()-s<ms){try{if(await ev('return '+expr))return true;}catch{}await sleep(200);}throw Error('TIMEOUT '+expr);};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(here,`${tag}-${name}.png`),Buffer.from(r.result.data,'base64'));};
const privShot=async name=>{await ev(`for(const d of document.querySelectorAll('#case-insights .table-scroll'))if(/history vs forecast/.test(d.getAttribute('aria-label')))d.style.display='none';return 1`);await sleep(150);await shot(name);await ev(`for(const d of document.querySelectorAll('#case-insights .table-scroll'))d.style.display='';return 1`);};
const results={chrome:(await (await fetch('http://127.0.0.1:9333/json/version')).json()).Browser,viewport:[+w,+h,mobile]};const rec=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v));};
const nav=view=>ev(`const n=await import('/navigation.mjs');history.pushState(null,'',n.routeFor('${view}'));dispatchEvent(new PopStateEvent('popstate'));await new Promise(r=>setTimeout(r,800));return 1;`);
const flush=async()=>{const out=await ev(`const o=[];for(const d of window.__dl){o.push({name:d.name,type:d.type,text:await d.p});}window.__dl=[];return o;`);for(const d of out)if(d.text!=null)writeFileSync(join(dlDir,d.name),d.text);return out.map(d=>({name:d.name,type:d.type,chars:d.text?.length}));};
const type=async(sel,text)=>{await ev(`const i=document.querySelector(${JSON.stringify(sel)});i.scrollIntoView({block:'center'});i.focus();i.select?.();return 1`);await send('Input.insertText',{text});await sleep(200);};
const ready=`document.querySelector('#case-insights [role=status]')&&/summary lines from the calculated case/.test(document.querySelector('#case-insights [role=status]').textContent)&&!document.getElementById('case-insights').hidden`;
const calcCase=async()=>{await wait("!document.getElementById('disposal-calculate').disabled");await ev(`document.getElementById('disposal-calculate').click();return 1`);await wait(ready,90000);await sleep(400);};
const panel=`const ci=document.getElementById('case-insights');const sec=ci.querySelectorAll(':scope > section');const sum=ci.querySelector(':scope > div');
 const lines=[...sum.querySelectorAll(':scope > details')].map(d=>({rule:(/Rule (A[0-9])/.exec(d.querySelector('p.small')?.textContent)||[])[1],text:d.querySelector('summary').textContent}));
 const boxes=[...ci.querySelectorAll('h5')].map(h=>{const b=h.parentElement;return {status:h.textContent.split(' — ').at(-1),well:h.textContent.split(' · ')[0].split(' — ')[0],pressureNote:[...b.querySelectorAll(':scope>p')].find(p=>/^Pressure:/.test(p.textContent))?.textContent.replace(/[0-9][0-9,.]*/g,'#'),confirmed:b.querySelector('form p.small')?.textContent??null,tables:b.querySelectorAll('table').length,forms:b.querySelectorAll('form').length,svgs:b.querySelectorAll('svg').length,reason:[...b.querySelectorAll(':scope>p')][0]?.textContent}});
 return {hidden:ci.hidden,visible:!!ci.offsetParent&&ci.getBoundingClientRect().height>0,status:ci.querySelector('[role=status]').textContent,lines,boxes,
  downloads:[...ci.querySelectorAll('.import-actions button')].map(b=>[b.textContent,b.disabled])};`;
const redact=s=>s.replace(/[0-9][0-9,.\-−]*/g,'#');
const redactLines=lines=>lines.map(l=>({rule:l.rule,phrase:l.rule==='A6'?(/within reported history|not shown in reported history|cannot be checked|no injection reported/i.exec(l.text)||['?'])[0]+(/Pressure not checked/.test(l.text)?' | pressure not checked':''):l.rule==='A8'?l.text:redact(l.text)}));
try{
await send('Page.navigate',{url:'http://127.0.0.1:4174/'});
await wait("document.readyState==='complete'&&document.getElementById('sample-load')");await sleep(1200);
// ---- 1. sample case ----
await ev(`document.getElementById('sample-load').click();return 1`);
await wait("/all 7 loading steps done/.test(document.getElementById('sample-banner-detail').textContent)",240000);
await nav('scenarios');await calcCase();
const p1=await ev(panel);
const order=await ev(`const ids=['disposal-results','case-insights','disposal-sensitivity'];const all=[...document.getElementById('disposal-workspace').querySelectorAll('*')];return {domIndex:ids.map(i=>all.indexOf(document.getElementById(i))),sensitivityHiddenInScenarios:document.getElementById('disposal-sensitivity').hidden,top:ids.map(i=>Math.round(document.getElementById(i).getBoundingClientRect().top+scrollY))}`);
const CLOSING='Screening estimate from assumed inputs; not proven field capacity.';
rec('s1',{order,status:p1.status,rules:p1.lines.map(l=>l.rule),lines:redactLines(p1.lines),closingExact:p1.lines.at(-1)?.text===CLOSING,history:p1.boxes.map(b=>({well:b.well,status:b.status,tables:b.tables,forms:b.forms,svgs:b.svgs,noHistory:/no H-10 history loaded/.test(b.reason)})),downloads:p1.downloads});
await ev(`document.getElementById('case-insights').scrollIntoView({block:'start'});return 1`);await sleep(300);await privShot('s1-summary');
await ev(`document.querySelector('#case-insights h5').scrollIntoView({block:'start'});return 1`);await sleep(300);await privShot('s1-history');
// ---- 2. confirm basis (real mouse click on Confirm) ----
const firstWell=p1.boxes[0]?.well;
await ev(`const f=document.querySelector('#case-insights h5').parentElement.querySelector('form');const s=f.querySelector('select');s.value='psig';s.dispatchEvent(new Event('change',{bubbles:true}));return 1`);
await type('#case-insights h5 ~ form input','QA');
const bpos=await ev(`const b=document.querySelector('#case-insights h5').parentElement.querySelector('form button');b.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,200));const r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]`);
for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:bpos[0],y:bpos[1],button:'left',clickCount:1});
await sleep(600);
const p2=await ev(panel);
const focus=await ev(`const a=document.activeElement;const box=a?.closest('form')?.parentElement;return {tag:a?.tagName,text:a?.textContent,wellBox:box?.querySelector('h5')?.textContent.split(' · ')[0],connected:a?.isConnected}`);
rec('s2',{well:firstWell,before:p1.boxes[0]?.pressureNote,after:p2.boxes[0]?.pressureNote,confirmed:p2.boxes[0]?.confirmed,otherWellConfirmed:p2.boxes[1]?.confirmed,focus,a6:redactLines(p2.lines.filter(l=>l.rule==='A6')),alerts:await ev(`return [...document.querySelectorAll('#case-insights h5 ~ form [role=alert]')].map(e=>e.textContent)`)});
await ev(`document.querySelector('#case-insights h5').scrollIntoView({block:'start'});return 1`);await sleep(300);await privShot('s2-basis-confirmed');
// ---- 3. performance cases ----
const neutral=await ev(`return [...document.querySelectorAll('#case-insights input[data-case]')].map(i=>[i.dataset.case+'.'+i.dataset.factor,i.value])`);
await type('#case-insights input[data-case=pessimistic][data-factor=injectivityMultiplier]','0.7');
await type('#case-insights input[data-case=pessimistic][data-factor=reservoirOffsetPsi]','300');
await type('#case-insights input[data-case=pessimistic][data-factor=availabilityMultiplier]','0.9');
await ev(`[...document.querySelectorAll('#case-insights button')].find(b=>/well-performance/.test(b.textContent)).click();return 1`);
await wait(`document.querySelector('#case-insights [role=status]').textContent.includes('with well-performance cases')`,90000);await sleep(400);
const p3=await ev(panel);
const perfInfo=await ev(`const sec=document.querySelectorAll('#case-insights > section')[1];const tbls=[...sec.querySelectorAll('table')];return {tables:tbls.map(t=>({caption:t.querySelector('caption').textContent,headers:[...t.querySelectorAll('th')].map(x=>x.textContent),rows:t.tBodies[0].rows.length,firstCols:[...t.tBodies[0].rows].map(r=>r.cells[0].textContent+(r.cells[1]&&!/^[0-9]/.test(r.cells[1].textContent)?' / '+r.cells[1].textContent:''))})),notes:[...sec.querySelectorAll(':scope > ul li')].map(l=>l.textContent),error:sec.querySelector('[role=alert]').textContent}`);
rec('s3',{neutral,status:p3.status,perfInfo,a7:p3.lines.filter(l=>l.rule==='A7').map(l=>redact(l.text)),rules:p3.lines.map(l=>l.rule)});
await ev(`document.querySelectorAll('#case-insights > section')[1].querySelector('h4').scrollIntoView({block:'start'});return 1`);await sleep(300);await privShot('s3-performance');
await ev(`document.querySelectorAll('#case-insights > section')[1].querySelectorAll('table')[1]?.scrollIntoView({block:'center'});return 1`);await sleep(300);await privShot('s3-performance-tables');
// ---- 5. downloads (with performance cases) ----
for(const f of ['JSON','CSV']){await ev(`[...document.querySelectorAll('#case-insights .import-actions button')].find(b=>b.textContent.includes('${f}')).click();return 1`);await wait(`window.__dl.length>0`,60000);await sleep(300);rec('s5_'+f,await flush());}
rec('s5_statusAfter',await ev(`return document.querySelector('#case-insights [role=status]').textContent`));
// edit one factor -> cleared
await type('#case-insights input[data-case=optimistic][data-factor=injectivityMultiplier]','1.2');
await sleep(400);
const p3b=await ev(panel);
rec('s3_afterEdit',{status:p3b.status,perfTables:await ev(`return document.querySelectorAll('#case-insights > section')[1].querySelectorAll('table').length`),a7:p3b.lines.filter(l=>l.rule==='A7').length,rules:p3b.lines.map(l=>l.rule),downloads:p3b.downloads});
await privShot('s3-after-edit');
// ---- 4. edit a disposal case input ----
await ev(`document.getElementById('disposal-input-details').open=true;return 1`);
const dBefore=await ev(`return ['disposal-json','disposal-csv','disposal-svg'].map(i=>[i,document.getElementById(i).disabled])`);
await type('#disposal-pressure','3001');
await sleep(500);
const p4=await ev(panel);
rec('s4',{disposalDownloadsBefore:dBefore,panelHidden:p4.hidden,panelVisible:p4.visible,insightsDownloads:p4.downloads,disposalDownloadsAfter:await ev(`return ['disposal-json','disposal-csv','disposal-svg'].map(i=>[i,document.getElementById(i).disabled])`),summaryLines:p4.lines.length,historyBoxes:p4.boxes.length,disposalStatus:await ev(`return document.getElementById('disposal-status').textContent`)});
await ev(`document.getElementById('disposal-status').scrollIntoView({block:'center'});return 1`);await shot('s4-invalidated');
await type('#disposal-pressure','3000');await calcCase();
// ---- 6. sensitivity view ----
await nav('sensitivity');await sleep(800);
rec('s6',await ev(`const ci=document.getElementById('case-insights');const r=ci.getBoundingClientRect();return {view:location.hash,hidden:ci.hidden,display:getComputedStyle(ci).display,offsetParent:!!ci.offsetParent,height:Math.round(r.height),disposalWorkspaceHidden:document.getElementById('disposal-workspace').hidden}`));
await ev(`document.getElementById('disposal-sensitivity').scrollIntoView({block:'start'});return 1`);await sleep(300);await privShot('s6-sensitivity');
await nav('scenarios');await sleep(600);
rec('s6_backToScenarios',await ev(`const ci=document.getElementById('case-insights');return {hidden:ci.hidden,visible:!!ci.offsetParent}`));
// ---- 9. layout (sample case, scenarios view) ----
await ev(`document.querySelector('#case-insights h5').scrollIntoView({block:'start'});return 1`);
rec('s9',await ev(`const d=document.documentElement;const plots=[...document.querySelectorAll('#case-insights .pvt-plot')].map(c=>{const s=c.querySelector('svg');return {containerW:c.clientWidth,scrollW:c.scrollWidth,overflowX:getComputedStyle(c).overflowX,svgW:Math.round(s.getBoundingClientRect().width),svgAttrW:s.getAttribute('width'),containerRight:Math.round(c.getBoundingClientRect().right)}});const ts=[...document.querySelectorAll('#case-insights .table-scroll')].map(e=>({scrollW:e.scrollWidth,clientW:e.clientWidth,overflowX:getComputedStyle(e).overflowX}));const over=[...document.querySelectorAll('#case-insights *')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>d.clientWidth+1&&!e.closest('.table-scroll,.pvt-plot')).slice(0,8).map(e=>e.tagName+'.'+String(e.className).slice(0,30));return {innerWidth,docScrollW:d.scrollWidth,docClientW:d.clientWidth,pageHScroll:d.scrollWidth>d.clientWidth,plots,tableScrolls:ts,panelOverflowers:over}`));
await ev(`document.querySelector('#case-insights .pvt-plot').scrollIntoView({block:'center'});return 1`);await sleep(200);await privShot('s9-timeline');
// ---- 7. demo case ----
await ev(`document.getElementById('source-demo').click();return 1`);await sleep(1500);
await nav('scenarios');await sleep(1000);
await calcCase();
const p7=await ev(panel);
rec('s7',{status:p7.status,rules:p7.lines.map(l=>l.rule),a6:p7.lines.filter(l=>l.rule==='A6').map(l=>l.text),history:p7.boxes.map(b=>({well:b.well,status:b.status,reason:b.reason,tables:b.tables,forms:b.forms,svgs:b.svgs})),allNoHistory:p7.boxes.length>0&&p7.boxes.every(b=>b.reason==='Cannot be checked: no H-10 history loaded for this well.')});
await ev(`document.querySelector('#case-insights h5').scrollIntoView({block:'start'});return 1`);await sleep(300);await shot('s7-demo-history');
// ---- 8. console + worker ----
const res=await ev(`return performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/performance-worker|caseInsights|performanceCases/.test(n))`);
rec('s8',{consoleErrors,workerResponses:requests.filter(r=>/performance-worker\.mjs/.test(r.url)),resourceTiming:res});
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;results.consoleErrors=consoleErrors;}
writeFileSync(join(here,`results-${tag}.json`),JSON.stringify(results,null,1));
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
