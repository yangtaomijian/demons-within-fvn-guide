import {CONFIG} from './config.mjs';
async function mount(){
 if(!document.querySelector('.dw-search-launcher'))await new Promise(resolve=>{const observer=new MutationObserver(()=>{if(document.querySelector('.dw-search-launcher')){observer.disconnect();resolve();}});observer.observe(document.body,{childList:true,subtree:true});});
 const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./panel.css',import.meta.url).href;document.head.append(style);
 await import('./panel.mjs');
 if(!CONFIG.ownerBootstrapOnly)await import('./google-gis.mjs');
}
if(CONFIG.enabled)mount().catch(()=>{});
