// Usage: node e10-recheck.mjs <width> <height> <mobile 0|1> <tag> <scratchDir> [port]
// Recheck after the final fix wave (HEAD 7fd5228); needs injectors-edited.csv (one J value changed) in <scratchDir>.
// <scratchDir> (outside the repo) must hold pkg-417.tar, pkg-418.tar (fictional, made from tests/helpers/explorer-v4.mjs) and schedule.csv.
// Downloads and screenshots go to <scratchDir>/dl/<tag> and <scratchDir>/shots. Records statuses, counts, fictional IDs and hashes only.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const appDir=resolve(here,'../../swd-injection-analytics');
const [w='1280',h='900',mobile='0',tag='desktop',scratch,port='4174',mode='full']=process.argv.slice(2);
if(!scratch)throw Error('scratchDir required');
const dlDir=join(scratch,'dl',tag),shotDir=join(scratch,'shots');mkdirSync(dlDir,{recursive:true});mkdirSync(shotDir,{recursive:true});
const base=`http://127.0.0.1:${port}/`;
const sha=b=>createHash('sha256').update(b).digest('hex');
const win=p=>p.replaceAll('/','\\');
const {verifyCaseInsights}=await import(pathToFileURL(join(appDir,'dist/caseInsights.js')).href);
const t=await (await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const pending=new Map();const consoleErrors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
 if(m.method==='Runtime.consoleAPICalled'&&['error','assert'].includes(m.params.type))consoleErrors.push('console.'+m.params.type+': '+m.params.args.map(a=>a.value??a.description).join(' ').slice(0,300));
 if(m.method==='Runtime.exceptionThrown')consoleErrors.push('exception: '+(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text).slice(0,300));
 if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')consoleErrors.push('log: '+m.params.entry.text.slice(0,300)+' '+(m.params.entry.url??''));
};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await send('Emulation.setDeviceMetricsOverride',{width:+w,height:+h,deviceScaleFactor:1,mobile:mobile==='1'});
await send('Emulation.setFocusEmulationEnabled',{enabled:true});
for(const d of ['Page','Runtime','Log','Network','DOM'])await send(d+'.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`
window.__dl=[];const _c=URL.createObjectURL.bind(URL),map=new Map();
URL.createObjectURL=b=>{const u=_c(b);map.set(u,b);return u;};
const _click=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download){const b=map.get(this.href);window.__dl.push({name:this.download,type:b&&b.type,p:b?b.text():Promise.resolve(null)});return;}return _click.call(this);};
`});
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${expr}})()`,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,800));return r.result?.result?.value;};
const wait=async(expr,ms=60000)=>{const s=Date.now();while(Date.now()-s<ms){try{if(await ev('return '+expr))return true;}catch{}await sleep(200);}throw Error('TIMEOUT '+expr);};
const shotHashes={};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});const b=Buffer.from(r.result.data,'base64');const f=`${tag}-${name}.png`;writeFileSync(join(shotDir,f),b);shotHashes[f]=sha(b);};
const results={chrome:(await (await fetch('http://127.0.0.1:9333/json/version')).json()).Browser,viewport:[+w,+h,mobile],port,mode};
const rec=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v).slice(0,400));};
const nav=view=>ev(`const n=await import('/navigation.mjs');history.pushState(null,'',n.routeFor('${view}'));dispatchEvent(new PopStateEvent('popstate'));await new Promise(r=>setTimeout(r,800));return 1;`);
const flush=async label=>{const out=await ev(`const o=[];for(const d of window.__dl){o.push({name:d.name,type:d.type,text:await d.p});}window.__dl=[];return o;`);const files=[];for(const d of out)if(d.text!=null){writeFileSync(join(dlDir,label+'-'+d.name),d.text);files.push({name:d.name,type:d.type,chars:d.text.length,sha256:sha(d.text),text:d.text});}return files;};
const setFiles=async(selector,files)=>{const o=await send('Runtime.evaluate',{expression:`document.querySelector(${JSON.stringify(selector)})`});await send('DOM.setFileInputFiles',{objectId:o.result.result.objectId,files});};
const setSel=(sel,v)=>ev(`const s=document.querySelector(${JSON.stringify(sel)});s.value=${JSON.stringify(v)};if(s.value!==${JSON.stringify(v)})throw Error('no option '+${JSON.stringify(v)}+' in '+${JSON.stringify(sel)});s.dispatchEvent(new Event('change',{bubbles:true}));return 1`);
const click=sel=>ev(`const b=document.querySelector(${JSON.stringify(sel)});if(!b)throw Error('missing '+${JSON.stringify(sel)});b.click();return 1`);
const ready=`document.querySelector('#case-insights [role=status]')&&/summary lines from the calculated case/.test(document.querySelector('#case-insights [role=status]').textContent)&&!document.getElementById('case-insights').hidden`;
const calcCase=async()=>{await wait("!document.getElementById('disposal-calculate').disabled");await click('#disposal-calculate');await wait(ready,90000);await sleep(500);};
// Panel readout: statuses, counts, ids; no per-month values.
const panel=`const ci=document.getElementById('case-insights');const cs=[...ci.querySelectorAll(':scope > section')].find(s=>s.querySelector('h4')?.textContent==='Wells compared');
 const ym=s=>s.replace(/[0-9]{4}-[0-9]{2}/g,'YYYY-MM');
 const rows=cs?[...cs.querySelectorAll('table tbody tr')].map(tr=>{const c=[...tr.cells];const sel=c[1].querySelector('select');return {well:c[0].textContent,expanded:c[0].querySelector('button')?.getAttribute('aria-expanded'),uicSelect:sel?sel.value:null,uicText:sel?null:c[1].textContent,options:sel?[...sel.options].map(o=>o.value+(o.disabled?'(disabled)':'')):null,coverage:ym(c[2].textContent),rate:c[3].textContent.slice(0,60),pressure:c[4].textContent,jSource:c[5].textContent,status:c[6].textContent};}):[];
 const detail=document.getElementById('wells-compared-detail')||document.createElement('div');
 const alerts=cs?[...cs.querySelectorAll('[role=alert]')].map(a=>a.textContent):[];
 const pkgs=cs?cs.querySelectorAll('ul.small')[0]?.querySelectorAll('li'):[];
 return {ciHidden:ci.hidden,sectionHidden:cs?cs.hidden:null,loaderHidden:cs?cs.children[1].hidden:null,status:ci.querySelector('[role=status]').textContent,summaryLines:ci.querySelectorAll(':scope > div > details').length,rows,
  detail:{hidden:detail.hidden,text:detail.textContent,h5:detail.querySelector('h5')?.textContent??null,svgs:detail.querySelectorAll('svg').length,paragraphs:[...detail.querySelectorAll(':scope > p')].map(p=>ym(p.textContent).slice(0,140))},
  alerts,packages:[...(pkgs??[])].map(li=>ym(li.firstChild.textContent.trim())),
  downloads:[...ci.querySelectorAll('.import-actions button')].map(b=>[b.textContent,b.disabled]),
  historyBoxes:[...ci.querySelectorAll('h5')].filter(h=>!detail.contains(h)).map(h=>h.textContent)};`;
