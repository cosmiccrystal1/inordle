import { config } from './config.js';
import { dayKey, demoPuzzle, evaluate } from './game.js';
const $=id=>document.getElementById(id);
const live=Boolean(config.url && config.key);
let state, dictionary, busy=false, session, pending;
const storage={get(k){return localStorage.getItem(k)},set(k,v){localStorage.setItem(k,v)}};
async function request(path,body,token=config.key){
 const response=await fetch(config.url+path,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key,Authorization:'Bearer '+token},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok) throw new Error(data.message||data.msg||'Connection failed. Please try again.');
 return data;
}
async function authenticate(){
 session=JSON.parse(storage.get('inordle-session')||'null');
 if(!session) session=await request('/auth/v1/signup',{});
 else if(session.expires_at*1000 < Date.now()+60000) session=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
 if(!session.access_token) throw new Error('Anonymous sign-in is unavailable. Please contact the game owner.');
 storage.set('inordle-session',JSON.stringify(session));
}
async function rpc(action,word=null,id=null,day=null){
 await authenticate();
 return request('/rest/v1/rpc/play',{action,guess:word,request_id:id,expected_day:day},session.access_token);
}
function localState(){const day=dayKey();return JSON.parse(storage.get('inordle-demo-'+day)||'null')||{day,letters:demoPuzzle(day),attempts:[],answer:null,done:false,rankings:[]};}
function render(){
 $('answer-count').textContent=Number(state.answer_count??(state.answer?1:0)).toLocaleString()+' ANSWERS TODAY';
 $('date').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(state.day+'T12:00:00Z')).toUpperCase();
 $('number').textContent='#'+Math.floor((Date.parse(state.day)-Date.parse('2026-01-01'))/86400000+1);
 $('tiles').replaceChildren(...[...state.letters].map(c=>{const e=document.createElement('span');e.className='tile';e.textContent=c;return e}));
 $('attempts').replaceChildren(...Array.from({length:3},(_,i)=>{const e=document.createElement('span');e.className=i<state.attempts.length?(state.answer&&i===state.attempts.length-1?'won':'used'):'';return e}));
 $('remaining').textContent=state.done?(state.answer?'Solved!':'Out of attempts!'):`${3-state.attempts.length} attempts remaining`;
 $('word').disabled=state.done||busy;$('submit').disabled=state.done||busy;
 $('history').replaceChildren(...state.attempts.map(w=>{const e=document.createElement('li');e.textContent=w+(w===state.answer?' ✓':' ×');if(w===state.answer)e.className='accepted';return e}));
 $('results').hidden=!state.done;
 if(state.done){
 $('message').textContent=state.answer?'Congrats, come back for a new trail tomorrow!':'Not a valid word! Tough luck, try again tomorrow!';
 const rows=state.rankings||[]; const total=rows.reduce((n,r)=>n+Number(r.count),0);
 $('result-info').textContent=live?`${total.toLocaleString()} discovered words · ${rows.length} unique words - most common to least common`:'Local demo: only your answer appears here. Connect the backend for community results.';
 $('ranking').replaceChildren(...rows.map((r,i)=>{const e=document.createElement('li');e.style.setProperty('--bar',100*Number(r.count)/Number(rows[0].count)+'%');const name=document.createElement('span');name.textContent=`${i+1}. ${r.word}${r.word===state.answer?' · you':''}`;const count=document.createElement('span');count.textContent=Number(r.count).toLocaleString()+' '+(Number(r.count)===1?'player':'players');e.append(name,count);return e}));
 if(!rows.length)$('result-info').textContent+=' · No accepted answers yet.';
 }
}
async function load(){
 state=live?await rpc('status'):localState();
 render();
 if(!state.done)$('message').textContent='Loading...';
}
$('form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||state?.done)return;
 const word=$('word').value.trim().toLowerCase();
 if(!word)return;
 busy=true;render();$('message').textContent='Checking your word…';
 try{
 if(live){
 pending ||= JSON.parse(storage.get('inordle-pending')||'null');
 if(pending && pending.day!==state.day){storage.set('inordle-pending','null');pending=null;}
 if(pending && pending.word!==word) throw new Error('Retry your previous word first: '+pending.word);
 pending ||= {word,id:crypto.randomUUID(),day:state.day};
 storage.set('inordle-pending',JSON.stringify(pending));
 state=await rpc('submit',pending.word,pending.id,pending.day);
 pending=null;storage.set('inordle-pending','null');
 }else{
 // Serialize same-origin tabs where Web Locks is supported.
 const submit=async()=>{state=localState();if(state.done)return;if(!dictionary)dictionary=new Set(await (await fetch('data/words.json')).json());
 const valid=evaluate(word,state.letters,dictionary);state.attempts.push(word);if(valid)state.answer=word;state.done=valid||state.attempts.length>=3;state.rankings=valid?[{word,count:1}]:[];storage.set('inordle-demo-'+state.day,JSON.stringify(state));};
 if(navigator.locks)await navigator.locks.request('inordle-demo',submit);else await submit();
 }
 $('word').value='';render();if(!state.done)$('message').textContent='Not a valid word!';
 }catch(error){$('message').textContent=error.message;}
 finally{busy=false;if(state){$('word').disabled=state.done;$('submit').disabled=state.done;}}
});
$('refresh').onclick=async()=>{try{await load()}catch(e){$('message').textContent=e.message}};
$('help').onclick=()=>$('rules').showModal();$('close-help').onclick=()=>$('rules').close();
window.addEventListener('storage',event=>{if(!live&&event.key?.startsWith('inordle-demo-'))load().catch(()=>{})});
setInterval(()=>{
 const now=new Date();let next=Date.now()+60000;
 // Search UTC instants for the next date boundary: correct for 23/25-hour DST days.
 let low=Date.now(),high=low+26*3600000;const today=dayKey(now);
 while(high-low>1000){const mid=Math.floor((high+low)/2);if(dayKey(new Date(mid))===today)low=mid;else high=mid}next=high;
 const seconds=Math.max(0,Math.floor((next-Date.now())/1000));$('countdown').textContent=`Next trail in: ${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 if(state&&state.day!==today&&!busy)load().catch(e=>{$('message').textContent=e.message});
},1000);
$('mode').textContent=live?'':'LOCAL DEMO · answer count is for this browser only';
$('submit').disabled=true;
load().catch(error=>{$('message').textContent='Could not open today’s puzzle. '+error.message;});
