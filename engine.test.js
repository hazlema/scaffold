import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,SHAPES,rotateCells,onBoard,WIDTH,HEIGHT,DURATION} from './engine.js';
test('piece set contains three trihexes and seven tetrahexes, each restored by six turns',()=>{assert.equal(SHAPES.filter(s=>s.cells.length===3).length,3);assert.equal(SHAPES.filter(s=>s.cells.length===4).length,7);for(const s of SHAPES){let cells=s.cells;for(let i=0;i<6;i++)cells=rotateCells(cells);assert.deepEqual(cells,s.cells);}});
test('placing above a gap alone does not cut the tower',()=>{const g=new Game();g.board[HEIGHT-2][3]=1;g.resolve([]);assert.equal(g.board[HEIGHT-2][3],1);assert.equal(g.cuts,0);});
test('completing an upper row deletes everything above lowest gap and preserves that row',()=>{const g=new Game();g.board[HEIGHT-1].fill(1);g.board[HEIGHT-2][0]=2;g.board[HEIGHT-3].fill(3);g.board[HEIGHT-5][2]=4;g.resolve([HEIGHT-3]);assert.equal(g.cuts,1);assert.equal(g.board[HEIGHT-2][0],2);assert.ok(g.board[HEIGHT-1].every(v=>v===1));assert.ok(g.board.slice(0,HEIGHT-2).flat().every(v=>v===0));assert.equal(g.height,1);});
test('completed floors remain and reaching target wins',()=>{const g=new Game({target:2});g.board[HEIGHT-1].fill(1);g.board[HEIGHT-2].fill(2);g.resolve([HEIGHT-2]);assert.equal(g.cuts,0);assert.equal(g.status,'won');assert.equal(g.height,2);});
test('gravity and rotations cannot overlap walls or settled cells',()=>{const g=new Game({random:()=>0});for(let i=0;i<20;i++)g.move(-1);assert.ok(g.fits());g.drop();assert.equal(g.placed,1);assert.equal(g.board.flat().filter(Boolean).length,4);assert.ok(g.fits());});
test('pause freezes simulation and running out of time loses',()=>{const g=new Game();g.paused=true;g.update(1000);assert.equal(g.elapsed,0);g.paused=false;g.elapsed=DURATION-10;g.update(20);assert.equal(g.status,'lost');});

test('hard-drop completion triggers the cutback through the real placement loop',()=>{const g=new Game();g.board[HEIGHT-1].fill(1);g.board[HEIGHT-2].fill(2);g.board[HEIGHT-2][1]=0;g.board[HEIGHT-3].fill(3,0,5);g.piece={id:7,cells:[[-1,0],[0,0],[1,0]],q:5,r:2};g.drop();assert.equal(g.cuts,1);assert.equal(g.height,1);assert.equal(g.board[HEIGHT-2][1],0);assert.ok(g.board[HEIGHT-3].every(v=>v===0));assert.equal(g.pending,850);const elapsed=g.elapsed;g.update(900);assert.equal(g.pending,0);assert.equal(g.elapsed,elapsed+900);assert.ok(g.fits());});

test('without lanes, every shape and rotation descends at either side wall on an empty board',()=>{
 for(let id=0;id<SHAPES.length;id++){
  let cells=SHAPES[id].cells;
  for(let turn=0;turn<6;turn++,cells=rotateCells(cells))for(const r of [3,4])for(let q=-5;q<WIDTH;q++){
   const g=new Game({lanes:false});g.piece={id,cells,q,r};if(!g.fits())continue;
   assert.equal(g.down(),true,`shape ${id}, turn ${turn}, q ${q}, r ${r}`);
   assert.ok(g.fits());
   const landing=g.landing();assert.equal(Math.max(...g.cells(landing).map(p=>p.r)),HEIGHT-1);
   g.drop();assert.equal(g.placed,1);assert.ok(g.board[HEIGHT-1].some(Boolean));
  }
 }
});
test('without lanes, side-wall contact does not start the lock timer while descent is available',()=>{
 const g=new Game({lanes:false});g.piece={id:0,cells:SHAPES[0].cells,q:-1,r:3};
 for(let i=0;i<6;i++)g.update(100);
 assert.equal(g.placed,0);assert.equal(g.grounded,0);
 for(let i=0;i<4;i++)g.update(100);
 assert.equal(g.piece.r,4);assert.ok(g.fits());
});
test('without lanes, the alternative direction cannot pass through a settled cell',()=>{
 const g=new Game({lanes:false});g.piece={id:0,cells:SHAPES[0].cells,q:-1,r:3};
 g.board[4][2]=1;assert.equal(g.down(),false);
});
test('stack contact inside the board does not automatically slide sideways',()=>{
 const g=new Game();g.piece={id:0,cells:SHAPES[0].cells,q:2,r:3};
 g.board[4][3]=1;assert.ok(g.fits());assert.equal(g.down(),false);
});

