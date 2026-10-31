// Usage: node tr-check.mjs <width> <height> <mobile 0|1> <tag> <package.tar> <valid.csv> <wrong-uic.csv>
// Self-contained CDP driver for the Phase 1b test-records panel (modelled on demo/h10-diagnostics-evidence/h10-check.mjs).
// The package and the CSVs live only in the session scratchpad; the page imports them through its own file inputs.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const [w='1280',h='900',mobile='0',tag='desktop',TAR,CSV_OK,CSV_BAD]=process.argv.slice(2);
mkdirSync(join(here,'downloads',tag),{recursive:true});
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
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(here,`${tag}-${name}.png`),Buffer.from(r.result.data,'base64'));};
const results={};const rec=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v).slice(0,600));};
const sha=s=>createHash('sha256').update(Buffer.from(s,'utf8')).digest('hex');
let stage='';
const flush=async()=>{const out=await ev(`const o=[];for(const d of window.__dl){o.push({name:d.name,type:d.type,text:await d.p});}window.__dl=[];return o;`);const res=[];for(const d of out){if(d.text!=null)writeFileSync(join(here,'downloads',tag,`${stage}__${d.name}`),d.text);res.push({name:d.name,type:d.type,chars:d.text?.length,sha256:d.text!=null?sha(d.text):null});}return res;};
const nav=view=>ev(`const n=await import('/navigation.mjs');history.pushState(null,'',n.routeFor('${view}'));dispatchEvent(new PopStateEvent('popstate'));return 1;`);
const TR='#test-records',H10='#h10-diagnostics';
const scrollTo=(sel,block='start')=>ev(`document.querySelector('${sel}').scrollIntoView({block:'${block}'});await new Promise(r=>setTimeout(r,300));return true;`);
const q=sel=>`document.querySelector(${JSON.stringify(sel)})`;
// panel snapshot (visible text only)
const trInfo=`const p=document.querySelector('${TR}');if(!p)return null;const txt=s=>s.textContent.replace(/\\s+/g,' ').trim();
const tables=[...p.querySelectorAll('table')].map(tb=>({label:tb.parentElement.getAttribute('aria-label'),heads:[...tb.querySelectorAll('thead th')].map(txt),rows:[...tb.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(txt))}));
const ps=[...p.querySelectorAll('p')].map(txt);const st=p.querySelector('[role=status]');
const svgs=[...p.querySelectorAll('svg')];const ch=svgs[0];
return {title:txt(p.querySelector('h2')),paras:ps,status:st?txt(st):null,tables,svgCount:svgs.length,chartPoints:ch?ch.querySelectorAll('circle').length:0,chartText:ch?[...ch.querySelectorAll('text')].map(txt):[],buttons:[...p.querySelectorAll('button')].map(txt),boxes:[...p.querySelectorAll('input[type=checkbox]')].map(b=>({label:b.getAttribute('aria-label'),checked:b.checked})),fileInputs:p.querySelectorAll('input[type=file]').length};`;
const markerInfo=`const m=[...document.querySelectorAll('${H10} [data-test-marker]')];return {count:m.length,types:m.map(x=>x.dataset.testMarker),labels:m.map(x=>x.querySelector('title')?.textContent)};`;
const focusInfo=`const a=document.activeElement;return {tag:a?.tagName,label:a?.getAttribute('aria-label'),focusKey:a?.dataset?.focusKey,type:a?.type,hasFocus:document.hasFocus()};`;
const clickBox=async(label,reason)=>{await ev(`const p=document.querySelector('${TR}');const b=p.querySelector('input[aria-label=${JSON.stringify(label)}]');b.scrollIntoView({block:'center'});${reason?`const r=p.querySelector('input[aria-label=${JSON.stringify(label.replace('Include','Reason for'))}]');r.value=${JSON.stringify(reason)};r.dispatchEvent(new Event('input',{bubbles:true}));`:''}b.click();await new Promise(r=>setTimeout(r,400));return 1;`);};
const dl1a=async name=>{stage=name;const out={};
 for(const i of ['import-download','import-csv','import-svg'])await ev(`const b=document.getElementById('${i}');if(!b||b.disabled)return 0;b.click();await new Promise(r=>setTimeout(r,500));return 1;`);
 for(const f of ['JSON','CSV','SVG'])await ev(`const b=[...document.querySelectorAll('${H10} button')].find(b=>/Download.*${f}/.test(b.textContent));b.click();await new Promise(r=>setTimeout(r,800));return 1;`);
 await sleep(500);return await flush();};
