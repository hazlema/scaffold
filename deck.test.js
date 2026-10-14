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
