import {parseDepthProfile,pruneProfile,ProfileError,FICTIONAL_DEPTH_PROFILE_CSV,CONTENT_CLASS_LABELS,PROFILE_COLUMNS} from '../dist/depthProfile.js';
import {buildDepthContext,curveSources,REVIEW_AID,EXAMPLE_LABEL,EXAMPLE_ONLY_DEMO,DROPPED} from '../dist/depthContext.js';
import {depthContextSvg,CURVE_LABEL,TEST_LABEL} from '../dist/depthContextSvg.js';
import {sealDepth,verifyDepth,verifyDepthSvg,depthJson,depthCsv,depthSvg} from '../dist/depthContextExport.js';
import {fmtNumber} from '../dist/caseSummary.js';

/** ANA-E11 "Depth view (review aid)": user-supplied depth evidence beside the case's modelled pressure curve.
 * Pure at import time (no DOM access), so node:test imports it. Mounted only by import-ui.mjs.
 * Display only: it reads the disposal case result and never changes it. */

export const PANEL_TITLE='Depth view (review aid)';
export const NO_CASE='Load or calculate a disposal case to choose wells';
export const NEED_PROFILE='Load a depth profile first (upload a CSV, or the fictional example on the demo case).';
export const NEED_WELLS='Tick 1 to 4 wells to show.';
export const NEED_BASIS='Choose a display basis, MD or TVD.';
export const MAX_WELLS_MESSAGE='Show at most 4 wells at a time.';
export const NEED_DRAW='Draw the depth view first.';
export const PROFILE_REFUSED='The profile was refused; nothing was loaded. Fix the rows listed and upload it again.';
export const MESSAGES=[NO_CASE,NEED_PROFILE,NEED_WELLS,NEED_BASIS,MAX_WELLS_MESSAGE,NEED_DRAW,PROFILE_REFUSED];
const MAX_WELLS=4;
const NO_SOURCE=Symbol('no-source');
const msg=e=>e instanceof Error?e.message:String(e);
const clone=v=>JSON.parse(JSON.stringify(v));
const EXPORTS={json:{ext:'json',mime:'application/json'},csv:{ext:'csv',mime:'text/csv;charset=utf-8'},svg:{ext:'svg',mime:'image/svg+xml'}};

/** DOM-free state machine. `generation` changes on every withdrawal (select, profile change, case result, invalidation, source switch),
 * so an export that started earlier returns {cancelled:true}. */
