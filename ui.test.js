import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DIFFICULTIES,difficulty,fitScale,layoutBox,hit,menuKey,SETTING_ROWS,settingLabel,changeSetting,clock} from './ui.js';
import {DEFAULTS} from './settings.js';

test('difficulty table matches the game rules',()=>{
 assert.deepEqual(DIFFICULTIES.map(d=>d.label),['EASY','MEDIUM','HARD']);
 assert.deepEqual(difficulty(2),{gaps:2,reach:6,duration:600000});
 assert.deepEqual(difficulty(1),{gaps:1,reach:5,duration:540000});
 assert.deepEqual(difficulty(0),{gaps:0,reach:4,duration:480000});
});
test('scale is a whole number of at least 1 for any window',()=>{
 assert.equal(fitScale(1920,1080),4);
 assert.equal(fitScale(1919,1080),3);
 assert.equal(fitScale(100,50),1);
 assert.equal(fitScale(0,0),1);
 assert.equal(fitScale(5000,300),1);
});
test('box rows stack inside the box without overlapping, and hit finds them',()=>{
 const b=layoutBox(['EASY','MEDIUM','HARD','SETTINGS'],{y:96,minWidth:120});
 assert.equal(b.rows.length,4);
 assert.ok(b.x>=0&&b.x+b.w<=480&&b.y+b.h<=270);
 for(let i=0;i<4;i++){const r=b.rows[i];
  assert.ok(r.x>=b.x&&r.x+r.w<=b.x+b.w&&r.y>=b.y&&r.y+r.h<=b.y+b.h);
  if(i)assert.ok(r.y>=b.rows[i-1].y+b.rows[i-1].h);
  assert.equal(hit(b.rows,r.x+1,r.y+1),i);
 }
 assert.equal(hit(b.rows,b.x-5,b.y-5),-1);
 assert.equal(Math.round(b.x+b.w/2),240);
});
test('menu keys wrap around and a held key never selects',()=>{
 assert.deepEqual(menuKey(4,0,'ArrowUp',false),{cursor:3});
 assert.deepEqual(menuKey(4,3,'ArrowDown',false),{cursor:0});
 assert.deepEqual(menuKey(4,2,'Enter',false),{cursor:2,select:2});
 assert.deepEqual(menuKey(4,2,' ',false),{cursor:2,select:2});
 assert.deepEqual(menuKey(4,2,'Enter',true),{cursor:2});
 assert.deepEqual(menuKey(4,2,'q',false),{cursor:2});
});
test('settings rows cycle targets, toggle switches, and clamp scanlines',()=>{
 let s={...DEFAULTS};
 assert.deepEqual(SETTING_ROWS,['target','lanes','sound','scanlines','back']);
 s=changeSetting(s,'target',1);assert.equal(s.target,12);
 s=changeSetting(s,'target',1);s=changeSetting(s,'target',1);assert.equal(s.target,8);
 s=changeSetting(s,'target',-1);assert.equal(s.target,16);
 assert.equal(changeSetting(s,'lanes',1).lanes,false);
 assert.equal(changeSetting(s,'sound',-1).sound,true);
 let t={...DEFAULTS,scanlines:0.9};
 t=changeSetting(t,'scanlines',1);t=changeSetting(t,'scanlines',1);assert.equal(t.scanlines,1);
 let u={...DEFAULTS,scanlines:0.1};
 u=changeSetting(u,'scanlines',-1);u=changeSetting(u,'scanlines',-1);assert.equal(u.scanlines,0);
 assert.equal(settingLabel('scanlines',u),'SCANLINES OFF');
 assert.equal(settingLabel('scanlines',{...DEFAULTS,scanlines:0.3}),'SCANLINES 0.3');
 assert.equal(settingLabel('target',s),'TARGET 16');
 assert.equal(settingLabel('lanes',{...DEFAULTS,lanes:false}),'EDGE LANES OFF');
 assert.equal(settingLabel('back',s),'BACK');
 assert.deepEqual(changeSetting(s,'back',1),s);
});
test('clock formats remaining time and never goes negative',()=>{
 assert.equal(clock(540000),'09:00');
 assert.equal(clock(59001),'01:00');
 assert.equal(clock(0),'00:00');
 assert.equal(clock(-5000),'00:00');
});
