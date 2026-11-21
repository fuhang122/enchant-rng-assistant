/* 共用底部抽屉选择器：原生 select 藏起来只当状态载体，视觉与交互全自绘 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var MASK = null, PANEL = null, BODY = null, FIND = null, TITLE = null;
  var PICK = { sel: null, groups: [] };

  function ensure() {
    if (PANEL) return;
    MASK = document.createElement('div'); MASK.className = 'pickmask'; MASK.id = 'pickMask';
    PANEL = document.createElement('div'); PANEL.className = 'pickpanel'; PANEL.id = 'pickPanel';
    PANEL.innerHTML =
      '<div class="pickhead"><b id="pkTitle">选择</b><button type="button" id="pkClose">×</button></div>' +
      '<input class="pkfind" id="pkFind" placeholder="搜索…" autocomplete="off">' +
      '<div class="pkbody" id="pkBody"></div>';
    document.body.appendChild(MASK);
    document.body.appendChild(PANEL);
    BODY = $('pkBody'); FIND = $('pkFind'); TITLE = $('pkTitle');
    MASK.addEventListener('click', close);
    $('pkClose').addEventListener('click', close);
    FIND.addEventListener('input', function () { draw(FIND.value); });
    BODY.addEventListener('click', function (ev) {
      var it = ev.target.closest('.pickitem');
      if (!it) return;
      var sel = PICK.sel, v = it.getAttribute('data-v');
      close();
      if (!sel) return;
      sel.value = v;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sync(sel);
    });
  }

  function readGroups(sel) {
    var out = [];
    Array.prototype.forEach.call(sel.children, function (ch) {
      if (ch.tagName === 'OPTGROUP') {
        out.push({ name: ch.label, items: Array.prototype.map.call(ch.children, function (o) {
          return { v: o.value, n: o.textContent };
        }) });
      } else if (ch.tagName === 'OPTION') {
        if (!out.length || out[out.length - 1].name) out.push({ name: '', items: [] });
        out[out.length - 1].items.push({ v: ch.value, n: ch.textContent });
      }
    });
    return out;
  }

  function draw(kw) {
    var k = String(kw || '').trim().toLowerCase();
    var html = '', total = 0, cur = PICK.sel ? String(PICK.sel.value) : '';
    PICK.groups.forEach(function (g) {
      var items = g.items.filter(function (it) {
        return !k || it.n.toLowerCase().indexOf(k) >= 0 || String(it.v).toLowerCase().indexOf(k) >= 0;
      });
      if (!items.length) return;
      if (g.name) html += '<div class="pkgroup">' + g.name + '</div>';
      items.forEach(function (it) {
        total++;
        html += '<button class="pickitem' + (String(it.v) === cur ? ' on' : '') + '" type="button" data-v="' +
          String(it.v).replace(/"/g, '&quot;') + '">' + it.n + '</button>';
      });
    });
    BODY.innerHTML = html || '<p style="color:var(--dim);padding:18px 6px;margin:0;font-size:13px">没找到</p>';
    return total;
  }

  function sync(sel) {
    if (!sel || !sel.id) return;
    var bar = document.querySelector('.selbar[data-pick="' + sel.id + '"]');
    if (!bar) return;
    var o = sel.selectedOptions && sel.selectedOptions[0];
    var tx = bar.querySelector('.tx');
    if (tx) tx.textContent = o ? o.textContent : '';
  }

  function open(sel, title) {
    if (!sel) return;
    ensure();
    PICK.sel = sel;
    PICK.groups = readGroups(sel);
    FIND.value = '';
    var n = draw('');
    TITLE.textContent = title || '选择';
    FIND.style.display = n > 18 ? 'block' : 'none';
    MASK.classList.add('on');
    PANEL.classList.add('on');
  }

  function close() {
    if (!PANEL) return;
    PANEL.classList.remove('on');
    MASK.classList.remove('on');
    PICK.sel = null;
  }

  document.addEventListener('click', function (ev) {
    var bar = ev.target.closest && ev.target.closest('.selbar');
    if (!bar) return;
    open($(bar.getAttribute('data-pick')), bar.getAttribute('data-title'));
  });

  window.PickSheet = {
    open: open,
    close: close,
    sync: sync,
    syncAll: function () {
      var bars = document.querySelectorAll('.selbar');
      for (var i = 0; i < bars.length; i++) sync($(bars[i].getAttribute('data-pick')));
    },
    isOpen: function () { return !!(PANEL && PANEL.classList.contains('on')); }
  };
})();
