import { letterAlignment } from './game.js?v=20261111-2';
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function originalTile(letter){
 const tile=document.createElement('span');tile.className='tile';
 const face=document.createElement('span');face.className='tile-letter';face.textContent=letter;
 tile.append(face);return tile;
}
export function renderBoard(state){
 document.getElementById('tiles').replaceChildren(...[...state.letters].map(originalTile));
 const list=document.getElementById('attempt-words');
 list.replaceChildren(...state.attempts.map((word,index)=>{
  const row=document.createElement('li');
  const correct=state.correctAttempts ? state.correctAttempts[index] : Boolean(state.answer) && index === state.attempts.length - 1;
  row.className='word-row'+(correct?' solved-word':' incorrect-word');
  row.setAttribute('aria-label',`${correct?'Correct':'Incorrect'} attempt ${index+1}: ${word}`);
  for(const letter of letterAlignment(word,state.letters)){
   const tile=document.createElement('span');tile.className='word-tile is-'+letter.kind;
   const face=document.createElement('span');face.className='word-letter';face.textContent=letter.letter;tile.append(face);if(letter.trailIndex!==null)tile.dataset.trailIndex=letter.trailIndex;
   if(!correct)tile.style.setProperty('--strike-delay', (180 * row.children.length / word.length)+'ms');
   row.append(tile);
  }
  return row;
 }));
 fitWords();
}
export function fitWords(){
 const board=document.getElementById('word-board');if(!board)return;
 const width=board.clientWidth;
 for(const row of board.querySelectorAll('.word-row')){
  const size=Math.max(18,Math.min(44,(width-4*(row.children.length-1))/row.children.length));
  row.style.setProperty('--word-size',size+'px');
 }
}
export function captureBoard(){
 return {height:document.querySelector('.puzzle').getBoundingClientRect().height,
  origins:[...document.querySelectorAll('#tiles .tile')].map(e=>e.getBoundingClientRect())};
}
async function finished(animation){try{await animation.finished;}catch{}}
// Sample the actual easeInCirc curve so timing does not depend on a CSS approximation.
export function circInFrames(){return Array.from({length:41},(_,i)=>{
 const t=i/40,eased=1-Math.sqrt(1-t*t);
 return {offset:t,opacity:eased,transform:`translateY(${(1-eased)*12}px) scale(${.6+.4*eased})`};
});}
export async function animateAttempt(snapshot){
 const row=document.querySelector('#attempt-words .word-row:last-child');
 if(!row||reducedMotion()||typeof document.querySelector('.puzzle').animate!=='function')return;
 const puzzle=document.querySelector('.puzzle'),correct=row.classList.contains('solved-word');
 row.style.opacity='0';
 const height=puzzle.getBoundingClientRect().height;
 const expansion=puzzle.animate([{height:snapshot.height+'px'},{height:height+'px'}],{duration:200,easing:'ease-out'});
 await finished(expansion);
 if(!correct){
  row.classList.add('draw-strike');
  await finished(row.animate([{opacity:0},{opacity:1}],{duration:330,easing:'ease-out',fill:'forwards'}));
  row.style.opacity='1';return;
 }
 row.style.opacity='1';
 const animations=[];
 for(const tile of row.children){
  if(tile.dataset.trailIndex!==undefined){
   const source=snapshot.origins[Number(tile.dataset.trailIndex)],target=tile.getBoundingClientRect();
   if(source)animations.push(tile.animate([
    {transform:`translate(${source.left+source.width/2-target.left-target.width/2}px, ${source.top+source.height/2-target.top-target.height/2}px) scale(${source.width/target.width},${source.height/target.height})`},
    {transform:'translate(0,0)'}
   ],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'}));
  }else animations.push(tile.animate(circInFrames(),{duration:650,delay:100,fill:'both',easing:'linear'}));
 }
 await Promise.all(animations.map(finished));
 row.animate([{filter:'brightness(1.55)'},{filter:'brightness(1)'}],{duration:360,easing:'ease-out'});
}
