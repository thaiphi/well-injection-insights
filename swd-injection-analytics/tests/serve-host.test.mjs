import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const start=async(env)=>{
  const rest=Object.fromEntries(Object.entries(process.env).filter(([k])=>k.toUpperCase()!=='HOST'));
  const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...rest,...env},stdio:['ignore','pipe','pipe']});
  let stderr='';server.stderr.on('data',chunk=>{stderr+=chunk;});
  const [line]=await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error(stderr||'Preview stopped before ready');})]);
  return {server,line:String(line).trim()};
};
const stop=async server=>{if(server.exitCode===null&&server.signalCode===null){const closed=once(server,'exit');server.kill();await closed;}};

test('Preview listens on 127.0.0.1 when HOST is unset',async()=>{
  const {server,line}=await start({PORT:'4192'});
  try{
    assert.equal(line,'SWD Analytics http://127.0.0.1:4192');
    assert.equal((await fetch('http://127.0.0.1:4192/',{method:'HEAD'})).status,200);
  }finally{await stop(server);}
});

test('Preview listens on HOST when set and stays GET/HEAD only',async()=>{
  const {server,line}=await start({PORT:'4193',HOST:'0.0.0.0'});
  try{
    assert.equal(line,'SWD Analytics http://0.0.0.0:4193');
    assert.equal((await fetch('http://127.0.0.1:4193/')).status,200);
    assert.equal((await fetch('http://127.0.0.1:4193/',{method:'POST'})).status,405);
  }finally{await stop(server);}
});
