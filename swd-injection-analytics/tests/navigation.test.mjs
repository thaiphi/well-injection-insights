import test from 'node:test';
import assert from 'node:assert/strict';
import {AREAS,WORKSPACES,routeFor,viewFromHash,mountNavigation} from '../web/navigation.mjs';
test('six areas retain direct engineering and legacy report workspaces',()=>{
 assert.equal(AREAS.length,6);assert.equal(new Set(WORKSPACES.map(w=>w.id)).size,WORKSPACES.length);
 for(const id of ['start','data','history','forecast','reconciliation','curveLibrary','schedules','groupedPlanning','publicTrends','capacity','comparison','scenarios','sensitivity','pvt','hydraulics','profiles','reports','legacyCapacity','literature','transient'])assert.ok(WORKSPACES.some(w=>w.id===id),id);
 for(const w of WORKSPACES)assert.equal(viewFromHash(routeFor(w.id)),w.id);
 assert.equal(viewFromHash('#not-a-case'),null);assert.equal(viewFromHash('#main'),null);
});
test('navigation remembers each area without losing Back/Forward route identity',()=>{
 class Element{constructor(){this.children=[];this.attributes={};this.dataset={};}replaceChildren(){this.children=[];}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}}
 const sidebar=new Element(),tabs=new Element(),area=new Element(),events=[],routes=[],callbacks={},requests=[];
 const saved=Object.fromEntries(['document','window','location','history','CustomEvent'].map(k=>[k,globalThis[k]]));
 globalThis.document={querySelector:()=>sidebar,getElementById:id=>id==='workspace-tabs'?tabs:area,createElement:()=>new Element(),createTextNode:text=>({text}),dispatchEvent:event=>events.push(event)};
 globalThis.window={addEventListener:(name,fn)=>callbacks[name]=fn};globalThis.location={hash:''};globalThis.history={pushState:(_s,_t,route)=>{routes.push(route);location.hash=route;}};globalThis.CustomEvent=class{constructor(type,opts){this.type=type;this.detail=opts.detail;}};
 try{
  const update=mountNavigation((view,opts)=>requests.push([view,opts]));assert.equal(sidebar.children.length,6);
  update('forecast');assert.equal(tabs.attributes['aria-label'],'Production & demand workspaces');assert.equal(events.at(-1).detail.view,'forecast');
  update('pvt');sidebar.children[2].onclick();assert.equal(requests.at(-1)[0],'forecast');
  location.hash='#production/reconciliation';callbacks.popstate();assert.deepEqual(requests.at(-1),['reconciliation',{record:false}]);
  const count=routes.length;update('reconciliation',{record:false});assert.equal(routes.length,count);assert.equal(tabs.children.filter(b=>b.attributes['aria-current']==='page').length,1);
 }finally{for(const[k,v]of Object.entries(saved)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
