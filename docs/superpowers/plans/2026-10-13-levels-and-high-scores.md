# Levels, Runs and High Scores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a single timed build into a run of levels that get faster, scored by total floors × difficulty weight, ending in arcade initials entry and a local top-10 table. This plan also applies the playtest tuning (per-difficulty targets and clocks, and a clearer goal line).

**Architecture:**
- **Engine:** gains one option, `dropMs`.
- **`run.js` (new, pure):** owns the difficulty table, per-level game options, speed and score.
- **`scores.js` (new, pure):** owns the validated top-10 storage.
- **`ui.js`:** gains initials-entry key handling.
- **`render.js`:** gains the new panel layout, a banner box and the score table.
- **`app.js`:** is rewritten around play phases (`playing` → `clear` → `entry` → `table`) plus a `scores` screen.

**Tech Stack:** Vanilla ES modules, Canvas 2D, Node ≥ 20 `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-levels-and-high-scores-design.md`

## Global Constraints

- **Difficulty table** (exact):
  - EASY: gaps 2, reach 6, target 8, clock 180000 ms, weight 1, letter E
  - MEDIUM: gaps 1, reach 5, target 12, clock 300000 ms, weight 2, letter M
  - HARD: gaps 0, reach 4, target 12, clock 360000 ms, weight 3, letter H
