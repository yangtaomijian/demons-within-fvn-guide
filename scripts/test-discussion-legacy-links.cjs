'use strict';
// Fully intercepted browser fixture; no production or authentication traffic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.DW_PLAYWRIGHT_MODULE || 'playwright');
const source = name => fs.readFileSync(path.join(__dirname, '../assets/', name), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
(async () => {
 const browser = await chromium.launch({headless:true, ...(process.env.DW_CHROMIUM ? {executablePath:process.env.DW_CHROMIUM}: {})});
 let count=0;
 try {
 for (const [article,pageKey] of Object.entries({'guide/choices.html':'guide.choices','guide/faq.html':'guide.faq','reference/interventions.html':'reference.interventions','collectibles/cg.html':'collectibles.cg','collectibles/memorium.html':'collectibles.memorium'})) for (const locale of ['zh-CN','en']) for (const mode of ['history','reply','current','explicit','persistent','promoted','missing','hidden','deleted','fail','repeat','budget','race','newlink','explicitfail']) {
  const context=await browser.newContext({serviceWorkers:'block'}); const page=await context.newPage(); page.setDefaultTimeout(5000); const reads=[]; const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  const row = (n,version,status='published',replies=[]) => ({id:id(n),guideVersion:version,discussionScope:'versioned',status,body:'Synthetic',displayName:'Test',createdAt:'2026-01-01T00:00:00Z',canReply:false,replies});
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(route.request().isNavigationRequest()) return route.fulfill({contentType:'text/html; charset=utf-8',body:`<html lang="${locale}"><head><meta charset="utf-8"><meta name="dw-discussion-environment" content="production"><meta name="dw-discussion-api" content="https://discussion.carambi.com"><meta name="dw-discussion-turnstile-sitekey" content="0xFixture"></head><body><div id="quarto-content"><main id="quarto-document-content"><h1>Fixture</h1></main></div>${source('dw-discussion-remote.html')}${source('dw-discussion-runtime.html').replace("const guideVersion = 'Public 14.6';", "const guideVersion = 'Public 15.0';")}${source('dw-discussion-ui.html')}</body></html>`});
   if(u.pathname!='/v1/discussion') return route.abort();
   const q=Object.fromEntries(u.searchParams); reads.push(q);
   if((mode==='fail' && q.cursor) || (mode==='explicitfail' && q.guideVersion==='Public 14.6')) return route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'failed'});
   if(mode==='race' && q.guideVersion==='Public 14.6') await new Promise(r=>setTimeout(r,150));
   let comments=[], nextCursor=null;
   if(q.guideVersion==='Public 15.0') comments=[row(1,q.guideVersion)];
   if(mode==='newlink' && comments.length) comments[0].replies=[{...row(3,q.guideVersion),replyToCommentId:id(1),replyTo:{id:id(1),status:'published',displayName:'Test'}}];
   if(q.guideVersion==='Public 14.6') {
    nextCursor=q.cursor?null:'next';
    if(q.cursor) comments=[row(2,q.guideVersion,mode==='hidden'?'hidden':mode==='deleted'?'deleted':'published',mode==='reply'?[row(3,q.guideVersion)]:[])];
    if(mode==='repeat') {comments=[];nextCursor='next';}
    if(mode==='budget') {comments=[];nextCursor=String(Number(q.cursor||0)+1);}
    if(mode==='promoted') comments=[];
   }
   const persistent={comments:(mode==='persistent'||mode==='promoted')?[{...row(4,'Public 14.6'),discussionScope:'persistent'}]:[],nextCursor:null};
   return route.fulfill({headers:{'access-control-allow-origin':'*'},json:{ok:true,thread:{id:'fixture',status:'open'},currentVersion:{guideVersion:q.guideVersion,comments,nextCursor},persistent,earlierVersions:[{guideVersion:'Public 14.6',commentCount:1}]}});
  });
  let target=['current','newlink'].includes(mode)?1:mode==='reply'?3:['persistent','promoted'].includes(mode)?4:mode==='missing'?99:2;
  const search=['explicit','explicitfail'].includes(mode)?'?discussionVersion=Public%2014.6':mode==='persistent'?'?discussionScope=persistent':'';
  await page.goto(`https://demons-within.carambi.com/${locale==='en'?'en/':''}${article}${search}#dw-comment-${id(target)}`);
  if(mode==='race') {await page.waitForFunction(()=>document.querySelector('.dw-discussion-comments'));await page.evaluate(hash=>{location.hash=hash},`dw-comment-${id(1)}`);target=1;}
  if(['fail','repeat','budget','explicitfail'].includes(mode)) {
   await page.locator('.dw-discussion-status').getByRole('button',{name:locale==='en'?'Try again':'重试',exact:true}).waitFor();
   assert(!await page.locator('.dw-discussion-post-notice').textContent().catch(()=>''));
  } else if(['missing','hidden','deleted'].includes(mode)) await page.getByText(locale==='en'?'This comment is unavailable.':'此评论当前不可用。',{exact:true}).waitFor().catch(async e=>{console.log(await page.locator('body').innerText(),reads);throw e});
  else {
   await page.waitForFunction(target=>document.activeElement?.id===`dw-comment-${target}`,id(target));
   if(!['explicit','persistent'].includes(mode)) await page.waitForFunction(mode=>location.search.includes(mode==='promoted'?'discussionScope=persistent':'discussionVersion=Public'),mode);
   if(mode==='newlink') { assert(page.url().includes('discussionVersion=Public+15.0')); assert((await page.locator('.dw-discussion-reply-to').getAttribute('href')).includes('discussionVersion=Public+15.0')); }
  }
  if(mode==='explicit') assert(!reads.some(r=>r.section==='persistent'));
  assert(reads.every(q=>q.pageKey===pageKey && q.locale===locale));assert.equal(errors.length,0,errors.join('\n'));
  await context.close(); count++; console.log(`PASS ${article} ${locale} ${mode}`);
 }
 console.log(`PASS ${count} legacy-link browser cases`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
