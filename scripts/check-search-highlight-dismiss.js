// Run after build-bilingual.sh and a local server on port 8765:
// playwright_cli.sh -s=dw-b1 run-code --filename=scripts/check-search-highlight-dismiss.js
async (page) => {
  const base = 'http://127.0.0.1:8765/';
  const results = [];
  const fail = (label, data) => { throw Error(`${label}: ${JSON.stringify(data)}`); };
  const state = target => target.evaluate(() => ({
    url: location.href,
    hash: location.hash,
    marks: document.querySelectorAll('main mark').length,
    text: document.getElementById(location.hash.slice(1))?.textContent,
    history: history.length
  }));

  for (const [path, query] of [
    ['guide/choices.html', '仓库'],
    ['en/guide/choices.html', 'Warehouse']
  ]) {
    await page.setViewportSize({width:1440,height:900});
    const arrival = `${base}${path}?q=${encodeURIComponent(query)}#warehouse`;
    await page.goto(arrival);
    await page.waitForTimeout(100);
    const before = await state(page);
    if (before.marks < 1 || before.url.includes('?q=') || before.hash !== '#warehouse') fail('Initial highlight', {path,before});
    await page.mouse.wheel(0, 300);
    if ((await state(page)).marks !== before.marks) fail('Scrolling dismissed marks', path);
    await page.locator('.dw-map-controls button').first().click();
    if ((await state(page)).marks !== before.marks) fail('Interactive control dismissed marks', path);
    await page.locator('#warehouse h2').click({position:{x:20,y:20}});
    const after = await state(page);
    if (after.marks !== 0 || after.url !== before.url || after.history !== before.history || after.text !== before.text)
      fail('Mouse dismissal', {path,before,after});
    await page.getByRole('button',{name:path.startsWith('en/')?'Search':'搜索'}).click();
    await page.locator('.aa-Input').fill('Resnick');
    await page.locator('.search-result-link').first().waitFor();
    results.push(`${path}: initial, scroll, control, mouse, search reuse`);

    await page.goto(arrival);
    await page.waitForTimeout(100);
    const keyboardBefore = await state(page);
    await page.keyboard.press('Escape');
    const keyboardAfter = await state(page);
    if (keyboardBefore.marks < 1 || keyboardAfter.marks !== 0 ||
        keyboardAfter.url !== keyboardBefore.url || keyboardAfter.history !== keyboardBefore.history)
      fail('Escape dismissal', {path,keyboardBefore,keyboardAfter});
    results.push(`${path}: Escape`);

    await page.goto(base + path);
    await page.getByRole('button',{name:path.startsWith('en/')?'Search':'搜索'}).click();
    await page.locator('.aa-Input').fill(query);
    const result = page.locator('.search-result-link[href*="#warehouse"]').first();
    await result.waitFor();
    await result.click();
    await page.waitForTimeout(100);
    const fromSearch = await state(page);
    if (fromSearch.marks < 1 || fromSearch.hash !== '#warehouse' || fromSearch.url.includes('?q='))
      fail('Search-result arrival highlight', {path,fromSearch});
    await page.locator('#warehouse h2').click({position:{x:20,y:20}});
    if ((await state(page)).marks !== 0) fail('Search-result dismissal', path);
    await page.goBack();
    if (page.url() !== base + path) fail('Search-result Back', {path,url:page.url()});
    await page.goForward();
    if ((await state(page)).hash !== '#warehouse') fail('Search-result Forward', {path,url:page.url()});
    results.push(`${path}: result navigation and Back/Forward`);
  }

  const browser = page.context().browser();
  const mobileContext = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  try {
    const mobile = await mobileContext.newPage();
    for (const [path, query] of [
      ['guide/choices.html', '仓库'],
      ['en/guide/choices.html', 'Warehouse']
    ]) {
      await mobile.goto(`${base}${path}?q=${encodeURIComponent(query)}#warehouse`);
      await mobile.waitForTimeout(100);
      const before = await state(mobile);
      if (before.marks < 1) fail('Mobile initial highlight', {path,before});
      await mobile.evaluate(() => scrollBy(0, 250));
      await mobile.waitForTimeout(150);
      if ((await state(mobile)).marks !== before.marks) fail('Mobile scroll dismissed marks', path);
      const heading = mobile.locator('#warehouse h2');
      await heading.scrollIntoViewIfNeeded();
      await mobile.waitForTimeout(100);
      const box = await heading.boundingBox();
      await mobile.touchscreen.tap(box.x + 20, box.y + Math.min(20, box.height/2));
      const after = await state(mobile);
      if (after.marks !== 0 || after.url !== before.url || after.history !== before.history || after.text !== before.text)
        fail('Touch dismissal', {path,before,after});
      results.push(`${path}: 390px touch`);
    }
  } finally { await mobileContext.close(); }
  return results;
}
