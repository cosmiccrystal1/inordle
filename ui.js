export const ERROR_LIFETIME=3000;
let hideTimer,toastAnimation,shakeAnimation;
export function hideSubmissionError(){
 const toast=document.getElementById('error-toast');
 clearTimeout(hideTimer);
 toastAnimation?.cancel();
 shakeAnimation?.cancel();
 toast.hidden=true;
 toast.textContent='';
}
export function showSubmissionError(message){
 const toast=document.getElementById('error-toast'),prompt=document.getElementById('word');
 hideSubmissionError();
 toast.textContent=message;toast.hidden=false;
 if(typeof toast.animate==='function')toastAnimation=toast.animate([
  {opacity:1,offset:0},{opacity:1,offset:.85},{opacity:0,offset:1}
 ],{duration:ERROR_LIFETIME,easing:'linear',fill:'forwards'});
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&typeof prompt.animate==='function')
  shakeAnimation=prompt.animate([
   {transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},
   {transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}
  ],{duration:340,easing:'ease-in-out'});
 hideTimer=setTimeout(hideSubmissionError,ERROR_LIFETIME);
}
export function initializeInstructions(){
 const dialog=document.getElementById('rules');
 const markSeen=()=>{try{localStorage.setItem('inordle-instructions-seen','1');}catch{}};
 dialog.addEventListener('close',markSeen);
 let seen=false;try{seen=localStorage.getItem('inordle-instructions-seen')==='1';}catch{}
 if(!seen&&!dialog.open)dialog.showModal();
}
