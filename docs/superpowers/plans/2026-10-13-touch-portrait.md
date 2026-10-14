# Touch Controls and Portrait Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Scaffold playable on a phone held upright. A tall 270×330 pixel screen shows the board with five floating hex buttons in the side strips, and desktop stays exactly as it is.

**Architecture:**
- **Layouts:** `render.js` gains two layout records (`wide`, `tall`). `useLayout(name)` copies the chosen one into the existing `LAYOUT` object, so `cellXY`, banners, boxes and the table all follow the active screen.
- **Touch:** the new pure `touch.js` turns fingers on buttons into actions: `left`, `right`, their repeats, `cw`, `beat`, `soft-on`/`soft-off`, `drop` and `pause`.
- **App:** `app.js` picks the mode from the device, resizes the canvas, routes pointer events through `touch.js`, and maps the actions onto the existing key handling.

**Tech Stack:** Vanilla ES modules, Canvas 2D, Pointer Events, Node ≥ 20 `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-touch-portrait-design.md`

## Global Constraints

- **Modes:** `tall` when `(pointer: coarse)` and height > width; `rotate` when coarse and width ≥ height; `wide` otherwise. Desktop (`wide`) behaviour and look are unchanged.
- **Tall screen:** 270×330 logical, scaled by whole device pixels (`fitScale(w, h, dpr, 270, 330)`).
- **Buttons:** hex radius 13. Centres: left (15,268), right (40,268), down (27,290), rotate (230,268), beat (255,268). They are never drawn over the cabinet (x 56–215).
- **Touch timing:** ‹ › repeat after 170 ms, then every 50 ms. `v` held = soft drop; a second `v` press within 250 ms = hard drop. A third quick tap does not drop again. No swipes; touching the board does nothing.
- **Pause:** tap the readout strip (logical y < 48).
- **Initials on touch:** ‹ → ←, › → →, R → ↑, v → ↓, B → Enter. The tall hint reads `R V LETTER, B SAVE`.
- **Unchanged rules:** only the 16 palette colours, no `globalAlpha`, display text in capitals within the font's characters.
- **Branch:** `touch-portrait`.

## Review Focus

1. **A finger lifted or cancelled mid-hold** (a system gesture, a call): the soft drop and the slide must stop. Pinned in Task 2 (`up`/`clear` tests) and Task 5 (`pointercancel` wired to the same handler).
2. **Orientation flips mid-run:** play must pause, held buttons must be released, and turning back upright must show PAUSED. Pinned in Task 5 (app test).
3. **Mouse on desktop:** a mouse click must never fire a touch button, even at button coordinates. Pinned in Task 5 (app test).
4. **Mashing `v`:** a fast triple tap gives one hard drop, not two. Pinned in Task 2.
5. **Everything fits 270×330:** strip text, side labels, buttons, message lines, banner with the touch hint, high-score table and menus. Pinned in Tasks 3 and 4.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `ui.js`, `ui.test.js` | modify | `fitScale` takes the logical size; `layoutFor` |
| `touch.js`, `touch.test.js` | new | buttons, hit testing, touch controller |
| `render.js`, `render.test.js` | modify | wide/tall layouts, layout-aware sky/backdrop/dim/logo/controls/guide/table; tall readout strip, side strips, buttons, message, rotate screen |
| `app.js`, `app.test.js` | modify | modes, pointer input, draw dispatch |
| `index.html`, `style.css`, `scripts/files.mjs` | modify | viewport and touch CSS; serve and build `touch.js` |
| `README.md` | modify | touch controls |

---

### Task 1: Screen mode and scale

**Files:** Modify `ui.js`, `ui.test.js`.

**Interfaces:**
- Produces:
  - `fitScale(w, h, dpr=1, LW=480, LH=270)` → a whole number ≥ 1
  - `layoutFor({coarse, width, height})` → `'tall' | 'rotate' | 'wide'`

- [ ] **Step 1: Branch and failing test**

```bash
git switch -c touch-portrait
```

