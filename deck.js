// The phone controller deck: real page elements under the game screen, styled after
// docs/mock/Mobile Controls.dc.html (sizes are mock units; CSS turns them into pixels via --u).
import {SHAPES} from './engine.js';
import {PIECES} from './palette.js';

export const NEXT_BOX={w:150,h:96};
// The next piece as pointy-top hexes, centred in the NEXT window.
export function nextHexes(id,size=28){
 const w=size*Math.sqrt(3)/2,pts=SHAPES[id].cells.map(([q,r])=>({x:w*(q+r/2),y:.75*size*r}));
 const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
 const ox=(NEXT_BOX.w-(Math.max(...xs)-Math.min(...xs)+w))/2-Math.min(...xs);
 const oy=(NEXT_BOX.h-(Math.max(...ys)-Math.min(...ys)+size))/2-Math.min(...ys);
 return {color:PIECES[id],w,h:size,cells:pts.map(p=>({x:Math.round(p.x+ox),y:Math.round(p.y+oy)}))};
}
// Eye candy: one of four BEAT lights is lit and moves on with every drop step.
export const chaseLight=steps=>((steps%4)+4)%4;

const u=n=>`calc(var(--u)*${n})`;
const hex=(btn,inner,style='')=>`<div class="hexbtn" data-btn="${btn}" style="${style}"><div class="face">${inner}</div></div>`;
const MARKUP=`<div class="lcd"><div class="goal"><b>GOAL</b><span class="msg"></span></div><div class="beat">BEAT<i></i><i></i><i></i><i></i></div></div>`+
 `<div class="pads"><div class="dpad">`+
 hex('left','<i class="tri l"></i>',`left:${u(7)};top:0`)+hex('right','<i class="tri r"></i>',`left:${u(107)};top:0`)+hex('down','<i class="tri d"></i>',`left:${u(57)};top:${u(78)}`)+
 `</div><div class="next"><span>NEXT</span><div class="win"></div></div>`+
 `<div class="acts"><div class="act low rot">${hex('rotate','R')}<span>ROTATE</span></div><div class="act high bt">${hex('beat','B')}<span>BEAT</span></div></div></div>`;

export function createDeck(doc){
 const root=doc.getElementById('deck');
 // Without a real DOM (tests) the deck draws nothing but still maps event targets to buttons.
 if(typeof root?.querySelector!=='function')return {update(){},buttonOf:t=>t?.dataset?.btn??null};
 root.innerHTML=MARKUP;
 const msg=root.querySelector('.msg'),lights=[...root.querySelectorAll('.beat i')],win=root.querySelector('.win'),btns=[...root.querySelectorAll('[data-btn]')];
 const last={};
 return {
  update({message,steps,next,isPressed}){
   if(message!==last.message){msg.textContent=message;last.message=message;}
   const lit=chaseLight(steps);
   if(lit!==last.lit){lights.forEach((l,i)=>l.classList.toggle('on',i===lit));last.lit=lit;}
   if(next!==last.next){
    last.next=next;
    if(next==null)win.innerHTML='';
    else{const n=nextHexes(next);win.innerHTML=n.cells.map(c=>`<i style="left:${u(c.x+1)};top:${u(c.y+1)};width:${u(n.w-2)};height:${u(n.h-2)};background:${n.color}"></i>`).join('');}
   }
   for(const b of btns){const p=!!isPressed(b.dataset.btn);if(p!==b._pressed){b.classList.toggle('down',p);b._pressed=p;}}
  },
  buttonOf:t=>t?.closest?.('[data-btn]')?.dataset.btn??null,
 };
}
