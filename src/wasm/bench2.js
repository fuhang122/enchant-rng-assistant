// wasm vs js 基准 + 一致性（node 侧）
const fs = require('fs');
const path = require('path');
const M = require('../build/core.js');

(async () => {
  const bytes = fs.readFileSync(path.join(__dirname, 'scan2.wasm'));
  const mod = await WebAssembly.instantiate(bytes, {});
  const ex = mod.instance.exports;
  const mem = new Uint32Array(ex.memory.buffer);

  function setObs(obs) {
    const p = ex.raw_ptr() / 4;
    obs.forEach((o, i) => {
      mem[p + i * 5 + 0] = o.b;
      mem[p + i * 5 + 1] = o.levels[0];
      mem[p + i * 5 + 2] = o.levels[1];
      mem[p + i * 5 + 3] = o.levels[2];
      mem[p + i * 5 + 4] = 0;
    });
    return ex.prepare(obs.length);
  }

  // 观测集：书架 15/13/10/6/3/0，等级随便取（用来测速与一致性，不要求有解）
  const OBS = [
    { b: 15, levels: [30, 15, 8] },
    { b: 13, levels: [26, 13, 7] },
    { b: 10, levels: [20, 10, 5] },
    { b: 6, levels: [12, 6, 3] },
    { b: 3, levels: [6, 3, 2] },
    { b: 0, levels: [2, 1, 1] },
  ];
  setObs(OBS);
  const chks = OBS.map(o => M.makeCheckerFast(o.b, ...o.levels));

  const FROM = 0, TO = 1 << 24; // 16M

  // ---- 一致性：同一区间命中集合必须逐条相同 ----
  function jsScan(from, to) {
    const out = [];
    M.scanSeeds(chks, from, to, out);
    return out;
  }
  function wasmScan(from, to) {
    const n = ex.scan(from, to - from, 0);
    const p = ex.out_ptr() / 4;
    return Array.from(new Uint32Array(ex.memory.buffer, p * 4, n));
  }

  const a = jsScan(FROM, TO), b = wasmScan(FROM, TO);
  const same = a.length === b.length && a.every((v, i) => v === b[i]);
  console.log('一致性', same ? 'OK' : 'MISMATCH', 'js=' + a.length, 'wasm=' + b.length);
  if (!same) {
    const sa = new Set(a);
    const diff = b.filter(v => !sa.has(v)).slice(0, 5);
    console.log('diff sample', diff);
    process.exit(1);
  }

  // ---- 计时 ----
  function time(fn, reps) {
    fn(FROM, Math.min(TO, FROM + (1 << 20))); // 预热
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < reps; i++) fn(FROM, TO);
    const t1 = process.hrtime.bigint();
    return Number(t1 - t0) / 1e6 / reps;
  }
  const jsMs = time(jsScan, 1);
  const wasmMs = time(wasmScan, 1);
  const seeds = TO - FROM;
  console.log(`JS   ${jsMs.toFixed(1)}ms  ${(jsMs * 1e6 / seeds).toFixed(2)} ns/seed`);
  console.log(`WASM ${wasmMs.toFixed(1)}ms  ${(wasmMs * 1e6 / seeds).toFixed(2)} ns/seed`);
  console.log(`倍数 ${(jsMs / wasmMs).toFixed(2)}x`);
})();
