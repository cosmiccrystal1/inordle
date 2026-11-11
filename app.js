import { config } from './config.js?v=20261109-4';
import { dayKey, demoPuzzle, evaluate, randomTrail, rankingStats, submissionRejection, startBlitzRound, blitzRemaining, endExpiredBlitz, recordBlitzSolution, formatBlitzTime } from './game.js?v=20261111-3';
import { renderBoard, fitWords, captureBoard, animateAttempt } from './board.js?v=20261111-3';
import { showSubmissionError, hideSubmissionError, initializeInstructions } from './ui.js?v=20261111-3';
const $=id=>document.getElementById(id);
const live=Boolean(config.url && config.key);
let state, dictionary, busy=false, session, pending;
let mode='daily', casualState, blitzState, blitzRound, statusRequest, practiceSubmission;
const dailyPrompt="Solve the puzzle before viewing today's results!";
const currentGame=()=>mode==='daily'?state:mode==='casual'?casualState:blitzState;

function practiceTrail(previous, maxLength){
 return {letters:randomTrail(previous?.letters,Math.random,maxLength),attempts:[],correctAttempts:[],done:false};
}

function cancelPracticeSubmission(){
 hideSubmissionError();
 practiceSubmission?.abort();
 practiceSubmission=null;
}

function renderBlitzClock(now=performance.now()){
 $('blitz-score').textContent='Points: '+(blitzRound?.points ?? 0);
 $('blitz-timer').textContent=formatBlitzTime(blitzRound?Math.ceil(blitzRemaining(blitzRound,now)/1000):120);
}

function updateBlitz(){
 if(!blitzRound||blitzRound.endedAt!==null)return;
 const now=performance.now();
 if(endExpiredBlitz(blitzRound,now)){
  if(mode==='blitz'){
   cancelPracticeSubmission();
   render();
   $('blitz-end-title').focus();
  }
 }else if(mode==='blitz')renderBlitzClock(now);
}

function startBlitz(){
 if(mode!=='blitz'||(blitzRound&&blitzRound.endedAt===null))return;
 cancelPracticeSubmission();
 blitzState=practiceTrail(blitzState,4);
 blitzRound=startBlitzRound(performance.now());
 $('word').value='';
 $('message').textContent='';
 render();
 $('word').focus({preventScroll:true});
}

