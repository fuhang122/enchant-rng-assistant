(function () {
'use strict';
const $ = id => document.getElementById(id);
const ENGINE_SRC = $('engine').textContent;
const M = new Function(ENGINE_SRC + '\nreturn globalThis.MCRNG;')();
const DATA = M.DATA;

/* ---------- 状态 ---------- */
const KEY = 'mcrng.v1';
function loadState() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
let S = Object.assign({ obs: [], item: 'diamond_sword', citem: 'diamond_sword', sitem: 'diamond_sword', shelf: 15, cshelf2: 15, sshelf: 15 }, loadState());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- 通用 ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fillItems(sel, val) {
  const g = {};
  DATA.items.forEach(it => { (g[it.group] = g[it.group] || []).push(it); });
  sel.innerHTML = Object.keys(g).map(k =>
    '<optgroup label="' + k + '">' + g[k].map(it => '<option value="' + it.key + '">' + it.name + '</option>').join('') + '</optgroup>'
  ).join('');
  if (val) sel.value = val;
}
function fillNum(sel, val) {
  sel.innerHTML = Array.from({ length: 16 }, (_, i) => '<option value="' + i + '">' + i + ' 书架</option>').join('');
  sel.value = String(val);
}
function parseSeed(t) {
  t = String(t).trim().replace(/[\s,_]/g, '');
  if (!t) return null;
  let v;
  if (/^0x[0-9a-f]+$/i.test(t)) v = parseInt(t, 16);
  else if (/^-?\d+$/.test(t)) v = Number(t);
  else return null;
  if (!isFinite(v)) return null;
  return Math.trunc(v) >>> 0;
}
const fmtU = u => String(u >>> 0) + '  (0x' + (u >>> 0).toString(16).toUpperCase() + ')';
const pct = (a, b) => (b ? (a / b * 100) : 0).toFixed(a / b * 100 >= 10 ? 0 : 1) + '%';
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('已复制'), () => toast('复制失败'));
  else { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败'); } ta.remove(); }
}
let toastT = 0;
function toast(msg) {
  let el = $('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#2a5cf4;color:#fff;padding:9px 16px;border-radius:99px;font-size:13px;z-index:99;opacity:0;transition:opacity .2s'; document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(toastT); toastT = setTimeout(() => { el.style.opacity = '0'; }, 1400);
}
function slotCard(s, i) {
  const need = s.need, usable = s.usable;
  const tag = usable ? '' : '<span class="tag no">不可选</span>';
  const list = s.list && s.list.length
    ? '<div class="enl">' + s.list.map(x => esc(x.name) + ' ' + M.rom(x.lv)).join('　·　') + '</div>'
    : '<div class="enl mute">（这一档没有附魔）</div>';
  return '<div class="slot"><div class="slot-h"><div>第 ' + (i + 1) + ' 档 ' + tag +
    '</div><div class="lv">需 ' + need + ' 级</div></div>' + list + '</div>';
}

/* ---------- Tab ---------- */
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  Array.from($('tabs').children).forEach(x => x.classList.toggle('on', x === b));
  Array.from(document.querySelectorAll('.pane')).forEach(p => p.classList.toggle('on', p.id === 'p-' + b.dataset.tab));
});

/* ---------- 预测 ---------- */
fillItems($('pitem'), S.item); fillItems($('citem'), S.citem); fillItems($('sitem'), S.sitem);
fillNum($('cshelf'), 15); fillNum($('cshelf2'), S.cshelf2);
if (window.PickSheet) PickSheet.syncAll();
$('pshelf').value = S.shelf; $('pshelfv').textContent = S.shelf;
$('sshelf').value = S.sshelf; $('sshelfv').textContent = S.sshelf;

$('pitem').onchange = () => { S.item = $('pitem').value; save(); };
$('citem').onchange = () => { S.citem = $('citem').value; save(); };
$('sitem').onchange = () => { S.sitem = $('sitem').value; save(); };
$('pshelf').oninput = () => { S.shelf = +$('pshelf').value; $('pshelfv').textContent = S.shelf; save(); };
$('sshelf').oninput = () => { S.sshelf = +$('sshelf').value; $('sshelfv').textContent = S.sshelf; save(); };
$('cshelf2').onchange = () => { S.cshelf2 = +$('cshelf2').value; save(); if (cands) renderCand(); PickSheet.sync($('cshelf2')); };
$('cshelf').onchange = () => PickSheet.sync($('cshelf'));

