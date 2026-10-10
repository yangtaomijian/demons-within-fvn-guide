'use strict';
// Actual local source, synthetic requests only. No production API or visitor values in evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { chromium, webkit } = require('playwright');
const assets = name => fs.readFileSync(path.join(__dirname, '../assets', name), 'utf8');
const source = name => assets(`dw-discussion-${name}.html`).match(/<script>([\s\S]*?)<\/script>/)[1];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const types = ['like','heart','smile','celebrate','thinking'];
const counts = () => Object.fromEntries(types.map(type => [type, 0]));
const record = n => ({ commentId:id(n), counts:{...counts(),like:3}, selected:[],canReact:true });
const evidence = process.env.DISCUSSION_EVIDENCE_DIR || '/tmp';
const panel = n => `.dw-discussion-reactions[data-comment-id="${id(n)}"]`;
const plus = n => `${panel(n)} .dw-discussion-reaction-add`;
const emoji = (n,type,menu=false) => `${panel(n)} .dw-discussion-reaction-${menu?'menu':'counts'} [data-reaction-type="${type}"]`;
async function transportCheck() {
  let status=200, data={ok:true,reactions:[record(1)]}, network=false;const sent=[];
  const ctx={URL,AbortController,setTimeout,clearTimeout,window:{},location:{hostname:'dw-staging.carambi.com'},document:{querySelector:s=>({content:s.includes('environment')?'staging':s.includes('sitekey')?'0xFixture':'https://discussion-staging.carambi.com'})},fetch:async(url,options)=>{sent.push({url,options});if(network)throw Error('synthetic');return {status,json:async()=>data};}};
  vm.createContext(ctx);vm.runInContext(source('remote'),ctx);const api=ctx.window.__dwDiscussionRemoteTransport;
  const request={pageKey:'guide.choices',locale:'en',commentIds:[id(1)],visitorId:'a'.repeat(64)};
  assert.equal((await api.readReactions(request)).reactions.length,1);
  assert.equal(sent[0].url,'https://discussion-staging.carambi.com/v1/discussion/reactions/read');
  assert.deepEqual(JSON.parse(sent[0].options.body),request);assert.equal(sent[0].options.credentials,'omit');assert.equal(sent[0].options.referrerPolicy,'no-referrer');
  await api.readReactions({...request,visitorId:undefined});assert(!Object.hasOwn(JSON.parse(sent.at(-1).options.body),'visitorId'));
  for(const bad of [{...request,commentIds:Array(51).fill(id(1))},{...request,commentIds:[id(1),id(1)]},{...request,commentIds:['bad']},{...request,visitorId:'weak'}])await assert.rejects(()=>api.readReactions(bad));
  for(const bad of [{ok:true,reactions:[]},{ok:true,reactions:[{...record(1),counts:{...counts(),like:-1}}]},{ok:true,reactions:[{...record(1),selected:['bad']}]},{ok:true,reactions:[record(2)]},{ok:false,reactions:[record(1)]}]){data=bad;await assert.rejects(()=>api.readReactions(request));}
  const write={pageKey:'guide.choices',locale:'en',commentId:id(1),type:'heart',visitorId:'a'.repeat(64),intent:'add'};
  data={ok:true,reaction:record(1)};await api.setReaction(write);assert.deepEqual(JSON.parse(sent.at(-1).options.body),write);
  for(const bad of [{...write,type:'laugh'},{...write,intent:'toggle'},{...write,visitorId:undefined}])await assert.rejects(()=>api.setReaction(bad));
  for(const code of [201,202,408,500]){status=code;await assert.rejects(()=>api.setReaction(write),e=>e.outcomeUnknown===true);}
  for(const code of [400,403,409,423,429]){status=code;data={ok:false,code:code===429?'RATE_LIMITED':'VALIDATION_FAILED'};await assert.rejects(()=>api.setReaction(write),e=>e.outcomeUnknown===false&&e.httpStatus===code);}
  status=200;data={ok:true,reaction:{...record(1),counts:{...counts(),like:1.5}}};await assert.rejects(()=>api.setReaction(write),e=>e.outcomeUnknown===true);
  network=true;await assert.rejects(()=>api.setReaction(write),e=>e.outcomeUnknown===true);
  for (const bodyPending of [false,true]) {
    let expire, cleared=false, signal;
    ctx.setTimeout=fn=>{expire=fn;return 1;}; ctx.clearTimeout=()=>{cleared=true;};
    ctx.fetch=async(url,options)=>{signal=options.signal;if(bodyPending)return{status:200,json:()=>new Promise(()=>{})};return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));};
    const pending=api.setReaction(write); await Promise.resolve();expire();
    await assert.rejects(()=>pending,e=>e.outcomeUnknown===true);assert(signal.aborted);assert(cleared);
  }
  console.log('dw 2C transport: PASS body-only identity, explicit intent, statuses and strict schemas');
}
async function open(browser,locale,width,storageBlocked=false,missing=false){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<768});page.__errors=[];page.on('pageerror',e=>page.__errors.push(e.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1'||!route.request().isNavigationRequest())return route.abort();
    return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>:root{--dw-text:#222;--dw-text-soft:#666;--dw-heading:#222;--dw-border:#ddd;--dw-border-strong:#999;--dw-surface:#fff;--dw-surface-soft:#f7f7f7;--dw-primary:#663d18;--dw-primary-soft:#f4ebdc}body{margin:0}*{box-sizing:border-box}main{height:350px} ${assets('dw-discussion.css')}</style></head><body><div id="quarto-content"><main id="quarto-document-content"><section id="body-section"><h2>Guide</h2></section></main></div><script>${source('runtime')}</script><script>${source('ui')}</script></body></html>`});
  });
  await page.addInitScript(({storageBlocked,missing})=>{
    const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,types=['like','heart','smile','celebrate','thinking'];
    if(storageBlocked){Storage.prototype.getItem=Storage.prototype.setItem=function(){throw Error('disabled');};}
    window.reactReads=[];window.reactWrites=[];window.commentPosts=[];window.reports=[];window.readMode='ok';window.commentReadFails=false;window.writeMode='ok';window.locked=false;window.currentEligibility=true;window.rootStatus='published';window.many=false;window.slowWrite=false;window.delayRead=false;window.lateReads=[];window.secondIdentity=false;
    const store=new Map();window.serverReactions=store;
    const row=(n,parent=null,version='Public 14.6',scope='version',status='published')=>({id:id(n),parentCommentId:parent===null?null:id(parent),replyToCommentId:n===6?id(5):null,replyTo:n===6?{id:id(5),status:'deleted',displayName:null,authorKind:null}:null,status,displayName:window.longName?'LongName'.repeat(16):'River',authorKind:'guest',body:status==='published'?`Body ${n} <img onerror=alert(1)>`:null,guideVersion:version,discussionScope:scope,createdAt:'2026-10-10T08:00:00Z',pageHash:null,canReply:status==='published'&&!window.locked&&n!==99,replies:[]});
    const root=(n,version='Public 14.6',scope='version')=>{const r=row(n,null,version,scope,n===1?window.rootStatus:'published');if(n===1)r.replies=[row(2,1),row(3,1),row(4,1,version,scope,'hidden'),row(5,1,version,scope,'deleted'),row(6,1)];return r;};
    function state(n,visitor){if(!store.has(n))store.set(n,{counts:{like:3,heart:2,smile:0,celebrate:0,thinking:0},selected:[]});const r=store.get(n);return{commentId:n,counts:{...r.counts},selected:visitor&&!window.secondIdentity?[...r.selected]:[],canReact:!window.locked&&![id(3),id(4),id(5)].includes(n)&&(n!==id(1)||window.currentEligibility)};}
    const transport={fixtureCanWrite:true,turnstileSitekey:'0xFixture',async readDiscussion(req){if(window.commentReadFails)throw Error('synthetic comment read failure');return{ok:true,thread:{status:window.locked?'locked':'open'},currentVersion:{guideVersion:req.guideVersion,comments:req.guideVersion==='Public 14.5'?[root(10,'Public 14.5')]:window.many?Array.from({length:60},(_,i)=>root(100+i)):[root(1),root(99)],nextCursor:null},persistent:{comments:[root(20,'Public 14.5','persistent')],nextCursor:null},earlierVersions:[{guideVersion:'Public 14.5',commentCount:1}]};},async postComment(input){window.commentPosts.push({...input});return{ok:true,httpStatus:201,commentId:id(800)};},async sendFeedback(){return{ok:true,httpStatus:202};},async readReactions(input){window.reactReads.push({...input});const response={ok:true,reactions:input.commentIds.map(n=>state(n,input.visitorId))};if(window.delayRead){window.delayRead=false;await new Promise(resolve=>window.lateReads.push(resolve));}if(window.readMode==='fail')throw Error('synthetic reaction read failure');if(window.readMode==='schema')return{ok:true,reactions:[]};return response;},async setReaction(input){window.reactWrites.push({...input});const original=state(input.commentId,input.visitorId);if(window.slowWrite)await new Promise(resolve=>window.releaseWrite=resolve);if(window.writeMode==='429'){const e=Error('rate');e.httpStatus=429;e.outcomeUnknown=false;throw e;}const r=store.get(input.commentId);const selected=r.selected.includes(input.type);if(input.intent==='add'&&!selected){r.selected.push(input.type);r.counts[input.type]++;}if(input.intent==='remove'&&selected){r.selected=r.selected.filter(t=>t!==input.type);r.counts[input.type]--;}if(window.writeMode==='unknown'||window.writeMode==='unknownReadFail'){if(window.writeMode==='unknownReadFail')window.readMode='fail';const e=Error('lost response');e.outcomeUnknown=true;throw e;}return{ok:true,reaction:{...state(input.commentId,input.visitorId),canReact:original.canReact}};}};
    if(missing){delete transport.readReactions;delete transport.setReaction;}
    Object.defineProperty(window,'__dwDiscussionFixtureTransport',{get:()=>transport,set(){}});
    Object.defineProperty(window,'__dwFeedbackDialog',{get:()=>({openReport(n){window.reports.push(n);}}),set(){}});
    window.turnstile={render(slot,options){queueMicrotask(()=>options.callback('synthetic'));return 1;},remove(){}};
  },{storageBlocked,missing});
  await page.goto(`http://127.0.0.1:8862/${locale==='en'?'en/':''}guide/choices.html`);
  await page.waitForFunction(()=>document.querySelector('.dw-discussion-comments')?.getAttribute('aria-busy')==='false');
  if(!missing)await page.waitForFunction(()=>document.querySelectorAll('.dw-discussion-reactions').length>0&&[...document.querySelectorAll('.dw-discussion-reactions')].every(p=>p.getAttribute('aria-busy')==='false'&&p.querySelector('.dw-discussion-reaction-counts [data-reaction-type]')));
  return page;
}
async function readReady(page,n=1){await page.waitForFunction(s=>!document.querySelector(s)?.disabled,plus(n));}
async function refresh(page){await page.locator('.dw-discussion-refresh').click();await page.waitForFunction(()=>document.querySelector('.dw-discussion-comments').getAttribute('aria-busy')==='false');}
async function choose(page,n,type){await page.locator(plus(n)).click();await page.locator(emoji(n,type,true)).click();await page.waitForFunction(s=>document.querySelector(s)?.getAttribute('aria-busy')==='false',panel(n));}
async function run(name,engine,options){const browser=await engine.launch({headless:true,...options});let cases=0;try{for(const locale of ['zh-CN','en'])for(const width of [390,1440]){
  const page=await open(browser,locale,width);await readReady(page);
  assert.equal(await page.locator(`${panel(1)} .dw-discussion-reaction-counts [data-reaction-type]`).count(),2);assert.equal(await page.locator('.dw-discussion-body img').count(),0);
  assert(await page.locator(plus(3)).isDisabled());assert(await page.locator(`#dw-comment-${id(3)} .dw-discussion-reply-action`).isEnabled());assert.equal(await page.locator(panel(4)).count(),0);assert.equal(await page.locator(panel(5)).count(),0);assert.equal(await page.locator(`#dw-comment-${id(99)} .dw-discussion-reply-action`).count(),0);assert(await page.locator(plus(99)).isEnabled());cases++;
  // Toolbar layout is measured independently from reaction state and transport.
  for (const mode of ['empty','five','long']) {
    await page.evaluate(({mode,id})=>{
      const entry=window.serverReactions.get(id);entry.counts=Object.fromEntries(['like','heart','smile','celebrate','thinking'].map(type=>[type,mode==='empty'?0:mode==='long'?999999999999999:1]));entry.selected=mode==='empty'?[]:['heart'];window.longName=mode==='long';
    },{mode,id:id(1)});await refresh(page);await readReady(page);
    const toolbar=page.locator(`#dw-comment-${id(1)} > .dw-discussion-actions`);
    assert(await page.locator(panel(1)).evaluate(n=>n.parentElement.classList.contains('dw-discussion-actions')));
    const bounds=await toolbar.evaluate(n=>({height:n.getBoundingClientRect().height,overflow:n.scrollWidth>n.clientWidth}));assert(!bounds.overflow);
    const targets=await toolbar.locator('button').evaluateAll(nodes=>nodes.filter(n=>!n.closest('[hidden]')).map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
    assert(targets.every(n=>n.height>=(width<768?44:36)&&n.width>=(width<768?44:36)));
    if(mode==='empty'||width===1440&&mode==='five') {
      const y=await toolbar.locator(':scope > button, .dw-discussion-reaction-counts > button').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().top)));
      assert.equal(new Set(y).size,1,'empty/five desktop share a toolbar row');
    }
    await page.locator(plus(1)).click();
    assert(Math.abs((await toolbar.boundingBox()).height-bounds.height)<1,'menu never increases toolbar height');
    const menu=page.locator(`${panel(1)} .dw-discussion-reaction-menu`),rect=await menu.boundingBox();assert(rect.x>=7&&rect.y>=7&&rect.x+rect.width<=width-7&&rect.y+rect.height<=900-7);
    if(mode==='long'&&width<768) {
      await page.evaluate(()=>{for(const [key,value]of Object.entries({width:240,height:350,offsetLeft:60,offsetTop:80}))Object.defineProperty(visualViewport,key,{configurable:true,value});dispatchEvent(new Event('resize'));});
      const clipped=await menu.boundingBox();assert(clipped.x>=67&&clipped.y>=87&&clipped.x+clipped.width<=293&&clipped.y+clipped.height<=423,'menu fits the narrower visible viewport');
    }
    if(mode==='long'&&width<768) {
      await toolbar.evaluate(n=>{const t=n.getBoundingClientRect();Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:t.top-48});Object.defineProperty(visualViewport,'height',{configurable:true,value:t.height+124});dispatchEvent(new Event('resize'));});
      assert(await menu.evaluate(n=>parseFloat(n.style.maxHeight)>=58&&n.scrollHeight>n.clientHeight),'short visible viewport uses a scrollable chooser');
    }
    assert(await toolbar.evaluate(n=>{
      const m=n.querySelector('.dw-discussion-reaction-menu').getBoundingClientRect();
      return [...n.querySelectorAll('button')].filter(b=>!b.closest('.dw-discussion-reaction-menu')&&!b.closest('[hidden]')).every(b=>{
        const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
        const separate=m.right<=r.left||m.left>=r.right||m.bottom<=r.top||m.top>=r.bottom;
        const visible=x>=0&&x<innerWidth&&y>=0&&y<innerHeight;
        return separate&&(!visible||document.elementFromPoint(x,y)===b);
      });
    }),'floating menu leaves all toolbar controls unobstructed');
    const target=page.locator(emoji(1,'thinking',true));await target.scrollIntoViewIfNeeded();const point=await target.boundingBox();
    assert(await target.evaluate(n=>{const b=n.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===n;}));
    if(width<768)await page.tap(emoji(1,'thinking',true));else await page.mouse.click(point.x+point.width/2,point.y+point.height/2);
    await readReady(page);if(mode==='long'&&width<768)await page.evaluate(()=>{for(const key of ['width','height','offsetLeft','offsetTop'])delete visualViewport[key];dispatchEvent(new Event('resize'));});assert.equal(await page.locator(plus(1)).getAttribute('aria-expanded'),'false');
    await page.locator(plus(1)).click();await page.keyboard.press('Escape');assert(await page.locator(plus(1)).evaluate(n=>document.activeElement===n));
    await page.locator(`#dw-comment-${id(1)}`).screenshot({path:path.join(evidence,`${name}-${locale}-${width}-toolbar-${mode}.png`)});cases++;
  }
  if(process.env.DISCUSSION_TOOLBAR_ONLY==='1'){await page.close();continue;}
  await page.evaluate(id=>{window.longName=false;window.serverReactions.set(id,{counts:{like:3,heart:2,smile:0,celebrate:0,thinking:0},selected:[]});},id(1));await refresh(page);await readReady(page);await page.evaluate(()=>{window.reactWrites=[];});
  await page.locator(plus(1)).focus();await page.keyboard.press('Enter');await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.reactionType),'thinking');await page.keyboard.press('Escape');assert(await page.locator(plus(1)).evaluate(n=>n===document.activeElement));assert.equal(await page.locator(plus(1)).getAttribute('aria-expanded'),'false');cases++;
  for(const type of types){await choose(page,1,type);assert.equal(await page.locator(emoji(1,type)).getAttribute('aria-pressed'),'true');assert((await page.locator(emoji(1,type)).innerText()).includes('✓'));}assert.equal(await page.evaluate(()=>window.reactWrites.length),5);cases++;
  await page.locator(plus(1)).focus();await page.keyboard.press('Enter');await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await readReady(page);
  assert.equal(await page.locator(emoji(1,'smile')).count(),0);assert(await page.locator(plus(1)).evaluate(n=>n===document.activeElement));
  await page.locator(plus(1)).focus();await page.keyboard.press('Enter');await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await readReady(page);
  assert.equal(await page.locator(emoji(1,'smile')).getAttribute('aria-pressed'),'true');assert(await page.locator(plus(1)).evaluate(n=>n===document.activeElement));
  await page.locator(emoji(1,'smile')).focus();await page.keyboard.press('Enter');await readReady(page);assert.equal(await page.locator(emoji(1,'smile')).count(),0);assert(await page.locator(plus(1)).evaluate(n=>n===document.activeElement));cases++;
  await page.locator(emoji(1,'like')).click();await readReady(page);assert.equal(await page.locator(emoji(1,'like')).getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>window.reactWrites.at(-1).intent),'remove');cases++;
  await page.locator(`#dw-comment-${id(2)} .dw-discussion-reply-action`).click();await page.locator('#dw-discussion-new-body').fill('Preserved reaction draft');await page.locator('#dw-discussion-name').fill('Draft name');
  await page.evaluate(()=>{document.querySelector('#dw-discussion-new-body').focus();document.querySelector('#dw-discussion-new-body').setSelectionRange(3,9);window.startScroll=scrollY;window.composerNode=document.querySelector('.dw-discussion-composer');});
  await page.evaluate(s=>document.querySelector(s).click(),emoji(2,'heart'));await readReady(page,2);assert.equal(await page.locator('#dw-discussion-new-body').inputValue(),'Preserved reaction draft');assert(await page.evaluate(()=>window.composerNode===document.querySelector('.dw-discussion-composer')));assert(Math.abs(await page.evaluate(()=>scrollY-window.startScroll))<3);assert.deepEqual(await page.locator('#dw-discussion-new-body').evaluate(n=>[document.activeElement===n,n.selectionStart,n.selectionEnd]),[true,3,9]);cases++;
  await page.evaluate(()=>{window.slowWrite=true;});await page.locator(emoji(1,'heart')).click();await page.waitForFunction(()=>window.releaseWrite);const before=await page.evaluate(()=>window.reactWrites.length);await refresh(page);assert(await page.locator(plus(1)).isDisabled());await page.evaluate(()=>{document.querySelector('.dw-discussion-reaction-add').click();document.querySelector('#dw-discussion-new-body').focus();window.currentEligibility=false;window.slowWrite=false;window.releaseWrite();});await page.waitForFunction(s=>document.querySelector(s).getAttribute('aria-busy')==='false',panel(1));assert(await page.locator(plus(1)).isDisabled());assert.equal(await page.evaluate(()=>window.reactWrites.length),before);assert(await page.locator('#dw-discussion-new-body').evaluate(n=>document.activeElement===n));await page.evaluate(()=>{window.currentEligibility=true;});await refresh(page);await readReady(page);cases++;
  await page.evaluate(()=>{window.writeMode='unknownReadFail';});await page.locator(emoji(1,'heart')).click();await page.locator(`${panel(1)} .dw-discussion-reaction-retry`).waitFor();assert(await page.locator(plus(1)).isDisabled());const uncertain=await page.evaluate(()=>window.reactWrites.length);await page.evaluate(()=>{window.readMode='ok';window.writeMode='ok';});await page.locator(`${panel(1)} .dw-discussion-reaction-retry`).click();await readReady(page);assert.equal(await page.evaluate(()=>window.reactWrites.length),uncertain);assert.equal(await page.locator(emoji(1,'heart')).getAttribute('aria-pressed'),'true');cases++;
  await page.evaluate(()=>{window.writeMode='429';});await page.locator(emoji(1,'heart')).click();await readReady(page);assert((await page.locator(`${panel(1)} .dw-discussion-reaction-status`).innerText()).includes(locale==='en'?'Too many':'过于频繁'));assert.equal(await page.locator(emoji(1,'heart')).getAttribute('aria-pressed'),'true');await page.evaluate(()=>{window.writeMode='ok';});cases++;
  await page.evaluate(()=>{window.writeMode='429';window.readMode='fail';});await page.locator(emoji(1,'heart')).click();await page.locator(`${panel(1)} .dw-discussion-reaction-retry`).waitFor();assert(await page.locator(plus(1)).isDisabled());assert((await page.locator(`${panel(1)} .dw-discussion-reaction-status`).innerText()).includes(locale==='en'?'Too many':'过于频繁'));
  await page.evaluate(()=>{window.writeMode='ok';window.readMode='ok';});await page.locator(`${panel(1)} .dw-discussion-reaction-retry`).click();await readReady(page);cases++;
  await page.evaluate(()=>{window.readMode='schema';});await refresh(page);await page.locator(`${panel(1)} .dw-discussion-reaction-retry`).waitFor();assert(await page.locator('.dw-discussion-comments').isVisible());assert(await page.locator('.dw-discussion-add').isEnabled());assert.equal(await page.locator('#dw-discussion-new-body').inputValue(),'Preserved reaction draft');await page.evaluate(()=>{window.readMode='ok';});await page.locator(`${panel(1)} .dw-discussion-reaction-retry`).click();await readReady(page);cases++;
  await page.evaluate(()=>{window.delayRead=true;});await refresh(page);await page.waitForFunction(()=>window.lateReads.length);await page.locator('.dw-discussion-version-buttons button').filter({hasText:'Public 14.5'}).click();await readReady(page,10);await page.evaluate(()=>{window.lateReads.shift()();});assert.equal(await page.locator(panel(1)).count(),0);await choose(page,10,'smile');await choose(page,20,'celebrate');assert.equal(await page.locator('.dw-discussion-version-buttons [aria-pressed=true]').innerText(),'Public 14.5 · 1 '+(locale==='en'?'comment':'条评论'));cases++;
  await page.locator('.dw-discussion-version-buttons button').first().click();await readReady(page);await page.evaluate(()=>{localStorage.setItem('carambi:demons-within:reaction-visitor:v1','b'.repeat(64));window.secondIdentity=true;});await refresh(page);await readReady(page);assert.equal(await page.locator(emoji(1,'heart')).getAttribute('aria-pressed'),'false');assert(await page.evaluate(()=>window.reactReads.at(-1).visitorId==='b'.repeat(64)));cases++;
  await page.evaluate(()=>{window.commentReadFails=true;window.serverReactions.get('00000000-0000-4000-8000-000000000001').counts.like=71;});await refresh(page);
  await page.waitForFunction(s=>document.querySelector(s)?.textContent.includes('71'),emoji(1,'like'));await readReady(page);
  assert.equal(await page.locator('#dw-discussion-new-body').inputValue(),'Preserved reaction draft');assert((await page.locator('.dw-discussion-status').innerText()).includes(locale==='en'?'Couldn’t refresh':'刷新失败'));
  await page.evaluate(()=>{window.commentReadFails=false;});cases++;
  await page.evaluate(()=>{window.locked=true;});await refresh(page);await page.waitForFunction(s=>document.querySelector(s)?.disabled,plus(1));assert.equal(await page.locator(emoji(1,'heart')).innerText(),'❤️ 3');assert.equal(await page.locator('#dw-discussion-new-body').inputValue(),'Preserved reaction draft');assert(await page.locator('.dw-discussion-submit').isDisabled());await page.evaluate(()=>{window.locked=false;});await refresh(page);await readReady(page);cases++;
  for (const rootStatus of ['hidden','deleted']) {
    await page.evaluate(value=>{window.rootStatus=value;window.readMode='fail';},rootStatus);await refresh(page);
    for (const n of [1,2,3,4,5,6]) assert.equal(await page.locator(panel(n)).count(),0,'private root trees never expose cached counts');
    assert.equal(await page.locator('#dw-discussion-new-body').inputValue(),'Preserved reaction draft');cases++;
  }
  await page.evaluate(()=>{window.rootStatus='published';window.readMode='ok';});await refresh(page);await readReady(page);
  await page.locator(plus(1)).click();assert.equal(await page.locator(`${panel(1)} .dw-discussion-reaction-menu button`).count(),5);assert(await page.locator(panel(1)).evaluate(n=>n.scrollWidth<=n.clientWidth));await page.screenshot({path:path.join(evidence,`${name}-${locale}-${width}-reactions.png`)});await page.keyboard.press('Escape');
  await page.evaluate(()=>{window.many=true;});await refresh(page);await readReady(page,100);assert(await page.evaluate(()=>window.reactReads.slice(-2).every(row=>row.commentIds.length<=50)));assert.equal(await page.locator('.dw-discussion-reactions').count(),61);assert.equal(page.__errors.length,0);await page.close();cases++;
  const blocked=await open(browser,locale,width,true);assert(await blocked.locator(plus(1)).isDisabled());assert(await blocked.evaluate(()=>window.reactReads.every(row=>!Object.hasOwn(row,'visitorId'))));await blocked.locator('.dw-discussion-add').click();await blocked.locator('#dw-discussion-new-body').fill('Posting without reaction storage');await blocked.waitForFunction(()=>!document.querySelector('.dw-discussion-submit').disabled);await blocked.locator('.dw-discussion-submit').click();await blocked.waitForFunction(()=>window.commentPosts.length===1);await blocked.locator(`#dw-comment-${id(2)} .dw-discussion-reply-action`).click();await blocked.locator('#dw-discussion-new-body').fill('Reply without reaction storage');await blocked.waitForFunction(()=>!document.querySelector('.dw-discussion-submit').disabled);await blocked.locator('.dw-discussion-submit').click();await blocked.waitForFunction(()=>window.commentPosts.length===2);assert.deepEqual(await blocked.evaluate(()=>[window.commentPosts[1].parentCommentId,window.commentPosts[1].replyToCommentId]),[id(1),id(2)]);assert.equal(await blocked.evaluate(()=>window.reactWrites.length),0);assert.equal(blocked.__errors.length,0);await blocked.close();cases++;
  const missing=await open(browser,locale,width,false,true);assert.equal(await missing.locator('.dw-discussion-reactions').count(),0);assert(await missing.locator('.dw-discussion-add').isEnabled());assert.equal(missing.__errors.length,0);await missing.close();cases++;
}console.log(`dw ${name}: PASS ${cases} 2C bilingual mobile/desktop synthetic reaction cases`);}finally{await browser.close();}}
(async()=>{fs.mkdirSync(evidence,{recursive:true});await transportCheck();await run('Chromium',chromium,{executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});await run('WebKit',webkit,{executablePath:process.env.WEBKIT_EXECUTABLE||'/Users/yangtao/Library/Caches/ms-playwright/webkit-2365/pw_run.sh'});})().catch(e=>{console.error(e);process.exitCode=1;});