In `ui.test.js`, add `layoutFor` to the import from `./ui.js`, then append:

```js
test('screen mode follows the device: tall for an upright touch screen, a turn prompt sideways, wide otherwise',()=>{
 assert.equal(layoutFor({coarse:true,width:390,height:844}),'tall');
 assert.equal(layoutFor({coarse:true,width:844,height:390}),'rotate');
 assert.equal(layoutFor({coarse:false,width:390,height:844}),'wide');
 assert.equal(layoutFor({coarse:false,width:1920,height:1080}),'wide');
});
test('the tall screen scales by whole device pixels too',()=>{
 assert.equal(fitScale(390,844,3,270,330),4);
 assert.equal(fitScale(820,1180,2,270,330),6);
 assert.equal(fitScale(1920,1080),4);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test ui.test.js`
Expected: FAIL, because `layoutFor` is not exported.

- [ ] **Step 3: Implement**

In `ui.js`, replace the `fitScale` line with:

```js
export const fitScale=(w,h,dpr=1,LW=480,LH=270)=>Math.max(1,Math.floor(Math.min(w*dpr/LW,h*dpr/LH)));
// Touch devices get the tall portrait screen when held upright and a turn prompt when sideways; everything else is wide.
export const layoutFor=({coarse,width,height})=>coarse?(height>width?'tall':'rotate'):'wide';
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui.js ui.test.js
git commit -m "Pick the screen mode from the device; scale any logical size"
```

---

### Task 2: Touch controller

**Files:** Create `touch.js`, `touch.test.js`.

**Interfaces:**
- Produces:
  - `BUTTONS`: `[{name:'left'|'right'|'down'|'rotate'|'beat', x, y, label, side:'left'|'right'}]`
  - `hitButton(x, y)` → a button name, `'pause'` or `null`
  - `createTouch({das=170, arr=50, doubleTap=250}={})`, which has `down(id, button, t)`, `up(id, t)`, `tick(t)`, `clear()` (each returns an action array) and `isPressed(button)` (boolean)
- Actions: `left`, `right`, `left-repeat`, `right-repeat`, `cw`, `beat`, `soft-on`, `soft-off`, `drop`, `pause`.

- [ ] **Step 1: Failing test**

Create `touch.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTouch,hitButton,BUTTONS} from './touch.js';

test('a tap on a steer button moves once; holding repeats after 170 ms, then every 50 ms',()=>{
 const t=createTouch();
 assert.deepEqual(t.down(1,'left',1000),['left']);
 assert.deepEqual(t.tick(1169),[]);
 assert.deepEqual(t.tick(1170),['left-repeat']);
 assert.deepEqual(t.tick(1219),[]);
 assert.deepEqual(t.tick(1270),['left-repeat','left-repeat']);
 assert.deepEqual(t.up(1,1280),[]);
 assert.deepEqual(t.tick(2000),[]);
});
test('down soft-drops while any finger holds it; lifting the last finger stops it',()=>{
 const t=createTouch();
 assert.deepEqual(t.down(1,'down',0),['soft-on']);
 assert.deepEqual(t.down(2,'down',1000),['soft-on']);
 assert.deepEqual(t.up(1,1100),[]);
 assert.ok(t.isPressed('down'));
 assert.deepEqual(t.up(2,1200),['soft-off']);
 assert.equal(t.isPressed('down'),false);
});
test('a double tap on down hard-drops once; a third quick tap or slower taps do not',()=>{
 const t=createTouch();
 t.down(1,'down',0);t.up(1,60);
 assert.deepEqual(t.down(2,'down',200),['soft-on','drop']);t.up(2,240);
 assert.deepEqual(t.down(3,'down',300),['soft-on']);t.up(3,330);
 assert.deepEqual(t.down(4,'down',900),['soft-on']);
});
test('rotate and beat act once per press; the readout strip is pause',()=>{
 const t=createTouch();
 assert.deepEqual(t.down(1,'rotate',0),['cw']);
 assert.deepEqual(t.tick(5000),[]);
 assert.deepEqual(t.down(2,'beat',0),['beat']);
 assert.deepEqual(t.down(3,'pause',0),['pause']);
 assert.equal(t.isPressed('rotate'),true);
 t.up(1,10);assert.equal(t.isPressed('rotate'),false);
});
test('two thumbs work together; lifting one keeps the other; clear releases everything',()=>{
 const t=createTouch();
 t.down(1,'left',0);
 assert.deepEqual(t.down(2,'down',10),['soft-on']);
 assert.deepEqual(t.tick(170),['left-repeat']);
 assert.deepEqual(t.up(2,200),['soft-off']);
 assert.ok(t.isPressed('left'));
 t.down(3,'down',300);
 assert.deepEqual(t.clear(),['soft-off']);
 assert.equal(t.isPressed('left'),false);
 assert.deepEqual(t.tick(9999),[]);
 assert.deepEqual(t.up(99,0),[]);// a finger we never saw is ignored
});
test('hitButton: nearest button within each side strip, pause on the readout, nothing on the board',()=>{
 for(const b of BUTTONS)assert.equal(hitButton(b.x,b.y),b.name);
 assert.equal(hitButton(2,262),'left');
 assert.equal(hitButton(30,300),'down');
 assert.equal(hitButton(268,240),'beat');
 assert.equal(hitButton(135,20),'pause');
 assert.equal(hitButton(135,280),null);// the board
 assert.equal(hitButton(20,200),null);// a strip, but above the buttons
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test touch.test.js`
Expected: FAIL with `Cannot find module './touch.js'`.

