import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const port=Number(process.env.PORT||4173);
const files=new Map([
 ['/', ['index.html','text/html; charset=utf-8']],
 ['/index.html', ['index.html','text/html; charset=utf-8']],
 ['/app.js', ['app.js','text/javascript; charset=utf-8']],
 ['/engine.js', ['engine.js','text/javascript; charset=utf-8']],
 ['/style.css', ['style.css','text/css; charset=utf-8']],
]);
const server=createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){
  res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;
 }
 const file=files.get((req.url||'/').split('?')[0]);
 if(!file){res.writeHead(404);res.end('Not found');return;}
 try{
  const bytes=await readFile(new URL(file[0],import.meta.url));
  res.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(500);res.end('Unable to load game file');}
});
server.on('error',err=>{console.error(`Cannot start Scaffold: ${err.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Scaffold: http://127.0.0.1:${port}`));
