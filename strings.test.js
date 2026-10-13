import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLYPHS} from './font.js';

// Display text is written in capitals; every all-caps string literal in the UI code must be drawable.
test('every capitalised string in the UI code uses only font characters',()=>{
 const missing=new Set();
 for(const file of ['app.js','ui.js','render.js']){
  const src=readFileSync(new URL(`./${file}`,import.meta.url),'utf8');
  for(const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)){
   const text=m[2].replace(/\$\{[^}]*\}/g,'');
   if(!/[A-Z]{2}/.test(text)||/[a-z]/.test(text))continue;
   for(const ch of text)if(!GLYPHS[ch])missing.add(`${file}: ${JSON.stringify(ch)} in ${JSON.stringify(text)}`);
  }
 }
 assert.deepEqual([...missing],[]);
});
