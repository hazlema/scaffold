import {Game,HEIGHT} from './engine.js';
import {C} from './palette.js';
import {loadAssets} from './assets.js';
import {loadSettings,saveSettings} from './settings.js';
import {loadScores,saveScores,qualifies,insertScore} from './scores.js';
import {DIFFICULTY,DIFFICULTY_ORDER,createRun,levelOptions,onLevelWon,runFloors,runScore,isRunOver} from './run.js';
import {fitScale,layoutFor,layoutBox,hit,menuKey,SETTING_ROWS,settingLabel,changeSetting,canSelect,startInitials,initialsKey,clock} from './ui.js';
import {LAYOUT,useLayout,drawSky,drawBackdrop,drawSprites,drawDim,drawBox,drawItems,drawLogo,drawControls,MENU_SCENERY,PLAY_SCENERY,drawBoard,drawPanel,drawBanner,drawScoreTable,drawStrip,drawTallSides,drawButtons,drawMessage,drawRotate} from './render.js';
import {createTouch,hitButton} from './touch.js';

const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),screenEl=document.getElementById('screen'),scanEl=document.getElementById('scan');
ctx.imageSmoothingEnabled=false;
const store=(()=>{try{return window.localStorage;}catch{return null;}})();
let settings=loadSettings(store),scores=loadScores(store),assets={manifest:null,images:{}};
// screen: 'menu' | 'settings' | 'scores' | 'play'. On the play screen, phase: 'playing' | 'clear' | 'entry' | 'table'.
let screen='menu',cursor=1,settingsCursor=0,boxCursor=0,game=null,run=null,phase='playing',phaseAt=0,soft=false,last=0;
let flash=null,offcut=null,message='',messageUntil=0,entry=null,result=null,highlight=-1,audio;
const CLEAR_MS=1500;
loadAssets().then(a=>{assets=a;});

let mode='wide';const touch=createTouch();
// The screen follows the device: the tall screen on a touch device held upright, a turn prompt when it's sideways.
function resize(){
 const next=layoutFor({coarse:!!window.matchMedia?.('(pointer: coarse)')?.matches,width:innerWidth,height:innerHeight});
 if(next!==mode){
  mode=next;useLayout(mode==='tall'?'tall':'wide');
  canvas.width=LAYOUT.W;canvas.height=LAYOUT.H;ctx.imageSmoothingEnabled=false;
  releaseTouches();if(mode==='rotate')blur();
 }
 const dpr=window.devicePixelRatio||1,s=fitScale(innerWidth,innerHeight,dpr,LAYOUT.W,LAYOUT.H);
 screenEl.style.width=`${LAYOUT.W*s/dpr}px`;screenEl.style.height=`${LAYOUT.H*s/dpr}px`;
 screenEl.style.setProperty('--px',`${1/dpr}px`);// scanlines stay one device pixel thin
}
addEventListener('resize',resize);addEventListener('orientationchange',resize);resize();
const applyScan=()=>{scanEl.style.opacity=String(settings.scanlines);};
applyScan();

function tone(freq=260,dur=.08){if(!settings.sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.value=freq;gain.gain.setValueAtTime(.05,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+dur);}catch{}}
function note(s){message=s;messageUntil=performance.now()+5000;}
const floorsText=n=>`${n} ${n===1?'FLOOR':'FLOORS'}`;

const MENU_ITEMS=[...DIFFICULTY_ORDER.map(k=>DIFFICULTY[k].label),'HIGH SCORES','SETTINGS'];
const menuLayout=()=>layoutBox(MENU_ITEMS,{cx:LAYOUT.W/2,y:72,minWidth:120});
const settingsLayout=()=>layoutBox(SETTING_ROWS.map(r=>settingLabel(r,settings)),{cx:LAYOUT.W/2,y:80,minWidth:200});
const actionsLayout=()=>layoutBox(screen==='scores'?['BACK']:['AGAIN','MENU'],{cx:LAYOUT.W/2,y:LAYOUT.actionsY,scale:1,minWidth:120});
const pauseLayout=()=>layoutBox(['RESUME','MENU'],{cx:LAYOUT.cabinet.x+LAYOUT.cabinet.w/2,y:136,minWidth:120});

