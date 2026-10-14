// Loads the converted art (scripts/assets.py). Anything missing is skipped; the game still runs.
const json=url=>fetch(url).then(r=>{if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();});
const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
export async function loadAssets(base='assets/',{fetchJson=json,loadImage=image}={}){
 const out={manifest:null,images:{}};
 try{out.manifest=await fetchJson(`${base}manifest.json`);}catch{return out;}
 const names=['backdrop','logo','logo-small',...Object.keys(out.manifest.sprites??{})];
 await Promise.all(names.map(async n=>{try{out.images[n]=await loadImage(`${base}${n}.png`);}catch{}}));
 return out;
}
