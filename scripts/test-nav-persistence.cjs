'use strict';
// Native sidebar groups: persistence without taking ownership of Bootstrap.
const assert = require('node:assert/strict');
const {chromium, webkit} = require('playwright');
const prefix = 'dw';
const route = 'collectibles/cg.html';
const ready = 'dw-layout-ready';
const base = process.env.GUIDE_BASE_URL;
assert(base, 'Set GUIDE_BASE_URL to the completed bilingual local preview');
const key = `${prefix}-navigation-groups-v1`;
const sections = '#quarto-sidebar .sidebar-section[id]';
const headers = '#quarto-sidebar .sidebar-item-section > .sidebar-item-container > .sidebar-item-text';
const arrows = '#quarto-sidebar .sidebar-item-section > .sidebar-item-container > .sidebar-item-toggle';
async function settled(p) {
  await p.locator(`body.${ready}`).waitFor();
  await p.waitForFunction(() => !document.querySelector('#quarto-sidebar .collapsing'));
}
async function open(p) {
  await p.evaluate(() => scrollTo({top:0, behavior:'instant'}));
  await p.waitForTimeout(250);
  await p.locator('#quarto-header .quarto-btn-toggle').click();
  await p.waitForFunction(() => document.querySelector('#quarto-sidebar').classList.contains('show'));
  await settled(p);
}
async function close(p) {
  await p.waitForFunction(() => document.querySelector('#quarto-sidebar-glass').classList.contains('show') && !document.querySelector('#quarto-sidebar-glass').classList.contains('collapsing'));
  const box = await p.locator('#quarto-sidebar-glass').boundingBox();
  const sidebar = await p.locator('#quarto-sidebar').boundingBox();
  // Click the exposed backdrop, away from WebKit's transient edge scrollbar.
  const x = (sidebar.x + sidebar.width + box.x + box.width) / 2 - box.x;
  await p.locator('#quarto-sidebar-glass').click({position:{x, y:box.height/2}});
  await p.waitForFunction(() => !document.querySelector('#quarto-sidebar').classList.contains('show') && !document.querySelector('#quarto-sidebar').classList.contains('collapsing'));
}
async function check(p, expected, where) {
  await settled(p);
  const states = await p.locator(sections).evaluateAll(es => es.map(group => {
    const open = group.classList.contains('show');
    const toggles = [...document.querySelectorAll(`#quarto-sidebar [data-bs-target="#${group.id}"]`)];
    return {open, consistent:toggles.length===2 && toggles.every(t => t.getAttribute('aria-expanded')===String(open) && t.classList.contains('collapsed')===!open)};
  }));
  assert.deepEqual(states.map(s => s.open), expected, where);
  assert(states.every(s => s.consistent), `${where}: title/chevron aria mismatch`);
}
async function toggle(p, index, arrow=false) {
  await p.locator(arrow ? arrows : headers).nth(index).click();
  await settled(p);
}
async function run(name, type, options) {
  const browser = await type.launch({headless:true, ...options});
  let checks = 0;
  try {
    for (const width of [390, 820]) for (const locale of ['', 'en/']) {
      console.log(`${prefix} ${name}: width=${width} locale=${locale || 'zh'}`);
      const p = await browser.newPage({viewport:{width,height:874}});
      await p.goto(`${base}/${locale}${route}`);
      await settled(p);
      const count = await p.locator(sections).count();
      assert.equal(count, 2, 'Home is a direct link; remaining navigation groups present');
      const expected = Array(count).fill(false); expected[1]=true;
      await open(p); await check(p, expected, 'Native first-visit active group'); checks++;
      await toggle(p,0); expected[0]=true;
      await check(p,expected,'Title opens group'); checks++;
      await toggle(p,1,true); expected[1]=false;
      await check(p,expected,'Chevron closes independent group'); checks++;
      const prefs = await p.evaluate(key => localStorage.getItem(key), key);
      assert(prefs, 'Explicit user choices saved');
      await close(p); await open(p); await check(p,expected,'Close/reopen'); checks++;
      const destination = p.locator(sections).nth(0).locator('a[href]').first();
      await Promise.all([p.waitForURL(await destination.evaluate(a=>a.href)), destination.click()]);
      await settled(p); await open(p); await check(p,expected,'Actual cross-page link'); checks++;
      await p.reload(); await settled(p); await open(p); await check(p,expected,'Reload overrides active-section default'); checks++;
      await close(p);
      await p.evaluate(() => scrollTo({top:0,behavior:'instant'})); await p.waitForTimeout(250);
      await open(p);
      const language = p.locator(`.${prefix}-language-switch`);
      await Promise.all([p.waitForURL(await language.evaluate(a=>a.href)), language.click()]);
      await settled(p); await open(p); await check(p,expected,'Actual bilingual switch'); checks++;
      await toggle(p,1); expected[1]=true; await check(p,expected,'Additional independent group'); checks++;
      const home = p.locator('#quarto-sidebar .sidebar-menu-container > ul > li').first();
      assert.equal(await home.locator('a[href]').count(),1,'One Home destination');
      assert.equal(await home.locator('[data-bs-toggle="collapse"], .sidebar-section').count(),0,'Home has no nested level or disclosure');
      const homeLink=home.locator('a[href]');
      const homeURL=await homeLink.evaluate(a=>a.href);
      await homeLink.focus();await Promise.all([p.waitForURL(homeURL),p.keyboard.press('Enter')]);
      await settled(p);await open(p);await check(p,expected,'Direct Home navigation preserves group choices');
      assert.equal(await p.locator('#quarto-sidebar .sidebar-menu-container > ul > li').first().locator('a.active[href]').count(),1,'Home destination highlighted');checks++;
      await close(p);
      await p.evaluate(() => scrollTo({top:0,behavior:'instant'})); await p.waitForTimeout(250);
      await p.locator('#quarto-header .quarto-btn-toggle').focus(); await p.keyboard.press('Enter');
      await p.waitForFunction(() => document.querySelector('#quarto-sidebar').classList.contains('show'));
      await check(p,expected,'Keyboard reopens drawer with remembered groups'); checks++;
      await close(p);
      await p.goBack(); await settled(p); await open(p);
      await check(p,expected,'History back reads latest group preferences'); checks++;
      await close(p); await p.goForward(); await settled(p); await open(p);
      await check(p,expected,'History forward reads latest group preferences'); checks++;
      await close(p);
      const remembered = await p.evaluate(key=>localStorage.getItem(key),key);
      await p.setViewportSize({width:1100,height:900});
      await p.waitForFunction(()=>document.querySelector('#quarto-sidebar').inert);
      await p.locator('#navbarCollapse .dropdown-toggle').first().click();
      assert.equal(await p.locator('#navbarCollapse .dropdown-toggle').first().getAttribute('aria-expanded'),'true');
      await p.locator('main h1').click();
      assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),remembered,'Desktop dropdown must not overwrite mobile choices'); checks++;
      await p.setViewportSize({width:1099,height:900});
      await p.waitForFunction(()=>!document.querySelector('#quarto-sidebar').inert);
      // Programmatic events are unrelated to an explicit group click.
      await p.locator(sections).nth(0).evaluate(group=>group.dispatchEvent(new Event('hide.bs.collapse',{bubbles:true})));
      assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),remembered); checks++;
      await p.setViewportSize({width:320,height:874});
      await open(p); await check(p,expected,'Breakpoint round trip'); checks++;
      await p.close();
    }
    for (const mode of ['corrupt','blocked']) {
      const p = await browser.newPage({viewport:{width:320,height:874}});
      await p.addInitScript(({mode,key})=>{
        if(mode==='corrupt') localStorage.setItem(key,'{invalid-json');
        else for(const method of ['getItem','setItem']) {
          const original=Storage.prototype[method];
          Storage.prototype[method]=function(k,...args){if(k===key)throw new Error('Unavailable optional preference storage');return original.call(this,k,...args);};
        }
      },{mode,key});
      await p.goto(`${base}/${route}`); await settled(p); await open(p);
      const expected=Array(2).fill(false);expected[1]=true;
      await check(p,expected,`${mode}: default`);checks++;
      await toggle(p,0);expected[0]=true;
      await close(p);await open(p);await check(p,expected,`${mode}: in-page retention`);checks++;
      await toggle(p,0,true);expected[0]=false;
      await close(p);await open(p);await check(p,expected,`${mode}: explicit collapse`);checks++;
      await p.close();
    }
    console.log(`${prefix} ${name}: PASS ${checks} navigation checks`);
  } finally {await browser.close();}
}
(async()=>{
  await run('Edge',chromium,{executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  await run('WebKit',webkit,process.env.WEBKIT_EXECUTABLE ? {executablePath:process.env.WEBKIT_EXECUTABLE} : {});
})().catch(error=>{console.error(error);process.exitCode=1;});
