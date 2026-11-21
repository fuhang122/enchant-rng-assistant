// 代码生成版 checker：把 LCG 步进内联进循环体
const STEP = `
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
function slotCode(slot, eName) {
  const lvl = slot === 0 ? 'Math.max((i / 3) | 0, 1)'
            : slot === 1 ? '(((i * 2 / 3) | 0) + 1)'
            : '(i > B2 ? i : B2)';
  return `
${STEP}
n1 = x2 >>> 13;
${''}
`;
}
module.exports = function makeCheckerFast(b, e0, e1, e2) {
  const bp1 = b + 1, half = b >> 1, b2 = b * 2;
  const pow2 = (bp1 & (bp1 - 1)) === 0;
  const sh = pow2 ? 31 - Math.round(Math.log2(bp1)) : 0;
  const d2 = pow2
    ? `${STEP}\nn2 = (x2 * 32768 + (x1 >>> 1)) >> ${sh};`
    : `do { ${STEP}\nbits = x2 * 32768 + (x1 >>> 1); n2 = bits % ${bp1}; } while (bits - n2 + ${bp1 - 1} >= 2147483648);`;
  const chk = (slot, e) => `
i = n1 + 1 + ${half} + n2;
{
  var raw = ${slot === 0 ? 'Math.max((i / 3) | 0, 1)' : slot === 1 ? '(((i * 2 / 3) | 0) + 1)' : '(i > ' + b2 + ' ? i : ' + b2 + ')'};
  if (!(raw === ${e} || (${e} === 0 && raw < ${slot + 1}) || (raw < ${slot + 1} ? 0 : raw) === ${e})) return false;
}`;
  const src = `
return function (x0, x1, x2) {
  var t0, t1, t2, u1, r0, r1, r2, i, n1, n2, bits, raw;
  ${STEP}
  n1 = x2 >>> 13;
  ${d2}
  ${chk(0, e0)}
  ${STEP}
  n1 = x2 >>> 13;
  ${d2}
  ${chk(1, e1)}
  ${STEP}
  n1 = x2 >>> 13;
  ${d2}
  ${chk(2, e2)}
  return true;
};`;
  return new Function(src)();
};
