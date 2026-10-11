import {verifyExplorerPackage} from './explorer-package.mjs';
import {explorerWholeVersionScope} from './explorer-scope.mjs';
import {explorerCalculationGate,explorerRowDisposition} from './explorer-eligibility.mjs';

/** A candidate never changes the selected workspace until explicit adoption. */
export function createExplorerReceiver({verify=verifyExplorerPackage,onAdopt=()=>{},onState=()=>{}}={}) {
  let generation=0,candidate=null,adopted=null,abort=null,phase='idle',message='Choose the complete-version.tar downloaded from Explorer. Your current dataset stays selected until you confirm.';
  const listeners=new Set();
  const publish=()=>{const state={phase,message,candidate,adopted};onState(state);for(const listener of listeners)listener(state);};
  const cancel=()=>{generation++;abort?.abort();abort=null;candidate=null;phase='idle';message='Import cancelled. Your current dataset and stored pin are unchanged.';publish();};
  async function select(file,expected=null,context=null){
    const ticket=++generation;abort?.abort();abort=new AbortController();const signal=abort.signal;candidate=null;phase='loading';message='Checking package structure, source evidence, hashes, identities and quality locally…';publish();
    try {
      if(!file||typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.tar'))throw Error('Choose Explorer’s complete-version.tar file. CSV/XLSX use the separate customer importer.');
      if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>81_000_000)throw Error('Package must be nonempty and no larger than 81 MB.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(ticket!==generation)return false;
      if(bytes.byteLength!==file.size)throw Error('Package byte count changed while reading.');
      const result=await verify(bytes,{signal});
      if(ticket!==generation)return false;
      if(expected){
        const a=result.artifact,scope=explorerWholeVersionScope(a);
        if(a.artifactId!==expected.artifactId||bytes.byteLength!==expected.packageBytes)throw Error('Offered dataset identity or byte count does not match the verified archive');
        for(const key of ['packageSha256','manifestSha256','normalizedSha256'])if(result.pin[key]!==expected.hashes[key])throw Error(`Offered ${key} does not match the verified archive`);
        for(const key of Object.keys(scope))if(JSON.stringify(scope[key])!==JSON.stringify(expected.scope[key]))throw Error(`Offered whole-version scope does not match the verified archive: ${key}`);
      }
      const provenance={...result.preview.provenance,acquisitionOrigin:context?.acquisitionOrigin??'user_upload'};
      candidate={...result,preview:{...result.preview,provenance},fileName:file.name,bytes,transport:context?{...context}:null};phase='preview';message='Evidence verification passed. Review the exact version, coverage, row dispositions and calculation eligibility before adopting.';publish();return true;
    }catch(error){if(ticket!==generation)return false;candidate=null;phase='error';message=`Package rejected: ${error.message}. Your current dataset and stored pin are unchanged.`;publish();return false;}
  }
  function adopt(){if(phase!=='preview'||!candidate)return false;const selected=candidate;candidate=null;adopted=selected;generation++;phase='adopted';message=`Adopted ${selected.artifact.artifactId} for this browser session. Refresh restores the original stored pin; no server files were changed.`;onAdopt(selected);publish();return true;}
  async function selectTransfer(buffer,offer,context){
    if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<1024||buffer.byteLength>80_106_496||buffer.byteLength%512!==0||buffer.byteLength!==offer?.packageBytes){cancel();phase='error';message='Package rejected: transfer byte count is invalid. Your current dataset is unchanged.';publish();return false;}
    const bytes=buffer.slice(0),expected=structuredClone(offer),identity={...context};
    return select({name:'complete-version.tar',size:bytes.byteLength,arrayBuffer:async()=>bytes},expected,identity);
  }
  return {select,selectTransfer,cancel,adopt,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},get state(){return {phase,message,candidate,adopted};}};
}