- [ ] **Step 3: Implement**

Create `touch.js`:

```js
// Touch controls for the tall phone screen: five hex buttons in the side strips beside the board.
// Pure: fingers in, the same actions the keyboard produces out. Positions are logical pixels of the 270x330 screen.
export const BUTTONS=[
 {name:'left',x:15,y:268,label:'◀',side:'left'},
 {name:'right',x:40,y:268,label:'▶',side:'left'},
 {name:'down',x:27,y:290,label:'V',side:'left'},
 {name:'rotate',x:230,y:268,label:'R',side:'right'},
 {name:'beat',x:255,y:268,label:'B',side:'right'},
];
const STRIP_LEFT=56,STRIP_RIGHT=215,PAD_TOP=236,READOUT_BOTTOM=48;
// Every touch in the lower part of a side strip belongs to the nearest button on that side.
export function hitButton(x,y){
 if(y<READOUT_BOTTOM)return 'pause';
 if(y<PAD_TOP)return null;
 const side=x<STRIP_LEFT?'left':x>=STRIP_RIGHT?'right':null;
 if(!side)return null;
 let best=null,bestD=Infinity;
 for(const b of BUTTONS)if(b.side===side){const d=(b.x-x)**2+(b.y-y)**2;if(d<bestD){bestD=d;best=b.name;}}
 return best;
}
const ONCE={left:'left',right:'right',rotate:'cw',beat:'beat'};
export function createTouch({das=170,arr=50,doubleTap=250}={}){
 const fingers=new Map();// pointer id -> {button, next}
 let lastDown=-Infinity;
 const held=button=>[...fingers.values()].some(f=>f.button===button);
 return {
  down(id,button,t){
   if(button==='pause')return ['pause'];
   if(!button)return [];
   fingers.set(id,{button,next:t+das});
   if(button!=='down')return [ONCE[button]];
   const out=['soft-on'];
   if(t-lastDown<=doubleTap){out.push('drop');lastDown=-Infinity;}// a third quick tap starts a new pair
   else lastDown=t;
   return out;
  },
  up(id){
   const f=fingers.get(id);if(!f)return [];
   fingers.delete(id);
   return f.button==='down'&&!held('down')?['soft-off']:[];
  },
  tick(t){
   const out=[];
   for(const f of fingers.values())if(f.button==='left'||f.button==='right')while(t>=f.next){out.push(`${f.button}-repeat`);f.next+=arr;}
   return out;
  },
  clear(){const was=held('down');fingers.clear();return was?['soft-off']:[];},
  isPressed:button=>held(button),
 };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test touch.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add touch.js touch.test.js
git commit -m "Add the touch controller: buttons, hit testing, repeats, double-tap drop"
```

