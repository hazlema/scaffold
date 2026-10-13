// A run: consecutive levels on one difficulty. Each level is a fresh engine Game; this module is pure.
export const DIFFICULTY={
 easy:{key:'easy',label:'EASY',letter:'E',gaps:2,reach:6,target:8,duration:180000,weight:1},
 medium:{key:'medium',label:'MEDIUM',letter:'M',gaps:1,reach:5,target:12,duration:300000,weight:2},
 hard:{key:'hard',label:'HARD',letter:'H',gaps:0,reach:4,target:12,duration:360000,weight:3},
};
export const DIFFICULTY_ORDER=['easy','medium','hard'];
export const BASE_DROP_MS=950;
// base + base*0.1*level as a speed, so each cleared level shortens the step interval.
export const dropMsFor=cleared=>BASE_DROP_MS/(1+0.1*cleared);
export const createRun=key=>({diff:DIFFICULTY[key],level:1,cleared:0,banked:0});
export const levelOptions=(run,lanes)=>{const d=run.diff;return {target:d.target,gaps:d.gaps,reach:d.reach,duration:d.duration,dropMs:dropMsFor(run.cleared),lanes};};
export const onLevelWon=run=>({...run,level:run.level+1,cleared:run.cleared+1,banked:run.banked+run.diff.target});
// Floors on the current level count up to the target, so the score never jumps at the handover.
export const runFloors=(run,game)=>run.banked+(game?Math.min(game.height,run.diff.target):0);
export const runScore=(run,game)=>runFloors(run,game)*run.diff.weight;
export const isRunOver=game=>game.status==='lost'||(game.jammed&&!game.pending);
