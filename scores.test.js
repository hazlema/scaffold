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
