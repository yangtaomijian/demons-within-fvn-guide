import {CONFIG} from './config.mjs';
import {t} from './strings.mjs';
import {questionLengths} from './question-limits.mjs';
import {questionLanguage,languageClarification} from './question-language.mjs';
import {createPanelTransport, percentage,descriptions,feedbackFor,availabilityText} from './adapter.mjs';
(() => {
  'use strict';
  // Same-origin product panel; keep the guide's own navigation and TOC.

  const narrow = matchMedia('(max-width: 1099px)');
  // Restore a visible reading point after desktop column/record reflow, not old scrollY.
  let readingTransaction;
  function readingPoint() {
    const main = document.querySelector('main.content'), header = document.getElementById('quarto-header');
    if (!main) return null;
    const top = (header?.getBoundingClientRect().bottom || 0) + 12;
    const visible = el => { const r = el.getBoundingClientRect(); return r.height > 2 && r.top >= top && r.top < innerHeight * .55; };
    // Prefer the section near the upper reading area over a preceding heading
    // that has only just cleared the fixed header.
    const readingY = top + Math.min(180, (innerHeight - top) / 4);
    const heading = [...main.querySelectorAll('h1,h2,h3,h4')].filter(visible)
      .sort((a,b) => Math.abs(a.getBoundingClientRect().top - readingY) - Math.abs(b.getBoundingClientRect().top - readingY))[0];
    const tableAbove = heading && [...main.querySelectorAll('table')].some(el => { const r = el.getBoundingClientRect(); return r.bottom > top && r.top < heading.getBoundingClientRect().top; });
    if (heading && (!tableAbove || heading.getBoundingClientRect().top <= readingY + 80)) return { rect: () => heading.getBoundingClientRect(), y: heading.getBoundingClientRect().top };
    const r = main.getBoundingClientRect(), x = r.left + parseFloat(getComputedStyle(main).paddingLeft) + Math.min(32, r.width / 8);
    for (let y = Math.max(top, r.top + 2); y < innerHeight - 24; y += 16) {
      let range = document.caretRangeFromPoint?.(x, y);
      if (!range && document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); range.collapse(true); } }
      const text = range?.startContainer, parent = text?.parentElement;
      if (text?.nodeType !== Node.TEXT_NODE || !text.textContent.trim() || parent?.closest('[aria-hidden="true"]') || !parent?.closest('main.content,footer.footer')) continue;
      range = range.cloneRange(); range.setEnd(text, Math.min(text.length, range.startOffset + 1));
      const at = range.getBoundingClientRect();
      if (at.height > 2 && at.top >= top - 2 && at.top < innerHeight) return { rect: () => range.getBoundingClientRect(), y: at.top };
    }
    // Table gutters can yield an element caret rather than a text caret.
    // Fall back to an actual visible glyph, keeping its DOM text/offset even
    // when a row becomes a stack of labelled fields.
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      if (!text.textContent.trim() || text.parentElement?.closest('[aria-hidden="true"]')) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      if (![...range.getClientRects()].some(box => box.height > 2 && box.width > 2 && box.right > r.left && box.left < r.right && box.bottom > top && box.top < innerHeight - 24)) continue;
      for (let offset = 0; offset < text.length; offset++) {
        range.setStart(text, offset); range.setEnd(text, offset + 1);
        const box = range.getBoundingClientRect();
        if (box.height > 2 && box.width > 0 && box.top >= top - 2 && box.top < innerHeight - 24 && box.right > r.left && box.left < r.right)
          return { rect: () => range.getBoundingClientRect(), y: box.top };
      }
    }
    return null;
  }
  function preserveReading(change) {
    readingTransaction?.();
    if (narrow.matches) return change();
    const point = readingPoint();
    if (!point) return change();
    // Browsers round scroll offsets to pixels. Keep a stable pixel target so
    // repeated open/close cycles cannot accumulate half-pixel drift.
    point.y = Math.round(point.y);
    const root = document.documentElement, previous = root.style.overflowAnchor;
    let frame = 0, count = 0, stable = 0, lastHeight = -1, stopped = false;
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(frame); root.style.overflowAnchor = previous; events.forEach(name => document.removeEventListener(name, stop, true)); window.removeEventListener('hashchange', stop); if (readingTransaction === stop) readingTransaction = null; document.dispatchEvent(new Event('dw:reading-layout-settled')); };
    readingTransaction = stop; root.style.overflowAnchor = 'none';
    events.forEach(name => document.addEventListener(name, stop, {capture:true,passive:true})); window.addEventListener('hashchange', stop);
    const restore = () => { const rect = point.rect(); if (rect.height > 2) { const delta = rect.top - point.y; const next = Math.round(scrollY + delta); if (Math.abs(delta) > .01 && next !== scrollY) scrollTo({top:next,left:scrollX,behavior:'instant'}); } };
    try { change(); document.dispatchEvent(new Event('dw:reading-columns-change')); restore(); } catch (error) { stop(); throw error; }
    const settle = () => { if (stopped) return; restore(); const height = root.scrollHeight; stable = height === lastHeight ? stable + 1 : 0; lastHeight = height; if (++count >= 8 || stable >= 3) stop(); else frame = requestAnimationFrame(settle); };
    frame = requestAnimationFrame(settle);
  }
  const search = document.querySelector('.dw-search-launcher');
  if (!search || document.getElementById('dw-ai-launcher')) return;
  const node = (tag, text, attrs = {}) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    return el;
  };
  const launcher = node('button', undefined, { id: 'dw-ai-launcher', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'dw-ai-panel' });
  launcher.append(node('span', t('AI 问攻略')), node('span', 'Closed Beta', { class: 'dw-ai-mode' }));
  search.after(launcher);
  const panel = node('aside', undefined, { id: 'dw-ai-panel', 'aria-labelledby': 'dw-ai-title' });
  panel.hidden = true;
  const head = node('div', undefined, { class: 'dw-ai-head' });
  const heading = node('div');
  heading.append(node('h2', t('问攻略'), { id: 'dw-ai-title' }), node('span', 'Closed Beta', { class: 'dw-ai-eyebrow' }));
  const close = node('button', t('关闭'), { id: 'dw-ai-close', type: 'button', 'aria-label': t('关闭 AI 面板') });
  head.append(heading, close);
  const scroll = node('div', undefined, { class: 'dw-ai-scroll' });
  const notice = node('div', undefined, { class:'dw-ai-notice', 'aria-label':t('登录与测试资格') });
  let sessionPhase='checking',googlePhase='loading',googleMessage='',loggingOut=false;
  const identity = node('p',t('正在确认登录…'),{id:'dw-ai-identity',class:'dw-ai-permission'});
  const account = node('div', undefined, {class:'dw-ai-account'});
  const google = node('button',t('Google 登录'),{id:'google',type:'button',title:t('Google 登录')}); google.disabled=true;
  const gis = node('div',undefined,{id:'google-gis'});
  const logout = node('button',t('退出'),{type:'button'}); logout.hidden=true;
  const sessionRetry=node('button',t('重新读取'),{id:'dw-ai-session-retry',type:'button'});sessionRetry.hidden=true;
  const ownerLogin=node('a',t('站主登录（受限）'),{id:'dw-ai-owner-login',href:'/__owner/login',class:'dw-ai-text-button'});ownerLogin.hidden=true;
  account.append(google,gis,logout,sessionRetry,ownerLogin);
  const permission = node('p',t('正在确认测试资格…'),{id:'dw-ai-quota',class:'dw-ai-quota'});
  const modeCheck = node('p','',{id:'dw-ai-mode-check',class:'dw-ai-note'}); modeCheck.hidden=true;
  const funds = node('details',undefined,{class:'dw-ai-funds'}); funds.hidden=true;
  const budget = node('p','',{id:'dw-ai-budget',class:'dw-ai-note'});
  funds.append(node('summary',t('可用额度详情')),budget);
  const betaApply=node('button',t('申请 Beta'),{id:'dw-ai-beta-apply',type:'button',class:'dw-ai-text-button'});betaApply.hidden=true;
  document.addEventListener('dw:beta-application-ready',()=>sync());
  notice.append(identity,account,permission,modeCheck,funds,betaApply);
  const query = node('button',t('查看进度'),{id:'dw-ai-query',type:'button'}); query.hidden=true;
  const privacyCopy=t('启用 AI 问答后，问题和相关攻略材料会由 OpenAI 处理。本站不保存问答正文；OpenAI 按其政策处理数据，不能保证零保留。请勿填写账号信息、密钥或其他敏感内容。');
  let privacyReviewed=false,composing=false,compositionEndedAt=0,sending=false,cancelling=false,manualCheckNeeded=false;
  const privacyFirst=node('section',undefined,{id:'dw-ai-privacy-first',class:'dw-ai-privacy-first','aria-labelledby':'dw-ai-privacy-heading'});
  const privacyAck=node('button',t('我已了解，继续输入'),{id:'dw-ai-privacy-ack',type:'button'});
  const privacyMore=node('button',t('查看隐私说明'),{type:'button',class:'dw-ai-text-button'});
  privacyFirst.append(node('h3',t('提问前，请先了解'),{id:'dw-ai-privacy-heading'}),
    node('p',t('可以先输入问题。首次发送前，请确认已阅读以下说明。')),
    node('p',t('AI 可能误读或遗漏攻略条件，请核对引用原文。')),
    node('p',t('无法读取你的游戏存档；请在问题中说明路线与进度。')),
    node('p',t('启用 AI 问答后，问题与相关攻略材料会由 OpenAI 处理；详见「隐私与数据」。')),
    node('p',t('DW AI 当前仅向已获授权的站主账户开放限定测试；登录不会自动获得测试资格。Public 14.6；回答语言跟随问题，证据与引用采用英文 canonical 来源。')),privacyAck,privacyMore);
  const empty=node('p',t('想查哪段攻略？在下方写下你的问题。'),{class:'dw-ai-empty'});
  const result=node('section',undefined,{id:'dw-ai-result','aria-label':t('问题与回答')});result.hidden=true;
  const scope=node('p',t('可选的 AI 问答工具，只检索本站公开的攻略资料，并根据检索结果生成回答。它不会搜索其他网站，也不会读取游戏代码或非公开内容。主线攻略和参考页面独立维护。'),{id:'dw-ai-scope',class:'dw-ai-note'});
  scroll.append(scope,privacyFirst,query,empty,result);
  const form=node('form',undefined,{id:'dw-ai-form'});
  const label=node('label',t('你的问题'),{for:'dw-ai-question',class:'dw-ai-sr-only'});
  const input=node('textarea',undefined,{id:'dw-ai-question',rows:'2',placeholder:t('想了解什么？'),'aria-describedby':'dw-ai-status dw-ai-length-help'});
  const composer=node('div',undefined,{class:'dw-ai-composer'});
  const lengthCounter=node('span','',{id:'dw-ai-length',role:'status','aria-live':'polite','aria-atomic':'true'});lengthCounter.hidden=true;
  const lengthHelp=node('span','',{id:'dw-ai-length-help',class:'dw-ai-sr-only'});
  const send=node('button',undefined,{id:'dw-ai-send',type:'button','aria-label':t('发送问题'),title:t('发送问题')});send.disabled=true;
  const restoreQuestion=node('button',t('恢复本题到输入框'),{id:'dw-ai-restore-question',type:'button',class:'dw-ai-text-button'});
  restoreQuestion.addEventListener('click',()=>{
    if(restoreQuestion.disabled||input.value!==''||!current?.question)return;
    input.value=current.question;sizeInput();sync();input.focus({preventScroll:true});
  });
  const svgNS='http://www.w3.org/2000/svg';
  function icon(kind){const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('dw-ai-icon-'+kind);const shape=document.createElementNS(svgNS,kind==='arrow'?'path':'rect');if(kind==='arrow'){shape.setAttribute('d','M12 19V5M5 12l7-7 7 7');shape.setAttribute('fill','none');shape.setAttribute('stroke','currentColor');shape.setAttribute('stroke-width','2');shape.setAttribute('stroke-linecap','round');shape.setAttribute('stroke-linejoin','round');}else{for(const [k,v] of Object.entries({x:7,y:7,width:10,height:10,rx:1,fill:'currentColor'}))shape.setAttribute(k,v);}svg.append(shape);return svg;}
  send.append(icon('arrow'),icon('stop'));composer.append(label,input,lengthCounter,lengthHelp,send);
  const footer=node('div',undefined,{class:'dw-ai-form-footer'});
  const status=node('span','',{id:'dw-ai-status',role:'status','aria-live':'polite','aria-atomic':'true'});
  const quality=node('span',t('AI 可能出错 · 请核对引用原文'),{id:'dw-ai-quality'});
  const privacyLink=node('button',t('隐私与数据'),{id:'dw-ai-privacy-link',type:'button',class:'dw-ai-text-button'});
  footer.append(quality,privacyLink);form.append(composer,status,footer);
  const privacyDialog=node('dialog',undefined,{id:'dw-ai-privacy-dialog','aria-labelledby':'dw-ai-privacy-title'});
  const privacyClose=node('button',t('返回'),{type:'button','aria-label':t('关闭隐私说明')});
  const privacyConfirm=node('button',t('我已了解，发送此问题'),{id:'dw-ai-privacy-confirm',type:'button'});privacyConfirm.hidden=true;
  let pendingConsentQuestion=null;
  privacyDialog.append(node('h3',t('隐私说明'),{id:'dw-ai-privacy-title'}),node('p',privacyCopy),node('p',t('AI 可能出错；攻略材料可能包含后续剧情，本工具不提供严格剧透过滤。请核对引用原文。')),node('p',t('服务保留必要的请求状态、额度结算与防滥用记录。问答正文仅在当前页面显示；刷新后不会恢复。')),node('p',t('为防止额度重复领取，服务长期保留与 Google 账户关联的身份摘要、已用试用题数和退出标记；重新登录、退出或停用账户不会重置题数。已结清账务明细保留 90 天，之后保留累计费用汇总；未结责任保留至人工核对完成。')),privacyConfirm,privacyClose);
  function openPrivacy(forSend=false){pendingConsentQuestion=forSend?input.value:null;privacyConfirm.hidden=!forSend;privacyDialog.showModal();}
  privacyLink.addEventListener('click',()=>openPrivacy());privacyMore.addEventListener('click',()=>openPrivacy());privacyClose.addEventListener('click',()=>privacyDialog.close());
  privacyDialog.addEventListener('close',()=>{pendingConsentQuestion=null;privacyConfirm.hidden=true;});
  privacyConfirm.addEventListener('click',()=>{const question=pendingConsentQuestion;privacyReviewed=true;privacyFirst.hidden=true;privacyDialog.close();sync();if(question!==null&&question===input.value)submit();});
  privacyAck.addEventListener('click',()=>{privacyReviewed=true;privacyFirst.hidden=true;sync();input.focus({preventScroll:true});});
  panel.append(head,notice,scroll,form,privacyDialog);document.body.append(panel);
  const popover = node('div', undefined, { id: 'dw-ai-source-preview', class: 'dw-ai-source-popover', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'dw-ai-source-title' });
  popover.hidden = true;
  const previewHead = node('div', undefined, { class: 'dw-ai-source-head' });
  const previewTitle = node('h3', t('来源节选'), { id: 'dw-ai-source-title' });
  const previewClose = node('button', t('关闭'), { type: 'button', id: 'dw-ai-source-close', 'aria-label': t('关闭来源预览') });
  previewHead.append(previewTitle, previewClose);
  const previewMode = node('p', '', { class: 'dw-ai-note', id: 'dw-ai-source-mode' });
  const previewBody = node('div', undefined, { class: 'dw-ai-source-body', tabindex: '0', 'aria-label': t('来源节选内容') });
  const previewActions = node('div', undefined, { class: 'dw-ai-source-actions' });
  const read = node('button', t('阅读原文'), { type: 'button', id: 'dw-ai-source-read' });
  const full = node('a', t('打开完整攻略 ↗'), { target: '_blank', rel: 'noopener noreferrer', id: 'dw-ai-source-full' });
  previewActions.append(read, full); popover.append(previewHead, previewMode, previewBody, previewActions); panel.append(popover);
  const reader = node('section', undefined, { id: 'dw-ai-source-reader', class: 'dw-ai-source-reader', 'aria-label': t('来源阅读') });
  reader.hidden = true;
  const back = node('button', t('← 返回回答'), { type: 'button', id: 'dw-ai-source-back' });
  const sheetBackdrop = node('div', undefined, { id: 'dw-ai-source-backdrop', 'aria-hidden': 'true' });
  sheetBackdrop.hidden = true; panel.append(sheetBackdrop);
  const sheetHead = node('div', undefined, { class: 'dw-ai-sheet-head' });
  const sheetClose = node('button', t('关闭来源'), { type: 'button', id: 'dw-ai-source-sheet-close' });
  const sheetExpand = node('button', t('展开阅读'), { type: 'button', id: 'dw-ai-source-expand', 'aria-expanded': 'false' });
  const sheetLabel=node('span',t('来源节选'));
  sheetHead.append(sheetClose,sheetLabel,sheetExpand);
  const readerTitle = node('h3');
  const readerLocale = node('p', '', { class: 'dw-ai-note' });
  const readerText = node('div', undefined, { class: 'dw-ai-source-text' });
  const readerFull = node('a', t('打开完整攻略 ↗'), { target: '_blank', rel: 'noopener noreferrer' });
  const readerPrivacy=node('button',t('隐私与数据'),{type:'button',class:'dw-ai-text-button'});readerPrivacy.addEventListener('click',()=>privacyDialog.showModal());
  reader.append(sheetHead, back, readerTitle, readerLocale, readerText, readerFull,readerPrivacy); panel.insertBefore(reader, form);
  let busy = true, serverBusy = false, ready = false, uncertain = false, trialState = null, current = null;
  let returnTarget = launcher, frozenPage = null;
  let activeSource = null, readerState = null, hideTimer = null, suppressedFocusTrigger = null, pointerFocusTrigger = null, citationNumber = 0;
  const transport = createPanelTransport({onSession:onSnapshot,onStateChange:sync});
  const cancelHide = () => { clearTimeout(hideTimer); hideTimer = null; };
  function restoreCitationFocus(trigger) {
    suppressedFocusTrigger = trigger;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }
  function dismissSource(restoreFocus = true) {
    cancelHide();
    const trigger = activeSource?.trigger;
    trigger?.setAttribute('aria-expanded', 'false');
    activeSource = null; popover.hidden = true;
    if (restoreFocus) restoreCitationFocus(trigger);
  }
  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(() => {
      if (!activeSource || popover.matches(':hover') || activeSource.trigger.matches(':hover')) return;
      // Mouse preview lifetime follows the pointer, even if an earlier action
      // left focus on the citation or scrolling content. Keyboard is separate.
      if (activeSource.kind === 'pointer' || !popover.contains(document.activeElement) && document.activeElement !== activeSource.trigger) dismissSource(false);
    }, 240);
  }
  function canonicalURL(value) { return transport.safeSourceURL(value); }
  function loadSources() {
    // The backend binds this question's verified excerpts or section links.
    return Promise.resolve(new Map([...transport.sources()].filter(([url, source]) => canonicalURL(url) && ['en','zh'].includes(source.locale) && typeof source.title === 'string' && (typeof source.text === 'string' || source.mappingType === 'section' || source.variants?.section))));
  }
  async function sourceFor(reference) {
    const group=(await loadSources()).get(canonicalURL(reference.url));
    return group?.variants?.[reference.mappingType??'excerpt']??group;
  }
  function placeSource() {
    if (!activeSource || popover.hidden) return;
    const anchor = activeSource.trigger.getBoundingClientRect();
    const minimum = head.getBoundingClientRect().top + 12;
    const maximum = Math.max(minimum, innerHeight - popover.getBoundingClientRect().height - 12);
    popover.style.top = Math.min(maximum, Math.max(minimum, anchor.top - 12)) + 'px';
  }
  async function showSource(trigger, reference, kind = 'pointer') {
    if (narrow.matches || readerState) return;
    cancelHide();
    if (activeSource?.trigger === trigger) { activeSource.kind = kind; return; }
    dismissSource(false);
    const state = { trigger, reference, kind, source: null };
    activeSource = state; trigger.setAttribute('aria-expanded', 'true');
    previewTitle.textContent = reference.label;
    const chapter=reference.mappingType==='section';
    previewMode.textContent = chapter?'中文对应章节':t('来源节选 · 点击引用可阅读原文');
    previewBody.hidden=chapter;read.textContent=t(chapter?'查看章节':'阅读原文');
    previewBody.replaceChildren(...(chapter?[]:[node('p', t('正在读取本题来源节选…'))]));
    previewBody.scrollTop = 0; read.disabled = true;
    full.href = canonicalURL(reference.url); popover.hidden = false; placeSource();
    const source = await sourceFor(reference);
    if (activeSource !== state) return;
    state.source = source || null;
    if (source) {
      previewTitle.textContent = source.title;
      const section=source.mappingType==='section';
      previewBody.hidden=section;previewBody.replaceChildren(...(section?[]:[node('div', source.text, { class: 'dw-ai-source-text' })]));
      previewMode.textContent = section?'中文对应章节':source.locale === 'zh' ? '来源节选 · 中文原文' : 'Source excerpt · English original';
      read.textContent=t(section?'查看章节':'阅读原文');
      read.disabled = false;
    } else {
      previewBody.replaceChildren(node('p', t('暂时无法显示这条来源的节选，可打开完整攻略核对。')));
    }
    placeSource();
  }
  async function openSourceReader(trigger, reference) {
    if (readerState) return;
    const state = { trigger, answerScroll: scroll.scrollTop, mobile: narrow.matches, inert: [] };
    readerState = state; dismissSource(false);
    reader.setAttribute('role', state.mobile ? 'dialog' : 'region');
    if (state.mobile) reader.setAttribute('aria-modal', 'true');
    trigger.setAttribute('aria-expanded', 'true');
    readerTitle.textContent = reference.label;
    const chapter=reference.mappingType==='section';
    sheetLabel.textContent=chapter?'中文对应章节':reference.locale==='zh'?'中文原文摘录':'Source excerpt';
    readerLocale.textContent = chapter?'中文对应章节':t('来源节选 · 本题引用的攻略资料');
    readerText.hidden=chapter;readerText.textContent = chapter?'':t('正在读取本题来源节选…'); readerFull.href = canonicalURL(reference.url);
    if (state.mobile) {
      state.inert = [head, notice, scroll, form].map(el => ({ el, was: el.hasAttribute('inert') }));
      state.inert.forEach(({ el }) => el.setAttribute('inert', ''));
      sheetBackdrop.hidden = false; panel.classList.add('dw-ai-source-open');
      reader.classList.remove('dw-ai-sheet-expanded'); sheetExpand.textContent = t('展开阅读'); sheetExpand.setAttribute('aria-expanded', 'false');
    } else scroll.hidden = true;
    reader.hidden = false; reader.scrollTop = 0;

    (state.mobile ? sheetClose : back).focus({ preventScroll: true });
    const source = await sourceFor(reference);
    if (readerState !== state) return;
    if (source) {
      readerTitle.textContent = source.title;
      const section=source.mappingType==='section';
      readerLocale.textContent = section?'中文对应章节':source.locale === 'zh' ? '来源节选 · 中文原文 · 本题引用的攻略资料' : 'Source excerpt · English original · Guide material cited for this question';
      readerText.hidden=section;readerText.textContent = section?'':source.text;
    } else readerText.textContent = t('暂时无法显示这条来源的节选，可打开完整攻略核对。');
  }
  function returnToAnswer(restoreFocus = true) {
    if (!readerState) return;
    const state = readerState; readerState = null;
    state.trigger.setAttribute('aria-expanded', 'false');
    heading.querySelector('h2').textContent = t('问攻略');
    state.inert.forEach(({ el, was }) => was ? el.setAttribute('inert', '') : el.removeAttribute('inert'));
    sheetBackdrop.hidden = true; panel.classList.remove('dw-ai-source-open'); reader.classList.remove('dw-ai-sheet-expanded');
    sheetExpand.textContent = t('展开阅读'); sheetExpand.setAttribute('aria-expanded', 'false');
    reader.hidden = true; scroll.hidden = false; scroll.scrollTop = state.answerScroll;
    reader.removeAttribute('aria-modal');
    if (restoreFocus) restoreCitationFocus(state.trigger);
  }
  previewClose.addEventListener('click', () => dismissSource());
  popover.addEventListener('pointerenter', cancelHide);
  popover.addEventListener('pointerleave', scheduleHide);
  popover.addEventListener('focusin', () => activeSource?.kind === 'keyboard' ? cancelHide() : scheduleHide());
  popover.addEventListener('focusout', scheduleHide);
  popover.addEventListener('keydown', () => { if (activeSource) { activeSource.kind = 'keyboard'; cancelHide(); } });
  read.addEventListener('click', () => {
    if (activeSource) openSourceReader(activeSource.trigger, activeSource.reference);
  });
  back.addEventListener('click', () => returnToAnswer());
  sheetClose.addEventListener('click', () => returnToAnswer());
  sheetBackdrop.addEventListener('click', () => returnToAnswer());
  sheetExpand.addEventListener('click', () => {
    const expanded = reader.classList.toggle('dw-ai-sheet-expanded');
    sheetExpand.textContent = expanded ? t('收起阅读') : t('展开阅读'); sheetExpand.setAttribute('aria-expanded', String(expanded));
  });
  scroll.addEventListener('scroll', () => dismissSource(false));
  function limitReason(){if(CONFIG.provider==='DISABLED')return t('AI 问答尚未开放');return trialState?.ready?'':t(availabilityText(trialState)??descriptions[trialState?.code])||t('暂未接收请求；可继续阅读攻略。');}
  function sync(){
    const state=transport.state(),pilot=trialState?.beta?.pilot;
    const lengths=updateLength();
    const stopping=cancelling||sending||!!state.activeId;
    send.dataset.action=stopping?'stop':'send';
    const accessible=cancelling?t('正在请求停止'):stopping?t('停止回答'):t('发送问题');
    send.setAttribute('aria-label',accessible);send.title=accessible;send.setAttribute('aria-busy',String(cancelling));
    send.disabled=stopping?cancelling||!trialState?.authenticated||!state.activeId:busy||state.busy||state.uncertain||!trialState?.authenticated||trialState?.beta?.approved!==true||!ready||pilot?.configured!==true||pilot.used===true||pilot.poolRemaining===0||pilot.rolling24hAvailable===false||composing||lengths.over||!input.value.trim();
    input.readOnly=sending||cancelling||state.busy;
    restoreQuestion.disabled=busy||input.readOnly||input.value!==''||!current?.question;
    restoreQuestion.title=input.value!==''?t('输入框已有草稿；清空后可恢复本题。'):t('恢复本题到输入框');
    query.hidden=!state.activeId||(!manualCheckNeeded&&!state.uncertain&&sending);
    query.disabled=cancelling||!trialState?.authenticated;
    renderAccount();
    empty.hidden=!result.hidden;result.setAttribute('aria-busy',String(sending||cancelling));
  }
  function updateLength(){
    const lengths=questionLengths(input.value);
    const hint=lengths.over?t('问题过长，请精简后发送'):lengths.near?t('即将达到上限'):t('已输入 {length}',{length:lengths.utf16});
    lengthCounter.hidden=document.activeElement!==input&&!input.value.length;
    lengthCounter.dataset.state=lengths.over?'over':lengths.near?'near':'normal';
    lengthCounter.textContent=hint;
    const details=t('已输入 {length}（按 UTF-16 单位计数）。是否可发送取决于实际处理容量。',{length:lengths.utf16});
    lengthCounter.title=details+(lengths.over||lengths.near?' '+hint:'');lengthCounter.setAttribute('aria-label',lengthCounter.title);lengthHelp.textContent=lengthCounter.title;
    input.setAttribute('aria-invalid',String(lengths.over));
    return lengths;
  }
  function sizeInput(){input.style.height='auto';input.style.height=Math.min(184,Math.max(112,input.scrollHeight))+'px';if(document.activeElement===input&&input.selectionEnd===input.value.length)input.scrollTop=input.scrollHeight;}
  function position() {
    const bottom = document.getElementById('quarto-header')?.getBoundingClientRect().bottom || 68.3;
    panel.style.setProperty('--dw-ai-top', Math.max(0, bottom) + 'px');
    if (narrow.matches) {
      const viewport = window.visualViewport;
      panel.style.setProperty('--dw-ai-mobile-top', (viewport?.offsetTop || 0) + 'px');
      panel.style.setProperty('--dw-ai-mobile-height', (viewport?.height || innerHeight) + 'px');
    }
  }
  function placeLauncher() {
    const mobileRow = document.querySelector('#dw-mobile-toolbar .dw-toolbar-tools');
    mobileRow?.classList.toggle('dw-ai-mobile-entry', narrow.matches);
    if (narrow.matches && mobileRow) mobileRow.append(launcher);
    else search.after(launcher);
    launcher.firstElementChild.textContent = narrow.matches ? 'AI' : t('AI 问攻略');
    launcher.setAttribute('aria-label', t('AI 问攻略（Closed Beta）'));

  }
  function freezePage() {
    if (frozenPage) return;
    frozenPage = { x: scrollX, y: scrollY, styles: {}, inert: [] };
    for (const name of ['position', 'top', 'left', 'width', 'overflow']) frozenPage.styles[name] = document.body.style[name];
    for (const el of document.body.children) if (el !== panel && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName)) {
      frozenPage.inert.push({ el, was: el.hasAttribute('inert') }); el.setAttribute('inert', '');
    }
    document.body.style.position = 'fixed'; document.body.style.top = -frozenPage.y + 'px'; document.body.style.left = -frozenPage.x + 'px'; document.body.style.width = '100%'; document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('dw-ai-mobile-modal-open'); document.body.classList.add('dw-ai-mobile-modal-open');
  }
  function releasePage() {
    if (!frozenPage) return;
    const saved = frozenPage; frozenPage = null;
    for (const [name, value] of Object.entries(saved.styles)) document.body.style[name] = value;
    saved.inert.forEach(({ el, was }) => was ? el.setAttribute('inert', '') : el.removeAttribute('inert'));
    document.documentElement.classList.remove('dw-ai-mobile-modal-open'); document.body.classList.remove('dw-ai-mobile-modal-open');
    window.scrollTo(saved.x, saved.y);
  }
  function openPanel({ origin = launcher, draft } = {}) {
    if (panel.hidden) {
      returnTarget = origin;
      if (narrow.matches) {
        document.getElementById('dw-page-toc-close')?.click(); document.getElementById('dw-global-nav-close')?.click();
        freezePage();
      }
    }
    if (draft !== undefined && !busy && !serverBusy) {
      dismissSource(false); returnToAnswer(false); input.value = draft; sizeInput();sync();
      status.textContent = draft.trim() ? t('已带入搜索文字') : '';
    }
    preserveReading(() => {
      panel.hidden = false; document.body.classList.add('dw-ai-open'); launcher.setAttribute('aria-expanded', 'true');
      panel.setAttribute('role', narrow.matches ? 'dialog' : 'complementary');
      if (narrow.matches) panel.setAttribute('aria-modal', 'true'); else panel.removeAttribute('aria-modal');
      position(); (narrow.matches ? close : input).focus({ preventScroll: true });
    });
    if (!busy) recover();
  }
  function closePanel() {
    dismissSource(false); returnToAnswer(false);
    preserveReading(() => {
      panel.hidden = true; document.body.classList.remove('dw-ai-open'); launcher.setAttribute('aria-expanded', 'false');
      panel.removeAttribute('aria-modal'); releasePage();
      (returnTarget?.isConnected ? returnTarget : launcher).focus({ preventScroll: true });
    });
  }
  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
  close.addEventListener('click', closePanel);
  document.addEventListener('keydown', event => {
    if(document.getElementById('dw-beta-application')?.open)return;
    if(privacyDialog.open&&event.key!=='Tab')return;
    if (event.key === 'Tab' && !panel.hidden && (narrow.matches||privacyDialog.open)) {
      const layer = privacyDialog.open ? privacyDialog : readerState ? reader : panel;
      const focusable = [...layer.querySelectorAll('button,a[href],input,textarea,summary,[tabindex]')].filter(el => !el.disabled && el.getClientRects().length && !el.closest('[hidden],[inert]') && el.tabIndex >= 0);
      const index = focusable.indexOf(document.activeElement);
      if (focusable.length) {
        event.preventDefault();
        const next=index<0?(event.shiftKey?focusable.length-1:0):(index+(event.shiftKey?-1:1)+focusable.length)%focusable.length;
        focusable[next].focus();
      }
    }
    if (event.key === 'Escape' && !event.defaultPrevented && !panel.hidden && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      if (activeSource) dismissSource();
      else if (readerState) returnToAnswer();
      else closePanel();
    }
  });
  narrow.addEventListener('change', () => { if (!panel.hidden) closePanel(); placeLauncher(); position(); });
  window.addEventListener('resize', () => { position(); if (!narrow.matches) placeSource(); });
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  new ResizeObserver(position).observe(document.getElementById('quarto-header'));
  input.addEventListener('input',()=>{sizeInput();sync();});
  input.addEventListener('focus',updateLength);
  input.addEventListener('blur',updateLength);
  input.addEventListener('compositionstart',()=>{composing=true;sync();});
  input.addEventListener('compositionend',()=>{composing=false;compositionEndedAt=performance.now();sync();});
  input.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||narrow.matches||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||composing||event.keyCode===229||performance.now()-compositionEndedAt<100)return;
    event.preventDefault();submit();
  });
  function safeLink(reference) {
    if (!canonicalURL(reference.url) || !transport.sources().has(reference.url)) return null;
    const button = node('button', (reference.locale==='zh'?(reference.mappingType==='section'?'章节：':'来源：'):'Source: ') + reference.label, { type: 'button', class: 'dw-ai-citation', id: 'dw-ai-citation-' + (++citationNumber), 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'dw-ai-source-preview dw-ai-source-reader', title: t('悬停预览；点击阅读原文；按 ↓ 进入预览') });
    button.addEventListener('pointerenter', () => showSource(button, reference, 'pointer'));
    button.addEventListener('pointerleave', scheduleHide);
    button.addEventListener('pointerdown', () => { pointerFocusTrigger = button; });
    button.addEventListener('pointerup', () => { pointerFocusTrigger = null; });
    button.addEventListener('pointercancel', () => { pointerFocusTrigger = null; });
    button.addEventListener('focus', () => { if (suppressedFocusTrigger !== button && pointerFocusTrigger !== button) showSource(button, reference, 'keyboard'); });
    button.addEventListener('blur', () => { if (suppressedFocusTrigger === button) suppressedFocusTrigger = null; scheduleHide(); });
    button.addEventListener('click', () => { pointerFocusTrigger = null; openSourceReader(button, reference); });
    button.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); showSource(button, reference, 'keyboard'); previewClose.focus({ preventScroll: true }); } });
    return button;
  }
  let userId=null,renderGeneration=0,resultGeneration=0,pendingActions=0;
  function clearQuestion(){resultGeneration++;dismissSource(false);returnToAnswer(false);current=null;input.value='';sizeInput();result.replaceChildren();result.hidden=true;status.textContent='';manualCheckNeeded=false;transport.clearSources();}
  function onSnapshot(state){
    if(state!==null&&(typeof state?.authenticated!=='boolean'||state.httpStatus!==undefined&&state.httpStatus!==200))throw Error('SESSION_UNAVAILABLE');
    const next=state?.user?.id??null;
    if(next!==userId){renderGeneration++;clearQuestion();privacyReviewed=false;privacyFirst.hidden=false;}userId=next;
    sessionPhase=state===null?'checking':'known';
    trialState=state;ready=CONFIG.provider!=='DISABLED'&&state?.ready===true;serverBusy=!!state?.activeRequestId;
    sync();
  }
  function renderAccount(){
    const state=trialState,authenticated=sessionPhase==='known'&&state?.authenticated===true,pilot=state?.beta?.pilot;
    notice.dataset.sessionPhase=sessionPhase;notice.dataset.authenticated=String(authenticated);
    notice.dataset.available=String(authenticated&&CONFIG.provider!=='DISABLED'&&state.ready===true&&pilot?.used!==true);
    const publicApply=document.getElementById('dw-beta-apply-entry');
    if(publicApply)publicApply.hidden=true;
    google.hidden=true;gis.hidden=true;logout.hidden=true;sessionRetry.hidden=true;permission.hidden=true;modeCheck.hidden=true;funds.hidden=true;account.hidden=true;betaApply.hidden=true;ownerLogin.hidden=true;
    modeCheck.textContent='';budget.textContent='';
    if(sessionPhase==='access'){
      identity.textContent='Closed Beta';permission.hidden=false;permission.textContent=t('登录暂不可用，请稍后重试。');
      account.hidden=false;ownerLogin.hidden=!CONFIG.ownerBootstrapOnly;google.hidden=CONFIG.ownerBootstrapOnly;google.disabled=!['ready','retry','error'].includes(googlePhase);
      betaApply.hidden=true;
      if(googleMessage){modeCheck.hidden=false;modeCheck.textContent=googleMessage;}
      dismissSource(false);returnToAnswer(false);result.hidden=true;return;
    }
    if(sessionPhase!=='known'){
      identity.textContent=sessionPhase==='checking'?(loggingOut?t('正在确认退出状态…'):t('正在确认登录…')):t('无法读取账户状态');
      if(sessionPhase==='error'){account.hidden=false;sessionRetry.hidden=false;modeCheck.hidden=false;modeCheck.textContent=t('尚不能确认当前账户，请重试。');}
      dismissSource(false);returnToAnswer(false);result.hidden=true;return;
    }
    if(current&&result.childNodes.length)result.hidden=false;
    account.hidden=false;permission.hidden=false;
    betaApply.hidden=true;
    if(!authenticated){
      identity.textContent=t('尚未登录');permission.textContent=t('Closed Beta 尚未开放测试资格；登录不会自动获得额度。');
      if(CONFIG.ownerBootstrapOnly){ownerLogin.hidden=false;google.hidden=true;gis.hidden=true;return;}
      gis.hidden=!gis.childElementCount;google.hidden=!!gis.childElementCount;
      google.disabled=!['ready','retry','error'].includes(googlePhase);google.title=googleMessage||t('Google 登录');
      if(googleMessage){modeCheck.hidden=false;modeCheck.textContent=googleMessage;}
      return;
    }
    logout.hidden=false;ownerLogin.hidden=!CONFIG.ownerBootstrapOnly;
    identity.textContent=t('已登录');
    const ended=availabilityText(state)==='本轮测试已结束';
    permission.textContent=state.beta?.approved!==true?t(descriptions[state.code]??'暂时无法确认试用资格'):ended?t('本轮测试已结束'):!pilot?.configured?t('AI 问答尚未开放'):pilot.used?t('账户剩余 0 题'):pilot.poolRemaining===0?t('全站试用题数已用完'):t('账户剩余 {count} 题 · 全站剩余 {pool} 题',{count:Number.isInteger(pilot.remainingQuestions)?pilot.remainingQuestions:1,pool:Number.isInteger(pilot.poolRemaining)?pilot.poolRemaining:5});
    const shown=percentage(state.allowance?.percentage);funds.hidden=shown===null;
    budget.textContent=shown===null?'':t('可用处理额度约 {percent}%；已发送的问题不会恢复试用题数，额度不会自动补充。',{percent:shown});
    if(state.beta?.approved===true&&pilot?.configured&&!pilot.used&&state.code&&state.code!=='AUTH_REQUIRED'){
      modeCheck.hidden=false;modeCheck.textContent=ended?t('可继续阅读攻略或使用站内搜索。'):limitReason();
    }
  }
  function waiting(question) {
    dismissSource(false); returnToAnswer(false);
    current = Object.freeze({ question });
    result.hidden = false; result.dataset.state = 'waiting';
    result.replaceChildren(node('p', question, { class: 'dw-ai-question' }), node('h3', t('正在整理回答…'), { id: 'dw-ai-stage' }), node('p', '', { id: 'dw-ai-wait' }), node('p', t('可以点击输入框右下角停止。关闭面板后仍会继续处理。'), { class: 'dw-ai-note' }));
    scroll.scrollTop = Math.max(0, result.offsetTop - scroll.offsetTop - 12);
  }
  function offerQuestionRecovery(){if(current?.question)result.append(restoreQuestion);}
  function render(answer) {
    const allowed = ['answer','missing','failure','limited','cancelled','timeout','refused','offtopic','clarification'];
    if (!answer || !allowed.includes(answer.status)) answer = connectionFailure(t('回答暂未就绪，请查看进度。问题不会自动重发。'));
    dismissSource(false); returnToAnswer(false);
    result.hidden = false; result.dataset.state = answer.status;
    result.replaceChildren(node('p', current?.question || t('当前问题'), { class: 'dw-ai-question' }));
    const labels = { 'qb1-product':t('基于攻略来源'), 'host-no-evidence': t('暂未找到可核对的攻略材料'), 'host-service-failure': answer.status === 'limited' ? t('提问暂不可用') : t('连接或处理未完成') };
    result.append(node('p', labels[answer.provenance] || t('本题处理状态'), { class: 'dw-ai-result-label' }), node('h3', ({'本题回答':t('回答'),'本题未完成':t('这次未能完成'),'本题状态待确认':t('结果待确认'),'本题已取消':t('已停止'),'暂未接收本题':t('暂时无法提问')})[answer.title]||t(answer.title)||t('处理状态')));
    if (typeof answer.text === 'string' && answer.text) result.append(node('p', answer.text));
    for (const segment of answer.segments || []) {
      if (typeof segment.text !== 'string') continue;
      result.append(node('p', segment.text));
      const links = node('div', undefined, { class: 'dw-ai-reference' });
      for (const ref of segment.references || []) { const link = safeLink(ref); if (link) links.append(link); }
      if (links.childNodes.length) result.append(links);
    }
    if (typeof answer.note === 'string' && answer.note) result.append(node('p', answer.note, { class: 'dw-ai-note' }));
    if (typeof answer.scope === 'string' && answer.scope) result.append(node('p', answer.scope, { class: 'dw-ai-note' }));
    const kinds = { question_cap: t('本轮问题数量上限'), call_cap: t('AI 问答暂时不可用'), time_cap: t('本轮测试已结束'), inflight: t('正在处理上一题'), input: t('输入需要调整'), sensitive_input: t('请移除密钥或认证信息'), local_cap: t('本轮暂时无法继续提问') };
    if (answer.status === 'limited' && kinds[answer.kind]) result.append(node('p', kinds[answer.kind], { class: 'dw-ai-note' }));
    uncertain = answer.kind === 'local_connection';
    if (uncertain) result.append(node('p', t('请查看进度确认结果。确认前不会再次发送问题。'), { class: 'dw-ai-note' }));
    if(answer.status!=='answer')offerQuestionRecovery();
    status.textContent = answer.serviceStatus || (answer.status === 'answer' ? t('本题回答已返回') : (typeof answer.title === 'string' ? t(answer.title) : t('本题处理未完成')));
    scroll.scrollTop = Math.max(0, result.offsetTop - scroll.offsetTop - 12);
  }
  function connectionFailure(text) {
    return { status: 'failure', provenance: 'host-service-failure', title: t('连接未完成'), text, segments: [], kind: 'local_connection' };
  }
  async function refreshSnapshot(){sessionPhase='checking';ready=false;sync();try{return await transport.snapshot();}catch(error){sessionPhase=error.message==='ACCESS_REQUIRED'?'access':'error';trialState=null;ready=false;sync();return null;}}
  async function run(action,kind){
    const generation=renderGeneration,ownResult=++resultGeneration;pendingActions++;busy=true;
    if(kind==='send'){sending=true;manualCheckNeeded=false;status.textContent=t('正在整理回答…');}
    if(kind==='cancel'){cancelling=true;status.textContent=t('正在请求停止…');const title=result.querySelector('h3');if(title)title.textContent=t('正在请求停止…');}
    sync();
    try{
      const answer=await action();
      if(generation===renderGeneration&&ownResult===resultGeneration){
        if(kind==='cancel'&&['cancelled','completed','failed','rejected'].includes(answer.raw?.status))sending=false;
        render(answer);
        manualCheckNeeded=!!transport.state().activeId;
        status.textContent=answer.serviceStatus||(answer.raw?.status==='cancelled'?t('已停止 · 结算结果见上方'):answer.raw?.status==='completed'?t('回答已完成'):kind==='cancel'&&manualCheckNeeded?t('停止结果待确认，请查看进度'):feedbackFor(answer.raw||answer,trialState));
        if(!transport.state().activeId)await refreshSnapshot();
      }
    }catch(error){
      if(generation===renderGeneration&&ownResult===resultGeneration){manualCheckNeeded=!!transport.state().activeId;status.textContent=kind==='cancel'?t('停止结果待确认，请查看进度'):t(descriptions[error.message])||t('连接未完成，请查看进度；不会自动重发。');if(kind==='cancel'){const title=result.querySelector('h3');if(title)title.textContent=t('停止结果待确认');}if(kind==='send'){result.dataset.state='failure';const title=result.querySelector('h3');if(title)title.textContent=t('这次未能完成');offerQuestionRecovery();}}
    }finally{if(kind==='send')sending=false;if(kind==='cancel')cancelling=false;pendingActions--;busy=pendingActions>0;sync();}
  }
  async function recover(initial=false){
    if(busy&&!initial)return;
    busy=true;sync();const snapshot=await refreshSnapshot();busy=false;
    if(snapshot&&transport.state().activeId){manualCheckNeeded=true;status.textContent=t('有结果待确认，请查看进度。');}sync();
  }
  async function submit(){if(send.dataset.action!=='send'||send.disabled)return;const question=input.value;if(questionLengths(question).over){sync();return;}if(!questionLanguage(question)){status.textContent=languageClarification;return;}if(!privacyReviewed){openPrivacy(true);return;}waiting(question);input.value='';sizeInput();await run(()=>transport.send(question),'send');}
  form.addEventListener('submit',event=>{event.preventDefault();submit();});
  send.addEventListener('click',()=>send.dataset.action==='stop'?stop():submit());
  async function stop(){if(send.disabled||cancelling)return;await run(()=>transport.cancel(),'cancel');}
  query.addEventListener('click',()=>run(()=>transport.queryStatus(),'query'));
  sessionRetry.addEventListener('click',()=>recover());
  logout.addEventListener('click',async()=>{loggingOut=true;clearQuestion();try{await transport.logout();const snapshot=await refreshSnapshot();status.textContent=snapshot?.authenticated===false?t('已退出登录，本页正文已清除。'):t('退出状态待确认；本页正文已清除。');}catch{sessionPhase='error';trialState=null;ready=false;status.textContent=t('退出状态待确认；本页正文已清除。');sync();}finally{loggingOut=false;}});
  let googleAttempt=null;
  window.DWProductGoogle=Object.freeze({requiresAccess:()=>false,prepare:async()=>{googleAttempt=await transport.nonce();return {nonce:googleAttempt.nonce};},complete:async credential=>{const attempt=googleAttempt;googleAttempt=null;if(!attempt?.csrf)throw Error('GOOGLE_NONCE_REQUIRED');sessionPhase='checking';ready=false;sync();try{return await transport.loginGoogle(credential,attempt.csrf);}catch(error){sessionPhase='error';trialState=null;sync();throw error;}},onUIStatus:({phase,message=''})=>{googlePhase=phase;googleMessage=message;sync();},refreshUI:()=>sync()});
  window.addEventListener('focus',()=>{if(sessionPhase==='access'&&!busy)recover();});
  placeLauncher();sync();recover(true);
})();
