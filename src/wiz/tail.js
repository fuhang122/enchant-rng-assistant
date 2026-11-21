(function () {
'use strict';
const $ = id => document.getElementById(id);
const M = new Function($('engine').textContent + '\nreturn globalThis.MCRNG;')();
const DATA = M.DATA;
const KEY = 'mcrng.wizard.v1';
const PLAN = [15, 14, 13, 12, 11, 10];   // 每次只在台子边挖掉或堵住一个书架，少动手，区分度还更高
const EXTRA = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

function loadState() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
const SAVED = loadState();
const CFG = { theme: (SAVED.theme === 'light' || SAVED.theme === 'dark') ? SAVED.theme : 'auto', welcome: SAVED.welcome !== false };
(function () {           // 从子页面返回时，用链接里的 #theme= 覆盖
  try {
    const m = /[?#&]theme=(light|dark|auto)/.exec(location.hash + location.search);
    if (m) { CFG.theme = m[1]; CFG.welcome = false; }
  } catch (e) {}
})();
const S = Object.assign({
  item: 'diamond_sword', lvl: 30, shelf: 15,
  phase: 'A', plan: PLAN.slice(), idx: 0, obs: [],
  seedA: null, seedB: null, throws: 0, pick: 2, want: ''
}, SAVED);
/* --- 从存档恢复进度，并校验字段，坏数据退回默认 --- */
if (!Array.isArray(S.obs)) S.obs = [];
S.obs = S.obs.filter(o => o && Array.isArray(o.levels) && o.levels.length === 3 && isFinite(o.b));
if (!Array.isArray(S.plan) || !S.plan.length) S.plan = PLAN.slice();
if (!Array.isArray(S.cands) || !S.cands.length) S.cands = null;
if (S.phase !== 'A' && S.phase !== 'B') S.phase = 'A';
if (typeof S.idx !== 'number' || S.idx < 0 || S.idx > S.plan.length) S.idx = Math.min(S.obs.length, S.plan.length);
if (typeof S.stateStr === 'string' && /^[0-9]+$/.test(S.stateStr)) {
  try { S.state = BigInt(S.stateStr); } catch (e) { S.state = null; }
}
delete S.stateStr;

let step = null;
const save = () => { try {
  localStorage.setItem(KEY, JSON.stringify({
    item: S.item, lvl: S.lvl, shelf: S.shelf, theme: CFG.theme, welcome: CFG.welcome,
    step: step, phase: S.phase, plan: S.plan, idx: S.idx, obs: S.obs, throws: S.throws,
    pick: S.pick, want: S.want, seedA: S.seedA, seedB: S.seedB, cands: S.cands,
    stateStr: (typeof S.state === 'bigint' ? S.state.toString() : null)
  }));
} catch (e) {} };

/* 哪些步骤可以恢复；扫描中与出错页退回到上游 */
const RESUME_OK = ['prep', 'intro', 'collect', 'crackAsk', 'result', 'final',
  'rerollIntro', 'rerollTable', 'rerollFinal', 'done'];
function resumeStep() {
  const st = SAVED.step;
  if (typeof st !== 'string') return null;
  /* 扫描中 / 出错时退出：观测都还在，回到记录页继续 */
  if (st === 'crack' || st === 'fail') return S.obs.length ? 'collect' : null;
  if (RESUME_OK.indexOf(st) < 0) return null;
  if ((st === 'result' || st === 'final') && !S.cands) return null;
  if ((st === 'rerollTable' || st === 'rerollFinal' || st === 'done') && !(S.seedB != null && S.state)) return null;
  if (st === 'collect' && !S.obs.length) return null;
  return st;
}

/* ---------- 主题 ---------- */
const mql = (typeof window.matchMedia === 'function') ? window.matchMedia('(prefers-color-scheme: light)') : null;
function applyTheme() {
  const sysLight = !!(mql && mql.matches);
  const t = CFG.theme === 'auto' ? (sysLight ? 'light' : 'dark') : CFG.theme;
  document.documentElement.setAttribute('data-theme', t);
  const m = document.getElementById('themecolor');
  if (m) m.setAttribute('content', t === 'light' ? '#f3f5fa' : '#101319');
  const seg = document.getElementById('segTheme');
  if (seg) Array.from(seg.children).forEach(b => b.classList.toggle('on', b.getAttribute('data-theme-opt') === CFG.theme));
  try { if (window.AndroidHost && AndroidHost.setTheme) AndroidHost.setTheme(t === 'light'); } catch (e) {}
  if (typeof renderLinks === 'function') renderLinks();
}
if (mql && mql.addEventListener) mql.addEventListener('change', () => { if (CFG.theme === 'auto') applyTheme(); });

/* ---------- 小工具 ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const itemName = k => (DATA.items.find(i => i.key === k) || {}).name || k;
function toast(m) { const t = $('toast'); t.textContent = m; t.style.opacity = '1'; clearTimeout(t._t); t._t = setTimeout(() => t.style.opacity = '0', 1500); }
function copyText(t) {
  if (typeof AndroidHost !== 'undefined' && AndroidHost.copy) {
    try { AndroidHost.copy(t); toast('已复制'); return; } catch (e) {}
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => toast('已复制'), () => legacyCopy(t));
    return;
  }
  legacyCopy(t);
}
function legacyCopy(t) {
  try {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    toast(ok ? '已复制' : t);
  } catch (e) { toast(t); }
}
function fillItems(sel, val) {
  const g = {}; DATA.items.forEach(it => { (g[it.group] = g[it.group] || []).push(it); });
  sel.innerHTML = Object.keys(g).map(k => '<optgroup label="' + k + '">' +
    g[k].map(it => '<option value="' + it.key + '">' + it.name + '</option>').join('') + '</optgroup>').join('');
  if (val) sel.value = val;
}
function fillEnchItems(filter) {
  const sel = $('enchItem'), cur = sel.value;
  const f = (filter || '').trim();
  const list = DATA.items.filter(it => !f || it.name.indexOf(f) >= 0 || it.key.indexOf(f) >= 0);
  const g = {};
  list.forEach(it => { (g[it.group] = g[it.group] || []).push(it); });
  sel.innerHTML = Object.keys(g).map(k => '<optgroup label="' + k + '">' +
    g[k].map(it => '<option value="' + it.key + '">' + it.name + '</option>').join('') + '</optgroup>').join('');
  if (list.some(it => it.key === cur)) sel.value = cur;
  else if (list.length) sel.value = list[0].key;
}
function fillShelf(sel, val) {
  sel.innerHTML = Array.from({ length: 16 }, (_, i) => '<option value="' + i + '">' + i + ' 个书架</option>').join('');
  sel.value = String(val);
}
function parseSeed(t) {
  t = String(t).trim().replace(/[\s,_]/g, '');
  if (!t) return null;
  let v;
  if (/^0x[0-9a-f]+$/i.test(t)) v = parseInt(t, 16);
  else if (/^-?\d+$/.test(t)) v = Number(t);
  else return null;
  return isFinite(v) ? (Math.trunc(v) >>> 0) : null;
}
const fmtU = u => String(u >>> 0) + '（0x' + (u >>> 0).toString(16).toUpperCase() + '）';
const enchTxt = l => l && l.length ? l.map(x => x.name + ' ' + M.rom(x.lv)).join('　+　') : '（没有附魔）';

/* ---------- 步骤 ---------- */
const RESUME = resumeStep();
step = RESUME || (CFG.welcome ? 'welcome' : 'intro');
let job = null;

const META = {
  welcome:     { n: 0, p: 0.00, t: '欢迎' },
  prep:        { n: 1, p: 0.04, t: '第 1 步 · 准备物品' },
  intro:       { n: 2, p: 0.09, t: '第 2 步 · 确认设置' },
  collect:     { n: 3, p: 0.12, t: '第 3 步 · 记录观测' },
  crack:       { n: 4, p: 0.56, t: '第 4 步 · 破解' },
  crackAsk:    { n: 4, p: 0.50, t: '第 4 步 · 破解' },
  result:      { n: 5, p: 0.80, t: '第 5 步 · 看结果' },
  final:       { n: 6, p: 0.92, t: '第 6 步 · 去附魔' },
  rerollIntro: { n: 5, p: 0.80, t: '第 5 步 · 刷种' },
  rerollTable: { n: 6, p: 0.88, t: '第 6 步 · 投掷表' },
  rerollFinal: { n: 7, p: 0.94, t: '第 7 步 · 照做' },
  done:        { n: 7, p: 1.00, t: '完成' },
  fail:        { n: 4, p: 0.56, t: '第 4 步 · 出错了' }
};

function paint(id) { step = id; render(); try { window.scrollTo(0, 0); } catch (e) {} save(); }
function go(id) { paint(id); }

/* 每个步骤的「上一步」是固定的，不靠历史栈，避免残留把用户送回记录页 */
const BACK = {
  intro: 'prep', crack: 'collect', fail: 'collect',
  result: 'collect', final: 'result', done: 'final',
  rerollIntro: 'prep', rerollBroken: 'result',
  rerollTable: 'result', rerollFinal: 'rerollTable'
};

function render() {
  document.body.classList.toggle('welcome-mode', step === 'welcome');
  const meta = META[step] || META.intro;
  $('wstep').textContent = meta.t;
  let pct = meta.p;
  if (step === 'collect') pct = 0.12 + 0.40 * (S.idx / Math.max(1, S.plan.length));
  $('wbar').style.width = (pct * 100).toFixed(1) + '%';
  const out = build();
  $('wcard').innerHTML = out.card;
  $('wcard').classList.remove('in'); void $('wcard').offsetWidth; $('wcard').classList.add('in');
  $('wact').innerHTML = (out.actions || []).map(a =>
    '<button class="wbtn ' + (a.cls || '') + '" data-act="' + a.act + '"' + (a.dis ? ' disabled' : '') + '>' + a.label + '</button>').join('') + (out.tail || '');
  if (out.after) out.after();
}

/* ---------- 各步骤画面 ---------- */
function build() {
  switch (step) {
    case 'welcome': return {
      card: '<div class="hero-top"><button class="hero-t" data-act="openEnch">附魔表</button>' +
        '<button class="hero-t" data-act="openSet">设置</button></div>' +
        '<div class="hero-tag">Minecraft Java · 附魔台</div>' +
        '<h1 class="hero-title">附魔台<br><em>RNG 向导</em></h1>' +
        '<p class="hero-sub">三档给什么，其实由一颗种子决定。记下 6 组界面数字，反推出这次的种子，' +
        '直接看到每一档的附魔 —— 不满意还能算出投几件物品换成你想要的。</p>' +
        '<div class="hero-grid">' +
        '<div class="hcell"><b>1.21.4 – 26.3</b><span>Java 版 · 数据核对到 26.3</span></div>' +
        '<div class="hcell"><b>6 组数字</b><span>一步步带你记，不用算</span></div>' +
        '<div class="hcell"><b>纯离线</b><span>不联网 · 不要权限</span></div>' +
        '<div class="hcell"><b>长矛 · 突刺</b><span>1.21.11+ 已支持</span></div>' +
        '</div>',
      actions: [{ act: 'startNow', label: '开始', cls: 'primary' }],
      tail: '<button class="nogain" data-act="noMore">不再提示</button>' +
        '<a class="githint" data-act="openRepo">源码与更新 · github.com/fuhang122/enchant-rng-assistant</a>'
    };

    case 'prep': return {
      card: '<h2 class="wtitle">先把这些东西备齐</h2>' +
        '<p class="wsub">缺一样后面就会卡住，或者把随机数搞乱。</p>' +
        '<ul class="plist">' +
        '<li><b>附魔台 ×1</b><span>放在 15 个书架中间；台子和书架之间那一格要空着</span></li>' +
        '<li><b>书架 ×15</b><span>前面留几个的位置方便挖或堵：整轮最多减 5 个，挖下来还能放回去</span></li>' +
        '<li><b>精准采集斧 ×1<br>（别带耐久）</b><span>用来搬书架：精准采集保证书架掉本体。耐久附魔触发时会掷随机数，可能把玩家随机数序列打乱</span></li>' +
        '<li><b>祭品 ×3~5</b><span>能附魔的垃圾：木剑、书都行。刷种时用它们消耗一次附魔，换下一个种子</span></li>' +
        '<li><b>经验 ≥ 30 级</b><span>第 3 档要 30 级；建议备到 40~60 级，因为可能要试好几次</span></li>' +
        '<li><b>可丢弃物品 ×8 以上</b><span>一组方块就行。刷种时按 Q 一件件投，用来对准某一行</span></li>' +
        '<li><b>方块若干</b><span>懒得挖就用它堵：放在书架与台子之间那一格，那个书架就失效</span></li>' +
        '</ul>' +
        '<p class="hint">游戏版本要 1.21.4 及以上（含 26.x）。<b>1.20 及更早不适用</b> —— 附魔池完全是另一套。</p>' +
        '<div class="banbox"><div class="bantitle">从开始记数字到点下附魔，这些动作一律别做</div><ul>' +
        '<li><b>疾跑 / 冲刺</b> —— 最容易栽的一条，跑两步序列就变了</li>' +
        '<li><b>点任意一档附魔</b> —— 种子立刻换掉，前面记的全废</li>' +
        '<li><b>获得经验</b> —— 捡经验球、烧东西、打怪掉的经验全算；记数字前先把经验球的动静等完</li>' +
        '<li><b>穿梭维度</b> —— 进出下界、末地，过一趟传送门序列就变</li>' +
        '<li><b>使用指令</b> —— /tp 以及带随机数的（/spreadplayers、/random、/loot、带随机参数的 /summon）</li>' +
        '<li><b>进入信标效果范围</b> —— 站进信标光束罩住的地方，序列就会动</li>' +
        '<li><b>开箱子</b> —— 箱子战利品表要掷随机数；在信标范围内开，等于两个原因叠一起</li>' +
        '<li><b>死亡</b> —— 掉经验、重生都是新的序列</li>' +
        '<li><b>丢弃物品</b> —— 只有投掷表让你丢的那几件才能丢</li>' +
        '<li><b>挖方块、合成</b> —— 合成台和背包 2×2 都算（挖掉/堵住书架来改数量除外）</li>' +
        '<li><b>吃东西、钓鱼、打架</b> —— 都会消耗玩家随机数</li>' +
        '<li><b>换台上的物品</b> —— 换了就得从头记</li>' +
        '</ul>' +
        '<div class="recnote" style="margin-top:10px"><b>开始前先静置 5 秒</b>：站在台子边别动，确认没有经验球在往你身上飞、没有维度传送动画、也没有待重生的状态。' +
        '<br><b>不需要先用祭品重置种子。</b>台子上那三档永远按当前种子实时算，你打开看到的就是当前值；先附魔一次只会把种子换成另一个新值，白记一遍还倒赔 1~3 级。祭品的真正用途在后面的刷种环节：每附魔一次，种子往前走一格，用来对准下一行。</div>' +
        '<p class="hint" style="margin-top:8px">例外：<b>为了改书架数量去搬方块是允许的</b> —— 它只改屏幕上的数字，不会换掉当前种子。规矩是「除了点开台子看数字和改书架，别的手都别动」。</p></div>',
      actions: [{ act: 'prepDone', label: '准备好了，继续', cls: 'primary' }]
    };

    case 'intro': return {
      card: '<h2 class="wtitle">先把东西放上台子</h2>' +
        '<p class="wsub">接下来一共 6 组数字，我一句一句带你记。</p>' +
        '<div class="banbox small"><div class="bantitle">全程别做</div><ul>' +
        '<li><b>点附魔</b></li><li><b>换物品</b></li><li><b>疾跑/冲刺</b></li>' +
        '<li><b>获得经验</b></li><li><b>穿梭维度</b></li><li><b>用指令</b></li>' +
        '<li><b>进信标范围</b></li><li><b>开箱子</b></li><li><b>死亡</b></li>' +
        '<li><b>丢物品</b></li><li><b>挖方块/合成</b></li><li><b>吃喝/钓鱼/打架</b></li></ul></div>' +
        '<p class="hint" style="margin:0 0 6px">需要：附魔台 · 15 书架 · 精准采集斧（别带耐久）· 祭品 · ≥30 级经验 · 可丢弃物品</p>' +
        '<div class="wrow"><span>物品</span><select id="iItem" class="nat"></select>' +
        '<button class="selbar" type="button" data-pick="iItem" data-title="选物品"><span class="tx"></span><span class="cv">▾</span></button></div>' +
        '<div class="wrow"><span>经验等级</span><input id="iLvl" type="number" inputmode="numeric" value="' + S.lvl + '"></div>' +
        '<div class="wrow"><span>附魔书架</span><select id="iShelf" class="nat"></select>' +
        '<button class="selbar" type="button" data-pick="iShelf" data-title="附魔书架"><span class="tx"></span><span class="cv">▾</span></button></div>' +
        '<p class="hint" id="introHint"></p>' +
        '<p class="hint">书架 15 个时附魔最强，先按 15 个准备。经验等级照你现在填，用来判断哪一档点得动。</p>',
      actions: [{ act: 'start', label: '开始记录观测', cls: 'primary' }],
      after: () => {
        fillItems($('iItem'), S.item); fillShelf($('iShelf'), S.shelf);
        PickSheet.syncAll();
        const box = document.getElementById('introHint');
        if (box) box.innerHTML = introSummary($('iItem').value);
      }
    };

    case 'collect': {
      const b = S.plan[S.idx];
      const k = S.idx + 1, total = S.plan.length;
      let how;
      const drop = '<b>用精准采集、没带耐久附魔的斧子挖掉一个</b>（拆下来的书架还能放回去），或者在书架和台子之间那一格放个方块把它堵住';
      if (b === 15) how = '把 15 个书架都摆好（离台子水平 2 格、同高或高一格，中间不要挡方块）。<b>数以飞向台子的粒子为准</b>就是有效数量。';
      else if (b === 0) how = '把所有书架都挖掉或堵住（或者换一张周围没有书架的台子），此时书架数应为 0。';
      else how = drop + '，这个书架立刻失效。' +
        (15 - b === 1 ? '<b>这次只减少 1 个</b>（现在一共少了 ' + (15 - b) + ' 个）。'
                      : '<b>累计减少 ' + (15 - b) + ' 个</b>，也就是在上一组的基础上再减 1 个。');
      const chips = S.obs.length ? '<div class="chips">' + S.obs.map(o =>
        '<span class="wchip"><i>' + o.b + ' 书架</i>' + o.levels.join(' / ') + '<b>✓</b></span>').join('') + '</div>' :
        '<p class="hint" style="margin-top:14px">还一组都没记。</p>';
      return {
        card: '<h2 class="wtitle">记录第 ' + k + ' / ' + total + ' 组' +
          (S.phase === 'B' ? ' <span style="font-size:11.5px;color:var(--accent);border:1px solid var(--line2);border-radius:6px;padding:1px 6px;vertical-align:2px">第二轮 · 刷种</span>' : '') + '</h2>' +
          '<p class="wsub">先把书架数量调好，再把附魔台三档显示的数字填进来。每记完一组，<b>用精准采集的斧子挖掉一个书架，或者拿方块堵住一个</b> —— 一次只动一个。</p>' +
          '<div class="wbig">' + b + '<small>个书架</small></div>' +
          '<div class="nums">' +
          '<div class="numcell"><input id="n0" type="number" inputmode="numeric" placeholder="—"><label>上档</label></div>' +
          '<div class="numcell"><input id="n1" type="number" inputmode="numeric" placeholder="—"><label>中档</label></div>' +
          '<div class="numcell"><input id="n2" type="number" inputmode="numeric" placeholder="—"><label>下档</label></div>' +
          '</div>' +
          '<p class="hint">' + how + '<br>某档灰色或不可选就填 0。</p>' +
          '<p class="hint" style="color:var(--bad)">这一段只许看数字：别点附魔、别换物品。除了放/挖方块改书架数，别的动作都别做 —— 尤其别疾跑、别合成、别丢东西。</p>' + chips,
        actions: [
          { act: 'saveObs', label: '记下了，继续', cls: 'primary' },
          { act: 'skipObs', label: '这组先跳过' }
        ].concat(S.obs.length ? [{ act: 'undoObs', label: '上一组填错了，重填' }] : []),
        after: () => {
          const e = $('n0'); if (e) e.focus({ preventScroll: true });
          /* 数字键盘回车：上档→中档→下档→直接提交进下一组 */
          const next = { n0: 'n1', n1: 'n2' };
          ['n0', 'n1', 'n2'].forEach(id => {
            const el = $(id); if (!el) return;
            el.addEventListener('keydown', ev => {
              if (ev.key !== 'Enter' || ev.isComposing) return;
              ev.preventDefault();
              if (next[id]) { const t = $(next[id]); if (t) { t.focus({ preventScroll: true }); if (t.select) t.select(); } return; }
              const b = document.querySelector('[data-act="saveObs"]');
              if (b) b.click();
            });
          });
        }
      };
    }

    case 'crackAsk': {
      const sv = loadScan();
      const pct = sv ? Math.round(sv.done.length / NCHUNK * 100) : 0;
      return {
        card: '<h2 class="wtitle">上次没扫完</h2>' +
          '<p class="wsub">上次已经扫过 ' + pct + '% 的种子范围。接着扫的话，<b>这些区间不会再重新计算</b>。</p>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '<p class="hint">观测记录没变才能续扫；改了观测就得从头来。</p>',
        actions: [{ act: 'resumeScan', label: '接着扫（' + pct + '% 已完成）', cls: 'primary' },
                  { act: 'restartScan', label: '从头开始' }]
      };
    }

    case 'crack': return {
      card: '<h2 class="wtitle">正在破解</h2>' +
        '<p class="wsub" id="csub">在 43 亿个种子里，找和你记下的数字完全一致的那一个。</p>' +
        '<div class="bar"><i id="cbar"></i></div>' +
        '<div class="stat" id="cstat">准备中…</div>' +
        '<p class="hint">手机一般几十秒。中途别锁屏，切走也能继续，回来就在这页。</p>',
      actions: [{ act: 'cancelCrack', label: '取消', cls: 'stopbtn' }]
    };

    case 'fail': return {
      card: '<h2 class="wtitle">这些数字对不上</h2>' +
        '<p class="wsub">没有找到任何符合的种子。通常是下面几种情况：</p>' +
        '<ul class="wlist">' +
        '<li>三档数字不是<b>同一个时刻</b>记的（中途点过任意一档）</li>' +
        '<li>书架数量算错 —— 用粒子数再确认一次</li>' +
        '<li>中间把物品换成别的了</li>' +
        '<li><b>游戏版本低于 1.21.4</b> —— 1.20 及更早的附魔池完全不同，这套算法不适用</li>' +
       '<li>服务器装了改附魔台逻辑的插件 / 数据包</li>' +
        '</ul>',
      actions: [{ act: 'restartCollect', label: '重新记一遍观测', cls: 'primary' },
                { act: 'hardReset', label: '全部重来' }]
    };

    case 'result': {
      const r = M.predict(S.cands[0], S.item, S.shelf);
      let best = -1;
      for (let i = 2; i >= 0; i--) if (r[i].usable && r[i].need <= S.lvl) { best = i; break; }
      const slots = r.map((s, i) => {
        const short = s.usable && s.need > S.lvl;
        const tag = !s.usable ? '<span class="tag no">不可选</span>'
          : short ? '<span class="tag no">等级不够</span>'
          : (i === best ? '<span class="tag go">推荐</span>' : '<span class="tag">可选</span>');
        return '<div class="slot' + (i === best ? ' pick' : '') + '"><div class="slot-h"><div>第 ' + (i + 1) + ' 档 ' + tag +
          '</div><div class="lv">需 ' + s.need + ' 级</div></div><div class="enl">' + esc(enchTxt(s.list)) + '</div></div>';
      }).join('');
      const acts = [];
      if (best >= 0) acts.push({ act: 'pick:' + best, label: '附魔第 ' + (best + 1) + ' 档：' + enchTxt(r[best].list).replace(/　\+　/g, '+'), cls: 'primary' });
      else acts.push({ act: 'needLvl', label: '等级还不够，先去练级', cls: 'primary' });
      acts.push({ act: 'reroll', label: '都不满意，教我怎么刷' });
      const reco = recoForItem(S.item);
      let recHTML = '';
      if (reco.length) {
        const got = {};
        r.forEach(sl => (sl.list || []).forEach(e => { if (got[e.id] === undefined || got[e.id] < e.lv) got[e.id] = e.lv; }));
        const parts = reco[0].items.map(t => {
          if (!t.ok) return '<span class="no">' + esc(t.label) + '<em>（' + esc(t.why) + '）</em></span>';
          const g = got[t.id];
          if (g === undefined) return '<span class="no">' + esc(t.label) + '（本种子没出）</span>';
          if (g >= t.lv) return '<span class="yes">' + esc(t.label) + ' ✓</span>';
          return '<span class="mid">' + esc(t.name) + ' ' + M.rom(g) + '（差 ' + (t.lv - g) + ' 级）</span>';
        });
        recHTML = '<p class="hint" style="margin-top:10px">对比建议组合「' + esc(reco[0].plan) + '」：<br>' + parts.join(' <i>·</i> ') + '</p>';
        const badIds = ['fire_aspect', 'knockback', 'thorns'];
        const bad = [];
        r.forEach(sl => (sl.list || []).forEach(e => { if (badIds.indexOf(e.id) >= 0 && bad.indexOf(e.name) < 0) bad.push(e.name); }));
        if (bad.length) recHTML += '<p class="recnote">这次三档里出现了 ' + esc(bad.join('、')) +
          '：生电玩家建议别选这几档 —— 火焰烧掉落物、击退把怪推走、荆棘扣耐久。</p>';
      }
      return {
        card: '<h2 class="wtitle">找到了，这次的三档</h2>' +
          '<p class="wsub">同一个界面、同一个书架数下，点哪一档你自己决定。</p>' +
          '<div class="seedbox"><code>' + esc(fmtU(S.cands[0])) + '</code><button data-act="copy">复制</button></div>' +
          slots +
          '<p class="hint">你现在 ' + S.lvl + ' 级 · 物品：' + esc(itemName(S.item)) + ' · ' + S.shelf + ' 个书架</p>' +
          recHTML,
        actions: acts
      };
    }

    case 'final': {
      const r = M.predict(S.cands[0], S.item, S.shelf);
      const p = r[S.pick];
      const nums = r.map(s => s.need).join(' / ');
      return {
        card: '<h2 class="wtitle">最后核对，然后附魔</h2>' +
          '<p class="wsub">进游戏按下面三条对一遍，全对就可以点了。</p>' +
          '<ul class="wlist">' +
          '<li>书架数量：' + S.shelf + ' 个</li>' +
          '<li>界面三档显示：<b>' + nums + '</b></li>' +
          '<li>点第 ' + (S.pick + 1) + ' 档（' + p.need + ' 级），应得到：<b>' + esc(enchTxt(p.list)) + '</b></li>' +
          '</ul>' +
          '<p class="hint">数字对不上就别点 —— 说明中途有别的动作改过随机数，回上一步重新记。</p>' +
          '<p class="hint" style="color:var(--bad)">点下去不可撤销：别点错档位。走过去的时候别疾跑，也别顺手挖块或合成，点之前保持站定。</p>',
        actions: [{ act: 'enchDone', label: '附魔完成了 ✓', cls: 'ok' },
                  { act: 'backResult', label: '数字对不上，回去看看' }]
      };
    }

    case 'rerollBroken': return {
      card: '<h2 class="wtitle">这两个种子不相邻</h2>' +
        '<p class="wsub">反推随机数状态失败了。原因通常是：两次破解之间除了附魔，还做了别的动作（投掷、钓鱼、吃东西等），或者中间又附魔过一次。</p>' +
        '<p class="hint">最简单的办法：从头再来一遍，第一次附魔后用最少的动作立刻回到台子记观测。</p>',
      actions: [{ act: 'startB', label: '重新记这轮观测', cls: 'primary' },
                { act: 'hardReset', label: '全部重来' }]
    };

    case 'rerollIntro': return {
      card: '<h2 class="wtitle">想换结果，就要重来一次</h2>' +
        '<p class="wsub">附魔会消耗掉这次机会（种子会变成下一个）。所以要靠「相邻两个种子」反推出随机数状态，才能算出投几件出你想要的。</p>' +
        '<ul class="wlist">' +
        '<li>先随便附魔一件便宜东西：<b>书、木剑</b>都行</li>' +
        '<li>种子会自动变成下一个</li>' +
        '<li>回来再记 6 组观测、破解一次，我就能算投掷表</li>' +
        '</ul>' +
        '<p class="hint">这次的种子 A 已经记下了：<b>' + (S.seedA !== null ? fmtU(S.seedA) : '—') + '</b></p>',
      actions: [{ act: 'startB', label: '我已经附魔了，开始记新观测', cls: 'primary' },
                { act: 'backResult', label: '算了，回到上一步' }]
    };

    case 'rerollTable': {
      const state = S.state;
      const t = throwsHTML(state, S.item, S.shelf, S.want);
      const opts = '<option value="">不限</option>' + t.enchOptions;
      return {
        card: '<h2 class="wtitle">投几件，出你要的</h2>' +
          '<p class="wsub">每投掉一件物品，下一次附魔的种子就往后挪一格。挑一行照着做就行。</p>' +
          '<div class="wrow"><span>想要的</span><select id="wantSel" class="nat">' + opts + '</select>' +
          '<button class="selbar" type="button" data-pick="wantSel" data-title="想要的附魔"><span class="tx"></span><span class="cv">▾</span></button></div>' +
          '<table class="tbl"><tr><th>投掷</th><th>第 ' + (S.pick + 1) + ' 档</th><th></th></tr>' +
          t.rows + '</table>' +
          '<p class="hint">表格里的「需 N 级」进游戏能直接对上，用来确认没被别的动作打乱。</p>',
        actions: [{ act: 'backResult', label: '算了，用现在的结果' }],
        after: () => { const w = $('wantSel'); if (w) w.value = S.want; PickSheet.syncAll(); }
      };
    }

    case 'rerollFinal': {
      const seed = S.throwSeed;
      const r = M.predict(seed, S.item, S.shelf);
      const nums = r.map(s => s.need).join(' / ');
      return {
        card: '<h2 class="wtitle">' + (S.throws > 0 ? '照着做：投 ' + S.throws + ' 件，再附魔' : '照着做：直接附魔') + '</h2>' +
          '<ul class="wlist">' +
          (S.throws > 0
            ? '<li>把 <b>' + S.throws + '</b> 件垃圾物品丢出去（选中后按 Q），一件一件丢，别丢多</li>'
            : '<li>这一档<b>不用投任何东西</b>，直接进入下一步</li>') +
          '<li>把 ' + esc(itemName(S.item)) + ' 放上台子</li>' +
          '<li>三档应显示：<b>' + nums + '</b></li>' +
          '<li>点第 ' + (S.pick + 1) + ' 档（' + r[S.pick].need + ' 级），应得到：<b>' + esc(enchTxt(r[S.pick].list)) + '</b></li>' +
          '</ul>' +
          '<p class="hint">中途别吃东西、别钓鱼、别打架，这些都可能在服务端消耗玩家随机数。对不上就重新破解一次。</p>' +
          '<p class="hint" style="color:var(--bad)">投掷数量要正好 ' + S.throws + ' 件：多一件少一件都对不上。中间别疾跑、别挖方块、别合成、别拿别的物品 —— 这些都会让推算失效。</p>',
        actions: [{ act: 'rerollDone', label: '附魔完成了 ✓', cls: 'ok' },
                  { act: 'backTable', label: '我想换一行' }]
      };
    }

    case 'done': {
      const r = M.predict(S.finalSeed || S.cands[0], S.item, S.shelf);
      const txt = r[S.pick] ? enchTxt(r[S.pick].list) : '';
      return {
        card: '<h2 class="wtitle">搞定 ✓</h2>' +
          '<p class="wsub">你拿到的应该是：<b>' + esc(txt) + '</b></p>' +
          '<p class="hint">种子已经用掉了。想再附魔一件，就重新走一遍流程 —— 每一步都只有一两个按钮。</p>',
        actions: [{ act: 'again', label: '再来一次', cls: 'primary' }]
      };
    }
  }
  return { card: '', actions: [] };
}

/* ---------- 投掷表 ---------- */
function throwsHTML(state, item, b, want) {
  let rows = '', opts = '', seen = {};
  const itemData = M.candidates(item, 30).map(c => c.id);
  const all = [];
  for (let t = 0; t <= 8; t++) { const sd = M.seedAfterThrows(state, t); all.push({ t: t, seed: sd, r: M.predict(sd, item, b) }); }
  all.forEach(x => x.r.forEach(s => s.list.forEach(e => { if (!seen[e.id]) { seen[e.id] = 1; opts += '<option value="' + e.id + '">' + esc(e.name) + '</option>'; } })));
  all.forEach(x => {
    const hit = want && x.r.some(s => s.list.some(e => e.id === want));
    rows += '<tr class="' + (want ? (hit ? 'hit' : 'dim') : '') + '">' +
      '<td class="n">' + x.t + ' 件<br><span style="color:var(--dimmer);font-size:10.5px">' + x.seed + '</span></td>' +
      '<td>' + x.r.map((s, i) => '<span style="color:var(--dimmer)">' + (i + 1) + '</span> <span style="color:var(--dim);font-size:10.5px">需' +
        s.need + '级</span> ' + esc(enchTxt(s.list))).join('<br>') + '</td>' +
      '<td><button data-act="useThrow:' + x.t + ':' + x.seed + '">用这行</button></td></tr>';
  });
  return { rows: rows, enchOptions: opts };
}

/* ---------- 破解：多线程分块扫描（动态领取 + 断点续扫） ---------- */
const CHUNK = 1 << 24, NCHUNK = 256;
const WASM_B64 = (($('wasmbin') || {}).textContent || '').trim();
const SCAN_KEY = 'mcrng.scan.v1';
function obsFp() { return S.obs.map(o => o.b + ':' + o.levels.join(',')).join('|'); }
function loadScan() {
  try {
    const o = JSON.parse(localStorage.getItem(SCAN_KEY) || 'null');
    return (o && o.fp && Array.isArray(o.done)) ? o : null;
  } catch (e) { return null; }
}
function saveScan(fp, done) { try { localStorage.setItem(SCAN_KEY, JSON.stringify({ fp: fp, done: done })); } catch (e) {} }
function clearScan() { try { localStorage.removeItem(SCAN_KEY); } catch (e) {} }

const WORKER_GLUE = [
  'var WP = null;',
  'function wInit(){',
  '  if (WP) return WP;',
  '  if (typeof WebAssembly === "undefined" || !self.__wb64) { WP = Promise.resolve(null); return WP; }',
  '  try {',
  '    var bin = atob(self.__wb64), u8 = new Uint8Array(bin.length);',
  '    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);',
  '    WP = WebAssembly.instantiate(u8.buffer, {}).then(function(r){ return r.instance.exports; })',
  '      .catch(function(){ return null; });',
  '  } catch (e) { WP = Promise.resolve(null); }',
  '  return WP;',
  '}',
  'function wObs(W, obs){',
  '  var p = W.raw_ptr() >> 2, m = new Uint32Array(W.memory.buffer);',
  '  for (var i = 0; i < obs.length; i++) {',
  '    m[p + i*5] = obs[i].b;',
  '    m[p + i*5 + 1] = obs[i].levels[0];',
  '    m[p + i*5 + 2] = obs[i].levels[1];',
  '    m[p + i*5 + 3] = obs[i].levels[2];',
  '  }',
  '  return W.prepare(obs.length);',
  '}',
  'function runScan(d){',
  '  wInit().then(function(W){',
  '    var M = self.MCRNG, out = [], SUB = 1 << 21, chks = null;',
  '    if (W) { try { wObs(W, d.obs); } catch (e) { W = null; } }',
  '    if (!W) chks = d.obs.map(function(o){ return M.makeCheckerFast(o.b, o.levels[0], o.levels[1], o.levels[2]); });',
  '    if (W) self.postMessage({ type: "w", on: 1 });',
  '    for (var pos = d.from; pos < d.to; pos += SUB) {',
  '      var cnt = Math.min(SUB, d.to - pos);',
  '      if (W) {',
  '        var n = W.scan(pos, cnt, 0);',
  '        if (n) {',
  '          var a = new Uint32Array(W.memory.buffer, W.out_ptr(), n);',
  '          for (var k = 0; k < n; k++) out.push(a[k]);',
  '        }',
  '        if (n >= W.out_cap()) { self.postMessage({ type: "big" }); return; }',
  '      } else {',
  '        var o2 = [];',
  '        M.scanSeeds(chks, pos, pos + cnt, o2);',
  '        for (var k2 = 0; k2 < o2.length; k2++) out.push(o2[k2]);',
  '      }',
  '      self.postMessage({ type: "p", at: pos + cnt });',
  '      if (out.length > 200000) { self.postMessage({ type: "big" }); return; }',
  '    }',
  '    self.postMessage({ type: "d", found: out, chunk: d.chunk, wasm: W ? 1 : 0 });',
  '  });',
  '}',
  'self.onmessage = function(e){',
  '  var d = e.data;',
  '  if (d.cmd === "init") { self.__wb64 = d.b64; wInit(); return; }',
  '  if (d.cmd === "stop") { self.postMessage({ type: "idle" }); return; }',
  '  if (d.cmd !== "scan") return;',
  '  runScan(d);',
  '};'
].join('\n');

function stopJob() {
  if (!job) return;
  job.cancel = true;
  (job.workers || []).forEach(w => { try { w.terminate(); } catch (e) {} });
  job = null;
}

const clampB = b => Math.max(0, Math.min(15, b | 0));
function bMapOf(item) {
  if (!item) return b => b;
  if (item.mode === 'flat') return () => clampB(item.k);
  return b => clampB(b + item.k);
}

function startScan(resumeDone, opts) {
  stopJob();
  const opt = opts || {};
  const bm = opt.bMap || (b => b);
  const fp = obsFp() + (opt.tag ? '#' + opt.tag : '');
  const doneSet = new Set(resumeDone || []);
  const obs = S.obs.map(o => ({ b: bm(o.b), levels: o.levels.slice() }));
  const hw = (navigator.hardwareConcurrency || 4) | 0;
  const nw = Math.max(1, Math.min(8, hw || 4));
  const st = {
    fp: fp, doneSet: doneSet, nextChunk: 0, doneCount: doneSet.size,
    idle: 0, workers: [], found: [], t0: Date.now(), cancel: false, nw: nw,
    onDone: opt.onDone || null, tag: opt.tag || ''
  };
  job = st;

  const progress = () => {
    if (!job || job !== st) return;
    const p = st.doneCount / NCHUNK * 100;
    if ($('cbar')) $('cbar').style.width = p.toFixed(1) + '%';
    const el = (Date.now() - st.t0) / 1000;
    const left = NCHUNK - st.doneCount;
    const eta = st.doneCount > doneSet.size ? el * left / (st.doneCount - doneSet.size) : 0;
    if ($('cstat')) {
      const mine = st.doneCount - doneSet.size;
      const rate = el > 0.5 && mine > 0 ? (mine * CHUNK / el) / 1e6 : 0;   // 百万种子/秒
      $('cstat').textContent =
        '已扫描 ' + p.toFixed(1) + '%　剩余约 ' + Math.ceil(eta) + ' 秒　' +
        (rate ? rate.toFixed(1) + 'M种子/秒　' : '') +
        '（' + nw + ' 线程' + (st.wasmOn ? ' · WASM' : '') + '）';
    }
  };

  const nextFree = () => {
    while (st.nextChunk < NCHUNK) {
      const c = st.nextChunk++;
      if (!st.doneSet.has(c)) return c;
    }
    return -1;
  };
  const feed = w => {
    const c = nextFree();
    if (c < 0) { try { w.postMessage({ cmd: 'stop' }); } catch (e) {} return; }
    w.postMessage({ cmd: 'scan', obs: obs, from: c * CHUNK, to: (c + 1) * CHUNK, chunk: c });
  };

  const finish = () => {
    if (!job || job !== st) return;
    job = null;
    let all = [];
    st.found.forEach(a => { all = all.concat(a); });
    all = Array.from(new Set(all)).sort((a, b) => a - b);
    clearScan();
    (st.onDone || onCracked)(all);
  };

  let url = null;
  try { url = URL.createObjectURL(new Blob([$('engine').textContent + '\n' + WORKER_GLUE], { type: 'application/javascript' })); } catch (e) { url = null; }

  if (url && typeof Worker !== 'undefined') {
    try {
      for (let i = 0; i < nw; i++) {
        const w = new Worker(url);
        try { w.postMessage({ cmd: 'init', b64: WASM_B64 }); } catch (e) {}
        w.onmessage = ev => {
          const d = ev.data;
          if (!job || job !== st) return;
          if (d.type === 'w') { st.wasmOn = true; return; }
          if (d.type === 'p') { progress(); return; }
          if (d.type === 'd') {
            if (d.found && d.found.length) st.found.push(d.found);
            if (typeof d.chunk === 'number') st.doneSet.add(d.chunk);
            st.doneCount = st.doneSet.size;
            saveScan(fp, Array.from(st.doneSet));
            progress();
            feed(w);
            return;
          }
          if (d.type === 'idle') {
            st.idle++;
            if (st.idle >= nw) finish();
            return;
          }
          if (d.type === 'big') {
            st.cancel = true;
            (st.workers || []).forEach(x => { try { x.terminate(); } catch (e) {} });
            job = null;
            toast('候选太多，再加一组观测');
            S.idx = 0; go('collect');
          }
        };
        w.onerror = () => { st.idle++; if (st.idle >= nw && job === st) finish(); };
        st.workers.push(w);
        feed(w);
      }
      progress();
      return;
    } catch (e) { url = null; }
  }

  /* 单线程回退（同样支持断点续扫） */
  const chks = obs.map(o => M.makeCheckerFast(o.b, o.levels[0], o.levels[1], o.levels[2]));
  const tick = () => {
    if (!job || job !== st) return;
    const c = nextFree();
    if (c < 0) { finish(); return; }
    const out = [];
    M.scanSeeds(chks, c * CHUNK, (c + 1) * CHUNK, out);
    if (out.length) st.found.push(out);
    st.doneSet.add(c);
    st.doneCount = st.doneSet.size;
    saveScan(fp, Array.from(st.doneSet));
    progress();
    setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
}

function onCracked(list) {
  if (!list.length) { go('fail'); return; }
  if (list.length === 1) {
    if (S.phase === 'A') { S.cands = list; go('result'); }
    else {
      S.seedB = list[0];
      const state = M.solveState(S.seedA, S.seedB);
      if (state === null) { S.state = null; go('rerollBroken'); return; }
      S.state = state;
      go('rerollTable');
    }
    return;
  }
  const used = S.obs.map(o => o.b);
  const pool = EXTRA.concat(PLAN, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])
    .filter((b, i, a) => a.indexOf(b) === i && used.indexOf(b) < 0);
  if (!pool.length) { go('fail'); return; }
  /* 挑一组最能把这些候选区分开的书架：分组后最大的那堆最小 */
  const sig = list.slice(0, 400);
  let best = null;
  for (const b of pool) {
    const g = {};
    for (const sd of sig) {
      const k = M.levels(sd, b).join(',');
      g[k] = (g[k] || 0) + 1;
    }
    const groups = Object.keys(g).length;
    let maxg = 0;
    for (const k in g) if (g[k] > maxg) maxg = g[k];
    if (!best || maxg < best.maxg) best = { b: b, maxg: maxg, groups: groups };
  }
  if (!best) { go('fail'); return; }
  S.plan.push(best.b);
  if (best.maxg >= sig.length) {
    toast('剩下 ' + list.length + ' 个候选连观测都分不开');
  } else {
    toast('还有 ' + list.length + ' 个候选，再加一组（' + best.b + ' 个书架最能分开）');
  }
  go('collect');
}

/* ---------- 左上角：从头开始（再点一下就确认） ---------- */
function fullReset() {
  S.obs = []; S.plan = PLAN.slice(); S.idx = 0; S.cands = null; S.seedA = S.seedB = null;
  S.state = null; S.phase = 'A'; S.finalSeed = null; save();
}
const rbtn = $('restartBtn');
if (rbtn) {
  let armTimer = null;
  const disarm = () => { rbtn.classList.remove('arm'); rbtn.textContent = '↺'; clearTimeout(armTimer); };
  rbtn.onclick = () => {
    if (rbtn.classList.contains('arm')) {
      disarm(); closeSheets(); fullReset(); go('prep'); toast('已回到第一步');
      return;
    }
    rbtn.classList.add('arm'); rbtn.textContent = '确认？';
    armTimer = setTimeout(disarm, 2600);
  };
}

/* 顶栏滚动阴影 */
(function () {
  const tb = document.getElementById('topbar');
  if (!tb) return;
  const onScroll = () => tb.classList.toggle('scrolled', (window.pageYOffset || document.documentElement.scrollTop || 0) > 3);
  try { window.addEventListener('scroll', onScroll, { passive: true }); } catch (e) {}
  onScroll();
})();

/* ---------- 交互 ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'openEnch') {
    fillEnchItems(''); $('enchItem').value = S.item; PickSheet.syncAll();
    renderEnch(); openSheet('enchSheet');
  } else if (act === 'openRepo') {
    openExt(REPO_URL);
  } else if (act === 'openSet') {
    openSheet('setSheet');
  } else if (act === 'prepDone') {
    go('intro');
  } else if (act === 'startNow') {
    go('prep');
  } else if (act === 'noMore') {
    CFG.welcome = false; save(); applyTheme();
    const w = document.getElementById('optWelcome'); if (w) w.checked = false;
    toast('下次直接开始');
    go('intro');
  } else if (act === 'start') {
    S.item = $('iItem').value;
    S.lvl = Math.max(1, Math.min(100, parseInt($('iLvl').value, 10) || 30));
    S.shelf = +$('iShelf').value;
    save();
    S.phase = 'A'; S.obs = []; S.plan = PLAN.slice(); S.idx = 0; S.cands = null; S.seedA = S.seedB = null;
    go('collect');
  } else if (act === 'saveObs') {
    const lv = [0, 1, 2].map(i => { const v = $('n' + i).value.trim(); return v === '' ? NaN : parseInt(v, 10); });
    if (lv.some(v => !isFinite(v) || v < 0 || v > 30)) { toast('三档都要填 0–30'); return; }
    S.obs.push({ b: S.plan[S.idx], levels: lv, pi: S.idx });
    S.idx++;
    if (S.idx >= S.plan.length) go('crack'); else go('collect');
  } else if (act === 'undoObs') {
    if (!S.obs.length) return;
    const last = S.obs.pop();
    S.idx = Math.max(0, last.pi | 0);
    go('collect');
  } else if (act === 'skipObs') {
    S.idx++;
    if (S.idx >= S.plan.length) {
      if (S.obs.length < 3) { toast('至少要记 3 组'); S.idx = S.plan.length - 1; go('collect'); return; }
      go('crack');
    } else go('collect');
  } else if (act === 'resumeScan') {
    S.resume = true; go('crack');
  } else if (act === 'restartScan') {
    clearScan(); S.resume = false; go('crack');
  } else if (act === 'cancelCrack') {
    stopJob();
    S.idx = 0;
    toast('已取消，可以重新记');
    go('collect');
  } else if (act === 'restartCollect') {
    S.obs = []; S.plan = PLAN.slice(); S.idx = 0;
    go('collect');
  } else if (act === 'hardReset') {
    S.obs = []; S.plan = PLAN.slice(); S.idx = 0; S.cands = null; S.seedA = S.seedB = null; S.phase = 'A';
    go('intro');
  } else if (act.indexOf('pick:') === 0) {
    S.pick = +act.split(':')[1];
    go('final');
  } else if (act === 'needLvl') {
    toast('先把等级练上去，或者换书架数量再看');
  } else if (act === 'backResult') {
    if (S.phase === 'B' && S.state) go('rerollTable'); else go('result');
  } else if (act === 'enchDone') {
    S.finalSeed = S.cands[0];
    go('done');
  } else if (act === 'reroll') {
    const r0 = M.predict(S.cands[0], S.item, S.shelf);
    for (let i = 2; i >= 0; i--) if (r0[i].usable && r0[i].need <= S.lvl) { S.pick = i; break; }
    S.seedA = S.cands[0];
    go('rerollIntro');
  } else if (act === 'startB') {
    S.phase = 'B'; S.obs = []; S.plan = PLAN.slice(); S.idx = 0; S.cands = null;
    go('collect');
  } else if (act === 'backTable') {
    go('rerollTable');
  } else if (act === 'rerollDone') {
    S.finalSeed = S.throwSeed;
    go('done');
  } else if (act === 'again') {
    S.obs = []; S.plan = PLAN.slice(); S.idx = 0; S.cands = null; S.seedA = S.seedB = null;
    S.state = null; S.phase = 'A'; S.finalSeed = null;
    go('intro');
  } else if (act === 'copy') {
    copyText(String(S.cands[0]));
  } else if (act.indexOf('useThrow:') === 0) {
    const p = act.split(':');
    S.throws = +p[1]; S.throwSeed = +p[2];
    go('rerollFinal');
  }
});

document.addEventListener('change', ev => {
  if (ev.target.id === 'wantSel') { S.want = ev.target.value; render(); }
  if (ev.target.id === 'iItem') {
    const box = document.getElementById('introHint');
    if (box) box.innerHTML = introSummary(ev.target.value);
  }
});

/* 进入 crack 步骤：有断点先问，否则直接开扫 */
const _go = go;
go = function (id) {
  _go(id);
  if (id !== 'crack') return;
  setTimeout(function () {
    const saved = loadScan();
    const same = saved && saved.fp === obsFp();
    if (S.resume) {
      S.resume = false;
      startScan(same ? saved.done : null);
      return;
    }
    if (same && saved.done.length > 0 && saved.done.length < NCHUNK) { go('crackAsk'); return; }
    startScan(null);
  }, 50);
};

/* ---------- 附魔表 ---------- */
const TREASURE = [['mending', '经验修补'], ['soul_speed', '灵魂疾行'], ['swift_sneak', '迅捷潜行'],
  ['frost_walker', '冰霜行者'], ['wind_burst', '风爆'], ['binding_curse', '绑定诅咒'], ['vanishing_curse', '消失诅咒']];

/* ---------- 建议组合（按 B 站 up 主那张装备附魔表，图里没有的我补） ---------- */
const RECO = {
  helmet: [{ plan: '头盔', ench: [['protection', 4], ['aqua_affinity', 1], ['respiration', 3], ['unbreaking', 3], ['mending', 1]] }],
  chestplate: [{ plan: '胸甲', ench: [['protection', 4], ['unbreaking', 3], ['mending', 1]] }],
  leggings: [{ plan: '护腿', ench: [['protection', 4], ['swift_sneak', 3], ['unbreaking', 3], ['mending', 1]] }],
  boots: [{ plan: '靴子', ench: [['protection', 4], ['feather_falling', 4], ['depth_strider', 3], ['soul_speed', 3], ['unbreaking', 3], ['mending', 1]] }],
  sword: [
    { plan: '主手剑', ench: [['sharpness', 5], ['looting', 3], ['sweeping_edge', 3], ['unbreaking', 3], ['mending', 1]] },
    { plan: '亡灵剑', ench: [['smite', 5], ['looting', 3], ['sweeping_edge', 3], ['unbreaking', 3], ['mending', 1]] }],
  axe: [{ plan: '斧', ench: [['efficiency', 5], ['fortune', 3], ['unbreaking', 3], ['mending', 1]] }],
  pickaxe: [
    { plan: '镐（精准向）', ench: [['efficiency', 5], ['silk_touch', 1], ['unbreaking', 3], ['mending', 1]] },
    { plan: '镐（时运向）', ench: [['efficiency', 5], ['fortune', 3], ['unbreaking', 3], ['mending', 1]] }],
  shovel: [
    { plan: '锹（精准向）', ench: [['efficiency', 5], ['silk_touch', 1], ['unbreaking', 3], ['mending', 1]] },
    { plan: '锹（时运向）', ench: [['efficiency', 5], ['fortune', 3], ['unbreaking', 3], ['mending', 1]] }],
  hoe: [{ plan: '锄（补充）', ench: [['efficiency', 5], ['fortune', 3], ['unbreaking', 3], ['mending', 1]] }],
  bow: [{ plan: '弓', ench: [['power', 5], ['punch', 2], ['flame', 1], ['infinity', 1], ['unbreaking', 3]] }],
  crossbow: [
    { plan: '弩（多重）', ench: [['multishot', 1], ['quick_charge', 3], ['unbreaking', 3], ['mending', 1]] },
    { plan: '弩（穿透）', ench: [['piercing', 4], ['quick_charge', 3], ['unbreaking', 3], ['mending', 1]] }],
  trident: [
    { plan: '三叉戟（忠诚）', ench: [['impaling', 5], ['loyalty', 3], ['channeling', 1], ['unbreaking', 3]] },
    { plan: '三叉戟（激流）', ench: [['impaling', 5], ['riptide', 3], ['unbreaking', 3]] }],
  fishing: [{ plan: '钓鱼竿', ench: [['luck_of_the_sea', 3], ['lure', 3], ['unbreaking', 3], ['mending', 1]] }],
  shears: [{ plan: '剪刀（补充）', ench: [['efficiency', 5], ['unbreaking', 3]] }],
  mace: [
    { plan: '重锤（密度，补充）', ench: [['density', 5], ['unbreaking', 3], ['mending', 1]] },
    { plan: '重锤（破甲，补充）', ench: [['breach', 4], ['unbreaking', 3], ['mending', 1]] }],
  spear: [{ plan: '长矛（补充）', ench: [['lunge', 3], ['sharpness', 5], ['looting', 3], ['unbreaking', 3], ['mending', 1]] }],
  book: []
};
const FARM_NOTE = '生电玩家注意：<b>火焰附加</b>、<b>击退</b>、<b>荆棘</b> 都不建议上 —— ' +
  '火焰会把掉落物烧掉，击退会把怪推出击杀位或水流，荆棘每次反伤都要额外扣一次耐久（明显加快损坏，经验修补也追不上）。';
function catOf(it) {
  if (!it) return null;
  if (it.key === 'book') return 'book';
  if (it.key === 'shears') return 'shears';
  const t = it.tags || [];
  const has = k => t.indexOf(k) >= 0;
  if (has('sword')) return 'sword';
  if (has('spear')) return 'spear';
  if (has('axe')) return 'axe';
  if (has('pickaxe')) return 'pickaxe';
  if (has('shovel')) return 'shovel';
  if (has('hoe')) return 'hoe';
  if (has('head_armor')) return 'helmet';
  if (has('chest_armor')) return 'chestplate';
  if (has('leg_armor')) return 'leggings';
  if (has('foot_armor')) return 'boots';
  if (has('bow')) return 'bow';
  if (has('crossbow')) return 'crossbow';
  if (has('trident')) return 'trident';
  if (has('fishing')) return 'fishing';
  if (has('mace')) return 'mace';
  return null;
}
function topLevelFor(key, id) {
  const e = M.ENCH[id], it = M.ITEM[key];
  if (!e || !it) return 0;
  const maxE = maxECost(it.en);
  for (let L = e.max; L >= 1; L--) {
    if (e.minB + (L - 1) * e.minP <= maxE && e.maxB + (L - 1) * e.maxP >= 26) return L;
  }
  return 0;
}
function judgeEnch(key, id, lv) {
  const e = M.ENCH[id], name = e ? e.name : (TREASURE.find(t => t[0] === id) || [0, id])[1];
  const label = name + (lv > 1 ? ' ' + M.rom(lv) : '');
  if (!e) return { id: id, name: name, lv: lv, label: label, ok: false, why: '台子不出，需书/铁砧' };
  const applies = key === 'book' ? true : (e.pri.length ? e.pri.indexOf(key) >= 0 : e.sup.indexOf(key) >= 0);
  if (!applies) return { id: id, name: name, lv: lv, label: label, ok: false, why: '此物品吃不到' };
  const top = topLevelFor(key, id);
  if (top < lv) return { id: id, name: name, lv: lv, label: label, ok: false,
    why: '台子最高 ' + M.rom(top) + '，' + M.rom(lv) + ' 需书/铁砧' };
  return { id: id, name: name, lv: lv, label: label, ok: true, why: '' };
}
function recoForItem(key) {
  const cat = catOf(M.ITEM[key]);
  return (cat && RECO[cat]) ? RECO[cat].map(p => ({
    plan: p.plan, items: p.ench.map(([id, lv]) => judgeEnch(key, id, lv))
  })) : [];
}

const GROUP_CN = { armor: '保护', boots: '靴子', bow: '弓', crossbow: '弩',
  damage: '伤害', mining: '采集', riptide: '激流' };
function maxECost(en) { return Math.round((31 + 2 * Math.floor(en / 4)) * 1.15); }
function enchForItem(key) {
  const it = M.ITEM[key];
  if (!it) return null;
  const maxE = maxECost(it.en), on = [], off = [];
  for (const e of M.DATA.ench) {
    const applies = key === 'book' ? true : (e.pri.length ? e.pri.indexOf(key) >= 0 : e.sup.indexOf(key) >= 0);
    if (!applies) { off.push({ name: e.name, why: '不适用于这件物品' }); continue; }
    let top = 0;
    for (let L = e.max; L >= 1; L--) {
      const mn = e.minB + (L - 1) * e.minP, mx = e.maxB + (L - 1) * e.maxP;
      if (mn <= maxE && mx >= 26) { top = L; break; }
    }
    if (top > 0) on.push({ id: e.id, name: e.name, lv: top, w: e.w, excl: e.excl || null });
    else off.push({ name: e.name, why: '花费区间超出这台子的上限' });
  }
  TREASURE.forEach(t => { if (!off.some(o => o.name === t[1])) off.push({ name: t[1], why: '宝物附魔，附魔台不出' }); });
  off.sort((a, b) => (a.why === '宝物附魔，附魔台不出' ? -1 : 0) - (b.why === '宝物附魔，附魔台不出' ? -1 : 0));
  return { on: on, off: off, maxE: maxE, en: it.en };
}
function introSummary(key) {
  const r = enchForItem(key);
  if (!r) return '';
  return esc(itemName(key)) + '：这台子能出 ' + r.on.length + ' 种 —— ' +
    r.on.map(e => e.name).join('、') + '；吃不到 ' + r.off.length +
    ' 种（别的装备系附魔 + 宝物附魔）。点右上角「附魔表」可看全部。';
}
function renderEnch() {
  const key = $('enchItem').value;
  const r = enchForItem(key);
  if (!r) { $('enchOut').innerHTML = ''; return; }
  const itn = itemName(key);
  let h = '<p class="hint" style="margin:6px 0 0">' + esc(itn) + ' · 附魔能力 ' + r.en +
    ' · 30 级时内部花费上限约 ' + r.maxE + '</p>';
  const reco = recoForItem(key);
  if (reco.length) {
    h += '<div class="esec">建议组合 <i>灰掉的表示台子直接拿不到</i></div><div>';
    reco.forEach(p => {
      const parts = p.items.map(t => t.ok
        ? '<span>' + esc(t.label) + '</span>'
        : '<span class="off">' + esc(t.label) + '<em>' + esc(t.why) + '</em></span>');
      h += '<div class="rec"><b>' + esc(p.plan) + '</b><div class="rl">' + parts.join(' <i>·</i> ') + '</div></div>';
    });
    const farmIds = ['fire_aspect', 'knockback', 'thorns'];
    if (r.on.some(e => farmIds.indexOf(e.id) >= 0)) h += '<p class="recnote">' + FARM_NOTE + '</p>';
    h += '</div>';
  }

  h += '<div class="esec">能出 <i>' + r.on.length + ' 种</i></div><div class="elist">';
  if (!r.on.length) h += '<div class="eitem"><b>没有</b><span class="ereason">这件物品在台子里出不了附魔</span></div>';
  r.on.forEach(e => {
    h += '<div class="eitem"><b>' + esc(e.name) + '</b><span class="elv">' + M.rom(e.lv) + '</span>' +
      (e.excl ? '<span class="etag">' + (GROUP_CN[e.excl] || e.excl) + '</span>' : '') +
      '<span class="ew">权重 ' + e.w + '</span></div>';
  });
  h += '</div>';
  /* 冲突关系 */
  const groups = [];
  r.on.forEach(e => { if (e.excl && groups.indexOf(e.excl) < 0) groups.push(e.excl); });
  if (groups.length) {
    h += '<div class="esec">冲突关系 <i>同一件装备上每组只能取其一</i></div><div class="elist">';
    const nameOf = id => (M.ENCH[id] ? M.ENCH[id].name : (TREASURE.find(t => t[0] === id) || [0, id])[1]);
    groups.forEach(g => {
      const members = (M.DATA.excl[g] || []).slice();
      M.DATA.ench.forEach(e => { if (e.excl === g && members.indexOf(e.id) < 0) members.push(e.id); });
      const parts = members.map(id => {
        const canGet = r.on.some(x => x.id === id);
        return canGet ? esc(nameOf(id)) : '<span class="emut">' + esc(nameOf(id)) + '（台子不出）</span>';
      });
      h += '<div class="eitem conf"><b>' + (GROUP_CN[g] || g) + '系</b><span class="ereason">' +
        parts.join(' / ') + '</span></div>';
    });
    h += '</div>';
  }

  h += '<div class="esec">吃不到 <i>' + r.off.length + ' 种</i></div><div class="elist off">';
  r.off.forEach(e => {
    h += '<div class="eitem"><b>' + esc(e.name) + '</b><span class="ereason">' + esc(e.why) + '</span></div>';
  });
  h += '</div>';
  h += '<p class="hint">带红色组标的附魔属于互斥组：上面那几条「冲突关系」写明了每组里谁和谁只能二选一/多选一。' +
    '它们都算「能出」，只是不会同时出现在同一件装备上。</p>';
  h += '<button class="wbtn" id="enchAllBtn" style="margin-top:14px">看全部物品的一览表</button><div id="enchAll"></div>';
  $('enchOut').innerHTML = h;
  $('enchAllBtn').onclick = () => {
    const box = $('enchAll');
    if (box.innerHTML) { box.innerHTML = ''; $('enchAllBtn').textContent = '看全部物品的一览表'; return; }
    let t = '<table class="tbl" style="margin-top:10px"><tr><th>物品</th><th>能出（最高等级）</th></tr>';
    M.DATA.items.forEach(it => {
      const q = enchForItem(it.key);
      if (!q || !q.on.length) return;
      t += '<tr><td class="n" style="white-space:normal">' + esc(it.name) + '</td><td style="font-size:11.5px">' +
        q.on.map(e => esc(e.name) + M.rom(e.lv)).join('、') + '</td></tr>';
    });
    t += '</table>';
    box.innerHTML = t;
    $('enchAllBtn').textContent = '收起一览表';
  };
}

/* ---------- 面板（设置 / 高级） ---------- */

/* 外链：App 内走原生桥交给浏览器，网页版直接新窗口 */
const REPO_URL = 'https://github.com/fuhang122/enchant-rng-assistant';
function openExt(url) {
  try { if (window.AndroidHost && AndroidHost.openUrl) { AndroidHost.openUrl(url); return; } } catch (e) {}
  try { window.open(url, '_blank'); } catch (e) {}
}

/* 退出要按两次返回键 */
let QUIT_ARM = 0;
function armQuit() {
  if (Date.now() < QUIT_ARM) { QUIT_ARM = 0; return true; }
  QUIT_ARM = Date.now() + 2000;
  toast('再按一次返回键退出');
  return false;
}

/* 系统返回键：退出确认 → 面板 → 栈里的上一步；第一步再按才退出 */
window.__back = function () {
  try {
    if (window.PickSheet && PickSheet.isOpen()) { PickSheet.close(); return 1; }
    if (document.querySelector('.sheet.on')) { closeSheets(); return 1; }
    if (step === 'collect') { return armQuit() ? 0 : 1; }
    if (step === 'crack' || step === 'fail') { stopJob(); paint('collect'); return 1; }
    const prev = BACK[step];
    if (prev) { paint(prev); return 1; }
    return armQuit() ? 0 : 1;
  } catch (e) { return 0; }
};

window.__hasSheet = function () {
  if (window.PickSheet && PickSheet.isOpen()) return 1;
  return document.querySelector('.sheet.on') ? 2 : 0;
};
window.__closeSheets = function () {
  if (window.PickSheet && PickSheet.isOpen()) { PickSheet.close(); return; }
  closeSheets();
};

function openSheet(id) {
  $('mask').classList.add('on');
  document.querySelectorAll('.sheet').forEach(s => s.classList.toggle('on', s.id === id));
  if (id === 'setSheet') { const w = $('optWelcome'); if (w) w.checked = CFG.welcome; applyTheme(); }
}
function closeSheets() {
  $('mask').classList.remove('on');
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
}
$('setBtn').onclick = () => openSheet('setSheet');
$('enchBtn').onclick = () => {
  fillEnchItems(''); $('enchItem').value = S.item; PickSheet.syncAll();
  renderEnch(); openSheet('enchSheet');
};

$('enchClose').onclick = closeSheets;
$('enchItem').onchange = () => { renderEnch(); PickSheet.sync($('enchItem')); };
$('advBtn').onclick = () => openSheet('sheet');
$('setClose').onclick = closeSheets;
$('sheetClose').onclick = closeSheets;
$('mask').onclick = closeSheets;

$('segTheme').addEventListener('click', ev => {
  const b = ev.target.closest('[data-theme-opt]');
  if (!b) return;
  CFG.theme = b.getAttribute('data-theme-opt');
  save(); applyTheme(); toast('外观已切换');
});
$('optWelcome').onchange = ev => {
  CFG.welcome = ev.target.checked; save();
  toast(CFG.welcome ? '启动时会显示首页' : '启动时跳过首页');
};
const repoBtn = $('repoBtn');
if (repoBtn) repoBtn.onclick = () => openExt(REPO_URL);
$('resetAll').onclick = () => {
  S.obs = []; S.plan = PLAN.slice(); S.idx = 0; S.cands = null; S.seedA = S.seedB = null;
  S.state = null; S.phase = 'A'; S.finalSeed = null;
  closeSheets();
  go(CFG.welcome ? 'welcome' : 'intro');
};
fillItems($('advItem'), S.item);
fillItems($('enchItem'), S.item);
fillShelf($('advShelf'), S.shelf);
$('advGo').onclick = () => {
  const sd = parseSeed($('advSeed').value);
  if (sd === null) { toast('种子格式不对'); return; }
  const item = $('advItem').value, b = +$('advShelf').value;
  const r = M.predict(sd, item, b);
  $('advOut').innerHTML = '<div class="hint">' + esc(fmtU(sd)) + '</div>' + r.map((s, i) =>
    '<div class="slot"><div class="slot-h"><div>第 ' + (i + 1) + ' 档</div><div class="lv">需 ' + s.need + ' 级</div></div>' +
    '<div class="enl' + (s.list.length ? '' : ' mute') + '">' + esc(enchTxt(s.list)) + '</div></div>').join('');
};
$('advChain').onclick = () => {
  const a = parseSeed($('advA').value), b = parseSeed($('advB').value);
  if (a === null || b === null) { toast('两个种子都要填'); return; }
  const state = M.solveState(a, b);
  if (!state) { $('advChainOut').innerHTML = '<p class="hint" style="color:var(--bad)">这两个种子不是相邻的 nextInt 输出。</p>'; return; }
  const t = throwsHTML(state, $('advItem').value, +$('advShelf').value, '');
  $('advChainOut').innerHTML = '<div class="hint">随机数状态：' + state.toString(16).toUpperCase().padStart(12, '0') +
    '</div><table class="tbl"><tr><th>投掷</th><th>三档</th></tr>' + t.rows.replace(/<td><button[\s\S]*?<\/button><\/td>/g, '') + '</table>';
};
const isApp = location.href.indexOf('android_asset') >= 0;
const tutHref = isApp ? 'tutorial.html' : '附魔台RNG教程.html';
const fullHref = isApp ? 'full.html' : '附魔台RNG助手.html';
function withTheme(href) { return href + '#theme=' + encodeURIComponent(CFG.theme); }
function renderLinks() {
  $('tutLink').innerHTML = '详细教程：<a style="color:var(--accent)" href="' + withTheme(tutHref) + '">图文教程</a>' +
    '　·　' + '手动模式：<a style="color:var(--accent)" href="' + withTheme(fullHref) + '">标签版工具</a>';
}
renderLinks();

/* ---------- 启动 ---------- */
applyTheme();
render();
if (RESUME && RESUME !== 'welcome') setTimeout(() => toast('已回到上次进度'), 320);
setTimeout(() => { try { if (window.AndroidHost && AndroidHost.ready) AndroidHost.ready(); } catch (e) {} }, 60);
})();
