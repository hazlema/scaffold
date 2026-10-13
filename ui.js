// Pure UI logic: no canvas, no DOM. Screen units are logical pixels of the 480x270 canvas.
import {measure} from './font.js';
import {TARGETS} from './settings.js';

export const DIFFICULTIES=[{label:'EASY',gaps:2},{label:'MEDIUM',gaps:1},{label:'HARD',gaps:0}];
// Difficulty sets the gaps a row may keep, the reach above the top solid floor, and the clock.
export const difficulty=gaps=>({gaps,reach:[4,5,6][gaps],duration:[8,9,10][gaps]*60000});
// Whole device pixels per game pixel, so 125% display scaling still gives square pixels.
export const fitScale=(w,h,dpr=1)=>Math.max(1,Math.floor(Math.min(w*dpr/480,h*dpr/270)));
// A game can end inside update() or inside a key handler (a winning hard drop): report each end once.
export function endWatcher(){let seen=null;return game=>{if(!game||game.status==='playing'||seen===game)return false;seen=game;return true;};}
export const RESULT_LOCK_MS=600;
// The results box ignores selects briefly so a mashed drop key cannot skip it; the pause box never locks.
export const canSelect=(paused,endedAt,now)=>paused||now-endedAt>RESULT_LOCK_MS;

export function layoutBox(labels,{cx=240,y,scale=2,pad=8,gap=6,minWidth=0}){
 const rowH=7*scale+6,inner=Math.max(minWidth,...labels.map(l=>measure(l,scale)+24));
 const w=inner+pad*2,h=labels.length*rowH+(labels.length-1)*gap+pad*2,x=Math.round(cx-w/2);
 return {x,y,w,h,rows:labels.map((label,i)=>({label,x:x+pad,y:y+pad+i*(rowH+gap),w:inner,h:rowH}))};
}
export const hit=(rows,px,py)=>rows.findIndex(r=>px>=r.x&&px<r.x+r.w&&py>=r.y&&py<r.y+r.h);
// Arrow keys move (wrapping); Enter/Space select, but never on key repeat.
export function menuKey(count,cursor,key,repeat){
 if(key==='ArrowUp')return {cursor:(cursor+count-1)%count};
 if(key==='ArrowDown')return {cursor:(cursor+1)%count};
 if((key==='Enter'||key===' ')&&!repeat)return {cursor,select:cursor};
 return {cursor};
}

export const SETTING_ROWS=['target','lanes','sound','scanlines','back'];
const onOff=v=>v?'ON':'OFF';
export function settingLabel(row,s){
 if(row==='target')return `TARGET ${s.target}`;
 if(row==='lanes')return `EDGE LANES ${onOff(s.lanes)}`;
 if(row==='sound')return `SOUND ${onOff(s.sound)}`;
 if(row==='scanlines')return `SCANLINES ${s.scanlines===0?'OFF':s.scanlines.toFixed(1)}`;
 return 'BACK';
}
export function changeSetting(s,row,dir){
 if(row==='target'){const i=TARGETS.indexOf(s.target);return {...s,target:TARGETS[(i+dir+TARGETS.length)%TARGETS.length]};}
 if(row==='lanes')return {...s,lanes:!s.lanes};
 if(row==='sound')return {...s,sound:!s.sound};
 if(row==='scanlines')return {...s,scanlines:Math.min(10,Math.max(0,Math.round(s.scanlines*10)+dir))/10};
 return s;
}
export function clock(ms){const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
