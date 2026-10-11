import {validExplorerScope} from './explorer-scope.mjs';
const EXPLORER_ORIGIN='http://127.0.0.1:4391';
const ANALYTICS_ORIGIN='http://127.0.0.1:4290';
const CHANNEL='swd-explorer-handoff';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/;
const FALLBACK=' Download Explorer’s complete-version.tar and choose it here to import the same version.';
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const safeText=(value,max=1024)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const activeDocuments=new WeakMap();
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const keys=(value,required,optional=[])=>record(value)&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));

function validOffer(value){
  return keys(value,['channel','version','type','transferId','receiverId','artifactId','packageBytes','hashes','scope'])&&
    text(value.artifactId,200)&&value.artifactId.trim().length>0&&
    Number.isSafeInteger(value.packageBytes)&&value.packageBytes>=1024&&value.packageBytes<=80_106_496&&value.packageBytes%512===0&&
    keys(value.hashes,['packageSha256','manifestSha256','normalizedSha256'])&&Object.values(value.hashes).every(hash=>typeof hash==='string'&&HASH.test(hash))&&
    validExplorerScope(value.scope);
}

/** Browser-local transport only. The receiver verifies the complete package before preview. */
export function createExplorerHandoff({window:win=window,receiver,onState=()=>{},setTimeout:schedule=win.setTimeout.bind(win),clearTimeout:unschedule=win.clearTimeout.bind(win),setInterval:repeat=win.setInterval.bind(win),clearInterval:unrepeat=win.clearInterval.bind(win)}={}){
  let state={phase:'idle',message:''},started=false,disposed=false,opener=null,offer=null,timeout=null,closureTimer=null,unsubscribe=null,ownsReceiver=false,finishing=false,generation=0;
  let transferId=null,receiverId=null;
  const envelope=type=>({channel:CHANNEL,version:1,type,transferId,receiverId});
  const publish=(phase,message,code)=>{state={phase,message:safeText(message),...(code?{code:safeText(code,64)}:{}),transferId,receiverId};onState({...state});};
  const clearDeadline=()=>{if(timeout!==null)unschedule(timeout);timeout=null;};
  function cleanup(){
    clearDeadline();if(closureTimer!==null)unrepeat(closureTimer);closureTimer=null;
    win.removeEventListener('message',onMessage);win.removeEventListener('pagehide',onPageHide);win.removeEventListener('hashchange',onNavigation);win.removeEventListener('popstate',onNavigation);
    unsubscribe?.();unsubscribe=null;if(activeDocuments.get(win)===api)activeDocuments.delete(win);
  }
  function post(type,fields={}){try{opener.postMessage({...envelope(type),...fields},EXPLORER_ORIGIN);return true;}catch{return false;}}
  function finish(phase,code,message,{cancelReceiver=true,notify=true}={}){
    if(finishing||!started||!['ready','receiving','validating','previewed'].includes(state.phase))return false;
    finishing=true;generation++;cleanup();
    const previouslyOwned=ownsReceiver;ownsReceiver=false;
    if(cancelReceiver&&previouslyOwned){try{receiver.cancel();}catch{/* Transport remains terminal if a consumer cancellation fails. */}}
    const boundedMessage=safeText(safeText(message,1024-FALLBACK.length)+FALLBACK),boundedCode=safeText(code,64);
    const wireCode=boundedCode.toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,64)||'HANDOFF_ERROR';
    const wireMessage=safeText(message,500-FALLBACK.length)+FALLBACK;
    if(notify)post('status',{state:phase,code:wireCode,message:wireMessage});
    publish(phase,boundedMessage,boundedCode);finishing=false;return true;
  }
  function cancel(code='cancelled',message='Explorer handoff cancelled. Your current dataset is unchanged.'){
    return finish('cancelled',code,message);
  }
  const reject=(code,message,options)=>finish('rejected',code,message,options);
  function deadline(ms,code,message){clearDeadline();timeout=schedule(()=>reject(code,message),ms);}
  function receiverChanged(next){
    if(finishing||!ownsReceiver||!['validating','previewed'].includes(state.phase))return;
    if(next.phase==='preview'&&state.phase==='validating'){
      clearDeadline();publish('previewed','Validation passed. Review this exact version and explicitly confirm adoption.');
      if(!post('status',{state:'previewed'}))cancel('opener_unavailable','Explorer is no longer available.');
    }else if(next.phase==='adopted'&&state.phase==='previewed'){
      generation++;cleanup();ownsReceiver=false;post('status',{state:'adopted'});publish('adopted','The reviewed Explorer version was explicitly adopted.');
    }else if(next.phase==='error')reject('validation_failed',next.message||'Explorer package verification failed.',{cancelReceiver:false});
    else if(next.phase==='idle')finish('cancelled','receiver_cancelled','Explorer package preview was cancelled.',{cancelReceiver:false});
  }
  async function receivePackage(bytes){
    const ticket=++generation;ownsReceiver=true;publish('validating','Checking the complete Explorer package and offered evidence locally…');
    deadline(30_000,'validation_timeout','Explorer package verification timed out.');
    if(!post('status',{state:'validating'})){cancel('opener_unavailable','Explorer is no longer available.');return;}
    try{
      const accepted=await receiver.selectTransfer(bytes,offer,{acquisitionOrigin:'explorer_handoff',transferId,receiverId});
      if(ticket!==generation||!['validating','previewed'].includes(state.phase))return;
      if(!accepted){reject('validation_failed',receiver.state.message||'Explorer package verification failed.',{cancelReceiver:false});return;}
      receiverChanged(receiver.state);
      if(state.phase==='validating')reject('validation_failed','Explorer package did not produce a verified preview.');
    }catch(error){if(ticket===generation)reject('validation_failed',`Explorer package verification failed: ${error?.message||'unknown error'}.`);}
  }
  function onMessage(event){
    if(event.origin!==EXPLORER_ORIGIN||event.source!==opener)return;
    if(!['ready','receiving','validating','previewed'].includes(state.phase))return;
    try{
      const value=event.data;
      if(!record(value)||value.channel!==CHANNEL||value.version!==1||!UUID.test(value.transferId)||!UUID.test(value.receiverId))throw Error('Invalid handoff envelope.');
      // A previous receiver/document may have already queued an otherwise valid message.
      if(value.transferId!==transferId||value.receiverId!==receiverId)return;
      if(value.type==='cancel'){
        if(!keys(value,['channel','version','type','transferId','receiverId'],['code','message'])||(Object.hasOwn(value,'code')&&!text(value.code,64))||(Object.hasOwn(value,'message')&&!text(value.message,1024)))throw Error('Invalid cancellation envelope.');
        cancel(value.code||'producer_cancelled',value.message||'Explorer cancelled the handoff.');return;
      }
      if(value.type==='offer'){
        if(!validOffer(value))throw Error('Invalid Explorer package offer.');
        if(state.phase!=='ready')return;
        offer={artifactId:value.artifactId,packageBytes:value.packageBytes,hashes:{...value.hashes},scope:{...value.scope,inventoryUics:[...value.scope.inventoryUics],historyUics:[...value.scope.historyUics]}};
        publish('receiving','Receiving the complete Explorer version…');deadline(30_000,'delivery_timeout','Explorer package delivery timed out.');
        if(!post('request-package')||!post('status',{state:'receiving'}))cancel('opener_unavailable','Explorer is no longer available.');return;
      }
      if(value.type==='package'){
        if(!keys(value,['channel','version','type','transferId','receiverId','bytes'])||!(value.bytes instanceof ArrayBuffer))throw Error('Invalid Explorer package envelope.');
        if(!offer)throw Error('Explorer sent a package before its offer.');
        if(value.bytes.byteLength!==offer.packageBytes)throw Error('Explorer package length differs from its offer.');
        if(state.phase!=='receiving')return;
        clearDeadline();void receivePackage(value.bytes);return;
      }
      throw Error('Unexpected Explorer handoff message.');
    }catch(error){reject('invalid_message',error.message);}
  }
  const onPageHide=()=>cancel('page_hidden','Analytics closed or reloaded before handoff completed.');
  const onNavigation=()=>{if(win.location.hash!=='#data/data')cancel('navigation','Analytics left the Explorer import page.');};
  function start(){
    if(started||disposed)return false;started=true;
    try{
      const url=new URL(win.location.href),ids=url.searchParams.getAll('rrcHandoff');
      if(ids.length===0)return false;
      if(url.origin!==ANALYTICS_ORIGIN||ids.length!==1||!UUID.test(ids[0])||url.hash!=='#data/data'||!win.opener||win.opener.closed){publish('unavailable','One-click Explorer handoff is unavailable.'+FALLBACK);return false;}
      if(typeof receiver?.selectTransfer!=='function'||typeof receiver?.subscribe!=='function'||typeof receiver?.cancel!=='function')throw Error('Explorer package receiver is unavailable.');
      transferId=ids[0];receiverId=win.crypto.randomUUID();if(!UUID.test(receiverId))throw Error('Receiver identity is unavailable.');opener=win.opener;
      activeDocuments.get(win)?.cancel('replaced','A newer Explorer handoff replaced this attempt.');activeDocuments.set(win,api);
      publish('ready','Waiting for Explorer’s complete-version package offer…');
      win.addEventListener('message',onMessage);win.addEventListener('pagehide',onPageHide);win.addEventListener('hashchange',onNavigation);win.addEventListener('popstate',onNavigation);
      unsubscribe=receiver.subscribe(receiverChanged);
      closureTimer=repeat(()=>{try{if(opener.closed)cancel('opener_closed','Explorer closed before handoff completed.');}catch{cancel('opener_unavailable','Explorer is no longer available.');}},250);
      deadline(15_000,'offer_timeout','Explorer did not offer a package in time.');
      if(!post('ready')){cancel('opener_unavailable','Explorer is no longer available.');return false;}return true;
    }catch(error){cleanup();publish('unavailable',error.message+FALLBACK);return false;}
  }
  function dispose(){if(disposed)return;cancel('disposed','Explorer handoff was closed.');cleanup();disposed=true;}
  const api={start,cancel,dispose,get state(){return {...state};}};return api;
}
