// Board geometry and all canvas drawing for the 480x270 screen.
import {WIDTH,HEIGHT,LANE,SHAPES,onBoard} from './engine.js';
import {C,PIECES,BEVEL,LIGHT_PIECES} from './palette.js';
import {drawText,wrap} from './font.js';
import {clock} from './ui.js';

export const LAYOUT={W:480,H:270,BX:156,BY:14,cabinet:{x:150,y:8,w:159,h:255},panel:{x:318,y:8,w:154,h:255}};
// Pointy-top hex, 14 wide and 15 tall; rows sit 12 apart and odd rows shift 7, so tiles interlock exactly.
export const HEX_ROWS=[[6,7],[4,9],[2,11],...Array(9).fill([0,13]),[1,12],[3,10],[5,8]];
export const HEX_W=14,HEX_H=HEX_ROWS.length;
const inHex=(x,y)=>y>=0&&y<HEX_H&&x>=HEX_ROWS[y][0]&&x<=HEX_ROWS[y][1];
export const HEX_PIXELS=HEX_ROWS.flatMap(([a,b],y)=>Array.from({length:b-a+1},(_,i)=>[a+i,y]));
export const HEX_BOTTOM=Array.from({length:HEX_W},(_,x)=>Math.max(...HEX_PIXELS.filter(p=>p[0]===x).map(p=>p[1])));
export function edgeOf(x,y){
 if(!inHex(x-1,y)||!inHex(x,y-1))return 'light';
 if(!inHex(x+1,y)||!inHex(x,y+1))return 'dark';
 return null;
}
// Lane columns (-1 and WIDTH) always keep their space so the board never shifts.
export const cellXY=(c,r)=>({x:LAYOUT.BX+14*(c+LANE)+7*(r%2),y:LAYOUT.BY+12*r});
export const rowTop=r=>LAYOUT.BY+12*r+1;


const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const TILES=new Map();
// Cached hex tile: 'solid' = filled with chamfer, 'outline' = edge only, 'dashed' = every other edge pixel.
export function tile(kind,color){
 const key=kind+color;let t=TILES.get(key);if(t)return t;
 t=canvas(HEX_W,HEX_H);const g=t.getContext('2d'),[light,dark]=BEVEL[color]??[color,color];
 for(const [x,y] of HEX_PIXELS){
  const e=edgeOf(x,y);let fill=null;
  if(kind==='solid')fill=e==='light'?light:e==='dark'?dark:color;
  else if(e&&(kind==='outline'||(x+y)%2===0))fill=color;
  if(fill){g.fillStyle=fill;g.fillRect(x,y,1,1);}
 }
 TILES.set(key,t);return t;
}
export function drawBox(ctx,x,y,w,h,fill=C.navy){
 ctx.fillStyle=C.black;ctx.fillRect(x,y,w,h);
 ctx.fillStyle=C.lavender;ctx.fillRect(x+1,y+1,w-2,2);ctx.fillRect(x+1,y+1,2,h-2);
 ctx.fillStyle=C.indigo;ctx.fillRect(x+1,y+h-3,w-2,2);ctx.fillRect(x+w-3,y+1,2,h-2);
 ctx.fillStyle=fill;ctx.fillRect(x+3,y+3,w-6,h-6);
}
// A layoutBox (ui.js) drawn as a bevelled menu; optional title and info lines sit above the rows.
export function drawItems(ctx,box,cursor,now,{title='',lines=[]}={}){
 const top=title?box.y-(lines.length?40:24):box.y;
 drawBox(ctx,box.x,top,box.w,box.y+box.h-top);
 if(title)drawText(ctx,title,box.x+box.w/2,top+8,C.yellow,2,'center');
 lines.forEach((l,i)=>drawText(ctx,l,box.x+box.w/2,top+26+i*9,C.white,1,'center'));
 box.rows.forEach((r,i)=>{
  const sel=i===cursor;
  ctx.fillStyle=sel?C.yellow:C.indigo;ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.fillStyle=sel?C.indigo:C.navy;ctx.fillRect(r.x+1,r.y+1,r.w-2,r.h-2);
  drawText(ctx,r.label,r.x+r.w/2,r.y+3,C.white,2,'center');
  if(sel&&Math.floor(now/400)%2===0)drawText(ctx,'▶',r.x+4,r.y+3,C.yellow,2);
 });
}