const node=(doc,tag,text)=>{const element=doc.createElement(tag);if(text!==undefined)element.textContent=String(text);return element;};
function table(doc,headers,rows,caption){const wrapper=node(doc,'div');wrapper.className='table-scroll';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label',caption);const t=node(doc,'table');t.append(node(doc,'caption',caption));const head=node(doc,'thead'),tr=node(doc,'tr');for(const label of headers){const th=node(doc,'th',label);th.scope='col';tr.append(th);}head.append(tr);t.append(head);const body=node(doc,'tbody');for(const values of rows){const row=node(doc,'tr');for(const value of values)row.append(node(doc,'td',value??'Not reported'));body.append(row);}t.append(body);wrapper.append(t);return wrapper;}
export function mountExplorerReceiver({root,onAdopt,onBeforeSelect=()=>{}}){
  const doc=root.ownerDocument,input=root.querySelector('#explorer-package-file'),status=root.querySelector('#explorer-package-status'),preview=root.querySelector('#explorer-package-preview'),confirm=root.querySelector('#explorer-package-confirm'),cancel=root.querySelector('#explorer-package-cancel');
  const receiver=createExplorerReceiver({onAdopt,onState:state=>{
    status.textContent=state.message;status.classList.toggle('error',state.phase==='error');confirm.disabled=state.phase!=='preview';cancel.disabled=!['loading','preview','error'].includes(state.phase);preview.replaceChildren();preview.hidden=state.phase!=='preview';root.setAttribute('aria-busy',String(state.phase==='loading'));const download=root.querySelector('#explorer-package-download');download.disabled=!state.adopted;download.textContent=state.adopted?`Download preserved package · ${state.adopted.artifact.artifactId}`:'Download adopted original package';
    if(!state.candidate)return;
    const c=state.candidate,a=c.artifact,rows=a.injectionMonthly,periods=rows.map(r=>r.period_start).sort(),used=new Set(rows.map(r=>r.parent_key)),dl=node(doc,'dl');dl.className='provenance';
    const authentication=c.preview?.provenance?.authentication;
    const values={'Dataset / version':a.artifactId,'Acquisition origin':c.transport?.acquisitionOrigin==='explorer_handoff'?'User-initiated Explorer transfer':'User-provided Explorer package','Transfer identity':c.transport?.transferId??'Portable file import','Transfer scope':c.transport?'Whole preserved version, independent of Explorer filters':'Complete package','Content classification':'Public reported observations; calendar-day rates calculated','Reporting coverage':periods.length?`${periods[0]} to ${periods.at(-1)} (monthly periods)`:'Unavailable — no acquired monthly history','Calculation eligibility':explorerCalculationGate(c,{imported:true}).ready?'Eligible for public-history calculations':'Inspection only — calculations and result exports blocked',Schema:a.schemaVersion,'Transformation version':a.manifest.transformation_version??'See manifest','Package SHA-256':c.pin.packageSha256,'Manifest SHA-256':c.pin.manifestSha256,'Normalized SHA-256':c.pin.normalizedSha256,'Verified files':c.pin.filesVerified,'Source evidence boundary':authentication==='trusted_pinned_digest'?'Matches the previously trusted pinned digests. No live source authentication was performed.':'Recorded acquisition evidence and internal consistency checked. External source authentication is not established.','Pressure basis':a.dataDictionary.pressure_basis??'Reported psi; datum unspecified'};
    for(const [key,value]of Object.entries(values))dl.append(node(doc,'dt',key),node(doc,'dd',typeof value==='object'?JSON.stringify(value):value??'Not supplied'));
    preview.append(node(doc,'h3','Review this exact dataset before confirming'),dl,table(doc,['UIC','API','Lease / well','Acquired history','Reporting period','Monthly rows'],a.inventory.map(w=>{const months=rows.filter(r=>r.parent_key===w.source_record_key).map(r=>r.period_start).sort();return [w.uic_number,w.api_no,`${w.lease_name??''} / ${w.well_no_display??''}`,used.has(w.source_record_key)?'Available':'Unavailable — not zero activity',months.length?`${months[0]} to ${months.at(-1)}`:'No acquired history',months.length];}),'Exact well inventory and acquired history'));
    const quality=a.qualityReport;preview.append(table(doc,['Table','Raw','Parsed','Accepted','Quarantined','Excluded'],['inventory','monthly'].map(key=>[key,...['raw','parsed','accepted','quarantined','excluded'].map(field=>quality[key]?.[field])]),'Quality dispositions'),table(doc,['UIC','Reporting month','Liquid (bbl/month)','Calendar-day rate (bbl/day)','Reported average pressure (psi)','Source row','Disposition / reasons'],rows.slice(0,10).map(r=>[r.uic_number,r.period_start,r.injected_liquid_bbl,r.calculated_calendar_day_avg_bpd,r.reported_avg_injection_pressure_psi,r.source_row_key,explorerRowDisposition(a,r)]),`First ${Math.min(10,rows.length)} of ${rows.length} retained source rows — inspect dispositions; missing remains unavailable`),table(doc,['Source','Official URL','Retrieved','Source SHA-256'],(a.manifest.sources??[]).map(s=>[s.name,s.url,s.retrieved_at,s.sha256]),'Preserved acquisition evidence'));
    const details=node(doc,'details');details.append(node(doc,'summary','Inspect complete manifest, quality report and field dictionary'),node(doc,'pre',JSON.stringify({manifest:a.manifest,qualityReport:a.qualityReport,dataDictionary:a.dataDictionary},null,2)));preview.append(details,node(doc,'p',explorerCalculationGate(c,{imported:true}).reasons.join(' ')),node(doc,'p','Producer demand, injectivity, reservoir pressure, geometry and capacity require separate compatible inputs. No source composition or field calibration is performed.'));
    preview.append(node(doc,'p','Confirmation changes the active dataset for this session and clears dependent displayed results. It does not replace the stored pin or merge this package into your customer case.'));
  }});
  input.addEventListener('change',()=>{onBeforeSelect();const file=input.files[0];if(file)receiver.select(file);else receiver.cancel();});cancel.addEventListener('click',()=>{onBeforeSelect();receiver.cancel();input.value='';});confirm.addEventListener('click',()=>receiver.adopt());
  root.querySelector('#explorer-package-choose').addEventListener('click',()=>{onBeforeSelect();receiver.cancel();input.value='';input.click();});
  root.querySelector('#explorer-package-download').addEventListener('click',()=>{const adopted=receiver.state.adopted;if(!adopted)return;const url=URL.createObjectURL(new Blob([adopted.bytes],{type:'application/x-tar'})),link=node(doc,'a');link.href=url;link.download=`${adopted.artifact.artifactId}-complete-version.tar`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  return receiver;
}
