'use strict';
// 2A synthetic exact-reply contract. Remote requests are aborted in every browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium, webkit } = require('playwright');
const base = process.env.GUIDE_BASE_URL;
assert(base && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
const current = 'Public 14.6', historical = 'Public 14.5';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const article = n => `#dw-comment-${id(n)}`;
const action = n => `${article(n)} > .dw-discussion-actions > .dw-discussion-reply-action`;
const draft = '#dw-discussion-new-body', refresh = '.dw-discussion-refresh';
const evidence = process.env.DISCUSSION_EVIDENCE_DIR || '/tmp';
async function transportCheck() {
  const source = fs.readFileSync(path.join(__dirname, '../assets/dw-discussion-remote.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const sent = [];
  const ctx = { URL, window: {}, location: { hostname: 'dw-staging.carambi.com' }, document: { querySelector: s => ({ content: s.includes('environment') ? 'staging' : s.includes('sitekey') ? '0xFixture' : 'https://discussion-staging.carambi.com' }) }, fetch: async (url, options) => { sent.push(JSON.parse(options.body)); return { status: 201, json: async () => ({ commentId: id(80) }) }; } };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  await ctx.window.__dwDiscussionRemoteTransport.postComment({ parentCommentId: id(1), replyToCommentId: id(2) });
  await ctx.window.__dwDiscussionRemoteTransport.postComment({ parentCommentId: null, replyToCommentId: null });
  assert.deepEqual(sent.map(row => [row.parentCommentId, row.replyToCommentId]), [[id(1), id(2)], [null, null]]);
  console.log('dw 2A transport: PASS root/exact target UUID serialization');
}
async function open(browser, locale, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.__documentLoads = 0; page.on('request', request => { if (request.isNavigationRequest()) page.__documentLoads++; });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(({ current, historical }) => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    window.exactReads = []; window.exactPosts = []; window.added = []; window.postMode = 'success';
    window.targetStatus = 'published'; window.rootStatus = 'published'; window.revokeRootCapability = false; window.childCapabilityMismatch = false; window.removeTarget = false; window.locked = false; window.prependCurrent = false; window.slowPost = false; window.failNextRead = false;
    window.turnstile = { render(slot, options) { queueMicrotask(() => options.callback('synthetic')); return 1; }, remove() {} };
    const row = (n, parent = null, target = null, version = current, scope = 'version', status = 'published') => ({ id: id(n), status, parentCommentId: parent === null ? null : id(parent), replyToCommentId: target === null ? null : id(target), replyTo: null, displayName: status === 'published' ? 'SameName' : null, authorKind: status === 'published' ? 'guest' : null, body: status === 'published' ? `Body ${n} without quote` : null, guideVersion: version, discussionScope: scope, createdAt: '2026-10-10T08:00:00Z', pageHash: null, pinnedAt: null, canReply: status === 'published' && !window.locked });
    function tree(rootId, version, scope) {
      const root = row(rootId, null, null, version, scope, rootId === 1 ? window.rootStatus : 'published'); root.replies = [];
      if (rootId === 1 && window.revokeRootCapability) root.canReply = false;
      if (rootId === 1) root.replies = [row(2, 1, 1, current, scope, window.targetStatus), row(3, 1, 2), row(4, 1, 3), row(5, 1)];
      else if (rootId === 10) root.replies = [row(11, 10, 10), row(12, 10, 11)];
      else if (rootId === 20) root.replies = [row(21, 20, 20), row(22, 20, 21)];
      root.replies.push(...window.added.filter(entry => entry.parentCommentId === root.id));
      if (window.removeTarget && rootId === 1) root.replies = root.replies.filter(reply => reply.id !== id(2));
      const rows = [root, ...root.replies];
      for (const entry of root.replies) {
        if (!entry.replyToCommentId) continue;
        const target = rows.find(item => item.id === entry.replyToCommentId);
        entry.replyTo = target ? { id: target.id, status: target.status, displayName: target.status === 'published' ? target.displayName : null, authorKind: target.status === 'published' ? target.authorKind : null } : null;
        entry.canReply = rootId === 1 && window.childCapabilityMismatch ? entry.status === 'published' : root.canReply && entry.status === 'published';
      }
      return root;
    }
    const transport = { fixtureCanWrite: true, turnstileSitekey: '0xFixture', async readDiscussion(request) {
      window.exactReads.push({ ...request });
      if (window.failNextRead) { window.failNextRead = false; throw Error('Synthetic read failure'); }
      const historicalView = request.guideVersion === historical;
      let comments, nextCursor;
      if (historicalView) { comments = [tree(20, historical, 'version')]; nextCursor = null; }
      else if (window.prependCurrent) { comments = request.cursor === 'c2' ? [tree(1, current, 'version')] : request.cursor === 'c1' ? [tree(100, current, 'version')] : [tree(101, current, 'version')]; nextCursor = request.cursor === 'c2' ? null : request.cursor === 'c1' ? 'c2' : 'c1'; }
      else { comments = request.cursor === 'c1' ? [tree(1, current, 'version')] : [tree(100, current, 'version')]; nextCursor = request.cursor === 'c1' ? null : 'c1'; }
      return { ok: true, thread: { status: window.locked ? 'locked' : 'open' }, currentVersion: { guideVersion: request.guideVersion, comments, nextCursor }, persistent: { comments: [tree(10, historical, 'persistent')], nextCursor: null }, earlierVersions: [{ guideVersion: historical, commentCount: 3 }] };
    }, async postComment(input) {
      window.exactPosts.push({ ...input });
      if (window.slowPost) await new Promise(resolve => { window.releasePost = resolve; });
      if (window.postMode !== 'success') {
        const error = Error('Synthetic refusal');
        if (window.postMode === 'invalid') { window.targetStatus = 'hidden'; error.code = 'VALIDATION_FAILED'; error.fieldErrors = { replyToCommentId: 'NOT_REPLYABLE' }; error.outcomeUnknown = false; }
        if (window.postMode === 'invalidRoot') { window.rootStatus = 'hidden'; error.code = 'VALIDATION_FAILED'; error.fieldErrors = { parentCommentId: 'NOT_REPLYABLE' }; error.outcomeUnknown = false; }
        if (window.postMode === 'locked') { window.locked = true; error.code = 'THREAD_LOCKED'; error.outcomeUnknown = false; }
        throw error;
      }
      const n = 200 + window.added.length;
      const added = row(n); added.parentCommentId = input.parentCommentId; added.replyToCommentId = input.replyToCommentId; added.body = input.body; window.added.push(added);
      return { ok: true, httpStatus: 201, commentId: added.id };
    }, async sendFeedback() { return { ok: true, httpStatus: 202 }; } };
    Object.defineProperty(window, '__dwDiscussionFixtureTransport', { get: () => transport, set() {} });
    Object.defineProperty(window, '__dwFeedbackDialog', { get: () => ({ openReport(id) { window.reportedId = id; } }), set() {} });
  }, { current, historical });
  await page.goto(`${base}/${locale === 'en' ? 'en/' : ''}guide/choices.html`);
  await page.locator(refresh).waitFor(); await settled(page);
  await page.locator('.dw-discussion-comments + button').click(); await settled(page);
  return page;
}
async function settled(page) { await page.waitForFunction(() => document.querySelector('.dw-discussion-comments')?.getAttribute('aria-busy') === 'false'); }
async function ready(page) { await page.waitForFunction(() => !document.querySelector('.dw-discussion-submit')?.disabled); }
async function openTarget(page, n, value) { await page.locator(action(n)).click(); if (value) await page.locator(draft).fill(value); await ready(page); }
async function doRefresh(page) { await page.locator(refresh).click(); await settled(page); }
async function run(name, type, options) {
  const browser = await type.launch({ headless: true, ...options }); let cases = 0;
  try {
    for (const locale of ['zh-CN', 'en']) for (const width of [390, 1440]) {
      const page = await open(browser, locale, width);
      for (const n of [1, 2, 3, 4, 5]) assert(await page.locator(action(n)).isVisible());
      assert.equal(await page.locator(`${article(5)} .dw-discussion-reply-to`).count(), 0);
      for (const [n, target] of [[2,1],[3,2],[4,3]]) {
        const marker = page.locator(`${article(n)} > .dw-discussion-reply-to`);
        assert.equal(await marker.getAttribute('data-reply-to-comment-id'), id(target));
        assert((await marker.getAttribute('href')).endsWith(`#dw-comment-${id(target)}`));
        await marker.click(); await page.waitForFunction(target => document.activeElement?.id === `dw-comment-${target}`, id(target));
      }
      assert.equal(await page.locator(`${article(1)} > .dw-discussion-replies > .dw-discussion-reply`).count(), 4);
      assert.equal(await page.locator('.dw-discussion-reply .dw-discussion-replies').count(), 0);
      await openTarget(page, 2, 'Draft for B');
      assert.equal(await page.locator('.dw-discussion-reply-target').getAttribute('data-reply-to-comment-id'), id(2));
      await openTarget(page, 3, 'Draft for C'); await openTarget(page, 2);
      assert.equal(await page.locator(draft).inputValue(), 'Draft for B');
      await page.locator(`${article(2)} > .dw-discussion-actions > .dw-discussion-report-action`).click(); assert.equal(await page.evaluate(() => window.reportedId), id(2));
      await page.evaluate(() => { window.prependCurrent = true; const input = document.querySelector('#dw-discussion-new-body'); input.focus(); input.setSelectionRange(3, 9); window.beforeScroll = scrollY; document.querySelector('.dw-discussion-refresh').click(); }); await settled(page);
      assert.equal(await page.locator('.dw-discussion-reply-target').getAttribute('data-root-comment-id'), id(1));
      assert.equal(await page.locator('.dw-discussion-composer').evaluate(n => n.closest('article').dataset.commentId), id(2));
      assert.deepEqual(await page.locator(draft).evaluate(n => [document.activeElement === n, n.selectionStart, n.selectionEnd]), [true,3,9]);
      assert(Math.abs(await page.evaluate(() => scrollY - window.beforeScroll)) < 3);
      assert(await page.evaluate(() => window.exactReads.some(read => read.cursor === 'c2')));
      await page.screenshot({ path: `${evidence}/${name}-${locale}-${width}-composer.png` });
      await page.locator('.dw-discussion-submit').click(); await page.waitForFunction(() => window.exactPosts.length === 1 && document.querySelector('.dw-discussion-composer-host')?.hidden);
      assert.deepEqual(await page.evaluate(() => [window.exactPosts[0].parentCommentId, window.exactPosts[0].replyToCommentId, window.exactPosts[0].pageHash]), [id(1),id(2),'']);
      await openTarget(page, 5, 'Reply to a legacy unknown target'); await page.locator('.dw-discussion-submit').click(); await page.waitForFunction(() => window.exactPosts.length === 2 && document.querySelector('.dw-discussion-composer-host')?.hidden);
      assert.deepEqual(await page.evaluate(() => [window.exactPosts[1].parentCommentId, window.exactPosts[1].replyToCommentId]), [id(1),id(5)]); cases++;

      await openTarget(page, 1, 'Direct root reply draft remains readable');
      await page.evaluate(() => { window.rootStatus = 'hidden'; }); await doRefresh(page);
      assert(await page.locator('.dw-discussion-composer-host').isVisible()); assert(await page.locator('.dw-discussion-submit').isDisabled());
      assert.equal(await page.locator(draft).inputValue(), 'Direct root reply draft remains readable');
      assert(!(await page.locator('.dw-discussion-reply-target').innerText()).includes('SameName'));
      await page.evaluate(() => { window.rootStatus = 'published'; window.revokeRootCapability = false; window.childCapabilityMismatch = false; }); await doRefresh(page); await ready(page);
      assert.equal(await page.locator('.dw-discussion-reply-target').getAttribute('data-reply-to-comment-id'), id(1)); cases++;

      await openTarget(page, 2, 'Child draft when parent revoked');
      await page.evaluate(() => { window.postMode = 'invalidRoot'; }); await page.locator('.dw-discussion-submit').click();
      await page.waitForFunction(() => window.rootStatus === 'hidden' && document.querySelector('.dw-discussion-submit')?.disabled);
      assert(await page.locator('.dw-discussion-composer-host').isVisible()); assert.equal(await page.locator(draft).inputValue(), 'Child draft when parent revoked');
      assert.equal(await page.locator(action(3)).count(), 0);
      await page.evaluate(() => { window.rootStatus = 'published'; window.postMode = 'success'; }); await doRefresh(page); await ready(page);

      await openTarget(page, 2, 'Draft survives unavailable B');
      await page.evaluate(() => { window.targetStatus = 'hidden'; }); await doRefresh(page);
      assert(await page.locator('.dw-discussion-composer-host').isVisible()); assert(await page.locator('.dw-discussion-submit').isDisabled()); assert.equal(await page.locator(draft).inputValue(), 'Draft survives unavailable B'); assert.equal(await page.locator(action(2)).count(), 0);
      const marker = page.locator(`${article(3)} > .dw-discussion-reply-to`);
      assert((await marker.innerText()).includes(locale === 'en' ? 'hidden comment' : '已隐藏'));
      assert(!(await marker.innerText()).includes('SameName'));
      await marker.click(); await page.waitForFunction(target => document.activeElement?.id === `dw-comment-${target}`, id(2));
      await page.evaluate(() => { window.targetStatus = 'deleted'; }); await doRefresh(page);
      assert((await marker.innerText()).includes(locale === 'en' ? 'deleted comment' : '已删除'));
      assert.equal(await page.locator(action(2)).count(), 0); assert.equal(await page.locator(`${article(2)} > .dw-discussion-body`).count(), 0);
      await marker.click(); await page.waitForFunction(target => document.activeElement?.id === `dw-comment-${target}`, id(2));
      await page.evaluate(() => { window.targetStatus = 'published'; }); await doRefresh(page); await openTarget(page, 2);
      assert.equal(await page.locator(draft).inputValue(), 'Draft survives unavailable B');
      await page.evaluate(() => { window.revokeRootCapability = true; window.childCapabilityMismatch = true; }); await doRefresh(page);
      assert.equal(await page.locator(action(2)).count(), 0, 'child canReply cannot override the root capability');
      assert(await page.locator('.dw-discussion-composer-host').isVisible()); assert(await page.locator('.dw-discussion-submit').isDisabled());
      assert.equal(await page.locator(draft).inputValue(), 'Draft survives unavailable B');
      await page.evaluate(() => { window.revokeRootCapability = false; window.childCapabilityMismatch = false; }); await doRefresh(page); await ready(page);
      await page.evaluate(() => { window.removeTarget = true; }); await doRefresh(page);
      assert(await page.locator('.dw-discussion-composer-host').isVisible()); assert(await page.locator('.dw-discussion-submit').isDisabled());
      assert.equal(await page.locator(draft).inputValue(), 'Draft survives unavailable B');
      assert(!(await page.locator('.dw-discussion-reply-target').innerText()).includes('SameName'));
      assert.equal(await page.locator(`${article(3)} > span.dw-discussion-reply-to`).count(), 1);
      assert.equal(await page.locator(`${article(3)} > .dw-discussion-reply-to`).getAttribute('href'), null);
      await page.evaluate(() => { window.removeTarget = false; }); await doRefresh(page); await ready(page);
      await page.evaluate(() => { window.postMode = 'invalid'; }); await page.locator('.dw-discussion-submit').click(); await page.waitForFunction(() => window.targetStatus === 'hidden' && document.querySelector('.dw-discussion-submit')?.disabled);
      assert.deepEqual(await page.evaluate(() => [window.exactPosts.at(-1).parentCommentId, window.exactPosts.at(-1).replyToCommentId]), [id(1),id(2)]);
      assert.equal(await page.locator(action(2)).count(), 0);
      await page.evaluate(() => { window.targetStatus = 'published'; window.postMode = 'success'; }); await doRefresh(page); await openTarget(page, 2);
      assert.equal(await page.locator(draft).inputValue(), 'Draft survives unavailable B'); cases++;

      await openTarget(page, 3, 'C uncertain draft'); await page.evaluate(() => { window.postMode = 'unknown'; }); await page.locator('.dw-discussion-submit').click(); await page.locator('.dw-discussion-confirm-unpublished').waitFor();
      const postCount = await page.evaluate(() => window.exactPosts.length); assert(await page.locator('.dw-discussion-submit').isDisabled());
      await page.evaluate(() => document.querySelector('.dw-discussion-composer').requestSubmit()); assert.equal(await page.evaluate(() => window.exactPosts.length), postCount);
      await openTarget(page, 2); await page.locator(action(3)).click(); assert.equal(await page.locator(draft).inputValue(), 'C uncertain draft'); assert(await page.locator('.dw-discussion-confirm-unpublished').isVisible());
      await doRefresh(page); assert(await page.locator('.dw-discussion-submit').isDisabled());
      await page.locator('.dw-discussion-confirm-unpublished').click(); await ready(page); cases++;

      await page.locator('.dw-discussion-version-buttons button').filter({ hasText: historical }).click(); await settled(page);
      const historicMarker = page.locator(`${article(22)} > .dw-discussion-reply-to`); assert((await historicMarker.getAttribute('href')).includes('discussionVersion=Public+14.5'));
      await historicMarker.click(); await page.waitForFunction(target => document.activeElement?.id === `dw-comment-${target}`, id(21));
      await openTarget(page, 21, 'Historical reply'); await page.evaluate(() => { window.postMode = 'success'; }); await page.locator('.dw-discussion-submit').click(); await page.waitForFunction(() => document.querySelector('.dw-discussion-composer-host')?.hidden);
      assert.deepEqual(await page.evaluate(() => [window.exactPosts.at(-1).parentCommentId, window.exactPosts.at(-1).replyToCommentId]), [id(20),id(21)]);
      const persistentMarker = page.locator(`${article(12)} > .dw-discussion-reply-to`); assert((await persistentMarker.getAttribute('href')).includes('discussionScope=persistent'));
      await persistentMarker.click(); await page.waitForFunction(target => document.activeElement?.id === `dw-comment-${target}`, id(11));
      await openTarget(page, 11, 'Persistent reply'); await page.locator('.dw-discussion-submit').click(); await page.waitForFunction(() => document.querySelector('.dw-discussion-composer-host')?.hidden);
      assert.deepEqual(await page.evaluate(() => [window.exactPosts.at(-1).parentCommentId, window.exactPosts.at(-1).replyToCommentId]), [id(10),id(11)]); cases++;

      assert.equal(page.__documentLoads, 1, 'ordinary target marker navigation must stay in this document');
      await openTarget(page, 2); assert.equal(await page.locator(draft).inputValue(), 'Draft survives unavailable B');
      await openTarget(page, 11, 'Locked draft preserved'); await page.evaluate(() => { window.postMode = 'locked'; }); await page.locator('.dw-discussion-submit').click(); await page.locator('.dw-discussion-locked').waitFor();
      assert.equal(await page.locator('.dw-discussion-reply-action').count(), 0); assert(await page.locator('.dw-discussion-composer-host').isVisible()); assert(await page.locator('.dw-discussion-submit').isDisabled()); assert.equal(await page.locator(draft).inputValue(), 'Locked draft preserved');
      await page.evaluate(() => { window.locked = false; window.postMode = 'success'; }); await doRefresh(page); await openTarget(page, 11); assert.equal(await page.locator(draft).inputValue(), 'Locked draft preserved');
      assert(await page.locator('.dw-discussion-composer').evaluate(n => n.scrollWidth <= n.clientWidth));
      await page.locator('.dw-discussion-composer').screenshot({ path: `${evidence}/${name}-${locale}-${width}-target.png` });
      await page.close(); cases++;
    }
    console.log(`dw ${name}: PASS ${cases} 2A bilingual mobile/desktop exact-target, flat-tree, UUID, privacy, draft, refresh, unknown, history/persistent and lock cases`);
  } finally { await browser.close(); }
}
(async () => { await transportCheck(); await run('Chromium', chromium, { executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' }); await run('WebKit', webkit, { executablePath: process.env.WEBKIT_EXECUTABLE || '/Users/yangtao/Library/Caches/ms-playwright/webkit-2365/pw_run.sh' }); })().catch(error => { console.error(error); process.exitCode = 1; });