---

### Task 3: Switchable layouts

**Files:** Modify `render.js`, `render.test.js`.

**Interfaces:**
- Produces:
  - `LAYOUTS = {wide, tall}`, where each has `{name, W, H, BX, BY, cabinet, banner:{cx,y}, table:{x,y,w,h,rowY,rowH,scale,rowX}, actionsY, skyShift}`. Wide adds `panel`; tall adds `strip`.
  - `useLayout(name)`
  - `LAYOUT` (the active layout, mutated in place)
  - `BANNER` (`w` is 140; `cx` and `y` read the active layout)
  - `SCORE_TABLE` (the wide table, kept for the existing tests)
  - Sky, backdrop, dim, logo, controls, guide labels and the score table all follow `LAYOUT`.

- [ ] **Step 1: Failing test**

In `render.test.js`, extend the import from `./render.js` with `LAYOUTS,useLayout`. (`WIDTH`, `HEIGHT`, `layoutBox`, `measure` and `bannerHeight` are already imported there.) Then append:

```js
test('useLayout switches the board origin and screen size; wide is the default',()=>{
 assert.equal(LAYOUT.name,'wide');
 assert.equal(cellXY(0,0).x,170);
 useLayout('tall');
 try{
  assert.deepEqual([LAYOUT.W,LAYOUT.H],[270,330]);
  assert.equal(cellXY(-1,0).x,62);
  assert.equal(cellXY(0,0).y,58);
  assert.equal(BANNER.cx,135);
 }finally{useLayout('wide');}
 assert.equal(cellXY(-1,0).x,156);
 assert.equal(BANNER.cx,229);
});
test('tall: the board, table, actions, banner and menus fit 270x330',()=>{
 useLayout('tall');
 try{
  const {cabinet:k,W,H,table:t,banner:b}=LAYOUT;
  const left=cellXY(-1,0).x,right=cellXY(WIDTH,1).x+HEX_W,bottom=cellXY(0,HEIGHT-1).y+HEX_H;
  assert.ok(left>=k.x+3&&right<=k.x+k.w-3&&cellXY(0,0).y>=k.y+3&&bottom+2<=k.y+k.h-3,'board in cabinet');
  assert.ok(k.x+k.w<=W&&k.y+k.h<=H-20,'room for two message lines');
  assert.ok(t.x>=0&&t.x+t.w<=W&&t.y+t.h<=LAYOUT.actionsY);
  assert.ok(t.rowX+measure('10  A 1  99999  H  L99',t.scale)<=t.w-3);
  assert.ok(measure('MEDIUM  LEVEL 12  144 FLOORS  SCORE 288',1)<=t.w-8);
  assert.ok(t.rowY+9*t.rowH+7*t.scale<=t.h-3);
  const actions=layoutBox(['AGAIN','MENU'],{cx:W/2,y:LAYOUT.actionsY,scale:1,minWidth:120});
  assert.ok(actions.x>=0&&actions.x+actions.w<=W&&actions.y+actions.h<=H);
  const h=bannerHeight({lines:['MEDIUM  LEVEL 12','144 FLOORS','R V LETTER, B SAVE'],big:'288',slots:['A','B','C']});
  assert.ok(b.y>=k.y&&b.y+h<=k.y+k.h&&b.cx-BANNER.w/2>=k.x&&b.cx+BANNER.w/2<=k.x+k.w,'banner over board');
  const menu=layoutBox(['EASY','MEDIUM','HARD','HIGH SCORES','SETTINGS'],{cx:W/2,y:72,minWidth:120});
  assert.ok(menu.x>=0&&menu.x+menu.w<=W&&menu.y+menu.h<=222);
  const settings=layoutBox(['EDGE LANES OFF','SOUND OFF','SCANLINES 0.6','BACK'],{cx:W/2,y:80,minWidth:200});
  assert.ok(settings.x>=0&&settings.x+settings.w<=W);
 }finally{useLayout('wide');}
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test render.test.js`
Expected: FAIL, because `LAYOUTS`/`useLayout` are not exported.

