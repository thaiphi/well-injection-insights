// Usage: node e0607-recheck.mjs <width> <height> <mobile 0|1> <tag> <scratchDir> [port]
// Recheck driver for the #7/#8 final fix wave (D1, D2, the "none" view wording, pre-run t_ref checks, the high-pressure block, CSV rows).
// Helpers are copied from e0607-check.mjs. <scratchDir> must hold pkg-417/418/419/420.tar (fictional; mkpkg.mjs, mkpkg-hi.mjs) and schedule.csv.
// Results are merged into results-recheck.json under the key <tag>. Fictional data only.
//
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
import {readFileSync,existsSync} from 'node:fs';
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const {NOT_COUNTED,EXCLUDED}=await import(pathToFileURL(join(appDir,'dist/interference.js')).href);
const csvKinds=text=>{const rows=csvFields(text);const by={};for(const r of rows)by[r[0]]=(by[r[0]]??0)+1;return by;};
const dlFull=async(section,idx,label)=>{await dlBtn(section,idx);await wait('window.__dl.length>0',120000);await sleep(300);const f=(await flush(label))[0];const c=await checkDownload(f);if(f.name.endsWith('.csv')){const k=csvKinds(f.text);c.rowKinds=k;c.inputsRows=k.inputs??0;c.offsetInputsRows=k['offset-inputs']??0;c.packagesRows=k.packages??0;delete c.lastLines;}return c;};
const nearbyMsgs=async()=>{const n=await Nb();return {errors:n.errors,status:n.status,runDisabled:n.runDisabled};};
const monthlyCells=`${PQ}return [...NR.querySelectorAll('h5')].map(h=>{const box=h.parentElement;const t=box.querySelector('details table');return {title:h.textContent,rows:t?[...t.tBodies[0].rows].map(r=>[...r.cells].map(c=>c.textContent)):[]};})`;
const bigNumbers=`${PQ}const t=NR.textContent;return (t.match(/[0-9][0-9,]*(\\.[0-9]+)?/g)??[]).map(s=>Number(s.replace(/,/g,''))).filter(v=>v>10000)`;
const out={chrome:results.chrome,viewport:results.viewport,localDateAtRun:localToday()};
const put=(k,v)=>{out[k]=v;console.log(k,JSON.stringify(v).slice(0,700));};
const loaded=`document.querySelectorAll('#transient-buildup ul[aria-label="Loaded offset well packages"] li button').length>=2`;
const gapKeys=u=>ev(`${PQ}return [...NF.querySelectorAll('input[data-key^="n.${u}.gap."]')].map(i=>i.dataset.key)`);
try{
// D2: run the page in a UTC-11 zone, so the local date differs from the UTC date for most of the day.
await send('Emulation.setTimezoneOverride',{timezoneId:'Pacific/Pago_Pago'});
await send('Page.navigate',{url:base});
await wait("document.readyState==='complete'&&document.getElementById('sample-load')");await sleep(1200);
// ---- user case, well A, example, copy: D2 ----
await loadUserCase();await calcUser();
await key('well',A);await clickKey('example');await clickKey('copy');
const p1=await P();
const copiedDate=(p1.originNote.match(/, (\d{4}-\d{2}-\d{2})\)/)??[])[1]??null;
const pld=await ev(`const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')`);put('d2_copyDate',{equalsPageLocal:copiedDate===pld,differsFromUtc:copiedDate!==new Date().toISOString().slice(0,10),originNote:p1.originNote,copiedDate,nodeLocalDate:localToday(),utcDate:new Date().toISOString().slice(0,10),pageLocalDate:await ev(`const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')`),timezone:'Pacific/Pago_Pago'});
await calcPanel();
const p1r=await P();
put('base_s1',{limit:p1r.results.paras.find(t=>t.startsWith('First month at the limit:'))??null,skin:p1r.results.paras.find(t=>t.startsWith('of which skin'))??null,labels:p1r.results.paras.find(t=>t.startsWith('Labels:'))??null});
// ---- nearby: both connected, gaps filled, zeros answered ----
await setFiles(nFile,[win(join(scratch,'pkg-417.tar')),win(join(scratch,'pkg-418.tar'))]);
await wait(loaded,30000);await sleep(400);
await key(`n.${U1}.distanceFt`,'1000');await key(`n.${U2}.distanceFt`,'3000');
await clickKey(`n.${U1}.connected.true`);await clickKey(`n.${U2}.connected.true`);await clickKey(`n.${U2}.zeros.true`);
for(const u of [U1,U2])for(const k of await gapKeys(u))await key(k,'400');
// item 4: pre-run t_ref checks
const first=p1.rates[0].month;
await key('n.tref',first);const pre1=await nearbyMsgs();
await showNearby();await shot('r-prerun-wrong-tref');
await key('n.tref','2025-12');await key('n.rank','2025-11');const pre2=await nearbyMsgs();
await key('n.rank','2025-12');const pre3=await nearbyMsgs();
await key('n.rank','');const pre4=await nearbyMsgs();
put('i4_preRun',{wrongTref:pre1,rankBeforeTref:pre2,rankEqualTref:pre3,cleared:pre4});
// D1: t_ref 2025-12, no after-window choice
await runNearby();
const d1=await Nb();
put('d1_noAfterChoice',{status:d1.status,errors:d1.errors,afterSelects:d1.afterSelects.map(a=>a[1]),views:d1.results.views.map(v=>({title:v.title,limit:v.paras.find(p=>p.startsWith('First month at the limit'))??null,removal:v.removal,notes:v.paras.filter(p=>p.startsWith('includes partial'))})),
 noNotFound:d1.results.views.every(v=>v.removal.every(x=>!/no limit month found/.test(x))),allRemovalNotDetermined:d1.results.views.filter(v=>v.removal.length).every(v=>v.removal.every(x=>/: not determined: /.test(x)))});
