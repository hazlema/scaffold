import {test} from 'node:test';
import assert from 'node:assert/strict';
import {C,PALETTE,PIECES,BEVEL,LIGHT_PIECES} from './palette.js';
import {SHAPES} from './engine.js';

test('the palette is exactly the 16 locked colors',()=>{
 assert.deepEqual(PALETTE,['#030203','#121871','#14199a','#32209d','#714ec0','#9316bc','#a359e5','#e525ac','#fa5094','#fc71b2','#fd9e4b','#fee69c','#f3e6ac','#ffffff','#3fbf6a','#3ec8f0']);
 assert.equal(new Set(PALETTE).size,16);
});
test('every piece has its own color that never matches the board or frame colors',()=>{
 assert.equal(PIECES.length,SHAPES.length);
 assert.equal(new Set(PIECES).size,PIECES.length);
 for(const p of PIECES){assert.ok(PALETTE.includes(p));assert.ok(![C.black,C.navy,C.royal].includes(p),p);}
});
test('every piece color has a palette bevel pair',()=>{
 for(const p of PIECES){const pair=BEVEL[p];assert.ok(pair,p);for(const c of pair)assert.ok(PALETTE.includes(c));}
 for(const p of LIGHT_PIECES)assert.ok(PIECES.includes(p));
});
