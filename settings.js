// Player settings, kept in localStorage. Anything unreadable falls back to the defaults.
export const KEY='scaffold.settings';
export const DEFAULTS=Object.freeze({target:8,lanes:true,sound:false,scanlines:0.6});
export const TARGETS=[8,12,16];
export function clean(raw){
 const s={...DEFAULTS};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
 if(TARGETS.includes(raw.target))s.target=raw.target;
 if(typeof raw.lanes==='boolean')s.lanes=raw.lanes;
 if(typeof raw.sound==='boolean')s.sound=raw.sound;
 if(typeof raw.scanlines==='number'&&raw.scanlines>=0&&raw.scanlines<=1)s.scanlines=Math.round(raw.scanlines*10)/10;
 return s;
}
export function loadSettings(storage){try{return clean(JSON.parse(storage.getItem(KEY)));}catch{return {...DEFAULTS};}}
export function saveSettings(storage,s){try{storage.setItem(KEY,JSON.stringify(clean(s)));return true;}catch{return false;}}
