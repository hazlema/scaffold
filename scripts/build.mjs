import {mkdir,copyFile,readdir,rm} from 'node:fs/promises';
import {GAME_FILES,ASSET_PATH} from './files.mjs';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await rm(dist,{recursive:true,force:true});
await mkdir(new URL('assets/',dist),{recursive:true});
for(const file of GAME_FILES)await copyFile(new URL(file,root),new URL(file,dist));
for(const name of await readdir(new URL('assets/',root)))if(ASSET_PATH.test(`assets/${name}`))await copyFile(new URL(`assets/${name}`,root),new URL(`assets/${name}`,dist));
console.log('Scaffold static files ready in dist/');
