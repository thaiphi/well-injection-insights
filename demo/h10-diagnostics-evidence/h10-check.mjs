// Usage: node h10-check.mjs <width> <height> <mobile 0|1> <tag>
// Self-contained CDP driver for the H-10 diagnostics panel. Captures downloads by wrapping createObjectURL / anchor click.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const [w='1280',h='900',mobile='0',tag='desktop']=process.argv.slice(2);
mkdirSync(join(here,'downloads',tag),{recursive:true});
const t=await (await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send('Emulation.setDeviceMetricsOverride',{width:+w,height:+h,deviceScaleFactor:1,mobile:mobile==='1'});
await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Page.enable');await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`
window.__dl=[];const _c=URL.createObjectURL.bind(URL),map=new Map();
URL.createObjectURL=b=>{const u=_c(b);map.set(u,b);return u;};
HTMLAnchorElement.prototype.click=function(){if(this.download){const b=map.get(this.href),name=this.download;window.__dl.push({name,type:b&&b.type,p:b?b.text():Promise.resolve(null)});return;}};
`});
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${expr}})()`,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,800));return r.result?.result?.value;};
const wait=async(expr,ms=60000)=>{const s=Date.now();while(Date.now()-s<ms){try{if(await ev('return '+expr))return true;}catch{}await sleep(200);}throw Error('TIMEOUT '+expr);};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(here,`${tag}-${name}.png`),Buffer.from(r.result.data,'base64'));};
const scrollToPanel=()=>ev(`document.getElementById('h10-diagnostics').scrollIntoView({block:'start'});await new Promise(r=>setTimeout(r,300));return true;`);
const results={};const rec=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v));};
const flush=async()=>{const out=await ev(`const o=[];for(const d of window.__dl){o.push({name:d.name,type:d.type,text:await d.p});}window.__dl=[];return o;`);for(const d of out){if(d.text!=null)writeFileSync(join(here,'downloads',tag,d.name),d.text);}return out.map(d=>({name:d.name,type:d.type,chars:d.text?.length}));};
const panelInfo=`const p=document.getElementById('h10-diagnostics');if(!p)return null;const cov=[...p.querySelectorAll('p')].find(x=>/^Coverage:/.test(x.textContent))?.textContent??null;const st=p.querySelector('[role=status]')?.textContent??null;const boxes=[...p.querySelectorAll('input[type=checkbox]')];return {cov,status:st,boxes:boxes.length,unticked:boxes.filter(b=>!b.checked).map(b=>b.getAttribute('aria-label')),charts:p.querySelectorAll('svg').length,xMarkers:p.querySelectorAll('svg text[data-excluded]').length,xMarkersAny:0,buttons:[...p.querySelectorAll('button')].map(b=>b.textContent)};`;
const nav=view=>ev(`const n=await import('/navigation.mjs');history.pushState(null,'',n.routeFor('${view}'));dispatchEvent(new PopStateEvent('popstate'));return 1;`);
const panelReady="document.getElementById('h10-diagnostics')&&document.querySelector('#h10-diagnostics h2')";
const covNum=s=>+(/(\d+) comparable/.exec(s)?.[1]);
const mouse=async(x,y)=>{await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});};
const openReview=async()=>{await ev(`const d=document.querySelector('#h10-diagnostics details');if(!d.open)d.querySelector('summary').click();await new Promise(r=>setTimeout(r,200));return d.open`);};
try{
await send('Page.navigate',{url:'http://127.0.0.1:4174/'});
await wait("document.readyState==='complete'&&document.getElementById('source-public')");
await sleep(1500);
// 1. pinned well
await ev(`document.getElementById('source-public').click();return 1;`);
await sleep(800);
await nav('publicTrends');
await wait(panelReady);await sleep(500);
rec('c1_main',await ev(`return {view:document.getElementById('main').dataset.view,title:document.getElementById('analysis-title').textContent};`));
rec('c1_panel',await ev(panelInfo));
rec('c1_order',await ev(`const r=document.getElementById('import-results');const kids=[...r.children].map(c=>c.id||c.className||c.tagName);const idx=kids.indexOf('h10-diagnostics');const out=[...r.querySelectorAll('svg')].filter(s=>!s.closest('#h10-diagnostics')).length;return {kids,panelIsLast:idx===kids.length-1,existingSvgsOutsidePanel:out,existingDownloadsEnabled:['import-download','import-csv','import-svg'].map(i=>[i,!document.getElementById(i).disabled])};`));
await ev(`window.scrollTo(0,0);return 1`);await shot('c1-top');
await scrollToPanel();await shot('c1-panel');
for(const i of ['import-download','import-csv','import-svg'])await ev(`document.getElementById('${i}').click();return 1;`);
await sleep(500);rec('c1_existingDownloads',await flush());
rec('c1_reviewDefault',await ev(`const d=document.querySelector('#h10-diagnostics details');return {summary:d.querySelector('summary').textContent,open:d.open}`));
await openReview();await ev(`document.querySelector('#h10-diagnostics details').scrollIntoView({block:'start'});return 1`);await shot('c1-review-open');
// 2. exclude / re-include
const before=await ev(panelInfo);
rec('c2_before',{comparable:covNum(before.cov),xMarkers:before.xMarkers,xMarkersAny:before.xMarkersAny});
await ev(`const b=document.querySelector('#h10-diagnostics input[aria-label="Include 2024-03"]');b.scrollIntoView({block:'center'});b.click();await new Promise(r=>setTimeout(r,300));return 1;`);
rec('c2_emptyReason',await ev(`const p=document.getElementById('h10-diagnostics');const b=p.querySelector('input[aria-label="Include 2024-03"]');return {status:p.querySelector('[role=status]').textContent,stillTicked:b.checked,active:document.activeElement?.getAttribute('aria-label')};`));
await shot('c2-empty-reason-error');
await ev(`const p=document.getElementById('h10-diagnostics');const r=p.querySelector('input[aria-label="Reason for 2024-03"]');r.value='Workover shut-in';r.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));p.querySelector('input[aria-label="Include 2024-03"]').click();await new Promise(r=>setTimeout(r,400));return 1;`);
const after=await ev(panelInfo);
rec('c2_excluded',{comparable:covNum(after.cov),xMarkers:after.xMarkers,xMarkersAny:after.xMarkersAny,status:after.status,unticked:after.unticked,focus:await ev(`const a=document.activeElement;return {tag:a?.tagName,label:a?.getAttribute('aria-label'),focusKey:a?.dataset?.focusKey,checked:a?.checked,hasFocus:document.hasFocus()};`)});
await ev(`document.querySelector('#h10-diagnostics input[aria-label="Include 2024-03"]').scrollIntoView({block:'center'});return 1`);await shot('c2-excluded');
await ev(`const s=[...document.querySelectorAll('#h10-diagnostics svg')];s[s.length-1].scrollIntoView({block:'center'});return 1`);await shot('c2-excluded-charts');
// lost-click: edit reason of excluded month, then mouse-click Download JSON directly
const pos=await ev(`const r=document.querySelector('#h10-diagnostics input[aria-label="Reason for 2024-03"]');r.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,200));const a=r.getBoundingClientRect();return [a.x+a.width/2,a.y+a.height/2];`);
await mouse(...pos);
await send('Input.insertText',{text:' (edited)'});
const pos2=await ev(`const bt=[...document.querySelectorAll('#h10-diagnostics button')].find(b=>/JSON/.test(b.textContent));bt.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,200));const bb=bt.getBoundingClientRect();const rr=document.querySelector('#h10-diagnostics input[aria-label="Reason for 2024-03"]');return {b:[bb.x+bb.width/2,bb.y+bb.height/2],reasonFocused:document.activeElement===rr};`);
await mouse(...pos2.b);await sleep(1500);
const lc=await flush();
rec('c2_lostClick',{downloads:lc,reasonFocusedBeforeClick:pos2.reasonFocused,status:(await ev(panelInfo)).status,reasonValue:await ev(`return document.querySelector('#h10-diagnostics input[aria-label="Reason for 2024-03"]').value`)});
// re-tick
await ev(`const b=document.querySelector('#h10-diagnostics input[aria-label="Include 2024-03"]');b.click();await new Promise(r=>setTimeout(r,400));return 1;`);
const re=await ev(panelInfo);rec('c2_reticked',{comparable:covNum(re.cov),xMarkers:re.xMarkers,xMarkersAny:re.xMarkersAny,unticked:re.unticked,status:re.status});
// 3. downloads
for(const f of ['JSON','CSV','SVG'])await ev(`const b=[...document.querySelectorAll('#h10-diagnostics button')].find(b=>/${f}/.test(b.textContent));b.click();await new Promise(r=>setTimeout(r,800));return 1;`);
rec('c3_downloads',await flush());
await shot('c3-after-downloads');
// 4. sample case
await ev(`document.getElementById('sample-load-data').click();return 1;`);
await wait("/all 7 loading steps done/.test(document.getElementById('sample-banner-detail').textContent)",180000);
await nav('publicTrends');
await wait(panelReady);await sleep(800);
await openReview();const a=await ev(panelInfo);rec('c4_wellA',{cov:a.cov,boxes:a.boxes});
await ev(`const p=document.getElementById('h10-diagnostics');const r=p.querySelector('input[aria-label="Reason for 2024-03"]');r.value='sample A review';r.dispatchEvent(new Event('change',{bubbles:true}));p.querySelector('input[aria-label="Include 2024-03"]').click();await new Promise(r=>setTimeout(r,300));return 1;`);
rec('c4_wellA_edited',await ev(panelInfo).then(i=>({cov:i.cov,unticked:i.unticked})));
await ev(`document.querySelector('input[name="sample-well"][value="1"]').click();return 1;`);
await sleep(2500);await wait(panelReady);
const b=await ev(panelInfo);rec('c4_wellB',{cov:b.cov,boxes:b.boxes,status:b.status,unticked:b.unticked});
await scrollToPanel();await shot('c4-well-b');
await ev(`document.querySelector('input[name="sample-well"][value="0"]').click();return 1;`);
await sleep(2500);await wait(panelReady);
const a2=await ev(panelInfo);rec('c4_backToA',{cov:a2.cov,unticked:a2.unticked,status:a2.status});
// 5. stale export
await ev(`const b=[...document.querySelectorAll('#h10-diagnostics button')].find(b=>/JSON/.test(b.textContent));b.click();document.querySelector('input[name="sample-well"][value="1"]').click();return 1;`);
await sleep(2500);
rec('c5_stale_sync',{dl:await flush(),panel:await ev(panelInfo).then(i=>i&&{cov:i.cov,status:i.status})});
await ev(`document.querySelector('input[name="sample-well"][value="0"]').click();return 1;`);await sleep(2500);
await ev(`const b=[...document.querySelectorAll('#h10-diagnostics button')].find(b=>/JSON/.test(b.textContent));b.click();await Promise.resolve();document.querySelector('input[name="sample-well"][value="1"]').click();return 1;`);
await sleep(2500);rec('c5_stale_microtask',{dl:await flush(),panel:await ev(panelInfo).then(i=>i&&{cov:i.cov,status:i.status})});
// Histories view with source=public
await ev(`document.getElementById('source-public').click();return 1;`);await sleep(800);
await nav('history');await sleep(2500);
rec('c_histories_public',await ev(`return {view:document.getElementById('main').dataset.view,panel:!!document.getElementById('h10-diagnostics'),title:document.getElementById('analysis-title').textContent,msg:document.getElementById('result-message')?.textContent.slice(0,200)};`));
await shot('histories-public');
// 6. layout
await nav('publicTrends');
await wait(panelReady);await sleep(500);
rec('c6_layout',await ev(`const d=document.documentElement;const p=document.getElementById('h10-diagnostics');const sc=[...p.querySelectorAll('.table-scroll,.analysis-chart-scroll')].map(e=>({cls:e.className,scrollW:e.scrollWidth,clientW:e.clientWidth,overflowX:getComputedStyle(e).overflowX,right:Math.round(e.getBoundingClientRect().right)}));const over=[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>d.clientWidth+1&&!e.closest('.table-scroll,.analysis-chart-scroll,[class*=scroll]')&&getComputedStyle(e).position!=='fixed'&&e.getClientRects().length).slice(0,8).map(e=>e.tagName+'#'+e.id+'.'+String(e.className).slice(0,40));return {innerWidth,docScrollW:d.scrollWidth,docClientW:d.clientWidth,pageHScroll:d.scrollWidth>d.clientWidth,containers:sc,unscrolledOverflowers:over};`));
await scrollToPanel();await shot('c6-panel');
await ev(`document.querySelector('#h10-diagnostics .analysis-chart-scroll').scrollIntoView({block:'center'});return 1`);await shot('c6-charts');
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;}
writeFileSync(join(here,`results-${tag}.json`),JSON.stringify(results,null,1));
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
