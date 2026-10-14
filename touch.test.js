import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTouch} from './touch.js';

test('a tap on a steer button moves once; holding repeats after 170 ms, then every 50 ms',()=>{
 const t=createTouch();
 assert.deepEqual(t.down(1,'left',1000),['left']);
 assert.deepEqual(t.tick(1169),[]);
 assert.deepEqual(t.tick(1170),['left-repeat']);
 assert.deepEqual(t.tick(1219),[]);
 assert.deepEqual(t.tick(1270),['left-repeat','left-repeat']);
 assert.deepEqual(t.up(1,1280),[]);
 assert.deepEqual(t.tick(2000),[]);
});
test('down soft-drops while any finger holds it; lifting the last finger stops it',()=>{
 const t=createTouch();
 assert.deepEqual(t.down(1,'down',0),['soft-on']);
 assert.deepEqual(t.down(2,'down',1000),['soft-on']);
 assert.deepEqual(t.up(1,1100),[]);
 assert.ok(t.isPressed('down'));
 assert.deepEqual(t.up(2,1200),['soft-off']);
 assert.equal(t.isPressed('down'),false);
});
test('a double tap on down hard-drops once; a third quick tap or slower taps do not',()=>{
 const t=createTouch();
 t.down(1,'down',0);t.up(1,60);
 assert.deepEqual(t.down(2,'down',200),['soft-on','drop']);t.up(2,240);
 assert.deepEqual(t.down(3,'down',300),['soft-on']);t.up(3,330);
 assert.deepEqual(t.down(4,'down',900),['soft-on']);
});
test('rotate and beat act once per press; the readout strip is pause',()=>{
 const t=createTouch();
 assert.deepEqual(t.down(1,'rotate',0),['cw']);
 assert.deepEqual(t.tick(5000),[]);
 assert.deepEqual(t.down(2,'beat',0),['beat']);
 assert.deepEqual(t.down(3,'pause',0),['pause']);
 assert.equal(t.isPressed('rotate'),true);
 t.up(1,10);assert.equal(t.isPressed('rotate'),false);
});
test('two thumbs work together; lifting one keeps the other; clear releases everything',()=>{
 const t=createTouch();
 t.down(1,'left',0);
 assert.deepEqual(t.down(2,'down',10),['soft-on']);
 assert.deepEqual(t.tick(170),['left-repeat']);
 assert.deepEqual(t.up(2,200),['soft-off']);
 assert.ok(t.isPressed('left'));
 t.down(3,'down',300);
 assert.deepEqual(t.clear(),['soft-off']);
 assert.equal(t.isPressed('left'),false);
 assert.deepEqual(t.tick(9999),[]);
 assert.deepEqual(t.up(99,0),[]);// a finger we never saw is ignored
});
test('a steer button held through a long gap does not fire the missed repeats all at once',()=>{
 const t=createTouch();t.down(1,'left',0);
 assert.deepEqual(t.tick(170),['left-repeat']);
 assert.deepEqual(t.tick(1700),[]);// e.g. across the LEVEL CLEAR banner: resume, no burst
 assert.deepEqual(t.tick(1749),[]);
 assert.deepEqual(t.tick(1750),['left-repeat']);
 assert.deepEqual(t.tick(1850),['left-repeat','left-repeat']);// ordinary frame jitter still catches up
});
