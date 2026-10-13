import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GLYPHS,glyph,measure,drawText,wrap} from './font.js';

const CHARSET="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /:.,-'!?▶◀";

test('every glyph is 7 rows of 5 pixels and the full charset exists',()=>{
 for(const ch of CHARSET)assert.ok(GLYPHS[ch],`missing ${ch}`);
 for(const [ch,rows] of Object.entries(GLYPHS)){
  assert.equal(rows.length,7,ch);
  for(const r of rows)assert.match(r,/^[#.]{5}$/,ch);
 }
});
test('lowercase draws as capitals and unknown characters draw as ?',()=>{
 assert.deepEqual(glyph('a'),GLYPHS.A);
 assert.deepEqual(glyph('—'),GLYPHS['?']);
});
test('measure and drawText agree and draw one rect per lit pixel',()=>{
 assert.equal(measure(''),0);
 assert.equal(measure('AB'),11);
 assert.equal(measure('AB',2),22);
 const rects=[];const ctx={set fillStyle(v){this.c=v;},fillRect:(x,y,w,h)=>rects.push([x,y,w,h])};
 const w=drawText(ctx,'I',10,20,'#fff',2,'center');
 assert.equal(w,measure('I',2));
 assert.equal(rects.length,GLYPHS.I.join('').split('#').length-1);
 assert.ok(rects.every(([x,y,rw,rh])=>rw===2&&rh===2&&x>=10-w/2-1&&y>=20));
});
test('wrap keeps lines within the width and line count, marking truncation',()=>{
 const msg='CUTBACK: 12 HEXES REMOVED. FLOOR 3 STAYS UNFINISHED.';
 const lines=wrap(msg,22,3);
 assert.ok(lines.length<=3);
 for(const l of lines)assert.ok(l.length<=22,l);
 assert.equal(lines.join(' '),msg);
 const cut=wrap('ONE TWO THREE FOUR FIVE SIX SEVEN',9,2);
 assert.equal(cut.length,2);
 assert.ok(cut[1].endsWith('..'));
 for(const l of cut)assert.ok(l.length<=9,l);
 assert.deepEqual(wrap('ABCDEFGHIJKL',5,3),['ABCDE','FGHIJ','KL']);
 assert.deepEqual(wrap('',5),[]);
});
