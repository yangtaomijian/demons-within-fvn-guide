'use strict';
// Desktop-only local geometry checks; existing discussion fixture is read-only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const base = process.env.GUIDE_BASE_URL;
assert(base && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a local bilingual preview');
const out = process.env.DW_FOOTER_REPORT;
if (out) fs.mkdirSync(out, { recursive: true });
const baselineDir = process.env.DW_FOOTER_BASELINE_DIR;
const quick = process.env.DW_FOOTER_QUICK === '1';
const records = [];
const frames = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function bottom(page) {
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  // WebKit may commit the rendered discussion's scroll range after the first scroll.
  await page.waitForFunction(() => { scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); return document.querySelector('footer .dw-back-to-top'); });
  await page.waitForFunction(() => { scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); return scrollY + innerHeight >= document.documentElement.scrollHeight - 1; });
  await frames(page);
}
async function geometry(page) {
  return page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height, right: r.right, bottom: r.bottom + scrollY }; };
    const main = document.querySelector('main.content'), discussion = document.querySelector('#dw-public-discussion');
    const footer = document.querySelector('footer.footer');
    return { main: rect(main), discussion: discussion?.hidden === false ? rect(discussion) : null,
      theme: document.body.classList.contains('quarto-dark') ? 'dark' : 'light', width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      footer: rect(footer), nodes: ['.nav-footer', '.dw-publication-footer', '.dw-publication-footer-links'].map(selector => {
        const e = footer.querySelector(selector), r = e.getBoundingClientRect(), s = getComputedStyle(e);
        return { selector, box: rect(e), center: r.x + r.width / 2,
          styles: Object.fromEntries(['fontSize', 'lineHeight', 'color', 'textAlign', 'backgroundColor', 'borderRadius'].map(k => [k, s[k]])),
          text: e.textContent, links: [...e.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]) };
      }) };
  });
}
async function check(page, meta, baseline) {
  await bottom(page);
  const g = await geometry(page);
  for (const n of g.nodes) assert(Math.abs(n.center - g.width / 2) <= 1, `${JSON.stringify(meta)}: ${n.selector} center ${n.center} must equal page center ${g.width / 2}`);
  assert.equal(g.theme, meta.theme);
  assert(g.documentWidth <= g.width, 'No horizontal overflow');
  assert(g.main.width <= 961, 'Existing article width cap');
  if (g.discussion) {
    assert(Math.abs(g.main.x - g.discussion.x) <= 1 && Math.abs(g.main.width - g.discussion.width) <= 1, 'Discussion retains article alignment');
    assert(g.discussion.y >= g.main.bottom - 1 && g.footer.y >= g.discussion.bottom - 1, 'Article, discussion and footer keep their vertical order');
  } else assert(g.footer.y >= g.main.bottom - 1, 'Home footer follows main content');
  if (baseline) {
    const oldStyle = await page.addStyleTag({ content: baseline });
    await frames(page);
    const old = await geometry(page);
    assert.deepEqual(g.main, old.main, 'Footer CSS must not change article geometry');
    assert.deepEqual(g.discussion, old.discussion, 'Footer CSS must not change discussion geometry');
    for (let i = 0; i < g.nodes.length; i++) {
      const a = g.nodes[i], b = old.nodes[i];
      assert.deepEqual(a.styles, b.styles, 'Footer appearance is preserved');
      assert.equal(a.text, b.text); assert.deepEqual(a.links, b.links);
      if (g.width >= 1440) { assert.equal(a.box.width, b.box.width); assert.equal(a.box.height, b.box.height); }
    }
    await oldStyle.evaluate(e => e.remove()); await bottom(page);
  }
  records.push({ ...meta, ...g });
  if (out && g.width === 1440) await page.screenshot({ path: path.join(out, `${meta.engine}-${meta.locale}-${meta.theme}-${meta.route === 'index.html' ? 'home' : 'article'}-${meta.state}.png`) });
}
(async () => {
  const engines = [['Edge', chromium, { executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' }],
    ['WebKit', webkit, process.env.WEBKIT_EXECUTABLE ? { executablePath: process.env.WEBKIT_EXECUTABLE } : {}]];
  for (const [engine, type, options] of quick ? engines.slice(0, 1) : engines) {
    const browser = await type.launch({ headless: true, ...options });
    try {
      for (const theme of quick ? ['light'] : ['light', 'dark']) for (const locale of quick ? [''] : ['', 'en/']) for (const route of quick ? ['guide/choices.html'] : ['index.html', 'guide/choices.html']) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
        await context.addInitScript(() => Object.defineProperty(window, '__dwDiscussionFixtureTransport', { get: () => ({ async readDiscussion(r) {
          return { ok: true, thread: { id: 'footer-fixture', status: 'open' }, currentVersion: { guideVersion: r.guideVersion, comments: [], nextCursor: null }, earlierVersions: [] };
        } }), set() {} }));
        const errors = [], writes = [];
        await context.route('**/*', r => { const req = r.request(); if (!['GET', 'HEAD'].includes(req.method())) { writes.push(req.url()); return r.abort(); } return new URL(req.url()).origin === new URL(base).origin ? r.continue() : r.abort(); });
        const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${base}/${locale}${route}`); await page.locator('body.dw-layout-ready').waitFor(); await page.evaluate(() => document.fonts.ready);
        if (route !== 'index.html') await page.locator('.dw-discussion-comments[aria-busy="false"]').waitFor();
        // Restore only the old outer footer padding; replaying the entire layout
        // stylesheet after publication CSS would change its original cascade order.
        const baselineSource = baselineDir ? fs.readFileSync(path.join(baselineDir, `baseline-${locale ? 'en' : 'zh'}.css`), 'utf8') : null;
        const baselineRule = baselineSource?.match(/body\.dw-layout-ready footer\.footer \{ padding-left:calc\(var\(--dw-left-width\) \+ 1rem\); padding-right:calc\(var\(--dw-right-width\) \+ 1rem\); \}/)?.[0];
        if (baselineSource) assert(baselineRule, 'Expected release footer padding rule');
        const baseline = baselineRule ? `@media (min-width:1100px) { ${baselineRule} }` : null;
        for (const width of quick ? [1440] : [1100, 1132, 1280, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          const meta = { engine, theme, locale: locale ? 'en' : 'zh-CN', route, width };
          await check(page, { ...meta, state: 'expanded' }, baseline);
          if (route !== 'index.html') {
            await page.locator('#dw-page-toc-panel .dw-panel-toggle').click(); await page.locator('.dw-edge-right').waitFor({ state: 'visible' });
            await check(page, { ...meta, state: 'collapsed' }, baseline);
            await page.locator('.dw-edge-right').click(); await page.locator('#dw-page-toc-panel .dw-panel-toggle').waitFor({ state: 'visible' });
            await check(page, { ...meta, state: 'expanded-again' }, baseline);
          }
        }
        assert.deepEqual(errors, []); assert.deepEqual(writes, []);
        await context.close(); console.log(`${engine} ${locale || 'zh-CN'} ${theme} ${route}: PASS`);
      }
    } finally { await browser.close(); }
  }
  console.log(`PASS ${records.length} desktop global footer cases`);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  if (out) fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: !process.exitCode, records }, null, 2));
});
