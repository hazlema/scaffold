// Board geometry and all canvas drawing for the 480x270 screen.
import {WIDTH,HEIGHT,LANE} from './engine.js';
import {C,PIECES,BEVEL} from './palette.js';
import {drawText} from './font.js';

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
