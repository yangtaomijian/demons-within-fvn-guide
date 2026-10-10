'use strict';
// Local synthetic discussion tests. Never call remote APIs or notification services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium, webkit } = require('playwright');
const base = process.env.GUIDE_BASE_URL;
assert(base && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
const prefix = 'dw', current = 'Public 14.6', historical = 'Public 14.5';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sel = name => `.${prefix}-discussion-${name}`;
async function remoteChecks() {
  const source = fs.readFileSync(path.join(__dirname, '../assets/dw-discussion-remote.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const host of ['dw-staging.carambi.com', 'demons-within.carambi.com']) {
    const staging = host.startsWith('dw-staging');
    const origin = `https://discussion${staging ? '-staging' : ''}.carambi.com`;
    const context = { window: {}, location: { hostname: host }, document: { querySelector: q => ({ content: q.includes('environment') ? staging ? 'staging' : 'production' : q.includes('sitekey') ? '0xFixture' : origin }) }, URL, fetch: null };
    vm.createContext(context); vm.runInContext(source, context);
    const transport = context.window.__dwDiscussionRemoteTransport;
    for (const status of [201, 400, 401, 403, 404, 405, 408, 409, 413, 415, 422, 423, 429, 500, 503, 200]) {
      context.fetch = async (url, options) => {
        assert.equal(url, origin + '/v1/discussion/comments'); assert.equal(options.credentials, 'omit');
        return { status, json: async () => { throw Error('Lost JSON response'); } };
      };
      if (status === 201) assert.equal((await transport.postComment({})).httpStatus, 201);
      else await assert.rejects(transport.postComment({}), e => e.outcomeUnknown === ![400, 401, 403, 404, 405, 409, 413, 415, 422, 423, 429].includes(status));
    }
    context.fetch = async () => { throw Error('Connection lost'); };
    await assert.rejects(transport.postComment({}), e => e.outcomeUnknown === true);
  }
  console.log('dw remote: PASS staging/production 201 missing body, explicit refusal including 423, 408/5xx/invalid/network unknown');
}
async function open(browser, locale, width, suffix = '', initialFailure = false) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(({ current, historical, initialFailure }) => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    window.discussionReads = []; window.discussionPosts = []; window.postMode = 'unknown';
    window.failInitial = initialFailure; window.prependScope = null; window.failCursor = null; window.slowRead = false; window.slowPost = false; window.locked = false;
    window.turnstile = { render(slot, options) { queueMicrotask(() => options.callback('fixture-token')); return 1; }, remove() {} };
    const comment = (n, version, scope = 'version', replies = []) => ({ id: id(n), canReply: true, replyToCommentId: null, replyTo: null, authorKind: n === 1 ? 'maintainer' : 'guest', displayName: 'Synthetic', body: `Comment ${n}`, status: 'published', guideVersion: version, discussionScope: scope, parentCommentId: null, pageHash: null, pinnedAt: n === 1 ? '2026-10-01T00:00:00Z' : null, createdAt: '2026-10-01T00:00:00Z', replies });
    const transport = { fixtureCanWrite: true, turnstileSitekey: '0xFixture', async readDiscussion(request) {
      window.discussionReads.push({ ...request });
      if (window.failInitial) { window.failInitial = false; throw Error('Synthetic initial read failure'); }
      if (window.slowRead) await new Promise(resolve => { window.releaseRead = resolve; });
      if (request.cursor && request.cursor === window.failCursor) { window.failCursor = null; throw Error('Fixture refresh failure'); }
      const rootTwo = () => comment(2, request.guideVersion, 'version', [{ ...comment(22, current), parentCommentId: id(2) }]);
      const persistentTwo = () => comment(11, historical, 'persistent', [{ ...comment(23, current), parentCommentId: id(11) }]);
      let roots = request.cursor === 'c1' ? [rootTwo()] : [comment(1, request.guideVersion)];
      let persistent = request.section === 'persistent' && request.cursor === 'p1' ? [persistentTwo()] : [comment(10, historical, 'persistent')];
      let nextCursor = request.cursor ? null : 'c1';
      let persistentCursor = request.section === 'persistent' && request.cursor ? null : 'p1';
      if (window.prependScope === 'current') {
        roots = request.cursor === 'c2' ? [rootTwo()] : request.cursor === 'c1' ? [comment(1, request.guideVersion)] : [comment(30, request.guideVersion)];
        nextCursor = request.cursor === 'c2' ? null : request.cursor === 'c1' ? 'c2' : 'c1';
      }
      if (window.prependScope === 'persistent') {
        persistent = request.section === 'persistent' && request.cursor === 'p2' ? [persistentTwo()] : request.section === 'persistent' && request.cursor === 'p1' ? [comment(10, historical, 'persistent')] : [comment(31, historical, 'persistent')];
        persistentCursor = request.section === 'persistent' && request.cursor === 'p2' ? null : request.section === 'persistent' && request.cursor === 'p1' ? 'p2' : 'p1';
      }
      return { ok: true, thread: { id: 'fixture', status: window.locked ? 'locked' : 'open' }, currentVersion: { guideVersion: request.guideVersion, comments: roots, nextCursor }, persistent: { comments: persistent, nextCursor: persistentCursor }, earlierVersions: [{ guideVersion: historical, commentCount: 2 }] };
    }, async postComment(input) {
      window.discussionPosts.push({ ...input });
      if (window.slowPost) await new Promise(resolve => { window.releasePost = resolve; });
      if (window.postMode === 'success') return { ok: true, httpStatus: 201, commentId: null };
      const error = Error('Synthetic error');
      if (window.postMode === 'rate') error.code = 'RATE_LIMITED';
      if (window.postMode === 'verification') error.code = 'VERIFICATION_FAILED';
      if (window.postMode === 'fields') error.fieldErrors = { displayName: 'Invalid name' };
      if (window.postMode === 'locked') { error.code = 'THREAD_LOCKED'; window.locked = true; }
      if (window.postMode === 'server') error.outcomeUnknown = true;
      throw error;
    } };
    Object.defineProperty(window, '__dwDiscussionFixtureTransport', { get: () => transport, set() {} });
  }, { current, historical, initialFailure });
  await page.goto(`${base}/${locale === 'en' ? 'en/' : ''}guide/choices.html${suffix}`);
  await page.locator(sel('refresh')).waitFor(); await settled(page);
  return page;
}
async function settled(page) { await page.waitForFunction(() => document.querySelector('.dw-discussion-comments')?.getAttribute('aria-busy') === 'false'); }
async function ready(page) { await page.waitForFunction(() => !document.querySelector('.dw-discussion-submit').disabled); }
async function composer(page, reply = false) {
  await page.locator(reply ? `#dw-comment-${id(1)} > .dw-discussion-actions > ${sel('reply-action')}` : sel('add')).click();
  await page.locator('#dw-discussion-name').fill('Reader'); await page.locator('#dw-discussion-new-body').fill('Saved synthetic draft'); await ready(page);
}
async function run(name, type, options) {
  const browser = await type.launch({ headless: true, ...options }); let cases = 0;
  try {
    for (const locale of ['zh-CN', 'en']) for (const width of [390, 1440]) {
      let page = await open(browser, locale, width);
      assert.equal(await page.locator(sel('refresh')).innerText(), locale === 'en' ? 'Refresh' : '刷新');
      const hashes = ['#story-overview', '#dw-discussion-title', `#dw-comment-${id(1)}`, '#toc-title', '#quarto-document-content', '#nonexistent', '#%ZZ', '#00000000-0000-4000-8000-000000000001'];
      assert.deepEqual(await page.evaluate(hashes => hashes.map(hash => window.__dwDiscussionRuntime.getContentHash(hash)), hashes), ['#story-overview', ...hashes.slice(1).map(() => '')]);
      assert.deepEqual(await page.evaluate(() => {
        const main = document.querySelector('main#quarto-document-content');
        const paragraph = document.createElement('p'); paragraph.id = 'synthetic-body'; main.append(paragraph);
        const endnotes = document.createElement('section'); endnotes.className = 'footnotes'; endnotes.innerHTML = '<li id="synthetic-footnote">Note</li>'; main.append(endnotes);
        const form = document.createElement('form'); form.innerHTML = '<h3 id="synthetic-form">Form</h3>'; main.append(form);
        const dialog = document.createElement('dialog'); dialog.innerHTML = '<h3 id="synthetic-dialog">Dialog</h3>'; main.append(dialog);
        const values = ['#synthetic-body', '#synthetic-footnote', '#synthetic-form', '#synthetic-dialog', '#' + 'x'.repeat(257)].map(hash => window.__dwDiscussionRuntime.getContentHash(hash));
        paragraph.remove(); endnotes.remove(); form.remove(); dialog.remove(); return values;
      }), ['#synthetic-body', '', '', '', '']);
      await page.evaluate(() => history.replaceState(null, '', '#story-overview'));
      await page.locator(sel('heading')).screenshot({ path: `${process.env.DISCUSSION_EVIDENCE_DIR || '/tmp'}/${name}-${locale}-${width}-heading.png` });
      await composer(page); await page.locator(sel('submit')).click();
      await page.locator(sel('confirm-unpublished')).waitFor();
      await page.locator(sel('composer')).screenshot({ path: `${process.env.DISCUSSION_EVIDENCE_DIR || '/tmp'}/${name}-${locale}-${width}-uncertain.png` });
      assert.equal(await page.locator(sel('submit')).isDisabled(), true);
      assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      assert.equal(await page.evaluate(() => window.discussionPosts[0].pageHash), '#story-overview');
      await page.evaluate(() => document.querySelector('.dw-discussion-composer').requestSubmit());
      assert.equal(await page.evaluate(() => window.discussionPosts.length), 1);
      await page.locator(sel('refresh')).click(); await settled(page);
      assert(await page.locator(sel('confirm-unpublished')).isVisible()); assert(await page.locator(sel('submit')).isDisabled());
      await page.locator(`${sel('composer-actions')} button`).last().click();
      await page.locator(sel('add')).click(); assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      assert(await page.locator(sel('confirm-unpublished')).isVisible());
      await page.locator(sel('confirm-unpublished')).click(); await ready(page);
      for (const mode of ['rate', 'verification', 'fields']) {
        await page.evaluate(mode => { window.postMode = mode; }, mode); await page.locator(sel('submit')).click(); await ready(page);
        assert.equal(await page.locator(sel('confirm-unpublished')).isVisible(), false);
        assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      }
      await page.evaluate(() => { window.postMode = 'success'; window.slowPost = true; });
      await page.locator(sel('submit')).click(); await page.waitForFunction(() => typeof window.releasePost === 'function');
      assert(await page.locator(sel('refresh')).isDisabled()); assert(await page.locator(sel('version-buttons') + ' button').first().isDisabled());
      const readCount = await page.evaluate(() => window.discussionReads.length);
      await page.evaluate(() => document.querySelector('.dw-discussion-refresh').click()); assert.equal(await page.evaluate(() => window.discussionReads.length), readCount);
      await page.evaluate(() => { window.slowPost = false; window.releasePost(); });
      await page.waitForFunction(() => document.querySelector('.dw-discussion-post-notice')?.dataset.state === 'success');
      await page.locator(sel('add')).click(); assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), '');
      await page.close(); cases++;

      page = await open(browser, locale, width);
      await page.locator(sel('comments') + ' + button').click(); await settled(page);
      await page.locator(sel('persistent') + ' > button').click(); await settled(page);
      await composer(page, true);
      assert.equal(await page.locator(sel('comment')).count(), 4);
      const beforeIds = await page.locator(sel('comment')).evaluateAll(nodes => nodes.map(n => n.id));
      await page.evaluate(() => { window.failCursor = 'c1'; });
      await page.locator(sel('refresh')).click(); await settled(page);
      assert.deepEqual(await page.locator(sel('comment')).evaluateAll(nodes => nodes.map(n => n.id)), beforeIds);
      assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      assert(await page.locator(sel('status') + ' button').isVisible());
      await page.locator(sel('status') + ' button').click(); await settled(page);
      assert.equal(await page.locator(sel('comment')).count(), 4);
      assert.equal(await page.locator(sel('composer')).evaluate(n => n.closest('article').dataset.commentId), id(1));
      assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      await page.evaluate(() => { window.slowRead = true; document.querySelector('#dw-discussion-new-body').focus(); window.beforeScroll = scrollY; document.querySelector('.dw-discussion-refresh').click(); document.querySelector('.dw-discussion-refresh').click(); });
      await page.waitForFunction(() => typeof window.releaseRead === 'function');
      assert(await page.locator(sel('refresh')).isDisabled()); assert(await page.locator(sel('submit')).isDisabled());
      await page.evaluate(() => { window.slowRead = false; window.releaseRead(); }); await settled(page);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'dw-discussion-new-body');
      assert(Math.abs(await page.evaluate(() => scrollY - window.beforeScroll)) < 3);
      await page.locator(sel('version-buttons') + ' button').filter({ hasText: historical }).click(); await settled(page);
      await page.locator(sel('refresh')).click(); await settled(page);
      assert.equal(await page.locator(sel('version-buttons') + ' button[aria-pressed="true"]').innerText(), historical);
      assert.equal(await page.evaluate(() => window.discussionReads.filter(read => read.section !== 'persistent').at(-1).guideVersion), historical);
      await page.locator(sel('version-buttons') + ' button').first().click(); await settled(page);
      await page.locator(`#dw-comment-${id(1)} > .dw-discussion-actions > ${sel('reply-action')}`).click();
      assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      await page.evaluate(() => { window.postMode = 'server'; }); await ready(page); await page.locator(sel('submit')).click();
      await page.locator(sel('confirm-unpublished')).waitFor(); assert.equal(await page.evaluate(() => window.discussionPosts.at(-1).parentCommentId), id(1)); assert.equal(await page.evaluate(() => window.discussionPosts.at(-1).pageHash), '');
      assert(await page.locator(sel('submit')).isDisabled());
      await page.locator(sel('confirm-unpublished')).click(); await ready(page);
      await page.evaluate(() => { window.postMode = 'locked'; }); await page.locator(sel('submit')).click(); await page.locator(sel('locked')).waitFor();
      assert.equal(await page.locator(sel('composer-host')).isVisible(), true);
      assert(await page.locator(sel('submit')).isDisabled());
      assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      assert(await page.locator(sel('comment')).count() >= 2);
      assert.equal(await page.locator(sel('heading')).evaluate(n => n.scrollWidth <= n.clientWidth), true);
      await page.screenshot({ path: `${process.env.DISCUSSION_EVIDENCE_DIR || '/tmp'}/${name}-${locale}-${width}.png`, fullPage: false });
      await page.close(); cases++;
      page = await open(browser, locale, width, '', true);
      assert.equal(await page.evaluate(() => window.discussionReads.length), 1);
      assert(await page.locator(sel('status') + ' button').isVisible());
      await page.locator(sel('status') + ' button').click(); await settled(page);
      assert.equal(await page.evaluate(() => window.discussionReads.length), 2);
      await page.close(); cases++;

      // Coalesce navigation during a refresh and replay the latest address only.
      page = await open(browser, locale, width);
      await composer(page);
      await page.evaluate(() => { window.slowRead = true; document.querySelector('.dw-discussion-refresh').click(); });
      await page.waitForFunction(() => typeof window.releaseRead === 'function');
      await page.evaluate(({ historical, rootId, replyId }) => {
        history.pushState(null, '', `?discussionVersion=${encodeURIComponent(historical)}#dw-comment-${rootId}`); dispatchEvent(new PopStateEvent('popstate'));
        history.pushState(null, '', `?discussionScope=persistent#dw-comment-${replyId}`); dispatchEvent(new PopStateEvent('popstate'));
        window.slowRead = false; window.releaseRead();
      }, { historical, rootId: id(22), replyId: id(23) });
      await page.waitForFunction(target => document.activeElement?.id === `dw-comment-${target}`, id(23));
      assert((await page.locator(sel('version-buttons') + ' button[aria-pressed="true"]').innerText()).includes(current));
      assert.equal(await page.evaluate(historical => window.discussionReads.filter(r => r.guideVersion === historical).length, historical), 0);
      await page.locator(sel('add')).click(); assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      await page.close(); cases++;

      // A new address arriving during navigation cancels stale comment location.
      page = await open(browser, locale, width);
      await page.evaluate(historical => { window.slowRead = true; history.pushState(null, '', `?discussionVersion=${encodeURIComponent(historical)}`); dispatchEvent(new PopStateEvent('popstate')); }, historical);
      await page.waitForFunction(() => typeof window.releaseRead === 'function');
      await page.evaluate(target => { history.pushState(null, '', `?discussionScope=persistent#dw-comment-${target}`); dispatchEvent(new PopStateEvent('popstate')); window.slowRead = false; window.releaseRead(); }, id(23));
      await page.waitForFunction(target => document.activeElement?.id === `dw-comment-${target}`, id(23));
      assert((await page.locator(sel('version-buttons') + ' button[aria-pressed="true"]').innerText()).includes(current));
      await page.close(); cases++;

      // Real Back/Forward during an uncertain POST retains the root draft and guard.
      page = await open(browser, locale, width);
      await page.evaluate(historical => { history.pushState(null, '', `?discussionVersion=${encodeURIComponent(historical)}`); dispatchEvent(new PopStateEvent('popstate')); }, historical);
      await page.waitForFunction(historical => document.querySelector('.dw-discussion-version-buttons button[aria-pressed="true"]')?.textContent.includes(historical), historical);
      await settled(page);
      await page.evaluate(() => { history.pushState(null, '', location.pathname); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForFunction(current => document.querySelector('.dw-discussion-version-buttons button[aria-pressed="true"]')?.textContent.includes(current), current);
      await composer(page);
      await page.evaluate(() => { window.slowPost = true; }); await page.locator(sel('submit')).click();
      await page.waitForFunction(() => typeof window.releasePost === 'function');
      await page.goBack();
      assert(await page.locator(sel('refresh')).isDisabled());
      await page.evaluate(() => { window.slowPost = false; window.releasePost(); });
      await page.waitForFunction(historical => document.querySelector('.dw-discussion-version-buttons button[aria-pressed="true"]')?.textContent.includes(historical), historical);
      await page.goForward();
      await page.waitForFunction(current => document.querySelector('.dw-discussion-version-buttons button[aria-pressed="true"]')?.textContent.includes(current), current);
      await page.locator(sel('add')).click();
      assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Saved synthetic draft');
      assert(await page.locator(sel('confirm-unpublished')).isVisible()); assert(await page.locator(sel('submit')).isDisabled());
      assert.equal(await page.evaluate(() => window.discussionPosts.length), 1);
      await page.close(); cases++;

      for (const scope of ['current', 'persistent']) {
        page = await open(browser, locale, width);
        await page.locator(sel('comments') + ' + button').click(); await settled(page);
        await page.locator(sel('persistent') + ' > button').click(); await settled(page);
        const target = scope === 'current' ? 2 : 11;
        await page.locator(`#dw-comment-${id(target)} > .dw-discussion-actions > ${sel('reply-action')}`).click();
        await page.locator('#dw-discussion-new-body').fill('Reply survives new roots'); await ready(page);
        const readsBefore = await page.evaluate(() => window.discussionReads.length);
        await page.evaluate(scope => {
          window.prependScope = scope;
          const input = document.querySelector('#dw-discussion-new-body'); input.focus(); input.setSelectionRange(3, 9); window.beforeScroll = scrollY;
          document.querySelector('.dw-discussion-refresh').click();
        }, scope);
        await settled(page);
        assert.equal(await page.locator(sel('composer')).evaluate(n => n.closest('article').dataset.commentId), id(target));
        assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Reply survives new roots');
        assert.deepEqual(await page.locator('#dw-discussion-new-body').evaluate(n => [document.activeElement === n, n.selectionStart, n.selectionEnd]), [true, 3, 9]);
        assert(Math.abs(await page.evaluate(() => scrollY - window.beforeScroll)) < 3);
        const refreshReads = await page.evaluate(n => window.discussionReads.slice(n), readsBefore);
        assert(refreshReads.some(read => read.section === scope && read.cursor === (scope === 'current' ? 'c2' : 'p2')));
        assert(!refreshReads.some(read => read.section !== scope && ['c2', 'p2'].includes(read.cursor)));
        await page.close(); cases++;
      }
      for (const [suffix, target] of [[`#dw-comment-${id(22)}`, 22], [`?discussionVersion=${encodeURIComponent(historical)}#dw-comment-${id(22)}`, 22], [`?discussionScope=persistent#dw-comment-${id(23)}`, 23]]) {
        page = await open(browser, locale, width, suffix);
        await page.locator(`#dw-comment-${id(target)}`).waitFor();
        await page.waitForFunction(target => document.activeElement?.id === `dw-comment-${target}`, id(target));
        assert.equal(await page.locator(`#dw-comment-${id(target)}`).isVisible(), true);
        await page.close(); cases++;
      }
    }
    console.log(`dw ${name}: PASS ${cases} bilingual desktop/mobile incremental submit/hash/refresh cases`);
  } finally { await browser.close(); }
}
(async () => { await remoteChecks(); await run('Edge', chromium, { executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' }); await run('WebKit', webkit, { executablePath: process.env.WEBKIT_EXECUTABLE || '/Users/yangtao/Library/Caches/ms-playwright/webkit-2365/pw_run.sh' }); })().catch(error => { console.error(error); process.exitCode = 1; });
