'use strict';
// Header freezing follows navigation visibility, including non-button closes.
const assert = require('node:assert/strict');
const {chromium, webkit} = require('playwright');
const prefix='dw',ready='dw-layout-ready',routes=['collectibles/memorium.html','collectibles/cg.html'];
const base=process.env.GUIDE_BASE_URL;assert(base,'Set GUIDE_BASE_URL to completed bilingual preview');
const sidebar='#quarto-sidebar',header='#quarto-header',opener='#quarto-header .quarto-btn-toggle';
async function settled(p){await p.waitForFunction(()=>!document.querySelector('.quarto-sidebar-collapse-item.collapsing'));}
async function frozen(p,expected){assert.equal(await p.locator(header).evaluate(e=>e.classList.contains('headroom--frozen')),expected,'Headroom freeze must match navigation visibility');}
async function top(p){await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(300);}
async function down(p){await top(p);await p.evaluate(()=>scrollTo({top:700,behavior:'instant'}));await p.waitForFunction(()=>document.querySelector('#quarto-header').classList.contains('headroom--unpinned'));await p.waitForTimeout(250);}
async function closeBackdrop(p){const nav=await p.locator(sidebar).boundingBox(),glass=await p.locator('#quarto-sidebar-glass').boundingBox();await p.mouse.click((nav.x+nav.width+glass.x+glass.width)/2,glass.y+glass.height/2);await settled(p);await frozen(p,false);}
async function fillViewport(p){const geometry=await p.locator(sidebar).evaluate((e,prefix)=>({bottom:e.getBoundingClientRect().bottom,footer:e.querySelector(`.${prefix}-nav-language`).getBoundingClientRect().bottom,height:innerHeight}),prefix);assert(Math.abs(geometry.bottom-geometry.height)<=2,'Navigation fills available viewport');assert(Math.abs(geometry.footer-geometry.height)<=2,'Language footer reaches viewport bottom');}
async function run(name,type,options){const b=await type.launch({headless:true,...options});let checks=0;try{
 for(const locale of ['', 'en/'])for(const colorScheme of ['light','dark'])for(const route of routes){
  const p=await b.newPage({viewport:{width:390,height:874},colorScheme});await p.goto(`${base}/${locale}${route}`);await p.locator(`body.${ready}`).waitFor();await top(p);
  for(let i=0;i<3;i++){
   await top(p);
   await p.locator(opener).click();await settled(p);await frozen(p,true);await fillViewport(p);
   const group=p.locator('#quarto-sidebar .sidebar-item-section > .sidebar-item-container > .sidebar-item-text').first();await group.click();await p.waitForFunction(()=>!document.querySelector('#quarto-sidebar .collapsing'));await frozen(p,true);
   await closeBackdrop(p);await down(p);checks++;
  }
  await top(p);await p.locator(opener).click();await settled(p);await p.locator(opener).click();await settled(p);await frozen(p,false);await down(p);checks++;
  await top(p);await p.locator(opener).click();await p.setViewportSize({width:1100,height:874});await settled(p);await frozen(p,false);await down(p);checks++;
  await p.setViewportSize({width:390,height:874});await top(p);await p.locator(opener).click();await settled(p);await closeBackdrop(p);
  await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await frozen(p,false);await down(p);checks++;
  // Also open via Bootstrap while the header is already hidden (restored state).
  await p.evaluate(()=>document.querySelectorAll('.quarto-sidebar-collapse-item').forEach(e=>bootstrap.Collapse.getOrCreateInstance(e).show()));await settled(p);await frozen(p,true);await fillViewport(p);checks++;
  await p.setViewportSize({width:390,height:740});await p.waitForTimeout(250);await fillViewport(p);checks++;
  await closeBackdrop(p);await top(p);await frozen(p,false);await p.locator(`.${prefix}-search-launcher`).click();await p.locator('.aa-DetachedContainer').waitFor();await p.keyboard.press('Escape');await p.locator('.aa-DetachedContainer').waitFor({state:'hidden'});await p.waitForFunction(prefix=>document.activeElement.classList.contains(`${prefix}-search-launcher`),prefix);await down(p);checks++;
  await p.reload();await p.locator(`body.${ready}`).waitFor();await frozen(p,false);await down(p);checks++;await p.close();
 }
 console.log(`${prefix} ${name}: PASS ${checks} header/drawer checks`);
 }finally{await b.close();}}
(async()=>{await run('Edge',chromium,{executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});await run('WebKit',webkit,{executablePath:process.env.WEBKIT_EXECUTABLE});})().catch(e=>{console.error(e);process.exitCode=1;});
