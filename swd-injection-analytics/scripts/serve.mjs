import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep,basename} from 'node:path';
const root=resolve('.'),port=Number(process.env.PORT??4173),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8','.svg':'image/svg+xml; charset=utf-8','.pdf':'application/pdf'};
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const pathname=decodeURIComponent(url.pathname);
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
    const prefix=['/dist/','/data/','/reference/','/exhibits/','/output/pdf/'].find(prefix=>pathname.startsWith(prefix));
    const routeRoot=resolve(root,prefix?prefix.slice(1):'web');
    const relative=prefix?pathname.slice(prefix.length):pathname==='/'?'index.html':pathname.slice(1);
    const path=resolve(routeRoot,relative);
    if(!path.startsWith(routeRoot+sep)){res.writeHead(403);res.end('Forbidden');return;}
    if(!(await stat(path)).isFile())throw new Error('Not a file');
    const bytes=await readFile(path);
    const headers={'Content-Type':mime[extname(path)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(url.searchParams.get('download')==='1'&&(prefix==='/exhibits/'||prefix==='/output/pdf/'))headers['Content-Disposition']=`attachment; filename="${basename(path).replace(/["\r\n]/g,'_')}"`;
    res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('File not found');}
}).listen(port,host,()=>console.log(`SWD Analytics http://${host}:${port}`));
