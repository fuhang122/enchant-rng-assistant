/* v2：用真正的 64 位整数做 LCG（48 位状态 = 24+24 分肢，每步只需 2 次 u64 乘法）
 * 与 build/core_src.js makeCheckerFast 逐位等价（三个档位从同一随机数流顺序抽取） */
typedef unsigned int u32;
typedef unsigned long long u64;

#define MAXOBS 8
#define OUTCAP (1u << 19)
#define M48 0xFFFFFFFFFFFFull

static u32 raw[MAXOBS * 5];
static int nobs = 0;
static u32 pe0[MAXOBS], pe1[MAXOBS], pe2[MAXOBS];
static u32 pbp1[MAXOBS], phalf[MAXOBS], pb2[MAXOBS], psh[MAXOBS];
static int ppow2[MAXOBS];
static u32 outbuf[OUTCAP];

__attribute__((export_name("raw_ptr"))) u32 raw_ptr(void) { return (u32)(unsigned long)raw; }
__attribute__((export_name("out_ptr"))) u32 out_ptr(void) { return (u32)(unsigned long)outbuf; }
__attribute__((export_name("out_cap"))) u32 out_cap(void) { return OUTCAP; }

__attribute__((export_name("prepare"))) int prepare(int n) {
  if (n > MAXOBS) n = MAXOBS;
  nobs = n;
  for (int k = 0; k < n; k++) {
    u32 b = raw[k * 5 + 0], bp1 = b + 1, sh = 0, v = bp1;
    pe0[k] = raw[k * 5 + 1]; pe1[k] = raw[k * 5 + 2]; pe2[k] = raw[k * 5 + 3];
    pbp1[k] = bp1; phalf[k] = b >> 1; pb2[k] = b * 2;
    ppow2[k] = (bp1 & (bp1 - 1)) == 0;
    while (v > 1) { v >>= 1; sh++; }
    psh[k] = 31 - sh;
  }
  return nobs;
}

static inline u64 stp(u64 s) {
  u64 lo = s & 0xFFFFFFu, hi = s >> 24;
  u64 t = lo * 0x5DEECE66Du;
  u64 h = (hi * 0x5DEECE66Du) & 0xFFFFFFu;
  return (t + (h << 24) + 0xBu) & M48;
}

static inline int slotok(u32 rawv, u32 exp, u32 sp1) {
  if (rawv == exp) return 1;
  if (exp == 0u && rawv < sp1) return 1;
  u32 norm = rawv < sp1 ? 0u : rawv;
  return norm == exp;
}

/* 抽一次 nextInt(8) + nextInt(b+1) 所需的两次推进，返回 i */
#define DRAW_I(s, i_out) do { \
  u32 n1, n2, bits_; \
  (s) = stp(s); n1 = (u32)((s) >> 45); \
  if (p2) { (s) = stp(s); bits_ = (u32)((s) >> 17); n2 = bits_ >> sh; } \
  else { do { (s) = stp(s); bits_ = (u32)((s) >> 17); n2 = bits_ % bp1; } \
         while (bits_ - n2 + (bp1 - 1u) >= 2147483648u); } \
  (i_out) = n1 + 1u + half + n2; \
} while (0)

static inline int chk(int k, u64 s) {
  const u32 half = phalf[k], b2 = pb2[k], bp1 = pbp1[k], sh = psh[k];
  const int p2 = ppow2[k];
  u32 i, r;

  DRAW_I(s, i);
  r = i / 3u; if (r < 1u) r = 1u;
  if (!slotok(r, pe0[k], 1u)) return 0;

  DRAW_I(s, i);
  r = (i * 2u) / 3u + 1u;
  if (!slotok(r, pe1[k], 2u)) return 0;

  DRAW_I(s, i);
  r = i > b2 ? i : b2;
  if (!slotok(r, pe2[k], 3u)) return 0;
  return 1;
}

/* from + count 可能等于 2^32，所以传「个数」而不是「终点」 */
__attribute__((export_name("scan"))) u32 scan(u32 from, u32 count, u32 *total) {
  u32 n = 0, hits = 0;
  const int no = nobs;
  for (u32 j = 0; j < count; j++) {
    u32 sd = from + j;
    u64 s = (u64)(sd ^ 0xDEECE66Du) |
            (sd < 2147483648u ? (0x0005ull << 32) : (0xFFFAull << 32));
    int ok = 1;
    for (int k = 0; k < no; k++) { if (!chk(k, s)) { ok = 0; break; } }
    if (!ok) continue;
    if (n < OUTCAP) outbuf[n++] = sd;
    hits++;
  }
  if (total) *total = hits;
  return n;
}
