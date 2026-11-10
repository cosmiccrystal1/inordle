import { trails, trailWeights } from './trails.js?v=20261109-6';
import { normalizeWord } from './normalization.js?v=20261109-6';
export { normalizeWord };
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
 return weightedTrail(pool,trailWeights,n);
}
export function evaluate(word,letters,dictionary) { return /^[a-z]{2,32}$/.test(word) && dictionary.has(word) && dictionary.has(normalizeWord(word)) && matches(normalizeWord(word),letters); }

export function weightedTrail(pool,weights,dayNumber) {
 const modulus=2147483647n;
 let seed=((BigInt(dayNumber)%modulus)+modulus)%modulus;
 for(let i=0;i<3;i++)seed=seed*48271n%modulus;
 const total=pool.reduce((sum,t)=>sum+weights[t],0);
 let ticket=Number(seed*BigInt(total)/modulus);
 for(const trail of pool){ticket-=weights[trail];if(ticket<0)return trail;}
 throw new Error('Trail catalog is not ready');
}
export function rankingStats(rows,answer) {
 const total=rows.reduce((sum,row)=>sum+Number(row.count),0);
 return rows.map(row=>{
  const count=Number(row.count),percent=total?100*count/total:0;
  return {...row,count,percent,label:`${count.toLocaleString()} ${count===1?'player':'players'}  (${percent.toFixed(2)}%)`,selected:normalizeWord(row.word)===normalizeWord(answer||'')};
 });
}

export function submissionRejection(word,blocked) {
 if(!/^[a-z]{2,32}$/.test(word))return 'Use 2–32 English letters. No attempt used.';
 if(blocked.has(word)||blocked.has(normalizeWord(word)))return 'That word cannot be submitted. No attempt used.';
 return null;
}
// Longest ordered alignment, with deterministic tie-breaking for duplicate letters.
export function letterAlignment(word,trail) {
 const chars=[...word.toUpperCase()],required=[...trail.toUpperCase()];
 const dp=Array.from({length:required.length+1},()=>Array(chars.length+1).fill(0));
 for(let i=required.length-1;i>=0;i--)for(let j=chars.length-1;j>=0;j--)
  dp[i][j]=required[i]===chars[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 const matched=new Map();let i=0,j=0;
 while(i<required.length&&j<chars.length){
  if(required[i]===chars[j]){matched.set(j,i);i++;j++;}
  else if(dp[i][j+1]>=dp[i+1][j])j++;else i++;
 }
 return chars.map((letter,index)=>({letter,trailIndex:matched.has(index)?matched.get(index):null,kind:matched.has(index)?'trail':required.includes(letter)?'misplaced':'added'}));
}
