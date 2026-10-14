import {test} from 'node:test';
import assert from 'node:assert/strict';

// Drives the real app.js against a stubbed page (no browser): keys, frames, focus and storage.
let now=1000,focused=true,raf=null;
const listeners={},store=new Map(),on=(type,f)=>(listeners[type]??=[]).push(f);
const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='createPattern'?()=>({}):()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const el=()=>({style:{setProperty(){}},getContext:()=>ctx,addEventListener:on,getBoundingClientRect:()=>({left:0,top:0,width:480,height:270})});
globalThis.performance={now:()=>now};
Object.assign(globalThis,{window:globalThis,innerWidth:960,innerHeight:540,devicePixelRatio:1,addEventListener:on,
 document:{getElementById:el,createElement:el,addEventListener:on,hidden:false,hasFocus:()=>focused},
 requestAnimationFrame:f=>{raf=f;},fetch:()=>Promise.reject(new Error('offline')),
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))}});
const {Game}=await import('./engine.js');
let latest=null;const spawn=Game.prototype.spawn;
Game.prototype.spawn=function(...a){latest=this;return spawn.apply(this,a);};
await import('./app.js');
const tick=(ms=100)=>{now+=ms;raf(now);};
const key=(k,repeat=false)=>listeners.keydown.forEach(f=>f({key:k,repeat,preventDefault(){}}));
const keyup=k=>listeners.keyup.forEach(f=>f({key:k}));
// Build the level's target height of solid floors, then let the engine judge it as a lock would.
const clearLevel=()=>{for(let r=20-latest.target;r<20;r++)latest.board[r].fill(1);latest.resolve([20-latest.target]);};
// A pointer event at a logical position, for the stubbed canvas (its rect is always 480x270 CSS px).
const touchAt=(type,id,lx,ly,{w=270,h=330,pointerType='touch'}={})=>listeners[type]?.forEach(f=>f({pointerId:id,pointerType,clientX:lx*480/w,clientY:ly*270/h,preventDefault(){}}));
const turn=(width,height)=>{globalThis.innerWidth=width;globalThis.innerHeight=height;listeners.resize.forEach(f=>f());tick();};

test('a level that starts while the window is unfocused opens paused',()=>{
 tick();key('ArrowUp');key('Enter');tick();// EASY
 clearLevel();tick();
 assert.equal(latest.status,'won');// the banner is up
 focused=false;// the player switched windows during the LEVEL CLEAR banner (no new blur event will come)
 for(let i=0;i<17;i++)tick();
 assert.equal(latest.elapsed,0);
 assert.equal(latest.paused,true);
 focused=true;key('p');tick();
 assert.equal(latest.paused,false);
});

test('a soft drop held as the run ends cannot change the initials',()=>{
 key('ArrowDown');// holding soft drop from here on: the browser repeats the key every frame
 for(let i=0;i<1900&&!store.has('scaffold.scores');i++){tick();key('ArrowDown',true);}
 for(let i=0;i<20;i++){tick();key('ArrowDown',true);}// still held well past the 600 ms lockout
 keyup('ArrowDown');
 key('Enter');key('Enter');key('Enter');
 const saved=JSON.parse(store.get('scaffold.scores'));
 assert.equal(saved.entries[0].name,'AAA');
 assert.equal(saved.entries[0].diff,'E');
});

test('desktop: mouse or stray pointer presses never act as touch buttons',()=>{
 key('Escape');tick();// leave the results table for the menu
 key('Enter');tick();// start a run
 const q=latest.piece.q;
 touchAt('pointerdown',7,15,268,{w:480,h:270});touchAt('pointerup',7,15,268,{w:480,h:270});
 touchAt('pointerdown',8,15,268,{w:480,h:270,pointerType:'mouse'});touchAt('pointerup',8,15,268,{w:480,h:270});
 assert.equal(latest.piece.q,q);
});
test('upright phone: buttons steer, a double tap on down hard-drops, the top bar pauses',()=>{
 globalThis.matchMedia=()=>({matches:true});
 turn(390,844);
 const q=latest.piece.q;
 touchAt('pointerdown',1,15,268);touchAt('pointerup',1,15,268);
 assert.equal(latest.piece.q,q-1);
 const placed=latest.placed;
 touchAt('pointerdown',2,27,290);touchAt('pointerup',2,27,290);
 touchAt('pointerdown',3,27,290);touchAt('pointerup',3,27,290);
 assert.equal(latest.placed,placed+1);
 touchAt('pointerdown',4,135,20);touchAt('pointerup',4,135,20);
 assert.equal(latest.paused,true);
 touchAt('pointerdown',5,135,20);touchAt('pointerup',5,135,20);
 assert.equal(latest.paused,false);
});
test('turning the phone sideways pauses the run; back upright it waits on the PAUSED box',()=>{
 touchAt('pointerdown',6,27,290);// holding soft drop as the phone turns
 turn(844,390);
 assert.equal(latest.paused,true);
 turn(390,844);
 assert.equal(latest.paused,true);
});
