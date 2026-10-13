import {Game,HEIGHT} from './engine.js';
import {C} from './palette.js';
import {loadAssets} from './assets.js';
import {loadSettings,saveSettings} from './settings.js';
import {DIFFICULTIES,difficulty,fitScale,layoutBox,hit,menuKey,SETTING_ROWS,settingLabel,changeSetting} from './ui.js';
import {LAYOUT,drawSky,drawBackdrop,drawSprites,drawDim,drawBox,drawItems,drawLogo,drawControls,MENU_SCENERY,PLAY_SCENERY,drawBoard,drawPanel} from './render.js';

const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),screenEl=document.getElementById('screen'),scanEl=document.getElementById('scan');
ctx.imageSmoothingEnabled=false;
const store=(()=>{try{return window.localStorage;}catch{return null;}})();
let settings=loadSettings(store),assets={manifest:null,images:{}};
let screen='menu',cursor=1,settingsCursor=0,boxCursor=0,game=null,diff=DIFFICULTIES[1],soft=false,last=0;
let flash=null,offcut=null,message='',messageUntil=0,overSince=0,audio;
loadAssets().then(a=>{assets=a;});

function resize(){const s=fitScale(innerWidth,innerHeight);screenEl.style.width=`${480*s}px`;screenEl.style.height=`${270*s}px`;}
addEventListener('resize',resize);resize();
const applyScan=()=>{scanEl.style.opacity=String(settings.scanlines);};
applyScan();

function tone(freq=260,dur=.08){if(!settings.sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.value=freq;gain.gain.setValueAtTime(.05,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+dur);}catch{}}
function note(s){message=s;messageUntil=performance.now()+5000;}

const menuLayout=()=>layoutBox([...DIFFICULTIES.map(d=>d.label),'SETTINGS'],{y:96,minWidth:120});
const settingsLayout=()=>layoutBox(SETTING_ROWS.map(r=>settingLabel(r,settings)),{y:80,minWidth:200});

function start(d){
 diff=d;game=new Game({target:settings.target,lanes:settings.lanes,...difficulty(d.gaps)});
 screen='play';flash=offcut=null;soft=false;boxCursor=0;last=performance.now();
 note('BUILD FLOOR 1 FIRST.');tone(440);
}
function toMenu(){screen='menu';game=null;soft=false;}
function updateSettings(next){const soundOn=!settings.sound&&next.sound;settings=next;saveSettings(store,settings);applyScan();if(soundOn)tone(660);}

function menuInput(k,repeat){
 const r=menuKey(DIFFICULTIES.length+1,cursor,k,repeat);cursor=r.cursor;
 if(r.select===undefined)return;
 if(r.select<DIFFICULTIES.length)start(DIFFICULTIES[r.select]);else{screen='settings';settingsCursor=0;}
}
function settingsInput(k,repeat){
 const row=SETTING_ROWS[settingsCursor];
 if(k==='Escape'){screen='menu';return;}
 if(k==='ArrowLeft'||k==='ArrowRight'){updateSettings(changeSetting(settings,row,k==='ArrowLeft'?-1:1));return;}
 const r=menuKey(SETTING_ROWS.length,settingsCursor,k,repeat);settingsCursor=r.cursor;
 if(r.select===undefined)return;
 if(row==='back')screen='menu';else updateSettings(changeSetting(settings,row,1));
}
const PLAYKEYS={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'cw',x:'cw',z:'ccw',' ':'drop',Shift:'beat'};
const boxOpen=()=>game&&(game.paused||game.status!=='playing');
const boxLayout=()=>layoutBox(game.paused?['RESUME','MENU']:['AGAIN','MENU'],{cx:LAYOUT.cabinet.x+LAYOUT.cabinet.w/2,y:136,minWidth:120});
function pauseToggle(){if(screen!=='play'||game.status!=='playing')return;game.paused=!game.paused;soft=false;boxCursor=0;}
function boxSelect(i){if(i===1){toMenu();return;}if(game.paused)game.paused=false;else start(diff);}
function playInput(k,repeat){
 if(boxOpen()){
  if((k==='p'||k==='Escape')&&game.paused){if(!repeat)pauseToggle();return;}
  const r=menuKey(2,boxCursor,k,repeat);boxCursor=r.cursor;
  // A drop or a mashed key at the final second must not instantly restart: ignore selects briefly.
  if(r.select!==undefined&&(game.paused||performance.now()-overSince>600))boxSelect(r.select);
  return;
 }
 if(k==='p'||k==='Escape'){if(!repeat)pauseToggle();return;}
 if(k==='ArrowDown'){soft=true;return;}
 const a=PLAYKEYS[k];if(!a||!game.active())return;
 if(repeat&&['cw','ccw','drop','beat'].includes(a))return;
 // A held arrow stops at the visible wall; only a fresh press steers into a lane.
 if(a==='left')game.move(-1,!repeat);if(a==='right')game.move(1,!repeat);
 if(a==='cw')game.rotate(1);if(a==='ccw')game.rotate(-1);if(a==='beat')game.flipBeat();if(a==='drop')game.drop();
}
function blur(){soft=false;if(screen==='play'&&game.status==='playing'&&!game.paused){game.paused=true;boxCursor=0;}}
addEventListener('blur',blur);
document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();});
function handleEvents(now){
 for(const e of game.events){
  if(e.type==='cut'){flash={...e,time:now};note(`${e.reason==='blocked'?'ENTRY BLOCKED':e.reason==='reach'?'TOO HIGH':'CUTBACK'}: ${e.removed.length} HEXES REMOVED. FLOOR ${HEIGHT-e.gap} STAYS UNFINISHED.`);tone(80,.3);}
  if(e.type==='step')tone(e.dir==='se'?1250:830,.035);
  if(e.type==='lock'){tone(170);if(e.offcuts.length){offcut={cells:e.offcuts,time:now};if(!game.events.some(x=>x.type==='cut'))note(`OFFCUT: ${e.offcuts.length} ${e.offcuts.length===1?'HEX':'HEXES'} PAST THE WALL CUT OFF.`);tone(120,.06);}}
  if(e.type==='jam')note('ENTRY BLOCKED AND NOTHING LEFT TO CUT. PAUSE FOR THE MENU.');
 }
 game.events=[];
}

addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const k=e.key.length===1?e.key.toLowerCase():e.key;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter','Escape','Shift','p','x','z'].includes(k))e.preventDefault();
 if(screen==='menu')menuInput(k,e.repeat);
 else if(screen==='settings')settingsInput(k,e.repeat);
 else playInput(k,e.repeat);
});
addEventListener('keyup',e=>{if(e.key==='ArrowDown')soft=false;});

const toCanvas=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*480/r.width,(e.clientY-r.top)*270/r.height];};
function activeRows(){
 if(screen==='menu')return menuLayout().rows;
 if(screen==='settings')return settingsLayout().rows;
 if(screen==='play'&&boxOpen())return boxLayout().rows;
 return null;
}
function setCursor(i){if(screen==='menu')cursor=i;else if(screen==='settings')settingsCursor=i;else boxCursor=i;}
canvas.addEventListener('mousemove',e=>{const rows=activeRows();if(!rows)return;const i=hit(rows,...toCanvas(e));if(i>=0)setCursor(i);});
canvas.addEventListener('click',e=>{
 const rows=activeRows();if(!rows)return;const i=hit(rows,...toCanvas(e));if(i<0)return;setCursor(i);
 if(screen==='menu')menuInput('Enter',false);else if(screen==='settings')settingsInput('Enter',false);else playInput('Enter',false);
});

function draw(now){
 drawSky(ctx,assets.manifest,now);drawBackdrop(ctx,assets);
 if(screen==='play'){
  drawSprites(ctx,assets,PLAY_SCENERY,now);drawDim(ctx);
  const k=LAYOUT.cabinet;drawBox(ctx,k.x,k.y,k.w,k.h,C.royal);
  drawBoard(ctx,game,{now,flash,offcut});
  drawPanel(ctx,game,{remaining:game.duration-game.elapsed,label:diff.label,message:now<messageUntil||!game.active()?message:`FINISH FLOOR ${game.height+1}.`});
  if(boxOpen()){
   const won=game.status==='won',title=game.paused?'PAUSED':won?'TOPPED OUT':"TIME'S UP";
   const lines=game.paused?['P TO RESUME']:[`${game.height}/${game.target} FLOORS`,`${game.cuts} CUTBACKS`];
   drawItems(ctx,boxLayout(),boxCursor,now,{title,lines});
  }
  return;
 }
 drawSprites(ctx,assets,MENU_SCENERY,now);drawLogo(ctx,assets);
 if(screen==='menu'){drawItems(ctx,menuLayout(),cursor,now);drawControls(ctx);}
 else drawItems(ctx,settingsLayout(),settingsCursor,now);
}
function frame(now){
 const dt=Math.min(100,Math.max(0,now-last));last=now;
 if(screen==='play'){
  const wasPlaying=game.status==='playing';
  game.update(dt,soft);handleEvents(now);
  if(wasPlaying&&game.status!=='playing'){overSince=now;boxCursor=0;soft=false;tone(game.status==='won'?780:90,.3);}
 }
 draw(now);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
