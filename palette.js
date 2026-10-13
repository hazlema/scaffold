// The locked 16-colour palette (docs/superpowers/specs/2026-10-12-retro-restyle-design.md).
export const C={black:'#030203',navy:'#121871',royal:'#14199a',indigo:'#32209d',violet:'#714ec0',purple:'#9316bc',lavender:'#a359e5',magenta:'#e525ac',hotpink:'#fa5094',pink:'#fc71b2',orange:'#fd9e4b',yellow:'#fee69c',cream:'#f3e6ac',white:'#ffffff',green:'#3fbf6a',cyan:'#3ec8f0'};
export const PALETTE=Object.values(C);
// One colour per SHAPES id: tetrahexes 0-6, then trihexes 7-9. First pick; tune by eye.
export const PIECES=[C.green,C.cyan,C.orange,C.yellow,C.hotpink,C.lavender,C.cream,C.magenta,C.white,C.pink];
// Chamfer: [upper-left facet, lower-right facet] for each fill.
export const BEVEL={
 [C.green]:[C.white,C.indigo],[C.cyan]:[C.white,C.indigo],[C.orange]:[C.yellow,C.magenta],
 [C.yellow]:[C.white,C.orange],[C.hotpink]:[C.pink,C.purple],[C.lavender]:[C.white,C.violet],
 [C.cream]:[C.white,C.lavender],[C.magenta]:[C.pink,C.purple],[C.white]:[C.white,C.lavender],
 [C.pink]:[C.white,C.magenta],
};
// Fills too light for the white pivot dot and step arrow; those marks are drawn black instead.
export const LIGHT_PIECES=new Set([C.yellow,C.cream,C.white,C.cyan]);
