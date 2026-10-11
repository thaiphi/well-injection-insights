import {buildDisposalSensitivity,verifiedDisposalSensitivity,disposalSensitivityCsv} from '/dist/disposalSensitivity.js';
import {sha256Text} from '/dist/exhibitIntegrity.js';
self.onmessage=event=>{
 try{
  const {action,...payload}=event.data;
  if(action==='calculate'){const result=buildDisposalSensitivity(payload.caseInput,payload.spec);self.postMessage({result,hash:sha256Text(JSON.stringify(result))});}
  else if(action==='verify'){const result=verifiedDisposalSensitivity(payload.result);self.postMessage({result,hash:sha256Text(JSON.stringify(result)),...(payload.format==='csv'?{csv:disposalSensitivityCsv(result)}:{})});}
  else throw Error('Unsupported sensitivity operation');
 }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
