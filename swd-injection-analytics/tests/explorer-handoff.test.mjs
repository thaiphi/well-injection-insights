import test from 'node:test';
import assert from 'node:assert/strict';
import {createExplorerHandoff} from '../web/explorer-handoff.mjs';

const TRANSFER='12345678-1234-4234-8234-123456789abc';
const OTHER='12345678-1234-4234-8234-123456789def';
const EXPLORER='http://127.0.0.1:4391';
const URL_BASE=`http://127.0.0.1:4290/?rrcHandoff=${TRANSFER}#data/data`;
const offerFields=()=>({artifactId:'rrc-example-v1',packageBytes:1024,hashes:{packageSha256:'a'.repeat(64),manifestSha256:'b'.repeat(64),normalizedSha256:'c'.repeat(64)},scope:{kind:'whole-version',inventoryUics:['000000001','000000002'],historyUics:['000000002'],periodStart:'2024-01-01',periodEnd:'2025-04-01'}});
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function timers(){
  let now=0,id=0;const pending=new Map();
  const set=(fn,ms,interval=false)=>{const key=++id;pending.set(key,{fn,at:now+ms,ms,interval});return key;};
  return {setTimeout:(fn,ms)=>set(fn,ms),clearTimeout:key=>pending.delete(key),setInterval:(fn,ms)=>set(fn,ms,true),clearInterval:key=>pending.delete(key),get size(){return pending.size;},tick(ms){const end=now+ms;for(;;){const next=[...pending].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;const[key,task]=next;now=task.at;if(task.interval)task.at+=task.ms;else pending.delete(key);task.fn();}now=end;}};
}
function fixture({href=URL_BASE,select,opener=true}={}){
  const clock=timers(),listeners=new Map(),states=[],sent=[],calls=[];let uuid=0;
  const producer={closed:false,postMessage:(message,target)=>sent.push({message,target})};
  const win={location:new URL(href),opener:opener?producer:null,crypto:{randomUUID:()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++uuid).padStart(12,'0')}`},addEventListener(type,listener){const set=listeners.get(type)??new Set();set.add(listener);listeners.set(type,set);},removeEventListener(type,listener){listeners.get(type)?.delete(listener);}};
  const subscribers=new Set();
  const receiver={state:{phase:'idle',message:''},cancelCount:0,adoptCount:0,subscribe(listener){subscribers.add(listener);return()=>subscribers.delete(listener);},emit(phase,message=''){this.state={phase,message};for(const listener of [...subscribers])listener(this.state);},cancel(){this.cancelCount++;this.emit('idle');},adopt(){this.adoptCount++;this.emit('adopted');},async selectTransfer(...args){calls.push(args);this.emit('loading');if(select)return select(this,...args);this.emit('preview');return true;}};
  const options={window:win,receiver,onState:s=>states.push(s),setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,setInterval:clock.setInterval,clearInterval:clock.clearInterval};
  const transport=createExplorerHandoff(options);
  const event=(type,fields={})=>({channel:'swd-explorer-handoff',version:1,type,transferId:TRANSFER,receiverId:transport.state.receiverId,...fields});
  const emit=(type,data={})=>{for(const listener of [...(listeners.get(type)??[])])listener(data);};
  const send=(data,origin=EXPLORER,source=producer)=>emit('message',{data,origin,source});
  const offer=fields=>send(event('offer',{...offerFields(),...fields}));
  const deliver=bytes=>send(event('package',{bytes:bytes??new ArrayBuffer(1024)}));
  return {clock,win,producer,receiver,transport,options,states,sent,calls,listeners,subscribers,event,emit,send,offer,deliver};
}

test('valid local start sends strict ready envelope to exact origin; repeated start is inert',()=>{
  const f=fixture();assert.equal(f.transport.start(),true);assert.equal(f.transport.start(),false);
  assert.equal(f.transport.state.phase,'ready');assert.deepEqual(f.sent,[{target:EXPLORER,message:f.event('ready')}]);f.transport.dispose();assert.equal(f.clock.size,0);assert.equal(f.subscribers.size,0);
});
test('ordinary visit stays quietly idle; invalid query, route, origin or opener shows file fallback',()=>{
  const ordinary=fixture({href:'http://127.0.0.1:4290/#data/data'});assert.equal(ordinary.transport.start(),false);assert.equal(ordinary.transport.state.phase,'idle');assert.equal(ordinary.states.length,0);
  for(const options of [{href:URL_BASE.replace(TRANSFER,'bad')},{href:URL_BASE.replace('#data/data',`&rrcHandoff=${OTHER}#data/data`)},{href:URL_BASE.replace('127.0.0.1:4290','localhost:4290')},{href:URL_BASE.replace('#data/data','#history')},{opener:false}]){
    const f=fixture(options);assert.equal(f.transport.start(),false);assert.equal(f.transport.state.phase,'unavailable');assert.match(f.transport.state.message,/complete-version.tar/);assert.equal(f.sent.length,0);assert.equal(f.clock.size,0);
  }
  const closed=fixture();closed.producer.closed=true;assert.equal(closed.transport.start(),false);
});
test('untrusted origin or source is ignored before schema; captured opener remains bound',()=>{
  const f=fixture();f.transport.start();f.send(null,'http://localhost:4391');f.send(null,EXPLORER,{});f.win.opener={};f.send(null,EXPLORER,f.win.opener);assert.equal(f.transport.state.phase,'ready');f.offer();assert.equal(f.transport.state.phase,'receiving');f.transport.dispose();
});
test('well-formed other session IDs are stale; malformed matching sender rejects',()=>{
  const f=fixture();f.transport.start();f.send(f.event('offer',{transferId:OTHER}));f.send(f.event('offer',{receiverId:OTHER}));assert.equal(f.transport.state.phase,'ready');f.send({...f.event('offer'),receiverId:'bad'});assert.equal(f.transport.state.phase,'rejected');assert.equal(f.transport.state.code,'invalid_message');
});

