export const WIDTH=8,HEIGHT=20,DURATION=300000;
export const rotateCells=cells=>cells.map(([q,r])=>[-r||0,(q+r)||0]);
const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
function normalize(cells){const q=Math.min(...cells.map(p=>p[0])),r=Math.min(...cells.map(p=>p[1]));return cells.map(([x,y])=>[x-q,y-r]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);}
function canonical(cells){const keys=[];for(let flip=0;flip<2;flip++){let c=cells.map(([q,r])=>flip?[r,q]:[q,r]);for(let k=0;k<6;k++){keys.push(JSON.stringify(normalize(c)));c=rotateCells(c);}}return keys.sort()[0];}
function enumerate(n){let shapes=[[[0,0]]];for(let size=1;size<n;size++){const next=new Map();for(const cells of shapes)for(const [q,r]of cells)for(const [dq,dr]of dirs){const p=[q+dq,r+dr];if(cells.some(c=>c[0]===p[0]&&c[1]===p[1]))continue;const key=canonical([...cells,p]);next.set(key,JSON.parse(key));}shapes=[...next.values()];}return shapes;}
function makeShapes(n){return enumerate(n).map((cells,i)=>{const pivot=cells.reduce((best,p)=>{const cost=a=>cells.reduce((v,b)=>v+Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[0]+a[1]-b[0]-b[1]),0);return cost(p)<cost(best)?p:best;},cells[0]);return {name:n===3?`Patch ${i+1}`:`Cluster ${i+1}`,cells:cells.map(([q,r])=>[q-pivot[0],r-pivot[1]])};});}
export const SHAPES=[...makeShapes(4),...makeShapes(3)];
export class Game{
 constructor({target=8,terrain=false,random=Math.random}={}){this.target=target;this.random=random;this.board=Array.from({length:HEIGHT},()=>Array(WIDTH).fill(0));this.blockers=Array.from({length:HEIGHT},()=>Array(WIDTH).fill(false));if(terrain)for(const [c,h]of [[2,1],[5,3],[1,5]])this.blockers[HEIGHT-1-h][c]=true;this.elapsed=0;this.height=0;this.cuts=0;this.placed=0;this.lostCells=0;this.status='playing';this.paused=false;this.events=[];this.bag=[];this.pending=0;this.next=this.draw();this.spawn();}
 draw(){if(!this.bag.length){this.bag=[0,1,2,3,4,5,6,0,1,2,3,4,5,6,7,8,9];for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}return this.bag.pop();}
 cells(p=this.piece){return p.cells.map(([dq,dr])=>{const r=p.r+dr;return {r,c:p.q+dq+Math.floor(r/2)};});}
 fits(p=this.piece){return !!p&&this.cells(p).every(({c,r})=>c>=0&&c<WIDTH&&r>=0&&r<HEIGHT&&!this.board[r][c]&&!this.blockers[r][c]);}
 spawn(retry=null){const id=retry??this.next;if(retry===null)this.next=this.draw();const cells=SHAPES[id].cells.map(p=>[...p]),r=1-Math.min(...cells.map(p=>p[1]));this.piece={cells,r,q:3-Math.floor(r/2),id};this.gravity=0;this.grounded=0;this.age=0;this.jammed=false;for(const dx of [0,-1,1,-2,2,-3,3]){if(this.fits({...this.piece,q:this.piece.q+dx})){this.piece.q+=dx;return;}}this.jammed=true;this.resolveBlocked();}
 active(){return this.status==='playing'&&!this.paused&&!this.pending&&!this.jammed;}
 move(dx){if(!this.active())return false;const p={...this.piece,q:this.piece.q+dx};if(!this.fits(p))return false;this.piece=p;return true;}
 lower(p=this.piece){
  const preferred={...p,q:p.q-(p.r%2),r:p.r+1};
  // Row staggering can send a rotated cluster through a side wall.
  // Use the other downward neighbor only for that boundary case;
  // occupied cells and the floor still stop descent normally.
  if(this.cells(preferred).some(({c})=>c<0||c>=WIDTH)){
   const alternate={...p,q:p.q-(p.r%2?0:1),r:p.r+1};
   if(this.cells(alternate).every(({c})=>c>=0&&c<WIDTH))return alternate;
  }
  return preferred;
 }
 down(){if(!this.active())return false;const p=this.lower();if(!this.fits(p))return false;this.piece=p;this.grounded=0;return true;}
 rotate(direction=1){if(!this.active())return false;let cells=this.piece.cells;for(let i=0;i<(direction===1?1:5);i++)cells=rotateCells(cells);for(const dq of [0,-1,1,-2,2]){const p={...this.piece,cells,q:this.piece.q+dq};if(this.fits(p)){this.piece=p;return true;}}return false;}
 landing(){let p=this.piece;while(this.fits(this.lower(p)))p=this.lower(p);return p;}
 drop(){if(!this.active())return;this.piece=this.landing();this.lock();}
 full(r){return this.board[r].every((v,c)=>v||this.blockers[r][c]);}
 lowestGap(highest){for(let r=HEIGHT-1;r>highest;r--)if(!this.full(r))return r;return -1;}
 cutAbove(gap,reason='row'){
  const removed=[];
  for(let r=0;r<gap;r++)for(let c=0;c<WIDTH;c++)if(this.board[r][c]){removed.push({r,c,id:this.board[r][c]-1});this.board[r][c]=0;}
  if(removed.length){this.cuts++;this.lostCells+=removed.length;this.events.push({type:'cut',gap,removed,reason});this.pending=850;}
 }
 measure(){this.height=0;for(let r=HEIGHT-1;r>=0&&this.full(r);r--)this.height++;}
 win(){if(this.elapsed>=DURATION){this.status='lost';return;}this.status='won';this.events.push({type:'won'});}
 resolve(completed){const gap=this.lowestGap(completed.length?Math.min(...completed):HEIGHT);if(gap!==-1)this.cutAbove(gap);this.measure();if(this.height>=this.target)this.win();}
 resolveBlocked(){
  if(this.elapsed>=DURATION){this.status='lost';return;}
  // Empty headroom is not a gap in the tower. Include its highest occupied row.
  const highest=this.board.findIndex((row,r)=>row.some((v,c)=>v||this.blockers[r][c]));
  const gap=this.lowestGap(highest-1);
  this.measure();
  if(gap===-1){this.win();return;}
  this.cutAbove(gap,'blocked');
  this.measure();
  if(this.pending)this.retryId=this.piece.id;
  else this.events.push({type:'jam'});
 }
 lock(){const rows=new Set(this.cells().map(p=>p.r)),before=new Set([...rows].filter(r=>this.full(r)));for(const {c,r}of this.cells())this.board[r][c]=this.piece.id+1;this.placed++;this.resolve([...rows].filter(r=>!before.has(r)&&this.full(r)));this.events.push({type:'lock'});if(this.status==='playing'&&!this.pending)this.spawn();}
 update(ms,soft=false){if(this.status!=='playing'||this.paused)return;this.elapsed=Math.min(DURATION,this.elapsed+ms);if(this.elapsed>=DURATION){this.status='lost';return;}if(this.pending){this.pending=Math.max(0,this.pending-ms);if(!this.pending){const retry=this.retryId??null;this.retryId=null;this.spawn(retry);}return;}if(this.jammed)return;this.age+=ms;this.gravity+=ms;const speed=soft?55:950;while(this.gravity>=speed){this.gravity-=speed;if(!this.down())break;}if(!this.fits(this.lower())){this.grounded+=ms;if(this.grounded>=550)this.lock();}}
}
