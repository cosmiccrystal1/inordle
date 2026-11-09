import {trails} from '../trails.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dayKey,matches,demoPuzzle,evaluate} from '../game.js';
const words=new Set(JSON.parse(fs.readFileSync(new URL('../data/words.json',import.meta.url))));
test('letters must occur in order, including repeated letters',()=>{
 assert.equal(matches('great','GRT'),true);assert.equal(matches('alligator','GRT'),false);
 assert.equal(matches('letter','TTR'),true);assert.equal(matches('later','TTR'),false);
 assert.equal(matches('grateful','GRT'),true);
});
test('New York winter and summer midnight boundaries',()=>{
 assert.equal(dayKey(new Date('2026-01-02T04:59:59Z')),'2026-01-01');
 assert.equal(dayKey(new Date('2026-01-02T05:00:00Z')),'2026-01-02');
 assert.equal(dayKey(new Date('2026-07-02T03:59:59Z')),'2026-07-01');
 assert.equal(dayKey(new Date('2026-07-02T04:00:00Z')),'2026-07-02');
 assert.equal(dayKey(new Date('2026-03-09T03:59:59Z')),'2026-03-08');
 assert.equal(dayKey(new Date('2026-11-02T04:59:59Z')),'2026-11-01');
});
test('every catalog trail has four dictionary solutions',()=>{
 const counts=new Set();
 for(const [kind,pool] of Object.entries(trails)) for(const trail of pool){
  assert.match(trail,/^[A-Z]{2,5}$/);
  const vowels=[...trail].filter(c=>'AEIOU'.includes(c)).length;
  assert.equal(vowels,kind==='vowels'?1:0);
  assert.ok(vowels<trail.length/2);
  const pattern=new RegExp([...trail.toLowerCase()].join('.*'));
  let count=0;for(const word of words) if(pattern.test(word)&&++count===4)break;
  assert.equal(count,4,trail);counts.add(trail.length);
 }
 assert.equal(counts.size,4);
});
test('three years of deterministic puzzles with rare vowels',()=>{
 const sizes=new Set();let vowelDays=0;
 for(let i=0;i<1096;i++){
  const day=new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),letters=demoPuzzle(day);
  assert.equal(demoPuzzle(day),letters);sizes.add(letters.length);
  if(/[AEIOU]/.test(letters)){vowelDays++;assert.ok(trails.vowels.includes(letters));}
  else assert.ok(trails.consonants.includes(letters));
 }
 assert.equal(sizes.size,4);assert.ok(vowelDays>=90&&vowelDays<=92);
});
test('dictionary, formatting, and moderation',()=>{
 assert.ok(evaluate('great','GRT',words));assert.equal(evaluate('grtzzzz','GRT',words),false);
 assert.equal(evaluate('<script>','ST',words),false);assert.equal(evaluate('great!','GRT',words),false);
 const blocked=fs.readFileSync(new URL('../data/blocked.txt',import.meta.url),'utf8').split(/\r?\n/).filter(w=>/^[a-z]+$/.test(w));
 for(const w of blocked)assert.equal(words.has(w),false,w);
});
