"use strict";
// Targeted regression: first-paint ownership, native collision isolation,
// exact TOC links, tablet controls, mobile focus and keyboard dismissal.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, webkit } = require("playwright");
const prefix = "dw";
const readyClass = "dw-layout-ready";
const route = "collectibles/memorium.html";
const base = process.env.GUIDE_BASE_URL;
assert(base, "Set GUIDE_BASE_URL to the completed local bilingual preview");
const output = path.resolve(__dirname, "../_site");

async function state(page) {
  return page.evaluate(prefix => {
    const panel = document.getElementById(`${prefix}-page-toc-panel`);
    const toc = panel?.querySelector("#TOC");
    return {
      tocs: document.querySelectorAll("#TOC").length,
      nativePanel: !!document.getElementById("quarto-margin-sidebar"),
      menu: !!document.getElementById("quarto-toc-toggle"),
      opacity: toc ? getComputedStyle(toc).opacity : null,
      pointer: toc ? getComputedStyle(toc).pointerEvents : null,
      x: panel?.getBoundingClientRect().x
    };
  }, prefix);
}
function check(s, where) {
  assert.equal(s.tocs, 1, `${where}: duplicate TOC`);
  assert.equal(s.nativePanel, false, `${where}: native margin ownership`);
  assert.equal(s.menu, false, `${where}: native rollup menu`);
  assert.equal(s.opacity, "1", `${where}: invisible TOC`);
  assert.notEqual(s.pointer, "none", `${where}: disabled TOC`);
}
async function run(name, type, options) {
  const browser = await type.launch({ headless: true, ...options });
  let collisions = 0, paintChecks = 0;
  try {
    for (const locale of ["", "en/"]) {
      // Real delayed module loading in a fresh context. Record painted frames,
      // rather than inferring the absence of a flash from the settled page.
      const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await p.addInitScript(({ prefix, readyClass }) => {
        window.layoutPaintFrames = [];
        function frame() {
          const sidebar = document.getElementById("quarto-sidebar");
          const panel = document.getElementById(`${prefix}-page-toc-panel`);
          if (sidebar && panel) {
            const s = getComputedStyle(sidebar), r = sidebar.getBoundingClientRect();
            const ready = document.body.classList.contains(readyClass);
            window.layoutPaintFrames.push({ ready, oldVisible: s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0, x: panel.getBoundingClientRect().x });
            if (ready) return;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }, { prefix, readyClass });
      await p.route("**/quarto-html/quarto.js", async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.continue();
      });
      await p.goto(`${base}/${locale}${route}`);
      await p.waitForTimeout(100);
      const frames = await p.evaluate(() => window.layoutPaintFrames);
      assert(frames.length && frames.some(f => f.ready), `${name}/${locale}: no paint samples`);
      assert(frames.every(f => !f.oldVisible && Math.abs(f.x) < 1), `${name}/${locale}: old navigation or right-hand TOC flashed`);
      await p.close();
      paintChecks++;

      for (const colorScheme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme });
        await page.addInitScript(() => {
          // Native conflict discovery runs on DOM ready. Register the aside
          // first so this proves isolation from that actual manager.
          document.addEventListener("DOMContentLoaded", () => {
            const aside = document.createElement("aside");
            aside.style.cssText = "position:fixed;top:120px;right:10px;width:20px;height:500px";
            document.body.append(aside);
          }, { once: true });
        });
        await page.goto(`${base}/${locale}${route}`);
        for (const width of [1440, 1100, 1099, 820, 768, 767, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          const mobile = width < 768;
          if (mobile) {
            // Headroom intentionally hides the phone header after scrolling
            // down. Return to the top before interacting with its trigger.
            await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
            await page.waitForTimeout(250);
            await page.locator(`.${prefix}-mobile-toc-toggle`).click();
            await page.waitForTimeout(200);
          }
          for (const y of [0, 120, 480]) {
            await page.evaluate(y => scrollTo(0, y), y);
            await page.waitForTimeout(80);
            check(await state(page), `${name}/${locale}/${colorScheme}/${width}/${y}`);
            collisions++;
          }
          if (mobile) {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(100);
            assert.equal(await page.locator(`.${prefix}-mobile-toc-toggle`).getAttribute("aria-expanded"), "false");
            assert(await page.evaluate(prefix => document.activeElement.classList.contains(`${prefix}-mobile-toc-toggle`), prefix));
          }
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        const link = page.locator(`#${prefix}-page-toc-panel #TOC > ul > li > a[data-scroll-target]`).first();
        const hash = await link.getAttribute("data-scroll-target");
        await link.click();
        assert.equal(decodeURIComponent(new URL(page.url()).hash), decodeURIComponent(hash));
        await page.waitForFunction(hash => [...document.querySelectorAll("#TOC a.active")].some(a => a.getAttribute("data-scroll-target") === hash), hash);
        await page.reload();
        await page.waitForTimeout(200);
        check(await state(page), `${name}/${locale}/${colorScheme}/reload`);
        // Quarto's target spacer overlaps the preceding Memory disclosure.
        // Its transparent area must allow a real pointer click through.
        await page.locator('#TOC a[data-scroll-target="#sprite-viewer"]').click();
        await page.waitForFunction(() => document.querySelector('#toc-sprite-viewer').classList.contains('active'));
        const summary = page.locator('main details.dw-memory-browse > summary');
        await summary.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.waitForFunction(() => document.querySelector('#quarto-header').getBoundingClientRect().top === 0);
        const beforeDisclosure = await page.evaluate(() => scrollY);
        await summary.click();
        await page.waitForFunction(() => document.querySelector('details.dw-memory-browse').open);
        assert.equal(await page.evaluate(() => scrollY), beforeDisclosure, 'Target-adjacent disclosure must open without jumping');
        assert.equal(new URL(page.url()).hash, '#sprite-viewer', 'Disclosure must keep the existing fragment');
        const viewerTab = page.locator('#sprite-viewer .dw-viewer-tabs [role="tab"]').nth(1);
        await viewerTab.click();
        assert.equal(await viewerTab.getAttribute('aria-selected'), 'true', 'Target section controls must retain pointer interaction');
        // Language switching must still target the other locale, including
        // the original independently localized PW controls.
        const language = page.locator(`.${prefix}-language-switch`);
        if (await language.count()) {
          const target = new URL(await language.getAttribute("href"), page.url());
          assert.equal(target.pathname.includes("/en/"), !locale);
        }
        // A heading followed closely by a child exposes a dropped trailing
        // scrollspy update after Quarto's hashchange header adjustment.
        await page.setViewportSize({ width: 1100, height: 600 });
        await page.goto(`${base}/${locale}reference/interventions.html`);
        const chapters = page.locator('#TOC > ul > li');
        const chapter = await chapters.evaluateAll(es => es.map((e, index) => ({ index, children: e.querySelectorAll('ul a').length })).sort((a, b) => b.children - a.children)[0]);
        const chapterLink = chapters.nth(chapter.index).locator(':scope > a');
        const chapterHash = await chapterLink.getAttribute('data-scroll-target');
        // Browse the long default-expanded rail before activating an offscreen
        // title, just as a real pointer user does; this pauses edge following.
        await page.mouse.move(100, 350);
        await page.waitForTimeout(40);
        await chapterLink.evaluate(link => link.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await chapterLink.click();
        await page.waitForFunction(hash => new Promise(resolve => {
          const y = scrollY;
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(
            y === scrollY && document.querySelector(`#TOC a[data-scroll-target="${hash}"]`).classList.contains('active')
          )));
        }), chapterHash);
        assert.equal(decodeURIComponent(new URL(page.url()).hash), chapterHash);
        await page.close();
      }
    }
    console.log(`${name}: PASS first-paint=${paintChecks} collision/scroll=${collisions}; both locales/themes, desktop/tablet/mobile, fragments, reload and Escape`);
  } finally { await browser.close(); }
}
(async () => {
  // Check every assembled page, not just the interactive collection sample.
  let panels = 0;
  for (const file of fs.readdirSync(output, { recursive: true })) {
    if (!file.endsWith(".html") || file.includes("site_libs")) continue;
    const text = fs.readFileSync(path.join(output, file), "utf8");
    assert(!text.includes("quarto-margin-sidebar"), `${file}: native margin ownership remains`);
    if (text.includes('id="TOC"')) {
      assert.equal(text.split(`id="${prefix}-page-toc-panel"`).length - 1, 1, `${file}: panel count`);
      panels++;
    }
  }
  console.log(`All-page TOC ownership: PASS panels=${panels}`);
  await run("Edge", chromium, { executablePath: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" });
  await run("WebKit", webkit, process.env.WEBKIT_EXECUTABLE ? { executablePath: process.env.WEBKIT_EXECUTABLE } : {});
})().catch(error => { console.error(error); process.exitCode = 1; });
