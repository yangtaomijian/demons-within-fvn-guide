// Guide-owned CSS is loaded in the document head; old cached HTML can load it here.
const styleFiles = ['mt-panel.f0a5aa3cc24f.css', 'mt-public-panel.16c871532b44.css'];
function requireStyle(file) {
  const url = new URL(file, import.meta.url);
  let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find(l => {
    const u = new URL(l.href); return u.origin === location.origin && u.pathname.endsWith('/' + file);
  });
  const fresh = !link;
  if (fresh) { link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url.href; }
  const ready = () => { try { return link.sheet?.cssRules.length > 0; } catch { return false; } };
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = ok => { clearTimeout(timer); link.removeEventListener('load', loaded); link.removeEventListener('error', failed); ok ? resolve() : reject(Error('DW_UI_STYLE_UNAVAILABLE')); };
    const loaded = () => done(ready()), failed = () => done(false);
    const timer = setTimeout(failed, 10000);
    link.addEventListener('load', loaded, {once:true}); link.addEventListener('error', failed, {once:true});
    if (fresh) document.head.append(link);
  });
}
async function mount() {
  if (!document.querySelector('.dw-search-launcher')) await new Promise(resolve => {
    const o = new MutationObserver(() => { if (document.querySelector('.dw-search-launcher')) { o.disconnect(); resolve(); } });
    o.observe(document.body, {childList:true, subtree:true});
  });
  if (document.getElementById('dw-ai-launcher')) return;
  const b = document.createElement('button'); b.id = 'dw-ai-launcher'; b.type = 'button'; b.disabled = true;
  b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'dw-ai-panel'); b.setAttribute('aria-busy', 'true');
  const en = document.documentElement.lang.startsWith('en');
  b.innerHTML = '<span>AI</span><span class="dw-ai-mode">Beta</span>';
  b.title = en ? 'Loading the guide panel' : '正在加载问答界面';
  document.querySelector('.dw-search-launcher').after(b);
  document.body.insertAdjacentHTML('beforeend', "<aside id=\"dw-ai-panel\" hidden aria-labelledby=\"dw-ai-title\"><div class=\"dw-ai-head\"><div><h2 id=\"dw-ai-title\">问攻略</h2><span class=\"dw-ai-eyebrow\">Beta</span></div><button id=\"dw-ai-close\" type=\"button\">关闭</button></div><div class=\"local-toolbar\"><button id=\"dw-mt-new\" type=\"button\">新对话</button><button id=\"dw-mt-status\" type=\"button\" hidden>查看进度</button></div><p id=\"dw-mt-notice\" role=\"status\"></p><div class=\"dw-public-account\"><div id=\"dw-public-login-controls\"><button type=\"button\" id=\"google\">Google 登录</button><div id=\"google-gis\"></div><p id=\"dw-public-login-status\"></p></div><div id=\"dw-public-signed-in\" hidden><span id=\"dw-public-login-label\"></span> <button type=\"button\" id=\"dw-public-logout\"></button> <button type=\"button\" id=\"dw-public-withdraw\"></button> <button type=\"button\" id=\"dw-public-disable\"></button></div><button type=\"button\" id=\"dw-beta-apply\"></button><p id=\"dw-public-remaining\"></p><button type=\"button\" id=\"dw-public-privacy\"></button><button type=\"button\" id=\"dw-public-legacy-status\" hidden></button><button type=\"button\" id=\"dw-public-legacy-cancel\" hidden></button><dialog id=\"dw-public-privacy-dialog\"><p id=\"dw-public-privacy-copy\"></p><button type=\"button\" id=\"dw-public-privacy-accept\"></button></dialog></div><div class=\"dw-ai-scroll\" id=\"dw-mt-messages\" role=\"log\" aria-live=\"polite\"></div><form id=\"dw-ai-form\"><label id=\"dw-mt-label\" for=\"dw-ai-question\">你的问题</label><div class=\"dw-ai-input-shell\"><textarea id=\"dw-ai-question\" rows=\"3\" maxlength=\"1200\"></textarea><button id=\"dw-ai-send\" type=\"submit\" aria-label=\"发送问题\"><svg class=\"dw-ai-icon-send dw-ai-icon-arrow\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 19V5m-6 6 6-6 6 6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg><svg class=\"dw-ai-icon-stop\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" fill=\"currentColor\"/></svg></button></div><p id=\"dw-mt-quota\" class=\"dw-ai-form-help\"></p><div id=\"dw-mt-human\"></div><p id=\"dw-mt-privacy\" class=\"dw-ai-form-help\"></p></form></aside>");
  try {
    await Promise.all(styleFiles.map(requireStyle));
    await import(new URL('mt-app.546e8c0cb372.mjs', import.meta.url).href);
    if (typeof b.onclick !== 'function') throw Error('DW_UI_BINDING_UNAVAILABLE');
    b.disabled = false; b.removeAttribute('aria-busy'); b.removeAttribute('title');
  } catch {
    document.getElementById('dw-ai-panel').hidden = true; document.body.classList.remove('dw-ai-open');
    b.firstElementChild.textContent = en ? 'AI unavailable' : 'AI 暂不可用';
    b.title = en ? 'The guide panel did not load. Refresh to try again.' : '问答界面未加载，请刷新后重试。';
    b.setAttribute('aria-label', b.title); b.setAttribute('aria-busy', 'false'); b.disabled = true;
  }
}
mount();
