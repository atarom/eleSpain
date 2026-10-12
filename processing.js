(()=>{
const $=id=>document.getElementById(id);
const overlay=$('processingOverlay');
const cancel=$('processingCancel');
const qaCancel=$('cancel');
const itemCancel=$('cancelItem');
const message=$('processingMessage');
const elapsed=$('processingElapsed');
let active=null;
let started=0;
let timer=null;
let previousFocus=null;
function updateElapsed(){const seconds=Math.floor((performance.now()-started)/1000);elapsed.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function sync(){
const mode=!qaCancel.hidden?'qa':!itemCancel.hidden?'item':null;
if(!mode){
if(!active)return;
const completedMode=active;
active=null;
overlay.hidden=true;
clearInterval(timer);
timer=null;
const fallback=$(completedMode==='qa'?'analyze':'analyzeItem');
const focusTarget=previousFocus?.isConnected&&!previousFocus.disabled&&previousFocus!==document.body?previousFocus:fallback;
if(focusTarget?.isConnected&&!focusTarget.disabled)focusTarget.focus();
previousFocus=null;
return;
}
if(active!==mode){
active=mode;
started=performance.now();
previousFocus=document.activeElement;
$('processingTitle').textContent=mode==='qa'?'Analizando zona visible':'Consultando elemento OSM';
$('processingSource').textContent=`Fuente: ${$('source').selectedOptions[0]?.textContent||$('source').value}`;
overlay.hidden=false;
cancel.focus();
updateElapsed();
clearInterval(timer);
timer=setInterval(updateElapsed,1000);
}
const state=(mode==='qa'?$('status'):$('itemStatus')).textContent;
if(message.textContent!==state)message.textContent=state;
}
cancel.addEventListener('click',()=>{(active==='qa'?qaCancel:itemCancel).click();});
document.addEventListener('keydown',event=>{
if(!active)return;
if(event.key==='Tab'){event.preventDefault();cancel.focus();}
if(event.key==='Escape'){event.preventDefault();cancel.click();}
if(event.key==='Tab'||event.key==='Escape')event.stopImmediatePropagation();
},true);
const observer=new MutationObserver(sync);
for(const button of [qaCancel,itemCancel])observer.observe(button,{attributes:true,attributeFilter:['hidden']});
for(const id of ['status','itemStatus'])observer.observe($(id),{childList:true,characterData:true,subtree:true});
sync();
})();
