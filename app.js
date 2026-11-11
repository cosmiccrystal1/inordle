import { config } from './config.js?v=20261109-4';
import { dayKey, demoPuzzle, evaluate, randomTrail, rankingStats, submissionRejection } from './game.js?v=20261111-1';
import { renderBoard, fitWords, captureBoard, animateAttempt } from './board.js?v=20261111-1';
import { showSubmissionError, initializeInstructions } from './ui.js?v=20261111-1';
const $=id=>document.getElementById(id);
const live=Boolean(config.url && config.key);
let state, dictionary, busy=false, session, pending;
let mode='daily', endlessState, statusRequest;
const dailyPrompt="Solve the puzzle before viewing today's results!";
const currentGame=()=>mode==='daily'?state:endlessState;

function newEndlessTrail(){
 endlessState={letters:randomTrail(endlessState?.letters),attempts:[],correctAttempts:[],done:false};
}
let dictionaryPromise;
function loadDictionary(){
 return dictionaryPromise ||= fetch('data/words.json?v=20261111-1').then(response=>{
  if(!response.ok)throw new Error('Could not load dictionary. Please refresh.');
  return response.json();
 }).then(words=>dictionary=new Set(words)).catch(error=>{dictionaryPromise=null;throw error;});
}
let blockedPromise;
function loadBlocked(){
 return blockedPromise ||= fetch('data/blocked-words.json?v=20261111-1').then(response=>{
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
 const daily=mode==='daily',game=currentGame();
 document.querySelector('.mode-switch').dataset.mode=mode;
 $('daily-tab').setAttribute('aria-pressed',String(daily));
 $('endless-tab').setAttribute('aria-pressed',String(!daily));
 $('daily-label').hidden=!daily;
 $('new-trail').hidden=daily;
 $('number').hidden=!daily;
 $('daily-status').hidden=!daily;
 document.querySelector('.puzzle').setAttribute('aria-label',daily?"Today's puzzle":'Endless puzzle');
 $('answer-count').hidden=!daily;
 document.querySelector('.live-dot').hidden=!daily;
 $('countdown').hidden=!daily;
 $('mode').textContent=daily&&!live?'LOCAL DEMO · answer count is for this browser only':'';
 $('results').hidden=!daily||!game?.done;
 if(!game){
  $('tiles').replaceChildren();
  $('attempt-words').replaceChildren();
  $('form').hidden=false;
  $('message').hidden=false;
  $('word').disabled=true;
  $('submit').disabled=true;
  return;
 }

 $('answer-count').textContent=Number(game.answer_count??(game.answer?1:0)).toLocaleString()+' ANSWERS TODAY';
 if(daily)$('number').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(game.day+'T12:00:00Z')).toUpperCase();
 renderBoard(game);
 $('attempts').replaceChildren(...Array.from({length:3},(_,i)=>{const e=document.createElement('span');e.className=i<game.attempts.length?(game.answer&&i===game.attempts.length-1?'won':'used'):'';return e}));
 $('remaining').textContent=game.done?(game.answer?'Solved!':'Out of attempts!'):`${3-game.attempts.length} attempts remaining`;
 $('form').hidden=game.done;
 $('message').hidden=game.done;
 document.querySelector('.trail-caption').hidden=game.done;
 $('word').disabled=game.done||busy;$('submit').disabled=game.done||busy;

 document.querySelector('.how').hidden=game.done;
 if(game.done){
 $('message').textContent=game.answer?'Congrats, come back for a new trail tomorrow!':'Tough luck, try again tomorrow!';
 const rows=rankingStats(game.rankings||[],game.answer); const total=rows.reduce((n,r)=>n+r.count,0);
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
function load(){
 if(statusRequest)return statusRequest;
 const previous=state;
 statusRequest=(async()=>{
  const [,,game]=await Promise.all([loadBlocked(),loadDictionary(),live?rpc('status'):Promise.resolve(localState())]);
  // A status response started before a submission cannot overwrite its result.
  if(busy||state!==previous)return;
  state=game;
  if(mode!=='daily'||JSON.stringify(previous)===JSON.stringify(game))return;
  render();
  if(!game.done&&previous?.day!==game.day)$('message').textContent=dailyPrompt;
 })().finally(()=>{statusRequest=null;});
 return statusRequest;
}

function refreshDaily(){
 if(mode!=='daily'||busy||document.hidden)return;
 load().catch(error=>{
  if(mode==='daily'&&!state)$('message').textContent='Could not open today’s puzzle. '+error.message;
 });
}

function selectMode(next){
 if(busy||mode===next)return;
 mode=next;
 if(mode==='endless'&&!endlessState)newEndlessTrail();
 $('word').value='';
 $('message').textContent=mode==='daily'?dailyPrompt:'';
 render();
 refreshDaily();
}

$('daily-tab').onclick=()=>selectMode('daily');
$('endless-tab').onclick=()=>selectMode('endless');
$('new-trail').onclick=()=>{
 if(busy)return;
 newEndlessTrail();
 $('word').value='';
 $('message').textContent='';
 render();
 $('word').focus();
};
$('form').addEventListener('submit',async event=>{
 event.preventDefault();
 const game=currentGame();
 if(busy||!game||game.done)return;
 const word=$('word').value.trim().toLowerCase();
 const previousCount=game.attempts.length,previousDay=game.day,snapshot=captureBoard();
 busy=true;render();$('message').textContent='Checking your word…';
 try{
 const [blocked,words]=await Promise.all([loadBlocked(),loadDictionary()]);
 const rejection=submissionRejection(word,blocked,words);
 if(rejection){showSubmissionError(rejection);$('message').textContent=mode==='daily'?dailyPrompt:'';return;}
 if(mode==='endless'){
  const correct=evaluate(word,game.letters,words);
  game.attempts.push(word);
  game.correctAttempts.push(correct);
  $('word').value='';
  $('message').textContent=correct?'':'That word doesn’t fit the trail.';
  render();
  await animateAttempt(snapshot,game);
  return;
 }
 await statusRequest?.catch(()=>{});
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
 const submit=async()=>{const latest=localState();
 if(latest.day!==previousDay)throw new Error('A new trail has started. Try the new puzzle.');
 state=latest;if(state.done)return;if(!dictionary)await loadDictionary();
 const valid=evaluate(word,state.letters,dictionary);state.attempts.push(word);if(valid)state.answer=word;state.done=valid||state.attempts.length>=3;state.rankings=valid?[{word,count:1}]:[];storage.set('inordle-demo-'+state.day,JSON.stringify(state));};
 if(navigator.locks)await navigator.locks.request('inordle-demo',submit);else await submit();
 }
 if(state.rejection){render();showSubmissionError(state.rejection);$('message').textContent="Solve the puzzle before viewing today's results!";return;}
 $('word').value='';render();
 if(state.day===previousDay&&state.attempts.length>previousCount)await animateAttempt(snapshot,state);
 if(!state.done)$('message').textContent='That word doesn’t fit the trail.';
 }catch(error){$('message').textContent=error.message;}
 finally{
  busy=false;
  $('word').disabled=currentGame().done;
  $('submit').disabled=currentGame().done;
 }
});
setInterval(refreshDaily,10000);
document.addEventListener('visibilitychange',refreshDaily);
$('help').onclick=()=>{if(!$('rules').open)$('rules').showModal();};$('close-help').onclick=()=>$('rules').close();
window.addEventListener('storage',event=>{if(!live&&event.key?.startsWith('inordle-demo-'))refreshDaily()});
setInterval(()=>{
 const now=new Date();let next=Date.now()+60000;
 // Search UTC instants for the next date boundary: correct for 23/25-hour DST days.
 let low=Date.now(),high=low+26*3600000;const today=dayKey(now);
 while(high-low>1000){const mid=Math.floor((high+low)/2);if(dayKey(new Date(mid))===today)low=mid;else high=mid}next=high;
 const seconds=Math.max(0,Math.floor((next-Date.now())/1000));$('countdown').textContent=`Next trail in: ${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 if(state&&state.day!==today)refreshDaily();
},1000);
render();
initializeInstructions();
refreshDaily();

new ResizeObserver(fitWords).observe($('word-board'));