const trDl=async(name)=>{stage=name;for(const f of ['JSON','CSV','SVG'])await ev(`const b=[...document.querySelectorAll('${TR} button')].find(b=>/test records ${f}/.test(b.textContent));b.click();await new Promise(r=>setTimeout(r,1200));return 1;`);await sleep(500);return await flush();};
const setFile=async(selector,paths)=>{const doc=await send('DOM.getDocument',{depth:0});const n=await send('DOM.querySelector',{nodeId:doc.result.root.nodeId,selector});if(!n.result.nodeId)throw Error('no node '+selector);await send('DOM.setFileInputFiles',{nodeId:n.result.nodeId,files:paths});};
try{
await send('Page.navigate',{url:'http://127.0.0.1:4174/'});
await wait("document.readyState==='complete'&&document.getElementById('source-public')");
await sleep(1500);
// 1. import through the app's own UI
await nav('data');await sleep(500);
await setFile('#explorer-package-file',[TAR]);
await wait("!document.getElementById('explorer-package-confirm').disabled",90000);
rec('c1_receiverStatus',await ev(`return document.getElementById('explorer-package-status').textContent;`));
await ev(`document.getElementById('explorer-package-preview').scrollIntoView({block:'start'});return 1`);await shot('c1-package-preview');
await ev(`document.getElementById('explorer-package-confirm').click();return 1;`);
await sleep(800);
rec('c1_adoptStatus',await ev(`return {receiver:document.getElementById('explorer-package-status').textContent,import:document.getElementById('import-status').textContent,active:document.getElementById('active-dataset').textContent};`));
await nav('publicTrends');
await wait(`document.querySelector('${TR} h2')&&document.querySelector('${H10} h2')`);await sleep(800);
rec('c1_order',await ev(`const r=document.getElementById('import-results');const kids=[...r.children].map(c=>c.id||c.className||c.tagName);return {kids,h10BeforeTests:kids.indexOf('h10-diagnostics')<kids.indexOf('test-records'),testsLast:kids.indexOf('test-records')===kids.length-1,title:document.getElementById('analysis-title').textContent};`));
const i0=await ev(trInfo);rec('c1_panel',i0);
rec('c1_origins',await ev(`return [...document.querySelectorAll('${TR} tbody tr')].map(tr=>[tr.children[0].textContent,tr.querySelector('td:nth-last-child(4)')?.textContent]);`));
rec('c1_markers0',await ev(markerInfo));
await ev(`window.scrollTo(0,0);return 1`);await shot('c1-top');
await scrollTo(TR);await shot('c1-test-panel');
// 1a downloads before any decision
rec('d_1a_S0_initial',await dl1a('S0'));
rec('d_tr_S0_initial',await trDl('S0'));
// 2. flags
rec('c2_flags',{bhpRows:i0.tables.find(x=>/BHP/.test(x.label)).rows,srtRows:i0.tables.find(x=>/Step/.test(x.label)).rows,chartPoints:i0.chartPoints,chartText:i0.chartText,paras:i0.paras.filter(p=>/before|after|range|reference|Not enough|contribute/i.test(p))});
rec('c2_basis_after_table',await ev(`const w=document.querySelector('${TR} [aria-label="BHP test review"]');const n=w.nextElementSibling;const r=n.getBoundingClientRect();return {text:n.textContent,tag:n.tagName,visible:r.width>0&&r.height>0&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none'};`));
rec('c2_J_line',await ev(`const p=[...document.querySelectorAll('${TR} p')].find(x=>/^Calibrated injectivity/.test(x.textContent));return {text:p?.textContent,exact:p?.textContent==='Calibrated injectivity (J): not ready. Needs a flowing bottomhole pressure with a same-time rate and a reservoir pressure reference (Phase 1c).'};`));
rec('c2_srt_headers',{heads:i0.tables.find(x=>/Step/.test(x.label)).heads,row:i0.tables.find(x=>/Step/.test(x.label)).rows[0]});
await scrollTo(`${TR} [aria-label="BHP test review"]`);await shot('c2-flags-bhp');
await ev(`document.querySelector('${TR} [aria-label="Step-rate test review"]').scrollIntoView({block:'center'});return 1`);await shot('c2-srt-table');
await ev(`const s=[...document.querySelectorAll('${TR} svg')][0];s.scrollIntoView({block:'center'});return 1`);await shot('c2-bhp-chart-2pts');
// 3. re-include off-depth test
await clickBox('Include BHP 2022-05-16');
const i3=await ev(trInfo);
rec('c3_reinclude',{status:i3.status,chartPoints:i3.chartPoints,focus:await ev(focusInfo),chartLabels:i3.chartText.filter(x=>/ft/.test(x)),paras:i3.paras.filter(p=>/contribute|Not enough/.test(p)),notes:await ev(`return [...document.querySelectorAll('${TR} td small')].map(s=>s.textContent)`)});
await ev(`const s=[...document.querySelectorAll('${TR} svg')][0];s.scrollIntoView({block:'center'});return 1`);await shot('c3-bhp-chart-3pts');
rec('c3_markers_after_reinclude',await ev(markerInfo));
rec('d_1a_S1_reincluded_offdepth',await dl1a('S1'));
// (iv) re-included record that cannot be charted: exclude then re-include the out-of-range SRT
await clickBox('Include SRT 2022-05-16','Synthetic review: exclude for note check');
rec('c3_srt_excluded',{status:(await ev(trInfo)).status,focus:await ev(focusInfo)});
await clickBox('Include SRT 2022-05-16');
const iv=await ev(trInfo);
rec('c3_note_srt_reinclude',{status:iv.status,focus:await ev(focusInfo),notes:await ev(`return [...document.querySelectorAll('${TR} td small')].map(s=>s.textContent)`)});
await ev(`document.querySelector('${TR} input[aria-label="Include SRT 2022-05-16"]').scrollIntoView({block:'center'});return 1`);await shot('c3-srt-reinclude-note');
// 4. markers on the 1a ratio chart, and 1a exports unchanged while the marker set changes
rec('c4_markers_initial',await ev(markerInfo));
await ev(`const s=[...document.querySelectorAll('${H10} svg')];s[s.length-1].scrollIntoView({block:'center'});return 1`);await shot('c4-ratio-chart-markers');
rec('c4_ratio_note',await ev(`const s=[...document.querySelectorAll('${H10} svg')];const last=s[s.length-1];return [...last.querySelectorAll('text')].map(x=>x.textContent).filter(x=>/marker|Test/i.test(x));`));
await clickBox('Include BHP 2024-02-12','Synthetic: no markers baseline');
await clickBox('Include BHP 2024-07-22','Synthetic: no markers baseline');
rec('c4_markers_none',await ev(markerInfo));
rec('c4_panel_two_excluded',await ev(trInfo).then(i=>({status:i.status,chartPoints:i.chartPoints,chartText:i.chartText.filter(x=>/Not enough/.test(x)),paras:i.paras.filter(p=>/Not enough|contribute/.test(p))})));
await ev(`const s=[...document.querySelectorAll('${H10} svg')];s[s.length-1].scrollIntoView({block:'center'});return 1`);await shot('c4-ratio-chart-no-markers');
rec('d_1a_S2_no_markers',await dl1a('S2'));
await clickBox('Include BHP 2024-02-12');await clickBox('Include BHP 2024-07-22');
rec('c4_markers_restored',await ev(markerInfo));
rec('d_1a_S3_markers_restored',await dl1a('S3'));
// 5. uploads
await scrollTo(TR);
await setFile(`${TR} input[type=file]`,[CSV_OK]);
await wait(`/Added/.test(document.querySelector('${TR} [role=status]').textContent)`,15000);await sleep(300);
const i5=await ev(trInfo);
rec('c5_upload_ok',{status:i5.status,focus:await ev(focusInfo),coverage:i5.paras.find(p=>/^Records:/.test(p)),chartPoints:i5.chartPoints,origins:await ev(`return [...document.querySelectorAll('${TR} tbody tr')].map(tr=>[tr.children[0].textContent,tr.children[1].textContent,tr.querySelector('td:nth-last-child(4)')?.textContent]);`)});
rec('c5_markers_after_upload',await ev(markerInfo));
await shot('c5-after-valid-upload');
await ev(`const s=[...document.querySelectorAll('${H10} svg')];s[s.length-1].scrollIntoView({block:'center'});return 1`);await shot('c5-ratio-chart-3-markers');
rec('d_1a_S4_after_upload',await dl1a('S4'));
const before=await ev(trInfo);
await scrollTo(TR);
await setFile(`${TR} input[type=file]`,[CSV_BAD]);
await wait(`/000000999|UIC|uic/i.test(document.querySelector('${TR} [role=status]').textContent)`,15000);await sleep(300);
const after=await ev(trInfo);
rec('c5_upload_rejected',{status:after.status,focus:await ev(focusInfo),rowsBefore:before.tables.map(x=>x.rows.length),rowsAfter:after.tables.map(x=>x.rows.length),coverageSame:before.paras.find(p=>/^Records:/.test(p))===after.paras.find(p=>/^Records:/.test(p)),coverage:after.paras.find(p=>/^Records:/.test(p)),chartPointsBefore:before.chartPoints,chartPointsAfter:after.chartPoints,tablesIdentical:JSON.stringify(before.tables)===JSON.stringify(after.tables),markers:await ev(markerInfo)});
await shot('c5-after-rejected-upload');
// 6. exports (final state: package + upload, off-depth re-included)
rec('d_tr_S4_final',await trDl('S4'));
await shot('c6-after-exports');
// 7. layout, console
rec('c8_layout',await ev(`const d=document.documentElement;const sc=[...document.querySelectorAll('${TR} .table-scroll,${TR} .analysis-chart-scroll,${H10} .table-scroll,${H10} .analysis-chart-scroll')].map(e=>({cls:e.className,label:e.getAttribute('aria-label'),scrollW:e.scrollWidth,clientW:e.clientWidth,overflowX:getComputedStyle(e).overflowX}));return {innerWidth,docScrollW:d.scrollWidth,docClientW:d.clientWidth,bodyScrollW:document.body.scrollWidth,pageHScroll:d.scrollWidth>Math.max(d.clientWidth,innerWidth),le390:d.scrollWidth<=innerWidth,containers:sc};`));
await scrollTo(TR);await shot('c8-test-panel-layout');
await ev(`document.querySelector('${TR} .table-scroll').scrollIntoView({block:'center'});return 1`);await shot('c8-test-tables');
// 8. reset / stale export: start a test-records download and switch to the pinned well in the same task
stage='S5stale';
await ev(`const b=[...document.querySelectorAll('${TR} button')].find(b=>/test records JSON/.test(b.textContent));b.click();document.getElementById('source-public').click();return 1;`);
await sleep(2500);
const stale=await flush();
await nav('publicTrends');await wait(`document.querySelector('${TR} h2')`);await sleep(500);
const ip=await ev(trInfo);
rec('c7_stale_and_reset',{downloadsAfterSwitch:stale,panel:{paras:ip.paras,status:ip.status,tables:ip.tables.length,buttons:ip.buttons,chartPoints:ip.chartPoints},markers:await ev(markerInfo),title:await ev(`return document.getElementById('analysis-title').textContent`),active:await ev(`return document.getElementById('active-dataset').textContent`)});
await scrollTo(TR);await shot('c7-pinned-well-reset');
// control: a normal download on the pinned well still works for 1a (not test records)
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;}
results.console=events.filter(e=>(e.method==='Runtime.consoleAPICalled'&&['error','assert'].includes(e.params.type))||e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error')).map(e=>e.method==='Runtime.consoleAPICalled'?{type:e.params.type,text:e.params.args.map(a=>a.value??a.description).join(' ').slice(0,300)}:e.method==='Runtime.exceptionThrown'?{exception:JSON.stringify(e.params.exceptionDetails).slice(0,300)}:{log:e.params.entry.text,url:e.params.entry.url});
results.warnings=events.filter(e=>(e.method==='Runtime.consoleAPICalled'&&e.params.type==='warning')||(e.method==='Log.entryAdded'&&e.params.entry.level==='warning')).length;
console.log('console errors',JSON.stringify(results.console));
writeFileSync(join(here,`results-${tag}.json`),JSON.stringify(results,null,1));
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
