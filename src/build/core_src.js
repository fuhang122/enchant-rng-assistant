/* ===== Minecraft Java 附魔台 RNG 引擎（1.21.x vanilla 行为） ===== */
(function (root) {
'use strict';
const DATA = __DATA__;
const ITEM = {}; DATA.items.forEach(i => ITEM[i.key] = i);
const ENCH = {}; DATA.ench.forEach(e => ENCH[e.id] = e);

/* ---------- java.util.Random ---------- */
const P48 = 281474976710656, P24 = 16777216;
const ML = 0xECE66D, MH = 0x5DE, ADD = 11;
function step(st) {
  const lo = st % P24, hi = (st - lo) / P24;
  return (((hi * ML + lo * MH) % P24) * P24 + lo * ML + ADD) % P48;
}
function seedToState(u) {
  const lo = (u ^ 0xDEECE66D) >>> 0;
  return (u >= 2147483648 ? 0xFFFA : 0x0005) * 4294967296 + lo;
}
function JR() { this.st = 0; }
JR.prototype.setSeed = function (s) { this.st = seedToState(s >>> 0); return this; };
JR.prototype.next = function (bits) { this.st = step(this.st); return Math.floor(this.st / Math.pow(2, 48 - bits)); };
JR.prototype.nextInt = function (n) {
  if ((n & (n - 1)) === 0 && n > 0) return Math.floor((n * this.next(31)) / 2147483648);
  let bits, val;
  do { bits = this.next(31); val = bits % n; } while (bits - val + (n - 1) >= 2147483648);
  return val;
};
JR.prototype.nextFloat = function () { return this.next(24) / 16777216; };

/* ---------- 16 位分肢快速 LCG（用于暴力搜索） ---------- */
const m0 = 0xE66D, m1 = 0xDEEC, m2 = 5;
let R0 = 0, R1 = 0, R2 = 0;
function stepL(x0, x1, x2) {
  const t0 = Math.imul(x0, m0);
  const t1 = (Math.imul(x0, m1) >>> 0) + (Math.imul(x1, m0) >>> 0);
  const t2 = (Math.imul(x0, m2) >>> 0) + (Math.imul(x1, m1) >>> 0) + (Math.imul(x2, m0) >>> 0);
  let r0 = (t0 >>> 0) & 0xFFFF;
  const u1 = t1 + ((t0 >>> 16) & 0xFFFF);
  let r1 = u1 & 0xFFFF;
  let r2 = (t2 + ((u1 / 65536) | 0)) & 0xFFFF;
  r0 += ADD;
  if (r0 >= 65536) { r0 -= 65536; r1 += 1; if (r1 >= 65536) { r1 -= 65536; r2 = (r2 + 1) & 0xFFFF; } }
  R0 = r0; R1 = r1; R2 = r2;
}

/* ---------- 附魔台 ---------- */
const levelFor = (jr, slot, b) => {
  const i = jr.nextInt(8) + 1 + (b >> 1) + jr.nextInt(b + 1);
  if (slot === 0) return Math.max(Math.floor(i / 3), 1);
  if (slot === 1) return Math.floor(i * 2 / 3) + 1;
  return Math.max(i, b * 2);
};
function levels(xpSeed, b) {
  const jr = new JR().setSeed(xpSeed >>> 0);
  return [levelFor(jr, 0, b), levelFor(jr, 1, b), levelFor(jr, 2, b)];
}
function candidates(itemKey, cost) {
  if (!ITEM[itemKey]) return [];
  const out = [];
  for (const e of DATA.ench) {
    let ok;
    if (itemKey === 'book') ok = true;
    else if (e.pri.length) ok = e.pri.indexOf(itemKey) >= 0;
    else ok = e.sup.indexOf(itemKey) >= 0;
    if (!ok) continue;
    for (let L = e.max; L >= 1; L--) {
      if (cost >= e.minB + (L - 1) * e.minP && cost <= e.maxB + (L - 1) * e.maxP) {
        out.push({ id: e.id, name: e.name, w: e.w, lv: L }); break;
      }
    }
  }
  return out;
}
function exclusive(a, b) {
  if (a === b) return true;
  const ea = ENCH[a], eb = ENCH[b];
  return !!((ea && ea.excl && (DATA.excl[ea.excl] || []).indexOf(b) >= 0) ||
            (eb && eb.excl && (DATA.excl[eb.excl] || []).indexOf(a) >= 0));
}
function generate(jr, itemKey, cost) {
  const it = ITEM[itemKey], e = it ? it.en : 0;
  if (e <= 0) return [];
  const q = (e >> 2) + 1;
  let lv = cost + 1 + jr.nextInt(q) + jr.nextInt(q);
  const f = (jr.nextFloat() + jr.nextFloat() - 1) * 0.15;
  lv = Math.floor(lv * (1 + f) + 0.5);
  if (lv < 1) return [];
  let cands = candidates(itemKey, lv);
  const out = [];
  let rem = lv;
  while (cands.length) {
    let total = 0; for (const c of cands) total += c.w;
    let k = jr.nextInt(total), idx = 0;
    while (k >= cands[idx].w) { k -= cands[idx].w; idx++; }
    const pick = cands[idx];
    out.push({ id: pick.id, name: pick.name, lv: pick.lv });
    cands = cands.filter(c => !exclusive(c.id, pick.id));
    if (!cands.length) break;
    if (jr.nextInt(50) >= rem + 1) break;
    rem = rem >> 1;
  }
  if (itemKey === 'book' && out.length > 1) out.splice(jr.nextInt(out.length), 1);
  return out;
}
function predict(xpSeed, itemKey, b) {
  const lv = levels(xpSeed, b), res = [];
  for (let s = 0; s < 3; s++) {
    const jr = new JR().setSeed((((xpSeed | 0) + s) | 0) >>> 0);
    res.push({ slot: s, need: lv[s], usable: lv[s] >= s + 1 && lv[s] > 0,
      list: lv[s] > 0 ? generate(jr, itemKey, lv[s]) : [] });
  }
  return res;
}
const ROM = ['', 'I', 'II', 'III', 'IV', 'V'];
function rom(n) { return ROM[n] || ('Lv' + n); }
function simulate(itemKey, b, n, seedFn) {
  const rnd = seedFn || (() => (Math.random() * 4294967296) >>> 0);
  const slotStat = [{}, {}, {}], lvStat = [{}, {}, {}], multi = [{}, {}, {}];
  for (let t = 0; t < n; t++) {
    const sd = rnd(), lv = levels(sd, b);
    for (let s = 0; s < 3; s++) {
      lvStat[s][lv[s]] = (lvStat[s][lv[s]] || 0) + 1;
      if (lv[s] < s + 1 || lv[s] <= 0) continue;
      const list = generate(new JR().setSeed((((sd | 0) + s) | 0) >>> 0), itemKey, lv[s]);
      if (!list.length) continue;
      multi[s][list.map(x => x.name + ' ' + rom(x.lv)).sort().join(' + ')] =
        (multi[s][list.map(x => x.name + ' ' + rom(x.lv)).sort().join(' + ')] || 0) + 1;
      for (const x of list) {
        const k = x.name + ' ' + rom(x.lv);
        slotStat[s][k] = (slotStat[s][k] || 0) + 1;
      }
    }
  }
  return { n, slotStat, lvStat, multi };
}

/* ---------- 破解：从显示等级反推 XpSeed ---------- */
function normSlot(raw, slot) { return raw < slot + 1 ? 0 : raw; }
const STEPC = `
t0 = Math.imul(x0, 58989);
t1 = (Math.imul(x0, 57068) >>> 0) + (Math.imul(x1, 58989) >>> 0);
t2 = (Math.imul(x0, 5) >>> 0) + (Math.imul(x1, 57068) >>> 0) + (Math.imul(x2, 58989) >>> 0);
r0 = (t0 >>> 0) & 65535;
u1 = t1 + ((t0 >>> 16) & 65535);
r1 = u1 & 65535;
r2 = (t2 + ((u1 / 65536) | 0)) & 65535;
r0 += 11;
if (r0 >= 65536) { r0 -= 65536; r1 += 1; if (r1 >= 65536) { r1 -= 65536; r2 = (r2 + 1) & 65535; } }
x0 = r0; x1 = r1; x2 = r2;
`;
function makeCheckerFast(b, e0, e1, e2) {
  const bp1 = b + 1, half = b >> 1, b2 = b * 2;
  const pow2 = (bp1 & (bp1 - 1)) === 0;
  const sh = pow2 ? 31 - Math.round(Math.log2(bp1)) : 0;
  const draw2 = pow2
      ? STEPC + `n2 = (x2 * 32768 + (x1 >>> 1)) >> ` + sh + `;`
      : `do {` + STEPC + `bits = x2 * 32768 + (x1 >>> 1); n2 = bits % ` + bp1 +
        `; } while (bits - n2 + ` + (bp1 - 1) + ` >= 2147483648);`;
  const slotChk = (slot, exp) => {
    const raw = slot === 0 ? 'Math.max((i / 3) | 0, 1)'
              : slot === 1 ? '(((i * 2 / 3) | 0) + 1)'
              : '(i > ' + b2 + ' ? i : ' + b2 + ')';
    return `i = n1 + 1 + ` + half + ` + n2;
raw = ` + raw + `;
if (!(raw === ` + exp + ` || (` + exp + ` === 0 && raw < ` + (slot + 1) +
      `) || (raw < ` + (slot + 1) + ` ? 0 : raw) === ` + exp + `)) return false;`;
  };
  const src = `return function (x0, x1, x2) {
var t0, t1, t2, u1, r0, r1, r2, i, n1, n2, bits, raw;
` + STEPC + `n1 = x2 >>> 13;
` + draw2 + slotChk(0, e0) + `
` + STEPC + `n1 = x2 >>> 13;
` + draw2 + slotChk(1, e1) + `
` + STEPC + `n1 = x2 >>> 13;
` + draw2 + slotChk(2, e2) + `
return true;};`;
  return new Function(src)();
}
function makeLimbs(u) {
  const lo = (u ^ 0xDEECE66D) >>> 0;
  return [lo & 0xFFFF, lo >>> 16, u >= 2147483648 ? 0xFFFA : 0x0005];
}
function scanSeeds(chks, from, to, out) {
  const n = chks.length;
  const c0 = chks[0];
  const c1 = n > 1 ? chks[1] : null;
  const c2 = n > 2 ? chks[2] : null;
  const c3 = n > 3 ? chks[3] : null;
  const c4 = n > 4 ? chks[4] : null;
  const c5 = n > 5 ? chks[5] : null;
  const c6 = n > 6 ? chks[6] : null;
  const c7 = n > 7 ? chks[7] : null;
  for (let s = from; s < to; s++) {
    const lo = (s ^ 0xDEECE66D) >>> 0;
    const x0 = lo & 0xFFFF, x1 = lo >>> 16;
    const x2 = s < 2147483648 ? 0x0005 : 0xFFFA;
    if (!c0(x0, x1, x2)) continue;
    if (c1 !== null && !c1(x0, x1, x2)) continue;
    if (c2 !== null && !c2(x0, x1, x2)) continue;
    if (c3 !== null && !c3(x0, x1, x2)) continue;
    if (c4 !== null && !c4(x0, x1, x2)) continue;
    if (c5 !== null && !c5(x0, x1, x2)) continue;
    if (c6 !== null && !c6(x0, x1, x2)) continue;
    if (c7 !== null && !c7(x0, x1, x2)) continue;
    out.push(s);
  }
}

/* 保守排序：只把「实测明显更便宜」的一条提到最前，其余保持原顺序（不改结果） */
function orderObservations(obs, probe) {
  const list = obs.slice();
  if (list.length < 2) return list;
  const N = probe || (1 << 19);
  const now = (typeof performance !== 'undefined' && performance.now)
    ? function () { return performance.now(); } : function () { return Date.now(); };
  const cost = list.map(function (o) {
    const chk = makeCheckerFast(o.b, o.levels[0], o.levels[1], o.levels[2]);
    let best = Infinity;
    for (let r = 0; r < 2; r++) {
      const out = [], t0 = now();
      scanSeeds([chk], 0, N, out);
      const d = now() - t0;
      if (d < best) best = d;
    }
    return best;
  });
  let bi = 0;
  for (let i = 1; i < cost.length; i++) if (cost[i] < cost[bi]) bi = i;
  if (bi !== 0 && cost[bi] < cost[0] * 0.95) {
    const first = list.splice(bi, 1)[0];
    list.unshift(first);
  }
  return list;
}

function checkSeed(u, chks) {
  const L = makeLimbs(u);
  for (let c = 0; c < chks.length; c++) if (!chks[c](L[0], L[1], L[2])) return false;
  return true;
}
function filterCandidates(arr, obs) {
  const chks = obs.map(o => makeCheckerFast(o.b, o.levels[0], o.levels[1], o.levels[2]));
  const out = [];
  for (let i = 0; i < arr.length; i++) if (checkSeed(arr[i], chks)) out.push(arr[i]);
  return out;
}

/* ---------- 玩家 RNG（48 位）状态求解与递推 ---------- */
const MASK48B = (1n << 48n) - 1n, MB = 0x5DEECE66Dn, AB = 0xBn;
function solveState(s1, s2) {
  const u1 = BigInt(s1 >>> 0), u2 = BigInt(s2 >>> 0);
  const a = (24667315n * (u1 + 1n) + 18218081n * (u2 + 1n)) >> 32n;
  const b = (-4824621n * u1 + 7847617n * (u2 + 1n)) >> 32n;
  let seed = (7847617n * a - 18218081n * b) & MASK48B;
  if (Number((seed >> 16n) & 0xFFFFFFFFn) !== (s1 >>> 0)) {
    seed = (seed * MB + AB) & MASK48B;
    if (Number((seed >> 16n) & 0xFFFFFFFFn) !== (s2 >>> 0)) return null;
    return seed;
  }
  seed = (seed * MB + AB) & MASK48B;
  if (Number((seed >> 16n) & 0xFFFFFFFFn) !== (s2 >>> 0)) return null;
  return seed;
}
function stateNextInt(seed) {
  const st = (seed * MB + AB) & MASK48B;
  return [st, Number((st >> 16n) & 0xFFFFFFFFn)];
}
function stateSkip(seed, n) { for (let i = 0; i < n; i++) seed = (seed * MB + AB) & MASK48B; return seed; }
function seedAfterThrows(state, throws) {
  const st = throws > 0 ? stateSkip(state, 4 * throws) : state;
  const r = stateNextInt(st);
  return r[1] >>> 0;
}
function seedChain(state, throwsPerEnch, count) {
  const list = []; let st = state;
  for (let i = 0; i < count; i++) {
    if (i > 0) st = stateSkip(st, 4 * throwsPerEnch);
    const [ns, v] = stateNextInt(st);
    list.push(v >>> 0); st = ns;
  }
  return list;
}

const API = { DATA, ITEM, ENCH, JR, step, seedToState, levels, levelFor, candidates, generate, predict,
  simulate, normSlot, makeCheckerFast, makeLimbs, scanSeeds, orderObservations, checkSeed, filterCandidates,
  solveState, stateNextInt, stateSkip, seedAfterThrows, seedChain, rom, exclusive, stepL };
root.MCRNG = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