- [ ] **Step 3: Implement**

In `render.js`:

1. Replace the line `export const LAYOUT={W:480,H:270,BX:156,BY:14,cabinet:{x:150,y:8,w:159,h:255},panel:{x:318,y:8,w:154,h:255}};` with:

```js
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
```

2. Replace the whole `drawSky` function and the `drawBackdrop` line with:

```js
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
```

3. In `drawDim`, change `ctx.fillRect(0,0,480,270);` to `ctx.fillRect(0,0,LAYOUT.W,LAYOUT.H);`.

4. Replace `drawLogo` and `drawControls` with:

```js
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
```

5. Replace the whole `guide` function (from its comment line to its closing `}`) with:

```js
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
```

6. Replace the line `export const BANNER={cx:229,w:140,y:70};` with:

```js
export const BANNER={w:140,get cx(){return LAYOUT.banner.cx;},get y(){return LAYOUT.banner.y;}};
```

7. Replace the line `export const SCORE_TABLE={x:90,y:6,w:300,h:210,rowY:44,rowH:16};` and the whole `drawScoreTable` function with:

```js
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
```

8. Remove the stray 3-space indentation from every line between the old `guide` comment and the end of the file (a deferred minor from the last review; this task rewrites most of those lines anyway). Then make sure the file ends with a newline:

