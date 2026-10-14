// Pure UI logic: no canvas, no DOM. Screen units are logical pixels of the 480x270 canvas.
import {measure} from './font.js';

// Whole device pixels per game pixel. Browsers report a whole-number CSS width (411 for 411.43),
// so allow half a CSS pixel or a 1080 px phone loses a full step of scale.
export const fitScale=(w,h,dpr=1,LW=480,LH=270)=>Math.max(1,Math.floor(Math.min((w+.5)*dpr/LW,(h+.5)*dpr/LH)));
// The phone deck is at least 292 of 648 mock units tall at the game's width, so count it as extra logical height.
export const deckFitScale=(w,h,dpr,LW,LH)=>fitScale(w,h,dpr,LW,LH+292*LW/648);
// Touch devices get the tall portrait screen when held upright and a turn prompt when sideways; everything else is wide.
export const layoutFor=({coarse,width,height})=>coarse?(height>width?'tall':'rotate'):'wide';
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

// Arcade initials: three slots. Type a letter or digit, or spin with up/down; left/right, Enter or Backspace move;
// Enter on the last slot saves.
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
 if(repeat)return {state,done:false};// a held Enter, letter or right arrow never moves on, types or saves
 const typed=key.length===1?key.toUpperCase():'';
 if(typed!==' '&&typed&&INITIAL_CHARS.includes(typed)){const next=[...chars];next[slot]=typed;return at(next,Math.min(2,slot+1));}
 if(key==='Backspace')return at(chars,Math.max(0,slot-1));
 if(key==='ArrowRight')return at(chars,Math.min(2,slot+1));
 if(key==='Enter')return slot===2?{state,done:true}:at(chars,slot+1);
 return {state,done:false};
}