function startLevel(){game=new Game(levelOptions(run,settings.lanes));phase='playing';flash=offcut=null;soft=false;last=performance.now();}
function start(key){run=createRun(key);screen='play';boxCursor=0;highlight=-1;entry=null;result=null;startLevel();note('BUILD FLOOR 1 FIRST.');tone(440);}
function toMenu(){screen='menu';game=null;run=null;soft=false;}
function updateSettings(next){const soundOn=!settings.sound&&next.sound;settings=next;saveSettings(store,settings);applyScan();if(soundOn)tone(660);}
function finishRun(now){
 const score=runScore(run,game);
 result={score,floors:runFloors(run,game),level:run.level,label:run.diff.label,letter:run.diff.letter};
 phaseAt=now;soft=false;boxCursor=0;highlight=-1;tone(90,.3);
 if(qualifies(scores.entries,score)){entry=startInitials(scores.last);phase='entry';}else{entry=null;phase='table';}
}
function saveEntry(){
 const name=entry.chars.join(''),r=insertScore(scores.entries,{name,score:result.score,diff:result.letter,level:result.level,at:Date.now()});
 scores={entries:r.entries,last:name};saveScores(store,scores);
 highlight=r.rank;entry=null;phase='table';boxCursor=0;phaseAt=performance.now();tone(660);
}
// A level can end inside update() or inside a key handler (a winning hard drop), so this runs after both.
function checkEnd(now){
 if(screen!=='play'||phase!=='playing')return;
 if(game.status==='won'){phase='clear';phaseAt=now;soft=false;tone(780,.2);return;}
 if(isRunOver(game))finishRun(now);
}

function menuInput(k,repeat){
 const r=menuKey(MENU_ITEMS.length,cursor,k,repeat);cursor=r.cursor;
 if(r.select===undefined)return;
 if(r.select<DIFFICULTY_ORDER.length)start(DIFFICULTY_ORDER[r.select]);
 else if(MENU_ITEMS[r.select]==='HIGH SCORES'){screen='scores';boxCursor=0;highlight=-1;}
 else{screen='settings';settingsCursor=0;}
}
function settingsInput(k,repeat){
 const row=SETTING_ROWS[settingsCursor];
 if(k==='Escape'){screen='menu';return;}
 if(k==='ArrowLeft'||k==='ArrowRight'){updateSettings(changeSetting(settings,row,k==='ArrowLeft'?-1:1));return;}
 const r=menuKey(SETTING_ROWS.length,settingsCursor,k,repeat);settingsCursor=r.cursor;
 if(r.select===undefined)return;
 if(row==='back')screen='menu';else updateSettings(changeSetting(settings,row,1));
}
function scoresInput(k,repeat){
 if(k==='Escape'){screen='menu';return;}
 if(menuKey(1,0,k,repeat).select!==undefined)screen='menu';
}
const PLAYKEYS={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'cw',x:'cw',z:'ccw',' ':'drop',Shift:'beat'};
function pauseToggle(){if(screen!=='play'||phase!=='playing'||game.status!=='playing')return;game.paused=!game.paused;soft=false;boxCursor=0;}
function playInput(k,repeat){
 const now=performance.now();
 if(phase==='clear')return;
 if(phase==='entry'){
  // A drop or a mashed key at the final second must not type or save: ignore keys briefly.
  if(!canSelect(false,phaseAt,now))return;
  const r=initialsKey(entry,k,repeat);entry=r.state;if(r.done)saveEntry();
  return;
 }
 if(phase==='table'){
  if(k==='Escape'){toMenu();return;}
  const r=menuKey(2,boxCursor,k,repeat);boxCursor=r.cursor;
  if(r.select!==undefined&&canSelect(false,phaseAt,now)){if(r.select===0)start(run.diff.key);else toMenu();}
  return;
 }
 if(game.paused){
  if(k==='p'||k==='Escape'){if(!repeat)pauseToggle();return;}
  const r=menuKey(2,boxCursor,k,repeat);boxCursor=r.cursor;
  if(r.select===0)pauseToggle();else if(r.select===1)toMenu();// MENU abandons the run; nothing is recorded
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
function blur(){soft=false;touch.clear();if(screen==='play'&&phase==='playing'&&game.status==='playing'&&!game.paused){game.paused=true;boxCursor=0;}}
addEventListener('blur',blur);
document.addEventListener('visibilitychange',()=>{if(document.hidden)blur();});
function handleEvents(now){
 for(const e of game.events){
  if(e.type==='cut'){flash={...e,time:now};note(`${e.reason==='blocked'?'ENTRY BLOCKED':e.reason==='reach'?'TOO HIGH':'CUTBACK'}: ${e.removed.length} HEXES REMOVED. FLOOR ${HEIGHT-e.gap} STAYS UNFINISHED.`);tone(80,.3);}
  if(e.type==='step')tone(e.dir==='se'?1250:830,.035);
  if(e.type==='lock'){tone(170);if(e.offcuts.length){offcut={cells:e.offcuts,time:now};if(!game.events.some(x=>x.type==='cut'))note(`OFFCUT: ${e.offcuts.length} ${e.offcuts.length===1?'HEX':'HEXES'} PAST THE WALL CUT OFF.`);tone(120,.06);}}
  if(e.type==='jam')note('ENTRY BLOCKED AND NOTHING LEFT TO CUT.');
 }
 game.events=[];
}

addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const k=e.key.length===1?e.key.toLowerCase():e.key;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter','Escape','Shift','Backspace','p','x','z'].includes(k))e.preventDefault();
 if(screen==='menu')menuInput(k,e.repeat);
 else if(screen==='settings')settingsInput(k,e.repeat);
 else if(screen==='scores')scoresInput(k,e.repeat);
 else{playInput(k,e.repeat);checkEnd(performance.now());}
});
addEventListener('keyup',e=>{if(e.key==='ArrowDown')soft=false;});

