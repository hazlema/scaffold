// Board geometry and all canvas drawing for the 480x270 screen.
import {WIDTH,HEIGHT,LANE,SHAPES,onBoard} from './engine.js';
import {C,PIECES,BEVEL,LIGHT_PIECES} from './palette.js';
import {drawText,wrap,measure} from './font.js';
import {scoreRow} from './scores.js';
import {clock} from './ui.js';
import {BUTTONS} from './touch.js';

// Two screens: wide (desktop) and tall (a phone held upright). LAYOUT is the active one, mutated in place
// by useLayout so everything that reads it (cellXY, banners, boxes, the table) follows the screen.
export const LAYOUTS={
 wide:{name:'wide',W:480,H:270,BX:156,BY:14,cabinet:{x:150,y:8,w:159,h:255},panel:{x:318,y:8,w:154,h:255},
  banner:{cx:229,y:70},table:{x:90,y:6,w:300,h:210,rowY:44,rowH:16,scale:2,rowX:18},actionsY:220,skyShift:0},
 tall:{name:'tall',W:270,H:330,BX:62,BY:58,cabinet:{x:56,y:52,w:159,h:255},strip:{x:4,y:4,w:262,h:40},
  banner:{cx:135,y:90},table:{x:10,y:40,w:250,h:200,rowY:44,rowH:12,scale:1,rowX:56},actionsY:250,skyShift:105},
};
export const LAYOUT={...LAYOUTS.wide};
export function useLayout(name){for(const k of Object.keys(LAYOUT))delete LAYOUT[k];return Object.assign(LAYOUT,LAYOUTS[name]);}
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
  const s=box.scale??2;
  drawText(ctx,r.label,r.x+r.w/2,r.y+3,C.white,s,'center');
  if(sel&&Math.floor(now/400)%2===0)drawText(ctx,'▶',r.x+4,r.y+3,C.yellow,s);
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
 const {horizon,bands,sun}=manifest?.bands?.length?manifest:FALLBACK_SKY,{W,H,skyShift}=LAYOUT;
 for(const b of bands){ctx.fillStyle=b.color;ctx.fillRect(0,b.y,W,b.h);}
 if(sun)drawSun(ctx,{...sun,x:sun.x-skyShift},horizon);
 ctx.fillStyle=C.violet;ctx.fillRect(0,horizon,W,H-horizon);
 for(const s of STARS){
  const sx=s.x-skyShift;if(s.y>=horizon/2||sx<2||sx>W-3)continue;
  const twinkle=Math.sin(now/700+s.phase)>0.85;
  ctx.fillStyle=twinkle?C.cream:C.white;
  if(s.big&&!twinkle){ctx.fillRect(sx-2,s.y,5,1);ctx.fillRect(sx,s.y-2,1,5);}else ctx.fillRect(sx,s.y,1,1);
 }
}
// The tall screen shows the middle of the wide backdrop.
export function drawBackdrop(ctx,assets){const i=assets.images.backdrop;if(i)ctx.drawImage(i,-LAYOUT.skyShift,0);}

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
 ctx.fillStyle=dimPattern;ctx.fillRect(0,0,LAYOUT.W,LAYOUT.H);
}
export function drawLogo(ctx,assets){
 const i=assets.images.logo,cx=LAYOUT.W/2;
 if(i)ctx.drawImage(i,Math.round(cx-i.width/2),10);
 else drawText(ctx,'SCAFFOLD',cx,20,C.orange,5,'center');
}
export function drawControls(ctx){
 if(LAYOUT.name==='tall'){drawBox(ctx,75,222,120,20);drawText(ctx,'TAP TO CHOOSE',135,229,C.cream,1,'center');return;}
 drawBox(ctx,92,220,296,32);
 drawText(ctx,'ARROWS STEER   UP X Z ROTATE   DOWN FASTER',240,227,C.cream,1,'center');
 drawText(ctx,'SHIFT CHANGE BEAT   SPACE DROP   P PAUSE',240,238,C.cream,1,'center');
}