await showNearbyResults();await shot('r-d1-removal');
// item 3: 418 not connected; after = shut in
await clickKey(`n.${U2}.connected.false`);for(const u of [U1,U2])await key(`n.${u}.after`,'shut-in');
await runNearby();
const v3=await Nb();
const vr=Object.fromEntries(v3.results.views.map(v=>[v.title.split(':')[0],v.rows]));
const none=vr['No offsets (the subject well alone)']??[];
put('i3_views',{rows:vr,limits:v3.results.views.map(v=>[v.title,v.paras.find(p=>p.startsWith('First month at the limit'))??null,v.removal]),noneAllNotCounted:none.length>0&&none.every(r=>r[1]===NOT_COUNTED&&r[2]===NOT_COUNTED),noneHasNoExcluded:!none.some(r=>r.includes(EXCLUDED)),
 yourSelection418Excluded:(vr['Your selection (connected as you chose)']??[]).find(r=>r[0]===U2)?.[1]===EXCLUDED});
await showNearbyResults();await shot('r-i3-views');
// item 6: downloads
const t7j=await dlFull('b',0,'r-transient'),t7c=await dlFull('b',1,'r-transient');
const ij=await dlFull('n',0,'r-interference'),ic=await dlFull('n',1,'r-interference');
put('i6_downloads',{transientJson:t7j,transientCsv:t7c,interferenceJson:ij,interferenceCsv:ic});
// ---- item 5: high-pressure case (dispatched fictional case event; P_i 9,000, limit 9,900; mirrors the reviewer's probe1 inputs) ----
await ev(`const {buildDisposalCase}=await import('/dist/disposalCase.js');
 const W={id:'FICTIONAL-HP-A',reservoirPsia:9000,limitPsia:9900,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
 const months=[];for(let i=0;i<12;i++)months.push('2026-'+String(i+1).padStart(2,'0'));
 const result=buildDisposalCase({caseName:'Fictional high-pressure case (QA)',demand:{id:'synthetic-demand/qa-hp',origin:'synthetic',content:'fictional',monthly:months.map(month=>({month,demandBbl:3000})),evidence:{fixture:'fictional'}},wells:[W],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-HP-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}});
 document.dispatchEvent(new CustomEvent('disposal-case-result',{detail:{result,contentSha256:'qa-hp'}}));await new Promise(r=>setTimeout(r,500));return 1`);
