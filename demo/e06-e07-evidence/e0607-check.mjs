// Usage: node e0607-check.mjs <width> <height> <mobile 0|1> <tag> <scratchDir> [port] [mode full|sample]
// CDP driver for #7 (ANA-E06) "Pressure buildup over time (assumed rock)" and #8 (ANA-E07) "Nearby wells (interference screening)".
// <scratchDir> (outside the repo) must hold pkg-417.tar, pkg-418.tar (fictional, from tests/helpers/explorer-v4.mjs; 418 carries one
// reported-zero month) and schedule.csv. Downloads and screenshots go to <scratchDir>/dl/<tag> and <scratchDir>/shots.
// Records texts of the fictional user case; sample-case text (real TRRC wells) is recorded only as digit-redacted text and SHA-256.
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
const redact=s=>String(s).replace(/[0-9][0-9,.\-−]*/g,'#');
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
const rec=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v).slice(0,600));};
const nav=view=>ev(`const n=await import('/navigation.mjs');history.pushState(null,'',n.routeFor('${view}'));dispatchEvent(new PopStateEvent('popstate'));await new Promise(r=>setTimeout(r,800));return 1;`);
const flush=async label=>{const out=await ev(`const o=[];for(const d of window.__dl){o.push({name:d.name,type:d.type,text:await d.p});}window.__dl=[];return o;`);const files=[];for(const d of out)if(d.text!=null){writeFileSync(join(dlDir,label+'-'+d.name),d.text);files.push({name:d.name,type:d.type,chars:d.text.length,sha256:sha(d.text),text:d.text,path:join(dlDir,label+'-'+d.name)});}return files;};
const setFiles=async(selector,files)=>{const o=await send('Runtime.evaluate',{expression:`document.querySelector(${JSON.stringify(selector)})`});await send('DOM.setFileInputFiles',{objectId:o.result.result.objectId,files});};
const setSel=(sel,v)=>ev(`const s=document.querySelector(${JSON.stringify(sel)});s.value=${JSON.stringify(v)};if(s.value!==${JSON.stringify(v)})throw Error('no option '+${JSON.stringify(v)}+' in '+${JSON.stringify(sel)});s.dispatchEvent(new Event('change',{bubbles:true}));return 1`);
const click=sel=>ev(`const b=document.querySelector(${JSON.stringify(sel)});if(!b)throw Error('missing '+${JSON.stringify(sel)});b.click();return 1`);
const ready=`document.querySelector('#case-insights [role=status]')&&/summary lines from the calculated case/.test(document.querySelector('#case-insights [role=status]').textContent)&&!document.getElementById('case-insights').hidden`;
const calcCase=async()=>{await wait("!document.getElementById('disposal-calculate').disabled");await click('#disposal-calculate');await wait(ready,90000);await sleep(500);};
const pageScroll=`const d=document.documentElement;return {innerWidth,scrollW:d.scrollWidth,clientW:d.clientWidth,pageHScroll:d.scrollWidth>d.clientWidth}`;
const csvFields=text=>{const lines=[];let row=[],cur='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}else if(ch==='"')q=true;else if(ch===','){row.push(cur);cur='';}else if(ch==='\r'&&text[i+1]==='\n'){}else if(ch==='\n'){row.push(cur);lines.push(row);row=[];cur='';}else cur+=ch;}if(cur||row.length){row.push(cur);lines.push(row);}return lines;};
// ---- #7 / #8 panel helpers (root #transient-buildup) ----
const PQ=`const P=document.getElementById('transient-buildup'),B=P.querySelector('.transient-buildup-section'),N=P.querySelector('.transient-nearby-section'),F=B.querySelector('form'),R=B.children[1],D=B.children[2];
 const NB=N.children[3],NF=NB.querySelector('form'),NR=NF.nextElementSibling.nextElementSibling,ND=NR.nextElementSibling;
 const K=k=>P.querySelector('[data-key="'+CSS.escape(k)+'"]');`;
const key=(k,v)=>ev(`${PQ}const i=K(${JSON.stringify(k)});if(!i)throw Error('no key '+${JSON.stringify(k)});i.value=${JSON.stringify(String(v))};i.dispatchEvent(new Event(i.tagName==='SELECT'?'change':'input',{bubbles:true}));if(i.type==='month')i.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,80));return 1`);
const clickKey=k=>ev(`${PQ}const i=K(${JSON.stringify(k)});if(!i)throw Error('no key '+${JSON.stringify(k)});i.click();await new Promise(r=>setTimeout(r,120));return 1`);
const hasKey=k=>ev(`${PQ}return !!K(${JSON.stringify(k)})`);
const panel=`${PQ}
 const txt=n=>n.textContent;
 const monthly=[...R.querySelectorAll('table')].find(t=>/a blocked month shows why/.test(t.caption?.textContent??''));
 const mrows=monthly?[...monthly.tBodies[0].rows].map(r=>[...r.cells].map(c=>({t:c.textContent,span:c.colSpan}))):[];
 const blocked=mrows.filter(r=>r.some(c=>c.span===4));
 return {hidden:P.hidden,status:txt(P.querySelector(':scope > p[role=status]')),
  wells:[...(K('well')?.options??[])].map(o=>o.value),well:K('well')?.value??null,boundary:K('boundary')?.value??null,
  exampleNote:(()=>{const n=B.querySelector('p.case-warning');return n&&!n.hidden?n.textContent:null;})(),
  calcDisabled:F.querySelector('button[type=submit]').disabled,
  errors:[...F.querySelector('ul[aria-label="Inputs still needed or refused"]').children].map(txt),
  rates:[...F.querySelectorAll('input[data-key^="rate."]')].map(i=>({month:i.dataset.key.slice(5),value:i.value,placeholder:i.placeholder,label:i.getAttribute('aria-label')})),
  setup:{start:K('start')?.value??null,count:K('count')?.value??null},
  originNote:[...F.querySelectorAll('p.small')].map(txt).find(t=>/^Forecast \\(copied|^Synthetic\\/assumed/.test(t))??null,
  results:{h4:[...R.querySelectorAll('h4')].map(txt),paras:[...R.querySelectorAll(':scope > p')].map(txt),svgs:R.querySelectorAll('svg').length,
   tables:[...R.querySelectorAll('table')].map(t=>({caption:t.caption?.textContent??'',rows:t.tBodies[0]?.rows.length??0})),
   monthlyRows:mrows.length,blockedRows:blocked.length,blockedTexts:[...new Set(blocked.map(r=>r.find(c=>c.span===4).t))],blockedCellCounts:[...new Set(blocked.map(r=>r.length))],
   warnings:[...R.querySelectorAll('h4')].filter(h=>h.textContent==='Warnings').map(h=>[...h.nextElementSibling.children].map(txt))[0]??[]},
  downloads:[...D.querySelectorAll('button')].map(b=>[b.textContent,b.disabled])};`;
const nearby=`${PQ}
 const txt=n=>n.textContent;
 const views=[...NR.querySelectorAll('h5')].map(h5=>{const box=h5.parentElement;const r=box.getBoundingClientRect();const tb=box.querySelector('table');
  return {title:txt(h5),rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width)],
   rows:tb?[...tb.tBodies[0].rows].map(r=>[...r.cells].map(txt)):null,
   paras:[...box.querySelectorAll(':scope > p')].map(txt),
   removal:[...box.querySelectorAll(':scope > ul.small')].filter(u=>!u.getAttribute('aria-label')).flatMap(u=>[...u.children].map(txt)),
   rowLabels:[...(box.querySelector('ul[aria-label^="Row labels"]')?.children??[])].map(txt),
   monthlyHeaders:[...(box.querySelector('details table thead tr')?.cells??[])].map(txt)};});
 return {setupShown:!N.children[2].hidden,setupText:txt(N.children[2]),bodyHidden:NB.hidden,
  loadError:txt(NB.querySelector('p[role=alert]')),
  packages:[...NB.querySelector('ul[aria-label="Loaded offset well packages"]').children].map(li=>li.firstChild.textContent.trim()),
  fieldsets:[...NF.querySelectorAll('fieldset > legend')].map(txt).filter(t=>t.startsWith('UIC')),
  radiosChecked:[...NF.querySelectorAll('input[type=radio]')].filter(r=>r.checked).map(r=>r.dataset.key),
  radios:[...NF.querySelectorAll('input[type=radio]')].map(r=>r.dataset.key),
  afterSelects:[...NF.querySelectorAll('select[data-key$=".after"]')].map(s=>[s.dataset.key,s.value,s.options[s.selectedIndex].text]),
  evidence:[...NF.querySelectorAll('ul[aria-label^="Evidence for UIC"]')].map(u=>[...u.children].map(txt)),
  gapInputs:Object.fromEntries([...NF.querySelectorAll('input[data-key*=".gap."]')].reduce((m,i)=>{const u=i.dataset.key.split('.')[1];m.set(u,(m.get(u)??0)+1);return m;},new Map())),
  notes:[...NF.querySelectorAll('p.small')].map(txt).filter(t=>/gap month|Ranking month used/.test(t)),
  errors:[...NF.querySelector('ul[aria-label^="Nearby wells inputs"]').children].map(txt),
  runDisabled:NF.querySelector('button[type=submit]').disabled,
  status:txt(NB.querySelector('p[role=status]')),
  results:{h4:[...NR.querySelectorAll('h4')].map(txt),paras:[...NR.querySelectorAll(':scope > p')].map(txt),labels:[...(NR.querySelector(':scope > ul.small')?.children??[])].map(txt),views,
   sensitivity:(()=>{const t=[...NR.querySelectorAll('table')].find(t=>/Added psi range per offset/.test(t.caption?.textContent??''));return t?[...t.tBodies[0].rows].map(r=>[...r.cells].map(txt)):null;})(),
   warnings:[...NR.querySelectorAll('h4')].filter(h=>h.textContent==='Warnings').map(h=>[...h.nextElementSibling.children].map(txt))[0]??[],
   closing:[...NR.querySelectorAll(':scope > p')].map(txt).at(-1)??null},
  downloads:[...ND.querySelectorAll('button')].map(b=>[b.textContent,b.disabled])};`;
const P=()=>ev(panel),Nb=()=>ev(nearby);
const calcBtn=`${PQ}return F.querySelector('button[type=submit]')`;
const calcReady=`(()=>{const P=document.getElementById('transient-buildup');const s=P.querySelector(':scope > p[role=status]').textContent;return /^Calculated from assumed rock/.test(s)})()`;
const calcPanel=async()=>{await wait(`(()=>{${calcBtn}})().disabled===false`,30000);await ev(`(()=>{${calcBtn}})().click();return 1`);await wait(`${calcReady}||(()=>{const P=document.getElementById('transient-buildup');return P.querySelector('form ul').children.length>0&&!/Calculating/.test(P.querySelector(':scope > p[role=status]').textContent)})()`,120000);await sleep(300);};
const nRunBtn=`${PQ}return NF.querySelector('button[type=submit]')`;
const runNearby=async()=>{await ev(`(()=>{${nRunBtn}})().click();return 1`);await wait(`(()=>{${PQ}const s=NB.querySelector('p[role=status]').textContent;return !/Running/.test(s)})()`,180000);await sleep(400);};
const scrollTo=sel=>ev(`const n=${sel};if(n)n.scrollIntoView({block:'start'});await new Promise(r=>setTimeout(r,250));return 1`);
const showPanel=()=>scrollTo(`document.getElementById('transient-buildup')`);
const showResults=()=>scrollTo(`document.querySelector('#transient-buildup .transient-buildup-section').children[1]`);
const showNearby=()=>scrollTo(`document.querySelector('#transient-buildup .transient-nearby-section')`);
const showNearbyResults=()=>scrollTo(`document.querySelector('#transient-buildup .transient-nearby-section form').nextElementSibling.nextElementSibling`);
/** Type text one character at a time into the focused field with real key input; report focus and value after each character. */
const typeInto=async(k,text)=>{await ev(`${PQ}const i=K(${JSON.stringify(k)});i.focus();i.select?.();return 1`);const trail=[];
 for(const ch of text){await send('Input.insertText',{text:ch});await sleep(120);trail.push(await ev(`const a=document.activeElement;return {key:a?.dataset?.key??a?.tagName,value:a?.value??null}`));}
 return trail;};
const nFile='#transient-buildup .transient-nearby-section input[type=file]';
const A='FICTIONAL-INJ-A',U1='000000417',U2='000000418';
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
// E05 summary lines and E10 Wells compared rows, for the main-branch comparison.
const e05e10=`const ci=document.getElementById('case-insights');const lines=[...ci.querySelectorAll(':scope > div > details')].map(d=>d.querySelector('summary').textContent);
 const cs=[...ci.querySelectorAll(':scope > section')].find(s=>s.querySelector('h4')?.textContent==='Wells compared');
 const rows=cs?[...cs.querySelectorAll('table tbody tr')].map(tr=>[...tr.cells].map(c=>c.textContent).join(' | ')):[];
 return {lines,rows,status:ci.querySelector('[role=status]').textContent}`;
const hashE=async()=>{const x=await ev(e05e10);return {status:redact(x.status),summaryLineCount:x.lines.length,summaryLinesSha256:x.lines.map(l=>sha(l)),summaryLinesRedacted:x.lines.map(redact),wellsComparedRowsSha256:x.rows.map(r=>sha(r)),wellsComparedRowsRedacted:x.rows.map(redact)};};
const dlBtn=(section,idx)=>ev(`${PQ}(${section==='n'?'ND':'D'}).querySelectorAll('button')[${idx}].click();return 1`);
const {verifyTransient,transientJson,transientCsv,CLOSING_7:C7X}=await import(pathToFileURL(join(appDir,'dist/transientExport.js')).href).then(async m=>({...m,...(await import(pathToFileURL(join(appDir,'dist/transientCase.js')).href))}));
const {CLOSING_8}=await import(pathToFileURL(join(appDir,'dist/interference.js')).href);
const {CLOSING_7,GUARD_TOO_SHORT,HANDOFF_NOTE}=await import(pathToFileURL(join(appDir,'dist/transientCase.js')).href);
const checkDownload=async(file)=>{
 if(file.name.endsWith('.json')){const s=JSON.parse(file.text);let v;try{await verifyTransient(structuredClone(s));v={ok:true};}catch(e){v={ok:false,error:String(e.message).slice(0,200)};}
  return {name:file.name,chars:file.chars,sha256:file.sha256,topKeys:Object.keys(s),interference:s.interference!=null||s.result?.interference!=null||JSON.stringify(Object.keys(s)).includes('interference')?(s.interference===null?'null':'present'):'absent',nodeVerify:v,hasClosing7:file.text.includes(CLOSING_7),hasClosing8:file.text.includes(CLOSING_8)};}
 const rows=csvFields(file.text);const counts=[...new Set(rows.map(r=>r.length))];
 return {name:file.name,chars:file.chars,sha256:file.sha256,lines:rows.length,fieldCountsPerLine:counts,allFour:counts.length===1&&counts[0]===4,hasClosing7:rows.some(r=>r.includes(CLOSING_7)),hasClosing8:rows.some(r=>r.includes(CLOSING_8)),lastLines:rows.slice(-3).map(r=>r.join(' | ').slice(0,200))};
};
const download=async(section,idx,label)=>{await dlBtn(section,idx);await wait('window.__dl.length>0',120000);await sleep(300);const f=(await flush(label))[0];return checkDownload(f);};
const fakeCase=async()=>ev(`const {buildDisposalCase}=await import('/dist/disposalCase.js');
 const W={id:'FICTIONAL-GAP-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
 const input={caseName:'Fictional gap-month case (QA)',demand:{id:'synthetic-demand/qa',origin:'synthetic',content:'fictional',monthly:[{month:'2028-01',demandBbl:60000},{month:'2028-02',demandBbl:90000},{month:'2028-04',demandBbl:30000}],evidence:{fixture:'fictional'}},
  wells:[W,{...W,id:'FICTIONAL-GAP-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-GAP-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}};
 const result=buildDisposalCase(input);document.dispatchEvent(new CustomEvent('disposal-case-result',{detail:{result,contentSha256:'qa'}}));await new Promise(r=>setTimeout(r,500));return 1`);
try{
await send('Page.navigate',{url:base});
await wait("document.readyState==='complete'&&document.getElementById('sample-load')");await sleep(1200);
if(mode==='full'){
// ---- 0. no case ----
rec('s0_noCase',await ev(`const P=document.getElementById('transient-buildup');return {hidden:P.hidden,status:P.querySelector(':scope > p[role=status]').textContent}`));
// ---- 1. user case, well A, example, closed, copy forecast ----
rec('setup',await loadUserCase());
await calcUser();
const p1a=await P(),n1a=await Nb();
rec('s1_afterCase',{hidden:p1a.hidden,status:p1a.status,wells:p1a.wells,well:p1a.well,exampleNote:p1a.exampleNote,calcDisabled:p1a.calcDisabled,errors:p1a.errors,rateRows:p1a.rates.length,nearbySetupShown:n1a.setupShown,nearbySetupText:n1a.setupText,nearbyBodyHidden:n1a.bodyHidden});
await showPanel();await shot('s1-panel-empty');
await key('well',A);await clickKey('example');
const p1b=await P();
await clickKey('copy');
const p1c=await P();
rec('s1_copy',{well:p1c.well,boundary:p1b.boundary,exampleNote:p1b.exampleNote,originNote:p1c.originNote,months:p1c.rates.map(r=>r.month),firstMonth:p1c.rates[0]?.month,lastMonth:p1c.rates.at(-1)?.month,emptyRates:p1c.rates.filter(r=>r.value==='').map(r=>r.label),missingPlaceholders:p1c.rates.filter(r=>r.placeholder==='required').length,calcDisabled:p1c.calcDisabled,errors:p1c.errors,setup:p1c.setup});
await key('profile.0',p1c.rates[0].month);await key('profile.1',p1c.rates[Math.floor(p1c.rates.length/2)].month);await key('profile.2',p1c.rates.at(-1).month);
await calcPanel();
const p1d=await P();
rec('s1_result',{status:p1d.status,errors:p1d.errors,h4:p1d.results.h4,paras:p1d.results.paras,svgs:p1d.results.svgs,tables:p1d.results.tables,monthlyRows:p1d.results.monthlyRows,blockedRows:p1d.results.blockedRows,warnings:p1d.results.warnings,downloads:p1d.downloads,
 checks:{limitLine:p1d.results.paras.find(t=>t.startsWith('First month at the limit:'))??null,skinLine:p1d.results.paras.find(t=>t.startsWith('of which skin'))??null,profileTables:p1d.results.tables.filter(t=>/rise above initial; excludes skin/.test(t.caption)).length,
  avgRise:p1d.results.h4.includes('Average pressure rise (closed boundary; excludes skin)'),handoffLine:p1d.results.paras.find(t=>t.startsWith('Average rise at month'))??null,handoffNote:p1d.results.paras.includes(HANDOFF_NOTE),closing:p1d.results.paras.includes(CLOSING_7)}});
await showResults();await shot('s1-result');
// #7 downloads of this result
const d7j=await download('b',0,'s6-transient'),d7c=await download('b',1,'s6-transient');
rec('s6_transient',{json:d7j,csv:d7c});
// ---- 3. edits, focus and M1 ----
const typed=await typeInto('rate.'+p1c.rates[1].month,'1234');
const p3a=await P();
rec('s3_editWithdraws',{typingTrail:typed,focusKept:typed.every(x=>x.key==='rate.'+p1c.rates[1].month),finalValue:typed.at(-1).value,resultsAfterEdit:p3a.results.h4.length,downloadsAfterEdit:p3a.downloads,status:p3a.status,originNote:p3a.originNote});
// k typing keeps focus too
const typedK=await typeInto('rock.k','50.5');
// M1: a refused set-up click during a running calculation does not cancel it
await key('start','');await key('count','');
await key('rock.k','50');await key('rate.'+p1c.rates[1].month,p1c.rates[2].value||'1000');
const m1=await ev(`${PQ}F.querySelector('button[type=submit]').click();const during=P.querySelector(':scope > p[role=status]').textContent;K('setup').click();const after=[...F.querySelector('ul').children].map(n=>n.textContent);return {during,after}`);
await wait(`${calcReady}||/replaced|could not/.test(document.querySelector('#transient-buildup form ul').textContent)`,120000);await sleep(300);
const p3m=await P();
rec('s3_M1',{typingKTrail:typedK,kFocusKept:typedK.every(x=>x.key==='rock.k'),statusAtClick:m1.during,errorsRightAfterRefusedSetup:m1.after,finalStatus:p3m.status,finalErrors:p3m.errors,resultShown:p3m.results.h4.length>0,replacedError:p3m.errors.some(e=>/replaced/i.test(e))});
await showPanel();await shot('s3-m1-refused-setup');
// ---- 4. nearby wells ----
await showNearby();
await setFiles(nFile,[win(join(scratch,'pkg-417.tar')),win(join(scratch,'pkg-418.tar'))]);
await wait(`document.querySelectorAll('#transient-buildup ul[aria-label="Loaded offset well packages"] li button').length>=2`,30000);await sleep(400);
const n4a=await Nb();
rec('s4_loaded',{packages:n4a.packages.map(p=>p.replace(/·\s*rrc-\S+/,'· <artifactId>')),loadError:n4a.loadError,fieldsets:n4a.fieldsets,radios:n4a.radios,radiosChecked:n4a.radiosChecked,afterSelects:n4a.afterSelects,evidence:n4a.evidence,gapInputs:n4a.gapInputs,notes:n4a.notes,runDisabled:n4a.runDisabled,errors:n4a.errors});
await shot('s4-packages-loaded');
const distTrail=await typeInto(`n.${U1}.distanceFt`,'1000');
await key(`n.${U2}.distanceFt`,'3000');
const n4b=await Nb();
rec('s4_refusedBeforeConnected',{distanceTrail:distTrail.map(x=>x.key),focusKept:distTrail.every(x=>x.key===`n.${U1}.distanceFt`),runDisabled:n4b.runDisabled,errors:n4b.errors,evidence:n4b.evidence});
// 417 connected, 418 not connected, zero question answered for 418, gaps unfilled
await clickKey(`n.${U1}.connected.true`);await clickKey(`n.${U2}.connected.false`);
if(await hasKey(`n.${U2}.zeros.true`))await clickKey(`n.${U2}.zeros.true`);
const n4c0=await Nb();
for(const u of [U1,U2])if(n4c0.errors.some(e=>e.includes(u)&&/after/i.test(e)))await key(`n.${u}.after`,'shut-in');
const n4c1=await Nb();
await runNearby();
const n4c=await Nb();
rec('s4_incomplete',{radiosChecked:n4c0.radiosChecked,gapInputsAfterZeros:n4c0.gapInputs,notes:n4c0.notes,errorsBeforeRun:n4c1.errors,runDisabledBeforeRun:n4c1.runDisabled,status:n4c.status,errors:n4c.errors,views:n4c.results.views.map(v=>({title:v.title,rows:v.rows,paras:v.paras,rowLabels:v.rowLabels})),labels:n4c.results.labels,warnings:n4c.results.warnings,downloads:n4c.downloads});
await showNearbyResults();await shot('s4-incomplete');
// Fill all gaps for both wells; 418 connected; zero months shut in
for(const u of [U1,U2]){const keys=await ev(`${PQ}return [...NF.querySelectorAll('input[data-key^="n.${u}.gap."]')].map(i=>i.dataset.key)`);for(const k of keys)await key(k,'400');}
await clickKey(`n.${U2}.connected.true`);
const n4d0=await Nb();
for(const u of [U1,U2])if(n4d0.errors.some(e=>e.includes(u)&&/after/i.test(e)))await key(`n.${u}.after`,'shut-in');
await runNearby();
const n4d=await Nb();
rec('s4_complete',{notes:n4d0.notes,errorsBeforeRun:n4d0.errors,status:n4d.status,errors:n4d.errors,h4:n4d.results.h4,labels:n4d.results.labels,paras:n4d.results.paras,views:n4d.results.views.map(v=>({title:v.title,rect:v.rect,rows:v.rows,paras:v.paras,removal:v.removal,monthlyHeaders:v.monthlyHeaders})),threeViewsWithTables:n4d.results.views.length===3&&n4d.results.views.every(v=>v.rows&&v.rows.length>0),warnings:n4d.results.warnings,closing:n4d.results.closing,closingOk:n4d.results.closing===CLOSING_8,downloads:n4d.downloads,scroll:await ev(pageScroll)});
await showNearbyResults();await shot('s4-three-views');
// Gaps filled, 417 connected, 418 not connected: the three views differ
await clickKey(`n.${U2}.connected.false`);
await runNearby();
const n4e=await Nb();
rec('s4_mixed',{radiosChecked:n4e.radiosChecked,status:n4e.status,errors:n4e.errors,views:n4e.results.views.map(v=>({title:v.title,rows:v.rows,paras:v.paras,rowLabels:v.rowLabels})),threeViewsWithTables:n4e.results.views.length===3&&n4e.results.views.every(v=>v.rows&&v.rows.length>0)});
await showNearbyResults();await shot('s4-mixed-selection');
await clickKey(`n.${U2}.connected.true`);
// ---- 5. t_ref = the month before the subject schedule starts ----
const first=p1c.rates[0].month,[yy,mm]=first.split('-').map(Number),tref=mm===1?`${yy-1}-12`:`${yy}-${String(mm-1).padStart(2,'0')}`;
await key('n.tref',tref);
const n5a0=await Nb();
for(const u of [U1,U2])if(n5a0.errors.some(e=>e.includes(u)&&/after/i.test(e)))await key(`n.${u}.after`,'shut-in');
// Sensitivity: k low/high and one distance pair, so the table and "order not distinguishable" can show
await key('n.sens.k.low','25');await key('n.sens.k.high','100');await key(`n.${U1}.sensLow`,'500');await key(`n.${U1}.sensHigh`,'2000');
await runNearby();
const n5n=await Nb();
rec('s5_withTrefNoAfterChoice',{status:n5n.status,errors:n5n.errors,views:n5n.results.views.map(v=>({title:v.title,limit:v.paras.find(p=>p.startsWith('First month at the limit'))??null,removal:v.removal})),warnings:n5n.results.warnings});
await showNearbyResults();await shot('s5-tref-no-after-choice');
for(const u of [U1,U2])await key(`n.${u}.after`,'shut-in');
const n5a1=await Nb();
await runNearby();
const n5a=await Nb();
rec('s5_withTref',{afterSelects:n5a1.afterSelects,rows:n5a.results.views.map(v=>v.rows),tref,errorsBeforeRun:n5a1.errors,status:n5a.status,errors:n5a.errors,paras:n5a.results.paras,labels:n5a.results.labels,views:n5a.results.views.map(v=>({title:v.title,limit:v.paras.find(p=>p.startsWith('First month at the limit'))??null,removal:v.removal,monthlyHeaders:v.monthlyHeaders,total:v.paras.find(p=>p.startsWith('Total'))??null})),sensitivity:n5a.results.sensitivity,indistinguishable:n5a.results.h4,warnings:n5a.results.warnings,downloads:n5a.downloads});
await showNearbyResults();await shot('s5-with-tref');
// Interference downloads (with t_ref and sensitivity)
const dIj=await download('n',0,'s6-interference'),dIc=await download('n',1,'s6-interference');
rec('s6_interference',{json:dIj,csv:dIc});
// Wrong t_ref: refused with the core message
await key('n.tref',first);
const n5w=await Nb();
await runNearby();
const n5w2=await Nb();
rec('s5_wrongTref',{runDisabled:n5w.runDisabled,errorsBefore:n5w.errors,errorsAfterRun:n5w2.errors,status:n5w2.status,hasResults:n5w2.results.views.length});
// Without t_ref
await key('n.tref','');
await runNearby();
const n5b=await Nb();
rec('s5_withoutTref',{status:n5b.status,labels:n5b.results.labels,paras:n5b.results.paras,views:n5b.results.views.map(v=>({title:v.title,limit:v.paras.find(p=>p.startsWith('First month at the limit'))??null,removal:v.removal,monthlyHeaders:v.monthlyHeaders})),
 noLimit:n5b.results.views.every(v=>!v.paras.some(p=>p.startsWith('First month at the limit'))),noRemoval:n5b.results.views.every(v=>v.removal.length===0),noBottomhole:n5b.results.views.every(v=>!v.monthlyHeaders.some(x=>/Bottomhole/.test(x))),
 absoluteValuesText:JSON.stringify(n5b.results).match(/psia/g)?.length??0});
await showNearbyResults();await shot('s5-without-tref');
// Nearby edit withdraws only the screening; subject edit withdraws both
await key(`n.${U2}.distanceFt`,'3001');
const n3a=await Nb(),p3b=await P();
await key(`n.${U2}.distanceFt`,'3000');await runNearby();
await key('rock.h','101');
const n3b=await Nb(),p3c=await P();
rec('s3_nearbyWithdrawal',{afterOffsetEdit:{nearbyViews:n3a.results.views.length,nearbyDownloads:n3a.downloads,buildupResult:p3b.results.h4.length>0},afterSubjectEdit:{nearbyViews:n3b.results.views.length,nearbyDownloads:n3b.downloads,buildupResult:p3c.results.h4.length,buildupDownloads:p3c.downloads}});
await key('rock.h','100');
rec('s9_afterNearby',await ev(pageScroll));
// ---- 2. low k (all months blocked) ----
await key('rock.k','0.01');await key('rock.cf','0.0001');await key('rock.phi','0.4');await key('rock.rw','2');
await calcPanel();
const p2=await P();
const numbersInBlocked=await ev(`${PQ}const t=[...R.querySelectorAll('table')].find(t=>/a blocked month shows why/.test(t.caption?.textContent??''));return t?[...t.tBodies[0].rows].filter(r=>[...r.cells].some(c=>c.colSpan===4)).map(r=>r.cells.length+':'+/\\d/.test([...r.cells].slice(1).map(c=>c.textContent).join(''))):[]`);
rec('s2_lowK',{status:p2.status,errors:p2.errors,h4:p2.results.h4,paras:p2.results.paras,tables:p2.results.tables,monthlyRows:p2.results.monthlyRows,blockedRows:p2.results.blockedRows,blockedTexts:p2.results.blockedTexts,blockedCellCounts:p2.results.blockedCellCounts,numbersInBlockedCells:numbersInBlocked,warnings:p2.results.warnings,svgPoints:await ev(`${PQ}return R.querySelectorAll('svg circle.point').length`),
 checks:{guardExact:p2.results.blockedTexts.length===1&&p2.results.blockedTexts[0]===GUARD_TOO_SHORT,limitLine:p2.results.paras.find(t=>t.startsWith('First month at the limit:'))??null,limitNotDetermined:/^First month at the limit: not determined: /.test(p2.results.paras.find(t=>t.startsWith('First month at the limit:'))??''),neverNotReached:!p2.results.paras.some(t=>/not reached/.test(t)),
  avgNotShown:p2.results.paras.find(t=>t.startsWith('Average pressure rise: not shown'))??null,noAvgTable:!p2.results.tables.some(t=>/Average rise above initial/.test(t.caption)),endLine:p2.results.paras.find(t=>t.startsWith('End of the schedule'))??null}});
await showResults();await shot('s2-low-k-all-blocked');
// ---- 1b. missing month in a copied forecast (fictional case event; no user-import path produces non-consecutive months) ----
await fakeCase();
const p1g0=await P();
await key('well','FICTIONAL-GAP-A');await clickKey('example');await clickKey('copy');
const p1g=await P();
let fillTrail=null;const miss=p1g.rates.find(r=>r.placeholder==='required');
if(miss)fillTrail=await typeInto('rate.'+miss.month,'0');
const p1h=await P();
await calcPanel();
const p1i=await P();
rec('s1b_missingMonth',{wells:p1g0.wells,months:p1g.rates.map(r=>[r.month,r.value,r.placeholder]),missingLabel:miss?.label??null,calcDisabledWhileMissing:p1g.calcDisabled,errorsWhileMissing:p1g.errors,afterFill:{calcDisabled:p1h.calcDisabled,errors:p1h.errors,trail:fillTrail},result:{status:p1i.status,limit:p1i.results.paras.find(t=>t.startsWith('First month at the limit:'))??null,monthlyRows:p1i.results.monthlyRows}});
await showPanel();await shot('s1b-missing-month');
// ---- 3b. M1 with a refused forecast copy: a fictional case whose well B has no Base allocations (dispatched event) ----
await ev(`const {buildDisposalCase}=await import('/dist/disposalCase.js');const P=document.getElementById('transient-buildup');
 const W={id:'FICTIONAL-GAP-A',reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
 const input={caseName:'Fictional gap-month case (QA)',demand:{id:'synthetic-demand/qa',origin:'synthetic',content:'fictional',monthly:[{month:'2028-01',demandBbl:60000},{month:'2028-02',demandBbl:90000},{month:'2028-04',demandBbl:30000}],evidence:{fixture:'fictional'}},
  wells:[W,{...W,id:'FICTIONAL-GAP-B',injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-GAP-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}};
 const result=buildDisposalCase(input);for(const m of result.base.monthly)m.allocations=m.allocations.filter(a=>a.wellId!=='FICTIONAL-GAP-B');
 document.dispatchEvent(new CustomEvent('disposal-case-result',{detail:{result,contentSha256:'qa-stripped'}}));await new Promise(r=>setTimeout(r,400));return 1`);
await key('well','FICTIONAL-GAP-B');await key('start','2028-01');await key('count','6');await clickKey('setup');
{const ms=(await P()).rates.map(r=>r.month);for(const m of ms)await key('rate.'+m,'3000');}
const m1c=await ev(`${PQ}F.querySelector('button[type=submit]').click();const during=P.querySelector(':scope > p[role=status]').textContent;K('copy').click();await new Promise(r=>setTimeout(r,50));const after=[...F.querySelector('ul').children].map(n=>n.textContent);return {during,after}`);
await wait(`${calcReady}||/replaced|could not/.test(document.querySelector('#transient-buildup form ul').textContent)`,120000);await sleep(300);
const p3c2=await P();
rec('s3_M1_refusedCopy',{statusAtClick:m1c.during,errorsRightAfterRefusedCopy:m1c.after,finalStatus:p3c2.status,finalErrors:p3c2.errors,resultShown:p3c2.results.h4.length>0,replacedError:p3c2.errors.some(e=>/replaced/i.test(e)),limit:p3c2.results.paras.find(t=>t.startsWith('First month at the limit:'))??null});
await showPanel();await shot('s3-m1-refused-copy');
}
// ---- 7. sample case ----
await ev(`document.getElementById('sample-load').click();return 1`);
await wait("/all 7 loading steps done/.test(document.getElementById('sample-banner-detail').textContent)",240000);
await nav('scenarios');await calcCase();
rec('s7_e05e10',await hashE());
const hasPanel=await ev(`return !!document.getElementById('transient-buildup')`);
if(hasPanel){
 const p7=await P();
 await clickKey('example');await clickKey('copy');
 const p7b=await P();
 await calcPanel();
 const p7c=await P();
 rec('s7_panel',{hidden:p7.hidden,wellCount:p7.wells.length,wellsRedacted:p7.wells.map(redact),copiedMonths:p7b.rates.length,emptyAfterCopy:p7b.rates.filter(r=>r.value==='').length,calcDisabled:p7b.calcDisabled,errors:p7b.errors.map(redact),status:p7c.status,resultH4:p7c.results.h4,limitRedacted:redact(p7c.results.paras.find(t=>t.startsWith('First month at the limit:'))??''),monthlyRows:p7c.results.monthlyRows,blockedRows:p7c.results.blockedRows,closing:p7c.results.paras.includes(CLOSING_7)});
 await showResults();await shot('s7-sample-panel');
 rec('s7_e05e10_afterPanel',await hashE());
}
// ---- 8/9 ----
rec('s9',await ev(pageScroll));
rec('s8',{consoleErrors});
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;results.consoleErrors=consoleErrors;try{results.fatalContext=await ev(`const P=document.getElementById('transient-buildup');return {status:P?.querySelector(':scope > p[role=status]')?.textContent,errors:P?.querySelector('form ul')?.textContent,imp:document.getElementById('import-status')?.textContent}`);console.log(JSON.stringify(results.fatalContext));await shot('fatal');}catch{}}
results.screenshots=shotHashes;
writeFileSync(mode==='full'?join(here,`results-${tag}.json`):join(scratch,`results-${mode}-${tag}-port${port}.json`),JSON.stringify(results,null,1)+'\n');
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