const pageScroll=`const d=document.documentElement;return {innerWidth,scrollW:d.scrollWidth,clientW:d.clientWidth,pageHScroll:d.scrollWidth>d.clientWidth}`;
const csvFields=text=>{const lines=[];let row=[],cur='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}else if(ch==='"')q=true;else if(ch===','){row.push(cur);cur='';}else if(ch==='\n'){row.push(cur);lines.push(row);row=[];cur='';}else cur+=ch;}if(cur||row.length){row.push(cur);lines.push(row);}return lines;};
const showCompared=async()=>{await ev(`const ci=document.getElementById('case-insights');[...ci.querySelectorAll('h4')].find(h=>h.textContent==='Wells compared').scrollIntoView({block:'start'});return 1`);await sleep(300);};
const rowBtn=name=>`[...document.querySelectorAll('#case-insights table tbody tr td:first-child button')].find(b=>b.textContent.includes(${JSON.stringify(name)}))`;
const clickRow=name=>ev(`const b=${rowBtn(name)};if(!b)throw Error('no row '+${JSON.stringify(name)});b.click();return 1`);
const linkSelect=(well,v)=>ev(`const s=[...document.querySelectorAll('#case-insights select')].find(s=>(s.getAttribute('aria-label')||'').includes(${JSON.stringify(well)}));if(!s)throw Error('no select');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,300));return s.value`);
const fileInput='#case-insights input[type=file]';
const A='FICTIONAL-INJ-A',B='FICTIONAL-INJ-B';
const mapAndConfirm=async(profile,file,units,time,map)=>{
 await setSel('#import-profile',profile);await sleep(300);await setSel('#import-kind','synthetic');
 await setFiles('#import-file',[file]);await wait(`document.querySelectorAll('#import-mapping select[data-field]').length>0`);
 if(map)for(const [f,col] of Object.entries(map))await setSel(`#import-mapping select[data-field=${f}]`,col);
 for(const [u,v] of Object.entries(units))await setSel(`#import-mapping select[data-unit=${u}]`,v);
 if(time)await setSel('#import-time',time);
 await click('#import-validate');await wait(`!document.getElementById('import-confirm').disabled`,20000);await click('#import-confirm');await sleep(600);
 return ev(`return document.getElementById('import-status').textContent.slice(0,160)`);
};
const loadUserCase=async()=>{
 await click('#source-user');await sleep(500);
 const out=[];
 out.push(await mapAndConfirm('history',win(join(appDir,'data/samples/seed417-history.csv')),{water:'STB/day'},'calendar-day',{producerId:'Producer',groupId:'Group',month:'Month',water:'Water'}));
 out.push(await mapAndConfirm('schedule',win(join(scratch,'schedule.csv')),{initialRate:'STB/day',monthlyDecline:'fraction/month',availability:'fraction'},null,null));
 out.push(await mapAndConfirm('injector',win(join(appDir,'data/samples/assumed-injectors.csv')),{injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'},null,{id:'id',injectivity:'j',reservoirPressure:'pres',limitPressure:'limit',reservoirBasis:'rb',limitBasis:'lb',reservoirDatum:'rd',limitDatum:'ld',operatingCeiling:'ceiling',availability:'availability'}));
 return out;
};
const calcUser=async()=>{await nav('scenarios');await wait("document.getElementById('disposal-workspace')&&!document.getElementById('disposal-workspace').hidden");
 await wait("!document.getElementById('disposal-illustrative').disabled",30000);await click('#disposal-illustrative');await sleep(300);await calcCase();};
const loadAlert=`const cs=[...document.querySelectorAll('#case-insights > section')].find(s=>s.querySelector('h4')?.textContent==='Wells compared');return [...cs.querySelectorAll('[role=alert]')].map(a=>a.textContent)`;
const injMap={id:'id',injectivity:'j',reservoirPressure:'pres',limitPressure:'limit',reservoirBasis:'rb',limitBasis:'lb',reservoirDatum:'rd',limitDatum:'ld',operatingCeiling:'ceiling',availability:'availability'};
const injUnits={injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'};
try{
await send('Page.navigate',{url:base});
await wait("document.readyState==='complete'&&document.getElementById('sample-load')");await sleep(1200);
rec('setup',(await loadUserCase()).length);
await calcUser();
// 1: load, link
await setFiles(fileInput,[win(join(scratch,'pkg-417.tar')),win(join(scratch,'pkg-418.tar'))]);
await wait(`document.querySelectorAll('#case-insights section ul.small li button').length>=2`,30000);await sleep(500);
await linkSelect(A,'000000417');await linkSelect(B,'000000418');
const s1=await ev(panel);
const gapOnce=s1.rows.map(r=>({well:r.well,gapSentenceCount:(r.coverage.match(/gap is never zero/g)||[]).length}));
rec('s1',{rows:s1.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status,jSource:r.jSource})),bothVerdict:s1.rows.every(r=>/history|injection/i.test(r.status)),gapOnce,gapSentenceOnce:gapOnce.every(g=>g.gapSentenceCount===1),alerts:s1.alerts});
await showCompared();await shot('r1-linked');
// 3: remove 418
await ev(`const b=[...document.querySelectorAll('#case-insights ul.small li button')].find(b=>(b.getAttribute('aria-label')||'').includes('uic000000418'));b.click();await new Promise(r=>setTimeout(r,500));return 1`);
const s3=await ev(panel);
rec('s3',{rows:s3.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status})),packages:s3.packages.length,downloadsEnabled:s3.downloads.every(d=>!d[1])});
await showCompared();await shot('r3-418-removed');
// D1: refused duplicate, then user->demo->user, calculate -> alert empty
await setFiles(fileInput,[win(join(scratch,'pkg-417.tar'))]);await sleep(1500);
const dup=await ev(loadAlert);
await linkSelect(A,'000000417');
await click('#source-demo');await sleep(1200);await click('#source-user');await sleep(1200);await calcUser();
const s5=await ev(panel);
rec('s5',{alertAfterDuplicate:dup,alertsAfterSwitch:s5.alerts,alertEmpty:s5.alerts.every(a=>a===''),rowsCleared:s5.rows.every(r=>r.uicSelect===''),packagesKept:s5.packages.length});
await showCompared();await shot('r5-user-demo-user');
await linkSelect(A,'000000417');
await click('#source-demo');await sleep(1200);await calcUser();
const s5d=await ev(panel);
rec('s5_demo',{rows:s5d.rows.map(r=>({well:r.well,uic:r.uicSelect})),packagesKept:s5d.packages.length,loaderVisible:s5d.loaderHidden===false});
await click('#source-user');await sleep(1200);await calcUser();
// re-import injector profile with a changed file -> links cleared, packages kept
await setFiles(fileInput,[win(join(scratch,'pkg-418.tar'))]);await wait(`document.querySelectorAll('#case-insights section ul.small li button').length>=2`,30000);await sleep(300);
await linkSelect(A,'000000417');await linkSelect(B,'000000418');
const pre=await ev(panel);
await nav('data');
const imp=await mapAndConfirm('injector',win(join(scratch,'injectors-edited.csv')),injUnits,null,injMap);
await calcUser();
const post=await ev(panel);
rec('s_reimport',{status:imp.slice(0,60),linkedBefore:pre.rows.map(r=>r.uicSelect),after:post.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status})),linksCleared:post.rows.every(r=>r.uicSelect===''),packagesKept:post.packages.length,packagesBefore:pre.packages.length});
await showCompared();await shot('r-reimport');
// 7: relink and downloads
await linkSelect(A,'000000417');await linkSelect(B,'000000418');
const dls={};
for(const [f,idx] of [['JSON',0],['CSV',1]]){await ev(`document.querySelectorAll('#case-insights .import-actions button')[${idx}].click();return 1`);await wait('window.__dl.length>0',60000);await sleep(300);dls[f]=(await flush('r7'))[0];}
const sealed=JSON.parse(dls.JSON.text);let verifyJson={ok:false};
try{await verifyCaseInsights(sealed);verifyJson={ok:true};}catch(e){verifyJson={ok:false,error:String(e.message).slice(0,200)};}
const csvRows=csvFields(dls.CSV.text);const counts=[...new Set(csvRows.map(r=>r.length))];
const has=re=>csvRows.filter(r=>r.some(c=>re.test(c))).length;
rec('s7',{json:{chars:dls.JSON.chars,sha256:dls.JSON.sha256,schema:sealed.schema??sealed.schemaVersion??null,links:(sealed.links??[]).map(l=>({wellId:l.wellId,uic:l.uic})),nodeVerify:verifyJson},
 csv:{chars:dls.CSV.chars,sha256:dls.CSV.sha256,lines:csvRows.length,fieldCountsPerLine:counts,allFour:counts.length===1&&counts[0]===4,inclusionBasisRows:has(/^inclusion basis$/),packageManifestRows:has(/^package .+ manifestSha256$/),packageWindowRows:has(/^package .+ window$/)}});
