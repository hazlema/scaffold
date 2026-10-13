// Pure UI logic: no canvas, no DOM. Screen units are logical pixels of the 480x270 canvas.
import {measure} from './font.js';

// Whole device pixels per game pixel, so 125% display scaling still gives square pixels.
export const fitScale=(w,h,dpr=1)=>Math.max(1,Math.floor(Math.min(w*dpr/480,h*dpr/270)));
export const RESULT_LOCK_MS=600;
// The results box ignores selects briefly so a mashed drop key cannot skip it; the pause box never locks.
export const canSelect=(paused,endedAt,now)=>paused||now-endedAt>RESULT_LOCK_MS;

export function layoutBox(labels,{cx=240,y,scale=2,pad=8,gap=6,minWidth=0}){
 const rowH=7*scale+6,inner=Math.max(minWidth,...labels.map(l=>measure(l,scale)+24));
 const w=inner+pad*2,h=labels.length*rowH+(labels.length-1)*gap+pad*2,x=Math.round(cx-w/2);
 return {x,y,w,h,scale,rows:labels.map((label,i)=>({label,x:x+pad,y:y+pad+i*(rowH+gap),w:inner,h:rowH}))};
}
export const hit=(rows,px,py)=>rows.findIndex(r=>px>=r.x&&px<r.x+r.w&&py>=r.y&&py<r.y+r.h);
// Arrow keys move (wrapping); Enter/Space select, but never on key repeat.
export function menuKey(count,cursor,key,repeat){
 if(key==='ArrowUp')return {cursor:(cursor+count-1)%count};
 if(key==='ArrowDown')return {cursor:(cursor+1)%count};
 if((key==='Enter'||key===' ')&&!repeat)return {cursor,select:cursor};
 return {cursor};
}

export const SETTING_ROWS=['lanes','sound','scanlines','back'];
const onOff=v=>v?'ON':'OFF';
export function settingLabel(row,s){
 if(row==='lanes')return `EDGE LANES ${onOff(s.lanes)}`;
 if(row==='sound')return `SOUND ${onOff(s.sound)}`;
 if(row==='scanlines')return `SCANLINES ${s.scanlines===0?'OFF':s.scanlines.toFixed(1)}`;
 return 'BACK';
}
export function changeSetting(s,row,dir){
 if(row==='lanes')return {...s,lanes:!s.lanes};
 if(row==='sound')return {...s,sound:!s.sound};
 if(row==='scanlines')return {...s,scanlines:Math.min(10,Math.max(0,Math.round(s.scanlines*10)+dir))/10};
 return s;
}
export function clock(ms){const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}

// Arcade initials: three slots; up/down spin the character, left/right or Enter move, Enter on the last saves.
export const INITIAL_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
export const startInitials=last=>({chars:[...(typeof last==='string'&&/^[A-Z0-9 ]{3}$/.test(last)?last:'AAA')],slot:0,armed:false});
export function initialsKey(state,key,repeat){
 const stay={state,done:false};
 // Keys still held from play (a soft drop, say) arrive as repeats: ignore them until one fresh press.
 if(!state.armed){if(repeat)return stay;state={...state,armed:true};}
 const {chars,slot}=state,n=INITIAL_CHARS.length,at=(c,sl)=>({state:{chars:c,slot:sl,armed:true},done:false});
 if(key==='ArrowUp'||key==='ArrowDown'){
  const next=[...chars];next[slot]=INITIAL_CHARS[(INITIAL_CHARS.indexOf(chars[slot])+(key==='ArrowUp'?1:-1)+n)%n];
  return at(next,slot);
 }
 if(key==='ArrowLeft')return at(chars,Math.max(0,slot-1));
 if(repeat)return {state,done:false};// a held Enter or right arrow never moves on or saves
 if(key==='ArrowRight')return at(chars,Math.min(2,slot+1));
 if(key==='Enter')return slot===2?{state,done:true}:at(chars,slot+1);
 return {state,done:false};
}
