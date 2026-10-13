// Local top-10 high scores. Anything unreadable is dropped; storage problems never throw.
export const SCORES_KEY='scaffold.scores';
export const MAX_SCORES=10;
const NAME=/^[A-Z0-9 ]{3}$/,LETTERS=['E','M','H'];
const empty=()=>({entries:[],last:''});
function cleanEntry(x){
 if(!x||typeof x!=='object')return null;
 const {name,score,diff,level,at}=x;
 if(typeof name!=='string'||!NAME.test(name)||!Number.isInteger(score)||score<=0||!LETTERS.includes(diff)||!Number.isInteger(level)||level<1)return null;
 return {name,score,diff,level,at:Number.isFinite(at)?at:0};
}
// Highest first; equal scores keep the older entry above the newer.
const byRank=(a,b)=>b.score-a.score||a.at-b.at;
export function cleanScores(raw){
 const out=empty();
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
 if(Array.isArray(raw.entries))out.entries=raw.entries.map(cleanEntry).filter(Boolean).sort(byRank).slice(0,MAX_SCORES);
 if(typeof raw.last==='string'&&NAME.test(raw.last))out.last=raw.last;
 return out;
}
export function loadScores(storage){try{return cleanScores(JSON.parse(storage.getItem(SCORES_KEY)));}catch{return empty();}}
export function saveScores(storage,data){try{storage.setItem(SCORES_KEY,JSON.stringify(cleanScores(data)));return true;}catch{return false;}}
export const qualifies=(entries,score)=>score>0&&(entries.length<MAX_SCORES||score>entries[MAX_SCORES-1].score);
export function insertScore(entries,entry){
 let i=entries.findIndex(x=>x.score<entry.score);if(i<0)i=entries.length;
 return {entries:[...entries.slice(0,i),entry,...entries.slice(i)].slice(0,MAX_SCORES),rank:i<MAX_SCORES?i:-1};
}
export const scoreRow=(i,x)=>`${String(i+1).padStart(2)}  ${x.name}  ${String(x.score).padStart(5)}  ${x.diff}  L${x.level}`;
