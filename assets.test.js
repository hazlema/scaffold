import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const PALETTE=['#030203','#121871','#14199a','#32209d','#714ec0','#9316bc','#a359e5','#e525ac','#fa5094','#fc71b2','#fd9e4b','#fee69c','#f3e6ac','#ffffff','#3fbf6a','#3ec8f0'];
const NAMES=['clock-island','clock-winged','clock-small','island-castle','island-sunset','island-ruins','island-tree','cube-orange','cube-blue','cube-pink','cube-orange-s','cube-blue-s','gem'];
const manifest=()=>JSON.parse(readFileSync(new URL('./assets/manifest.json',import.meta.url)));

test('manifest lists all 13 sprites with on-screen sizes and their files exist',()=>{
 const m=manifest();
 assert.deepEqual(Object.keys(m.sprites),NAMES);
 for(const [name,[w,h]] of Object.entries(m.sprites)){
  assert.ok(w>0&&w<=480&&h>0&&h<=270,`${name} ${w}x${h}`);
  assert.ok(existsSync(new URL(`./assets/${name}.png`,import.meta.url)),name);
 }
 for(const f of ['backdrop','logo'])assert.ok(existsSync(new URL(`./assets/${f}.png`,import.meta.url)),f);
 assert.deepEqual(m.size,[480,270]);
 assert.ok(m.logo[0]>=230&&m.logo[0]<=240,`logo width ${m.logo[0]}`);// cropping transparent edges may trim a pixel or two
});
test('sky bands are palette colors that tile the sky down to the horizon',()=>{
 const m=manifest();
 assert.ok(m.horizon>=100&&m.horizon<=250,`horizon ${m.horizon}`);
 assert.ok(m.bands.length>=5);
 let y=0;
 for(const b of m.bands){assert.equal(b.y,y);assert.ok(b.h>=3);assert.ok(PALETTE.includes(b.color),b.color);y+=b.h;}
 assert.equal(y,m.horizon);
 assert.ok(m.sun&&m.sun.r>0&&m.sun.y-m.sun.r<m.horizon,'sun must rise above the horizon');
});
