import {buildPerformanceCases} from '/dist/performanceCases.js';
import {verifyCaseInsights,caseInsightsJson,caseInsightsCsv} from '/dist/caseInsights.js';
self.onmessage=async event=>{
 try{
  const {action,...payload}=event.data;
  if(action==='calculate'){const result=buildPerformanceCases(payload.caseInput,payload.spec);self.postMessage({result});}
  else if(action==='verify'){
   if(payload.format!=='json'&&payload.format!=='csv')throw Error('Unsupported case insights export format');
   const sealed=await verifyCaseInsights(payload.sealed);
   self.postMessage({text:payload.format==='json'?caseInsightsJson(sealed):caseInsightsCsv(sealed)});
  }
  else throw Error('Unsupported case insights operation');
 }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