// Sky: palette bands and the sun from the manifest (or a fallback), then twinkling stars in the upper half.
const FALLBACK_SKY={horizon:184,sun:{x:313,y:178,r:19},bands:[C.royal,C.indigo,C.violet,C.purple,C.magenta,C.hotpink,C.orange,C.yellow].map((color,i)=>({y:i*23,h:23,color}))};
// Synthwave sun: a white disc whose lower part is cut by horizontal stripes showing the bands behind.
function drawSun(ctx,{x,y,r},horizon){
 ctx.fillStyle=C.white;
 for(let row=y-r;row<horizon;row++){
  const d=row-y;if(d>=-7&&(d+99)%3===0)continue;
  const half=Math.floor(Math.sqrt(Math.max(0,r*r-d*d)));ctx.fillRect(x-half,row,half*2+1,1);
 }
}
export const STARS=Array.from({length:24},(_,i)=>({x:(i*7919+13)%480,y:4+(i*104729+7)%88,big:i%3===0,phase:i*1.3}));
export function drawSky(ctx,manifest,now){
 const {horizon,bands,sun}=manifest?.bands?.length?manifest:FALLBACK_SKY;
 for(const b of bands){ctx.fillStyle=b.color;ctx.fillRect(0,b.y,480,b.h);}
 if(sun)drawSun(ctx,sun,horizon);
 ctx.fillStyle=C.violet;ctx.fillRect(0,horizon,480,270-horizon);
 for(const s of STARS){
  if(s.y>=horizon/2)continue;
  const twinkle=Math.sin(now/700+s.phase)>0.85;
  ctx.fillStyle=twinkle?C.cream:C.white;
  if(s.big&&!twinkle){ctx.fillRect(s.x-2,s.y,5,1);ctx.fillRect(s.x,s.y-2,1,5);}else ctx.fillRect(s.x,s.y,1,1);
 }
}
export function drawBackdrop(ctx,assets){const i=assets.images.backdrop;if(i)ctx.drawImage(i,0,0);}

// Scenery: [sprite name, x, y]. Sprites bob by 1 px; clocks drip now and then.
export const MENU_SCENERY=[['clock-island',2,18],['island-castle',10,150],['clock-winged',378,16],['island-ruins',362,124],['gem',96,96],['cube-orange-s',440,226]];
export const PLAY_SCENERY=[['clock-island',8,8],['island-sunset',14,140],['cube-blue-s',112,236]];
const DRIPS={'clock-island':[.42,.96],'clock-winged':[.47,.96],'clock-small':[.5,.96]};
export function drawSprites(ctx,assets,list,now){
 list.forEach(([name,x,y],i)=>{
  const img=assets.images[name];if(!img)return;
  const by=y+(Math.sin(now/900+i*1.7)>0?1:0);
  ctx.drawImage(img,x,by);
  const d=DRIPS[name],t=(now+i*1300)%4000;
  if(d&&t<700){ctx.fillStyle=C.cream;ctx.fillRect(Math.round(x+d[0]*img.width),Math.round(by+d[1]*img.height)+Math.floor(t/700*8),1,1);}
 });
}
// Play-screen dimming: a 1-in-4 black dither keeps every pixel on the palette.
let dimPattern=null;
export function drawDim(ctx){
 if(!dimPattern){const p=canvas(2,2),g=p.getContext('2d');g.fillStyle=C.black;g.fillRect(0,0,1,1);dimPattern=ctx.createPattern(p,'repeat');}
 ctx.fillStyle=dimPattern;ctx.fillRect(0,0,480,270);
}
export function drawLogo(ctx,assets){
 const i=assets.images.logo;
 if(i)ctx.drawImage(i,Math.round(240-i.width/2),10);
 else drawText(ctx,'SCAFFOLD',240,20,C.orange,5,'center');
}
export function drawControls(ctx){
 drawBox(ctx,92,220,296,32);
 drawText(ctx,'ARROWS STEER   UP X Z ROTATE   DOWN FASTER',240,227,C.cream,1,'center');
 drawText(ctx,'SHIFT CHANGE BEAT   SPACE DROP   P PAUSE',240,238,C.cream,1,'center');
}

