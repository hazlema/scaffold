# Phone Layout v2 (Game Screen + Controller Deck) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones held upright, show a 216×302 pixel game screen (readout strip and board) at full width, with an HTML controller deck below it that matches `docs/mock/Mobile Controls.dc.html`. Also fix the scale rounding that drew the user's phone at 3× instead of 5×.

**Architecture:**
- **`LAYOUTS.tall`** becomes 216×302 and keeps only the strip and the board.
- **`deck.js` (new):** builds the deck as DOM elements. It has two pure helpers (NEXT-window hex layout and the chase light) and a small `update()` that changes only what differs.
- **`app.js`:** sizes the canvas to leave room for the deck, routes the deck's pointer events into the existing `touch.js` controller, and makes canvas strip taps pause.
- **Removed:** the v1 in-canvas phone buttons and side strips.

**Tech Stack:** Vanilla ES modules, Canvas 2D, DOM/CSS for the deck, Pointer Events, Node ≥ 20 `node --test`, Python + Pillow (asset tool only). No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-phone-deck-design.md`

## Global Constraints

- **Tall game screen:** 216×302 logical, square integer pixels. The canvas keeps the 16-colour rules; the deck intentionally does not (its CSS colours come from the mock).
- **Scale:** `fitScale(w, h, dpr, LW, LH) = max(1, floor(min((w+0.5)·dpr/LW, (h+0.5)·dpr/LH)))`. The +0.5 allows for browsers reporting a whole-number CSS width (411 for 411.43). In tall mode `h = innerHeight − 0.45·innerWidth`, leaving room for the deck.
  - **Ruling against the spec text:** the spec says "+0.02 tolerance". That would round a real 1919-pixel desktop window up to 4× and overflow it. The +0.5 CSS px allowance fixes the phone without that side effect.
- **Deck:** `--u` = deck width / 648; minimum height 292 u; the *Press Start 2P* font, self-hosted (OFL).
- **Touch timing (unchanged):** ◀ ▶ repeat after 170 ms, then every 50 ms. ▼ held = soft drop; a second ▼ press within 250 ms = hard drop. A pause tap is on the canvas strip (logical y < 40).
- **Initials on touch:** ◀ → ←, ▶ → →, R → ↑, ▼ → ↓, B → Enter. The tall hint reads `R DOWN LETTER, B SAVE`.
- **Desktop and wide mode** are unchanged. The deck is hidden outside tall mode.
- **Branch:** `phone-deck`.

## Review Focus

1. **A real phone's reported width** (an integer CSS width at a fractional dpr) must get the largest scale that fits. Pinned in Task 1 (`fitScale(411, 730, 2.625, 216, 302)` = 5; `fitScale(1919, 1080)` stays 3).
2. **The deck fills the rest of the screen** on very tall and shorter phones (no dead band, never squashed below 292 u). Pinned in the Task 4 browser check at two phone sizes.
3. **A finger leaving the deck or the browser dropping capture** must release the button. Pinned in Task 4 (`lostpointercapture` wired to `lift`, plus an app test).
4. **Deck presses outside play** (menus, banners, results) must do nothing. Initials entry must still work. Pinned in Task 4 app tests.
5. **Every NEXT piece fits its window** in its true shape. Pinned in Task 3.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `ui.js`, `ui.test.js` | modify | `fitScale` rounding fix |
| `scripts/assets.py`, `assets/logo-small.png`, `assets/manifest.json`, `assets/fonts/*` | modify/new | small logo; self-hosted font |
| `assets.js`, `assets.test.js` | modify | load `logo-small` |
| `scripts/files.mjs`, `scripts/build.mjs` | modify | serve and copy `assets/fonts/` |
| `deck.js`, `deck.test.js` | new | controller deck DOM plus pure helpers |
| `render.js`, `render.test.js` | modify | tall 216×302 layout; v1 tall drawing removed |
| `touch.js`, `touch.test.js` | modify | drop `BUTTONS`/`hitButton` |
| `app.js`, `app.test.js`, `index.html`, `style.css` | modify | deck wiring, sizing, styles |
| `README.md` | modify | phone section |

---

### Task 1: Scale rounding fix

**Files:** Modify `ui.js`, `ui.test.js`.

- [ ] **Step 1: Branch and failing test**

```bash
git switch -c phone-deck
```

Append to `ui.test.js`:

```js
test('a phone reporting a whole-number CSS width still gets its full pixel scale',()=>{
 assert.equal(fitScale(411,730,2.625,216,302),5);// 1080 px wide Android reporting 411 CSS px
 assert.equal(fitScale(411,915,2.625,270,330),4);
 assert.equal(fitScale(1919,1080),3);// a genuinely narrower desktop window does not round up
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test ui.test.js`
Expected: FAIL. The first assertion gets 4, not 5.

- [ ] **Step 3: Implement**

In `ui.js`, replace the `fitScale` line with:

```js
// Whole device pixels per game pixel. Browsers report a whole-number CSS width (411 for 411.43),
// so allow half a CSS pixel or a 1080 px phone loses a full step of scale.
export const fitScale=(w,h,dpr=1,LW=480,LH=270)=>Math.max(1,Math.floor(Math.min((w+.5)*dpr/LW,(h+.5)*dpr/LH)));
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test ui.test.js`
Expected: PASS, including every existing `fitScale` expectation.

- [ ] **Step 5: Commit**

```bash
git add ui.js ui.test.js
git commit -m "Allow for whole-number CSS widths when picking the pixel scale"
```

---

### Task 2: Small logo and self-hosted font

**Files:** Modify `scripts/assets.py`, `assets.js`, `assets.test.js`, `scripts/files.mjs`, `scripts/build.mjs`; generate `assets/logo-small.png` and `assets/manifest.json`; add `assets/fonts/PressStart2P-Regular.ttf` and `assets/fonts/OFL.txt`.

**Interfaces:**
- Produces:
  - `assets.images['logo-small']` (200 px wide)
  - `manifest.logoSmall` = `[w, h]`
  - URL `assets/fonts/PressStart2P-Regular.ttf`

- [ ] **Step 1: Failing tests**

In `assets.test.js`, append inside the first test (just before its closing `});`, after the `m.logo` assertion):

```js
 assert.ok(m.logoSmall&&m.logoSmall[0]>=190&&m.logoSmall[0]<=200,`small logo ${m.logoSmall}`);
 assert.ok(existsSync(new URL('./assets/logo-small.png',import.meta.url)));
 for(const f of ['PressStart2P-Regular.ttf','OFL.txt'])assert.ok(existsSync(new URL(`./assets/fonts/${f}`,import.meta.url)),f);
```

In the `loadAssets` test, change `assert.deepEqual(Object.keys(some.images).sort(),['backdrop','cube-blue','logo']);` to `assert.deepEqual(Object.keys(some.images).sort(),['backdrop','cube-blue','logo','logo-small']);`.

Run: `node --test assets.test.js`
Expected: FAIL (no `logoSmall`, and no `logo-small` image key).

- [ ] **Step 2: Implement**

In `scripts/assets.py`:
- Change `LOGO_WIDTH = 240` to:
  ```python
  LOGO_WIDTH = 240
  LOGO_SMALL_WIDTH = 200   # the phone screen is 216 wide
  ```
- Change `def logo():` to `def logo(width=LOGO_WIDTH):`, and in its body replace both uses of `LOGO_WIDTH` with `width`.
- In `main()`, after the line `manifest['logo'] = list(lg.size)`, add:
  ```python
      small = logo(LOGO_SMALL_WIDTH)
      check('logo-small', small)
      small.save(OUT / 'logo-small.png')
      manifest['logoSmall'] = list(small.size)
  ```

In `assets.js`, change `const names=['backdrop','logo',...` to `const names=['backdrop','logo','logo-small',...`.

Fetch the font (SIL OFL 1.1) into the repo:

```bash
mkdir -p assets/fonts
curl -fsSL -o assets/fonts/PressStart2P-Regular.ttf https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf
curl -fsSL -o assets/fonts/OFL.txt https://github.com/google/fonts/raw/main/ofl/pressstart2p/OFL.txt
file assets/fonts/PressStart2P-Regular.ttf && head -3 assets/fonts/OFL.txt
```
Expected: `TrueType Font data`, and the OFL header naming Press Start 2P.

In `scripts/files.mjs`, replace the `ASSET_PATH` line with:

```js
export const ASSET_PATH=/^assets\/([a-z0-9-]+\.(png|json)|fonts\/[A-Za-z0-9-]+\.(ttf|txt))$/;
```

In `scripts/build.mjs`, replace the `for(const name of await readdir(new URL('assets/',root)))…` line with:

```js
for(const dir of ['assets/','assets/fonts/']){
 await mkdir(new URL(dir,dist),{recursive:true});
 for(const name of await readdir(new URL(dir,root)))if(ASSET_PATH.test(`${dir}${name}`))await copyFile(new URL(`${dir}${name}`,root),new URL(`${dir}${name}`,dist));
}
```

In `server.mjs`, add `'.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'` to `TYPES`.

Run: `python3 scripts/assets.py`
Expected: the same summary as before (13 sprites, logo, horizon 193, 9 bands); `assets/logo-small.png` exists.

- [ ] **Step 3: Run tests and build**

Run: `node --test assets.test.js && npm run build && ls dist/assets/fonts`
Expected: PASS; `dist/assets/fonts` lists both font files.

- [ ] **Step 4: Commit**

```bash
git add scripts/assets.py assets assets.js assets.test.js scripts/files.mjs scripts/build.mjs server.mjs
git commit -m "Add a 200 px logo for phones and self-host the deck font"
```

---

### Task 3: Controller deck module

**Files:** Create `deck.js`, `deck.test.js`.

**Interfaces:**
- Produces:
  - `NEXT_BOX = {w:150, h:96}` (mock units)
  - `nextHexes(id, size=28)` → `{color, w, h, cells:[{x,y}]}` (mock units, cells are top-left corners)
  - `chaseLight(steps)` → 0..3
  - `createDeck(doc)` → `{update({message, steps, next, isPressed}), buttonOf(target)}`
- Button ids (`data-btn`): `left`, `right`, `down`, `rotate`, `beat`.

- [ ] **Step 1: Failing test**

Create `deck.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NEXT_BOX,nextHexes,chaseLight,createDeck} from './deck.js';
import {SHAPES} from './engine.js';
import {PIECES} from './palette.js';

test('every next piece fits the NEXT window in its true shape and colour',()=>{
 SHAPES.forEach((s,id)=>{
  const n=nextHexes(id);
  assert.equal(n.cells.length,s.cells.length);
  assert.equal(n.color,PIECES[id]);
  for(const c of n.cells)assert.ok(c.x>=0&&c.y>=0&&c.x+n.w<=NEXT_BOX.w&&c.y+n.h<=NEXT_BOX.h,`piece ${id} cell ${c.x},${c.y}`);
  // pointy-top neighbours sit one hex width apart in every direction; the shape stays connected
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  for(const a of n.cells){
   const near=n.cells.filter(b=>b!==a).map(b=>d(a,b));
   assert.ok(Math.min(...near)>=n.w-1.5&&Math.min(...near)<=n.w+1.5,`piece ${id} spacing`);
  }
 });
});
test('the beat lights chase one step at a time and wrap',()=>{
 assert.deepEqual([0,1,2,3,4,5,-1].map(chaseLight),[0,1,2,3,0,1,3]);
});
test('without a real DOM the deck is inert but still reads button ids from event targets',()=>{
 const deck=createDeck({getElementById:()=>({})});
 deck.update({message:'X',steps:3,next:0,isPressed:()=>false});
 assert.equal(deck.buttonOf({dataset:{btn:'left'}}),'left');
 assert.equal(deck.buttonOf(null),null);
});
```

Run: `node --test deck.test.js`
Expected: FAIL with `Cannot find module './deck.js'`.

- [ ] **Step 2: Implement**

Create `deck.js`:

```js
// The phone controller deck: real page elements under the game screen, styled after
// docs/mock/Mobile Controls.dc.html (sizes are mock units; CSS turns them into pixels via --u).
import {SHAPES} from './engine.js';
import {PIECES} from './palette.js';

export const NEXT_BOX={w:150,h:96};
// The next piece as pointy-top hexes, centred in the NEXT window.
export function nextHexes(id,size=28){
 const w=size*Math.sqrt(3)/2,pts=SHAPES[id].cells.map(([q,r])=>({x:w*(q+r/2),y:.75*size*r}));
 const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
 const ox=(NEXT_BOX.w-(Math.max(...xs)-Math.min(...xs)+w))/2-Math.min(...xs);
 const oy=(NEXT_BOX.h-(Math.max(...ys)-Math.min(...ys)+size))/2-Math.min(...ys);
 return {color:PIECES[id],w,h:size,cells:pts.map(p=>({x:Math.round(p.x+ox),y:Math.round(p.y+oy)}))};
}
// Eye candy: one of four BEAT lights is lit and moves on with every drop step.
export const chaseLight=steps=>((steps%4)+4)%4;

const u=n=>`calc(var(--u)*${n})`;
const hex=(btn,inner,style='')=>`<div class="hexbtn" data-btn="${btn}" style="${style}"><div class="face">${inner}</div></div>`;
const MARKUP=`<div class="lcd"><div class="goal"><b>GOAL</b><span class="msg"></span></div><div class="beat">BEAT<i></i><i></i><i></i><i></i></div></div>`+
 `<div class="pads"><div class="dpad">`+
 hex('left','<i class="tri l"></i>',`left:${u(7)};top:0`)+hex('right','<i class="tri r"></i>',`left:${u(107)};top:0`)+hex('down','<i class="tri d"></i>',`left:${u(57)};top:${u(78)}`)+
 `</div><div class="next"><span>NEXT</span><div class="win"></div></div>`+
 `<div class="acts"><div class="act low rot">${hex('rotate','R')}<span>ROTATE</span></div><div class="act high bt">${hex('beat','B')}<span>BEAT</span></div></div></div>`;

export function createDeck(doc){
 const root=doc.getElementById('deck');
 // Without a real DOM (tests) the deck draws nothing but still maps event targets to buttons.
 if(typeof root?.querySelector!=='function')return {update(){},buttonOf:t=>t?.dataset?.btn??null};
 root.innerHTML=MARKUP;
 const msg=root.querySelector('.msg'),lights=[...root.querySelectorAll('.beat i')],win=root.querySelector('.win'),btns=[...root.querySelectorAll('[data-btn]')];
 const last={};
 return {
  update({message,steps,next,isPressed}){
   if(message!==last.message){msg.textContent=message;last.message=message;}
   const lit=chaseLight(steps);
   if(lit!==last.lit){lights.forEach((l,i)=>l.classList.toggle('on',i===lit));last.lit=lit;}
   if(next!==last.next){
    last.next=next;
    if(next==null)win.innerHTML='';
    else{const n=nextHexes(next);win.innerHTML=n.cells.map(c=>`<i style="left:${u(c.x+1)};top:${u(c.y+1)};width:${u(n.w-2)};height:${u(n.h-2)};background:${n.color}"></i>`).join('');}
   }
   for(const b of btns){const p=!!isPressed(b.dataset.btn);if(p!==b._pressed){b.classList.toggle('down',p);b._pressed=p;}}
  },
  buttonOf:t=>t?.closest?.('[data-btn]')?.dataset.btn??null,
 };
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `node --test deck.test.js`
Expected: PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add deck.js deck.test.js
git commit -m "Add the phone controller deck module"
```

---

### Task 4: Phone layout v2 wiring

**Files:** Modify `render.js`, `render.test.js`, `touch.js`, `touch.test.js`, `app.js`, `app.test.js`, `index.html`, `style.css`, `scripts/files.mjs`.

**Interfaces:**
- Consumes: `createDeck` (Task 3), `fitScale` (Task 1), `assets.images['logo-small']` (Task 2).
- Produces: `LAYOUTS.tall` = `{name:'tall', W:216, H:302, BX:34, BY:48, cabinet:{x:28,y:42,w:159,h:255}, strip:{x:4,y:4,w:208,h:34}, banner:{cx:107,y:80}, table:{x:6,y:6,w:204,h:200,rowY:44,rowH:12,scale:1,rowX:36}, actionsY:214, skyShift:132, menuY:60, settingsY:70, controlsY:210}`. The wide layout gains `menuY:72, settingsY:80, controlsY:220`.

- [ ] **Step 1: Update the tests first**

`render.test.js`:
- In the import from `./render.js`, remove `BUTTON_R`. Remove the line `import {BUTTONS} from './touch.js';`.
- Delete the whole tests `tall: buttons sit in the side strips, clear of the cabinet, each other and the screen edge` and `tall readout strip, side labels and message lines fit`.
- In `useLayout switches the board origin and screen size; wide is the default`, change the tall expectations to:
  ```js
    assert.deepEqual([LAYOUT.W,LAYOUT.H],[216,302]);
    assert.equal(cellXY(-1,0).x,34);
    assert.equal(cellXY(0,0).y,48);
    assert.equal(BANNER.cx,107);
  ```
- Replace the whole test `tall: the board, table, actions, banner and menus fit 270x330` with:

```js
test('tall: the board, strip, table, actions, banner and menus fit 216x302',()=>{
 useLayout('tall');
 try{
  const {cabinet:k,W,H,table:t,banner:b,strip:s}=LAYOUT;
  const left=cellXY(-1,0).x,right=cellXY(WIDTH,1).x+HEX_W,bottom=cellXY(0,HEIGHT-1).y+HEX_H;
  assert.ok(left>=k.x+3&&right<=k.x+k.w-3&&cellXY(0,0).y>=k.y+3&&bottom+2<=k.y+k.h-3,'board in cabinet');
  assert.ok(k.x>=0&&k.x+k.w<=W&&k.y+k.h<=H&&s.y+s.h<=k.y,'cabinet and strip on screen');
  assert.ok(6+measure('05:00',2)<=70&&70+measure('FLOORS 12/12',1)<=148&&70+measure('SCORE 999999',1)<=148,'strip columns');
  assert.ok(148+measure('MEDIUM',1)<=s.w-3&&148+measure('CUTS 99',1)<=s.w-3&&23+7<=s.h-3,'strip right column');
  assert.ok(t.x>=0&&t.x+t.w<=W&&t.y+t.h<=LAYOUT.actionsY);
  assert.ok(t.rowX+measure('10  A 1  99999  H  L99',t.scale)<=t.w-3);
  assert.ok(measure('MEDIUM  LEVEL 12  SCORE 288',1)<=t.w-8);
  assert.ok(t.rowY+9*t.rowH+7*t.scale<=t.h-3);
  const actions=layoutBox(['AGAIN','MENU'],{cx:W/2,y:LAYOUT.actionsY,scale:1,minWidth:120});
  assert.ok(actions.x>=0&&actions.x+actions.w<=W&&actions.y+actions.h<=H);
  const h=bannerHeight({lines:['MEDIUM  LEVEL 12','144 FLOORS','R DOWN LETTER, B SAVE'],big:'288',slots:['A','B','C']});
  assert.ok(b.y>=k.y&&b.y+h<=k.y+k.h&&b.cx-BANNER.w/2>=k.x&&b.cx+BANNER.w/2<=k.x+k.w,'banner over board');
  assert.ok(measure('R DOWN LETTER, B SAVE',1)<=BANNER.w-8);
  const menu=layoutBox(['EASY','MEDIUM','HARD','HIGH SCORES','SETTINGS'],{cx:W/2,y:LAYOUT.menuY,minWidth:120});
  assert.ok(menu.x>=0&&menu.x+menu.w<=W&&menu.y+menu.h<=LAYOUT.controlsY,'menu');
  const settings=layoutBox(['EDGE LANES OFF','SOUND OFF','SCANLINES 0.6','BACK'],{cx:W/2,y:LAYOUT.settingsY,minWidth:190});
  assert.ok(settings.x>=0&&settings.x+settings.w<=W&&settings.y+settings.h<=H,'settings');
  assert.ok(LAYOUT.controlsY+20<=H&&8+45<=LAYOUT.menuY,'controls box and small logo');
 }finally{useLayout('wide');}
});
```

`touch.test.js`:
- Change the import to `import {createTouch} from './touch.js';`.
- Delete the whole test `hitButton: nearest button within each side strip, pause on the readout, nothing on the board`.

`app.test.js`:
- After the `touchAt` helper, add:
  ```js
  // A pointer event on a deck button (the stubbed deck reads the button id from the target).
  const press=(type,id,btn,pointerType='touch')=>listeners[type]?.forEach(f=>f({pointerId:id,pointerType,target:{dataset:{btn}},preventDefault(){}}));
  ```
- Change the `touchAt` helper's default size from `{w=270,h=330,…}` to `{w=216,h=302,…}`.
- Replace these three tests, keeping their positions in the file: `desktop: mouse or stray pointer presses never act as touch buttons`, `upright phone: buttons steer, a double tap on down hard-drops, the top bar pauses`, and `turning the phone sideways pauses the run; back upright it waits on the PAUSED box`. Their replacements:

```js
test('desktop: deck presses and stray pointers never act as touch buttons',()=>{
 key('Escape');tick();// leave the results table for the menu
 key('Enter');tick();// start a run
 const q=latest.piece.q;
 press('pointerdown',7,'left');press('pointerup',7,'left');
 press('pointerdown',8,'left','mouse');press('pointerup',8,'left');
 touchAt('pointerdown',9,108,20,{w:480,h:270});
 assert.equal(latest.piece.q,q);
 assert.equal(latest.paused,false);
});
test('upright phone: deck buttons steer, a double tap on down hard-drops, the top bar pauses',()=>{
 globalThis.matchMedia=()=>({matches:true});
 turn(390,844);
 const q=latest.piece.q;
 press('pointerdown',1,'left');press('pointerup',1,'left');
 assert.equal(latest.piece.q,q-1);
 const placed=latest.placed;
 press('pointerdown',2,'down');press('pointerup',2,'down');
 press('pointerdown',3,'down');press('lostpointercapture',3,'down');// a dropped capture releases like a lift
 assert.equal(latest.placed,placed+1);
 touchAt('pointerdown',4,108,20);
 assert.equal(latest.paused,true);
 press('pointerdown',5,'left');assert.equal(latest.paused,true);// deck presses do nothing while paused
 press('pointerup',5,'left');
 touchAt('pointerdown',6,108,20);
 assert.equal(latest.paused,false);
});
test('turning the phone sideways pauses the run; back upright it waits on the PAUSED box',()=>{
 press('pointerdown',6,'down');// holding soft drop as the phone turns
 turn(844,390);
 assert.equal(latest.paused,true);
 turn(390,844);
 assert.equal(latest.paused,true);
});
```

Run: `npm test`
Expected: FAIL. Render tall tests fail on 270/330 values; the touch import is fine; the app phone tests fail because deck presses are not wired yet.

- [ ] **Step 2: `render.js`**

1. Replace the `tall:{…}` entry of `LAYOUTS` with:

```js
 tall:{name:'tall',W:216,H:302,BX:34,BY:48,cabinet:{x:28,y:42,w:159,h:255},strip:{x:4,y:4,w:208,h:34},
  banner:{cx:107,y:80},table:{x:6,y:6,w:204,h:200,rowY:44,rowH:12,scale:1,rowX:36},actionsY:214,skyShift:132,menuY:60,settingsY:70,controlsY:210},
```
   and in the `wide:{…}` entry change `actionsY:220,skyShift:0}` to `actionsY:220,skyShift:0,menuY:72,settingsY:80,controlsY:220}`.

2. Replace `drawLogo` and `drawControls` with:

```js
export function drawLogo(ctx,assets){
 const tall=LAYOUT.name==='tall',i=assets.images[tall?'logo-small':'logo'],cx=LAYOUT.W/2;
 if(i)ctx.drawImage(i,Math.round(cx-i.width/2),8);
 else drawText(ctx,'SCAFFOLD',cx,20,C.orange,tall?4:5,'center');
}
export function drawControls(ctx){
 if(LAYOUT.name==='tall'){const y=LAYOUT.controlsY;drawBox(ctx,48,y,120,20);drawText(ctx,'TAP TO CHOOSE',108,y+7,C.cream,1,'center');return;}
 drawBox(ctx,92,220,296,32);
 drawText(ctx,'ARROWS STEER   UP X Z ROTATE   DOWN FASTER',240,227,C.cream,1,'center');
 drawText(ctx,'SHIFT CHANGE BEAT   SPACE DROP   P PAUSE',240,238,C.cream,1,'center');
}
```
   (The wide logo was drawn at y 10; it is now y 8 in both layouts, which is a 2 px change on desktop.)

3. Replace the whole `drawStrip` function with:

```js
export function drawStrip(ctx,game,{remaining,label,level=1,score=0}){
 const {x,y,w,h}=LAYOUT.strip;
 drawBox(ctx,x,y,w,h);
 drawText(ctx,'TIME',x+6,y+5,C.cream);
 drawText(ctx,clock(remaining),x+6,y+15,remaining<60000?C.hotpink:C.white,2);
 drawText(ctx,`LEVEL ${level}`,x+70,y+5,C.white);
 drawText(ctx,`SCORE ${score}`,x+70,y+14,C.white);
 drawText(ctx,`FLOORS ${game.height}/${game.target}`,x+70,y+23,C.white);
 drawText(ctx,label,x+148,y+5,C.lavender);
 drawText(ctx,`CUTS ${game.cuts}`,x+148,y+14,C.lavender);
}
```

4. Delete the v1 tall drawing: the `tag` helper, `drawTallSides`, `drawMessage`, `BUTTON_R`, `BUTTON_STYLE`, `BUTTON_TILES`, `buttonTile` and `drawButtons`. Also delete the line `import {BUTTONS} from './touch.js';`. Keep `inPointyHex` and `drawRotate`. To keep `inPointyHex` defined, move its line (`const inPointyHex=…`) to just above `drawRotate` if it sat inside the deleted block.

- [ ] **Step 3: `touch.js`**

Delete `BUTTONS`, the `const STRIP_LEFT=…` line and `hitButton` (with its comment). Change the file's header comment to:

```js
// Touch controls for the phone deck: fingers on the deck's buttons in, the same actions the keyboard produces out.
```

- [ ] **Step 4: `index.html` and `style.css`**

In `index.html`, change `<script type="module" src="app.js"></script>` to `<div id="deck"></div><script type="module" src="app.js"></script>`.

Append to `style.css`:

```css
/* Phone controller deck (tall mode only), after docs/mock/Mobile Controls.dc.html. --u = one mock unit = deck width / 648. */
@font-face{font-family:'Press Start 2P';src:url(assets/fonts/PressStart2P-Regular.ttf) format('truetype');font-display:block}
#deck{display:none}
body.tall{display:flex;flex-direction:column;align-items:center}
body.tall #deck{display:flex;flex-direction:column;gap:calc(var(--u)*16);box-sizing:border-box;width:var(--deck-w);flex:1;min-height:calc(var(--u)*292);padding:calc(var(--u)*18) calc(var(--u)*14) calc(var(--u)*22);font-family:'Press Start 2P',monospace;background:#0d0d0f radial-gradient(circle at 50% 40%,#1d1d21 0 calc(var(--u)*1.6),transparent calc(var(--u)*2.2)) 0 0/calc(var(--u)*8) calc(var(--u)*8);box-shadow:inset 0 6px 10px rgba(0,0,0,.9),inset 0 2px 0 #2a2a2e;border-top:3px solid #000;touch-action:none}
.lcd{display:flex;align-items:center;justify-content:space-between;gap:calc(var(--u)*12);background:#050506;border-radius:calc(var(--u)*6);box-shadow:inset 0 2px 4px #000,0 1px 0 #26262a;padding:calc(var(--u)*10) calc(var(--u)*14)}
.goal{display:flex;align-items:center;gap:calc(var(--u)*10);min-width:0;font-size:calc(var(--u)*12);color:#f6d98a;letter-spacing:calc(var(--u)*1);white-space:nowrap;overflow:hidden}
.goal b{color:#8a6fe0;font-weight:normal}
.msg{overflow:hidden}
.beat{display:flex;align-items:center;gap:calc(var(--u)*8);font-size:calc(var(--u)*10);color:#8a6fe0}
.beat i{width:calc(var(--u)*12);height:calc(var(--u)*12);background:#2a2a30}
.beat i.on{background:#f6d98a;box-shadow:0 0 calc(var(--u)*8) #f6d98a}
.pads{flex:1;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:calc(var(--u)*12)}
.dpad{position:relative;width:calc(var(--u)*196);height:calc(var(--u)*170)}
.hexbtn{display:flex;align-items:center;justify-content:center;background:#000;clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)}
.dpad .hexbtn{position:absolute;width:calc(var(--u)*82);height:calc(var(--u)*82)}
.face{display:flex;align-items:center;justify-content:center;clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)}
.dpad .face{width:calc(var(--u)*74);height:calc(var(--u)*74);background:linear-gradient(#7f63d6,#5a3fb0);box-shadow:inset 0 calc(var(--u)*-6) 0 #3e2a86}
.hexbtn.down .face{transform:translateY(calc(var(--u)*3));filter:brightness(.85)}
.tri{width:0;height:0;border-style:solid;border-color:transparent}
.tri.l{border-width:calc(var(--u)*10) calc(var(--u)*14) calc(var(--u)*10) 0;border-right-color:#f6d98a}
.tri.r{border-width:calc(var(--u)*10) 0 calc(var(--u)*10) calc(var(--u)*14);border-left-color:#f6d98a}
.tri.d{border-width:calc(var(--u)*14) calc(var(--u)*10) 0 calc(var(--u)*10);border-top-color:#f6d98a}
.next{display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*10)}
.next span{font-size:calc(var(--u)*10);color:#8a6fe0;letter-spacing:calc(var(--u)*2)}
.win{position:relative;width:calc(var(--u)*150);height:calc(var(--u)*96);border-radius:calc(var(--u)*8);background:#050506;box-shadow:inset 0 2px 5px #000,0 1px 0 #26262a}
.win i{position:absolute;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.acts{display:flex;gap:calc(var(--u)*8);align-items:center;padding-right:2px}
.act{display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*8)}
.act.low{margin-top:calc(var(--u)*26)}
.act.high{margin-top:calc(var(--u)*-26)}
.act .hexbtn{width:calc(var(--u)*90);height:calc(var(--u)*90)}
.act .face{width:calc(var(--u)*82);height:calc(var(--u)*82);font-size:calc(var(--u)*18)}
.rot .face{background:#d6249a;color:#fff;box-shadow:inset 0 calc(var(--u)*-7) 0 #8e1468}
.bt .face{background:#f6d98a;color:#3a2470;box-shadow:inset 0 calc(var(--u)*-7) 0 #e08a2e}
.act>span{font-size:calc(var(--u)*8);color:#9a9aa6;letter-spacing:calc(var(--u)*1)}
```

In `scripts/files.mjs`, add `'deck.js'` after `'touch.js'` in `GAME_FILES`.

- [ ] **Step 5: `app.js`**

1. Imports:
   - In the `render.js` import line, remove `drawTallSides,drawButtons,drawMessage,`.
   - Change `import {createTouch,hitButton} from './touch.js';` to:
     ```js
     import {createTouch} from './touch.js';
     import {createDeck} from './deck.js';
     ```

2. Replace the line `let mode='wide';const touch=createTouch();` with:

```js
let mode='wide',steps=0;const touch=createTouch(),deck=createDeck(document),deckEl=document.getElementById('deck');
```

3. In `resize()`, replace its last block (from `const dpr=window.devicePixelRatio||1,s=fitScale(` through the `--px` line) with:

```js
 // On a phone the game screen fills the width and the controller deck takes the rest (at least 0.45 of the width).
 const dpr=window.devicePixelRatio||1,tall=mode==='tall';
 const s=fitScale(innerWidth,tall?innerHeight-.45*innerWidth:innerHeight,dpr,LAYOUT.W,LAYOUT.H),w=LAYOUT.W*s/dpr;
 screenEl.style.width=`${w}px`;screenEl.style.height=`${LAYOUT.H*s/dpr}px`;
 screenEl.style.setProperty('--px',`${1/dpr}px`);// scanlines stay one device pixel thin
 document.body?.classList?.toggle('tall',tall);
 document.documentElement?.style?.setProperty('--deck-w',`${w}px`);
 document.documentElement?.style?.setProperty('--u',`${w/648}px`);
```

4. Replace the `menuLayout` and `settingsLayout` lines with:

```js
const menuLayout=()=>layoutBox(MENU_ITEMS,{cx:LAYOUT.W/2,y:LAYOUT.menuY,minWidth:120});
const settingsLayout=()=>layoutBox(SETTING_ROWS.map(r=>settingLabel(r,settings)),{cx:LAYOUT.W/2,y:LAYOUT.settingsY,minWidth:LAYOUT.name==='tall'?190:200});
```

5. Replace the whole touch block, from the comment `// Touch buttons (tall screen only).` through the line `canvas.addEventListener('pointerup',lift);canvas.addEventListener('pointercancel',lift);`, with:

```js
// Phone: the deck's buttons drive the touch controller; each finger is tracked by pointer id.
deckEl?.addEventListener('pointerdown',e=>{
 const b=deck.buttonOf(e.target);
 if(!b||mode!=='tall'||e.pointerType==='mouse')return;
 e.preventDefault();globalThis.navigator?.vibrate?.(8);
 try{e.target.setPointerCapture(e.pointerId);}catch{}// a finger sliding off keeps its button until it lifts
 const now=performance.now();
 for(const a of touch.down(e.pointerId,b,now))touchAction(a);
 checkEnd(now);
});
const lift=e=>{for(const a of touch.up(e.pointerId))touchAction(a);};
for(const type of ['pointerup','pointercancel','lostpointercapture'])deckEl?.addEventListener(type,lift);
// Tapping the readout strip pauses or resumes.
canvas.addEventListener('pointerdown',e=>{
 if(mode!=='tall'||e.pointerType==='mouse'||screen!=='play')return;
 const [,y]=toCanvas(e);
 if(y<LAYOUT.strip.y+LAYOUT.strip.h+2){e.preventDefault();touchAction('pause');}
});
```

6. In `handleEvents`, change `  if(e.type==='step')tone(e.dir==='se'?1250:830,.035);` to `  if(e.type==='step'){steps++;tone(e.dir==='se'?1250:830,.035);}`.

7. In `draw`:
   - Replace `  if(tall){drawStrip(ctx,game,info);drawTallSides(ctx,game);drawButtons(ctx,b=>touch.isPressed(b));drawMessage(ctx,msg);}` with `  if(tall)drawStrip(ctx,game,info);`.
   - In the entry banner, change `tall?'R V LETTER, B SAVE':'TYPE INITIALS, ENTER'` to `tall?'R DOWN LETTER, B SAVE':'TYPE INITIALS, ENTER'`.
   - In the table branch, change the `line:` value to:
     ```js
     line:tall?`${result.label}  LEVEL ${result.level}  SCORE ${result.score}`:`${result.label}  LEVEL ${result.level}  ${floorsText(result.floors)}  SCORE ${result.score}`
     ```
   - Make `draw` keep the deck in step: change its first line `function draw(now){` to:
     ```js
     function draw(now){
      if(mode==='tall'){
       const live=screen==='play'&&phase==='playing'&&game.active();
       deck.update({message:screen!=='play'?'TAP TO CHOOSE':now<messageUntil||!live?message:`FINISH FLOOR ${game.height+1}`,steps,next:screen==='play'?game.next:null,isPressed:b=>touch.isPressed(b)});
      }
     ```

- [ ] **Step 6: Run all tests and the build**

Run: `npm test && npm run build && ls dist | grep deck`
Expected: all pass; `deck.js` is in `dist/`.

- [ ] **Step 7: Browser check against the mock**

Run `PORT=4173 npm start` in the background. Render the mock (`file://…/docs/mock/Mobile%20Controls.dc.html`) and the game in two phone contexts:
- **412×915 at dpr 2.625, touch:** set the viewport height to 800 to allow for browser chrome.
- **390×844 at dpr 3, touch.**

Check each of these:
- **Scale:** the game canvas reads `canvas.width` 216 and its CSS width is exactly `216·scale/dpr`, with scale 5 in both contexts.
- **The deck matches the mock:** the LCD strip, ◀ ▶ ▼, the NEXT window with the true piece shape, R/ROTATE low and B/BEAT high, dimpled plastic and the Press Start 2P font. Compare screenshots side by side.
- **No dead band:** the deck fills to the bottom of the viewport.
- **Buttons:** tapping ◀ ▶ R B works, a double tap on ▼ hard-drops, the BEAT lights advance with drop steps, a held button shows the pressed look, and tapping the top strip pauses.
- **Menus and sideways:** the LCD reads `TAP TO CHOOSE` on menus and the small logo shows. Sideways shows the turn prompt with the deck hidden.
- **Desktop:** 1920×1080 is unchanged and has no deck.
- **Console:** no errors.

Stop the server.

- [ ] **Step 8: Commit**

```bash
git add render.js render.test.js touch.js touch.test.js app.js app.test.js index.html style.css scripts/files.mjs
git commit -m "Phone layout v2: full-width pixel game screen with an HTML controller deck"
```

---

### Task 5: README

- [ ] **Step 1: Update the phone paragraph**

In `README.md`, replace the paragraph starting `**On a phone:**` with:

```markdown
**On a phone:** hold it upright. The pixel game screen fills the width and a controller deck sits under it: ◀ ▶ steer (hold to slide), ▼ soft-drops while held and hard-drops on a double tap, R rotates, B changes the beat. The deck's LCD shows the current goal or message and BEAT lights that step with the falling piece; the window in the middle shows the next piece. Tap the bar at the top of the game screen to pause. While entering initials the deck picks letters (R and ▼ change the letter, ◀ ▶ move, B saves). Turning the phone sideways pauses the game until you turn it back.
```

- [ ] **Step 2: Full check and commit**

Run: `npm test && npm run build`
Expected: all pass.

```bash
git add README.md
git commit -m "Document the phone controller deck"
```
