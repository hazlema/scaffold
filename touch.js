// Touch controls for the phone deck: fingers on the deck's buttons in, the same actions the keyboard produces out.
const ONCE={left:'left',right:'right',rotate:'cw',beat:'beat'};
export function createTouch({das=170,arr=50,doubleTap=250}={}){
 const fingers=new Map();// pointer id -> {button, next}
 let lastDown=-Infinity;
 const held=button=>[...fingers.values()].some(f=>f.button===button);
 return {
  down(id,button,t){
   if(button==='pause')return ['pause'];
   if(!button)return [];
   fingers.set(id,{button,next:t+das});
   if(button!=='down')return [ONCE[button]];
   const out=['soft-on'];
   if(t-lastDown<=doubleTap){out.push('drop');lastDown=-Infinity;}// a third quick tap starts a new pair
   else lastDown=t;
   return out;
  },
  up(id){
   const f=fingers.get(id);if(!f)return [];
   fingers.delete(id);
   return f.button==='down'&&!held('down')?['soft-off']:[];
  },
  tick(t){
   const out=[];
   for(const f of fingers.values()){
    if(f.button!=='left'&&f.button!=='right')continue;
    if(t-f.next>2*arr){f.next=t+arr;continue;}// a long gap (a banner, a stall): resume the slide, don't burst
    while(t>=f.next){out.push(`${f.button}-repeat`);f.next+=arr;}
   }
   return out;
  },
  clear(){const was=held('down');fingers.clear();return was?['soft-off']:[];},
  isPressed:button=>held(button),
 };
}
