import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LAYOUT,HEX_W,HEX_H,HEX_PIXELS,HEX_BOTTOM,edgeOf,cellXY,PANEL_LINES,BANNER,bannerHeight,SCORE_TABLE,LAYOUTS,useLayout,BUTTON_R} from './render.js';
import {BUTTONS} from './touch.js';
import {layoutBox} from './ui.js';
import {measure} from './font.js';
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


test('readout panel lines stay inside the panel',()=>{
 const p=LAYOUT.panel,L=PANEL_LINES;
 assert.ok(L.timeDigits+21<=L.level&&L.levelDigits+14<=L.score&&L.scoreDigits+14<=L.floors&&L.floorsDigits+14<=L.next);
 assert.ok(L.message+2*9+7<=p.h-3,'message runs past the panel');
 assert.ok(measure('00:00',3)<=p.w-20&&measure('12/12',2)<=p.w-20&&measure('MEDIUM  CUTS 99',1)<=p.w-20);
});
test('banners fit over the board, even with summary, score and initials',()=>{
 const h=bannerHeight({lines:['MEDIUM  LEVEL 12','144 FLOORS','TYPE INITIALS, ENTER'],big:'288',slots:['A','B','C']});
 const k=LAYOUT.cabinet;
 assert.ok(BANNER.y>=k.y&&BANNER.y+h<=k.y+k.h,`banner height ${h}`);
 assert.ok(BANNER.cx-BANNER.w/2>=k.x&&BANNER.cx+BANNER.w/2<=k.x+k.w);
 for(const t of ['RUN OVER','LEVEL 12'])assert.ok(measure(t,2)<=BANNER.w-8,t);
 assert.ok(measure('MEDIUM  LEVEL 12',1)<=BANNER.w-8);
 assert.ok(measure('TYPE INITIALS, ENTER',1)<=BANNER.w-8);
});
test('a full score table, its summary line and its buttons fit the screen',()=>{
 const t=SCORE_TABLE;
 assert.ok(t.y+t.rowY+9*t.rowH+14<=t.y+t.h-3,'tenth row runs past the table');
 assert.ok(18+measure('10  A 1  99999  H  L99',2)<=t.w-3,'rows too wide');
 assert.ok(measure('MEDIUM  LEVEL 12  144 FLOORS  SCORE 288',1)<=t.w-8);
 const actions=layoutBox(['AGAIN','MENU'],{y:220,scale:1,minWidth:120});
 assert.ok(t.y+t.h<=actions.y&&actions.y+actions.h<=270);
});

test('useLayout switches the board origin and screen size; wide is the default',()=>{
 assert.equal(LAYOUT.name,'wide');
 assert.equal(cellXY(0,0).x,170);
 useLayout('tall');
 try{
  assert.deepEqual([LAYOUT.W,LAYOUT.H],[270,330]);
  assert.equal(cellXY(-1,0).x,62);
  assert.equal(cellXY(0,0).y,58);
  assert.equal(BANNER.cx,135);
 }finally{useLayout('wide');}
 assert.equal(cellXY(-1,0).x,156);
 assert.equal(BANNER.cx,229);
});
test('tall: the board, table, actions, banner and menus fit 270x330',()=>{
 useLayout('tall');
 try{
  const {cabinet:k,W,H,table:t,banner:b}=LAYOUT;
  const left=cellXY(-1,0).x,right=cellXY(WIDTH,1).x+HEX_W,bottom=cellXY(0,HEIGHT-1).y+HEX_H;
  assert.ok(left>=k.x+3&&right<=k.x+k.w-3&&cellXY(0,0).y>=k.y+3&&bottom+2<=k.y+k.h-3,'board in cabinet');
  assert.ok(k.x+k.w<=W&&k.y+k.h<=H-20,'room for two message lines');
  assert.ok(t.x>=0&&t.x+t.w<=W&&t.y+t.h<=LAYOUT.actionsY);
  assert.ok(t.rowX+measure('10  A 1  99999  H  L99',t.scale)<=t.w-3);
  assert.ok(measure('MEDIUM  LEVEL 12  144 FLOORS  SCORE 288',1)<=t.w-8);
  assert.ok(t.rowY+9*t.rowH+7*t.scale<=t.h-3);
  const actions=layoutBox(['AGAIN','MENU'],{cx:W/2,y:LAYOUT.actionsY,scale:1,minWidth:120});
  assert.ok(actions.x>=0&&actions.x+actions.w<=W&&actions.y+actions.h<=H);
  const h=bannerHeight({lines:['MEDIUM  LEVEL 12','144 FLOORS','R V LETTER, B SAVE'],big:'288',slots:['A','B','C']});
  assert.ok(b.y>=k.y&&b.y+h<=k.y+k.h&&b.cx-BANNER.w/2>=k.x&&b.cx+BANNER.w/2<=k.x+k.w,'banner over board');
  const menu=layoutBox(['EASY','MEDIUM','HARD','HIGH SCORES','SETTINGS'],{cx:W/2,y:72,minWidth:120});
  assert.ok(menu.x>=0&&menu.x+menu.w<=W&&menu.y+menu.h<=222);
  const settings=layoutBox(['EDGE LANES OFF','SOUND OFF','SCANLINES 0.6','BACK'],{cx:W/2,y:80,minWidth:200});
  assert.ok(settings.x>=0&&settings.x+settings.w<=W);
 }finally{useLayout('wide');}
});

test('tall: buttons sit in the side strips, clear of the cabinet, each other and the screen edge',()=>{
 const {cabinet:k,W,H}=LAYOUTS.tall,half=BUTTON_R*Math.sqrt(3)/2+1;
 for(const b of BUTTONS){
  assert.ok(b.x-half>=0&&b.x+half<=W&&b.y+BUTTON_R+1<=H,b.name);
  assert.ok(b.x+half<=k.x||b.x-half>=k.x+k.w,`${b.name} overlaps the board`);
 }
 for(const a of BUTTONS)for(const c of BUTTONS)if(a!==c)assert.ok(Math.hypot(a.x-c.x,a.y-c.y)>=2*half,`${a.name}/${c.name}`);
});
test('tall readout strip, side labels and message lines fit',()=>{
 const s=LAYOUTS.tall.strip,k=LAYOUTS.tall.cabinet;
 assert.ok(8+measure('05:00',2)<=80,'clock');
 assert.ok(80+measure('FLOORS 12/12',1)<=170&&80+measure('SCORE 999999',1)<=170,'middle column');
 assert.ok(170+measure('GAPS 0 REACH 4',1)<=s.w-3&&26+7<=s.h-3,'right column');
 assert.ok(4+measure('NEXT',1)<=k.x&&219+measure('TICK',1)<=270&&230+measure('▶',3)<=270,'side labels');
 assert.ok(6+measure('X'.repeat(42),1)<=264&&320+7<=LAYOUTS.tall.H,'message');
});
