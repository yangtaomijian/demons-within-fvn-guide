'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const id = process.env.GUIDE_SITE || (path.resolve(__dirname).includes('password-guide') ? 'pw' : 'dw');
const base = process.env.GUIDE_BASE_URL;
assert(base && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a local bilingual build');
const route = id === 'pw' ? 'versions/b085-changes.html' : 'reference/interventions.html';
const panelId = id + '-page-toc-panel';
const ready = id === 'pw' ? 'pw-custom-layout-ready' : 'dw-layout-ready';
const records = [];
const frames = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
async function readingPointer(p) {
  let box = await p.locator('main.content').boundingBox();
  if (box.y + box.height < 150) box = await p.locator('footer.footer').boundingBox();
  const top = Math.max(120, box.y), bottom = Math.min(440, box.y + box.height);
  await p.mouse.move(box.x + box.width / 2, (top + bottom) / 2);
}
async function metric(p) {
  return p.evaluate(panelId => {
    const panel = document.getElementById(panelId), toolbar = panel.querySelector('[class$="panel-toolbar"]');
    const active = panel.querySelector('#TOC a.active');
    const rail = panel.getBoundingClientRect(), h = toolbar.getBoundingClientRect(), a = active?.getBoundingClientRect();
    return { top: panel.scrollTop, max: panel.scrollHeight - panel.clientHeight, body: scrollY,
      activeTarget: active?.getAttribute('data-scroll-target'), activeTop: a?.top, activeBottom: a?.bottom,
      safeTop: Math.max(rail.top, h.bottom) + 24, safeBottom: rail.bottom - 24,
      calls: window.tocFollowCalls.length, hidden: panel.inert, overflow: document.documentElement.scrollWidth > innerWidth };
  }, panelId);
}
async function activate(p, target) {
  await p.evaluate(target => {
    const e = document.getElementById(decodeURIComponent(target.slice(1)));
    scrollTo({ top: e.getBoundingClientRect().top + scrollY - 150, behavior: 'instant' });
  }, target);
  await p.waitForFunction(({ panelId, target }) => document.querySelector('#' + panelId + ' #TOC a.active')?.getAttribute('data-scroll-target') === target, { panelId, target });
  await frames(p);
}
function visible(s, label) {
  assert(s.activeTop >= s.safeTop - 1.1 || s.top < 1.1, label + ': top edge ' + JSON.stringify(s));
  assert(s.activeBottom <= s.safeBottom + 1.1 || Math.abs(s.max - s.top) < 1.1, label + ': bottom edge ' + JSON.stringify(s));
  assert(!s.overflow, label + ': document horizontal overflow');
}
async function auditCalls(p, label) {
  const calls = await p.evaluate(() => window.tocFollowCalls);
  for (const c of calls) {
    assert.equal(c.behavior, 'instant', label + ': animation');
    assert(Math.abs(c.requested - c.expected) < 0.1, label + ': minimum edge delta ' + JSON.stringify(c));
    assert.equal(c.bodyAfter, c.bodyBefore, label + ': controller scrolled document');
    assert.equal(c.hashAfter, c.hashBefore, label + ': controller changed fragment');
    assert.equal(c.sameFocus, true, label + ': controller moved focus');
  }
  return calls.length;
}
(async () => {
  for (const [engine, type, executablePath] of [
    ['Edge', chromium, '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    ['WebKit', webkit, process.env.WEBKIT_EXECUTABLE]
  ]) {
    const b = await type.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    try {
      for (const locale of ['', 'en/']) for (const colorScheme of ['light', 'dark']) {
        const c = await b.newContext({ viewport: { width: 1440, height: 450 }, colorScheme, reducedMotion: 'reduce' });
        // Keep tests local and read-only; do not call discussion/feedback services.
        await c.route('**/*', r => new URL(r.request().url()).origin === new URL(base).origin && r.request().method() === 'GET' ? r.continue() : r.abort());
        const p = await c.newPage(), errors = [];
        p.on('pageerror', e => errors.push(e.message));
        await p.addInitScript(panelId => {
          window.tocFollowCalls = [];
          document.addEventListener('DOMContentLoaded', () => {
            const panel = document.getElementById(panelId);
            if (!panel) return;
            const original = panel.scrollTo.bind(panel);
            panel.scrollTo = options => {
              const active = panel.querySelector('#TOC a.active'), rail = panel.getBoundingClientRect();
              const h = panel.querySelector('[class$="panel-toolbar"]').getBoundingClientRect(), link = active.getBoundingClientRect();
              const top = Math.max(rail.top, h.bottom) + 24, bottom = rail.bottom - 24;
              const delta = link.height > bottom - top || link.top < top ? link.top - top : link.bottom > bottom ? link.bottom - bottom : 0;
              const before = { requested: options.top, behavior: options.behavior,
                expected: Math.max(0, Math.min(panel.scrollHeight - panel.clientHeight, panel.scrollTop + delta)),
                bodyBefore: scrollY, hashBefore: location.hash, focus: document.activeElement };
              original(options);
              const { focus, ...entry } = before;
              window.tocFollowCalls.push({ ...entry, bodyAfter: scrollY, hashAfter: location.hash, sameFocus: focus === document.activeElement });
            };
          }, { once: true });
        }, panelId);
        await p.goto(base + '/' + locale + route);
        await p.locator('body.' + ready).waitFor();
        await p.evaluate(() => document.fonts.ready);
        const targets = await p.locator('#' + panelId + ' #TOC a[data-scroll-target]').evaluateAll(es => es.map(e => e.getAttribute('data-scroll-target')).filter(t => document.getElementById(decodeURIComponent(t.slice(1)))));
        const first = targets[0], last = targets.at(-1);
        const label = engine + '/' + id + '/' + (locale ? 'en' : 'zh') + '/' + colorScheme;
        const snapshots = [];
        for (const width of [1100, 1440, 1920]) {
          await p.setViewportSize({ width, height: 450 });
          await readingPointer(p);
          // Genuine reading input; resume after any previous TOC browsing.
          await p.mouse.wheel(0, 1); await p.waitForTimeout(100); await frames(p);
          await activate(p, last);
          const lastState = await metric(p); visible(lastState, label + '/' + width);
          assert(lastState.top > 0, label + ': long active heading is revealed');
          const settled = lastState.calls; await p.waitForTimeout(80);
          assert.equal((await metric(p)).calls, settled, label + ': settled row keeps its position');
          await activate(p, first); visible(await metric(p), label + ': reverse reading');
          await activate(p, last);
          const y = await p.evaluate(() => scrollY);
          await p.mouse.move(100, 260); await p.mouse.wheel(0, -100); await p.waitForTimeout(120); await frames(p);
          const manual = await metric(p);
          assert.equal(manual.body, y, label + ': manual TOC wheel moved document');
          assert(manual.top < lastState.top, label + ': manual TOC wheel did not scroll rail');
          await readingPointer(p); await activate(p, first);
          const paused = await metric(p);
          assert.equal(paused.calls, manual.calls, label + ': leaving rail must not resume follow');
          // Native DW branch collapse can clamp scrollTop; check calls, not just top.
          await p.mouse.wheel(0, 1); await p.waitForTimeout(100); await frames(p);
          visible(await metric(p), label + ': body wheel resumes follow');
          // Focus browsing also pauses; a reading key resumes without moving focus.
          await p.locator('#' + panelId + ' #TOC a.nav-link').first().evaluate(e => e.focus({ preventScroll: true }));
          const focusPause = await metric(p); await activate(p, last);
          assert.equal((await metric(p)).calls, focusPause.calls, label + ': keyboard TOC browsing priority');
          await p.evaluate(() => document.activeElement.blur());
          await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100); await frames(p);
          visible(await metric(p), label + ': reading key resumes follow');
          // Collapsed panels do not follow; explicit expansion resumes it.
          await p.locator('.' + id + '-panel-toggle' + (id === 'pw' ? '-right' : '')).click(); await frames(p);
          const collapsed = await metric(p); assert(collapsed.hidden, label + ': collapse state');
          const opener = p.locator(id === 'pw' ? '.pw-edge-toggle-right' : '.dw-edge-right');
          assert.equal(await opener.getAttribute('aria-expanded'), 'false', label + ': collapsed aria');
          assert(await opener.evaluate(e => e === document.activeElement), label + ': collapse focus');
          await activate(p, first); assert.equal((await metric(p)).calls, collapsed.calls, label + ': collapsed follow');
          await p.locator(id === 'pw' ? '.pw-edge-toggle-right' : '.dw-edge-right').click();
          await frames(p); visible(await metric(p), label + ': expansion resumes');
          const closer = p.locator(id === 'pw' ? '.pw-panel-toggle-right' : '.dw-panel-toggle');
          assert.equal(await closer.getAttribute('aria-expanded'), 'true', label + ': expanded aria');
          assert(await closer.evaluate(e => e === document.activeElement), label + ': expansion focus');
          // Paused rail link activation also resumes the controller.
          await p.mouse.move(100, 260); await activate(p, last);
          const firstLink = p.locator('#' + panelId + ' #TOC a.nav-link').first();
          await firstLink.evaluate(e => e.click()); await frames(p);
          await p.waitForTimeout(120); await frames(p);
          visible(await metric(p), label + ': link resumes');
          snapshots.push({ width, last: lastState, manual, paused });
        }
        // Existing tablet semantics stay independent below the desktop boundary.
        await p.setViewportSize({ width: 1099, height: 450 }); await frames(p);
        const boundary = await metric(p); await activate(p, last);
        assert.equal((await metric(p)).calls, boundary.calls, label + ': desktop behavior leaked below breakpoint');
        await p.setViewportSize({ width: 1440, height: 450 }); await frames(p);
        await readingPointer(p); await p.mouse.wheel(0, 1); await p.waitForTimeout(100); await frames(p);
        visible(await metric(p), label + ': restore desktop');
        // Footer keeps its fixed viewport rail; following still only moves that rail.
        await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        await p.waitForTimeout(100); await frames(p);
        visible(await metric(p), label + ': footer');
        const calls = await auditCalls(p, label); assert(calls > 0, label + ': no follow calls');
        await p.goto(base + '/' + locale + route + last);
        await p.locator('body.' + ready).waitFor(); await p.waitForTimeout(160); await frames(p);
        visible(await metric(p), label + ': direct fragment');
        await p.reload(); await p.locator('body.' + ready).waitFor(); await p.waitForTimeout(160); await frames(p);
        visible(await metric(p), label + ': fragment reload');
        await auditCalls(p, label + ': reload');
        await p.goto(base + '/' + locale + 'index.html');
        await p.locator('body.' + ready).waitFor(); await frames(p);
        assert.equal(await p.locator('#' + panelId).count(), 0, label + ': home has no TOC panel');
        assert.equal(await p.locator(id === 'pw' ? '.pw-edge-toggle-right' : '.dw-edge-right').count(), 0, label + ': no TOC opener on home');
        await p.goBack(); await p.locator('body.' + ready).waitFor(); await p.waitForTimeout(160); await frames(p);
        await readingPointer(p); await p.mouse.wheel(0, 1); await p.waitForTimeout(100); await frames(p);
        visible(await metric(p), label + ': history back');
        await p.goForward(); await p.locator('body.' + ready).waitFor(); await frames(p);
        assert.equal(await p.locator('#' + panelId).count(), 0, label + ': history forward no TOC');
        await p.goBack(); await p.locator('body.' + ready).waitFor(); await frames(p);
        assert.deepEqual(errors, [], label + ': page errors');
        if (process.env.TOC_FOLLOW_OUTPUT) await p.screenshot({ path: path.join(process.env.TOC_FOLLOW_OUTPUT, label.replaceAll('/', '-') + '.png') });
        records.push({ engine, site: id, locale: locale || 'zh', colorScheme, widths: [1100,1440,1920], calls, snapshots });
        console.log(label + ': PASS edge geometry, reading/manual/focus/link/collapse, breakpoint, fragments/reload/history/no-TOC/footer and body/hash/focus invariants');
        await c.close();
      }
    } finally { await b.close(); }
  }
  console.log(id + ': PASS ' + records.length + ' bilingual/theme/browser scenarios at three desktop widths');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  if (process.env.TOC_FOLLOW_OUTPUT) fs.writeFileSync(path.join(process.env.TOC_FOLLOW_OUTPUT, id + '-results.json'), JSON.stringify({ completed: !process.exitCode, records }, null, 2));
});