const malformedOffers={
  'missing field':value=>delete value.artifactId,
  'extra field':value=>value.extra=true,
  'wrong channel':value=>value.channel='other',
  'wrong version':value=>value.version=2,
  'invalid transfer UUID':value=>value.transferId='invalid',
  'empty artifact':value=>value.artifactId=' ',
  'oversized artifact':value=>value.artifactId='x'.repeat(201),
  'artifact control character':value=>value.artifactId='version\n1',
  'below minimum':value=>value.packageBytes=512,
  'over cap':value=>value.packageBytes=80_107_008,
  'unaligned count':value=>value.packageBytes=1025,
  'fractional count':value=>value.packageBytes=1024.5,
  'uppercase hash':value=>value.hashes.packageSha256='A'.repeat(64),
  'short hash':value=>value.hashes.normalizedSha256='a'.repeat(63),
  'extra hash':value=>value.hashes.extra='a'.repeat(64),
  'filtered scope':value=>value.scope.kind='filtered',
  'extra scope':value=>value.scope.extra=true,
  'unsorted UICs':value=>value.scope.inventoryUics.reverse(),
  'duplicate UICs':value=>value.scope.inventoryUics=['000000001','000000001'],
  'nonstring UIC':value=>value.scope.inventoryUics=[1],
  'short UIC':value=>value.scope.inventoryUics=['1'],
  'sparse UIC array':value=>value.scope.inventoryUics=new Array(1),
  'null start with history':value=>value.scope.periodStart=null,
  'null end with history':value=>value.scope.periodEnd=null,
  'empty history with dated coverage':value=>value.scope.historyUics=[],
  'oversized inventory':value=>value.scope.inventoryUics=Array.from({length:1001},(_,i)=>String(i).padStart(9,'0')),
  'oversized history':value=>value.scope.historyUics=Array.from({length:1001},(_,i)=>String(i).padStart(9,'0')),
  'invalid month':value=>value.scope.periodStart='2024-13-01',
  'nonmonthly date':value=>value.scope.periodStart='2024-01-02',
  'invalid year':value=>value.scope.periodStart='0000-01-01',
  'reversed period':value=>value.scope.periodStart='2026-01-01',
};
for(const[name,mutate]of Object.entries(malformedOffers))test(`strict offer rejects ${name} before selecting bytes`,()=>{const f=fixture();f.transport.start();const value=f.event('offer',offerFields());mutate(value);f.send(value);assert.equal(f.transport.state.phase,'rejected');assert.equal(f.calls.length,0);assert.equal(f.clock.size,0);assert.match(f.transport.state.message,/complete-version.tar/);});
test('inclusive package bounds and empty sorted scope arrays are valid offers',()=>{
  for(const packageBytes of [1024,80_106_496]){const f=fixture();f.transport.start();f.offer({packageBytes});assert.equal(f.transport.state.phase,'receiving');f.transport.dispose();}
  const f=fixture();f.transport.start();f.offer({scope:{...offerFields().scope,inventoryUics:[],historyUics:[],periodStart:null,periodEnd:null}});assert.equal(f.transport.state.phase,'receiving');f.transport.dispose();
});
test('retained history identities need not be an inventory subset in a whole-version offer',()=>{
  const f=fixture();f.transport.start();f.offer({scope:{...offerFields().scope,historyUics:['000000003']}});assert.equal(f.transport.state.phase,'receiving');assert.equal(f.calls.length,0);f.transport.dispose();
});
test('offer snapshots exact scope and hashes; one delivery previews but cannot adopt automatically',async()=>{
  const f=fixture();f.transport.start();const value=f.event('offer',offerFields());f.send(value);value.hashes.packageSha256='d'.repeat(64);value.scope.inventoryUics.length=0;
  const bytes=new ArrayBuffer(1024);f.deliver(bytes);await flush();assert.equal(f.transport.state.phase,'previewed');assert.equal(f.receiver.adoptCount,0);assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],bytes);assert.deepEqual(f.calls[0][1],offerFields());assert.deepEqual(f.calls[0][2],{acquisitionOrigin:'explorer_handoff',transferId:TRANSFER,receiverId:f.transport.state.receiverId});
  assert.deepEqual(f.sent.map(item=>item.message.type),['ready','request-package','status','status','status']);assert.ok(f.sent.every(item=>item.target===EXPLORER));assert.deepEqual(f.sent[1].message,f.event('request-package'));
  f.clock.tick(300_000);assert.equal(f.transport.state.phase,'previewed');f.receiver.adopt();assert.equal(f.transport.state.phase,'adopted');assert.equal(f.sent.at(-1).message.state,'adopted');assert.equal(f.clock.size,0);
});
test('producer handles package request before receiving progress status',()=>{
  const f=fixture();let requested=false;const received=[];
  f.producer.postMessage=(message,target)=>{assert.equal(target,EXPLORER);received.push(message);if(message.type==='request-package')requested=true;if(message.type==='status'&&message.state==='receiving')assert.equal(requested,true,'Analytics reported progress before package delivery was requested');};
  assert.equal(f.transport.start(),true);f.offer();assert.equal(f.transport.state.phase,'receiving');assert.deepEqual(received.map(message=>message.type),['ready','request-package','status']);assert.equal(received[2].state,'receiving');f.transport.dispose();
});
test('duplicate offers and packages do not request, validate or adopt twice',async()=>{
  let resolve;const f=fixture({select:()=>new Promise(done=>{resolve=done;})});f.transport.start();f.offer();f.offer();assert.equal(f.sent.filter(item=>item.message.type==='request-package').length,1);
  f.deliver();f.deliver();f.offer();assert.equal(f.calls.length,1);assert.equal(f.transport.state.phase,'validating');f.receiver.emit('preview');resolve(true);await flush();f.deliver();f.offer();assert.equal(f.calls.length,1);assert.equal(f.receiver.adoptCount,0);assert.equal(f.transport.state.phase,'previewed');f.transport.dispose();
});
test('out-of-order, wrong buffer, length mismatch and extra package fields reject',()=>{
  const out=fixture();out.transport.start();out.deliver();assert.equal(out.transport.state.phase,'rejected');
  for(const fields of [{bytes:new Uint8Array(1024)},{bytes:new ArrayBuffer(512)},{bytes:new ArrayBuffer(1536)},{bytes:new ArrayBuffer(1024),extra:true}]){const f=fixture();f.transport.start();f.offer();f.send(f.event('package',fields));assert.equal(f.transport.state.phase,'rejected');assert.equal(f.calls.length,0);}
  for(const data of [null,[],{},'offer']){const f=fixture();f.transport.start();f.send(data);assert.equal(f.transport.state.phase,'rejected');}
  const wrong=fixture();wrong.transport.start();wrong.send(wrong.event('status',{state:'adopted'}));assert.equal(wrong.transport.state.phase,'rejected');
});
test('offer, delivery and validation deadlines cancel pending work and ignore late validation',async()=>{
  const offer=fixture();offer.transport.start();offer.clock.tick(14_999);assert.equal(offer.transport.state.phase,'ready');offer.clock.tick(1);assert.equal(offer.transport.state.code,'offer_timeout');
  const delivery=fixture();delivery.transport.start();delivery.offer();delivery.clock.tick(29_999);assert.equal(delivery.transport.state.phase,'receiving');delivery.clock.tick(1);assert.equal(delivery.transport.state.code,'delivery_timeout');
  let resolve;const validation=fixture({select:()=>new Promise(done=>{resolve=done;})});validation.transport.start();validation.offer();validation.deliver();validation.clock.tick(30_000);assert.equal(validation.transport.state.code,'validation_timeout');assert.equal(validation.receiver.cancelCount,1);resolve(true);validation.receiver.emit('preview');await flush();assert.equal(validation.transport.state.phase,'rejected');assert.equal(validation.receiver.adoptCount,0);
});
test('explicit cancellation is idempotent, reentrant-safe and invalidates late validation',async()=>{
  let resolve;const f=fixture({select:()=>new Promise(done=>{resolve=done;})});f.transport.start();f.offer();f.deliver();assert.equal(f.transport.cancel('file_selected','A file was selected.'),true);assert.equal(f.transport.cancel(),false);assert.equal(f.receiver.cancelCount,1);assert.equal(f.sent.filter(item=>item.message.state==='cancelled').length,1);resolve(true);f.receiver.emit('preview');await flush();assert.equal(f.transport.state.phase,'cancelled');assert.equal(f.clock.size,0);
});
test('producer cancellation optional fields are bounded strings without controls',()=>{
  for(const fields of [{code:'x'.repeat(65)},{message:'x'.repeat(1025)},{code:'bad\ncode'},{message:'bad\u0000message'},{code:42},{message:{}},{code:undefined},{extra:true}]){const f=fixture();f.transport.start();f.send(f.event('cancel',fields));assert.equal(f.transport.state.phase,'rejected');}
  const f=fixture();f.transport.start();f.send(f.event('cancel',{code:'user_cancelled',message:'Stopped by Explorer.'}));assert.equal(f.transport.state.phase,'cancelled');assert.equal(f.transport.state.code,'user_cancelled');
});
test('internal errors and direct cancellation text are sanitized and bounded on wire and UI',async()=>{
  const f=fixture({select:async()=>{throw Error('x\u0000'+ 'y'.repeat(2000));}});f.transport.start();f.offer();f.deliver();await flush();assert.equal(f.transport.state.phase,'rejected');assert.ok(f.transport.state.message.length<=1024);assert.doesNotMatch(f.transport.state.message,/[\u0000-\u001f\u007f]/);assert.match(f.transport.state.message,/complete-version.tar/);assert.ok(f.sent.at(-1).message.message.length<=500);assert.match(f.sent.at(-1).message.message,/complete-version.tar/);
  const direct=fixture();direct.transport.start();direct.transport.cancel('a\n'+'b'.repeat(100),'message\n');assert.ok(direct.sent.at(-1).message.code.length<=64);assert.doesNotMatch(direct.sent.at(-1).message.code,/\n/);
});
test('outgoing cancelled and rejected statuses satisfy the producer code and message contract',()=>{
  const validProducerStatus=message=>message.type==='status'&&['cancelled','rejected'].includes(message.state)&&/^[A-Z0-9_]{1,64}$/.test(message.code)&&typeof message.message==='string'&&message.message.length<=500;
  for(const code of ['user-cancelled','validation_failed','a\n'+'b'.repeat(100),'', 'é!?','ß'.repeat(64)]){
    const f=fixture();f.transport.start();f.transport.cancel(code,'x'.repeat(2000));const status=f.sent.at(-1).message;assert.equal(validProducerStatus(status),true);assert.match(status.message,/complete-version.tar/);if(code==='user-cancelled'){assert.equal(status.code,'USER_CANCELLED');assert.equal(f.transport.state.code,code);}
  }
  const rejected=fixture();rejected.transport.start();rejected.send(null);const status=rejected.sent.at(-1).message;assert.equal(validProducerStatus(status),true);assert.equal(status.state,'rejected');assert.equal(status.code,'INVALID_MESSAGE');assert.equal(rejected.transport.state.code,'invalid_message');
});
test('closure, pagehide and navigation away cancel; same data route retains preview',async()=>{
  for(const trigger of [f=>{f.producer.closed=true;f.clock.tick(250);},f=>f.emit('pagehide'),f=>{f.win.location.hash='#history';f.emit('hashchange');},f=>{f.win.location.hash='#engineering';f.emit('popstate');}]){const f=fixture();f.transport.start();f.offer();f.deliver();await flush();assert.equal(f.transport.state.phase,'previewed');trigger(f);assert.equal(f.transport.state.phase,'cancelled');assert.equal(f.receiver.cancelCount,1);assert.equal(f.clock.size,0);}
  const f=fixture();f.transport.start();f.offer();f.deliver();await flush();f.emit('hashchange');f.emit('popstate');assert.equal(f.transport.state.phase,'previewed');f.receiver.cancel();assert.equal(f.transport.state.phase,'cancelled');assert.equal(f.receiver.cancelCount,1);
});
test('new transport replaces document owner with fresh receiver identity; disposing old owner is inert',()=>{
  const f=fixture();f.transport.start();const oldId=f.transport.state.receiverId;const newer=createExplorerHandoff(f.options);assert.equal(newer.start(),true);assert.equal(f.transport.state.phase,'cancelled');assert.notEqual(newer.state.receiverId,oldId);assert.equal(f.clock.size,2);f.transport.dispose();assert.equal(newer.state.phase,'ready');assert.equal(f.clock.size,2);newer.dispose();assert.equal(f.clock.size,0);assert.equal(newer.start(),false);
});
test('receiver failures reject without adoption and transport failures release listeners',async()=>{
  const f=fixture({select:async receiver=>{receiver.emit('error','Hash mismatch.');return false;}});f.transport.start();f.offer();f.deliver();await flush();assert.equal(f.transport.state.phase,'rejected');assert.equal(f.receiver.state.phase,'error');assert.equal(f.receiver.adoptCount,0);assert.equal(f.subscribers.size,0);
  const inconsistent=fixture({select:async()=>true});inconsistent.transport.start();inconsistent.offer();inconsistent.deliver();await flush();assert.equal(inconsistent.transport.state.phase,'rejected');assert.equal(inconsistent.receiver.cancelCount,1);
  const failed=fixture();failed.producer.postMessage=()=>{throw Error('closed');};assert.equal(failed.transport.start(),false);assert.equal(failed.transport.state.phase,'cancelled');assert.equal(failed.clock.size,0);assert.ok([...failed.listeners.values()].every(set=>set.size===0));
});
