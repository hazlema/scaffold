import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LAYOUT,HEX_W,HEX_H,HEX_PIXELS,HEX_BOTTOM,edgeOf,cellXY} from './render.js';
import {Game,WIDTH,HEIGHT} from './engine.js';

test('hex tiles interlock: no pixel is drawn twice and the interior has no holes',()=>{
 const count=new Map();
 for(let r=0;r<6;r++)for(let c=0;c<6;c++){const {x,y}=cellXY(c,r);
  for(const [px,py] of HEX_PIXELS){const k=`${x+px},${y+py}`;count.set(k,(count.get(k)??0)+1);}}
 for(const [k,n] of count)assert.equal(n,1,`pixel ${k} drawn ${n} times`);
 const a=cellXY(1,1),b=cellXY(4,4);
 for(let y=a.y+HEX_H;y<b.y;y++)for(let x=a.x+HEX_W;x<b.x;x++)assert.ok(count.has(`${x},${y}`),`hole at ${x},${y}`);
});
test('the board with both lanes fits inside the cabinet, and nothing leaves the screen',()=>{
 const {cabinet:k,panel:p,W,H}=LAYOUT;
 const left=cellXY(-1,0).x,right=cellXY(WIDTH,1).x+HEX_W,top=cellXY(0,0).y,bottom=cellXY(0,HEIGHT-1).y+HEX_H;
 assert.ok(left>=k.x+3&&right<=k.x+k.w-3,`board x ${left}..${right}`);
 assert.ok(top>=k.y+3&&bottom+2<=k.y+k.h-3,`board y ${top}..${bottom}`);
 for(const r of [k,p])assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=W&&r.y+r.h<=H);
 assert.ok(k.x+k.w<=p.x,'panel overlaps cabinet');
});
test('tile positions follow the engine: odd rows sit half a hex right',()=>{
 const g=new Game({lanes:false});g.piece={id:8,cells:[[0,0]],q:3,r:2};
 const at=()=>{const {c,r}=g.cells()[0];return cellXY(c,r);};
 const a=at();g.down();const b=at();
 assert.deepEqual([b.x-a.x,b.y-a.y],[7,12]);// default beat steps SE from an even row
 g.flipBeat();g.down();const c=at();
 assert.deepEqual([c.x-b.x,c.y-b.y],[7,12]);// flipped beat from an odd row also goes SE
 g.down();const d=at();
 assert.deepEqual([d.x-c.x,d.y-c.y],[-7,12]);
});
test('bevel edges: top-left facets are light, bottom-right dark, the middle plain',()=>{
 assert.equal(edgeOf(6,0),'light');
 assert.equal(edgeOf(0,6),'light');
 assert.equal(edgeOf(13,6),'dark');
 assert.equal(edgeOf(7,14),'dark');
 assert.equal(edgeOf(7,7),null);
 assert.equal(HEX_BOTTOM.length,HEX_W);
 assert.equal(Math.max(...HEX_BOTTOM),HEX_H-1);
});
