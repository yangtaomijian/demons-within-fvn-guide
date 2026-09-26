// Run after build-bilingual.sh and a local server on port 8765:
// playwright_cli.sh -s=dw-navigation run-code --filename=scripts/check-navigation-v2b-b1.js
async (page) => {
  const base = 'http://127.0.0.1:8765/';
  const results = [];
  const fail = (message, data) => { throw Error(`${message}: ${JSON.stringify(data)}`); };
  await page.addInitScript(() => {
    if (window.__dwB1Instrumented) return;
    window.__dwB1Instrumented = true;
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      (window.__dwB1Scrolls ||= []).push(this.id);
      return original.apply(this, args);
    };
  });
  const state = () => page.evaluate(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(id);
    const bounds = target?.getBoundingClientRect();
    const memoryTabs = [...document.querySelectorAll('.dw-memory-tabs > .dw-tab-list button')];
    const viewerTabs = [...document.querySelectorAll('.dw-viewer-tabs > .dw-tab-list button')];
    return {
      path: location.pathname, hash: location.hash, id, top: bounds?.top, viewport: innerHeight,
      header: document.getElementById('quarto-header')?.getBoundingClientRect().bottom,
      overflow: document.documentElement.scrollWidth > innerWidth,
      nativeHistory: history.scrollRestoration === 'auto' && !window.zenscroll,
      memory: memoryTabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true'),
      viewer: viewerTabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true'),
      slot: document.querySelector('.dw-memory-tabs a[aria-current="true"]')?.hash,
      scrollCalls: (window.__dwB1Scrolls || []).filter(name => name === id).length
    };
  });
  const checkLanding = async (label, expected) => {
    const data = await state();
    if (data.hash !== `#${expected}` || !Number.isFinite(data.top) ||
        data.top < data.header + 4 || data.top > data.viewport * .7 ||
        data.overflow || !data.nativeHistory) fail(label, data);
    return data;
  };
  const checkVisible = async (label, expected) => {
    const data = await state();
    if (data.hash !== `#${expected}` || !Number.isFinite(data.top) ||
        data.top < data.header + 4 || data.top > data.viewport - 40 || data.overflow) fail(label, data);
    return data;
  };
  const destinationFocus = () => page.evaluate(() => {
    const active = document.activeElement;
    const bounds = active?.getBoundingClientRect();
    return {
      tag: active?.tagName, section: active?.matches('section'),
      heading: active?.textContent?.trim().slice(0, 80),
      focusVisible: active?.matches(':focus-visible'),
      height: bounds?.height, outline: getComputedStyle(active).outlineStyle
    };
  });
  const go = async (path, width, height = 900) => {
    await page.setViewportSize({width, height});
    await page.goto(base + path, {waitUntil:'load'});
    await page.waitForTimeout(120);
  };

  for (const [path, width, category, viewer] of [
    ['guide/choices.html#warehouse', 1440, -1, -1],
    ['en/guide/choices.html#warehouse', 1280, -1, -1],
    ['collectibles/memorium.html#mem-resnick', 1440, 0, 0],
    ['collectibles/memorium.html#mem-russel', 390, 0, 0],
    ['collectibles/memorium.html#mem-dawn-tournament', 360, 1, 0],
    ['collectibles/memorium.html#mem-infirmary', 320, 2, 0],
    ['collectibles/memorium.html#mem-red-eyes', 430, 3, 0],
    ['en/collectibles/memorium.html#mem-resnick', 430, 0, 0],
    ['en/collectibles/memorium.html#mem-russel', 320, 0, 0],
    ['collectibles/memorium.html#sprite-ludwig-sloth-form', 390, 0, 1],
    ['en/collectibles/memorium.html#sprite-ludwig-sloth-form', 320, 0, 1]
  ]) {
    await go(path, width);
    const id = path.split('#')[1];
    const data = await checkLanding(`Direct ${path}`, id);
    if (data.scrollCalls > 1) fail(`Repeated custom scroll ${path}`, data);
    if (id.startsWith('mem-') && (data.memory !== category || data.slot !== `#${id}`)) fail(`Memory state ${path}`, data);
    if (id.startsWith('sprite-') && data.viewer !== viewer) fail(`Viewer state ${path}`, data);
    results.push(`direct ${path} @ ${width}`);
  }

  const checkInitialStructural = async (label, id) => {
    await page.locator('.dw-map-enhanced').waitFor({state:'attached'});
    await page.waitForTimeout(80);
    const data = await page.evaluate(id => {
      const target = document.getElementById(id);
      const heading = target?.querySelector(':scope > h2, :scope > h3');
      const clearance = parseFloat(getComputedStyle(target).scrollMarginTop);
      return {
        unique: document.querySelectorAll(`[id="${id}"]`).length,
        ready: !!document.querySelector('.dw-story-overview-ready') &&
          document.body.classList.contains('dw-layout-ready'),
        top: heading?.getBoundingClientRect().top, clearance, viewport: innerHeight,
        scrollY, scrollCalls: (window.__dwB1Scrolls || []).filter(name => name === id).length,
        restoration: history.scrollRestoration
      };
    }, id);
    if (data.unique !== 1 || !data.ready || data.restoration !== 'auto' ||
        !Number.isFinite(data.top) || data.top < data.clearance - 2 ||
        data.top > Math.max(data.clearance + 160, data.viewport * .45) ||
        data.scrollCalls > 1) fail(label, data);
    await page.waitForTimeout(220);
    const later = await page.evaluate(() => scrollY);
    if (Math.abs(later - data.scrollY) > 2) fail(`${label} shifted again`, {data, later});
    return data;
  };
  for (const [path, id, width] of [
    ['en/guide/choices.html?b11=1#day-off', 'day-off', 390],
    ['guide/choices.html?b11=1#day-off', 'day-off', 320],
    ['en/guide/choices.html?b11=2#black-wolf', 'black-wolf', 430]
  ]) {
    await go(path, width, 844);
    await checkInitialStructural(`Initial ${path}`, id);
    results.push(`initial structural ${path} @ ${width}`);
  }
  await go('en/guide/choices.html?b11=desktop#day-off', 1440);
  await page.locator('.dw-map-enhanced').waitFor();
  const desktopDayOff = await checkLanding('Desktop day-off native', 'day-off');
  if (desktopDayOff.scrollCalls !== 0) fail('Desktop heading was custom-scrolled', desktopDayOff);
  results.push('desktop day-off remains native');
  await go('en/collectibles/memorium.html', 390, 844);
  const dayOffLink = page.locator('main.content a[href$="#day-off"]').first();
  if (!((await dayOffLink.getAttribute('href')) || '').endsWith('#day-off'))
    fail('Cross-page source lost hash', await dayOffLink.getAttribute('href'));
  await dayOffLink.click();
  await checkInitialStructural('Memory to day-off', 'day-off');
  await page.goBack();
  if (!page.url().endsWith('/en/collectibles/memorium.html')) fail('Cross-page Back', page.url());
  await page.goForward();
  await page.locator('.dw-map-enhanced').waitFor({state:'attached'});
  await checkLanding('Cross-page Forward', 'day-off');
  results.push('cross-page Memory to day-off, Back/Forward');

  for (const [path, width, keyboard] of [
    ['guide/choices.html', 1440, false],
    ['en/guide/choices.html', 390, true],
    ['guide/choices.html', 320, true]
  ]) {
    await go(path, width);
    if (width < 500) await page.locator('.dw-mobile-toc-toggle').click();
    const link = page.locator('#TOC a[data-scroll-target="#warehouse"]');
    if (keyboard) { await link.focus(); await link.press('Enter'); }
    else await link.click();
    await page.waitForTimeout(100);
    await checkLanding(`TOC ${path}`, 'warehouse');
    if (width < 500 && await page.locator('body').evaluate(node => node.classList.contains('dw-mobile-toc-open')))
      fail('Mobile TOC remained open', path);
    const focus = await destinationFocus();
    if (keyboard && (focus.tag !== 'H2' || !focus.heading?.includes(width === 320 ? '仓库' : 'Warehouse') ||
        !focus.focusVisible || focus.outline === 'none' || focus.height > 120))
      fail('Keyboard TOC did not focus the heading', {path, focus});
    if (!keyboard && focus.section) fail('Pointer TOC focused a section', {path, focus});
    await page.goBack();
    if (page.url().includes('#')) fail('TOC Back retained fragment', page.url());
    results.push(`TOC ${path} @ ${width}`);
  }

  for (const path of ['guide/choices.html', 'en/guide/choices.html']) {
    await go(path, 1440);
    await page.locator('.dw-map-enhanced').waitFor();
    await page.locator('.dw-map-expand').click();
    await page.locator('.dw-map-viewer-stage svg a').first().click();
    await page.waitForTimeout(100);
    await checkLanding(`Viewer node ${path}`, 'first-night');
    if (await page.locator('.dw-map-viewer').evaluate(node => node.open)) fail('Viewer remained open', path);
    let focus = await destinationFocus();
    if (focus.section || (focus.focusVisible && focus.height > 120))
      fail('Pointer viewer left a large destination outline', {path, focus});
    await page.goBack();
    if (page.url().includes('#')) fail('Viewer Back retained fragment', page.url());
    await page.locator('.dw-story-map-scroll svg a').first().click();
    await page.waitForTimeout(100);
    await checkLanding(`Inline node ${path}`, 'first-night');
    results.push(`Story nodes ${path}`);

    await go(path, 1280);
    await page.locator('.dw-map-enhanced').waitFor();
    await page.locator('.dw-map-expand').focus();
    await page.keyboard.press('Enter');
    const viewerLink = page.locator('.dw-map-viewer-stage svg a').first();
    await viewerLink.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await checkLanding(`Keyboard viewer node ${path}`, 'first-night');
    focus = await destinationFocus();
    if (focus.tag !== 'H2' || !focus.focusVisible || focus.outline === 'none' || focus.height > 120)
      fail('Keyboard viewer did not focus the heading', {path, focus});
    await page.goBack();
    if (page.url().includes('#')) fail('Keyboard viewer Back retained fragment', page.url());
    results.push(`keyboard Story node ${path} @ 1280`);
  }

  for (const [path, width] of [['guide/choices.html', 320], ['en/guide/choices.html', 390]]) {
    await go(path, width, 844);
    await page.locator('.dw-mobile-toc-toggle').click();
    await page.locator('#TOC a[data-scroll-target="#day-off"]').click();
    await page.waitForTimeout(100);
    await checkLanding(`Pointer mobile TOC ${path}`, 'day-off');
    let focus = await destinationFocus();
    if (focus.section || (focus.focusVisible && focus.height > 120))
      fail('Pointer mobile TOC left a large destination outline', {path, focus});
    await go(path, width, 844);
    await page.locator('.dw-story-overview-ready').waitFor();
    await page.locator('.dw-map-mobile-expand').click();
    await page.locator('.dw-map-viewer-stage svg a').first().click();
    await page.waitForTimeout(100);
    await checkLanding(`Pointer mobile viewer ${path}`, 'first-night');
    focus = await destinationFocus();
    if (focus.section || (focus.focusVisible && focus.height > 120))
      fail('Pointer mobile viewer left a large destination outline', {path, focus});
    results.push(`pointer TOC and Story viewer ${path} @ ${width}`);
  }

  await go('guide/choices.html', 390);
  await page.goto(base + 'collectibles/memorium.html#mem-resnick');
  await page.locator('.dw-memory-tabs a[href$="#mem-ludwig"]').click();
  let data = await checkVisible('Memory slot', 'mem-ludwig');
  if (data.slot !== '#mem-ludwig' || data.memory !== 0 ||
      await page.evaluate(() => !document.activeElement?.getAttribute('href')?.endsWith('#mem-ludwig')))
    fail('Memory slot focus/state', data);
  await page.goBack();
  if (!page.url().endsWith('/guide/choices.html')) fail('Slot created Back stop', page.url());
  await page.goForward();
  data = await checkVisible('Memory Forward', 'mem-ludwig');
  if (data.slot !== '#mem-ludwig') fail('Memory Forward state', data);
  await page.reload();
  data = await checkVisible('Memory reload', 'mem-ludwig');
  if (data.slot !== '#mem-ludwig') fail('Memory reload state', data);
  results.push('slot replaceState, Back/Forward and reload');

  for (const [path, query, hash] of [
    ['guide/choices.html', 'warehouse', 'warehouse'],
    ['guide/choices.html', 'Resnick', 'mem-resnick'],
    ['en/guide/choices.html', 'Ludwig: Sloth form', 'sprite-ludwig-sloth-form']
  ]) {
    await go(path, 1440);
    await page.getByRole('button', {name:path.startsWith('en/') ? 'Search' : '搜索'}).click();
    await page.locator('.aa-Input').fill(query);
    const link = page.locator(`.search-result-link[href*="#${hash}"]`).first();
    await link.waitFor();
    await link.click();
    await page.waitForTimeout(120);
    data = await checkLanding(`Search ${hash}`, hash);
    if (hash === 'mem-resnick' && data.slot !== '#mem-resnick') fail('Search Memory state', data);
    if (hash.startsWith('sprite-') && data.viewer !== 1) fail('Search Viewer state', data);
    await page.goBack();
    if (!page.url().endsWith(path)) fail('Search Back destination', page.url());
    await page.goForward();
    await checkLanding(`Search Forward ${hash}`, hash);
    results.push(`Search ${hash}, Back/Forward`);
  }
  return results;
}
