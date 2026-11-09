import { trails } from './trails.js';
export function dayKey(date = new Date()) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export function matches(word, letters) { let i=0; for(const c of word.toLowerCase()) if(c===letters[i]?.toLowerCase()) i++; return i===letters.length; }
// One shared, prevalidated catalog for the demo and authoritative server.
export function demoPuzzle(day) {
 const n=Math.floor(Date.parse(day+'T12:00:00Z')/86400000);
 const mod=(x,m)=>((x%m)+m)%m;
 const rare=mod(n,12)===0;
 const target=rare?3+mod(Math.floor(n/12),3):2+mod(n,4);
 const pool=(rare?trails.vowels:trails.consonants).filter(t=>t.length===target);
 return pool[mod(mod(n*48271,2147483647),pool.length)];
}
export function evaluate(word,letters,dictionary) { return /^[a-z]{2,32}$/.test(word) && dictionary.has(word) && matches(word,letters); }