test('blocked entry cuts above the lowest gap and retries the same delivery',()=>{
 const g=new Game({target:20,random:()=>0});g.board.forEach(row=>row.fill(1));
 g.board[HEIGHT-3][2]=0;
 const delivery=g.next;g.spawn();const preview=g.next;
 assert.equal(g.cuts,1);assert.equal(g.pending,850);assert.equal(g.board[HEIGHT-3][2],0);
 assert.equal(g.board[HEIGHT-3][3],1);assert.equal(g.board[HEIGHT-5][4],0);
 g.update(850);assert.equal(g.status,'playing');assert.equal(g.jammed,false);assert.ok(g.fits());
 assert.equal(g.piece.id,delivery);assert.equal(g.next,preview);
});
test('blocked solid tower wins before the deadline, ignoring empty headroom',()=>{
 const g=new Game({target:20});for(let r=2;r<HEIGHT;r++)g.board[r].fill(1);
 g.next=0;g.elapsed=DURATION-1;g.spawn();assert.equal(g.status,'won');assert.equal(g.height,18);assert.equal(g.cuts,0);
});
test('blocked solid tower cannot win at the deadline',()=>{
 const g=new Game({target:20});g.board.forEach(row=>row.fill(1));g.elapsed=DURATION;
 g.spawn();assert.equal(g.status,'lost');
});
test('deadline still runs during automatic blocked-entry cutback',()=>{
 const g=new Game({target:20});g.board.forEach(row=>row.fill(1));g.board[18][2]=0;
 g.elapsed=DURATION-100;g.spawn();g.update(100);assert.equal(g.status,'lost');
});
test('an unremovable top gap cannot loop or become a false win',()=>{
 const g=new Game({target:20});for(let r=2;r<HEIGHT;r++)g.board[r].fill(1);g.board[2][0]=0;g.next=0;
 g.spawn();assert.equal(g.status,'playing');assert.equal(g.cuts,0);assert.equal(g.pending,0);assert.equal(g.jammed,true);
 g.update(1000);assert.equal(g.elapsed,1000);assert.equal(g.status,'playing');
});