```bash
python3 - <<'EOF'
import re
s=open('render.js').read()
s=re.sub(r'(?m)^   ','',s)# every over-indented line is in that region; 4-space lines become the file's usual 1
open('render.js','w').write(s.rstrip('\n')+'\n')
EOF
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS everywhere. Wide behaviour is unchanged, and the existing render tests still pass against `SCORE_TABLE` and the wide `BANNER`.

- [ ] **Step 5: Commit**

```bash
git add render.js render.test.js
git commit -m "Make the screen layout switchable between wide and tall"
```

---

### Task 4: Tall screen drawing

**Files:** Modify `render.js`, `render.test.js`.

**Interfaces:**
- Consumes: `BUTTONS` from `touch.js`.
- Produces:
  - `BUTTON_R = 13`
  - `drawStrip(ctx, game, {remaining, label, level, score})`
  - `drawTallSides(ctx, game)`
  - `drawButtons(ctx, isPressed)`, where `isPressed` is `(name) => boolean`
  - `drawMessage(ctx, message)`
  - `drawRotate(ctx, now)`

- [ ] **Step 1: Failing test**

In `render.test.js`, extend the `render.js` import with `BUTTON_R`, add `import {BUTTONS} from './touch.js';`, then append:

```js
test('tall: buttons sit in the side strips, clear of the cabinet, each other and the screen edge',()=>{
 const {cabinet:k,W,H}=LAYOUTS.tall,half=BUTTON_R*Math.sqrt(3)/2+1;
 for(const b of BUTTONS){
  assert.ok(b.x-half>=0&&b.x+half<=W&&b.y+BUTTON_R+1<=H,b.name);
  assert.ok(b.x+half<=k.x||b.x-half>=k.x+k.w,`${b.name} overlaps the board`);
 }
 for(const a of BUTTONS)for(const c of BUTTONS)if(a!==c)assert.ok(Math.hypot(a.x-c.x,a.y-c.y)>=2*half,`${a.name}/${c.name}`);
});
test('tall readout strip, side labels and message lines fit',()=>{
 const s=LAYOUTS.tall.strip,k=LAYOUTS.tall.cabinet;
 assert.ok(8+measure('05:00',2)<=80,'clock');
 assert.ok(80+measure('FLOORS 12/12',1)<=170&&80+measure('SCORE 999999',1)<=170,'middle column');
 assert.ok(170+measure('GAPS 0 REACH 4',1)<=s.w-3&&26+7<=s.h-3,'right column');
 assert.ok(4+measure('NEXT',1)<=k.x&&219+measure('TICK',1)<=270&&230+measure('▶',3)<=270,'side labels');
 assert.ok(6+measure('X'.repeat(42),1)<=264&&320+7<=LAYOUTS.tall.H,'message');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test render.test.js`
Expected: FAIL, because `BUTTON_R` is not exported.

- [ ] **Step 3: Implement**

In `render.js`, add `import {BUTTONS} from './touch.js';` with the other imports, then append:

```js
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
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add render.js render.test.js
git commit -m "Draw the tall screen: readout strip, side strips, hex buttons, message, turn prompt"
```

---

### Task 5: App: modes and touch input

**Files:** Modify `app.js`, `app.test.js`, `index.html`, `style.css`, `scripts/files.mjs`.

**Interfaces:**
- Consumes: `layoutFor`, `fitScale` (Task 1); `createTouch`, `hitButton` (Task 2); `useLayout`, `LAYOUT` (Task 3); `drawStrip`, `drawTallSides`, `drawButtons`, `drawMessage`, `drawRotate` (Task 4).

- [ ] **Step 1: Failing app tests**

In `app.test.js`, add this helper after the `clearLevel` line:

```js
// A pointer event at a logical position, for the stubbed canvas (its rect is always 480x270 CSS px).
const touchAt=(type,id,lx,ly,{w=270,h=330,pointerType='touch'}={})=>listeners[type]?.forEach(f=>f({pointerId:id,pointerType,clientX:lx*480/w,clientY:ly*270/h,preventDefault(){}}));
const turn=(width,height)=>{globalThis.innerWidth=width;globalThis.innerHeight=height;listeners.resize.forEach(f=>f());tick();};
```

Append:

```js
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test app.test.js`
Expected: the desktop test passes, because nothing handles pointers yet. The phone test FAILS because the piece doesn't move. The sideways test FAILS because the game isn't paused.

- [ ] **Step 3: Implement in `app.js`**

1. Replace the `ui.js` and `render.js` import lines with:

```js
import {fitScale,layoutFor,layoutBox,hit,menuKey,SETTING_ROWS,settingLabel,changeSetting,canSelect,startInitials,initialsKey,clock} from './ui.js';
import {LAYOUT,useLayout,drawSky,drawBackdrop,drawSprites,drawDim,drawBox,drawItems,drawLogo,drawControls,MENU_SCENERY,PLAY_SCENERY,drawBoard,drawPanel,drawBanner,drawScoreTable,drawStrip,drawTallSides,drawButtons,drawMessage,drawRotate} from './render.js';
import {createTouch,hitButton} from './touch.js';
```

2. Replace the whole `function resize(){…}` block and the line `addEventListener('resize',resize);resize();` with:

```js
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
```

3. Replace the four layout lines (`menuLayout`, `settingsLayout`, `actionsLayout`, `pauseLayout`) with:

```js
const menuLayout=()=>layoutBox(MENU_ITEMS,{cx:LAYOUT.W/2,y:72,minWidth:120});
const settingsLayout=()=>layoutBox(SETTING_ROWS.map(r=>settingLabel(r,settings)),{cx:LAYOUT.W/2,y:80,minWidth:200});
const actionsLayout=()=>layoutBox(screen==='scores'?['BACK']:['AGAIN','MENU'],{cx:LAYOUT.W/2,y:LAYOUT.actionsY,scale:1,minWidth:120});
const pauseLayout=()=>layoutBox(['RESUME','MENU'],{cx:LAYOUT.cabinet.x+LAYOUT.cabinet.w/2,y:136,minWidth:120});
```

4. Replace the `blur` function line with:

```js
function blur(){soft=false;touch.clear();if(screen==='play'&&phase==='playing'&&game.status==='playing'&&!game.paused){game.paused=true;boxCursor=0;}}
```

5. Replace the `toCanvas` line with:

```js
const toCanvas=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*LAYOUT.W/r.width,(e.clientY-r.top)*LAYOUT.H/r.height];};
```

6. After the `canvas.addEventListener('click',…);` block, add:

```js
// Touch buttons (tall screen only). Each finger is tracked by pointer id, so two thumbs work together.
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
```

7. Replace the whole `draw` function with:

```js
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
```

8. In `frame`, change `  if(phase==='playing'){game.update(dt,soft);handleEvents(now);checkEnd(now);}` to:

```js
  if(phase==='playing'){if(mode==='tall')for(const a of touch.tick(now))touchAction(a);game.update(dt,soft);handleEvents(now);checkEnd(now);}