const toCanvas=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*LAYOUT.W/r.width,(e.clientY-r.top)*LAYOUT.H/r.height];};
function activeRows(){
 if(screen==='menu')return menuLayout().rows;
 if(screen==='settings')return settingsLayout().rows;
 if(screen==='scores')return actionsLayout().rows;
 if(phase==='table')return actionsLayout().rows;
 if(phase==='playing'&&game.paused)return pauseLayout().rows;
 return null;
}
function setCursor(i){if(screen==='menu')cursor=i;else if(screen==='settings')settingsCursor=i;else boxCursor=i;}
canvas.addEventListener('mousemove',e=>{const rows=activeRows();if(!rows)return;const i=hit(rows,...toCanvas(e));if(i>=0)setCursor(i);});
canvas.addEventListener('click',e=>{
 const rows=activeRows();if(!rows)return;const i=hit(rows,...toCanvas(e));if(i<0)return;setCursor(i);
 if(screen==='menu')menuInput('Enter',false);else if(screen==='settings')settingsInput('Enter',false);
 else if(screen==='scores')scoresInput('Enter',false);else playInput('Enter',false);
});// Touch buttons (tall screen only). Each finger is tracked by pointer id, so two thumbs work together.
canvas.addEventListener('pointerdown',e=>{
 if(mode!=='tall'||e.pointerType==='mouse'||screen!=='play')return;
 const b=hitButton(...toCanvas(e));if(!b)return;
 e.preventDefault();globalThis.navigator?.vibrate?.(8);
 try{canvas.setPointerCapture(e.pointerId);}catch{}// throws for a pointer that is no longer active; never lose the press over it
 const now=performance.now();
 for(const a of touch.down(e.pointerId,b,now))touchAction(a);
 checkEnd(now);
});
const lift=e=>{for(const a of touch.up(e.pointerId))touchAction(a);};
canvas.addEventListener('pointerup',lift);canvas.addEventListener('pointercancel',lift);
function releaseTouches(){for(const a of touch.clear())touchAction(a);}
const TOUCH_KEYS={left:'ArrowLeft',right:'ArrowRight',cw:'ArrowUp',beat:'Shift',drop:' '};
const ENTRY_KEYS={left:'ArrowLeft',right:'ArrowRight',cw:'ArrowUp','soft-on':'ArrowDown',beat:'Enter'};
// Touch actions reuse the key handling; while entering initials the buttons stand in for arrows and Enter.
function touchAction(a){
 if(screen!=='play')return;
 if(a==='soft-off'){soft=false;return;}
 if(phase==='entry'){const k=ENTRY_KEYS[a];if(k)playInput(k,false);return;}
 if(phase!=='playing')return;
 if(a==='pause'){playInput('p',false);return;}
 if(game.paused)return;
 if(a==='soft-on'){soft=true;return;}
 if(a==='left-repeat'||a==='right-repeat'){playInput(a==='left-repeat'?'ArrowLeft':'ArrowRight',true);return;}
 if(TOUCH_KEYS[a])playInput(TOUCH_KEYS[a],false);
}


