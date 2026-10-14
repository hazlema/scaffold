// Touch controls for the tall phone screen: five hex buttons in the side strips beside the board.
// Pure: fingers in, the same actions the keyboard produces out. Positions are logical pixels of the 270x330 screen.
export const BUTTONS=[
 {name:'left',x:15,y:268,label:'◀',side:'left'},
 {name:'right',x:40,y:268,label:'▶',side:'left'},
 {name:'down',x:27,y:290,label:'V',side:'left'},
 {name:'rotate',x:230,y:268,label:'R',side:'right'},
 {name:'beat',x:255,y:268,label:'B',side:'right'},
];
const STRIP_LEFT=56,STRIP_RIGHT=215,PAD_TOP=236,READOUT_BOTTOM=48;
// Every touch in the lower part of a side strip belongs to the nearest button on that side.
export function hitButton(x,y){
 if(y<READOUT_BOTTOM)return 'pause';
 if(y<PAD_TOP)return null;
 const side=x<STRIP_LEFT?'left':x>=STRIP_RIGHT?'right':null;
 if(!side)return null;
 let best=null,bestD=Infinity;
 for(const b of BUTTONS)if(b.side===side){const d=(b.x-x)**2+(b.y-y)**2;if(d<bestD){bestD=d;best=b.name;}}
 return best;
}
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
   for(const f of fingers.values())if(f.button==='left'||f.button==='right')while(t>=f.next){out.push(`${f.button}-repeat`);f.next+=arr;}
   return out;
  },
  clear(){const was=held('down');fingers.clear();return was?['soft-off']:[];},
  isPressed:button=>held(button),
 };
}
