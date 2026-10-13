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
