import {validateSampleCase,checkTrrcValues,checkDerivedValues,sampleInjector,sampleGeometry,sampleFluid,gatherChecklist,checklistCsv,CLASS_LABELS} from '../dist/sampleCase.js';
import {verifyExplorerPackage,EXPLORER_PACKAGE_LIMITS} from './explorer-package.mjs';

/** Sample case: two real TRRC injectors + labelled synthetic gaps. Session-only; never mixed with customer data. */
export const PINNED_SAMPLE=Object.freeze({url:'/data/sample-case/sample-case.json',sha256:'aab8129f3e1a628137866be361d30e1a3883ee3472c4cc9b9c51f6a8772c4e76',bytes:22712,version:'swd-sample-case/1'});
export const MAX_SAMPLE_BYTES=1024*1024;
const hex=buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');

/** Size is checked before hashing, and bytes are verified before any decoding. */
async function pinnedBytes(fetch,url,{sha256,bytes},max,signal,label){
 const response=await fetch(url,{signal,cache:'no-store'});
 if(!response.ok)throw new Error(`${label} unavailable (HTTP ${response.status}).`);
 const buffer=await response.arrayBuffer();signal?.throwIfAborted();
 if(buffer.byteLength>max||buffer.byteLength!==bytes)throw new Error(`${label} has ${buffer.byteLength} bytes; expected ${bytes}. It was not decoded.`);
 const actual=hex(await crypto.subtle.digest('SHA-256',buffer));signal?.throwIfAborted();
 if(actual!==sha256)throw new Error(`${label}: SHA-256 mismatch: expected ${sha256}, received ${actual}. It was not decoded.`);
 return new Uint8Array(buffer);
}

export async function loadSampleCase({fetch=globalThis.fetch,signal,publicEvidence,pinned=PINNED_SAMPLE}={}){
 const caseBytes=await pinnedBytes(fetch,pinned.url,pinned,MAX_SAMPLE_BYTES,signal,'Sample case');
 const sample=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(caseBytes));
 const contract=validateSampleCase(sample);
 if(contract.length)throw new Error(`Sample case rejected: ${contract.join('; ')}`);
 const [wellA,wellB]=sample.wells;
 const pub=publicEvidence?.();
 if(!pub?.artifact||!pub?.pin)throw new Error('The pinned TRRC Explorer record for UIC 000020838 is not loaded yet. Try again in a moment.');
 const packageUrl=new URL(wellB.trrc.package.path,new URL(pinned.url,'http://local/')).pathname;
 const pkgBytes=await pinnedBytes(fetch,packageUrl,wellB.trrc.package,EXPLORER_PACKAGE_LIMITS.packageBytes,signal,'SAND BEND 2D package');
 const pkg=await verifyExplorerPackage(pkgBytes,{signal});
 const issues=[...checkTrrcValues(wellA,pub.artifact,pub.pin),...checkTrrcValues(wellB,pkg.artifact,pkg.pin),...sample.wells.flatMap(checkDerivedValues)];
 if(issues.length)throw new Error(`Sample case does not match its TRRC records; it was not loaded. ${issues.join('; ')}`);
 return Object.freeze({sample,sha256:pinned.sha256,caseId:sample.caseId,injectors:sample.wells.map(sampleInjector),geometry:sample.wells.map(sampleGeometry),fluid:sampleFluid(sample),
  selections:Object.freeze([Object.freeze({wellId:wellA.id,label:wellA.label,artifact:pub.artifact,pin:pub.pin,imported:false}),Object.freeze({wellId:wellB.id,label:wellB.label,...pkg,imported:true})]),
  checklist:gatherChecklist(sample)});
}

const fmtValue=v=>v===null?'Not reported':typeof v==='number'?v.toLocaleString('en-US',{maximumFractionDigits:4}):String(v);
export function sampleProvenanceRows(sample){
 return [...sample.wells.flatMap(w=>w.inputs.map(i=>[w.label,i.label,fmtValue(i.value),i.unit??'',CLASS_LABELS[i.class],i.assumption??''])),
  ...sample.shared.map(i=>['All wells',i.label,fmtValue(i.value),i.unit??'',CLASS_LABELS[i.class],i.assumption??''])];
}

/** Shows a value's class next to a pre-filled field; any later edit removes the sample claim. */
export function annotateInput(input,sampleInput,doc=document){
 if(!input)return;
 const holder=input.closest('label')??input.parentElement;holder?.querySelector('.sample-class')?.remove();
 const note=doc.createElement('small');note.className='sample-class';note.dataset.class=sampleInput.class;
 note.textContent=CLASS_LABELS[sampleInput.class]+(sampleInput.assumption?` — assumption: ${sampleInput.assumption}`:'');
 holder?.append(note);
 input.addEventListener('input',()=>{note.textContent='Edited by you — no longer the sample value';note.dataset.class='edited';},{once:true});
}
export function markEdited(scope,text){for(const note of scope.querySelectorAll('.sample-class')){note.textContent=text;note.dataset.class='edited';}}

export function sampleReportCard(session,doc=document){
 const card=doc.createElement('article');card.className='panel sample-report';card.id='sample-report';
 const h=doc.createElement('h2');h.textContent='Sample case: what you would gather';
 const p=doc.createElement('p');p.textContent=`${session.caseId}. Every input this sample used, with its class, source, units and the tools that need it. TRRC public records came from the pinned Explorer data; for a real analysis you would gather everything else.`;
 const button=doc.createElement('button');button.type='button';button.id='sample-checklist-csv';button.textContent='Download gather checklist (CSV)';
 button.onclick=()=>{const url=URL.createObjectURL(new Blob([checklistCsv(session.checklist)],{type:'text/csv;charset=utf-8'}));const a=doc.createElement('a');a.href=url;a.download='swd-sample-gather-checklist.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
 const table=doc.createElement('table'),caption=doc.createElement('caption'),head=doc.createElement('thead'),body=doc.createElement('tbody');
 caption.textContent='Gather checklist';const hr=doc.createElement('tr');
 for(const label of ['Item','Well','Class','Source','Units and basis','Needed by']){const th=doc.createElement('th');th.scope='col';th.textContent=label;hr.append(th);}
 head.append(hr);
 for(const r of session.checklist){const tr=doc.createElement('tr');for(const v of [r.item,r.well,r.class,r.source,r.units,r.neededBy]){const td=doc.createElement('td');td.textContent=v;tr.append(td);}body.append(tr);}
 table.append(caption,head,body);const wrap=doc.createElement('div');wrap.className='table-wrap';wrap.append(table);
 card.append(h,p,button,wrap);return card;
}
