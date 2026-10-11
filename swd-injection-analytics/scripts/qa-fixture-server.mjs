// Development-only negative and delayed-export browser cases. Never changes pinned files.
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const root=resolve('.'),mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'};
for(const [port,mode] of [[4180,'tampered-bytes'],[4181,'missing-pin'],[4189,'delayed-pdf-module']])createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(mode==='missing-pin'&&pathname==='/data/explorer-pin.json'){res.writeHead(404);res.end('QA missing pin');return;}
    const file=resolve(root,pathname==='/'?'web/index.html':/^\/(dist|data)\//.test(pathname)?pathname.slice(1):'web/'+pathname.slice(1));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    let bytes=await readFile(file);
    if(mode==='delayed-pdf-module'&&pathname==='/exhibit-pdf.mjs')await delay(1500);
    if(mode==='tampered-bytes'&&pathname==='/data/explorer/normalized.json')bytes=Buffer.concat([bytes,Buffer.from(' ')]);
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('QA file unavailable');}
}).listen(port,'127.0.0.1',()=>console.log(`QA ${mode}: http://127.0.0.1:${port}`));
