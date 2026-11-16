import {buildDisposalCase} from '/dist/disposalCase.js';
import {buildTransientCase} from '/dist/transientCase.js';
import {sealTransient,verifyTransient,transientJson,transientCsv} from '/dist/transientExport.js';
import {runInterferenceCore} from '/transient-buildup.mjs';
// #7 pressure buildup worker: calculate = rebuild the disposal case from its inputs, build the transient case and seal it (interference:null, no packages);
// verify = re-verify a sealed export (with or without an interference result) before download.
// interference (#8) = rebuild the disposal case, build the transient case from the screening's subject, rebuild the package set through addPackage
// from the plain package list, build the screening and seal it with those packages (runInterferenceCore, shared with the Node tests).
self.onmessage=async event=>{
 try{
  const {action,...payload}=event.data;
  if(action==='calculate'){
   const result=buildDisposalCase(payload.caseInput);
   const sealed=await sealTransient({caseInputs:payload.caseInput,transient:buildTransientCase(result,payload.input),interference:null,packages:[]});
   self.postMessage({sealed});
  }
  else if(action==='verify'){
   if(payload.format!=='json'&&payload.format!=='csv')throw Error('Unsupported pressure buildup export format');
   const sealed=await verifyTransient(payload.sealed);
   self.postMessage({text:payload.format==='json'?transientJson(sealed):transientCsv(sealed)});
  }
  else if(action==='interference'){
   const sealed=await runInterferenceCore({caseInput:payload.caseInput,input:payload.input,packages:payload.packages});
   self.postMessage({sealed});
  }
  else throw Error('Unsupported pressure buildup operation');
 }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