$('pgo').onclick = () => {
  const item = $('pitem').value, b = +$('pshelf').value;
  const raw = $('pseed').value.trim();
  const out = $('pout');
  if (raw) {
    const sd = parseSeed(raw);
    if (sd === null) { out.innerHTML = '<div class="card"><p class="warn">种子格式不对：填十进制或 0x 开头的十六进制。</p></div>'; return; }
    const r = M.predict(sd, item, b);
    out.innerHTML = '<div class="card"><div class="seedbox"><code>' + fmtU(sd) + '</code></div>' +
      r.map((s, i) => slotCard(s, i)).join('') + '</div>';
    S.item = item; save();
    return;
  }
  out.innerHTML = '<div class="card"><div class="stat">模拟 20000 次…</div></div>';
  setTimeout(() => {
    const r = M.simulate(item, b, 20000);
    let h = '<div class="card"><p class="hint" style="margin-top:0">随机 XpSeed 下的分布（20000 次模拟）· ' +
      esc(DATA.items.find(i => i.key === item).name) + ' · ' + b + ' 书架</p>';
    h += '<table><tr><th>档位</th><th>花费等级范围</th><th>有附魔的比例</th></tr>';
    for (let s = 0; s < 3; s++) {
      const ks = Object.keys(r.lvStat[s]).map(Number);
      const mn = Math.min.apply(null, ks), mx = Math.max.apply(null, ks);
      let withE = 0; Object.values(r.multi[s]).forEach(v => withE += v);
      h += '<tr><td class="n">第 ' + (s + 1) + ' 档</td><td class="n">' + mn + ' – ' + mx + '</td><td class="n">' + pct(withE, r.n) + '</td></tr>';
    }
    h += '</table>';
    for (let s = 0; s < 3; s++) {
      const arr = Object.keys(r.slotStat[s]).map(k => [k, r.slotStat[s][k]]).sort((a, b) => b[1] - a[1]);
      h += '<h3>第 ' + (s + 1) + ' 档附魔出现概率</h3><div class="prob">';
      if (!arr.length) h += '<div class="stat">这一档无法附魔</div>';
      arr.slice(0, 10).forEach(([k, v]) => {
        h += '<div><div class="nm">' + esc(k) + '</div><div class="pw"><i style="width:' + Math.min(100, v / r.n * 100 * 2) + '%"></i></div><div class="pv">' + pct(v, r.n) + '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    $('pout').innerHTML = h;
  }, 30);
};

/* ---------- 破解 ---------- */
let cands = null, job = null;
const obsHTML = () => S.obs.length
  ? S.obs.map((o, i) => '<div class="chip"><i>' + o.b + ' 书架</i>' + o.levels.join(' / ') + '<span class="x" data-i="' + i + '">×</span></div>').join('')
  : '<div class="hint" style="margin:0">还没有观测</div>';
const renderObs = () => { $('clist').innerHTML = obsHTML(); };
const stat = t => { $('cstat').textContent = t; };
renderObs();

$('clist').addEventListener('click', e => {
  const x = e.target.closest('span.x'); if (!x) return;
  S.obs.splice(+x.dataset.i, 1); save(); renderObs();
  if (cands) { cands = M.filterCandidates(cands, S.obs); renderCand(); }
});

$('cadd').onclick = () => {
  const b = +$('cshelf').value;
  const lv = [0, 1, 2].map(i => parseInt($('c' + i).value, 10));
  if (lv.some(v => !isFinite(v) || v < 0 || v > 30)) { stat('三档数字都要填 0–30（灰色/不可选填 0）'); return; }
  const dup = S.obs.findIndex(o => o.b === b);
  if (dup >= 0) S.obs[dup] = { b: b, levels: lv }; else S.obs.push({ b: b, levels: lv });
  if (S.obs.length > 8) S.obs.shift();
  save(); renderObs();
  const n = S.obs.length;
  stat('已添加 ' + n + ' 组观测 · 预计候选 ' + (SCALE[n] || '1 个') +
    (n < 6 ? ' · 再记 ' + (6 - n) + ' 组更容易一次命中' : ' · 可以开始破解'));
  cands = null; $('cout').innerHTML = '';
  $('c0').value = $('c1').value = $('c2').value = '';
};

const WORKER_GLUE = [
  'self.onmessage = function(e){',
  '  var d = e.data; if (d.cmd !== "scan") return;',
  '  var M = self.MCRNG, chks = d.obs.map(function(o){ return M.makeCheckerFast(o.b, o.levels[0], o.levels[1], o.levels[2]); });',
  '  var out = [], CH = 1 << 21;',
  '  for (var pos = d.from; pos < d.to; pos += CH) {',
  '    if (self.__stop) return;',
  '    var end = Math.min(pos + CH, d.to);',
  '    M.scanSeeds(chks, pos, end, out);',
  '    self.postMessage({ type: "p", at: end });',
  '    if (out.length > 300000) { self.postMessage({ type: "big" }); return; }',
  '  }',
  '  self.postMessage({ type: "d", found: out });',
  '};'
].join('\n');

function stopJob() {
  if (!job) return;
  job.cancel = true;
  (job.workers || []).forEach(w => { try { w.terminate(); } catch (e) {} });
  job = null;
  stat('已停止');
}

$('cstop').onclick = () => { stopJob(); };
const SCALE = ['?', '约 1 亿', '约 200 万', '约 1.3 万', '约 800', '约 130', '1 个', '1 个', '1 个'];
$('crun').onclick = () => {
  if (S.obs.length < 3) { stat('至少需要 3 组观测（推荐记到 6 组，书架数尽量不同）'); return; }
  stopJob();
  const N = 4294967296;
  const hw = (navigator.hardwareConcurrency || 4) | 0;
  const nw = Math.max(1, Math.min(6, hw - 1));
  const st = { at: new Array(nw).fill(0), from: [], t0: Date.now(), workers: [], done: 0, results: [], cancel: false, nw: nw };
  job = st;
  $('cbar').style.width = '0%'; $('cout').innerHTML = '';
  stat('准备中…');
  const obs = S.obs.map(o => ({ b: o.b, levels: o.levels.slice() }));
  const slice = Math.floor(N / nw);
  for (let i = 0; i < nw; i++) st.from.push(i * slice);
  st.from.push(N);

  const progress = () => {
    if (!job || job !== st) return;
    const s = st.at.reduce((a, x) => a + x, 0);
    const p = Math.min(100, s / N * 100);
    $('cbar').style.width = p.toFixed(1) + '%';
    const el = (Date.now() - st.t0) / 1000;
    const eta = s > 0 ? el * (N - s) / s : 0;
    stat('已扫描 ' + p.toFixed(1) + '%  ·  会话 ' + nw + ' 线程  ·  剩余约 ' + Math.ceil(eta) + ' 秒');
  };

  const finish = () => {
    if (!job || job !== st) return;
    job = null;
    $('cbar').style.width = '100%';
    let all = [];
    st.results.forEach(a => { all = all.concat(a); });
    all.sort((a, b) => a - b);
    cands = all;
    stat('扫描完成，命中 ' + all.length + ' 个候选（用时 ' + Math.round((Date.now() - st.t0) / 1000) + ' 秒）');
    renderCand();
  };

  let url = null;
  try { url = URL.createObjectURL(new Blob([ENGINE_SRC + '\n' + WORKER_GLUE], { type: 'application/javascript' })); } catch (e) { url = null; }
  if (url && typeof Worker !== 'undefined') {
    try {
      for (let i = 0; i < nw; i++) {
        const w = new Worker(url);
        w.onmessage = ev => {
          const d = ev.data;
          if (!job || job !== st) return;
          if (d.type === 'p') { st.at[i] = d.at - st.from[i]; progress(); }
          else if (d.type === 'd') { st.results.push(d.found); st.done++; if (st.done === nw) { finish(); try { URL.revokeObjectURL(url); } catch (e) {} } }
          else if (d.type === 'big') { st.cancel = true; (st.workers || []).forEach(x => { try { x.terminate(); } catch (e) {} }); job = null; stat('候选太多：请先多加两组观测再扫'); }
        };
        w.onerror = () => { st.cancel = true; };
        w.postMessage({ cmd: 'scan', obs: obs, from: st.from[i], to: st.from[i + 1] });
        st.workers.push(w);
      }
      progress();
      return;
    } catch (e) { url = null; }
  }
  /* 单线程回退 */
  const chks = obs.map(o => M.makeCheckerFast(o.b, o.levels[0], o.levels[1], o.levels[2]));
  const out = [];
  let pos = 0;
  const stepFn = () => {
    if (!job || job !== st) return;
    const end = Math.min(pos + (1 << 21), N);
    M.scanSeeds(chks, pos, end, out);
    pos = end; st.at[0] = pos; progress();
    if (pos < N) setTimeout(stepFn, 0);
    else { st.results.push(out); st.done = st.nw; finish(); }
  };
  setTimeout(stepFn, 0);
};

function renderCand() {
  const b = +$('cshelf2').value;
  const item = $('citem').value;
  const itn = (DATA.items.find(i => i.key === item) || {}).name || item;
  if (!cands) return;
  if (!cands.length) {
    $('cout').innerHTML = '<div class="card"><h3 style="margin-top:0">没有匹配的种子</h3><p>观测之间互相矛盾：可能数字记错、书架数不对，或者服务器改了附魔台逻辑。检查后重新添加观测再扫。</p></div>';
    return;
  }
  if (cands.length === 1) {
    const sd = cands[0];
    const r = M.predict(sd, item, b);
    $('cout').innerHTML = '<div class="card"><div class="k">找到唯一 XpSeed</div><div class="seedbox" style="margin-top:8px"><code>' +
      fmtU(sd) + '</code><button id="cp">复制</button></div>' +
      '<p class="hint" style="margin:0 0 8px">' + esc(itn) + ' · ' + b + ' 书架</p>' +
      r.map((s, i) => slotCard(s, i)).join('') +
      '<button class="btn ghost" id="tos">填入刷种页的种子 A</button></div>';
    $('cp').onclick = () => copyText(String(sd));
    $('tos').onclick = () => { $('s1').value = String(sd); $('s2').value = ''; $('s2').focus && $('s2').focus(); toast('已填入种子 A，附魔一次后再破解填种子 B'); };
    return;
  }
  const show = cands.slice(0, 30);
  $('cout').innerHTML = '<div class="card"><h3 style="margin-top:0">还有 ' + cands.length + ' 个候选</h3>' +
    '<p>再加一组不同书架数的观测（点上面的「添加这组观测」），候选会立刻被筛掉，不用重新扫描。</p>' +
    '<table><tr><th>#</th><th>XpSeed</th></tr>' +
    show.map((u, i) => '<tr><td class="n">' + (i + 1) + '</td><td class="n" style="white-space:normal">' + fmtU(u) + '</td></tr>').join('') +
    '</table>' + (cands.length > show.length ? '<p class="hint">只列出前 30 个</p>' : '') + '</div>';
}

/* ---------- 刷种 ---------- */
$('sgo').onclick = () => {
  const a = parseSeed($('s1').value), c = parseSeed($('s2').value);
  const item = $('sitem').value, b = +$('sshelf').value;
  const out = $('sout');
  if (a === null || c === null) { out.innerHTML = '<div class="card"><p class="warn">两个种子都要填（十进制或 0x 十六进制）。</p></div>'; return; }
  const st = M.solveState(a, c);
  if (st === null) { out.innerHTML = '<div class="card"><p class="warn">这两个种子不是相邻的 nextInt 输出，无法反推状态。确认种子 B 是附魔一次后立刻破解的结果，中间没做别的事。</p></div>'; return; }
  let h = '<div class="card"><div class="k">玩家随机数状态（48 位）</div>' +
    '<div class="seedbox" style="margin-top:8px"><code>' + st.toString(16).toUpperCase().padStart(12, '0') + '</code>' +
    '<button id="cpst">复制</button></div>' +
    '<p class="hint" style="margin:0 0 10px">每次附魔 = 1 次 nextInt；每投出一件物品 = 4 次 nextFloat。下表是投掷 n 件之后的下一次附魔会用的种子。</p>' +
    '<table><tr><th>投掷</th><th>下一次附魔（' + esc((DATA.items.find(i => i.key === item) || {}).name || item) + ' · ' + b + ' 书架）</th></tr>';
  for (let t = 0; t <= 8; t++) {
    const seed = M.seedAfterThrows(st, t);
    const r = M.predict(seed, item, b);
    const cell = r.map((s, i) => {
      const nm = s.list && s.list.length ? s.list.map(x => x.name + M.rom(x.lv)).join('+') : '—';
      return '<span style="color:#6b7585">' + (i + 1) + '</span> <span style="color:#7d8798;font-size:11px">需' +
        s.need + '级</span> ' + esc(nm);
    }).join('<br>');
    h += '<tr><td class="n">' + t + ' 件<br><span class="hint" style="font-size:11px">' + seed + '</span></td><td>' + cell + '</td></tr>';
  }
  h += '</table>';
  h += '<p class="hint">进游戏核对：三档显示的等级数字要和上表「需 N 级」完全一致，说明随机数状态没错位；不一致就是中途有别的动作消耗了玩家随机数，需要重新破解。</p></div>';
  out.innerHTML = h;
  $('cpst').onclick = () => copyText(st.toString());
};
})();
