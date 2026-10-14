/** Navigation identities describe workspaces, never saved cases or calculation revisions. */
export const AREAS = [
 {id:'start',label:'Start',icon:'⌂',tabs:[['start','Assessment'],['legacyCapacity','Original workbook'],['literature','Worked pressure / skin study']]},
 {id:'data',label:'Data & sources',icon:'▤',tabs:[['data','Sources & import'],['readiness','Readiness'],['lineage','Source lineage']]},
 {id:'production',label:'Production & demand',icon:'▥',tabs:[['history','Histories'],['forecast','Fit & forecast'],['reconciliation','Reconciliation'],['curveLibrary','Curve library'],['schedules','Schedules'],['groupedPlanning','Demand']]},
 {id:'injection',label:'Injection & capacity',icon:'◴',tabs:[['publicTrends','Injector history'],['capacity','Injectivity'],['comparison','Capacity assessment'],['scenarios','Scenarios'],['sensitivity','Parameter sweeps'],['transient','Model scope']]},
 {id:'fluid',label:'Fluid & wellbore',icon:'♧',tabs:[['pvt','Brine PVT'],['hydraulics','Hydraulics'],['profiles','Profiles']]},
 {id:'reports',label:'Reports & evidence',icon:'▧',tabs:[['reports','Reports'],['evidence','Evidence & limitations']]},
];
export const WORKSPACES=AREAS.flatMap(area=>area.tabs.map(([id,label])=>({id,label,area:area.id,areaLabel:area.label})));
export function workspace(view){return WORKSPACES.find(w=>w.id===view)??WORKSPACES[0];}
export function routeFor(view){const w=workspace(view);return `#${w.area}/${w.id}`;}
export function viewFromHash(hash){const id=hash.replace(/^#/,'').split('/').at(-1);return WORKSPACES.some(w=>w.id===id)?id:null;}
export function mountNavigation(navigate){
 const sidebar=document.querySelector('.sidebar nav'),tabs=document.getElementById('workspace-tabs'),remembered=new Map();
 sidebar.replaceChildren();
 for(const area of AREAS){const button=document.createElement('button');button.type='button';button.dataset.area=area.id;const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent=area.icon;button.append(icon,document.createTextNode(area.label));button.onclick=()=>navigate(remembered.get(area.id)??area.tabs[0][0]);sidebar.append(button);}
 const update=(view,{record=true}={})=>{
  const w=workspace(view),area=AREAS.find(a=>a.id===w.area);remembered.set(area.id,w.id);
  for(const button of sidebar.children){if(button.dataset.area===area.id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  tabs.replaceChildren();tabs.setAttribute('aria-label',`${area.label} workspaces`);
  for(const [id,label]of area.tabs){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.workspace=id;if(id===w.id)button.setAttribute('aria-current','page');button.onclick=()=>navigate(id);tabs.append(button);}
  document.getElementById('workspace-area').textContent=area.label;
  if(record&&location.hash!==routeFor(w.id))history.pushState(null,'',routeFor(w.id));
  document.dispatchEvent(new CustomEvent('workspace-navigation',{detail:{view:w.id,area:w.area}}));
 };
 window.addEventListener('popstate',()=>navigate(viewFromHash(location.hash)??'start',{record:false}));
 return update;
}