export function createDepthSession({getSource,onChange=()=>{}}={}){
  let result=null,sha=null,profile=null,problems=[],dropped=[],context=null,message=null,generation=0,lastSource=NO_SOURCE;
  const blank=()=>({wellIds:[],basis:undefined,scenario:'base',month:months()[0],referenceDepthFt:null,referencePressurePsia:null});
  const months=()=>result?result.base.monthly.map(m=>m.month):[];
  const caseWellIds=()=>result?result.inputs.wells.map(w=>w.id):[];
  let selection=blank();
  const sourceNow=()=>getSource?getSource():undefined;
  const clearAll=()=>{profile=null;problems=[];dropped=[];selection=blank();};
  /** A source switch noticed without its event (the event is the normal route): the profile does not carry over. */
  const followSource=()=>{const src=sourceNow();if(lastSource!==NO_SOURCE&&src!==lastSource)clearAll();lastSource=src;};
  const withdraw=()=>{generation++;context=null;onChange();};
  const refuse=text=>{message=text;onChange();};
  /** Rows of wells that are not case wells are dropped and listed; the dropped list accumulates until the profile is cleared. */
  const adopt=next=>{
    const pr=pruneProfile(next,caseWellIds());
    profile=pr.profile;dropped=[...dropped,...pr.dropped].sort((a,b)=>a.row-b.row);
  };
  return {
    snapshot(){
      return {ready:result!==null,profile,problems:[...problems],dropped:[...dropped],caseWellIds:caseWellIds(),months:months(),
        selection:Object.fromEntries(Object.entries(selection).filter(([,v])=>v!==undefined)),context,message,
        methodVersion:result?result.methodVersion:null,
        sources:context&&result?curveSources(result,context.selection.scenario,context.selection.month,context.selection.wellIds):[]};
    },
    loadProfileText(text){
      if(!result){refuse(NO_CASE);return;}
      message=null;
      try{
        const parsed=parseDepthProfile(text);
        problems=[];dropped=[];adopt(parsed);
      }catch(e){
        // A refused upload loads nothing and also drops the earlier profile, so the panel never shows evidence the user thinks was replaced.
        profile=null;dropped=[];
        problems=e instanceof ProfileError?[...e.problems]:[{row:null,reason:msg(e)}];
        message=PROFILE_REFUSED;
      }
      withdraw();
    },
    loadExample(){
      if(sourceNow?.()!=='demo'){refuse(EXAMPLE_ONLY_DEMO);return;}
      this.loadProfileText(FICTIONAL_DEPTH_PROFILE_CSV);
    },
    clearProfile(){profile=null;problems=[];dropped=[];message=null;withdraw();},
    select(partial){
      const next={...selection};
      for(const [k,v] of Object.entries(partial??{})){
        if(k==='wellIds'){
          if(!Array.isArray(v)||new Set(v).size!==v.length){refuse('Selected wells must be distinct.');return;}
          if(v.length>MAX_WELLS){refuse(MAX_WELLS_MESSAGE);return;}
          if(v.some(id=>!caseWellIds().includes(id))){refuse('Only wells in the disposal case can be shown.');return;}
          next.wellIds=[...v];
        }else if(k==='basis'){
          if(v!=='MD'&&v!=='TVD'){refuse(NEED_BASIS);return;}
          next.basis=v;
        }else if(k==='scenario'){
          if(v!=='base'&&v!=='compared'){refuse('Unknown scenario.');return;}
          next.scenario=v;
        }else if(k==='month'){
          if(!months().includes(v)){refuse('That month is not in the disposal case.');return;}
          next.month=v;
        }else if(k==='referenceDepthFt'||k==='referencePressurePsia'){
          if(v!==null&&!(typeof v==='number'&&Number.isFinite(v))){refuse('Reference depth and pressure must be numbers.');return;}
          next[k]=v;
        }
      }
      selection=next;message=null;withdraw();
    },
    draw(){
      context=null;generation++;message=null;
      if(!result)message=NO_CASE;
      else if(!profile)message=NEED_PROFILE;
      else if(selection.wellIds.length<1||selection.wellIds.length>MAX_WELLS)message=NEED_WELLS;
      else if(selection.basis!=='MD'&&selection.basis!=='TVD')message=NEED_BASIS;
      else{
        try{
          const sel={...selection,wellIds:[...selection.wellIds]};
          context=buildDepthContext(profile,curveSources(result,sel.scenario,sel.month,sel.wellIds),sel);
        }catch(e){message=msg(e);}
      }
      onChange();
    },
    onCaseResult(next,contentSha256){
      generation++;followSource();
      result=next;sha=typeof contentSha256==='string'?contentSha256:null;context=null;message=null;
      const ids=caseWellIds(),ms=months();
      if(profile)adopt(profile);
      selection={...selection,wellIds:selection.wellIds.filter(id=>ids.includes(id)),month:ms.includes(selection.month)?selection.month:ms[0]};
      onChange();
    },
    onInvalidated(){generation++;followSource();result=null;sha=null;context=null;message=null;onChange();},
    onSourceSwitch(){lastSource=sourceNow?.();generation++;clearAll();context=null;message=null;onChange();},
    /** Seals the shown drawing, re-verifies it (JSON and CSV through verifyDepth, SVG through verifyDepthSvg) and returns the file text.
     * `{cancelled:true}` when anything was withdrawn meanwhile. */
    async exportDepth(format){
      const kind=EXPORTS[format];
      if(!kind)throw new Error('Unsupported depth view export format: '+format);
      if(!context||!result||!profile)throw new Error(NEED_DRAW);
      const gen=generation,shown=context,res=result,prof=profile,drop=[...dropped],digest=sha;
      const changed=()=>gen!==generation;
      try{
        const sel=shown.selection;
        const sealed=await sealDepth({profile:prof,dropped:drop,sources:curveSources(res,sel.scenario,sel.month,sel.wellIds),selection:sel,
          caseRef:{schemaVersion:res.schemaVersion,methodVersion:res.methodVersion,contentSha256:digest},context:shown});
        if(changed())return {cancelled:true};
        let text;
        if(format==='svg'){const svg=depthSvg(sealed);await verifyDepthSvg(svg);text=svg;}
        else{const v=await verifyDepth(sealed);text=format==='json'?depthJson(v):depthCsv(v);}
        if(changed())return {cancelled:true};
        return {text,filename:`swd-depth-context-${sealed.contentSha256.slice(0,12)}.${kind.ext}`,mime:kind.mime};
      }catch(e){if(changed())return {cancelled:true};throw e;}
    },
  };
}