await showCompared();await shot('r7-linked');
// 6: sample
await ev(`document.getElementById('sample-load').click();return 1`);
await wait("/all 7 loading steps done/.test(document.getElementById('sample-banner-detail').textContent)",240000);
await nav('scenarios');await calcCase();
const s6=await ev(panel);
const full=await ev(`const ci=document.getElementById('case-insights');return [...ci.querySelectorAll(':scope > div > details')].map(d=>d.querySelector('summary').textContent)`);
rec('s6',{rows:s6.rows.map(r=>({well:r.well,uic:r.uicSelect??r.uicText,jSource:r.jSource,status:r.status,coverage:r.coverage.replace(/[0-9]+/g,'#'),windowFromRows:/window from reported rows/.test(r.coverage)})),allWindowFromRows:s6.rows.every(r=>/window from reported rows/.test(r.coverage)),loaderHidden:s6.loaderHidden,summaryLineCount:full.length,summaryLinesSha256:full.map(l=>sha(l))});
await showCompared();await shot('r6-sample');
rec('s9',await ev(pageScroll));
rec('s8',{consoleErrors});
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;results.consoleErrors=consoleErrors;try{results.fatalContext=await ev(`return {src:document.getElementById('disposal-source')?.textContent,imp:document.getElementById('import-status')?.textContent,err:document.getElementById('disposal-error')?.textContent}`);console.log(JSON.stringify(results.fatalContext));await shot('rfatal');}catch{}}
results.screenshots=shotHashes;
writeFileSync(join(scratch,`recheck-${tag}.json`),JSON.stringify(results,null,1));
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
