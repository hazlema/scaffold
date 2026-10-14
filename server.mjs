import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {GAME_FILES,ASSET_PATH} from './scripts/files.mjs';

const port=Number(process.env.PORT||4173);
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
function resolve(url){
 let path;try{path=decodeURIComponent((url||'/').split('?')[0]);}catch{return null;}
 if(path==='/')return 'index.html';
 const rel=path.slice(1);
 return GAME_FILES.includes(rel)||ASSET_PATH.test(rel)?rel:null;
}
const server=createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 const file=resolve(req.url);
 if(!file){res.writeHead(404);res.end('Not found');return;}
 try{
  const bytes=await readFile(new URL(file,import.meta.url));
  res.writeHead(200,{'Content-Type':TYPES[extname(file)],'Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',err=>{console.error(`Cannot start Scaffold: ${err.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Scaffold: http://127.0.0.1:${port}`));