```

- [ ] **Step 4: Page, styles and file list**

- In `index.html`, change `<meta name="viewport" content="width=device-width,initial-scale=1">` to `<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">`.
- In `style.css`:
  - change `html,body{margin:0;height:100%;background:#030203;overflow:hidden}` to `html,body{margin:0;height:100%;background:#030203;overflow:hidden;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}`
  - append `#game{touch-action:none}`
- In `scripts/files.mjs`, change `'run.js','scores.js']` to `'run.js','scores.js','touch.js']`.

- [ ] **Step 5: Run all tests and the build**

Run: `npm test && npm run build && ls dist | grep touch`
Expected: all tests pass, including the three new app tests, and `touch.js` is in `dist/`.

- [ ] **Step 6: Browser check with phone emulation**

Run `PORT=4173 npm start` in the background. In Playwright, open a new context with `{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}` and go to `http://127.0.0.1:4173`. Check each of these:
- **Menu:** the tall menu shows the logo, five rows and `TAP TO CHOOSE`. Tapping EASY starts a run.
- **Play screen:**
  - the readout strip shows TIME, LEVEL, SCORE, FLOORS, EASY, CUTS and GAPS/REACH
  - NEXT is in the left strip and BEAT/TICK in the right strip
  - the five hex buttons sit at the bottom of the side strips, clear of the board
  - the GOAL label is inside the board's left edge
- **Buttons:** convert logical button positions to page positions with `#game`'s bounding box: `px = box.x + lx * box.width / 270`, `py = box.y + ly * box.height / 330`. Tap them with `page.touchscreen.tap(px, py)`. ◀ ▶ move the piece, R rotates, B flips TICK/TOCK, and two taps on V within 250 ms hard-drop. To see the pressed bevel, dispatch a `pointerdown` with `pointerType:'touch'` at a button's position, screenshot, then dispatch `pointerup`.
- **Pause:** tapping the top strip pauses and shows `TAP RESUME`; tapping RESUME continues.
- **Turning:** at viewport 844×390 the `TURN TO PORTRAIT` screen shows and the run pauses.
- **Desktop:** a normal 1920×1080 context still shows the wide screen, unchanged.
- **Console:** no errors.

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add app.js app.test.js index.html style.css scripts/files.mjs
git commit -m "Play on a phone: tall screen, five floating hex buttons, double-tap drop"
```

---

### Task 6: README

**Files:** Modify `README.md`.

- [ ] **Step 1: Document touch play**

In `README.md`'s Play section, after the controls paragraph (the one starting `Arrow left/right: steer.`), insert:

```markdown
**On a phone:** hold it upright. The game switches to a tall screen with five hex buttons beside the board: ◀ ▶ steer (hold to slide), V soft-drops while held and hard-drops on a double tap, R rotates, B changes the beat. Tap the bar at the top to pause. While entering initials the same buttons pick letters (R/V change the letter, ◀ ▶ move, B saves). Turning the phone sideways pauses the game until you turn it back.
```

- [ ] **Step 2: Full check and commit**

Run: `npm test && npm run build`
Expected: all tests pass and the build succeeds.

```bash
git add README.md
git commit -m "Document touch controls"
```