const ARROWS={se:['#....','.#...','..#.#','...##','..###'],sw:['....#','...#.','#.#..','##...','###..']};
function bitmap(ctx,rows,x,y,color){ctx.fillStyle=color;rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch==='#')ctx.fillRect(x+i,y+j,1,1);}));}
function cross(ctx,x,y,color){ctx.fillStyle=color;for(let i=0;i<6;i++){ctx.fillRect(x+4+i,y+4+i,1,1);ctx.fillRect(x+9-i,y+4+i,1,1);}}
// Dashed guide line across the board at the top of row r, labelled outside the cabinet.
function guide(ctx,r,color,label,dy=0){
 const y=rowTop(r),{BX}=LAYOUT;ctx.fillStyle=color;
 for(let x=BX-3;x<BX+150;x+=4)ctx.fillRect(x,y,2,1);
 const w=label.length*6-1,lx=LAYOUT.cabinet.x-3-w;
 ctx.fillStyle=C.black;ctx.fillRect(lx-2,y-4+dy,w+4,11);
 drawText(ctx,label,lx,y-2+dy,color);
}
export function drawBoard(ctx,game,{now=0,flash=null,offcut=null}={}){
 const solidFrom=HEIGHT-game.height;
 for(let r=0;r<HEIGHT;r++){
  for(let c=0;c<WIDTH;c++){const {x,y}=cellXY(c,r),v=game.board[r][c];ctx.drawImage(v?tile('solid',PIECES[v-1]):tile('outline',r>=solidFrom?C.indigo:C.navy),x,y);}
  if(game.lanes)for(const c of [-1,WIDTH]){const {x,y}=cellXY(c,r);ctx.drawImage(tile('dashed',C.navy),x,y);}
 }
 ctx.fillStyle=C.orange;// sawtooth foundation under the bottom row
 for(let c=0;c<WIDTH;c++){const {x,y}=cellXY(c,HEIGHT-1);HEX_BOTTOM.forEach((by,i)=>ctx.fillRect(x+i,y+by+1,1,2));}
 const targetR=HEIGHT-game.target,limitR=game.limitRow();
 guide(ctx,targetR,C.yellow,'TOP');
 if(limitR>0)guide(ctx,limitR,C.hotpink,'REACH',limitR===targetR?11:0);
 if(game.status==='playing'&&!game.pending&&!game.jammed&&game.piece){
  const land=game.landing(),over=game.overReach(land),col=PIECES[game.piece.id];
  for(const {c,r} of game.cells(land)){const {x,y}=cellXY(c,r);
   if(onBoard(c))ctx.drawImage(tile('outline',over?C.hotpink:col),x,y);
   else{ctx.drawImage(tile('dashed',C.hotpink),x,y);cross(ctx,x,y,C.hotpink);}}
  for(const {c,r} of game.cells()){const {x,y}=cellXY(c,r);ctx.drawImage(tile(onBoard(c)?'solid':'dashed',col),x,y);}
  const p=game.piece,{x,y}=cellXY(p.q+Math.floor(p.r/2),p.r),mark=LIGHT_PIECES.has(col)?C.black:C.white;
  ctx.fillStyle=mark;ctx.fillRect(x+6,y+6,2,2);
  if(game.fits(game.lower())){const dir=game.stepDir();bitmap(ctx,ARROWS[dir],dir==='se'?x+8:x+1,y+8,mark);}
 }
 if(flash&&now-flash.time<850){
  const on=Math.floor((now-flash.time)/100)%2===0;
  for(const p of flash.removed){const {x,y}=cellXY(p.c,p.r);ctx.drawImage(tile('solid',on?C.white:C.hotpink),x,y);}
  const y=rowTop(flash.gap);ctx.fillStyle=C.hotpink;for(let x=LAYOUT.BX-3;x<LAYOUT.BX+150;x+=4)ctx.fillRect(x,y,2,1);
 }
 if(offcut&&now-offcut.time<400)for(const p of offcut.cells){const {x,y}=cellXY(p.c,p.r);ctx.drawImage(tile('dashed',C.orange),x,y);cross(ctx,x,y,C.orange);}
}
export function drawMini(ctx,id,cx,cy){
 const pts=SHAPES[id].cells.map(([q,r])=>[14*q+7*r,12*r]),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
 const ox=Math.round(cx-(Math.min(...xs)+Math.max(...xs)+HEX_W)/2),oy=Math.round(cy-(Math.min(...ys)+Math.max(...ys)+HEX_H)/2);
 for(const [x,y] of pts)ctx.drawImage(tile('solid',PIECES[id]),ox+x,oy+y);
}
export function drawPanel(ctx,game,{remaining,label,message}){
 const {x,y,w,h}=LAYOUT.panel,L=x+10;
 drawBox(ctx,x,y,w,h);
 drawText(ctx,'TIME',L,y+10,C.cream);
 drawText(ctx,clock(remaining),L,y+20,remaining<60000?C.hotpink:C.white,3);
 drawText(ctx,'FLOORS',L,y+50,C.cream);
 drawText(ctx,`${game.height}/${game.target}`,L,y+60,C.white,3);
 drawText(ctx,'CUTBACKS',L,y+90,C.cream);
 drawText(ctx,String(game.cuts),L,y+100,C.white,2);
 drawText(ctx,'NEXT',L,y+122,C.cream);
 drawMini(ctx,game.next,x+w/2,y+156);
 if(game.piece&&game.active()&&game.fits(game.lower()))drawText(ctx,game.stepDir()==='se'?'TICK ▶ SE':'TOCK ◀ SW',L,y+190,C.yellow);
 drawText(ctx,label,L,y+202,C.lavender);
 drawText(ctx,`GAPS ${game.gaps} REACH ${game.reach}`,L,y+212,C.lavender);
 wrap(message,22,3).forEach((line,i)=>drawText(ctx,line,L,y+226+i*9,C.white));
}