let dictionaryPromise;
function loadDictionary(){
 return dictionaryPromise ||= fetch('data/words.json?v=20261111-3').then(response=>{
  if(!response.ok)throw new Error('Could not load dictionary. Please refresh.');
  return response.json();
 }).then(words=>dictionary=new Set(words)).catch(error=>{dictionaryPromise=null;throw error;});
}
let blockedPromise;
function loadBlocked(){
 return blockedPromise ||= fetch('data/blocked-words.json?v=20261111-3').then(response=>{
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
 const daily=mode==='daily',casual=mode==='casual',blitz=mode==='blitz',game=currentGame();
 const blitzEnded=blitzRound?.endedAt!=null;
 const covered=blitz&&(!blitzRound||blitzEnded);
 document.querySelector('.mode-switch').dataset.mode=mode;
 for(const name of ['daily','casual','blitz'])$(name+'-tab').setAttribute('aria-pressed',String(mode===name));
 $('daily-label').hidden=!daily;
 $('new-trail').hidden=!casual;
 $('number').hidden=!daily;
 $('daily-status').hidden=!daily;
 $('blitz-score').hidden=!blitz;
 $('blitz-timer').hidden=!blitz;
 $('blitz-overlay').hidden=!covered;
 $('blitz-start').hidden=blitzEnded;
 $('blitz-summary').hidden=!blitzEnded;
 $('puzzle-content').classList.toggle('blitz-covered',covered);
 $('puzzle-content').inert=covered;
 if(blitz){
  renderBlitzClock();
  if(blitzEnded){
   $('blitz-total-time').textContent=formatBlitzTime(Math.round((blitzRound.endedAt-blitzRound.startedAt)/1000));
   $('blitz-total-points').textContent=blitzRound.points;
   $('blitz-solutions').textContent=blitzRound.solutions;
  }
 }
 document.querySelector('.puzzle').setAttribute('aria-label',daily?"Today's puzzle":casual?'Casual puzzle':'Blitz puzzle');
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
 const wordInput=$('word');
 wordInput.disabled=game.done||covered;
 $('submit').disabled=game.done||covered||(daily?busy:Boolean(practiceSubmission));

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
 cancelPracticeSubmission();
 if(mode==='blitz'&&blitzState.answer&&blitzRound?.endedAt===null)blitzState=practiceTrail(blitzState,4);
 mode=next;
 if(mode==='casual'&&!casualState)casualState=practiceTrail();
 if(mode==='blitz'&&!blitzState)blitzState=practiceTrail(undefined,4);
 $('word').value='';
 $('message').textContent=mode==='daily'?dailyPrompt:'';
 if(mode==='blitz')updateBlitz();
 render();
 if(mode==='casual'||(mode==='blitz'&&blitzRound?.endedAt===null))$('word').focus({preventScroll:true});
 if(mode==='blitz'&&!blitzRound)$('blitz-start').focus({preventScroll:true});
 if(mode!=='daily')Promise.all([loadBlocked(),loadDictionary()]).catch(()=>{});
 refreshDaily();
}

for(const name of ['daily','casual','blitz'])$(name+'-tab').onclick=()=>selectMode(name);
function advanceCasual(){
 if(mode!=='casual')return;
 cancelPracticeSubmission();
 casualState=practiceTrail(casualState);
 $('word').value='';
 $('message').textContent='';
 render();
 $('word').focus({preventScroll:true});
}
$('new-trail').onclick=advanceCasual;
$('blitz-start').onclick=startBlitz;
$('blitz-retry').onclick=startBlitz;
document.addEventListener('keydown',event=>{
 if(mode==='daily'||event.key!==' '||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||$('rules').open)return;
 if(event.target instanceof HTMLElement && event.target.closest('button,a') && !['new-trail','blitz-start','blitz-retry'].includes(event.target.id))return;
 event.preventDefault();
 if(event.repeat)return;
 if(mode==='casual')advanceCasual();
 else startBlitz();
});

async function submitPractice(game,word,originalInput){
 if(practiceSubmission)return;
 const blitz=mode==='blitz';
 if(blitz&&(!blitzRound||!blitzRemaining(blitzRound,performance.now())))return;
 const controller=new AbortController(),{signal}=controller;
 practiceSubmission=controller;
 $('submit').disabled=true;
 $('word').focus({preventScroll:true});
 try{
  const [blocked,words]=await Promise.all([loadBlocked(),loadDictionary()]);
  if(signal.aborted)return;
  if(blitz&&!blitzRemaining(blitzRound,performance.now())){updateBlitz();return;}
  const rejection=submissionRejection(word,blocked,words);
  if(rejection){showSubmissionError(rejection);return;}
  if(!blitz&&game.attempts.includes(word)){showSubmissionError('Already submitted');return;}
  const correct=evaluate(word,game.letters,words);
  if(blitz&&correct&&!recordBlitzSolution(blitzRound,word,game.letters,performance.now())){updateBlitz();return;}
  hideSubmissionError();
  const snapshot=captureBoard();
  game.attempts.push(word);
  game.correctAttempts.push(correct);
  if(blitz&&correct)game.answer=word;
  if($('word').value===originalInput)$('word').value='';
  $('message').textContent=correct?'':'That word doesn’t fit the trail.';
  render();
  await animateAttempt(snapshot,signal);
  if(signal.aborted)return;
  if(blitz&&correct){
   updateBlitz();
   if(signal.aborted)return;
   blitzState=practiceTrail(game,4);
   render();
  }
 }catch(error){
  if(!signal.aborted)$('message').textContent=error.message;
 }finally{
  if(practiceSubmission===controller){
   practiceSubmission=null;
   $('submit').disabled=false;
  }
 }
}
$('form').addEventListener('submit',async event=>{
 event.preventDefault();
 const game=currentGame();
 if(busy||!game||game.done)return;
 const originalInput=$('word').value;
 const word=originalInput.trim().toLowerCase();
 if(mode!=='daily'){await submitPractice(game,word,originalInput);return;}
 const previousCount=game.attempts.length,previousDay=game.day,snapshot=captureBoard();
 busy=true;render();$('message').textContent='Checking your word…';
 $('word').focus({preventScroll:true});
 try{
 const [blocked,words]=await Promise.all([loadBlocked(),loadDictionary()]);
 const rejection=submissionRejection(word,blocked,words);
 if(rejection){showSubmissionError(rejection);$('message').textContent=dailyPrompt;return;}
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
 if($('word').value===originalInput)$('word').value='';
 render();
 if(state.day===previousDay&&state.attempts.length>previousCount)await animateAttempt(snapshot);
 if(!state.done)$('message').textContent='That word doesn’t fit the trail.';
 }catch(error){$('message').textContent=error.message;}
 finally{
  busy=false;
  $('word').disabled=currentGame().done;
  $('submit').disabled=currentGame().done;
 }
});
setInterval(refreshDaily,10000);
setInterval(updateBlitz,100);
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
