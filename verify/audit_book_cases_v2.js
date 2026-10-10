#!/usr/bin/env node
/**
 * audit_book_cases_v2.js — 第二批书载案例审计（一本 1990 年代案例集）
 *
 * 与第一批（audit_book_cases.js，142 例古典案例库）相互独立：
 * 不同的书、不同的来源、不同的统计口径 —— 两批数字不可混算。
 *
 * 本脚本复现的数字（79 例可测，见 book499_case_library.json）：
 *   - 四柱校验通过率（含 ±400 天日期修正扫描）
 *   - 拆补 / 置闰 / 超神接气 三种定局法的局数命中
 *   - 超神接气规则阈值 K=0..12 的敏感性扫描（K=8/9/10 平台期）
 *   - 超神接气未中 / 修复 / 引入的案例明细
 *
 * 一致性断言（可失败）：脚本内嵌的 K 参数化规则实现（K=9）必须与引擎
 * 内建的 shenjieqi 模式给出完全相同的节气与局数；不一致则打印 MISMATCH
 * 并以退出码 1 结束。
 *
 * 引擎加载：ENGINE_PATH 环境变量（默认 ../src/index.js）
 * 数据加载：CASES499_PATH 环境变量（默认 ./book499_case_library.json）
 */
const path = require('path');
const fs = require('fs');
const ENGINE = process.env.ENGINE_PATH || path.join(__dirname, '..', 'src', 'index.js');
const eng = require(ENGINE);
const CASES_PATH = process.env.CASES499_PATH || path.join(__dirname, 'book499_case_library.json');
const lib = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
const recs = lib.cases;

const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const juNumOf = v => {
  const m = String(v).match(/([一二三四五六七八九123456789])/);
  return m ? (CN[m[1]] !== undefined ? CN[m[1]] : parseInt(m[1], 10)) : null;
};
const pad = n => (n < 10 ? '0' : '') + n;
const SHI_MID = { '子': 0, '丑': 2, '寅': 4, '卯': 6, '辰': 8, '巳': 10, '午': 12, '未': 14, '申': 16, '酉': 18, '戌': 20, '亥': 22 };
function addDays(dateStr, d) {
  const [y, m, dd] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
}

// ---- 脚本内 K 参数化「超神接气」规则（独立于引擎内建实现，用于敏感性扫描与自校验）----
function juByRuleK(dateStr, hh, K) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jqInfo = eng.jqDate(y, m, d, hh, 0);   // 基准节气：精确交节时刻
  let jn = jqInfo.name;
  const dgz = eng.dGZDate(y, m, d);
  const yuan = Math.floor(eng.gXun(dgz) / 5) % 3;
  const F = eng.upperFuTouDate(y, m, d);        // 最近上元符头
  if (F) {
    const fstr = F.y + '-' + pad(F.m) + '-' + pad(F.d);
    for (let i = 1; i <= 20; i++) {              // F 之后第一个交节日
      const ds = addDays(fstr, i);
      const [yy, mm, dd] = ds.split('-').map(Number);
      const jn2 = eng.jieQiOnDay(yy, mm, dd);
      if (jn2) { if (i <= K) jn = jn2; break; } // 距符头 ≤K 天 → 提前用下一节气
    }
  }
  const iy = eng.YANGJQ.indexOf(jn) !== -1;
  return { jieqi: jn, isYang: iy, juNum: (eng.JQJU[jn] || [1])[yuan] };
}

// ---- 主流程 ----
let tested = 0, pillarOk = 0, dateFixed = 0, unverifiable = 0;
let cHit = 0, zHit = 0, sHit = 0, union = 0;
const fixedRows = [], missRows = [], fixRows = [], breakRows = [], noMatchRows = [];
const analyzed = [];   // {page, useDate, timeStr, by, bn}

