// Board geometry and all canvas drawing for the 480x270 screen.
import {WIDTH,HEIGHT,LANE} from './engine.js';

export const LAYOUT={W:480,H:270,BX:156,BY:14,cabinet:{x:150,y:8,w:159,h:255},panel:{x:318,y:8,w:154,h:255}};
// Pointy-top hex, 14 wide and 15 tall; rows sit 12 apart and odd rows shift 7, so tiles interlock exactly.
export const HEX_ROWS=[[6,7],[4,9],[2,11],...Array(9).fill([0,13]),[1,12],[3,10],[5,8]];
export const HEX_W=14,HEX_H=HEX_ROWS.length;
const inHex=(x,y)=>y>=0&&y<HEX_H&&x>=HEX_ROWS[y][0]&&x<=HEX_ROWS[y][1];
export const HEX_PIXELS=HEX_ROWS.flatMap(([a,b],y)=>Array.from({length:b-a+1},(_,i)=>[a+i,y]));
export const HEX_BOTTOM=Array.from({length:HEX_W},(_,x)=>Math.max(...HEX_PIXELS.filter(p=>p[0]===x).map(p=>p[1])));
export function edgeOf(x,y){
 if(!inHex(x-1,y)||!inHex(x,y-1))return 'light';
 if(!inHex(x+1,y)||!inHex(x,y+1))return 'dark';
 return null;
}
// Lane columns (-1 and WIDTH) always keep their space so the board never shifts.
export const cellXY=(c,r)=>({x:LAYOUT.BX+14*(c+LANE)+7*(r%2),y:LAYOUT.BY+12*r});
export const rowTop=r=>LAYOUT.BY+12*r+1;