const clean=g=>g.board.every(row=>row.length===WIDTH&&Object.keys(row).length===WIDTH);
test('with lanes, every shape and rotation near either wall lands on the floor and writes only board cells',()=>{
 const sides=new Set();
 for(let id=0;id<SHAPES.length;id++){
  let cells=SHAPES[id].cells;
  for(let turn=0;turn<6;turn++,cells=rotateCells(cells))for(const r of [3,4])for(let q=-6;q<WIDTH+1;q++){
   const g=new Game();g.piece={id,cells,q,r};if(!g.fits())continue;
   const landing=g.landing(),cs=g.cells(landing);assert.ok(cs.some(({c})=>onBoard(c)));
   assert.ok(cs.every(({c})=>c>=-1&&c<=WIDTH));for(const {c} of cs)if(!onBoard(c))sides.add(c);
   assert.equal(Math.max(...g.cells(landing).map(p=>p.r)),HEIGHT-1,`shape ${id}, turn ${turn}, q ${q}, r ${r}`);
   g.drop();assert.equal(g.placed,1);assert.ok(clean(g));
   assert.equal(g.board.flat().filter(Boolean).length+g.offcuts,cells.length);
  }
 }
 assert.deepEqual([...sides].sort((a,b)=>a-b),[-1,WIDTH]);
});
test('with lanes, gravity at a wall swings cells into the lane',()=>{
 const g=new Game();g.piece={id:0,cells:SHAPES[0].cells,q:-1,r:3};g.down();
 assert.deepEqual(g.cells().map(p=>[p.r,p.c]),[[3,-1],[4,0],[3,0],[4,1]]);
});
test('with lanes, settled cells still stop pieces, including one straddling a lane',()=>{
 const t=new Game();t.board[16][5]=1;t.piece={id:7,cells:[[-1,0],[0,0],[1,0]],q:-3,r:14};
 assert.deepEqual(t.cells(t.landing()).map(p=>[p.r,p.c]),[[15,3],[15,4],[15,5]]);
 const straddle={id:7,cells:[[-1,0],[0,0],[1,0]],q:-9,r:HEIGHT-1};
 const a=new Game();a.board[HEIGHT-1][0]=1;assert.equal(a.fits(straddle),false);
 const b=new Game();b.board[HEIGHT-1][1]=1;assert.equal(b.fits(straddle),false);
});
test('a position needs at least one cell on the board',()=>{
 const g=new Game();g.piece={id:9,cells:[[0,0],[0,1]],q:-3,r:4};
 assert.ok(g.cells().every(({c})=>c===-1));assert.equal(g.fits(),false);
});
test('locking in a lane cuts off the lane cells and reports them',()=>{
 const g=new Game();g.piece={id:7,cells:[[-1,0],[0,0],[1,0]],q:-9,r:HEIGHT-1};
 assert.deepEqual(g.cells().map(p=>p.c),[-1,0,1]);assert.ok(g.fits());assert.equal(g.fits(g.piece,false),false);
 g.events=[];g.drop();
 assert.equal(g.offcuts,1);assert.deepEqual(g.board[HEIGHT-1].slice(0,3),[8,8,0]);assert.ok(clean(g));
 assert.deepEqual(g.events.find(e=>e.type==='lock').offcuts,[{r:HEIGHT-1,c:-1,id:7}]);
 const right=new Game();right.piece={id:7,cells:[[-1,0],[0,0],[1,0]],q:-2,r:HEIGHT-1};
 assert.deepEqual(right.cells().map(p=>p.c),[6,7,8]);right.events=[];right.drop();
 assert.equal(right.offcuts,1);assert.deepEqual(right.board[HEIGHT-1].slice(5),[0,8,8]);assert.ok(clean(right));
 assert.deepEqual(right.events.find(e=>e.type==='lock').offcuts,[{r:HEIGHT-1,c:WIDTH,id:7}]);
});
test('a held key stops at the visible wall; a fresh press enters the lane; a held key can leave it',()=>{
 for(const dx of [-1,1]){
  const g=new Game({random:()=>0}),lane=dx<0?-1:WIDTH;
  while(g.move(dx,false));
  assert.equal(g.laneCells().length,0);
  assert.equal(g.move(dx),true);assert.ok(g.laneCells().length>0);assert.ok(g.laneCells().every(p=>p.c===lane));
  assert.equal(g.move(dx),false);
  assert.equal(g.move(-dx,false),true);assert.equal(g.laneCells().length,0);
 }
});
test('spawning ignores lanes, so a crowded top still triggers the blocked-entry cutback',()=>{
 for(let id=0;id<SHAPES.length;id++){
  const g=new Game({target:20});g.board.forEach(row=>row.fill(1));
  for(let r=0;r<5;r++)g.board[r][0]=0;g.board[HEIGHT-3][2]=0;
  g.next=id;g.spawn();
  assert.equal(g.cuts,1,`shape ${id}`);assert.equal(g.pending,850);
 }
 // The same board does have lane positions, which a lane-aware spawn would have accepted.
 const g=new Game({target:20});g.board.forEach(row=>row.fill(1));for(let r=0;r<5;r++)g.board[r][0]=0;
 assert.ok(SHAPES.some((s,id)=>[-3,-2,-1].some(q=>g.fits({id,cells:s.cells,q,r:1}))));
});
test('rotation keeps the board-only result whenever one exists',()=>{
 let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<400;i++){
  const a=new Game({random:rnd}),b=new Game({lanes:false});
  for(let r=8;r<HEIGHT;r++)for(let c=0;c<WIDTH;c++)if(rnd()<.45)a.board[r][c]=b.board[r][c]=1;
  const piece={id:Math.floor(rnd()*SHAPES.length),cells:SHAPES[0].cells,q:Math.floor(rnd()*WIDTH)-3,r:3+Math.floor(rnd()*5)};
  piece.cells=SHAPES[piece.id].cells;a.piece={...piece};b.piece={...piece};
  if(!b.fits())continue;const dir=rnd()<.5?1:-1;
  if(b.rotate(dir)){assert.equal(a.rotate(dir),true);assert.deepEqual(a.piece,b.piece);}
 }
});
test('rotation falls back to a lane only when no board position exists, and never without lanes',()=>{
 const crowd=lanes=>{const g=new Game({lanes});for(let r=0;r<HEIGHT;r++)for(let c=2;c<WIDTH;c++)g.board[r][c]=1;return g;};
 const g=crowd(true);g.piece={id:0,cells:SHAPES[0].cells,q:-3,r:7};assert.equal(g.laneCells().length,0);
 assert.equal(g.rotate(-1),true);assert.deepEqual(g.cells().map(p=>[p.r,p.c]),[[7,-1],[7,0],[6,0],[6,1]]);assert.ok(g.fits());
 const off=crowd(false);off.piece={id:0,cells:SHAPES[0].cells,q:-4,r:9};
 assert.equal(off.rotate(-1),false);assert.ok(off.cells().every(p=>onBoard(p.c)));
});
// Search every state reachable from spawn with steer/rotate/descend; return the shapes that can rest covering (r,c).
function fillers(setup,target,lanes){
 const found=[],key=p=>JSON.stringify([p.q,p.r,p.cells]);
 for(let id=0;id<SHAPES.length;id++){
  const g=new Game({lanes});setup(g);g.next=id;g.spawn();
  const seen=new Set([key(g.piece)]),stack=[g.piece];
  search:while(stack.length){
   const p=stack.pop(),next=[];g.piece=p;
   if(!g.fits(g.lower(p))&&g.cells(p).some(({r,c})=>r===target.r&&c===target.c)){found.push(id);break search;}
   for(const dx of [-1,1])next.push({...p,q:p.q+dx});next.push(g.lower(p));
   for(const dir of [1,-1]){g.piece=p;if(g.rotate(dir))next.push(g.piece);}
   for(const n of next)if(g.fits(n)&&!seen.has(key(n))){seen.add(key(n));stack.push(n);}
  }
 }
 return found;
}
test('the last cell of a two-deep notch at the left wall is reachable only with lanes',()=>{
 const setup=g=>{g.board[HEIGHT-1].fill(1,1);g.board[HEIGHT-2].fill(1,1);};
 assert.deepEqual(fillers(setup,{r:HEIGHT-1,c:0},false),[]);
 assert.ok(fillers(setup,{r:HEIGHT-1,c:0},true).length>0);
});
test('changing beat swaps which diagonal each descent takes, and resets on the next piece',()=>{
 const g=new Game({lanes:false});g.piece={id:8,cells:[[0,0]],q:3,r:2};
 const col=()=>g.cells()[0].c,path=()=>{const cs=[];for(let i=0;i<4;i++){g.down();cs.push(col());}return cs;};
 const start=col(),normal=path();
 g.piece={id:8,cells:[[0,0]],q:3,r:2};assert.equal(g.flipBeat(),true);const flipped=path();
 // From an even row the default goes SE (same column on the odd row); the flipped beat goes SW (one column left).
 assert.deepEqual(normal,[start,start,start,start]);
 assert.deepEqual(flipped,[start-1,start,start-1,start]);
 g.drop();g.update(0);assert.ok(!g.piece.beat);
});
test('difficulty lets a row stay solid with up to `gaps` open cells',()=>{
 for(const gaps of [0,1,2]){
  const g=new Game({target:3,gaps});
  g.board[HEIGHT-1].fill(1);g.board[HEIGHT-1][0]=g.board[HEIGHT-1][5]=0;// two holes in floor 1
  g.board[HEIGHT-2].fill(2);g.board[HEIGHT-2][3]=0;// one hole in floor 2
  g.board[HEIGHT-3].fill(3);g.resolve([HEIGHT-3]);
  // Hard and Medium: floor 1 has too many holes, so sealing floor 3 cuts floors 2 and 3. Easy: all three stand and win.
  if(gaps<2){assert.equal(g.cuts,1);assert.equal(g.height,0);assert.equal(g.board[HEIGHT-1][1],1);assert.equal(g.board[HEIGHT-2][0],0);}
  else{assert.equal(g.cuts,0);assert.equal(g.height,3);assert.equal(g.status,'won');}
 }
 const m=new Game({gaps:1});m.board[HEIGHT-1].fill(1);m.board[HEIGHT-1][2]=0;m.board[HEIGHT-2].fill(2);m.board[HEIGHT-2][4]=0;m.resolve([HEIGHT-2]);
 assert.equal(m.cuts,0);assert.equal(m.height,2);
 const e=new Game({gaps:2});e.board[HEIGHT-1].fill(1,3);assert.equal(e.full(HEIGHT-1),false);// three holes is still a gap on Easy
});
test('each descent reports its diagonal, so a beat change shows up as a repeated direction',()=>{
 const g=new Game({lanes:false});g.piece={id:8,cells:[[0,0]],q:3,r:2};g.events=[];
 g.down();g.down();g.flipBeat();g.down();g.down();
 assert.deepEqual(g.events.filter(e=>e.type==='step').map(e=>e.dir),['se','sw','sw','se']);
});
test('locking a hex above the reach limit cuts back to the lowest unfinished floor',()=>{
 const g=new Game({lanes:false,reach:4});g.board[HEIGHT-1].fill(1);g.measure();// floor 1 solid; limit row is floor 5
 assert.equal(g.limitRow(),HEIGHT-5);
 g.board[HEIGHT-2][0]=2;g.board[HEIGHT-3][0]=2;
 // A vertical patch stacked to floor 5 is fine; one reaching floor 6 is over.
 const at=top=>({id:9,cells:[[0,0]],q:0-Math.floor(top/2),r:top});
 assert.equal(g.overReach(at(HEIGHT-5)),false);assert.equal(g.overReach(at(HEIGHT-6)),true);
 g.piece=at(HEIGHT-6);g.lock();
 assert.equal(g.cuts,1);assert.equal(g.events.find(e=>e.type==='cut').reason,'reach');
 assert.equal(g.board[HEIGHT-6][0],0);assert.equal(g.board[HEIGHT-3][0],0);assert.equal(g.board[HEIGHT-2][0],2);assert.equal(g.height,1);
});
test('a drop that finishes a floor gets the raised limit',()=>{
 const g=new Game({lanes:false,reach:1});g.board[HEIGHT-1].fill(1);g.board[HEIGHT-1][7]=0;g.measure();// limit is the unfinished floor 1 itself
 // A two-hex vertical piece filling floor 1's last hole reaches floor 2, allowed only because floor 1 completes.
 const p={id:9,cells:[[0,0],[0,1]],q:7-Math.floor((HEIGHT-2)/2),r:HEIGHT-2};
 assert.deepEqual(g.cells(p).map(({r,c})=>[r,c]),[[HEIGHT-2,7],[HEIGHT-1,7]]);
 assert.equal(g.overReach(p),false);g.piece=p;g.lock();assert.equal(g.cuts,0);assert.equal(g.height,1);
});
test('the clock length comes from the game, not a fixed five minutes',()=>{
 const g=new Game({duration:8*60000});g.update(DURATION+1000);assert.equal(g.status,'playing');
 g.update(3*60000);assert.equal(g.status,'lost');
});
