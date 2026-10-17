// Usage: node cdp.mjs <script.js> [width height mobile]
// Opens a fresh target at about:blank, then runs the script's default-exported async body via Runtime.evaluate.
// The script body receives helpers: go(url), sleep(ms), q(js) via the page itself; it is evaluated as page JS.
import {readFileSync} from 'node:fs';
const [file,w='1280',h='900',mobile='0']=process.argv.slice(2);
const body=readFileSync(file,'utf8');
const t=await (await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
await send('Emulation.setDeviceMetricsOverride',{width:+w,height:+h,deviceScaleFactor:1,mobile:mobile==='1'});
await send('Page.enable');await send('Runtime.enable');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails).slice(0,800));return r.result?.result?.value;};
// Steps: lines starting with "@go URL" navigate; "@wait EXPR" polls until truthy (30s); other blocks separated by "\n---\n" are evaluated and printed.
for(const step of body.split('\n---\n')){
 const s=step.trim();if(!s)continue;
 if(s.startsWith('@go ')){await send('Page.navigate',{url:s.slice(4).trim()});await sleep(1500);continue;}
 if(s.startsWith('@sleep ')){await sleep(+s.slice(7));continue;}
 if(s.startsWith('@wait ')){const expr=s.slice(6);const start=Date.now();let ok=false;while(Date.now()-start<60000){try{if(await ev(expr)){ok=true;break;}}catch{}await sleep(200);}console.log('WAIT',ok?'ok':'TIMEOUT',expr.slice(0,80));continue;}
 try{console.log(JSON.stringify(await ev(`(async()=>{${s}})()`)));}catch(e){console.log('ERR',e.message);}
}
await fetch('http://127.0.0.1:9333/json/close/'+t.id);ws.close();process.exit(0);