- **Drop interval:** `950 / (1 + 0.1 × levelsCleared)` ms. Soft drop stays at 55 ms.
- **Score:** `(levelsCleared × target + min(height, target) on the final level) × weight`.
- **Top 10:** one combined table. To qualify, a score must be > 0 and strictly greater than the 10th score (or the table has fewer than 10 entries). Ties keep the older entry above the newer.
- **Storage:** scores are saved under the key `scaffold.scores` as `{entries:[{name,score,diff,level,at}], last}`. `name` matches `/^[A-Z0-9 ]{3}$/`. Load and save never throw.
- **Initials:**
  - Characters: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ` (letters, digits, space).
  - Keys: ↑ next character, ↓ previous, ← back a slot, → or Enter forward a slot. Enter on slot 3 saves.
  - Repeats are allowed for ↑/↓/←, and ignored for Enter/→.
- **Results lockout:** 600 ms (`canSelect`). It applies to initials entry and to the table's selects.
- **Unchanged:** only 16 palette colours, no `globalAlpha`, and display text in capitals within the font's characters. The `engine.js` rules are unchanged apart from `dropMs`.
- **Branch:** work on a branch named `levels-and-scores`.

## Review Focus

1. **Score storage blocked or corrupt:** an empty table, never a crash, and junk entries dropped one by one. Pinned in Task 3.
2. **Held or mashed keys at the end of a run:** a held Space or Enter must not change initials or save them. Enter and → never act on repeat, and nothing is accepted for 600 ms. Pinned in Task 4 (`initialsKey` repeat cases) and Task 6 (the lockout wiring).
3. **Level cleared by a hard drop:** the win happens inside the key handler, and the banner must still appear. Pinned in Task 6 (`checkEnd` after `playInput`, and a browser check).
4. **Score jump at the level handover:** a clearing drop can finish more rows than the target. The panel score must be the same just before and just after the handover. Pinned in Task 2.
5. **A full table and the longest strings fit the screen:** 10 rows, the run-summary line and the actions box all stay inside 480×270. Pinned in Task 5.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `engine.js`, `engine.test.js` | modify | `dropMs` option, plus its test |
| `run.js`, `run.test.js` | new | difficulty table, run state, speed, score, run-over rule |
| `scores.js`, `scores.test.js` | new | top-10 storage, qualify, insert, row text |
| `settings.js`, `settings.test.js` | modify | drop `target` |
| `ui.js`, `ui.test.js` | modify | initials entry; `layoutBox` reports `scale`; drop `target` row; (Task 6) drop the old difficulty helpers and `endWatcher` |
| `render.js`, `render.test.js` | modify | goal line, outlines above the goal, panel layout, `drawBanner`, `drawScoreTable`, scale-aware `drawItems` |
| `app.js` | rewrite | phases, run flow, scores screen |
| `scripts/files.mjs` | modify | add `run.js`, `scores.js` |
| `README.md` | modify | levels, scores, difficulty table |

---

### Task 1: Engine drop interval

**Files:** Modify `engine.js` (constructor and `update`), Test `engine.test.js` (append).

**Interfaces:** Produces `new Game({dropMs})`, stored as `game.dropMs` (default 950).

- [ ] **Step 1: Branch and failing test**

```bash
git switch -c levels-and-scores
```

Append to `engine.test.js`:

```js
test('dropMs sets the gravity interval; the default stays 950 ms',()=>{
 const g=new Game({dropMs:500,lanes:false}),r=g.piece.r;
 g.update(499);assert.equal(g.piece.r,r);
 g.update(1);assert.equal(g.piece.r,r+1);
 const d=new Game({lanes:false}),r0=d.piece.r;
 assert.equal(d.dropMs,950);
 d.update(949);assert.equal(d.piece.r,r0);
 d.update(1);assert.equal(d.piece.r,r0+1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test engine.test.js`
Expected: FAIL. The `dropMs:500` game hasn't moved by the second assertion, because it still uses 950.

- [ ] **Step 3: Implement**

In `engine.js`:
- In the constructor's parameter list, change `duration=DURATION,random=Math.random}={}){this.duration=duration;` to `duration=DURATION,dropMs=950,random=Math.random}={}){this.duration=duration;this.dropMs=dropMs;`
- In `update`, change `const speed=soft?55:950;` to `const speed=soft?55:this.dropMs;`

- [ ] **Step 4: Run to verify it passes**

Run: `node --test engine.test.js`
Expected: PASS (all engine tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add engine.js engine.test.js
git commit -m "Add a dropMs option to the engine's gravity"
```

---

### Task 2: Run logic

**Files:** Create `run.js`, `run.test.js`; Modify `scripts/files.mjs`.

**Interfaces:**
- Consumes: `Game` from `engine.js` (tests only).
- Produces:
  - `DIFFICULTY` (keyed `easy|medium|hard`, each `{key,label,letter,gaps,reach,target,duration,weight}`)
  - `DIFFICULTY_ORDER = ['easy','medium','hard']`
  - `BASE_DROP_MS = 950`
  - `dropMsFor(cleared)`
  - `createRun(key)` → `{diff, level:1, cleared:0, banked:0}`
  - `levelOptions(run, lanes)` → the `Game` options
  - `onLevelWon(run)` → the next run state
  - `runFloors(run, game|null)`
  - `runScore(run, game|null)`
  - `isRunOver(game)`

- [ ] **Step 1: Failing test**

Create `run.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DIFFICULTY,DIFFICULTY_ORDER,dropMsFor,createRun,levelOptions,onLevelWon,runFloors,runScore,isRunOver} from './run.js';
import {Game} from './engine.js';

test('difficulty table matches the playtest tuning',()=>{
 assert.deepEqual(DIFFICULTY_ORDER,['easy','medium','hard']);
 const pick=k=>{const d=DIFFICULTY[k];return [d.key,d.label,d.letter,d.gaps,d.reach,d.target,d.duration,d.weight];};
 assert.deepEqual(pick('easy'),['easy','EASY','E',2,6,8,180000,1]);
 assert.deepEqual(pick('medium'),['medium','MEDIUM','M',1,5,12,300000,2]);
 assert.deepEqual(pick('hard'),['hard','HARD','H',0,4,12,360000,3]);
});
test('drops get 10% faster per level cleared',()=>{
 assert.equal(dropMsFor(0),950);
 assert.ok(Math.abs(dropMsFor(1)-863.64)<0.01);
 assert.ok(Math.abs(dropMsFor(2)-791.67)<0.01);
 assert.ok(Math.abs(dropMsFor(3)-730.77)<0.01);
});
test('each level is a fresh game with the difficulty rules and that level speed',()=>{
 let run=createRun('medium');
 assert.deepEqual([run.level,run.cleared,run.banked],[1,0,0]);
 let g=new Game(levelOptions(run,true));
 assert.deepEqual([g.target,g.gaps,g.reach,g.duration,g.dropMs,g.lanes],[12,1,5,300000,950,true]);
 run=onLevelWon(run);
 assert.deepEqual([run.level,run.cleared,run.banked],[2,1,12]);
 g=new Game(levelOptions(run,false));
 assert.equal(g.height,0);assert.equal(g.elapsed,0);assert.equal(g.lanes,false);
 assert.ok(Math.abs(g.dropMs-863.64)<0.01);
});
test('score is every floor built times the difficulty weight',()=>{
 let run=createRun('medium');for(let i=0;i<4;i++)run=onLevelWon(run);
 assert.equal(runFloors(run,{height:3}),51);
 assert.equal(runScore(run,{height:3}),102);
 assert.equal(runScore(run,null),96);
 assert.equal(runScore(createRun('hard'),{height:2}),6);
});
test('the score does not jump when a cleared level hands over to the next',()=>{
 const run=createRun('easy'),won={height:9,status:'won'};// one drop can finish more rows than the target
 assert.equal(runScore(run,won),8);
 assert.equal(runScore(onLevelWon(run),{height:0}),8);
});
test('a run ends when the clock runs out or the entry is blocked with nothing left to cut',()=>{
 assert.equal(isRunOver({status:'lost',jammed:false,pending:0}),true);
 assert.equal(isRunOver({status:'playing',jammed:true,pending:0}),true);
 assert.equal(isRunOver({status:'playing',jammed:true,pending:850}),false);
 assert.equal(isRunOver({status:'won',jammed:false,pending:0}),false);
 assert.equal(isRunOver({status:'playing',jammed:false,pending:0}),false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test run.test.js`
Expected: FAIL with `Cannot find module './run.js'`.

- [ ] **Step 3: Implement**

Create `run.js`:

```js
// A run: consecutive levels on one difficulty. Each level is a fresh engine Game; this module is pure.
export const DIFFICULTY={
 easy:{key:'easy',label:'EASY',letter:'E',gaps:2,reach:6,target:8,duration:180000,weight:1},
 medium:{key:'medium',label:'MEDIUM',letter:'M',gaps:1,reach:5,target:12,duration:300000,weight:2},
 hard:{key:'hard',label:'HARD',letter:'H',gaps:0,reach:4,target:12,duration:360000,weight:3},
};
export const DIFFICULTY_ORDER=['easy','medium','hard'];
export const BASE_DROP_MS=950;
// base + base*0.1*level as a speed, so each cleared level shortens the step interval.
export const dropMsFor=cleared=>BASE_DROP_MS/(1+0.1*cleared);
export const createRun=key=>({diff:DIFFICULTY[key],level:1,cleared:0,banked:0});
export const levelOptions=(run,lanes)=>{const d=run.diff;return {target:d.target,gaps:d.gaps,reach:d.reach,duration:d.duration,dropMs:dropMsFor(run.cleared),lanes};};
export const onLevelWon=run=>({...run,level:run.level+1,cleared:run.cleared+1,banked:run.banked+run.diff.target});
// Floors on the current level count up to the target, so the score never jumps at the handover.
export const runFloors=(run,game)=>run.banked+(game?Math.min(game.height,run.diff.target):0);
export const runScore=(run,game)=>runFloors(run,game)*run.diff.weight;
export const isRunOver=game=>game.status==='lost'||(game.jammed&&!game.pending);
```

In `scripts/files.mjs`, change `'assets.js','settings.js']` to `'assets.js','settings.js','run.js','scores.js']`. The server and build will 404 or fail on `scores.js` until Task 3 creates it, so do Task 3 before running the server.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test run.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add run.js run.test.js scripts/files.mjs
git commit -m "Add run logic: difficulty table, level speed, score"
```

---

### Task 3: Score table storage

**Files:** Create `scores.js`, `scores.test.js`.

**Interfaces:**
- Produces:
  - `SCORES_KEY = 'scaffold.scores'`, `MAX_SCORES = 10`
  - `cleanScores(raw)` → `{entries, last}`
  - `loadScores(storage)`, `saveScores(storage, data)` → boolean
  - `qualifies(entries, score)`
  - `insertScore(entries, entry)` → `{entries, rank}`
  - `scoreRow(index, entry)` → a 22-character-ish string
- Entry shape: `{name:'MBH', score:102, diff:'M', level:5, at:1760000000000}`.

- [ ] **Step 1: Failing test**

Create `scores.test.js`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SCORES_KEY,cleanScores,loadScores,saveScores,qualifies,insertScore,scoreRow} from './scores.js';

const e=(name,score,at,diff='M',level=1)=>({name,score,diff,level,at});
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};

test('qualifying: room left, strictly beat the 10th, never zero',()=>{
 const nine=Array.from({length:9},(_,i)=>e('AAA',100-i,i));
 assert.equal(qualifies(nine,1),true);
 const ten=[...nine,e('BBB',50,9)];
 assert.equal(qualifies(ten,50),false);
 assert.equal(qualifies(ten,51),true);
 assert.equal(qualifies([],0),false);
 assert.equal(qualifies(ten,0),false);
});
test('insert keeps order, puts ties after older entries, caps at 10, reports the rank',()=>{
 const two=[e('AAA',100,1),e('BBB',80,2)];
 let r=insertScore(two,e('NEW',80,3));
 assert.deepEqual(r.entries.map(x=>x.name),['AAA','BBB','NEW']);
 assert.equal(r.rank,2);
 assert.equal(insertScore(two,e('TOP',101,3)).rank,0);
 const ten=Array.from({length:10},(_,i)=>e('AAA',100-i,i));// 100..91
 r=insertScore(ten,e('MID',95,99));
 assert.equal(r.entries.length,10);
 assert.equal(r.rank,6);// after the older 95
 assert.equal(r.entries[9].score,92);
});
test('storage: empty, corrupt or blocked gives an empty table without throwing',()=>{
 assert.deepEqual(loadScores(memory()),{entries:[],last:''});
 assert.deepEqual(loadScores(null),{entries:[],last:''});
 const bad=memory();bad.setItem(SCORES_KEY,'{oops');
 assert.deepEqual(loadScores(bad),{entries:[],last:''});
 const hostile={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceeded');}};
 assert.deepEqual(loadScores(hostile),{entries:[],last:''});
 assert.equal(saveScores(hostile,{entries:[],last:''}),false);
});
test('junk entries are dropped one by one, the rest sorted and capped',()=>{
 const valid=Array.from({length:12},(_,i)=>e('ZZZ',10+i,i,'E',2));
 const raw={entries:[e('AB',5,1),e('ABC',-1,1),e('ABC',5,1,'X'),e('ABC',5,1,'M',0),e('abc',5,1),null,'x',e('ABC',2.5,1),...valid],last:'abc'};
 const s=cleanScores(raw);
 assert.equal(s.entries.length,10);
 assert.deepEqual(s.entries.map(x=>x.score),[21,20,19,18,17,16,15,14,13,12]);
 assert.equal(s.last,'');
 assert.deepEqual(cleanScores([]),{entries:[],last:''});
});
test('scores and last-used initials round-trip through storage',()=>{
 const m=memory(),data={entries:[e('MBH',102,5,'M',5),e('A 1',7,6,'H',2)],last:'MBH'};
 assert.equal(saveScores(m,data),true);
 assert.deepEqual(loadScores(m),data);
});
test('table rows line up',()=>{
 assert.equal(scoreRow(0,e('MBH',102,0,'M',5)),' 1  MBH    102  M  L5');
 assert.equal(scoreRow(9,e('A 1',7,0,'H',12)),'10  A 1      7  H  L12');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scores.test.js`
Expected: FAIL with `Cannot find module './scores.js'`.

- [ ] **Step 3: Implement**

Create `scores.js`:

```js
// Local top-10 high scores. Anything unreadable is dropped; storage problems never throw.
export const SCORES_KEY='scaffold.scores';
export const MAX_SCORES=10;
const NAME=/^[A-Z0-9 ]{3}$/,LETTERS=['E','M','H'];
const empty=()=>({entries:[],last:''});
function cleanEntry(x){
 if(!x||typeof x!=='object')return null;
 const {name,score,diff,level,at}=x;
 if(typeof name!=='string'||!NAME.test(name)||!Number.isInteger(score)||score<=0||!LETTERS.includes(diff)||!Number.isInteger(level)||level<1)return null;
 return {name,score,diff,level,at:Number.isFinite(at)?at:0};
}
// Highest first; equal scores keep the older entry above the newer.
const byRank=(a,b)=>b.score-a.score||a.at-b.at;
export function cleanScores(raw){
 const out=empty();
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
 if(Array.isArray(raw.entries))out.entries=raw.entries.map(cleanEntry).filter(Boolean).sort(byRank).slice(0,MAX_SCORES);
 if(typeof raw.last==='string'&&NAME.test(raw.last))out.last=raw.last;
 return out;
}
export function loadScores(storage){try{return cleanScores(JSON.parse(storage.getItem(SCORES_KEY)));}catch{return empty();}}
export function saveScores(storage,data){try{storage.setItem(SCORES_KEY,JSON.stringify(cleanScores(data)));return true;}catch{return false;}}
export const qualifies=(entries,score)=>score>0&&(entries.length<MAX_SCORES||score>entries[MAX_SCORES-1].score);
export function insertScore(entries,entry){
 let i=entries.findIndex(x=>x.score<entry.score);if(i<0)i=entries.length;
 return {entries:[...entries.slice(0,i),entry,...entries.slice(i)].slice(0,MAX_SCORES),rank:i<MAX_SCORES?i:-1};
}
export const scoreRow=(i,x)=>`${String(i+1).padStart(2)}  ${x.name}  ${String(x.score).padStart(5)}  ${x.diff}  L${x.level}`;
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scores.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scores.js scores.test.js
git commit -m "Add validated local top-10 score storage"
```

---

### Task 4: Settings without target; initials entry; scale-aware boxes

**Files:** Modify `settings.js`, `settings.test.js`, `ui.js`, `ui.test.js`.

**Interfaces:**
- Produces:
  - `DEFAULTS = {lanes:true, sound:false, scanlines:0.6}`
  - `SETTING_ROWS = ['lanes','sound','scanlines','back']`
  - `layoutBox(...)` returns `{x, y, w, h, scale, rows}`
  - `INITIAL_CHARS`
  - `startInitials(last)` → `{chars:[c,c,c], slot:0}`
  - `initialsKey(state, key, repeat)` → `{state, done}`
- Removes: `TARGETS` (from `settings.js`) and every `target` branch in `ui.js`.

- [ ] **Step 1: Update the tests first**

In `settings.test.js`:
- Replace the line `assert.deepEqual(clean({target:12,lanes:'yes',sound:true,scanlines:NaN}),{...DEFAULTS,target:12,sound:true});` with:
  ```js
  assert.deepEqual(clean({target:12,lanes:'yes',sound:true,scanlines:NaN}),{...DEFAULTS,sound:true});
  assert.equal('target' in clean({target:12}),false);// target now comes from the difficulty
  ```
- Replace `const s=memory(),v={target:16,lanes:false,sound:true,scanlines:0.2};` with `const s=memory(),v={lanes:false,sound:true,scanlines:0.2};`

In `ui.test.js`:
- Change the import line to also import `startInitials,initialsKey,INITIAL_CHARS`.
- In the test `settings rows cycle targets, toggle switches, and clamp scanlines`:
  - rename it to `settings rows toggle switches and clamp scanlines`
  - replace `assert.deepEqual(SETTING_ROWS,['target','lanes','sound','scanlines','back']);` with `assert.deepEqual(SETTING_ROWS,['lanes','sound','scanlines','back']);`
  - delete the four lines that use `changeSetting(s,'target',…)` / `assert.equal(s.target,…)`
  - delete the line `assert.equal(settingLabel('target',s),'TARGET 16');`
- In the test `box rows stack inside the box…`, add after `const b=layoutBox(…)`:
  ```js
  assert.equal(b.scale,2);
  const small=layoutBox(['AGAIN','MENU'],{y:220,scale:1,minWidth:120});
  assert.equal(small.scale,1);assert.equal(small.rows[0].h,13);
  ```
- Append:

```js
test('initials start from the last used, else AAA, and cycle letters, digits and space both ways',()=>{
 assert.deepEqual(startInitials('MBH'),{chars:['M','B','H'],slot:0});
 assert.deepEqual(startInitials('bad'),{chars:['A','A','A'],slot:0});
 assert.deepEqual(startInitials(undefined),{chars:['A','A','A'],slot:0});
 assert.equal(INITIAL_CHARS,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ');
 const at=(chars,slot=0)=>({chars:[...chars],slot});
 assert.deepEqual(initialsKey(at('AAA'),'ArrowUp',false).state.chars,['B','A','A']);
 assert.deepEqual(initialsKey(at('AAA'),'ArrowDown',false).state.chars,[' ','A','A']);
 assert.deepEqual(initialsKey(at('ZAA'),'ArrowUp',false).state.chars,['0','A','A']);
 assert.deepEqual(initialsKey(at('9AA'),'ArrowUp',false).state.chars,[' ','A','A']);
 assert.deepEqual(initialsKey(at(' AA'),'ArrowUp',false).state.chars,['A','A','A']);
 assert.deepEqual(initialsKey(at('AAA',1),'ArrowUp',true).state.chars,['A','B','A']);// held arrows keep spinning
});
test('initials: slots move with arrows and Enter, the third Enter saves, held keys never save',()=>{
 const s=startInitials('MBH');
 let r=initialsKey(s,'Enter',false);assert.equal(r.state.slot,1);assert.equal(r.done,false);
 r=initialsKey(r.state,'ArrowRight',false);assert.equal(r.state.slot,2);
 assert.equal(initialsKey(r.state,'ArrowRight',false).state.slot,2);// no slot past the third
 assert.equal(initialsKey(r.state,'Enter',true).done,false);// a held Enter never saves
 assert.equal(initialsKey(r.state,'ArrowRight',true).state.slot,2);
 assert.equal(initialsKey(r.state,'ArrowLeft',false).state.slot,1);
 assert.equal(initialsKey(s,'ArrowLeft',false).state.slot,0);
 assert.equal(initialsKey(r.state,' ',false).done,false);// Space is the drop key: never confirms
 r=initialsKey(r.state,'Enter',false);assert.equal(r.done,true);
 assert.deepEqual(r.state.chars,['M','B','H']);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test settings.test.js ui.test.js`
Expected: FAIL. `target` is still kept, `SETTING_ROWS` still has `target`, `b.scale` is undefined, and `startInitials` is not exported.

- [ ] **Step 3: Implement**

`settings.js`. Replace the file with:

```js
// Player settings, kept in localStorage. Anything unreadable falls back to the defaults.
// The target height now comes from the difficulty (run.js), so an old saved target is ignored.
export const KEY='scaffold.settings';
export const DEFAULTS=Object.freeze({lanes:true,sound:false,scanlines:0.6});
export function clean(raw){
 const s={...DEFAULTS};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
 if(typeof raw.lanes==='boolean')s.lanes=raw.lanes;
 if(typeof raw.sound==='boolean')s.sound=raw.sound;
 if(typeof raw.scanlines==='number'&&raw.scanlines>=0&&raw.scanlines<=1)s.scanlines=Math.round(raw.scanlines*10)/10;
 return s;
}
export function loadSettings(storage){try{return clean(JSON.parse(storage.getItem(KEY)));}catch{return {...DEFAULTS};}}
export function saveSettings(storage,s){try{storage.setItem(KEY,JSON.stringify(clean(s)));return true;}catch{return false;}}
```

`ui.js`:
- Delete the line `import {TARGETS} from './settings.js';`
- In `layoutBox`, change `return {x,y,w,h,rows:` to `return {x,y,w,h,scale,rows:`
- Change `export const SETTING_ROWS=['target','lanes','sound','scanlines','back'];` to `export const SETTING_ROWS=['lanes','sound','scanlines','back'];`
- Delete the line ` if(row==='target')return \`TARGET ${s.target}\`;`
- Delete the line ` if(row==='target'){const i=TARGETS.indexOf(s.target);return {...s,target:TARGETS[(i+dir+TARGETS.length)%TARGETS.length]};}`
- Append:

```js
// Arcade initials: three slots; up/down spin the character, left/right or Enter move, Enter on the last saves.
export const INITIAL_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
export const startInitials=last=>({chars:[...(typeof last==='string'&&/^[A-Z0-9 ]{3}$/.test(last)?last:'AAA')],slot:0});
export function initialsKey(state,key,repeat){
 const {chars,slot}=state,n=INITIAL_CHARS.length,stay={state,done:false};
 if(key==='ArrowUp'||key==='ArrowDown'){
  const next=[...chars];next[slot]=INITIAL_CHARS[(INITIAL_CHARS.indexOf(chars[slot])+(key==='ArrowUp'?1:-1)+n)%n];
  return {state:{chars:next,slot},done:false};
 }
 if(key==='ArrowLeft')return {state:{chars,slot:Math.max(0,slot-1)},done:false};
 if(repeat)return stay;// a held Enter or right arrow never moves on or saves
 if(key==='ArrowRight')return {state:{chars,slot:Math.min(2,slot+1)},done:false};
 if(key==='Enter')return slot===2?{state,done:true}:{state:{chars,slot:slot+1},done:false};
 return stay;
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS, with no failures anywhere. `app.js` still passes `settings.target`, which is now undefined, so the engine falls back to target 8. The game keeps working until Task 6.

- [ ] **Step 5: Commit**

```bash
git add settings.js settings.test.js ui.js ui.test.js
git commit -m "Drop the target setting; add arcade initials entry; boxes report their scale"
```

---

### Task 5: Rendering: goal line, panel, banner, score table

**Files:** Modify `render.js`, `render.test.js`.

**Interfaces:**
- Consumes: `scoreRow` from `scores.js`; `measure` from `font.js`; `layoutBox` from `ui.js` (tests only).
- Produces:
  - `PANEL_LINES` (y offsets inside the panel)
  - `drawPanel(ctx, game, {remaining, label, message, level=1, score=0})`
  - `BANNER = {cx:229, w:140, y:70}`, `bannerHeight({lines, big, slots})`, `drawBanner(ctx, {title, lines=[], big='', slots=null, slot=-1, now=0})`
  - `SCORE_TABLE = {x:90, y:6, w:300, h:210, rowY:44, rowH:16}`, `drawScoreTable(ctx, entries, highlight, now, {title='HIGH SCORES', line=''}={})`
  - `drawItems` draws labels at `box.scale ?? 2`

- [ ] **Step 1: Failing test**

Append to `render.test.js`. Merge the imports: add `PANEL_LINES,BANNER,bannerHeight,SCORE_TABLE` to the existing `render.js` import, and add the two new import lines.

```js
import {layoutBox} from './ui.js';
import {measure} from './font.js';

test('readout panel lines stay inside the panel',()=>{
 const p=LAYOUT.panel,L=PANEL_LINES;
 assert.ok(L.timeDigits+21<=L.level&&L.levelDigits+14<=L.score&&L.scoreDigits+14<=L.floors&&L.floorsDigits+14<=L.next);
 assert.ok(L.message+2*9+7<=p.h-3,'message runs past the panel');
 assert.ok(measure('00:00',3)<=p.w-20&&measure('12/12',2)<=p.w-20&&measure('MEDIUM  CUTS 99',1)<=p.w-20);
});
test('banners fit over the board, even with summary, score and initials',()=>{
 const h=bannerHeight({lines:['MEDIUM  LEVEL 12','144 FLOORS'],big:'288',slots:['A','B','C']});
 const k=LAYOUT.cabinet;
 assert.ok(BANNER.y>=k.y&&BANNER.y+h<=k.y+k.h,`banner height ${h}`);
 assert.ok(BANNER.cx-BANNER.w/2>=k.x&&BANNER.cx+BANNER.w/2<=k.x+k.w);
 for(const t of ['RUN OVER','LEVEL 12'])assert.ok(measure(t,2)<=BANNER.w-8,t);
 assert.ok(measure('MEDIUM  LEVEL 12',1)<=BANNER.w-8);
});
test('a full score table, its summary line and its buttons fit the screen',()=>{
 const t=SCORE_TABLE;
 assert.ok(t.y+t.rowY+9*t.rowH+14<=t.y+t.h-3,'tenth row runs past the table');
 assert.ok(18+measure('10  A 1  99999  H  L99',2)<=t.w-3,'rows too wide');
 assert.ok(measure('MEDIUM  LEVEL 12  144 FLOORS  SCORE 288',1)<=t.w-8);
 const actions=layoutBox(['AGAIN','MENU'],{y:220,scale:1,minWidth:120});
 assert.ok(t.y+t.h<=actions.y&&actions.y+actions.h<=270);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test render.test.js`
Expected: FAIL. `PANEL_LINES` etc. are not exported (`SyntaxError` or `undefined`).

- [ ] **Step 3: Implement**

In `render.js`:

1. Add `import {scoreRow} from './scores.js';` and change `import {drawText,wrap} from './font.js';` to `import {drawText,wrap,measure} from './font.js';`.

2. Make `drawItems` scale-aware. Replace these two lines inside it:
   ```js
     drawText(ctx,r.label,r.x+r.w/2,r.y+3,C.white,2,'center');
     if(sel&&Math.floor(now/400)%2===0)drawText(ctx,'▶',r.x+4,r.y+3,C.yellow,2);
   ```
   with:
   ```js
     const s=box.scale??2;
     drawText(ctx,r.label,r.x+r.w/2,r.y+3,C.white,s,'center');
     if(sel&&Math.floor(now/400)%2===0)drawText(ctx,'▶',r.x+4,r.y+3,C.yellow,s);
   ```

3. Goal line. Replace the `guide` function with:
   ```js
   // Guide line across the board at the top of row r, labelled outside the cabinet; solid lines are 2 px.
   function guide(ctx,r,color,label,{dy=0,solid=false}={}){
    const y=rowTop(r),{BX}=LAYOUT;ctx.fillStyle=color;
    if(solid)ctx.fillRect(BX-3,y-1,153,2);
    else for(let x=BX-3;x<BX+150;x+=4)ctx.fillRect(x,y,2,1);
    const w=label.length*6-1,lx=LAYOUT.cabinet.x-3-w;
    ctx.fillStyle=C.black;ctx.fillRect(lx-2,y-4+dy,w+4,11);
    drawText(ctx,label,lx,y-2+dy,color);
   }
   ```
   In `drawBoard`:
   - Replace the board cell line
     ```js
       for(let c=0;c<WIDTH;c++){const {x,y}=cellXY(c,r),v=game.board[r][c];ctx.drawImage(v?tile('solid',PIECES[v-1]):tile('outline',r>=solidFrom?C.indigo:C.navy),x,y);}
     ```
     with
     ```js
       for(let c=0;c<WIDTH;c++){const {x,y}=cellXY(c,r),v=game.board[r][c];ctx.drawImage(v?tile('solid',PIECES[v-1]):tile('outline',r>=solidFrom?C.indigo:r<goalR?C.black:C.navy),x,y);}
     ```
   - Change ` const solidFrom=HEIGHT-game.height;` to ` const solidFrom=HEIGHT-game.height,goalR=HEIGHT-game.target;`
   - Replace the two guide calls with:
     ```js
      guide(ctx,targetR,C.yellow,'GOAL',{solid:true});
      if(limitR>0)guide(ctx,limitR,C.hotpink,'REACH',{dy:limitR===targetR?11:0});
     ```

4. Panel. Replace the whole `drawPanel` function with:
   ```js
   export const PANEL_LINES={time:10,timeDigits:20,level:48,levelDigits:58,score:76,scoreDigits:86,floors:104,floorsDigits:114,next:134,mini:162,beat:190,diff:202,rules:212,message:226};
   export function drawPanel(ctx,game,{remaining,label,message,level=1,score=0}){
    const {x,y,w,h}=LAYOUT.panel,L=x+10,P=PANEL_LINES;
    drawBox(ctx,x,y,w,h);
    drawText(ctx,'TIME',L,y+P.time,C.cream);
    drawText(ctx,clock(remaining),L,y+P.timeDigits,remaining<60000?C.hotpink:C.white,3);
    drawText(ctx,'LEVEL',L,y+P.level,C.cream);
    drawText(ctx,String(level),L,y+P.levelDigits,C.white,2);
    drawText(ctx,'SCORE',L,y+P.score,C.cream);
    drawText(ctx,String(score),L,y+P.scoreDigits,C.white,2);
    drawText(ctx,'FLOORS',L,y+P.floors,C.cream);
    drawText(ctx,`${game.height}/${game.target}`,L,y+P.floorsDigits,C.white,2);
    drawText(ctx,'NEXT',L,y+P.next,C.cream);
    drawMini(ctx,game.next,x+w/2,y+P.mini);
    if(game.piece&&game.active()&&game.fits(game.lower()))drawText(ctx,game.stepDir()==='se'?'TICK ▶ SE':'TOCK ◀ SW',L,y+P.beat,C.yellow);
    drawText(ctx,`${label}  CUTS ${game.cuts}`,L,y+P.diff,C.lavender);
    drawText(ctx,`GAPS ${game.gaps} REACH ${game.reach}`,L,y+P.rules,C.lavender);
    wrap(message,22,3).forEach((line,i)=>drawText(ctx,line,L,y+P.message+i*9,C.white));
   }
   ```

5. Banner and table. Append:
   ```js
   // A box over the board with a title, info lines, an optional big number and optional initials slots.
   export const BANNER={cx:229,w:140,y:70};
   export const bannerHeight=({lines=[],big='',slots=null})=>28+lines.length*9+(big?27:0)+(slots?30:0)+6;
   export function drawBanner(ctx,{title,lines=[],big='',slots=null,slot=-1,now=0}){
    const h=bannerHeight({lines,big,slots}),x=Math.round(BANNER.cx-BANNER.w/2);
    drawBox(ctx,x,BANNER.y,BANNER.w,h);
    let cy=BANNER.y+8;
    drawText(ctx,title,BANNER.cx,cy,C.yellow,2,'center');cy+=20;
    for(const l of lines){drawText(ctx,l,BANNER.cx,cy,C.white,1,'center');cy+=9;}
    if(big){cy+=3;drawText(ctx,big,BANNER.cx,cy,C.white,3,'center');cy+=24;}
    if(slots){
     cy+=4;const x0=Math.round(BANNER.cx-measure(slots.join(''),3)/2);
     slots.forEach((ch,i)=>{
      const sx=x0+i*18;drawText(ctx,ch,sx,cy,i===slot?C.yellow:C.white,3);
      const on=i!==slot||Math.floor(now/300)%2===0;
      if(on){ctx.fillStyle=i===slot?C.yellow:C.lavender;ctx.fillRect(sx,cy+23,15,i===slot?2:1);}
     });
    }
   }
   // The top-10 table: rank, initials, score, difficulty letter, level. The new entry blinks.
   export const SCORE_TABLE={x:90,y:6,w:300,h:210,rowY:44,rowH:16};
   export function drawScoreTable(ctx,entries,highlight,now,{title='HIGH SCORES',line=''}={}){
    const t=SCORE_TABLE,cx=t.x+t.w/2;
    drawBox(ctx,t.x,t.y,t.w,t.h);
    drawText(ctx,title,cx,t.y+8,C.yellow,2,'center');
    if(line)drawText(ctx,line,cx,t.y+28,C.cream,1,'center');
    if(!entries.length)drawText(ctx,'NO SCORES YET',cx,t.y+100,C.lavender,2,'center');
    entries.forEach((x,i)=>{
     const color=i===highlight?(Math.floor(now/300)%2===0?C.yellow:C.orange):C.white;
     drawText(ctx,scoreRow(i,x),t.x+18,t.y+t.rowY+i*t.rowH,color,2);
    });
   }
   ```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS everywhere. `app.js` still calls `drawPanel` without `level`/`score`, so it shows level 1 and score 0 until Task 6.

- [ ] **Step 5: Commit**

```bash
git add render.js render.test.js
git commit -m "Render the goal line, run readouts, banners and the score table"
```

---

### Task 6: App: runs, level clears, initials and the table

**Files:** Rewrite `app.js`; Modify `ui.js`, `ui.test.js` (remove the old difficulty helpers and `endWatcher`).

**Interfaces:** Consumes everything above. Produces the playable feature.

- [ ] **Step 1: Remove the superseded helpers (tests first)**

In `ui.test.js`:
- Delete the whole test `difficulty table matches the game rules` (it moved to `run.test.js`).
- In the test `a game end is noticed exactly once, wherever it happened, and results stay locked briefly`:
  - rename it to `results stay locked briefly; the pause box never locks`
  - delete its `endWatcher` lines, keeping only the three `canSelect` assertions:
    ```js
    test('results stay locked briefly; the pause box never locks',async()=>{
     const {canSelect}=await import('./ui.js');
     assert.equal(canSelect(false,1000,1500),false);
     assert.equal(canSelect(false,1000,1601),true);
     assert.equal(canSelect(true,1000,1001),true);
    });
    ```
- Remove `DIFFICULTIES,difficulty,` from the import line.

In `ui.js`, delete these lines:
- `export const DIFFICULTIES=[…];`
- the `// Difficulty sets…` comment line
- `export const difficulty=gaps=>…;`
- the `// A game can end inside update()…` comment line
- `export function endWatcher(){…}`

Run: `node --test ui.test.js`
Expected: PASS.

- [ ] **Step 2: Rewrite `app.js`**

Replace `app.js` with:

```js
import {Game,HEIGHT} from './engine.js';
import {C} from './palette.js';
import {loadAssets} from './assets.js';
import {loadSettings,saveSettings} from './settings.js';
import {loadScores,saveScores,qualifies,insertScore} from './scores.js';
import {DIFFICULTY,DIFFICULTY_ORDER,createRun,levelOptions,onLevelWon,runFloors,runScore,isRunOver} from './run.js';
import {fitScale,layoutBox,hit,menuKey,SETTING_ROWS,settingLabel,changeSetting,canSelect,startInitials,initialsKey,clock} from './ui.js';
import {LAYOUT,drawSky,drawBackdrop,drawSprites,drawDim,drawBox,drawItems,drawLogo,drawControls,MENU_SCENERY,PLAY_SCENERY,drawBoard,drawPanel,drawBanner,drawScoreTable} from './render.js';

const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),screenEl=document.getElementById('screen'),scanEl=document.getElementById('scan');
ctx.imageSmoothingEnabled=false;
const store=(()=>{try{return window.localStorage;}catch{return null;}})();
let settings=loadSettings(store),scores=loadScores(store),assets={manifest:null,images:{}};
// screen: 'menu' | 'settings' | 'scores' | 'play'. On the play screen, phase: 'playing' | 'clear' | 'entry' | 'table'.
let screen='menu',cursor=1,settingsCursor=0,boxCursor=0,game=null,run=null,phase='playing',phaseAt=0,soft=false,last=0;
let flash=null,offcut=null,message='',messageUntil=0,entry=null,result=null,highlight=-1,audio;
const CLEAR_MS=1500;
loadAssets().then(a=>{assets=a;});

function resize(){
 const dpr=window.devicePixelRatio||1,s=fitScale(innerWidth,innerHeight,dpr);
 screenEl.style.width=`${480*s/dpr}px`;screenEl.style.height=`${270*s/dpr}px`;
 screenEl.style.setProperty('--px',`${1/dpr}px`);// scanlines stay one device pixel thin
}
addEventListener('resize',resize);resize();
const applyScan=()=>{scanEl.style.opacity=String(settings.scanlines);};
applyScan();

function tone(freq=260,dur=.08){if(!settings.sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.value=freq;gain.gain.setValueAtTime(.05,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+dur);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+dur);}catch{}}
function note(s){message=s;messageUntil=performance.now()+5000;}
const floorsText=n=>`${n} ${n===1?'FLOOR':'FLOORS'}`;

const MENU_ITEMS=[...DIFFICULTY_ORDER.map(k=>DIFFICULTY[k].label),'HIGH SCORES','SETTINGS'];
const menuLayout=()=>layoutBox(MENU_ITEMS,{y:72,minWidth:120});
const settingsLayout=()=>layoutBox(SETTING_ROWS.map(r=>settingLabel(r,settings)),{y:80,minWidth:200});
const actionsLayout=()=>layoutBox(screen==='scores'?['BACK']:['AGAIN','MENU'],{y:220,scale:1,minWidth:120});
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
function blur(){soft=false;if(screen==='play'&&phase==='playing'&&game.status==='playing'&&!game.paused){game.paused=true;boxCursor=0;}}
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
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter','Escape','Shift','p','x','z'].includes(k))e.preventDefault();
 if(screen==='menu')menuInput(k,e.repeat);
 else if(screen==='settings')settingsInput(k,e.repeat);
 else if(screen==='scores')scoresInput(k,e.repeat);
 else{playInput(k,e.repeat);checkEnd(performance.now());}
});
addEventListener('keyup',e=>{if(e.key==='ArrowDown')soft=false;});

const toCanvas=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*480/r.width,(e.clientY-r.top)*270/r.height];};
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
});

function draw(now){
 drawSky(ctx,assets.manifest,now);drawBackdrop(ctx,assets);
 if(screen==='play'){
  drawSprites(ctx,assets,PLAY_SCENERY,now);drawDim(ctx);
  const k=LAYOUT.cabinet;drawBox(ctx,k.x,k.y,k.w,k.h,C.royal);
  drawBoard(ctx,game,{now,flash,offcut});
  const live=phase==='playing'&&game.active();
  drawPanel(ctx,game,{remaining:game.duration-game.elapsed,label:run.diff.label,level:run.level,score:runScore(run,game),
   message:now<messageUntil||!live?message:`FINISH FLOOR ${game.height+1}.`});
  if(phase==='clear')drawBanner(ctx,{title:`LEVEL ${run.level}`,lines:['CLEAR',`${clock(game.duration-game.elapsed)} LEFT`]});
  else if(phase==='entry')drawBanner(ctx,{title:'RUN OVER',lines:[`${result.label}  LEVEL ${result.level}`,floorsText(result.floors)],big:String(result.score),slots:entry.chars,slot:entry.slot,now});
  else if(phase==='table'){
   drawDim(ctx);
   drawScoreTable(ctx,scores.entries,highlight,now,{title:'RUN OVER',line:`${result.label}  LEVEL ${result.level}  ${floorsText(result.floors)}  SCORE ${result.score}`});
   drawItems(ctx,actionsLayout(),boxCursor,now);
  }
  else if(game.paused)drawItems(ctx,pauseLayout(),boxCursor,now,{title:'PAUSED',lines:['P TO RESUME']});
  return;
 }
 drawSprites(ctx,assets,MENU_SCENERY,now);
 if(screen==='scores'){drawDim(ctx);drawScoreTable(ctx,scores.entries,-1,now);drawItems(ctx,actionsLayout(),boxCursor,now);return;}
 drawLogo(ctx,assets);
 if(screen==='menu'){drawItems(ctx,menuLayout(),cursor,now);drawControls(ctx);}
 else drawItems(ctx,settingsLayout(),settingsCursor,now);
}
function frame(now){
 const dt=Math.min(100,Math.max(0,now-last));last=now;
 if(screen==='play'){
  if(phase==='playing'){game.update(dt,soft);handleEvents(now);checkEnd(now);}
  else if(phase==='clear'&&now-phaseAt>=CLEAR_MS){run=onLevelWon(run);startLevel();note(`LEVEL ${run.level}. DROPS ARE FASTER.`);}
 }
 draw(now);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 3: Run all tests and the build**

Run: `npm test && npm run build && ls dist`
Expected: all tests pass, including `strings.test.js`, which checks the new display text. `dist/` contains `run.js` and `scores.js`.

- [ ] **Step 4: Browser checks**

Run `PORT=4173 npm start` in the background and open `http://127.0.0.1:4173`. Check each of these:
- **Menu:** shows EASY / MEDIUM / HARD / HIGH SCORES / SETTINGS, with the cursor on MEDIUM. The box doesn't overlap the logo or the controls box. If it does, adjust `menuLayout`'s `y`.
- **Settings:** has no TARGET row.
- **HIGH SCORES on a fresh profile:** shows NO SCORES YET and BACK. Esc returns to the menu.
- **Start EASY:** the panel shows TIME 03:00, LEVEL 1, SCORE 0, FLOORS 0/8 and `EASY  CUTS 0`. The goal line is a solid yellow GOAL line, and the empty cells above it have black outlines.
- **Level clear:** temporarily change EASY's `target:8` to `target:1` in `run.js` and reload. Build one solid row by hard-dropping, which clears the level inside the key handler. The LEVEL 1 / CLEAR / m:ss LEFT banner shows for about 1.5 s. Then LEVEL 2 starts with an empty board, a full clock, SCORE 1 and the "DROPS ARE FASTER" message.
- **Run over:** temporarily set EASY's `duration:180000` to `duration:4000`, start EASY, clear one level, then let the clock run out while holding Space. The RUN OVER banner shows the summary, the score and three letter slots. The held Space doesn't type or save. After 600 ms, ↑/↓ changes the letter and Enter ×3 saves. The table then shows the new row blinking, with AGAIN / MENU below it.
- **Second run:** AGAIN starts a new EASY run. Finishing it lower than 10 existing scores goes straight to the table.
- **Pause:** pause → MENU during a run returns to the title with nothing recorded.
- **Revert** both temporary `run.js` changes, then run `node --test run.test.js` to confirm the table values are back.
- **Console:** no errors.

- [ ] **Step 5: Commit**

```bash
git add app.js ui.js ui.test.js
git commit -m "Play runs of levels with faster drops, initials entry and a top-10 table"
```

---

### Task 7: README and final pass

**Files:** Modify `README.md`.

- [ ] **Step 1: Update the README**

In `README.md`'s Play section:
- Replace the paragraph starting `**Difficulty** is chosen on the title menu` with:

```markdown
**Difficulty** is chosen on the title menu and sets every rule of a run:

| | Open hexes a solid row may keep | Reach above the top solid floor | Target floors | Clock per level | Score weight |
|---|---|---|---|---|---|
| EASY | 2 | 6 rows | 8 | 3:00 | ×1 |
| MEDIUM | 1 | 5 rows | 12 | 5:00 | ×2 |
| HARD | 0 | 4 rows | 12 | 6:00 | ×3 |

A solid row counts as a floor, sets off the cutback check when it is sealed, and is never treated as a gap below a sealed row; its open hexes stay open and can still be filled later. A red dashed line marks the reach limit and climbs as floors are finished; the landing outline turns red when a drop would cross it. Locking a piece above the line sets off a "TOO HIGH" cutback.

**Runs and levels:** reach the target (the solid yellow GOAL line) before the clock runs out to clear the level. The next level starts on an empty board with a full clock, and pieces drop 10% faster for every level cleared. The run ends when a level's clock runs out, or when a piece cannot enter and nothing is left to cut. Your score is every solid floor you built in the run times the difficulty weight. A top-10 score asks for three initials (↑/↓ change a letter, ←/→ or Enter move, Enter on the last saves); the table is kept in your browser and is also under HIGH SCORES on the title menu.
```

- Replace the paragraph starting `Build eight consecutive solid floors` with:

```markdown
Build from the sawtooth foundation up to the GOAL line. Settings holds edge lanes, sound and scanline strength; settings and high scores are remembered in the browser. Complete floors stay in place.
```

- In the Project files list, change the `` `render.js` — … `` line so it also mentions `` `run.js` — levels, speed and score; `scores.js` — the local top-10 table ``.

- [ ] **Step 2: Full check**

Run: `npm test && npm run build`
Expected: all tests pass and the build succeeds.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document runs, levels and high scores"
```
