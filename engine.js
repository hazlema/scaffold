export const WIDTH=8,HEIGHT=20,DURATION=300000,LANE=1;
export const onBoard=c=>c>=0&&c<WIDTH;
export const rotateCells=cells=>cells.map(([q,r])=>[-r||0,(q+r)||0]);
const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
function normalize(cells){const q=Math.min(...cells.map(p=>p[0])),r=Math.min(...cells.map(p=>p[1]));return cells.map(([x,y])=>[x-q,y-r]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);}
function canonical(cells){const keys=[];for(let flip=0;flip<2;flip++){let c=cells.map(([q,r])=>flip?[r,q]:[q,r]);for(let k=0;k<6;k++){keys.push(JSON.stringify(normalize(c)));c=rotateCells(c);}}return keys.sort()[0];}
function enumerate(n){let shapes=[[[0,0]]];for(let size=1;size<n;size++){const next=new Map();for(const cells of shapes)for(const [q,r]of cells)for(const [dq,dr]of dirs){const p=[q+dq,r+dr];if(cells.some(c=>c[0]===p[0]&&c[1]===p[1]))continue;const key=canonical([...cells,p]);next.set(key,JSON.parse(key));}shapes=[...next.values()];}return shapes;}
function makeShapes(n){return enumerate(n).map((cells,i)=>{const pivot=cells.reduce((best,p)=>{const cost=a=>cells.reduce((v,b)=>v+Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[0]+a[1]-b[0]-b[1]),0);return cost(p)<cost(best)?p:best;},cells[0]);return {name:n===3?`Patch ${i+1}`:`Cluster ${i+1}`,cells:cells.map(([q,r])=>[q-pivot[0],r-pivot[1]])};});}
export const SHAPES=[...makeShapes(4),...makeShapes(3)];
export class Game{
 constructor({target=8,lanes=true,gaps=0,reach=Infinity,duration=DURATION,random=Math.random}={}){this.duration=duration;this.target=target;this.lanes=lanes;this.gaps=gaps;this.reach=reach;this.offcuts=0;this.random=random;this.board=Array.from({length:HEIGHT},()=>Array(WIDTH).fill(0));this.elapsed=0;this.height=0;this.cuts=0;this.placed=0;this.lostCells=0;this.status='playing';this.paused=false;this.events=[];this.bag=[];this.pending=0;this.next=this.draw();this.spawn();}
 draw(){if(!this.bag.length){this.bag=[0,1,2,3,4,5,6,0,1,2,3,4,5,6,7,8,9];for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}return this.bag.pop();}
 cells(p=this.piece){return p.cells.map(([dq,dr])=>{const r=p.r+dr;return {r,c:p.q+dq+Math.floor(r/2)};});}
 // Edge lanes: one invisible column beside each wall. Lane cells never collide and are cut off on lock,
 // but every position keeps at least one cell on the board and the whole piece above the floor.
 inside(p,lanes=this.lanes){const edge=lanes?LANE:0,cells=this.cells(p);return cells.every(({c})=>c>=-edge&&c<WIDTH+edge)&&cells.some(({c})=>onBoard(c));}
 fits(p=this.piece,lanes=this.lanes){return !!p&&this.inside(p,lanes)&&this.cells(p).every(({c,r})=>r>=0&&r<HEIGHT&&(!onBoard(c)||!this.board[r][c]));}
 laneCells(p=this.piece){return this.cells(p).filter(({c})=>!onBoard(c));}
 spawn(retry=null){const id=retry??this.next;if(retry===null)this.next=this.draw();const cells=SHAPES[id].cells.map(p=>[...p]),r=1-Math.min(...cells.map(p=>p[1]));this.piece={cells,r,q:3-Math.floor(r/2),id};this.gravity=0;this.grounded=0;this.age=0;this.jammed=false;for(const dx of [0,-1,1,-2,2,-3,3]){if(this.fits({...this.piece,q:this.piece.q+dx},false)){this.piece.q+=dx;return;}}this.jammed=true;this.resolveBlocked();}
 active(){return this.status==='playing'&&!this.paused&&!this.pending&&!this.jammed;}
 // enterLane=false (a held key) stops at the visible wall instead of pushing more cells into a lane.
 move(dx,enterLane=true){if(!this.active())return false;const p={...this.piece,q:this.piece.q+dx};if(!this.fits(p)||!enterLane&&this.laneCells(p).length>this.laneCells().length)return false;this.piece=p;return true;}
 lower(p=this.piece){
  // The beat picks which diagonal each step takes (default SE from even rows, SW from odd); flipping it swaps the zigzag.
  const step=beat=>({...p,q:p.q-(p.r%2?1-beat:beat),r:p.r+1}),beat=p.beat?1:0;
  const preferred=step(beat);
  // Row staggering can send a rotated cluster through a side wall (the outer lane edge when lanes are on).
  // Use the other downward neighbor only for that boundary case;
  // occupied cells and the floor still stop descent normally.
  if(!this.inside(preferred)){
   const alternate=step(1-beat);
   if(this.inside(alternate))return alternate;
  }
  return preferred;
 }
 flipBeat(){if(!this.active())return false;this.piece={...this.piece,beat:!this.piece.beat};return true;}
 // Odd rows sit half a hex right, so a step keeping the pivot column goes SE from even rows and SW from odd rows.
 stepDir(p=this.piece){const n=this.lower(p),dc=n.q+Math.floor(n.r/2)-p.q-Math.floor(p.r/2);return (p.r%2?dc===1:dc===0)?'se':'sw';}
 down(){if(!this.active())return false;const p=this.lower(),dir=this.stepDir();if(!this.fits(p))return false;this.piece=p;this.grounded=0;this.events.push({type:'step',dir});return true;}
 rotate(direction=1){if(!this.active())return false;let cells=this.piece.cells;for(let i=0;i<(direction===1?1:5);i++)cells=rotateCells(cells);for(const lanes of this.lanes?[false,true]:[false])for(const dq of [0,-1,1,-2,2]){const p={...this.piece,cells,q:this.piece.q+dq};if(this.fits(p,lanes)){this.piece=p;return true;}}return false;}
 landing(){let p=this.piece;while(this.fits(this.lower(p)))p=this.lower(p);return p;}
 drop(){if(!this.active())return;this.piece=this.landing();this.lock();}
 // Difficulty: a row counts as solid (a floor, a cutback trigger, never a gap) once it has at most this.gaps open cells.
 full(r){return this.board[r].filter(v=>!v).length<=this.gaps;}
 lowestGap(highest){for(let r=HEIGHT-1;r>highest;r--)if(!this.full(r))return r;return -1;}
 cutAbove(gap,reason='row'){
  const removed=[];
  for(let r=0;r<gap;r++)for(let c=0;c<WIDTH;c++)if(this.board[r][c]){removed.push({r,c,id:this.board[r][c]-1});this.board[r][c]=0;}
  if(removed.length){this.cuts++;this.lostCells+=removed.length;this.events.push({type:'cut',gap,removed,reason});this.pending=850;}
 }
 // Reach: hexes may sit at most this.reach rows above the top solid floor (the unfinished floor is row 1).
 limitRow(height=this.height){return HEIGHT-height-this.reach;}
 // Would locking p leave a hex above the reach limit? Counts floors that p itself would complete.
 overReach(p=this.piece){
  const cells=this.cells(p).filter(({c})=>onBoard(c)),saved=cells.map(({r,c})=>this.board[r][c]);
  for(const {r,c}of cells)this.board[r][c]=p.id+1;
  let height=0;for(let r=HEIGHT-1;r>=0&&this.full(r);r--)height++;
  cells.forEach(({r,c},i)=>this.board[r][c]=saved[i]);
  return cells.some(({r})=>r<this.limitRow(height));
 }
 measure(){this.height=0;for(let r=HEIGHT-1;r>=0&&this.full(r);r--)this.height++;}
 win(){if(this.elapsed>=this.duration){this.status='lost';return;}this.status='won';this.events.push({type:'won'});}
 resolve(completed){const gap=this.lowestGap(completed.length?Math.min(...completed):HEIGHT);if(gap!==-1)this.cutAbove(gap);this.measure();if(this.height>=this.target)this.win();}
 resolveBlocked(){
  if(this.elapsed>=this.duration){this.status='lost';return;}
  // Empty headroom is not a gap in the tower. Include its highest occupied row.
  const highest=this.board.findIndex((row,r)=>row.some(v=>v));
  const gap=this.lowestGap(highest-1);
  this.measure();
  if(gap===-1){this.win();return;}
  this.cutAbove(gap,'blocked');
  this.measure();
  if(this.pending)this.retryId=this.piece.id;
  else this.events.push({type:'jam'});
 }
 lock(){const cells=this.cells().filter(({c})=>onBoard(c)),offcuts=this.laneCells().map(p=>({...p,id:this.piece.id}));const rows=new Set(cells.map(p=>p.r)),before=new Set([...rows].filter(r=>this.full(r)));for(const {c,r}of cells)this.board[r][c]=this.piece.id+1;this.placed++;this.offcuts+=offcuts.length;this.resolve([...rows].filter(r=>!before.has(r)&&this.full(r)));if(this.status==='playing'&&!this.pending&&cells.some(({r})=>r<this.limitRow())){this.cutAbove(this.lowestGap(-1),'reach');this.measure();}this.events.push({type:'lock',offcuts});if(this.status==='playing'&&!this.pending)this.spawn();}
 update(ms,soft=false){if(this.status!=='playing'||this.paused)return;this.elapsed=Math.min(this.duration,this.elapsed+ms);if(this.elapsed>=this.duration){this.status='lost';return;}if(this.pending){this.pending=Math.max(0,this.pending-ms);if(!this.pending){const retry=this.retryId??null;this.retryId=null;this.spawn(retry);}return;}if(this.jammed)return;this.age+=ms;this.gravity+=ms;const speed=soft?55:950;while(this.gravity>=speed){this.gravity-=speed;if(!this.down())break;}if(!this.fits(this.lower())){this.grounded+=ms;if(this.grounded>=550)this.lock();}}
}