function draw(now){
 drawSky(ctx,assets.manifest,now);drawBackdrop(ctx,assets);
 if(mode==='rotate'){drawRotate(ctx,now);return;}
 const tall=mode==='tall';
 if(screen==='play'){
  drawSprites(ctx,assets,tall?[]:PLAY_SCENERY,now);drawDim(ctx);
  const k=LAYOUT.cabinet;drawBox(ctx,k.x,k.y,k.w,k.h,C.royal);
  drawBoard(ctx,game,{now,flash,offcut});
  const live=phase==='playing'&&game.active(),msg=now<messageUntil||!live?message:`FINISH FLOOR ${game.height+1}.`;
  const info={remaining:game.duration-game.elapsed,label:run.diff.label,level:run.level,score:runScore(run,game)};
  if(tall){drawStrip(ctx,game,info);drawTallSides(ctx,game);drawButtons(ctx,b=>touch.isPressed(b));drawMessage(ctx,msg);}
  else drawPanel(ctx,game,{...info,message:msg});
  if(phase==='clear')drawBanner(ctx,{title:`LEVEL ${run.level}`,lines:['CLEAR',`${clock(game.duration-game.elapsed)} LEFT`]});
  else if(phase==='entry')drawBanner(ctx,{title:'RUN OVER',lines:[`${result.label}  LEVEL ${result.level}`,floorsText(result.floors),tall?'R V LETTER, B SAVE':'TYPE INITIALS, ENTER'],big:String(result.score),slots:entry.chars,slot:entry.slot,now});
  else if(phase==='table'){
   drawDim(ctx);
   drawScoreTable(ctx,scores.entries,highlight,now,{title:'RUN OVER',line:`${result.label}  LEVEL ${result.level}  ${floorsText(result.floors)}  SCORE ${result.score}`});
   drawItems(ctx,actionsLayout(),boxCursor,now);
  }
  else if(game.paused)drawItems(ctx,pauseLayout(),boxCursor,now,{title:'PAUSED',lines:[tall?'TAP RESUME':'P TO RESUME']});
  return;
 }
 drawSprites(ctx,assets,tall?[]:MENU_SCENERY,now);
 if(screen==='scores'){drawDim(ctx);drawScoreTable(ctx,scores.entries,-1,now);drawItems(ctx,actionsLayout(),boxCursor,now);return;}
 drawLogo(ctx,assets);
 if(screen==='menu'){drawItems(ctx,menuLayout(),cursor,now);drawControls(ctx);}
 else drawItems(ctx,settingsLayout(),settingsCursor,now);
}
function frame(now){
 const dt=Math.min(100,Math.max(0,now-last));last=now;
 if(screen==='play'){
  if(phase==='playing'){if(mode==='tall')for(const a of touch.tick(now))touchAction(a);game.update(dt,soft);handleEvents(now);checkEnd(now);}
  else if(phase==='clear'&&now-phaseAt>=CLEAR_MS){
   run=onLevelWon(run);startLevel();note(`LEVEL ${run.level}. DROPS ARE FASTER.`);
   if(!document.hasFocus())game.paused=true;// they left during the banner: no blur event will come, so open paused
  }
 }
 draw(now);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
