import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,SHAPES,rotateCells,WIDTH,HEIGHT,DURATION} from './engine.js';
test('piece set contains three trihexes and seven tetrahexes, each restored by six turns',()=>{assert.equal(SHAPES.filter(s=>s.cells.length===3).length,3);assert.equal(SHAPES.filter(s=>s.cells.length===4).length,7);for(const s of SHAPES){let cells=s.cells;for(let i=0;i<6;i++)cells=rotateCells(cells);assert.deepEqual(cells,s.cells);}});
test('placing above a gap alone does not cut the tower',()=>{const g=new Game();g.board[HEIGHT-2][3]=1;g.resolve([]);assert.equal(g.board[HEIGHT-2][3],1);assert.equal(g.cuts,0);});
test('completing an upper row deletes everything above lowest gap and preserves that row',()=>{const g=new Game();g.board[HEIGHT-1].fill(1);g.board[HEIGHT-2][0]=2;g.board[HEIGHT-3].fill(3);g.board[HEIGHT-5][2]=4;g.resolve([HEIGHT-3]);assert.equal(g.cuts,1);assert.equal(g.board[HEIGHT-2][0],2);assert.ok(g.board[HEIGHT-1].every(v=>v===1));assert.ok(g.board.slice(0,HEIGHT-2).flat().every(v=>v===0));assert.equal(g.height,1);});
test('completed floors remain and reaching target wins',()=>{const g=new Game({target:2});g.board[HEIGHT-1].fill(1);g.board[HEIGHT-2].fill(2);g.resolve([HEIGHT-2]);assert.equal(g.cuts,0);assert.equal(g.status,'won');assert.equal(g.height,2);});
test('fixed blockers survive cuts and count toward floor completion',()=>{const g=new Game();g.blockers[HEIGHT-4][2]=true;g.blockers[HEIGHT-1][0]=true;g.board[HEIGHT-1].fill(1,1);g.board[HEIGHT-3].fill(1);g.resolve([HEIGHT-3]);assert.equal(g.height,1);assert.equal(g.blockers[HEIGHT-4][2],true);});
test('gravity and rotations cannot overlap walls or settled cells',()=>{const g=new Game({random:()=>0});for(let i=0;i<20;i++)g.move(-1);assert.ok(g.fits());g.drop();assert.equal(g.placed,1);assert.equal(g.board.flat().filter(Boolean).length,4);assert.ok(g.fits());});
test('pause freezes simulation and running out of time loses',()=>{const g=new Game();g.paused=true;g.update(1000);assert.equal(g.elapsed,0);g.paused=false;g.elapsed=DURATION-10;g.update(20);assert.equal(g.status,'lost');});

test('hard-drop completion triggers the cutback through the real placement loop',()=>{const g=new Game();g.board[HEIGHT-1].fill(1);g.board[HEIGHT-2].fill(2);g.board[HEIGHT-2][1]=0;g.board[HEIGHT-3].fill(3,0,5);g.piece={id:7,cells:[[-1,0],[0,0],[1,0]],q:5,r:2};g.drop();assert.equal(g.cuts,1);assert.equal(g.height,1);assert.equal(g.board[HEIGHT-2][1],0);assert.ok(g.board[HEIGHT-3].every(v=>v===0));assert.equal(g.pending,850);const elapsed=g.elapsed;g.update(900);assert.equal(g.pending,0);assert.equal(g.elapsed,elapsed+900);assert.ok(g.fits());});

test('every shape and rotation descends at either side wall on an empty board',()=>{
 for(let id=0;id<SHAPES.length;id++){
  let cells=SHAPES[id].cells;
  for(let turn=0;turn<6;turn++,cells=rotateCells(cells))for(const r of [3,4])for(let q=-5;q<WIDTH;q++){
   const g=new Game();g.piece={id,cells,q,r};if(!g.fits())continue;
   assert.equal(g.down(),true,`shape ${id}, turn ${turn}, q ${q}, r ${r}`);
   assert.ok(g.fits());
   const landing=g.landing();assert.equal(Math.max(...g.cells(landing).map(p=>p.r)),HEIGHT-1);
   g.drop();assert.equal(g.placed,1);assert.ok(g.board[HEIGHT-1].some(Boolean));
  }
 }
});
test('side-wall contact does not start the lock timer while descent is available',()=>{
 const g=new Game();g.piece={id:0,cells:SHAPES[0].cells,q:-1,r:3};
 for(let i=0;i<6;i++)g.update(100);
 assert.equal(g.placed,0);assert.equal(g.grounded,0);
 for(let i=0;i<4;i++)g.update(100);
 assert.equal(g.piece.r,4);assert.ok(g.fits());
});
test('the alternative direction cannot pass through a blocker',()=>{
 const g=new Game();g.piece={id:0,cells:SHAPES[0].cells,q:-1,r:3};
 g.blockers[4][2]=true;assert.equal(g.down(),false);
});
test('stack contact inside the board does not automatically slide sideways',()=>{
 const g=new Game();g.piece={id:0,cells:SHAPES[0].cells,q:2,r:3};
 g.board[4][3]=1;assert.ok(g.fits());assert.equal(g.down(),false);
});

test('blocked entry cuts above the lowest gap and retries the same delivery',()=>{
 const g=new Game({target:20,random:()=>0});g.board.forEach(row=>row.fill(1));
 g.board[HEIGHT-3][2]=0;g.blockers[HEIGHT-5][4]=true;g.board[HEIGHT-5][4]=0;
 const delivery=g.next;g.spawn();const preview=g.next;
 assert.equal(g.cuts,1);assert.equal(g.pending,850);assert.equal(g.board[HEIGHT-3][2],0);
 assert.equal(g.board[HEIGHT-3][3],1);assert.equal(g.blockers[HEIGHT-5][4],true);
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
