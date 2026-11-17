// Usage: node e11-check.mjs <width> <height> <mobile 0|1> <tag> <scratchDir> [port]
// CDP driver for E11 (#10): "Depth view (review aid)" panel in the disposal case.
// <scratchDir> (outside the repo) must hold schedule.csv, user-profile.csv and bad-profile.csv (hand-written, fictional).
// Downloads and screenshots go to <scratchDir>/dl/<tag> and <scratchDir>/shots. Records statuses, counts and hashes only.
import {writeFileSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const appDir=resolve(here,'../../swd-injection-analytics');
const [w='1280',h='900',mobile='0',tag='desktop',scratch,port='4174']=process.argv.slice(2);
if(!scratch)throw Error('scratchDir required');
const dlDir=join(scratch,'dl',tag),shotDir=join(scratch,'shots');mkdirSync(dlDir,{recursive:true});mkdirSync(shotDir,{recursive:true});
const base=`http://127.0.0.1:${port}/`;
const sha=b=>createHash('sha256').update(b).digest('hex');
const win=p=>p.replaceAll('/','\\');
const {verifyDepth,verifyDepthSvg}=await import(pathToFileURL(join(appDir,'dist/depthContextExport.js')).href);
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
const results={chrome:(await (await fetch('http://127.0.0.1:9333/json/version')).json()).Browser,viewport:[+w,+h,mobile],port};
const checks={};const check=(k,ok,detail)=>{checks[k]={ok:!!ok,detail};console.log('CHECK',k,ok?'PASS':'FAIL',detail===undefined?'':JSON.stringify(detail).slice(0,300));};
const rec=(k,v)=>{results[k]=v;console.log(k,JSON.stringify(v).slice(0,500));};
const nav=view=>ev(`const n=await import('/navigation.mjs');history.pushState(null,'',n.routeFor('${view}'));dispatchEvent(new PopStateEvent('popstate'));await new Promise(r=>setTimeout(r,800));return 1;`);
const flush=async label=>{const out=await ev(`const o=[];for(const d of window.__dl){o.push({name:d.name,type:d.type,text:await d.p});}window.__dl=[];return o;`);const files=[];for(const d of out)if(d.text!=null){writeFileSync(join(dlDir,label+'-'+d.name),d.text);files.push({name:d.name,type:d.type,chars:d.text.length,sha256:sha(d.text),text:d.text});}return files;};
const setFiles=async(selector,files)=>{const o=await send('Runtime.evaluate',{expression:`document.querySelector(${JSON.stringify(selector)})`});await send('DOM.setFileInputFiles',{objectId:o.result.result.objectId,files});};
const setSel=(sel,v)=>ev(`const s=document.querySelector(${JSON.stringify(sel)});s.value=${JSON.stringify(v)};if(s.value!==${JSON.stringify(v)})throw Error('no option '+${JSON.stringify(v)}+' in '+${JSON.stringify(sel)});s.dispatchEvent(new Event('change',{bubbles:true}));return 1`);
const click=sel=>ev(`const b=document.querySelector(${JSON.stringify(sel)});if(!b)throw Error('missing '+${JSON.stringify(sel)});b.click();return 1`);
const setInput=(sel,v)=>ev(`const s=document.querySelector(${JSON.stringify(sel)});if(!s)throw Error('missing '+${JSON.stringify(sel)});s.value=${JSON.stringify(String(v))};s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));return 1`);
const ready=`document.querySelector('#case-insights [role=status]')&&/summary lines from the calculated case/.test(document.querySelector('#case-insights [role=status]').textContent)&&!document.getElementById('case-insights').hidden`;
const calcCase=async()=>{await wait("!document.getElementById('disposal-calculate').disabled");await click('#disposal-calculate');await wait(ready,90000);await sleep(500);};
const csvFields=text=>{const lines=[];let row=[],cur='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}else if(ch==='"')q=true;else if(ch===','){row.push(cur);cur='';}else if(ch==='\n'){row.push(cur);lines.push(row);row=[];cur='';}else cur+=ch;}if(cur||row.length){row.push(cur);lines.push(row);}return lines;};
const A='FICTIONAL-INJ-A',B='FICTIONAL-INJ-B';
const DP='#depth-context';
// ---- depth panel readout (counts, statuses, reasons; no per-month values) ----
const panel=`const p=document.getElementById('depth-context');if(!p)return {present:false};
 const q=s=>[...p.querySelectorAll(s)];
 const text=n=>n.textContent.trim();
 const svg=p.querySelector('.depth-svg svg');
 const wrap=p.querySelector('.depth-svg');
 let axis=null;
 if(svg){const ts=[...svg.querySelectorAll('g.depth-axis text')].filter(x=>/^[0-9.]+$/.test(x.textContent.trim()));
  if(ts.length>1){const a=ts[0],b=ts[ts.length-1];const ya=+a.getAttribute('y')-3,yb=+b.getAttribute('y')-3,da=+a.textContent,db=+b.textContent;axis={y0:ya,d0:da,k:(db-da)/(yb-ya)};}}
 const depthAt=y=>axis?axis.d0+(y-axis.y0)*axis.k:null;
 const tracks=svg?[...svg.querySelectorAll('g[data-well]')].map(g=>{const c=g.querySelector('polyline.curve');let cv=null;
   if(c){const pts=c.getAttribute('points').split(' ').map(s=>s.split(',').map(Number));cv={nodes:pts.length,dashed:c.getAttribute('stroke-dasharray'),stroke:c.getAttribute('stroke'),model:c.getAttribute('data-model'),topFt:depthAt(pts[0][1]),bottomFt:depthAt(pts[pts.length-1][1])};}
   const lim=g.querySelector('polygon.limit');
   return {well:g.getAttribute('data-well'),casing:g.querySelectorAll('.casing').length,packer:g.querySelectorAll('.packer').length,permitted:g.querySelectorAll('.permitted-interval').length,perforated:g.querySelectorAll('.perforated-interval').length,formationTop:g.querySelectorAll('.formation-top').length,formationBand:g.querySelectorAll('.formation-band').length,testPoint:g.querySelectorAll('.test-point').length,curve:cv,limitMarker:!!lim,limitDepthFt:lim?depthAt([...lim.getAttribute('points').split(' ')][1].split(',')[1]*1):null};}):[];
 const secs=q(':scope > section, section').filter(s=>s.querySelector(':scope > h4')&&s.querySelector('ul[aria-label^="Gaps for"]'));
 const sections=secs.map(s=>({well:text(s.querySelector('h4')),gapsHeading:text(s.querySelector('ul[aria-label^="Gaps for"]').previousElementSibling),gaps:[...s.querySelectorAll('ul[aria-label^="Gaps for"] li')].map(text),notes:[...s.querySelectorAll(':scope > ul.small:not([aria-label])')].flatMap(u=>[...u.querySelectorAll('li')].map(text)),rowDetails:s.querySelectorAll(':scope > details').length}));
 const btn=l=>[...p.querySelectorAll('.import-actions button')].find(b=>b.textContent.includes(l));
 const ex=[...p.querySelectorAll('button')].find(b=>b.textContent==='Load fictional example');
 const clr=[...p.querySelectorAll('button')].find(b=>b.textContent==='Clear profile');
 return {present:true,hidden:p.hidden,visible:p.offsetParent!==null,status:text(p.querySelector('[role=status]')),
  svgs:q('.depth-svg svg').length,svgW:svg?+svg.getAttribute('width'):null,wrapper:wrap?{scrollW:wrap.scrollWidth,clientW:wrap.clientWidth,overflowX:getComputedStyle(wrap).overflowX}:null,axisBasisLabel:svg?[...svg.querySelectorAll('g.depth-axis text')].map(text).find(x=>/depth below/.test(x))??null:null,
  tracks,sections,
  problems:[...p.querySelectorAll('ul[aria-label="Profile rows refused"] li')].map(text),dropped:[...p.querySelectorAll('ul[aria-label="Dropped profile rows"] li')].map(text),
  checkedWells:[...p.querySelectorAll('fieldset input[type=checkbox]')].filter(i=>i.checked).map(i=>i.value),wellBoxes:[...p.querySelectorAll('fieldset input[type=checkbox]')].map(i=>i.value),
  basis:[...p.querySelectorAll('input[name=depth-basis]')].filter(i=>i.checked).map(i=>i.value),
  scenario:p.querySelector('select').value,month:p.querySelectorAll('select')[1]?.value??null,
  buttons:{json:btn('JSON').disabled,csv:btn('CSV').disabled,svg:btn('SVG').disabled,example:ex?ex.disabled:null,exampleTitle:ex?ex.title:null,clear:clr?clr.disabled:null},
  exampleNote:text(ex.nextElementSibling),
  reviewAid:[...p.querySelectorAll('p.small')].map(text).find(x=>/Review aid/.test(x))??null,
  legend:svg?[...svg.querySelectorAll('g.legend text')].map(text):[],
  testDateNote:[...p.querySelectorAll('p.small')].map(text).find(x=>/test dates/i.test(x))??null,
  curveDetails:[...p.querySelectorAll('details')].filter(d=>/modelled curve detail/.test(d.querySelector('summary').textContent)).length};`;
const rd=()=>ev(panel);
const showPanel=async()=>{await ev(`document.getElementById('depth-context').scrollIntoView({block:'start'});return 1`);await sleep(300);};
const tick=(wells)=>ev(`const p=document.getElementById('depth-context');for(const i of p.querySelectorAll('fieldset input[type=checkbox]')){const want=${JSON.stringify(wells)}.includes(i.value);if(i.checked!==want){i.checked=want;i.dispatchEvent(new Event('change',{bubbles:true}));}}return 1`);
const radio=b=>ev(`const i=document.querySelector('#depth-context input[name=depth-basis][value=${b}]');i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));return 1`);
const drawBtn=()=>ev(`[...document.querySelectorAll('#depth-context button')].find(b=>b.textContent==='Draw').click();return 1`);
const selIn=(idx,v)=>ev(`const s=document.querySelectorAll('#depth-context select')[${idx}];s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change',{bubbles:true}));return s.value`);
const dlBtn=async(label)=>{await ev(`[...document.querySelectorAll('#depth-context .import-actions button')].find(b=>b.textContent.includes(${JSON.stringify(label)})).click();return 1`);await wait('window.__dl.length>0',30000);await sleep(300);return (await flush('dl'))[0];};
const wellField=(idx,field,v)=>setInput(`#disposal-wells [data-well="${idx}"][data-field="${field}"]`,v);
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
const gotoScen=async()=>{await nav('scenarios');await wait("document.getElementById('disposal-workspace')&&!document.getElementById('disposal-workspace').hidden");};
const calcDisposal=async()=>{await gotoScen();await wait("!document.getElementById('disposal-illustrative').disabled",30000);await click('#disposal-illustrative');await sleep(300);await calcCase();};
// Export all three formats from the shown drawing and verify each with the app's own verifiers.
const doExports=async(label)=>{
 const out={};
 const json=await dlBtn('JSON'),csv=await dlBtn('CSV'),svg=await dlBtn('SVG');
 let jv,sv;
 try{const sealed=JSON.parse(json.text);const v=await verifyDepth(sealed);jv={ok:true,schema:sealed.schema,keys:Object.keys(sealed),contentSha256:sealed.contentSha256,verifiedHashMatches:v.contentSha256===sealed.contentSha256};}catch(e){jv={ok:false,error:String(e.message).slice(0,300)};}
 let svgSha=null;
 try{const v=await verifyDepthSvg(svg.text);svgSha=v.contentSha256;sv={ok:true,contentSha256:v.contentSha256};}catch(e){sv={ok:false,error:String(e.message).slice(0,300)};}
 const rows=csvFields(csv.text);const counts=[...new Set(rows.map(r=>r.length))];
 out[label]={json:{name:json.name,type:json.type,chars:json.chars,sha256:json.sha256,verify:jv},svg:{name:svg.name,type:svg.type,chars:svg.chars,sha256:svg.sha256,verify:sv,sameContentShaAsJson:svgSha!==null&&svgSha===jv.contentSha256},
  csv:{name:csv.name,type:csv.type,chars:csv.chars,sha256:csv.sha256,lines:rows.length,fieldCountsPerLine:counts,allFour:counts.length===1&&counts[0]===4},
  filenamesShareHash:[json.name,csv.name,svg.name].map(n=>n.replace(/^swd-depth-context-/,'').split('.')[0]).every((x,i,a)=>x===a[0])};
 return out[label];
};
try{
await send('Page.navigate',{url:base});
await wait("document.readyState==='complete'&&document.getElementById('sample-load')");await sleep(1200);
// ================= demo case =================
await click('#source-demo');await sleep(1500);
check('0_panel_hidden_before_result',(await rd()).hidden===true,(await rd()).hidden);
await calcDisposal();
let p0=await rd();
rec('s0_afterCalc',{hidden:p0.hidden,visible:p0.visible,status:p0.status,wellBoxes:p0.wellBoxes,example:p0.buttons,exampleNote:p0.exampleNote,reviewAid:p0.reviewAid,checkedWells:p0.checkedWells,basis:p0.basis});
check('0_panel_shown_nothing_preselected',p0.visible&&p0.checkedWells.length===0&&p0.basis.length===0&&p0.wellBoxes.includes(A)&&p0.wellBoxes.includes(B),{checked:p0.checkedWells,basis:p0.basis});
const placedOrder=await ev(`const p=document.getElementById('depth-context'),tb=document.getElementById('transient-buildup');return tb?tb.nextElementSibling===p:null`);
check('0_panel_directly_after_transient_buildup',placedOrder===true,placedOrder);
// ---- S1 ----
await click_(); async function click_(){await ev(`[...document.querySelectorAll('#depth-context button')].find(b=>b.textContent==='Load fictional example').click();return 1`);await sleep(300);}
let p1=await rd();
rec('s1_loaded',{status:p1.status,example:p1.buttons,dropped:p1.dropped,problems:p1.problems});
await tick([A,B]);await radio('TVD');
await ev(`document.getElementById('depth-context').scrollIntoView();return 1`);
// Draw is withdrawn-until-pressed: nothing drawn yet.
let pre=await rd();check('1_nothing_drawn_before_Draw',pre.svgs===0&&pre.buttons.json&&pre.buttons.csv&&pre.buttons.svg,{svgs:pre.svgs,btn:pre.buttons});
await drawBtn();await sleep(400);
const s1=await rd();await showPanel();await shot('s1-demo-tvd');
const ta=s1.tracks.find(x=>x.well===A),tb=s1.tracks.find(x=>x.well===B);
const sa=s1.sections.find(x=>x.well===A),sb=s1.sections.find(x=>x.well===B);
rec('s1_draw',{svgs:s1.svgs,status:s1.status,basisLabel:s1.axisBasisLabel,tracks:s1.tracks,sections:s1.sections,legend:s1.legend,reviewAid:s1.reviewAid,testDateNote:s1.testDateNote,curveDetails:s1.curveDetails});
check('1A_schematic_and_curve',ta&&ta.casing>=1&&ta.packer>=1&&ta.perforated>=1&&(ta.formationTop+ta.formationBand)>=1&&ta.testPoint===2&&ta.curve&&ta.curve.nodes>=2,{ta});
check('1A_curve_runs_18ft_to_datum',ta&&ta.curve&&Math.abs(ta.curve.topFt-18)<1.5&&ta.curve.bottomFt>2900&&ta.curve.bottomFt<3100,{top:ta?.curve?.topFt,bottom:ta?.curve?.bottomFt,limitDepth:ta?.limitDepthFt});
check('1A_limit_marker',ta&&ta.limitMarker,ta?.limitDepthFt);
const need=['no survey for this well; cannot convert MD to TVD','depth basis not stated','pressure basis not stated'];
check('1B_gaps_listed',sb&&need.every(n=>sb.gaps.some(g=>g.includes(n))),{gaps:sb?.gaps});
check('1_review_aid_sentence',s1.reviewAid&&/Not a calibrated correlation or a regulatory cross-section/.test(s1.reviewAid),s1.reviewAid);
check('1_exports_enabled_after_draw',!s1.buttons.json&&!s1.buttons.csv&&!s1.buttons.svg,s1.buttons);
// ---- S5 (exports) from the S1 drawing ----
const ex1=await doExports('s1_demo_tvd');rec('s5_exports_s1',ex1);
check('5_json_verifies',ex1.json.verify.ok&&ex1.json.verify.verifiedHashMatches,ex1.json.verify);
check('5_svg_verifies',ex1.svg.verify.ok&&ex1.svg.sameContentShaAsJson,ex1.svg.verify);
check('5_csv_four_fields',ex1.csv.allFour,{counts:ex1.csv.fieldCountsPerLine,lines:ex1.csv.lines});
check('5_filenames_share_hash',ex1.filenamesShareHash,[ex1.json.name,ex1.csv.name,ex1.svg.name]);
// tamper check: a changed JSON must fail verification
{const sealed=JSON.parse(readFileSync(join(dlDir,'dl-'+ex1.json.name),'utf8'));const s=JSON.stringify(sealed);const mutated=JSON.parse(s.replace(/"pressureBasis"|"psia"/,m=>m));let tampered=false;
 const copy=JSON.parse(s);copy.selection.month='2099-01';try{await verifyDepth(copy);}catch{tampered=true;}
 check('5_tampered_json_refused',tampered,tampered);}
// ---- S2: withdrawal ----
await radio('MD');await sleep(300);
let w1=await rd();check('2_MD_withdraws_drawing',w1.svgs===0&&w1.buttons.json&&w1.buttons.csv&&w1.buttons.svg,{svgs:w1.svgs,btn:w1.buttons,basis:w1.basis});
await drawBtn();await sleep(300);let d2=await rd();
const ta2=d2.tracks.find(x=>x.well===A);
rec('s2_md',{svgs:d2.svgs,basisLabel:d2.axisBasisLabel,tracks:d2.tracks,sections:d2.sections.map(s=>({well:s.well,gaps:s.gaps}))});
check('2_MD_drawn_again',d2.svgs===1&&/MD depth/.test(d2.axisBasisLabel||''),d2.axisBasisLabel);
await showPanel();await shot('s2-demo-md');
await selIn(0,'compared');await sleep(300);
let w2=await rd();check('2_scenario_withdraws_drawing',w2.svgs===0&&w2.buttons.json,{svgs:w2.svgs,scenario:w2.scenario});
await drawBtn();await sleep(300);let d2b=await rd();check('2_redraw_after_scenario',d2b.svgs===1,d2b.svgs);
// month change withdraws too
const months=await ev(`return [...document.querySelectorAll('#depth-context select')[1].options].map(o=>o.value)`);
await selIn(1,months[1]);await sleep(300);let w3=await rd();check('2_month_withdraws_drawing',w3.svgs===0,{svgs:w3.svgs,month:w3.month});
await selIn(0,'base');await selIn(1,months[0]);await radio('TVD');await sleep(200);
// ---- S3a: shut-in compared scenario ----
await gotoScen();
const origAvail=await ev(`return document.getElementById('disposal-alt-availability').value`);
const target=await ev(`return document.getElementById('disposal-target').value`);
await setInput('#disposal-alt-availability','0');await sleep(300);
const afterEdit=await rd();
rec('s3_afterInputEdit',{hidden:afterEdit.hidden,status:afterEdit.status});
await calcCase();
let p3=await rd();check('3_profile_kept_across_recalc_shutin',p3.visible&&/profile rows loaded/.test(p3.status)&&p3.checkedWells.length===2,{status:p3.status,checked:p3.checkedWells,basis:p3.basis});
await selIn(0,'compared');await drawBtn();await sleep(400);
const sh=await rd();await showPanel();await shot('s3-shut-in-compared');
rec('s3_shutIn',{target,scenario:sh.scenario,tracks:sh.tracks.map(x=>({well:x.well,curve:x.curve,limit:x.limitMarker})),sections:sh.sections.map(s=>({well:s.well,gaps:s.gaps,notes:s.notes}))});
const shutSec=sh.sections.find(s=>s.well===target);
check('3_shut_in_reason_shown',shutSec&&shutSec.gaps.some(g=>/shut in this month; no modelled curve/.test(g)),{target,gaps:shutSec?.gaps});
check('3_shut_in_no_curve',(sh.tracks.find(x=>x.well===target)||{}).curve===null,sh.tracks.find(x=>x.well===target)?.curve);
// restore comparison and base scenario
await gotoScen();await setInput('#disposal-alt-availability',origAvail);await sleep(200);
// ---- S3b: flagged curve (deep TVD, uniform model) ----
const model=await ev(`return document.getElementById('disposal-model').value`);
await wellField(0,'tvdFt',8000);await wellField(0,'measuredDepthFt',8300);await sleep(300);
await calcCase();
let p3b=await rd();
check('3_profile_kept_across_recalc_deep',p3b.visible&&/profile rows loaded/.test(p3b.status),{status:p3b.status,checked:p3b.checkedWells,basis:p3b.basis,scenario:p3b.scenario});
await selIn(0,'base');await tick([A,B]);await radio('TVD');await drawBtn();await sleep(400);
const fl=await rd();await showPanel();await shot('s3-flagged-curve');
const fa=fl.tracks.find(x=>x.well===A),fsec=fl.sections.find(x=>x.well===A);
rec('s3_flagged',{model,tracks:fl.tracks,sections:fl.sections.map(s=>({well:s.well,gaps:s.gaps,notes:s.notes})),status:fl.status});
check('3_curve_flagged_dashed',fa&&fa.curve&&!!fa.curve.dashed,fa?.curve);
check('3_case_reason_listed',fsec&&fsec.notes.some(n=>/case flags this point:/.test(n)),fsec?.notes);
check('3_limit_marker_shows',fa&&fa.limitMarker,fa?.limitDepthFt);
const exFl=await doExports('s3_flagged');rec('s5_exports_flagged',exFl);
check('5_flagged_json_verifies',exFl.json.verify.ok,exFl.json.verify);
check('5_flagged_svg_verifies',exFl.svg.verify.ok,exFl.svg.verify);
check('5_flagged_csv_four_fields',exFl.csv.allFour,exFl.csv.fieldCountsPerLine);
// ---- S4: survey note ----
await gotoScen();await wellField(0,'tvdFt',2980);await wellField(0,'measuredDepthFt',3300);await sleep(300);
const noNoteBefore=null;
await calcCase();
await tick([A,B]);await radio('TVD');await drawBtn();await sleep(400);
const sv=await rd();await showPanel();await shot('s4-survey-note');
const sna=sv.sections.find(x=>x.well===A);
rec('s4',{notesA:sna?.notes,gapsA:sna?.gaps,curveA:sv.tracks.find(x=>x.well===A)?.curve,status:sv.status});
check('4_survey_note_shown',sna&&sna.notes.some(n=>/survey TVD at the case's pressure datum differs from the case TVD by \d+ ft; the curve is not moved/.test(n)),sna?.notes);
check('1A_no_survey_note_at_TVD_3000',!(sa&&sa.notes.some(n=>/survey TVD at the case/.test(n))),sa?.notes);
const ex4=await doExports('s4_survey_note');rec('s5_exports_s4',ex4);
check('5_s4_json_verifies',ex4.json.verify.ok,ex4.json.verify);
check('5_s4_svg_verifies',ex4.svg.verify.ok,ex4.svg.verify);
check('5_s4_csv_four_fields',ex4.csv.allFour,ex4.csv.fieldCountsPerLine);
// restore TVD for later
await gotoScen();await wellField(0,'tvdFt',3000);await sleep(200);
// ================= user case =================
rec('setupUser',await loadUserCase());
await calcDisposal();
let u0=await rd();
rec('s6_user_afterCalc',{visible:u0.visible,example:u0.buttons,exampleNote:u0.exampleNote,wellBoxes:u0.wellBoxes,status:u0.status});
check('6_example_refused_in_user_case',u0.buttons.example===true&&/The fictional example is only for the demo case\./.test(u0.exampleNote),{disabled:u0.buttons.example,note:u0.exampleNote,title:u0.buttons.exampleTitle});
const UP=win(join(scratch,'user-profile.csv')),BP=win(join(scratch,'bad-profile.csv'));
await setFiles(`${DP} input[type=file]`,[UP]);await sleep(800);
let u1=await rd();
rec('s6_user_upload',{status:u1.status,dropped:u1.dropped,problems:u1.problems,buttons:u1.buttons});
check('6_user_profile_uploads',/profile rows loaded/.test(u1.status)&&u1.problems.length===0,{status:u1.status});
check('6_not_in_case_row_dropped_listed',u1.dropped.some(d=>/FICTIONAL-OTHER/.test(d)&&/not a well in this case/.test(d)),u1.dropped);
await tick([A,B]);await radio('TVD');await drawBtn();await sleep(400);
const u2=await rd();await showPanel();await shot('s6-user-drawn');
rec('s6_user_draw',{tracks:u2.tracks,sections:u2.sections.map(s=>({well:s.well,gaps:s.gaps,notes:s.notes}))});
check('6_user_profile_draws',u2.svgs===1&&u2.tracks.length===2&&u2.tracks.find(x=>x.well===A)?.casing>=1&&u2.tracks.find(x=>x.well===A)?.testPoint===1,u2.tracks);
// bad profile
await setFiles(`${DP} input[type=file]`,[BP]);await sleep(800);
const u3=await rd();await showPanel();await shot('s6-bad-profile-refused');
rec('s6_bad_upload',{status:u3.status,problems:u3.problems,svgs:u3.svgs,buttons:u3.buttons,statusRows:u3.status});
check('6_bad_profile_refused_with_row',u3.problems.length>=1&&u3.problems.some(x=>/^row \d+:/.test(x))&&/refused/.test(u3.status),{problems:u3.problems,status:u3.status});
check('6_bad_profile_loads_nothing_and_withdraws',u3.svgs===0&&u3.buttons.clear===true,{svgs:u3.svgs,clear:u3.buttons.clear});
// ---- S7: source switch clears ----
await setFiles(`${DP} input[type=file]`,[UP]);await sleep(800);
await tick([A]);await radio('TVD');
const pre7=await rd();
await click('#source-demo');await sleep(1200);
const mid7=await rd();
await calcDisposal();
const u7=await rd();
rec('s7',{before:{status:pre7.status,checked:pre7.checkedWells,basis:pre7.basis},afterSwitchHidden:mid7.hidden,after:{status:u7.status,clear:u7.buttons.clear,checked:u7.checkedWells,basis:u7.basis,svgs:u7.svgs,dropped:u7.dropped,problems:u7.problems}});
check('7_source_switch_clears_profile',mid7.hidden===true&&u7.buttons.clear===true&&u7.checkedWells.length===0&&u7.basis.length===0&&u7.svgs===0&&!/profile rows loaded/.test(u7.status)&&u7.dropped.length===0,{status:u7.status,clear:u7.buttons.clear,checked:u7.checkedWells});
// ================= sample case =================
await ev(`document.getElementById('sample-load').click();return 1`);
await wait("/all 7 loading steps done/.test(document.getElementById('sample-banner-detail').textContent)",240000);
await gotoScen();await calcCase();
const sm=await rd();
const full=await ev(`const ci=document.getElementById('case-insights');return [...ci.querySelectorAll(':scope > div > details')].map(d=>d.querySelector('summary').textContent)`);
const heads=await ev(`const g=id=>[...document.querySelectorAll('#'+id+' h3,#'+id+' h4')].map(h=>h.textContent.trim());return {ci:g('case-insights'),tb:g('transient-buildup'),ciHidden:document.getElementById('case-insights').hidden,tbHidden:document.getElementById('transient-buildup').hidden,cis:!!document.querySelector('#case-insights table'),order:[...document.getElementById('transient-buildup').parentElement.children].map(c=>c.id||c.tagName).filter((x,i,a)=>true).slice(0,60)}`);
const e10=existsSync(join(here,'../e10-evidence',`results-${tag}.json`))?JSON.parse(readFileSync(join(here,'../e10-evidence',`results-${tag}.json`),'utf8')):null;
const hashes=full.map(l=>sha(l));
rec('s8_sample',{depthPanel:{visible:sm.visible,status:sm.status,example:sm.buttons,exampleNote:sm.exampleNote},headings:{caseInsights:heads.ci,transientBuildup:heads.tb},summaryLineCount:full.length,summaryLinesSha256:hashes,e10BaselineSha256:e10?.s6?.summaryLinesSha256??null});
check('8_sample_existing_panels_present',['What the case says'].every(()=>true)&&heads.ci.includes('Wells compared')&&heads.cis&&!heads.ciHidden&&heads.tb.length>0&&!heads.tbHidden,heads);
check('8_sample_summary_lines_unchanged_vs_e10',e10?.s6?.summaryLinesSha256?JSON.stringify(hashes)===JSON.stringify(e10.s6.summaryLinesSha256):false,{n:hashes.length,baseline:!!e10});
check('8_sample_no_example',sm.visible&&sm.buttons.example===true,{example:sm.buttons.example,note:sm.exampleNote});
await showPanel();await shot('s8-sample-panels');
await ev(`document.getElementById('case-insights').scrollIntoView({block:'start'});return 1`);await sleep(300);await shot('s8-sample-case-insights');
const hasNearby=await ev(`const t=document.getElementById('transient-buildup');return {text:t?[...t.querySelectorAll('h3,h4,h5,summary')].map(x=>x.textContent.trim()).slice(0,12):null,pressureBuildup:/Pressure buildup/i.test(document.body.textContent),nearby:/Nearby wells/i.test(document.getElementById('transient-buildup')?.textContent??'')}`);
rec('s8_buildup',hasNearby);
check('8_sample_pressure_buildup_nearby_present',hasNearby.pressureBuildup&&hasNearby.nearby,hasNearby);
// sensitivity view hides it
await nav('sensitivity');await sleep(600);
const sens=await ev(`const p=document.getElementById('depth-context');const ws=document.getElementById('disposal-workspace');return {panelHidden:p.hidden,panelVisible:p.offsetParent!==null,workspaceHidden:ws.hidden,hash:location.hash}`);
rec('s8_sensitivity',sens);
check('8_depth_context_hidden_on_sensitivity',!sens.panelVisible,sens);
await shot('s8-sensitivity-view');
// ---- 10: page scroll ----
await gotoScen();
const ps=await ev(`const d=document.scrollingElement;return {innerWidth,scrollW:d.scrollWidth,clientW:d.clientWidth,pageHScroll:d.scrollWidth>innerWidth}`);
rec('s10_pageScroll_sample',ps);
check('10_no_page_hscroll_sample_view',!ps.pageHScroll,ps);
}catch(e){console.log('FATAL',e.message);results.fatal=e.message;try{results.fatalContext=await ev(`return {src:document.getElementById('disposal-source')?.textContent,imp:document.getElementById('import-status')?.textContent,err:document.getElementById('disposal-error')?.textContent,depth:document.getElementById('depth-context')?.textContent.slice(0,400)}`);console.log(JSON.stringify(results.fatalContext));await shot('fatal');}catch{}}
// ---- page scroll with a drawing on screen (demo case again) ----
try{
await send('Page.navigate',{url:base});
await wait("document.readyState==='complete'&&document.getElementById('sample-load')");await sleep(1200);
await click('#source-demo');await sleep(1200);await calcDisposal();
await ev(`[...document.querySelectorAll('#depth-context button')].find(b=>b.textContent==='Load fictional example').click();return 1`);
await tick([A,B]);await radio('TVD');await drawBtn();await sleep(500);
await showPanel();
const lay=await rd();
const ps2=await ev(`const d=document.scrollingElement;const w=document.querySelector('#depth-context .depth-svg');w.scrollLeft=200;return {innerWidth,scrollW:d.scrollWidth,clientW:d.clientWidth,pageHScroll:d.scrollWidth>innerWidth,wrapper:{scrollW:w.scrollWidth,clientW:w.clientWidth,scrollLeftAfterSet:w.scrollLeft,overflowX:getComputedStyle(w).overflowX}}`);
rec('s10_pageScroll_with_drawing',{...ps2,svgW:lay.svgW});
check('10_no_page_hscroll_with_drawing',!ps2.pageHScroll,ps2);
const narrow=+w<600;
check('10_drawing_scrolls_inside_wrapper',narrow?(ps2.wrapper.scrollW>ps2.wrapper.clientW&&ps2.wrapper.scrollLeftAfterSet>0&&ps2.wrapper.overflowX!=='visible'):ps2.wrapper.overflowX!=='visible',ps2.wrapper);
await shot(narrow?'s10-mobile-drawing':'s10-desktop-drawing');
await ev(`document.querySelector('#depth-context .depth-svg').scrollLeft=0;document.querySelector('#depth-context .depth-controls').scrollIntoView();return 1`);await sleep(300);await shot('s10-controls');
}catch(e){console.log('FATAL2',e.message);results.fatal2=e.message;}
check('9_no_console_errors',consoleErrors.filter(x=>!/favicon/i.test(x)).length===0,consoleErrors);
results.consoleErrors=consoleErrors;
results.checks=checks;
results.allPass=Object.values(checks).every(c=>c.ok)&&!results.fatal&&!results.fatal2;
results.screenshots=shotHashes;
writeFileSync(join(here,`results-${tag}.json`),JSON.stringify(results,null,1));
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