for(const [k,v] of [['k',5],['h',20],['phi',0.15],['cf',0.000004],['rw',0.35],['skin',0]])await key('rock.'+k,v);
await key('boundary','infinite');await key('start','2026-01');await key('count','12');await clickKey('setup');
for(const m of (await P()).rates.map(r=>r.month))await key('rate.'+m,'100');
await calcPanel();
const hp7=await P();
const removeIds=await ev(`${PQ}return [...NB.querySelectorAll('ul[aria-label="Loaded offset well packages"] li button')].map(b=>b.getAttribute('aria-label'))`);
for(const label of removeIds)await ev(`${PQ}[...NB.querySelectorAll('ul[aria-label="Loaded offset well packages"] li button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)})?.click();await new Promise(r=>setTimeout(r,200));return 1`);
await setFiles(nFile,[win(join(scratch,'pkg-419.tar')),win(join(scratch,'pkg-420.tar'))]);
await wait(loaded,30000);await sleep(400);
const H1='000000419',H2='000000420';
await key(`n.${H1}.distanceFt`,'500');await key(`n.${H2}.distanceFt`,'3000');
await clickKey(`n.${H1}.connected.true`);await clickKey(`n.${H2}.connected.true`);
for(const [u,rate] of [[H1,'12000'],[H2,'1000']]){for(const k of await gapKeys(u))await key(k,rate);await key(`n.${u}.after`,'shut-in');}
await key('n.tref','2025-12');
const hpPre=await Nb();
await runNearby();
const hp=await Nb();
await ev(`${PQ}NR.querySelectorAll('details').forEach(d=>d.open=true);return 1`);
const cells=await ev(monthlyCells);
put('i5_highPressure',{subject:{status:hp7.status,limit:hp7.results.paras.find(t=>t.startsWith('First month at the limit:'))??null},packages:hpPre.packages.map(p=>p.replace(/·\s*rrc-\S+/,'· <artifactId>')),errorsBeforeRun:hpPre.errors,status:hp.status,errors:hp.errors,
 views:hp.results.views.map(v=>({title:v.title,limit:v.paras.find(p=>p.startsWith('First month at the limit'))??null,removal:v.removal})),monthly:cells,
 blockedCellText:[...new Set(cells.flatMap(v=>v.rows.map(r=>r.at(-1)).filter(x=>/^not shown/.test(x))))],bottomholeNumericMax:Math.max(...cells.flatMap(v=>v.rows.map(r=>r.at(-1)).filter(x=>/^[0-9,.]+$/.test(x)).map(x=>Number(x.replace(/,/g,''))))),
 firstBlockedMonthByView:cells.map(v=>[v.title,v.rows.find(r=>/^not shown/.test(r.at(-1)))?.[0]??null]),
 risesShownInBlockedMonths:cells.map(v=>[v.title,v.rows.filter(r=>/^not shown/.test(r.at(-1))&&/[0-9]/.test(r[1]+r[2])).length]),warnings:hp.results.warnings});
await showNearbyResults();await ev(`${PQ}NR.querySelector('details')?.scrollIntoView({block:'start'});return 1`);await sleep(250);await shot('r-i5-high-pressure');
put('i8_console',{consoleErrors});put('i8_scroll',await ev(pageScroll));
}catch(e){console.log('FATAL',e.message);out.fatal=e.message;out.consoleErrors=consoleErrors;try{await shot('r-fatal');}catch{}}
out.screenshots=shotHashes;
const file=join(here,'results-recheck.json');const all=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};all[tag]=out;
writeFileSync(file,JSON.stringify(all,null,1)+'\n');
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
