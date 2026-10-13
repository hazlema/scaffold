import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitScale,layoutBox,hit,menuKey,SETTING_ROWS,settingLabel,changeSetting,clock,startInitials,initialsKey,INITIAL_CHARS} from './ui.js';
import {DEFAULTS} from './settings.js';

test('scale is a whole number of at least 1 for any window',()=>{
 assert.equal(fitScale(1920,1080),4);
 assert.equal(fitScale(1919,1080),3);
 assert.equal(fitScale(100,50),1);
 assert.equal(fitScale(0,0),1);
 assert.equal(fitScale(5000,300),1);
});
test('box rows stack inside the box without overlapping, and hit finds them',()=>{
 const b=layoutBox(['EASY','MEDIUM','HARD','SETTINGS'],{y:96,minWidth:120});
 assert.equal(b.scale,2);
 const small=layoutBox(['AGAIN','MENU'],{y:220,scale:1,minWidth:120});
 assert.equal(small.scale,1);assert.equal(small.rows[0].h,13);
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
test('settings rows toggle switches and clamp scanlines',()=>{
 let s={...DEFAULTS};
 assert.deepEqual(SETTING_ROWS,['lanes','sound','scanlines','back']);
 assert.equal(changeSetting(s,'lanes',1).lanes,false);
 assert.equal(changeSetting(s,'sound',-1).sound,true);
 let t={...DEFAULTS,scanlines:0.9};
 t=changeSetting(t,'scanlines',1);t=changeSetting(t,'scanlines',1);assert.equal(t.scanlines,1);
 let u={...DEFAULTS,scanlines:0.1};
 u=changeSetting(u,'scanlines',-1);u=changeSetting(u,'scanlines',-1);assert.equal(u.scanlines,0);
 assert.equal(settingLabel('scanlines',u),'SCANLINES OFF');
 assert.equal(settingLabel('scanlines',{...DEFAULTS,scanlines:0.3}),'SCANLINES 0.3');
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
    test('results stay locked briefly; the pause box never locks',async()=>{
     const {canSelect}=await import('./ui.js');
     assert.equal(canSelect(false,1000,1500),false);
     assert.equal(canSelect(false,1000,1601),true);
     assert.equal(canSelect(true,1000,1001),true);
    });
    
test('the scale is whole device pixels at fractional display scaling',async()=>{
 const {fitScale}=await import('./ui.js');
 assert.equal(fitScale(1536,864,1.25),4);// 125% laptop: 4 device px per game pixel
 assert.equal(fitScale(1280,720,1.25),3);
 assert.equal(fitScale(300,200,0.5),1);
});

test('initials start from the last used, else AAA, and cycle letters, digits and space both ways',()=>{
 assert.deepEqual(startInitials('MBH'),{chars:['M','B','H'],slot:0,armed:false});
 assert.deepEqual(startInitials('bad'),{chars:['A','A','A'],slot:0,armed:false});
 assert.deepEqual(startInitials(undefined),{chars:['A','A','A'],slot:0,armed:false});
 assert.equal(INITIAL_CHARS,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ');
 const at=(chars,slot=0)=>({chars:[...chars],slot,armed:true});
 assert.deepEqual(initialsKey(at('AAA'),'ArrowUp',false).state.chars,['B','A','A']);
 assert.deepEqual(initialsKey(at('AAA'),'ArrowDown',false).state.chars,[' ','A','A']);
 assert.deepEqual(initialsKey(at('ZAA'),'ArrowUp',false).state.chars,['0','A','A']);
 assert.deepEqual(initialsKey(at('9AA'),'ArrowUp',false).state.chars,[' ','A','A']);
 assert.deepEqual(initialsKey(at(' AA'),'ArrowUp',false).state.chars,['A','A','A']);
 assert.deepEqual(initialsKey(at('AAA',1),'ArrowUp',true).state.chars,['A','B','A']);// held arrows keep spinning
});
test('initials: slots move with arrows and Enter, the third Enter saves, held keys never save',()=>{
 const s=startInitials('MBH');
 let r=initialsKey(s,'Enter',false);assert.equal(r.state.slot,1);assert.equal(r.done,false);
 r=initialsKey(r.state,'ArrowRight',false);assert.equal(r.state.slot,2);
 assert.equal(initialsKey(r.state,'ArrowRight',false).state.slot,2);// no slot past the third
 assert.equal(initialsKey(r.state,'Enter',true).done,false);// a held Enter never saves
 assert.equal(initialsKey(r.state,'ArrowRight',true).state.slot,2);
 assert.equal(initialsKey(r.state,'ArrowLeft',false).state.slot,1);
 assert.equal(initialsKey(s,'ArrowLeft',false).state.slot,0);
 assert.equal(initialsKey(r.state,' ',false).done,false);// Space is the drop key: never confirms
 r=initialsKey(r.state,'Enter',false);assert.equal(r.done,true);
 assert.deepEqual(r.state.chars,['M','B','H']);
});

test('keys still held from play cannot touch the initials until one fresh press',()=>{
 let s=startInitials('MBH');
 for(const k of ['ArrowDown','ArrowUp','ArrowLeft','Enter']){const r=initialsKey(s,k,true);assert.deepEqual(r.state.chars,['M','B','H']);assert.equal(r.state.slot,0);assert.equal(r.done,false);}
 let r=initialsKey(s,'ArrowUp',false);// the first fresh press counts and arms entry
 assert.deepEqual(r.state.chars,['N','B','H']);assert.equal(r.state.armed,true);
 r=initialsKey(r.state,'ArrowUp',true);// now a held arrow spins as usual
 assert.deepEqual(r.state.chars,['O','B','H']);
});