// ---- DOM wiring (only runs when import-ui.mjs calls mountDepthContext) ----
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const num=(v,digits=0)=>typeof v==='number'&&Number.isFinite(v)?fmtNumber(v,digits):'—';
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('The depth drawing could not be parsed.');return document.importNode(doc.documentElement,true);}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const stationText=s=>`MD ${num(s.mdFt,1)} ft / TVD ${num(s.tvdFt,1)} ft`;
const STYLE=`#depth-context .depth-controls{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-end;margin:10px 0}
#depth-context fieldset{border:1px solid #d9e2ec;border-radius:6px;margin:0;padding:6px 12px}
#depth-context fieldset label{display:inline-flex;gap:6px;align-items:center;margin-right:14px}
#depth-context .depth-svg{max-width:100%;overflow-x:hidden}
#depth-context .depth-svg svg{display:block;max-width:100%;height:auto}
#depth-context .depth-tracks{display:flex;flex-direction:row;gap:12px}
#depth-context details{margin:6px 0}
#depth-context dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:6px 0}
#depth-context dd{margin:0;overflow-wrap:anywhere}
#depth-context li{overflow-wrap:anywhere}
@media (max-width:599px){#depth-context .depth-tracks{flex-direction:column}#depth-context .depth-controls>*{flex:1 1 100%}#depth-context dl{grid-template-columns:1fr}}`;

