/* 返回按钮：回到向导主界面（App 内叫 index.html，下载目录版叫 附魔台RNG向导.html）
   同时用内联样式强制固定，避免个别 WebView 对 .fix 类样式解析失效导致按钮跟着页面滚走 */
(function () {
  function satTop() {
    var v = '';
    try { v = getComputedStyle(document.documentElement).getPropertyValue('--sat').trim(); } catch (e) {}
    if (!v) v = 'env(safe-area-inset-top,0px)';
    return 'calc(8px + ' + v + ')';
  }
  function pin() {
    var b = document.getElementById('backBtn');
    if (!b) return;
    // 只有独立教程页需要脱离文档流固定；标签版里的按钮在 sticky 标题栏内，保持原样
    if (!b.classList.contains('fix')) return;
    b.style.setProperty('position', 'fixed', 'important');
    b.style.setProperty('left', '12px', 'important');
    b.style.setProperty('top', satTop(), 'important');
    b.style.setProperty('z-index', '9999', 'important');
    b.style.setProperty('margin', '0', 'important');
    b.style.setProperty('width', 'auto', 'important');
    b.style.setProperty('max-width', '40%', 'important');
  }
  function backTarget() {
    var p = '';
    try { p = decodeURIComponent(location.pathname); } catch (e) { p = location.pathname || ''; }
    var zh = /[\u4e00-\u9fa5]/.test(p);
    var t = zh ? '附魔台RNG向导.html' : 'index.html';
    var th = document.documentElement.getAttribute('data-theme');
    if (th === 'light' || th === 'dark') t += '#theme=' + th;
    return t;
  }
  // 自愈：若该 WebView 对 position:fixed 支持异常（按钮跟着文档滚走），
  // 改用绝对定位 + 滚动同步，保证始终贴在屏幕左上角
  var fixedOk = true, satPx = 0;
  function readSat() {
    var v = '';
    try { v = getComputedStyle(document.documentElement).getPropertyValue('--sat').trim(); } catch (e) {}
    var m = /^([0-9.]+)px$/.exec(v);
    satPx = m ? parseFloat(m[1]) : 0;
  }
  function follow() {
    var b = document.getElementById('backBtn');
    if (!b) return;
    var y = (window.pageYOffset || document.documentElement.scrollTop || 0) + 8 + satPx;
    b.style.setProperty('top', y + 'px', 'important');
  }
  function onScroll() {
    var b = document.getElementById('backBtn');
    if (!b || !b.classList.contains('fix')) return;
    if (fixedOk) {
      var r = b.getBoundingClientRect();
      if (r.top > 80 || r.bottom < 0) {
        fixedOk = false;
        readSat();
        b.style.setProperty('position', 'absolute', 'important');
        follow();
      }
    } else {
      follow();
    }
  }
  window.__backTarget = backTarget;
  window.__pinBack = pin;
  function start() { pin(); readSat(); try { window.addEventListener('scroll', onScroll, { passive: true }); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  document.addEventListener('click', function (e) {
    var n = e.target;
    while (n && n !== document.body) {
      if (n.id === 'backBtn' || (n.className && String(n.className).indexOf('backbtn') >= 0)) {
        e.preventDefault();
        try { location.href = backTarget(); } catch (err) {}
        return;
      }
      n = n.parentNode;
    }
  }, false);
})();
