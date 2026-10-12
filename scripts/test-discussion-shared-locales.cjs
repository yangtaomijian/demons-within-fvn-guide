'use strict';
// Real local UI sources, synthetic shared trees, zero external requests or mail.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const source = name => fs.readFileSync(path.join(__dirname, '../assets', `dw-discussion-${name}.html`), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function installFixture() {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const version = 'Public 14.6';
  window.sharedReads = []; window.sharedPosts = []; window.sharedSummaryReads = [];
  window.sharedLocked = false; window.sharedFail = false;
  const row = (n, locale) => ({ id: id(n), status: 'published', authorKind: 'guest', displayName: 'Synthetic',
    body: n === 1 ? '中文原文，不翻译' : 'Original English text', publicationLocale: locale,
    parentCommentId: null, replyToCommentId: null, replyTo: null, guideVersion: version,
    discussionScope: 'versioned', createdAt: '2026-10-12T00:00:00Z', pinnedAt: null,
    pageHash: '#source-section', canReply: !window.sharedLocked, replies: [] });
  window.turnstile = { render(slot, options) { queueMicrotask(() => options.callback('synthetic')); return 1; }, remove() {} };
  window.__dwDiscussionFixtureTransport = {
    fixtureCanWrite: true, turnstileSitekey: '0xFixture',
    async readDiscussion(request) {
      window.sharedReads.push({ ...request });
      if (window.sharedFail) throw Error('Synthetic read failure');
      const roots = [row(1, 'zh-CN'), row(2, 'en'), row(3, undefined), row(4, '//invalid.example')];
      const reply = { ...row(5, 'en'), parentCommentId: id(1), replyToCommentId: id(1),
        replyTo: { id: id(1), status: 'published', displayName: 'Synthetic', authorKind: 'guest' }, pageHash: null, replies: undefined };
      roots[0].replies = [reply];
      for (const post of window.sharedPosts) roots.find(root => root.id === post.parentCommentId)?.replies.push({ ...row(10),
        id: id(10), body: post.body, publicationLocale: post.locale, parentCommentId: post.parentCommentId,
        replyToCommentId: post.replyToCommentId, replyTo: { id: post.replyToCommentId, status: 'published', displayName: 'Synthetic', authorKind: 'guest' }, pageHash: null });
      return { ok: true, thread: { status: window.sharedLocked ? 'locked' : 'open' },
        currentVersion: { guideVersion: request.guideVersion, comments: roots, nextCursor: null },
        persistent: { comments: [], nextCursor: null }, earlierVersions: [] };
    },
    async postComment(input) { window.sharedPosts.push({ ...input }); return { ok: true, httpStatus: 201, commentId: id(10) }; },
    async readReactions(input) { return { ok: true, reactions: input.commentIds.map(commentId => ({ commentId,
      counts: { like: 1, heart: 0, smile: 0, celebrate: 0, thinking: 0 }, selected: ['like'], canReact: !window.sharedLocked })) }; },
    async readSummary(input) {
      window.sharedSummaryReads.push({ ...input });
      return { ok: true, discussions: ['zh-CN', 'en'].map((locale, i) => ({ rootCommentId: id(i + 1), locale,
        publicationLocale: locale, guideVersion: version, discussionScope: 'versioned', replyCount: 1,
        pageTitle: document.documentElement.lang === 'en' ? 'Choices' : '选项', summary: i ? 'English summary' : '中文摘要',
        lastActivityAt: '2026-10-12T00:00:00Z', publicUrl: `https://demons-within.carambi.com/${locale === 'en' ? 'en/' : ''}guide/choices.html#dw-comment-${id(i + 1)}` })), nextCursor: null };
    },
  };
}
const fixture = `<script>(${installFixture.toString()})();</script>`;
function html(locale, hub) {
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'">
  <style>${fs.readFileSync(path.join(__dirname, '../assets/dw-discussion.css'), 'utf8')}</style></head><body>
  <div id="quarto-content"><main id="quarto-document-content"><h1>Synthetic shared Discussion</h1><p id="source-section">Source section.</p></main></div>
  ${hub ? '<div id="dw-discussion-hub"></div>' : ''}${fixture}${source('runtime')}${source(hub ? 'hub' : 'ui')}</body></html>`;
}
async function run(name, engine) {
  const executablePath = process.env[`DISCUSSION_${name.toUpperCase()}_EXECUTABLE`];
  const browser = await engine.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  let checks = 0;
  try {
    for (const locale of ['zh-CN', 'en']) for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; let external = 0;
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== '127.0.0.1') { external++; return route.abort(); }
        return route.fulfill({ contentType: 'text/html', body: html(locale, url.pathname.includes('discussions.html')) });
      });
      const pagePath = `${locale === 'en' ? '/en' : ''}/guide/choices.html`;
      await page.goto(`http://127.0.0.1:47899${pagePath}#dw-comment-${id(5)}`);
      await page.waitForFunction(() => document.activeElement?.id === 'dw-comment-00000000-0000-4000-8000-000000000005');
      assert.equal(await page.locator(`#dw-comment-${id(1)} > .dw-discussion-body`).innerText(), '中文原文，不翻译');
      assert.equal(await page.locator(`#dw-comment-${id(2)} > .dw-discussion-body`).innerText(), 'Original English text');
      assert.equal(await page.locator(`#dw-comment-${id(1)} .dw-discussion-fragment`).getAttribute('href'), '/guide/choices.html#source-section');
      assert.equal(await page.locator(`#dw-comment-${id(2)} .dw-discussion-fragment`).getAttribute('href'), '/en/guide/choices.html#source-section');
      for (const n of [3, 4]) assert.equal(await page.locator(`#dw-comment-${id(n)} .dw-discussion-fragment`).getAttribute('href'), pagePath + '#source-section');
      const marker = page.locator(`#dw-comment-${id(5)} > .dw-discussion-reply-to`);
      assert.equal(await marker.getAttribute('href'), pagePath + `#dw-comment-${id(1)}`);
      await marker.click(); await page.waitForFunction(() => document.activeElement?.id === 'dw-comment-00000000-0000-4000-8000-000000000001');
      assert.equal(await page.locator('#dw-discussion-title').innerText(), locale === 'en' ? 'Discussion' : '讨论');
      // Reply to a root originally published in the opposite language.
      const target = locale === 'en' ? 1 : 2;
      await page.locator(`#dw-comment-${id(target)} > .dw-discussion-actions > .dw-discussion-reply-action`).click();
      await page.locator('#dw-discussion-new-body').fill('Synthetic cross-language reply');
      await page.waitForFunction(() => !document.querySelector('.dw-discussion-submit').disabled);
      await page.locator('.dw-discussion-refresh').click();
      await page.waitForFunction(() => document.querySelector('.dw-discussion-comments').getAttribute('aria-busy') === 'false');
      assert.equal(await page.locator('#dw-discussion-new-body').inputValue(), 'Synthetic cross-language reply');
      await page.locator('.dw-discussion-submit').click();
      await page.waitForFunction(() => window.sharedPosts.length === 1 && document.querySelector('.dw-discussion-composer-host').hidden);
      assert.deepEqual(await page.evaluate(() => [window.sharedPosts[0].locale, window.sharedPosts[0].parentCommentId, window.sharedPosts[0].replyToCommentId]), [locale, id(target), id(target)]);
      await page.evaluate(() => { window.sharedLocked = true; });
      await page.locator('.dw-discussion-refresh').click(); await page.locator('.dw-discussion-locked').waitFor();
      assert.equal(await page.locator('.dw-discussion-reply-action').count(), 0);
      assert(await page.locator(`#dw-comment-${id(1)}`).isVisible());
      await page.evaluate(() => { window.sharedFail = true; });
      await page.locator('.dw-discussion-refresh').click();
      await page.waitForFunction(() => document.querySelector('.dw-discussion-status')?.textContent.includes(document.documentElement.lang === 'en' ? 'Couldn' : '刷新失败'));
      assert(await page.locator(`#dw-comment-${id(2)}`).isVisible(), 'Read failure preserves existing shared rows');
      await page.goto(`http://127.0.0.1:47899/${locale === 'en' ? 'en/' : ''}discussions.html`);
      await page.waitForFunction(() => document.querySelectorAll('#discussions .card').length === 2);
      assert.equal(await page.locator('#language').count(), 0);
      assert.equal(await page.locator('#discussions .card').count(), 2);
      assert.deepEqual(await page.evaluate(() => window.sharedSummaryReads.map(r => r.locale)), [locale]);
      assert((await page.locator('#discussions').innerText()).includes('中文摘要'));
      assert((await page.locator('#discussions').innerText()).includes('English summary'));
      assert.deepEqual(errors, []); assert.equal(external, 0);
      await page.close(); checks++;
    }
    console.log(`DW ${name}: PASS ${checks} bilingual mobile/desktop shared text, precise reply, origin fragment, legacy fallback, UI locale, draft, lock/failure and hub cases; 0 external requests`);
  } finally { await browser.close(); }
}
(async () => { await run('Chromium', chromium); await run('WebKit', webkit); })().catch(e => { console.error(e); process.exitCode = 1; });