for (const r of recs) {
  if (!r.date) continue;                         // 无完整日期 → 跳过（诚实计数）
  const shiChar = r.sizhu.slice(7, 8);
  const hhFix = SHI_MID[shiChar];
  if (hhFix === undefined) continue;
  const timeStr = pad(hhFix) + ':00';
  tested++;

  // 四柱校验（含 ±400 天日期修正扫描）
  let useDate = r.date, e = null;
  try { e = eng.paipanLegacy(r.date, timeStr, 'chaibu'); } catch (err) {}
  if (!e || (e.ygz + e.mgz + e.dgz + e.hgz) !== r.sizhu) {
    let found = false;
    for (let d = -400; d <= 400 && !found; d++) {
      if (d === 0) continue;
      const dt = addDays(r.date, d);
      let e2 = null;
      try { e2 = eng.paipanLegacy(dt, timeStr, 'chaibu'); } catch (err) {}
      if (e2 && (e2.ygz + e2.mgz + e2.dgz + e2.hgz) === r.sizhu) { e = e2; useDate = dt; found = true; }
    }
    if (!found) {
      unverifiable++;
      noMatchRows.push({ page: r.page, sizhu: r.sizhu, bookJu: r.bookJu, note: 'no pillar match within ±400 days' });
      continue;
    }
    dateFixed++;
    fixedRows.push({ page: r.page, from: r.date, to: useDate, sizhu: r.sizhu });
  }
  pillarOk++;

  const by = r.bookJu[0], bn = juNumOf(r.bookJu);
  let c = null, z = null, s = null;
  try { c = eng.paipanLegacy(useDate, timeStr, 'chaibu'); } catch (err) {}
  try { z = eng.paipanLegacy(useDate, timeStr, 'zhirun'); } catch (err) {}
  try { s = eng.paipanLegacy(useDate, timeStr, 'shenjieqi'); } catch (err) {}
  const okC = c && c.juType.charAt(0) === by && c.juNum === bn;
  const okZ = z && z.juType.charAt(0) === by && z.juNum === bn;
  const okS = s && s.juType.charAt(0) === by && s.juNum === bn;
  if (okC) cHit++;
  if (okZ) zHit++;
  if (okS) sHit++;
  if (okC || okZ || okS) union++;

  analyzed.push({ page: r.page, useDate: useDate, timeStr: timeStr, by: by, bn: bn });

  if (!okS) {
    missRows.push({
      page: r.page, date: useDate,
      book: by + '遁' + bn,
      engine: s ? (s.jieqi + s.juType.charAt(0) + '遁' + s.juNum + (s.chaoShen ? ' (chao-shen gap ' + s.chaoShenGap + 'd)' : '')) : null,
      chaibuAlsoMisses: !okC, zhirunAlsoMisses: !okZ
    });
  }
  if (okC && !okS) breakRows.push({ page: r.page, date: useDate, book: by + '遁' + bn, engine: 'chaibu ok, shenjieqi -> ' + s.jieqi + s.juType.charAt(0) + '遁' + s.juNum + (s.chaoShen ? ' (gap ' + s.chaoShenGap + 'd)' : '') });
  if (!okC && okS) fixRows.push({ page: r.page, date: useDate, book: by + '遁' + bn, engine: 'chaibu -> ' + c.jieqi + c.juType.charAt(0) + '遁' + c.juNum + '; shenjieqi ok' + (s.chaoShen ? ' (gap ' + s.chaoShenGap + 'd)' : '') });
}

// ---- K 敏感性扫描（在分析集上，脚本内独立规则实现）----
const kSensitivity = [];
for (let K = 0; K <= 12; K++) {
  let hit = 0;
  for (const a of analyzed) {
    const r = juByRuleK(a.useDate, Number(a.timeStr.slice(0, 2)), K);
    if (r.isYang === (a.by === '阳') && r.juNum === a.bn) hit++;
  }
  kSensitivity.push({ K: K, hit: hit });
}

// ---- 一致性断言：脚本内规则(K=9) vs 引擎内建 shenjieqi ----
const mismatches = [];
for (const a of analyzed) {
  let s = null;
  try { s = eng.paipanLegacy(a.useDate, a.timeStr, 'shenjieqi'); } catch (err) {}
  const r = juByRuleK(a.useDate, Number(a.timeStr.slice(0, 2)), 9);
  if (!s || s.jieqi !== r.jieqi || s.juNum !== r.juNum || (s.juType.charAt(0) === '阳') !== r.isYang) {
    mismatches.push({ page: a.page, date: a.useDate, engine: s ? s.jieqi + '/' + s.juNum : null, rule: r.jieqi + '/' + r.juNum });
  }
}

const pct = (a, b) => +(a / b * 100).toFixed(1);
const out = {
  script: 'audit_book_cases_v2.js',
  engine: ENGINE,
  cases: CASES_PATH,
  entries: recs.length,
  noDate: recs.length - tested,
  tested: tested,
  pillar: { verified: pillarOk, dateCorrected: dateFixed, noMatchExcluded: unverifiable },
  juMatch: {
    denominator: tested,
    chaibu: { hit: cHit, pct: pct(cHit, tested) },
    zhirun: { hit: zHit, pct: pct(zHit, tested) },
    shenjieqi: { hit: sHit, pct: pct(sHit, tested) },
    union: { hit: union, pct: pct(union, tested) }
  },
  juMatchAnalyzedOnly: {
    denominator: pillarOk,
    chaibu: { hit: cHit, pct: pct(cHit, pillarOk) },
    zhirun: { hit: zHit, pct: pct(zHit, pillarOk) },
    shenjieqi: { hit: sHit, pct: pct(sHit, pillarOk) },
    union: { hit: union, pct: pct(union, pillarOk) }
  },
  shenjieqiDetail: { misses: missRows, fixes: fixRows, breaks: breakRows },
  kSensitivity: kSensitivity,
  consistency: {
    rule: 'script K-parameterized implementation (K=9) vs engine built-in shenjieqi mode',
    analyzedCases: analyzed.length,
    mismatches: mismatches,
    status: mismatches.length === 0 ? 'PASS' : 'FAIL'
  },
  dateCorrections: fixedRows,
  noPillarMatch: noMatchRows
};

console.log(JSON.stringify(out, null, 2));
if (mismatches.length) {
  console.error('MISMATCH: engine shenjieqi and script rule (K=9) disagree on ' + mismatches.length + ' cases');
  process.exitCode = 1;
}
