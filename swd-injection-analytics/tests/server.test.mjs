import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {once} from 'node:events';
import {syntheticActuals,freezeForecast,planningCase} from '../dist/planning.js';
import {INJECTORS} from '../dist/engineering.js';
import {buildExhibit} from '../dist/exhibit.js';
import {exhibitSvg} from '../dist/exhibitSvg.js';

test('Preview serves exact exhibit files and confines decoded routes to their intended roots',async()=>{
  const actuals=syntheticActuals(),frozen=freezeForecast(actuals);
  const exhibit=await buildExhibit({frozen,rows:planningCase(frozen,actuals,INJECTORS),injectors:INJECTORS,controls:{newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000}});
  const bytes=Buffer.from(exhibitSvg(exhibit)),name=`qa-http-${process.pid}.svg`,fixture=`exhibits/${name}`;
  await mkdir('exhibits',{recursive:true});await writeFile(fixture,bytes);
  const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:'4188'},stdio:['ignore','pipe','pipe']});
  let stderr='';server.stderr.on('data',chunk=>{stderr+=chunk;});
  try{
    await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error(stderr||'Preview stopped before ready');})]);
    const base='http://127.0.0.1:4188';
    const svg=await fetch(`${base}/exhibits/${name}?download=1`);
    assert.equal(svg.status,200);assert.match(svg.headers.get('content-type'),/^image\/svg\+xml/);
    assert.equal(svg.headers.get('content-disposition'),`attachment; filename="${name}"`);
    assert.equal(Number(svg.headers.get('content-length')),bytes.length);
    assert.deepEqual(Buffer.from(await svg.arrayBuffer()),bytes);
    const head=await fetch(`${base}/data/explorer-pin.json`,{method:'HEAD'});
    assert.equal(head.status,200);assert.equal(await head.text(),'');
    for(const path of ['/exhibits/%2e%2e%5cpackage.json','/data/%2e%2e%5cpackage.json','/reference/%2e%2e%2fpackage.json','/%2e%2e%5cpackage.json','/output/pdf/%2e%2e%5c%2e%2e%5cpackage.json']){
      const response=await fetch(base+path);assert.ok([403,404].includes(response.status),`${path} returned ${response.status}`);
    }
    assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  }finally{
    if(server.exitCode===null&&server.signalCode===null){const closed=once(server,'exit');server.kill();await closed;}
    await unlink(fixture);
  }
});