const ARROWS={se:['#....','.#...','..#.#','...##','..###'],sw:['....#','...#.','#.#..','##...','###..']};
function bitmap(ctx,rows,x,y,color){ctx.fillStyle=color;rows.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch==='#')ctx.fillRect(x+i,y+j,1,1);}));}
function cross(ctx,x,y,color){ctx.fillStyle=color;for(let i=0;i<6;i++){ctx.fillRect(x+4+i,y+4+i,1,1);ctx.fillRect(x+9-i,y+4+i,1,1);}}
// Guide line across the board at the top of row r; solid lines are 2 px. Wide labels sit outside the cabinet;
// on the tall screen the side strips are taken, so labels sit just above the line inside the board's left edge.
function guide(ctx,r,color,label,{dy=0,solid=false}={}){
 const y=rowTop(r),{BX}=LAYOUT;ctx.fillStyle=color;
 if(solid)ctx.fillRect(BX-3,y-1,153,2);
 else for(let x=BX-3;x<BX+150;x+=4)ctx.fillRect(x,y,2,1);
 const w=label.length*6-1,inside=LAYOUT.name==='tall';
 const lx=inside?BX+2:LAYOUT.cabinet.x-3-w,ly=inside?y-11-dy:y-2+dy;
 ctx.fillStyle=C.black;ctx.fillRect(lx-2,ly-2,w+4,11);
 drawText(ctx,label,lx,ly,color);
}
export function drawBoard(ctx,game,{now=0,flash=null,offcut=null}={}){
 const solidFrom=HEIGHT-game.height,goalR=HEIGHT-game.target;
 for(let r=0;r<HEIGHT;r++){
  for(let c=0;c<WIDTH;c++){const {x,y}=cellXY(c,r),v=game.board[r][c];ctx.drawImage(v?tile('solid',PIECES[v-1]):tile('outline',r>=solidFrom?C.indigo:r<goalR?C.black:C.navy),x,y);}
  if(game.lanes)for(const c of [-1,WIDTH]){const {x,y}=cellXY(c,r);ctx.drawImage(tile('dashed',C.navy),x,y);}
 }
 ctx.fillStyle=C.orange;// sawtooth foundation under the bottom row
 for(let c=0;c<WIDTH;c++){const {x,y}=cellXY(c,HEIGHT-1);HEX_BOTTOM.forEach((by,i)=>ctx.fillRect(x+i,y+by+1,1,2));}
 const targetR=HEIGHT-game.target,limitR=game.limitRow();
 guide(ctx,targetR,C.yellow,'GOAL',{solid:true});
 if(limitR>0)guide(ctx,limitR,C.hotpink,'REACH',{dy:limitR===targetR?11:0});
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
export const PANEL_LINES={time:10,timeDigits:20,level:48,levelDigits:58,score:76,scoreDigits:86,floors:104,floorsDigits:114,next:134,mini:162,beat:190,diff:202,rules:212,message:226};
export function drawPanel(ctx,game,{remaining,label,message,level=1,score=0}){
 const {x,y,w,h}=LAYOUT.panel,L=x+10,P=PANEL_LINES;
 drawBox(ctx,x,y,w,h);
 drawText(ctx,'TIME',L,y+P.time,C.cream);
 drawText(ctx,clock(remaining),L,y+P.timeDigits,remaining<60000?C.hotpink:C.white,3);
 drawText(ctx,'LEVEL',L,y+P.level,C.cream);
 drawText(ctx,String(level),L,y+P.levelDigits,C.white,2);
 drawText(ctx,'SCORE',L,y+P.score,C.cream);
 drawText(ctx,String(score),L,y+P.scoreDigits,C.white,2);
 drawText(ctx,'FLOORS',L,y+P.floors,C.cream);
 drawText(ctx,`${game.height}/${game.target}`,L,y+P.floorsDigits,C.white,2);
 drawText(ctx,'NEXT',L,y+P.next,C.cream);
 drawMini(ctx,game.next,x+w/2,y+P.mini);
 if(game.piece&&game.active()&&game.fits(game.lower()))drawText(ctx,game.stepDir()==='se'?'TICK ▶ SE':'TOCK ◀ SW',L,y+P.beat,C.yellow);
 drawText(ctx,`${label}  CUTS ${game.cuts}`,L,y+P.diff,C.lavender);
 drawText(ctx,`GAPS ${game.gaps} REACH ${game.reach}`,L,y+P.rules,C.lavender);
 wrap(message,22,3).forEach((line,i)=>drawText(ctx,line,L,y+P.message+i*9,C.white));
}

// A box over the board with a title, info lines, an optional big number and optional initials slots.
export const BANNER={w:140,get cx(){return LAYOUT.banner.cx;},get y(){return LAYOUT.banner.y;}};
export const bannerHeight=({lines=[],big='',slots=null})=>28+lines.length*9+(big?27:0)+(slots?30:0)+6;
export function drawBanner(ctx,{title,lines=[],big='',slots=null,slot=-1,now=0}){
 const h=bannerHeight({lines,big,slots}),x=Math.round(BANNER.cx-BANNER.w/2);
 drawBox(ctx,x,BANNER.y,BANNER.w,h);
 let cy=BANNER.y+8;
 drawText(ctx,title,BANNER.cx,cy,C.yellow,2,'center');cy+=20;
 for(const l of lines){drawText(ctx,l,BANNER.cx,cy,C.white,1,'center');cy+=9;}
 if(big){cy+=3;drawText(ctx,big,BANNER.cx,cy,C.white,3,'center');cy+=24;}
 if(slots){
  cy+=4;const x0=Math.round(BANNER.cx-measure(slots.join(''),3)/2);
  slots.forEach((ch,i)=>{
   const sx=x0+i*18;drawText(ctx,ch,sx,cy,i===slot?C.yellow:C.white,3);
   const on=i!==slot||Math.floor(now/300)%2===0;
   if(on){ctx.fillStyle=i===slot?C.yellow:C.lavender;ctx.fillRect(sx,cy+23,15,i===slot?2:1);}
  });
 }
}
// The top-10 table: rank, initials, score, difficulty letter, level. The new entry blinks.
export const SCORE_TABLE=LAYOUTS.wide.table;
export function drawScoreTable(ctx,entries,highlight,now,{title='HIGH SCORES',line=''}={}){
 const t=LAYOUT.table,cx=t.x+t.w/2;
 drawBox(ctx,t.x,t.y,t.w,t.h);
 drawText(ctx,title,cx,t.y+8,C.yellow,2,'center');
 if(line)drawText(ctx,line,cx,t.y+28,C.cream,1,'center');
 if(!entries.length)drawText(ctx,'NO SCORES YET',cx,t.y+100,C.lavender,2,'center');
 entries.forEach((x,i)=>{
  const color=i===highlight?(Math.floor(now/300)%2===0?C.yellow:C.orange):C.white;
  drawText(ctx,scoreRow(i,x),t.x+t.rowX,t.y+t.rowY+i*t.rowH,color,t.scale);
 });
}

// ---- Tall (phone) screen ----
// Text on the sunset gets a black backing so it stays readable on every band.
function tag(ctx,text,x,y,color,scale=1){
 ctx.fillStyle=C.black;ctx.fillRect(x-1,y-1,measure(text,scale)+2,7*scale+2);
 drawText(ctx,text,x,y,color,scale);
}
export function drawStrip(ctx,game,{remaining,label,level=1,score=0}){
 const {x,y,w,h}=LAYOUT.strip;
 drawBox(ctx,x,y,w,h);
 drawText(ctx,'TIME',x+8,y+6,C.cream);
 drawText(ctx,clock(remaining),x+8,y+16,remaining<60000?C.hotpink:C.white,2);
 drawText(ctx,`LEVEL ${level}`,x+80,y+6,C.white);
 drawText(ctx,`SCORE ${score}`,x+80,y+16,C.white);
 drawText(ctx,`FLOORS ${game.height}/${game.target}`,x+80,y+26,C.white);
 drawText(ctx,label,x+170,y+6,C.lavender);
 drawText(ctx,`CUTS ${game.cuts}`,x+170,y+16,C.lavender);
 drawText(ctx,`GAPS ${game.gaps} REACH ${game.reach}`,x+170,y+26,C.lavender);
}
// NEXT sits in the left strip and the beat in the right strip, above the buttons.
export function drawTallSides(ctx,game){
 tag(ctx,'NEXT',4,60,C.cream);
 drawMini(ctx,game.next,28,98);
 tag(ctx,'BEAT',219,60,C.cream);
 if(game.piece&&game.active()&&game.fits(game.lower())){
  const se=game.stepDir()==='se';
  tag(ctx,se?'TICK':'TOCK',219,72,C.yellow);
  tag(ctx,se?'▶':'◀',230,84,C.yellow,3);
 }
}
export function drawMessage(ctx,message){wrap(message,42,2).forEach((line,i)=>tag(ctx,line,6,311+i*9,C.white));}

// Touch buttons: bevelled hexes like the pieces, from cached pixel masks; a pressed one flips its bevel.
export const BUTTON_R=13;
const BUTTON_STYLE={left:[C.violet,C.lavender,C.indigo,C.white],right:[C.violet,C.lavender,C.indigo,C.white],
 down:[C.violet,C.lavender,C.indigo,C.white],rotate:[C.magenta,C.pink,C.purple,C.white],beat:[C.yellow,C.white,C.orange,C.black]};
const inPointyHex=(x,y,r)=>{const ax=Math.abs(x),ay=Math.abs(y);return ax<=Math.sqrt(3)/2*r&&ay<=r-ax/Math.sqrt(3);};
const BUTTON_TILES=new Map();
function buttonTile(name,pressed){
 const key=name+pressed;let t=BUTTON_TILES.get(key);if(t)return t;
 const R=BUTTON_R,o=R+1,[fill,light,dark]=BUTTON_STYLE[name],[hi,lo]=pressed?[dark,light]:[light,dark];
 t=canvas(2*o+1,2*o+1);const g=t.getContext('2d');
 for(let y=-o;y<=o;y++)for(let x=-o;x<=o;x++){
  if(!inPointyHex(x,y,R+1))continue;
  let col=C.black;
  if(inPointyHex(x,y,R)){
   if(!inPointyHex(x-1,y,R)||!inPointyHex(x,y-1,R))col=hi;
   else if(!inPointyHex(x+1,y,R)||!inPointyHex(x,y+1,R))col=lo;
   else col=fill;
  }
  g.fillStyle=col;g.fillRect(x+o,y+o,1,1);
 }
 BUTTON_TILES.set(key,t);return t;
}
export function drawButtons(ctx,isPressed){
 for(const b of BUTTONS){
  const p=isPressed(b.name);
  ctx.drawImage(buttonTile(b.name,p),b.x-BUTTON_R-1,b.y-BUTTON_R-1);
  drawText(ctx,b.label,b.x+(p?1:0),b.y-3+(p?1:0),BUTTON_STYLE[b.name][3],1,'center');
 }
}
// Shown on a touch device held sideways (drawn on the wide canvas): a slowly turning hex.
export function drawRotate(ctx,now){
 const cx=240,cy=110,a=now/900,cos=Math.cos(a),sin=Math.sin(a);
 for(const [r,col] of [[30,C.black],[28,C.yellow]]){
  ctx.fillStyle=col;
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(inPointyHex(x*cos+y*sin,-x*sin+y*cos,r))ctx.fillRect(cx+x,cy+y,1,1);
 }
 drawBox(ctx,140,170,200,30);
 drawText(ctx,'TURN TO PORTRAIT',240,181,C.white,1,'center');
}
