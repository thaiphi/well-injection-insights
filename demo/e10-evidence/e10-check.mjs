// Usage: node e10-check.mjs <width> <height> <mobile 0|1> <tag> <scratchDir> [port] [mode full|sample]
// CDP driver for E10 (#9): Wells compared panel, history package loader and links in a user/demo case.
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
try{
await send('Page.navigate',{url:base});
await wait("document.readyState==='complete'&&document.getElementById('sample-load')");await sleep(1200);
if(mode==='full'){
// ---- user case ----
rec('setup',await loadUserCase());
await calcUser();
rec('s0_userCase',await ev(panel));
await showCompared();await shot('s0-user-case-before-load');
// ---- 1. load both packages, link A and B ----
await setFiles(fileInput,[win(join(scratch,'pkg-417.tar')),win(join(scratch,'pkg-418.tar'))]);
await wait(`document.querySelectorAll('#case-insights section ul.small li button').length>=2`,30000);await sleep(500);
const afterLoad=await ev(panel);
await linkSelect(A,'000000417');await linkSelect(B,'000000418');
const s1=await ev(panel);
rec('s1',{packagesAfterLoad:afterLoad.packages,loadAlerts:afterLoad.alerts,rowsBeforeLink:afterLoad.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status,options:r.options})),rowsAfterLink:s1.rows.map(r=>({well:r.well,uic:r.uicSelect,coverage:r.coverage,rate:r.rate.replace(/[0-9][0-9,.]*/g,'#'),pressure:r.pressure,jSource:r.jSource,status:r.status})),alerts:s1.alerts,bothHaveVerdict:s1.rows.length===2&&s1.rows.every(r=>/history|injection/i.test(r.status)),statusLine:s1.status,summaryLines:s1.summaryLines});
await showCompared();await shot('s1-linked');
// ---- 2. expand A, B; unlink B; detail never shows A ----
await clickRow(A);await sleep(300);const dA=await ev(panel);await showCompared();await shot('s2-expand-a');
await clickRow(B);await sleep(300);const dB=await ev(panel);
await linkSelect(B,'');await sleep(300);const dBu=await ev(panel);await showCompared();await shot('s2-b-unlinked');
const UNL='No H-10 package linked to this well.';
rec('s2',{expandedA:{expanded:dA.rows.map(r=>r.expanded),h5:dA.detail.h5,svgs:dA.detail.svgs},expandedLinkedB:{expanded:dB.rows.map(r=>r.expanded),h5:dB.detail.h5,svgs:dB.detail.svgs},
 unlinkedBDetailText:dBu.detail.text,exactUnlinked:dBu.detail.text===UNL,detailMentionsA:dBu.detail.text.includes('417')||dBu.detail.text.includes(A),detailSvgs:dBu.detail.svgs,rowsAfter:dBu.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status,expanded:r.expanded}))});
// ---- 3. relink B, remove package 418: link gone; results recomputed; downloads before/after ----
await linkSelect(B,'000000418');
await click('#case-insights .import-actions button:first-child');await wait('window.__dl.length>0');await sleep(300);const beforeDl=await flush('s3-before');
const beforeJson=JSON.parse(beforeDl[0].text);
const s3a=await ev(panel);
await ev(`const b=[...document.querySelectorAll('#case-insights ul.small li button')].find(b=>(b.getAttribute('aria-label')||'').includes('uic000000418'));if(!b)throw Error('no remove 418');b.click();await new Promise(r=>setTimeout(r,500));return 1`);
const s3b=await ev(panel);
await click('#case-insights .import-actions button:first-child');await wait('window.__dl.length>0');await sleep(300);const afterDl=await flush('s3-after');
const afterJson=JSON.parse(afterDl[0].text);
const linksOf=j=>(j.links??j.insights?.links??null)?.map(l=>({wellId:l.wellId,uic:l.uic}))??null;
rec('s3',{before:{rows:s3a.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status})),packages:s3a.packages.length,exportLinks:linksOf(beforeJson),exportSchema:beforeJson.schema??beforeJson.schemaVersion??null,jsonSha:beforeDl[0].sha256},
 after:{rows:s3b.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status,options:r.options})),packages:s3b.packages.length,downloads:s3b.downloads,exportLinks:linksOf(afterJson),jsonSha:afterDl[0].sha256,exportChanged:beforeDl[0].sha256!==afterDl[0].sha256},statusAfter:s3b.status});
