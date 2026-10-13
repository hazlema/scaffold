import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KEY,DEFAULTS,clean,loadSettings,saveSettings} from './settings.js';

const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};

test('empty or missing storage gives the defaults',()=>{
 assert.deepEqual(loadSettings(memory()),DEFAULTS);
 assert.deepEqual(loadSettings(null),DEFAULTS);
 assert.deepEqual(loadSettings(undefined),DEFAULTS);
});
test('corrupt JSON and storage that throws give the defaults without crashing',()=>{
 const s=memory();s.setItem(KEY,'{not json');
 assert.deepEqual(loadSettings(s),DEFAULTS);
 const hostile={getItem(){throw new Error('SecurityError');},setItem(){throw new Error('QuotaExceeded');}};
 assert.deepEqual(loadSettings(hostile),DEFAULTS);
 assert.equal(saveSettings(hostile,DEFAULTS),false);
});
test('invalid fields fall back one by one; valid ones survive',()=>{
 assert.deepEqual(clean({target:12,lanes:'yes',sound:true,scanlines:NaN}),{...DEFAULTS,sound:true});
 assert.equal('target' in clean({target:12}),false);// target now comes from the difficulty
 assert.deepEqual(clean({target:9,scanlines:1.5}),DEFAULTS);
 assert.equal(clean({scanlines:0.30000000000000004}).scanlines,0.3);
 assert.equal(clean({scanlines:0}).scanlines,0);
 assert.deepEqual(clean([]),DEFAULTS);
});
test('settings round-trip through storage',()=>{
 const s=memory(),v={lanes:false,sound:true,scanlines:0.2};
 assert.equal(saveSettings(s,v),true);
 assert.deepEqual(loadSettings(s),v);
});
