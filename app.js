import { config } from './config.js?v=20261109-4';
import { dayKey, demoPuzzle, evaluate, normalizeWord, rankingStats, submissionRejection } from './game.js?v=20261109-7';
import { renderBoard, fitWords, captureBoard, animateAttempt } from './board.js?v=20261109-7';
import { showSubmissionError, initializeInstructions } from './ui.js?v=20261109-7';
const $=id=>document.getElementById(id);
const live=Boolean(config.url && config.key);
let state, dictionary, busy=false, session, pending;
let dictionaryPromise;
function loadDictionary(){
 return dictionaryPromise ||= fetch('data/words.json?v=20261109-7').then(response=>{
  if(!response.ok)throw new Error('Could not load dictionary. Please refresh.');
  return response.json();
 }).then(words=>dictionary=new Set(words)).catch(error=>{dictionaryPromise=null;throw error;});
}
let blockedPromise;
function loadBlocked(){
 return blockedPromise ||= fetch('data/blocked-words.json?v=20261109-7').then(response=>{
  if(!response.ok)throw new Error('Could not load word moderation. Please refresh.');
  return response.json();
 }).then(words=>new Set(words)).catch(error=>{blockedPromise=null;throw error;});
}
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
 $('number').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(state.day+'T12:00:00Z')).toUpperCase();
 renderBoard(state);
 $('attempts').replaceChildren(...Array.from({length:3},(_,i)=>{const e=document.createElement('span');e.className=i<state.attempts.length?(state.answer&&i===state.attempts.length-1?'won':'used'):'';return e}));
 $('remaining').textContent=state.done?(state.answer?'Solved!':'Out of attempts!'):`${3-state.attempts.length} attempts remaining`;
 $('form').hidden=state.done;
 $('message').hidden=state.done;
 document.querySelector('.trail-caption').hidden=state.done;
 $('word').disabled=state.done||busy;$('submit').disabled=state.done||busy;
 $('results').hidden=!state.done;
 document.querySelector('.how').hidden=state.done;
 if(state.done){
 $('message').textContent=state.answer?'Congrats, come back for a new trail tomorrow!':'Not a valid word! Tough luck, try again tomorrow!';
 const rows=rankingStats(state.rankings||[],state.answer); const total=rows.reduce((n,r)=>n+r.count,0);
 $('result-info').textContent=live?`${total.toLocaleString()} solved · ${rows.length} unique words`:"You're offline!";
 $('ranking').replaceChildren(...rows.map((r,i)=>{
  const e=document.createElement('li');
  e.style.setProperty('--bar',r.percent+'%');
  if(r.selected){e.classList.add('selected-answer');e.setAttribute('aria-current','true');e.setAttribute('aria-label',`${r.word}, your selected word, ${r.label}`);}
  const name=document.createElement('span');name.textContent=`${i+1}. ${r.word}`;
  const count=document.createElement('span');count.className='ranking-count';count.textContent=r.label;
  e.append(name,count);return e;
 }));
 if(!rows.length)$('result-info').textContent+=' · No accepted answers yet.';
 }
}
async function load(){
 const [,,game]=await Promise.all([loadBlocked(),loadDictionary(),live?rpc('status'):Promise.resolve(localState())]);
 state=game;
 render();
 if(!state.done)$('message').textContent="Solve the puzzle before viewing today's results!";
}
$('form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||state?.done)return;
 const word=$('word').value.trim().toLowerCase();
 const previousCount=state.attempts.length,previousDay=state.day,snapshot=captureBoard();
 busy=true;render();$('message').textContent='Checking your word…';
 try{
 const [blocked,words]=await Promise.all([loadBlocked(),loadDictionary()]);
 const rejection=submissionRejection(word,blocked,words);
 if(rejection){showSubmissionError(rejection);$('message').textContent="Solve the puzzle before viewing today's results!";return;}
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
 const submit=async()=>{state=localState();if(state.done)return;if(!dictionary)await loadDictionary();
 const valid=evaluate(word,state.letters,dictionary),canonical=valid?normalizeWord(word):word;state.attempts.push(canonical);if(valid)state.answer=canonical;state.done=valid||state.attempts.length>=3;state.rankings=valid?[{word:canonical,count:1}]:[];storage.set('inordle-demo-'+state.day,JSON.stringify(state));};
 if(navigator.locks)await navigator.locks.request('inordle-demo',submit);else await submit();
 }
 if(state.rejection){render();showSubmissionError(state.rejection);$('message').textContent="Solve the puzzle before viewing today's results!";return;}
 $('word').value='';render();
 if(state.day===previousDay&&state.attempts.length>previousCount)await animateAttempt(snapshot,state);
 if(!state.done)$('message').textContent='Not a valid word!';else if(state.answer&&normalizeWord(word)!==word)$('message').textContent=`Accepted as ${normalizeWord(word)}. Come back for a new trail tomorrow!`;
 }catch(error){$('message').textContent=error.message;}
 finally{busy=false;if(state){$('word').disabled=state.done;$('submit').disabled=state.done;}}
});
$('refresh').onclick=async()=>{try{await load()}catch(e){$('message').textContent=e.message}};
$('help').onclick=()=>{if(!$('rules').open)$('rules').showModal();};$('close-help').onclick=()=>$('rules').close();
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
initializeInstructions();
load().catch(error=>{$('message').textContent='Could not open today’s puzzle. '+error.message;});

new ResizeObserver(fitWords).observe($('word-board'));
