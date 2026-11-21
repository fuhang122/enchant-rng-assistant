// 一致性验证：用真实 xpSeed 生成观测 → JS 与 WASM 在同一区间必须给出相同结果，且包含该种子
const fs = require('fs'), path = require('path');
const M = require('../build/core.js');

(async () => {
  const mod = await WebAssembly.instantiate(fs.readFileSync(path.join(__dirname, 'scan2.wasm')), {});
  const ex = mod.instance.exports;
  const mem = new Uint32Array(ex.memory.buffer);
  const SHELF = [15, 13, 10, 6, 3, 0];

  function setObs(obs) {
    const p = ex.raw_ptr() / 4;
    obs.forEach((o, i) => {
      mem[p + i * 5] = o.b;
      mem[p + i * 5 + 1] = o.levels[0];
      mem[p + i * 5 + 2] = o.levels[1];
      mem[p + i * 5 + 3] = o.levels[2];
    });
    ex.prepare(obs.length);
  }
  const obsOf = (seed) => SHELF.map(b => ({ b, levels: M.levels(seed, b) }));

  let bad = 0;
  const ranges = [
    [0, 1 << 20],
    [2147483648 - (1 << 19), 2147483648 + (1 << 19)],   // 跨符号位（hi16 切换点）
    [4294967296 - (1 << 20), 4294967296],                 // 末尾
  ];
  for (const [from, to] of ranges) {
    const seed = from + 12345 + ((to - from) >> 2);       // 区间内一个真实种子
    const obs = obsOf(seed);
    setObs(obs);
    const chks = obs.map(o => M.makeCheckerFast(o.b, ...o.levels));
    const js = []; M.scanSeeds(chks, from, to, js);
    const n = ex.scan(from, to - from, 0);
    const was = Array.from(new Uint32Array(ex.memory.buffer, ex.out_ptr(), n));
    const eq = js.length === was.length && js.every((v, i) => v === was[i]);
    const has = was.includes(seed);
    if (!eq || !has) bad++;
    console.log(`[${from},${to}) 命中 js=${js.length} wasm=${was.length} 序列一致=${eq} 含真实种子=${has}`);
  }
  console.log(bad ? 'FAIL' : '全部一致 ✓');
  process.exit(bad ? 1 : 0);
})();
