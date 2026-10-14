// Transient Turnstile token only. Shared DW hostname policy; distinct AI action.
let scriptPromise;
function load(){
 if(globalThis.turnstile)return Promise.resolve(globalThis.turnstile);
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
  const timer=setTimeout(()=>{script.remove();reject(Error('TURNSTILE_UNAVAILABLE'));},10000);
  script.onload=()=>{clearTimeout(timer);globalThis.turnstile?resolve(globalThis.turnstile):reject(Error('TURNSTILE_UNAVAILABLE'));};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('TURNSTILE_UNAVAILABLE'));};document.head.append(script);
 }).catch(e=>{scriptPromise=null;throw e;});return scriptPromise;
}
export function createHumanCheck({container,onChange=()=>{}}){
 let token='',widget=null,api=null,generation=0,key=null,required=false;
 const clear=()=>{token='';onChange();};
 function remove(){generation++;token='';if(widget!==null&&api){try{api.remove(widget);}catch{}}widget=null;key=null;container.replaceChildren();}
 async function configure({required:needs=false,sitekey,active=false}={}){
  required=needs===true;container.hidden=!required||!active;
  if(!required||!active){remove();onChange();return;}
  if(typeof sitekey!=='string'||!/^0x[A-Za-z0-9_-]+$/.test(sitekey)){remove();onChange('TURNSTILE_UNAVAILABLE');return;}
  if(widget!==null&&key===sitekey)return;
  remove();key=sitekey;const own=generation;
  try{api=await load();if(own!==generation)return;widget=api.render(container,{sitekey,action:'dw_ai_submit',size:'flexible',callback:value=>{if(own!==generation)return;token=typeof value==='string'?value:'';onChange();},'expired-callback':()=>{if(own===generation)clear();},'error-callback':()=>{if(own===generation){clear();onChange('TURNSTILE_UNAVAILABLE');}}});}catch{if(own===generation)onChange('TURNSTILE_UNAVAILABLE');}
 }
 function consume(){token='';if(widget!==null&&api){try{api.reset(widget);}catch{}}onChange();}
 return Object.freeze({configure,consume,remove,token:()=>token,ready:()=>!required||!!token});
}
