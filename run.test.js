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

test('each level cleared takes a minute off the clock, never below 1:00',()=>{
 let run=createRun('medium');const clocks=[];
 for(let i=0;i<6;i++){clocks.push(levelOptions(run,true).duration);run=onLevelWon(run);}
 assert.deepEqual(clocks,[300000,240000,180000,120000,60000,60000]);
 let easy=createRun('easy');for(let i=0;i<3;i++)easy=onLevelWon(easy);
 assert.equal(levelOptions(easy,true).duration,60000);
 let hard=createRun('hard');hard=onLevelWon(hard);
 assert.equal(levelOptions(hard,true).duration,300000);
});