export function mountDepthContext(anchor,{getSource}){
  const root=el('section',undefined,'panel');root.id='depth-context';root.hidden=true;root.setAttribute('aria-labelledby','depth-context-title');
  const style=el('style',STYLE);
  const title=el('h3',PANEL_TITLE);title.id='depth-context-title';
  const aid=el('p',REVIEW_AID,'small');
  const status=el('p','');status.setAttribute('role','status');
  // Controls.
  const file=el('input');file.type='file';file.accept='.csv,text/csv';
  const fileLabel=el('label','Depth profile (CSV)');fileLabel.append(file);
  const example=el('button','Load fictional example');example.type='button';
  const exampleNote=el('span','','small');
  const clear=el('button','Clear profile');clear.type='button';
  const profileBox=el('div',undefined,'depth-controls');profileBox.append(fileLabel,example,exampleNote,clear);
  const wellsSet=el('fieldset');wellsSet.append(el('legend','Wells to show (1 to 4)'));
  const basisSet=el('fieldset');basisSet.append(el('legend','Display basis'));
  const basisInputs={};
  for(const b of ['MD','TVD']){const l=el('label'),i=el('input');i.type='radio';i.name='depth-basis';i.value=b;basisInputs[b]=i;l.append(i,document.createTextNode(b));basisSet.append(l);}
  const scenario=el('select'),scenarioLabel=el('label','Scenario');
  for(const [v,t] of [['base','Base'],['compared','Compared']]){const o=el('option',t);o.value=v;scenario.append(o);}scenarioLabel.append(scenario);
  const month=el('select'),monthLabel=el('label','Month');monthLabel.append(month);
  const numInput=label=>{const l=el('label',label),i=el('input');i.type='number';i.step='any';l.append(i);return [l,i];};
  const [refDepthLabel,refDepth]=numInput('Reference depth (ft, optional)');
  const [refPressLabel,refPress]=numInput('Reference pressure (psia, optional)');
  const draw=el('button','Draw');draw.type='button';
  const choose=el('div',undefined,'depth-controls');choose.append(wellsSet,basisSet,scenarioLabel,monthLabel,refDepthLabel,refPressLabel,draw);
  const problemsBox=el('div'),output=el('div');
  const jsonBtn=el('button','Download depth view JSON'),csvBtn=el('button','Download depth view CSV'),svgBtn=el('button','Download depth view SVG');
  for(const b of [jsonBtn,csvBtn,svgBtn]){b.type='button';b.disabled=true;}
  const downloads=el('div',undefined,'import-actions');downloads.append(jsonBtn,csvBtn,svgBtn);
  root.append(style,title,aid,status,profileBox,choose,problemsBox,output,downloads);
  anchor.after(root);

  let wellsKey='',monthsKey='',renderedContext=undefined,exporting=false;
  const narrow=typeof matchMedia==='function'?matchMedia('(max-width:599px)'):null;
  const session=createDepthSession({getSource,onChange:()=>render()});

  function syncWells(snap){
    const key=JSON.stringify(snap.caseWellIds);
    if(key!==wellsKey){
      wellsKey=key;wellsSet.replaceChildren(wellsSet.firstChild);
      for(const id of snap.caseWellIds){const l=el('label'),i=el('input');i.type='checkbox';i.value=id;l.append(i,document.createTextNode(id));wellsSet.append(l);}
    }
    for(const i of wellsSet.querySelectorAll('input'))i.checked=snap.selection.wellIds?.includes(i.value)??false;
  }
  function syncMonths(snap){
    const key=JSON.stringify(snap.months);
    if(key!==monthsKey){monthsKey=key;month.replaceChildren(...snap.months.map(m=>{const o=el('option',m);o.value=m;return o;}));}
    if(snap.selection.month)month.value=snap.selection.month;
  }
  const setNumber=(input,v)=>{if(document.activeElement!==input)input.value=v===null||v===undefined?'':String(v);};

  function rowDetail(t,it){
    const r=it.row,p=it.placement,d=el('details');
    const where=p.status==='placed'?`placed at ${num(p.topFt,1)}${p.bottomFt!==null?` to ${num(p.bottomFt,1)}`:''} ft ${snapBasis}`:'';
    d.append(el('summary',`${t.wellId} row ${r.row}: ${r.kind}${r.label?` (${r.label})`:''}; ${where}`));
    const dl=el('dl');
    const add=(k,v)=>{dl.append(el('dt',k),el('dd',v));};
    add('Content class',CONTENT_CLASS_LABELS[r.contentClass]);add('Source reference',r.sourceRef);
    if(r.bottomSourceRef)add('Bottom source reference',r.bottomSourceRef);
    add('Declared depth basis',r.basis??'not applicable');
    add('Depth reference',t.reference?`${t.reference.name||'(unnamed)'}; wellhead ${num(t.reference.wellheadBelowReferenceFt,1)} ft below it`:'not declared');
    if(p.status==='placed'){
      if(p.conversion){
        add('Converted',`from ${p.conversion.from} with a survey; stations used: ${p.conversion.stations.map(stationText).join(' and ')}`);
        if(p.conversion.topStations)add('Top converted',`stations used: ${p.conversion.topStations.map(stationText).join(' and ')}`);
      }else add('Converted','no, drawn as entered');
    }
    for(const c of PROFILE_COLUMNS){const v=r.raw?.[c];if(v!==undefined&&v!=='')add(`As entered: ${c}`,v);}
    d.append(dl);return d;
  }
  let snapBasis='';

  function renderOutput(snap){
    const ctx=snap.context;
    output.replaceChildren();
    if(!ctx)return;
    snapBasis=ctx.selection.basis;
    const mkSvg=c=>{const w=el('div',undefined,'depth-svg');w.append(svgNode(depthContextSvg(c,null)));return w;};
    if(narrow?.matches&&ctx.tracks.length>1){
      // Below 600 px each well gets its own drawing, stacked, on the shared depth axis; each drawing has its own pressure scale.
      const box=el('div',undefined,'depth-tracks');
      for(const t of ctx.tracks)box.append(mkSvg({...ctx,tracks:[t]}));
      output.append(box);
    }else output.append(mkSvg(ctx));
    const srcs=new Map(snap.sources.map(s=>[s.wellId,s]));
    for(const t of ctx.tracks){
      const sec=el('section');sec.append(el('h4',t.wellId));
      const gaps=t.items.filter(i=>i.placement.status==='gap');
      const gl=el('ul',undefined,'small');gl.setAttribute('aria-label',`Gaps for ${t.wellId}`);
      for(const g of gaps)gl.append(el('li',`row ${g.row.row} (${g.row.kind}): ${g.placement.reason}`));
      for(const d of snap.dropped.filter(x=>x.wellId===t.wellId))gl.append(el('li',`row ${d.row}: ${DROPPED}`));
      if(t.curve.status==='gap')gl.append(el('li',`modelled curve: ${t.curve.reason}`));
      sec.append(el('p',gl.children.length?'Gaps and reasons':'No gaps in the rows placed.','small'),gl);
      const notes=el('ul',undefined,'small');
      if(t.curve.status==='drawn'){for(const n of t.curve.notes)notes.append(el('li',n));if(t.curve.flagged)for(const r of t.curve.reasons)notes.append(el('li',`case flags this point: ${r}`));}
      if(t.surveyNote)notes.append(el('li',t.surveyNote));
      if(notes.children.length)sec.append(notes);
      for(const it of t.items)if(it.placement.status==='placed')sec.append(rowDetail(t,it));
      const cd=el('details');cd.append(el('summary',`${t.wellId}: modelled curve detail`));
      const src=srcs.get(t.wellId),dl=el('dl');
      const add=(k,v)=>{dl.append(el('dt',k),el('dd',v));};
      add('Label',CURVE_LABEL);add('Test points',TEST_LABEL);
      add('Scenario and month',`${ctx.selection.scenario}, ${ctx.selection.month}`);
      if(src){
        add('Onstream rate',`${num(src.onstreamStbd,0)} STB/day`);
        add('Case well inputs',JSON.stringify(src.well));
        add('Fluid and hydraulics',JSON.stringify({fluid:src.fluid,hydraulics:src.hydraulics??'not set (uniform brine model)'}));
        add('Case method version',snap.methodVersion??'');
      }
      if(t.curve.status==='drawn'){add('Model',t.curve.model);add('Limit marker',`${t.curve.limitMarker.label}: ${num(t.curve.limitMarker.pressurePsia,0)} psia at ${num(t.curve.limitMarker.depthFt,0)} ft`);}
      cd.append(dl);
      if(t.curve.status==='drawn'){const nl=el('ul',undefined,'small');for(const n of t.curve.notes)nl.append(el('li',n));cd.append(nl);}
      sec.append(cd);output.append(sec);
    }
    output.append(el('p',ctx.testDateNote,'small'));
  }

  function render(){
    const snap=session.snapshot();
    root.hidden=!snap.ready;
    if(!snap.ready){output.replaceChildren();problemsBox.replaceChildren();renderedContext=undefined;status.textContent=NO_CASE;for(const b of [jsonBtn,csvBtn,svgBtn])b.disabled=true;return;}
    const demo=getSource()==='demo';
    example.disabled=!demo;example.title=demo?'':EXAMPLE_ONLY_DEMO;exampleNote.textContent=demo?EXAMPLE_LABEL:EXAMPLE_ONLY_DEMO;
    clear.disabled=!snap.profile;
    syncWells(snap);syncMonths(snap);
    for(const b of Object.keys(basisInputs))basisInputs[b].checked=snap.selection.basis===b;
    scenario.value=snap.selection.scenario;
    setNumber(refDepth,snap.selection.referenceDepthFt);setNumber(refPress,snap.selection.referencePressurePsia);
    status.textContent=snap.message??(snap.profile?`${snap.profile.rows.length} profile rows loaded.`:'');
    problemsBox.replaceChildren();
    if(snap.problems.length){const ul=el('ul',undefined,'small');ul.setAttribute('aria-label','Profile rows refused');for(const p of snap.problems)ul.append(el('li',p.row===null?p.reason:`row ${p.row}: ${p.reason}`));problemsBox.append(ul);}
    if(snap.dropped.length&&!snap.context){const ul=el('ul',undefined,'small');ul.setAttribute('aria-label','Dropped profile rows');for(const d of snap.dropped)ul.append(el('li',`${d.wellId} row ${d.row}: ${DROPPED}`));problemsBox.append(ul);}
    if(snap.context!==renderedContext){renderedContext=snap.context;renderOutput(snap);}
    for(const b of [jsonBtn,csvBtn,svgBtn])b.disabled=exporting||!snap.context;
  }

  async function exportAs(format){
    if(exporting||!session.snapshot().context)return;
    exporting=true;for(const b of [jsonBtn,csvBtn,svgBtn])b.disabled=true;
    const prior=status.textContent;status.textContent='Re-verifying the depth view before download…';
    try{
      const out=await session.exportDepth(format);
      if(out.cancelled)status.textContent='Export cancelled: the view changed. Draw again, then download.';
      else{download(out.text,out.filename,out.mime);status.textContent=prior;}
    }catch(x){status.textContent='Export blocked: '+msg(x);}
    finally{exporting=false;render();}
  }
  jsonBtn.onclick=()=>exportAs('json');csvBtn.onclick=()=>exportAs('csv');svgBtn.onclick=()=>exportAs('svg');
  file.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;try{session.loadProfileText(await f.text());}catch(x){status.textContent=msg(x);}file.value='';});
  example.onclick=()=>session.loadExample();
  clear.onclick=()=>session.clearProfile();
  wellsSet.addEventListener('change',()=>session.select({wellIds:[...wellsSet.querySelectorAll('input:checked')].map(i=>i.value)}));
  for(const [b,i] of Object.entries(basisInputs))i.addEventListener('change',()=>{if(i.checked)session.select({basis:b});});
  scenario.addEventListener('change',()=>session.select({scenario:scenario.value}));
  month.addEventListener('change',()=>session.select({month:month.value}));
  const numOrNull=i=>i.value.trim()===''?null:Number(i.value);
  refDepth.addEventListener('change',()=>session.select({referenceDepthFt:numOrNull(refDepth)}));
  refPress.addEventListener('change',()=>session.select({referencePressurePsia:numOrNull(refPress)}));
  draw.onclick=()=>session.draw();
  narrow?.addEventListener?.('change',()=>{renderedContext=undefined;render();});
  document.addEventListener('disposal-case-result',event=>session.onCaseResult(event.detail.result,event.detail.contentSha256??null));
  document.addEventListener('disposal-case-invalidated',()=>session.onInvalidated());
  document.addEventListener('workspace-source',()=>session.onSourceSwitch());
  return session;
}
