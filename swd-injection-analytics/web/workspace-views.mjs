const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=v=>v===null||v===undefined?'Unavailable':typeof v==='number'?v.toLocaleString('en-US',{maximumSignificantDigits:8}):String(v);
export function dataTable(headers,rows,caption){const wrap=node('div',undefined,'table-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',caption);const table=node('table');table.append(node('caption',caption));const head=node('thead'),tr=node('tr');for(const name of headers){const th=node('th',name);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=node('tbody');for(const row of rows){const r=node('tr');for(const value of row)r.append(node('td',fmt(value)));body.append(r);}table.append(body);wrap.append(table);return wrap;}
function heading(root,id,title,description){root.replaceChildren();const div=node('div',undefined,'workspace-title'),h=node('h1',title);h.id=id;h.tabIndex=-1;div.append(h,node('p',description));root.append(div);}
function action(label,run,primary=false){const b=node('button',label,primary?'primary-action':undefined);b.type='button';b.onclick=run;return b;}
function empty(root,message,ctx){const p=node('div',undefined,'empty-workspace');p.append(node('h2','Select the inputs for this workspace'),node('p',message),action('Choose data & sources',()=>ctx.navigate('data')));root.append(p);}
export function renderCurveLibrary(ctx){
 const root=$('curve-workspace');heading(root,'curve-title','Curve library','Inspect current fitted parameters. Maintaining and assigning a reusable curve library is proposed functionality.');
 root.append(node('p','Proposed: naming, saving, revising, cloning, comparing and assigning reusable curves. No persistent curve library or saved cases are implemented.','scope-warning'));
 const models=ctx.demo?.inputs.forecastModels??ctx.bundle?.frozen?.models??[];
 if(!models.length){empty(root,'Confirm sufficient producer history and calculate a forecast to inspect its fitted curves.',ctx);return;}
 root.append(dataTable(['Producer','Method','Log rate at cutoff','Monthly log slope','Cutoff','Forecast identity'],models.map(m=>[m.producerId,'Local exponential log-rate fit',m.logRate,m.monthlySlope,ctx.demo?.inputs.cutoff??ctx.bundle.frozen.cutoff,ctx.demo?.inputs.forecastId??ctx.bundle.frozen.id]),'Current fitted snapshots — inspection only'));
 root.append(node('p','Group/cohort labels are metadata, not statistical cohort fitting. No lateral-length, peak-rate or well-age normalization is applied.','session-note'),action('Inspect fit & forecast',()=>ctx.navigate('forecast')));
}
export function renderSchedules(ctx){
 const root=$('schedule-workspace'),existingControls=ctx.preserveControls?root.querySelector('.schedule-input-panel'):null;if(existingControls){for(const child of [...root.children])if(child!==existingControls&&!child.classList.contains('workspace-title'))child.remove();}else heading(root,'schedule-title','Development schedules','Existing producers retain their frozen forecasts. Distinct scheduled additions contribute separately to total demand.');
 if(ctx.source==='demo'){
  const fixture=ctx.demo?.inputs.planningFixture,panel=existingControls??node('section',undefined,'panel schedule-input-panel');if(!existingControls){panel.append(node('h2','Demonstration schedule controls'));
  const controls=node('div',undefined,'schedule-controls');
  for(const [originalId,label]of [['new-well-start','New producer start month'],['new-well-ramp','Ramp to full rate (months)'],['new-well-availability','Monthly availability (fraction)']]){
   const original=$(originalId),l=node('label',label),input=original.cloneNode(true);input.id=`schedule-${originalId}`;input.removeAttribute('name');input.value=original.value;input.addEventListener('input',()=>{original.value=input.value;original.dispatchEvent(new Event('input',{bubbles:true}));});l.append(input);controls.append(l);
  }
  panel.append(controls,node('p','These controls update the same original workbook assumptions; the frozen existing-producer forecast and holdout remain unchanged.','session-note'));root.append(panel);}
  if(fixture)root.append(dataTable(['Producer','Group','Cohort','Contribution','Start','Initial rate (STB/day)','Decline (fraction/month)','Ramp (months)'],fixture.producers.map(p=>{const s=fixture.schedules.find(x=>x.producerId===p.id);return [p.id,p.groupId,p.cohortId,s?'Assumed addition':'Frozen existing forecast',s?.startMonth??p.startMonth,s?.initialRateStbd??'Fitted snapshot',s?.monthlyDecline??'Fitted snapshot',s?.rampMonths??'Not applicable'];}),'Declared fictional producer identities and schedules'));
  else root.append(node('p','No current demonstration result. Correct invalid schedule controls here or other assumptions in the original workbook before using dependent results.','scope-warning'));
 }else if(ctx.source==='user'){
  const schedules=ctx.inputs.schedule?.rows.filter(r=>r.disposition==='accepted'&&r.value?.profile==='schedule')??[];
  root.append(node('p','Uploaded schedules support start-date calendar proration, declared exponential decline and a fixed availability fraction. Imported ramp/monthly downtime, an Add producer editor and curve-library assignment remain proposed.','scope-warning'));
  if(!schedules.length)root.append(node('p','No schedule profile confirmed. Existing-producer demand can still use sufficient history and its frozen forecast.'));
  else root.append(dataTable(['Producer','Group','Start date','Initial rate (STB/day)','Decline (fraction/month)','Availability','Source row'],schedules.map(r=>[r.value.producerId,r.value.groupId,r.value.startDate,r.value.initialRateStbd,r.value.monthlyDecline,r.value.availability,r.lineage.originalRow]),'Confirmed customer-provided scheduled additions'));
  root.append(action('Import or correct schedule profile',()=>{ctx.navigate('data');$('import-profile').value='schedule';$('import-profile').dispatchEvent(new Event('change'));}));
 }else{empty(root,'Producer schedules require the separately selected synthetic demonstration or confirmed customer profiles. Public injection reports do not provide producer demand.',ctx);return;}
 root.append(node('p','Every selected existing forecast and addition must reconcile to the total. Overlapping identities or invalid contributions block complete demand; independent forecasts remain inspectable.','session-note'),action('Inspect demand contributions',()=>ctx.navigate('groupedPlanning'),true));
}
const REPORTS=[
 {name:'Original engineering workbook',description:'Seeded histories, frozen forecast, demand, constant-J curves, dated expansion and public reference evidence.',view:'legacyCapacity',prefix:'download',formats:['json','csv','svg','pdf'],requiresDemo:true},
 {name:'Selected data analysis',description:'The last displayed customer/public analysis, table and retained lineage. Chart format is available only when the selected analysis has a chart.',view:'history',ids:{json:'import-download',csv:'import-csv',svg:'import-svg'},formats:['json','csv','svg']},
 {name:'Connected capacity case',description:'Base/compared constraints, frozen demand, assumptions, allocations and supported depth profiles.',view:'comparison',prefix:'disposal',formats:['json','csv','svg']},
 {name:'Capacity parameter sweep',description:'One well and one parameter at a time, exact baseline, monthly results, unsupported allocations and source-case evidence.',view:'sensitivity',prefix:'sensitivity',formats:['json','csv','svg']},
 {name:'Independent brine PVT',description:'Bw, density, viscosity and compressibility at declared pressure, temperature and NaCl composition.',view:'pvt',prefix:'pvt',formats:['json','csv','svg']},
 {name:'Worked pressure / skin study',description:'Cited fixture, equations, units and assumed skin comparison. Separate from the active planning dataset.',view:'literature',selector:'[data-literature-download="FORMAT"]',formats:['json','csv','svg']},
 {name:'Standalone hydraulics',description:'Declared independent well/fluid/rate assumptions, hydraulic contributions and supported profiles.',view:'hydraulics',selector:'[data-hyd-export="FORMAT"]',formats:['json','csv','svg']},
 {name:'Pressure-support context',description:'Synthetic context, separate from capacity; not a pressure-support determination. Producer rates, water cut, selected injection volumes, frac annotations, exact source bytes and row lineage.',view:'pressureSupport',prefix:'pressure-support',formats:['json','csv','svg']},
];
export function renderReports(ctx,evidence=false){
 const root=$('reports-workspace');heading(root,'reports-title',evidence?'Evidence & acceptance limits':'Reports & evidence',evidence?'Input readiness, numerical validation and product acceptance are separate.':'Download current result snapshots. Each report retains its own source identity, assumptions and supported formats.');
 if(evidence){
  root.append(dataTable(['Evidence','Where retained','Meaning / limit'],[
   ['Customer source rows','Import validation and analysis JSON','File/sheet/header, original values, mapping, units, assertions and SHA-256'],
   ['Public source evidence','Selected pinned artifact or confirmed browser package; manifest, dictionary and quality report','Bounded history and recorded evidence; offline package integrity does not authenticate acquisition or establish measured BHP/injectivity'],
   ['Forecast','Input snapshots, cutoff, parameters and method version','Independent holdout; local exponential fitting, no statistical cohort model'],
   ['Engineering results','Case/PVT/sweep/study JSON and supported chart/table metadata','Declared pressure basis, units, constraints and limitations; screening, not field calibration'],
   ['Content hashes','Original workbook and supported case/sweep/study records','Consistency, not authorship or source authenticity'],
   ['Full acceptance','Requirement ledger and current evidence packet','SWD-11, comprehensive parser review, immutable refresh and two-app G2 remain open'],
  ],'Evidence and its practical boundaries'));
  root.append(node('p','Legacy Nexus volume-factor behaviour remains in retained historical/reference code. The live brine adapter is separate and source-attributed; neither old tolerance nor source agreement establishes full-domain physics validation.','scope-warning'));
  root.append(action('Inspect current source lineage',()=>ctx.navigate('lineage')));return;
 }
 const grid=node('div',undefined,'report-grid');
 for(const report of REPORTS){const card=node('article',undefined,'report-card');card.append(node('h2',report.name),node('p',report.description));const buttons=node('div',undefined,'workspace-actions');let available=false;
  for(const format of report.formats){const control=report.selector?document.querySelector(report.selector.replace('FORMAT',format)):$(report.ids?.[format]??`${report.prefix}-${format}`);const enabled=!!control&&!control.disabled&&(!report.requiresDemo||ctx.source==='demo');available||=enabled;const button=action(format.toUpperCase(),()=>{if(control&&!control.disabled){control.click();}});button.disabled=!enabled;button.setAttribute('aria-label',`Download ${report.name} ${format.toUpperCase()}`);buttons.append(button);}
  card.append(node('span',available?'Current download available':'No current result — calculate or resolve inputs',`state-tag${available?' ready':''}`),buttons,action('Open results & inputs',()=>ctx.navigate(report.view)));
  if(!report.formats.includes('pdf'))card.append(node('p','Dedicated PDF unavailable. Existing JSON / CSV / SVG remain available when their result is current.','session-note'));grid.append(card);
 }
 root.append(grid,node('p','An input edit clears dependent results and downloads. Independent PVT and the worked study keep their own inputs. No report implies full engineering or product acceptance.','scope-warning'));
}
export function renderScope(ctx){const root=$('scope-workspace');heading(root,'scope-title','Model scope & unfinished requirements','Preserve the supported screening tools while keeping unfinished engineering visible.');root.append(dataTable(['Capability','Current status','Required next evidence'],[
 ['Constant-J formation relation','Implemented screening','Declared compatible absolute bottomhole pressures and stock-tank rate basis'],
 ['Uniform / local-PVT wellbore','Implemented bounded gas-free models','Preserve geometry, pressure-domain, solver and velocity limits'],
 ['Diagnostic injectivity-history fitting','Proposed; not implemented','Synchronized diagnostic rate/pressure, datum, reservoir-pressure evidence and approved fit method'],
 ['SWD-11 layered / transient / calibrated capacity','Planned; not implemented','Separately approved method, input sufficiency, calibration evidence and independent benchmarks'],
 ['Customer / TRRC source composition','Proposed; not implemented','Identity, units/basis, coverage, revision and conflict checks'],
 ['Saved cases and maintained curve revisions','Proposed; not implemented','Approved storage/revision/assignment contract; no silent forecast replacement'],
 ],'Engineering scope ledger'));root.append(action('Open supported capacity assessment',()=>ctx.navigate('comparison'),true));}
