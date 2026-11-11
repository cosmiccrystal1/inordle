import {circInFrames} from '../board.js';
import {trails,trailWeights} from '../trails.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dayKey,matches,demoPuzzle,evaluate,randomTrail,rankingStats,weightedTrail,submissionRejection,letterAlignment,startBlitzRound,blitzRemaining,endExpiredBlitz,recordBlitzSolution,formatBlitzTime} from '../game.js';
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
test('every catalog trail has eight distinct solutions and frequency weights',()=>{
 const quality=JSON.parse(fs.readFileSync(new URL('../data/trail-quality.json',import.meta.url)));
 const sizes=new Set();
 for(const [kind,pool] of Object.entries(trails)) for(const trail of pool){
  assert.match(trail,/^[A-Z]{2,5}$/);
  const vowels=[...trail].filter(c=>'AEIOU'.includes(c)).length;
  assert.equal(vowels,kind==='vowels'?1:0);assert.ok(vowels<trail.length/2);
  const q=quality[trail];assert.equal(new Set(q.solutions).size,8);
  for(const word of q.solutions){assert.ok(evaluate(word,trail,words));}
  assert.ok(q.zipf100.every(f=>f>=250));
  const mean=q.zipf100.reduce((a,b)=>a+b,0)/800;
  assert.ok(trailWeights[trail]>=200);
  assert.equal(trailWeights[trail],Math.max(1,Math.min(10000,Math.floor(10**(mean-2)+.5))));
  sizes.add(trail.length);
 }
 assert.equal(sizes.size,4);
});
test('plural and singular forms are independently eligible and match their own letters',()=>{
 assert.ok(evaluate('garden','GRD',words));
 assert.ok(evaluate('gardens','GRDS',words));
 assert.equal(evaluate('garden','GRDS',words),false);
});
test('Casual draws from both eligible pools and replaces the previous trail',()=>{
 assert.equal(randomTrail(undefined,()=>0),trails.consonants[0]);
 assert.equal(randomTrail(undefined,()=>.999999),trails.vowels.at(-1));
 assert.equal(randomTrail(trails.consonants[0],()=>0),trails.consonants[1]);
});
test('rankings use all solved players as the denominator',()=>{
 const rows=rankingStats([{word:'garden',count:5},{word:'great',count:1}],'garden');
 assert.ok(Math.abs(rows[0].percent-100*5/6)<1e-9);assert.equal(rows[0].label,'5 players  (83.33%)');assert.equal(rows[0].selected,true);
 assert.equal(rows[1].label,'1 player  (16.67%)');assert.equal(rows[1].selected,false);
 assert.deepEqual(rankingStats([],null),[]);
});
test('weighted sampling gives common-solution trails proportionately more selections',()=>{
 let common=0;for(let day=0;day<20000;day++)if(weightedTrail(['A','B'],{A:1,B:9},day)==='B')common++;
 assert.ok(common/20000>.89&&common/20000<.91);
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
 assert.ok(evaluate('grateful','GRT',words));assert.equal(evaluate('grtzzzz','GRT',words),false);
 assert.equal(evaluate('<script>','ST',words),false);assert.equal(evaluate('great!','GRT',words),false);
 const blocked=fs.readFileSync(new URL('../data/blocked.txt',import.meta.url),'utf8').split(/\r?\n/).filter(w=>/^[a-z]+$/.test(w));
 for(const w of blocked)assert.equal(words.has(w),false,w);
});

test('only 2–50 letter uncensored dictionary entries can use an attempt',()=>{
 const blocked=new Set(JSON.parse(fs.readFileSync(new URL('../data/blocked-words.json',import.meta.url))));
 for(const word of ['','a'])assert.equal(submissionRejection(word,blocked,words),'Too short');
 for(const word of ['a'.repeat(51),'a'.repeat(1000)])assert.equal(submissionRejection(word,blocked,words),'Too long');
 for(const word of ['great!','notarealword','asshole'])assert.equal(submissionRejection(word,blocked,words),'Not a word');
 assert.equal(submissionRejection('garden',blocked,words),null);
 assert.equal(submissionRejection('gardens',blocked,words),null);
 assert.equal(submissionRejection('groves',blocked,words),null);
 const fixture = new Set(['go','a'.repeat(50)]);
 for (const word of fixture) assert.equal(submissionRejection(word,blocked,fixture),null);
 assert.ok(evaluate('great','GRT',words));
});
test('word tiles identify ordered, misplaced, inserted and repeated trail letters',()=>{
 assert.deepEqual(letterAlignment('grove','GRV').map(x=>x.kind),['trail','trail','added','trail','added']);
 assert.deepEqual(letterAlignment('gtr','GRT').map(x=>x.kind),['trail','misplaced','trail']);
 assert.deepEqual(letterAlignment('gtrt','GRT').map(x=>x.kind),['trail','added','trail','trail']);
 assert.deepEqual(letterAlignment('gttr','GRT').map(x=>x.kind),['trail','misplaced','added','trail']);
 assert.deepEqual(letterAlignment('gtr','GRTT').map(x=>x.kind),['trail','misplaced','trail']);
 const repeated=letterAlignment('letter','TTR').filter(x=>x.kind==='trail');
 assert.deepEqual(repeated.map(x=>x.trailIndex),[0,1,2]);
 assert.equal(new Set(repeated.map(x=>x.trailIndex)).size,3);
 assert.ok(letterAlignment('garden','GRD').filter(x=>x.kind==='trail').length===3);
});

test('inserted letters follow easeInCirc timing from invisible to visible',()=>{
 const frames=circInFrames();assert.equal(frames[0].opacity,0);assert.equal(frames.at(-1).opacity,1);
 const halfway=frames.find(frame=>frame.offset===.5);
 assert.ok(Math.abs(halfway.opacity-(1-Math.sqrt(.75)))<1e-12);
 for(let i=1;i<frames.length;i++)assert.ok(frames[i].opacity>=frames[i-1].opacity);
});


test('Blitz draws only two-to-four-letter trails',()=>{
 const pool=[...trails.consonants,...trails.vowels].filter(trail=>trail.length<=4);
 for(let i=0;i<pool.length;i++)assert.equal(randomTrail(undefined,()=>(i+.5)/pool.length,4),pool[i]);
});

test('Blitz awards length and spacing points immediately, adds time and locks at the deadline',()=>{
 const round=startBlitzRound(1000);
 assert.equal(blitzRemaining(round,1000),120000);
 assert.equal(formatBlitzTime(120),'2:00');
 assert.equal(recordBlitzSolution(round,'great','GR',2000),true);
 assert.equal(round.points,80);
 assert.equal(blitzRemaining(round,2000),124000);
 assert.equal(recordBlitzSolution(round,'grateful','GTF',3000),true);
 assert.equal(round.points,230);
 assert.equal(recordBlitzSolution(round,'rattle','RTE',4000),true);
 assert.equal(round.points,360);
 assert.equal(round.solutions,3);
 assert.equal(round.deadline,136000);
 assert.equal(recordBlitzSolution(round,'wrong','RT',10000),false);
 assert.equal(recordBlitzSolution(round,'rattle','RTE',136000),false);
 assert.equal(endExpiredBlitz(round,145000),true);
 assert.equal(blitzRemaining(round,145000),0);
 assert.equal(formatBlitzTime((round.endedAt-round.startedAt)/1000),'2:15');
 assert.equal(endExpiredBlitz(round,150000),false);
});