await showCompared();await shot('s3-418-removed');
// ---- 4. same package twice ----
const pk0=(await ev(panel)).packages;
await setFiles(fileInput,[win(join(scratch,'pkg-417.tar'))]);await sleep(1500);
const s4=await ev(panel);
rec('s4',{packagesBefore:pk0,packagesAfter:s4.packages,alerts:s4.alerts,unchanged:JSON.stringify(pk0)===JSON.stringify(s4.packages),linkStill:s4.rows.map(r=>({well:r.well,uic:r.uicSelect}))});
await showCompared();await shot('s4-duplicate-refused');
// ---- 5. switch to demo, links cleared, packages kept; user -> demo -> user without calculating demo ----
await linkSelect(A,'000000417');await linkSelect(B,'');
const pre5=await ev(panel);
await click('#source-demo');await sleep(1500);
const ctxDemo=await ev(`return {ciHidden:document.getElementById('case-insights').hidden}`);
await calcUser();
const s5a=await ev(panel);
rec('s5_demo',{linkedBefore:pre5.rows.map(r=>({well:r.well,uic:r.uicSelect})),afterSwitchPanelHidden:ctxDemo.ciHidden,demoRows:s5a.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status,options:r.options})),demoPackages:s5a.packages.length,demoLoaderHidden:s5a.loaderHidden,historyBoxes:s5a.historyBoxes.length});
await showCompared();await shot('s5-demo-links-cleared');
await click('#source-user');await sleep(1200);
await calcUser();
await linkSelect(A,'000000417');
const pre5b=await ev(panel);
await click('#source-demo');await sleep(1200);
await click('#source-user');await sleep(1200);
await calcUser();
const s5b=await ev(panel);
rec('s5_user_demo_user',{linkedBefore:pre5b.rows.map(r=>({well:r.well,uic:r.uicSelect})),after:s5b.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status})),packages:s5b.packages.length,cleared:s5b.rows.every(r=>r.uicSelect===''),alerts:s5b.alerts});
await showCompared();await shot('s5-user-demo-user');
// ---- 7. downloads of a linked user case ----
await linkSelect(A,'000000417');
await setFiles(fileInput,[win(join(scratch,'pkg-418.tar'))]);await wait(`document.querySelectorAll('#case-insights section ul.small li button').length>=2`,30000);await sleep(300);
await linkSelect(B,'000000418');
const s7p=await ev(panel);
const dls={};
for(const [f,idx] of [['JSON',0],['CSV',1]]){await ev(`document.querySelectorAll('#case-insights .import-actions button')[${idx}].click();return 1`);await wait('window.__dl.length>0',60000);await sleep(300);dls[f]=(await flush('s7'))[0];}
const sealed=JSON.parse(dls.JSON.text);let verifyJson={ok:false};
try{await verifyCaseInsights(sealed);verifyJson={ok:true};}catch(e){verifyJson={ok:false,error:String(e.message).slice(0,200)};}
const csvRows=csvFields(dls.CSV.text);const counts=[...new Set(csvRows.map(r=>r.length))];
rec('s7',{rowsAtExport:s7p.rows.map(r=>({well:r.well,uic:r.uicSelect,status:r.status})),json:{name:dls.JSON.name,chars:dls.JSON.chars,sha256:dls.JSON.sha256,schema:sealed.schema??sealed.schemaVersion??null,topKeys:Object.keys(sealed),links:linksOf(sealed),nodeVerify:verifyJson},csv:{name:dls.CSV.name,chars:dls.CSV.chars,sha256:dls.CSV.sha256,lines:csvRows.length,fieldCountsPerLine:counts,allFour:counts.length===1&&counts[0]===4}});
await showCompared();await shot('s7-linked-for-export');
}
// ---- 6. sample case ----
await ev(`document.getElementById('sample-load').click();return 1`);
await wait("/all 7 loading steps done/.test(document.getElementById('sample-banner-detail').textContent)",240000);
await nav('scenarios');await calcCase();
const s6=await ev(panel);
const redact=s=>s.replace(/[0-9][0-9,.\-−]*/g,'#');
const full=await ev(`const ci=document.getElementById('case-insights');return [...ci.querySelectorAll(':scope > div > details')].map(d=>d.querySelector('summary').textContent)`);
rec('s6',{status:redact(s6.status),rows:s6.rows.map(r=>({well:r.well,uic:r.uicSelect??r.uicText,jSource:r.jSource,status:r.status,coverage:r.coverage.replace(/[0-9]+/g,'#'),pressure:r.pressure})),loaderHidden:s6.loaderHidden,summaryLineCount:full.length,summaryLinesSha256:full.map(l=>sha(l)),summaryLinesRedacted:full.map(redact)});
await showCompared();await shot('s6-sample-table');
await clickRow(s6.rows[0].well.split(' (')[0]);await sleep(300);const s6d=await ev(panel);
rec('s6_detail',{h5:s6d.detail.h5,svgs:s6d.detail.svgs,paragraphs:s6d.detail.paragraphs.map(redact)});
await showCompared();await shot('s6-sample-detail');
// ---- 8/9 ----
rec('s9',await ev(pageScroll));
rec('s8',{consoleErrors});
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;results.consoleErrors=consoleErrors;try{results.fatalContext=await ev(`return {src:document.getElementById('disposal-source')?.textContent,imp:document.getElementById('import-status')?.textContent,res:document.getElementById('result-message')?.textContent,err:document.getElementById('disposal-error')?.textContent}`);console.log(JSON.stringify(results.fatalContext));await shot('fatal');}catch{}}
results.screenshots=shotHashes;
writeFileSync(mode==='full'?join(here,`results-${tag}.json`):join(scratch,`results-${mode}-${tag}-port${port}.json`),JSON.stringify(results,null,1));
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
