#!/usr/bin/env node
/**
 * 核实书载案例库的真实可核实指标
 * 真源: book_case_library_tagged.json（可用 CASES_PATH 指定）
 * 只输出能由脚本复算的数字，不引用任何无法复现的说法。
 */
const fs = require('fs');
const p = process.env.CASES_PATH || require('path').join(__dirname, 'book_case_library_tagged.json');
const list = JSON.parse(fs.readFileSync(p, 'utf8'));

const total = list.length;

// 字段完整性
const fields = ['book','page','cnum','title','date','hour','sizhu','bookJu','pan',
                'scene','plateComputable','juMatch','chaibuJu','zhirunJu','confidence',
                'expectedVerdict','verdictSource'];
const completeness = {};
fields.forEach(f => { completeness[f] = list.filter(x => x[f] !== undefined && x[f] !== null && x[f] !== '').length; });

// 盘面可计算率
const computable = list.filter(x => x.plateComputable === true);
const plateComputable = list.filter(x => typeof x.plateComputable === 'boolean');

// 局数匹配：两套定局法分别与书载局数比对
function juEq(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const norm = v => String(v).replace(/\s/g, '').replace(/[^0-9]/g, '');
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return null;
  return na === nb;
}
const chaibuTestable = list.filter(x => juEq(x.bookJu, x.chaibuJu) !== null);
const chaibuMatch    = chaibuTestable.filter(x => juEq(x.bookJu, x.chaibuJu) === true);
const zhirunTestable = list.filter(x => juEq(x.bookJu, x.zhirunJu) !== null);
const zhirunMatch    = zhirunTestable.filter(x => juEq(x.bookJu, x.zhirunJu) === true);

// 两套定局法都测得了且结论一致/不一致
const bothTestable = list.filter(x => juEq(x.bookJu, x.chaibuJu) !== null && juEq(x.bookJu, x.zhirunJu) !== null);
const bothAgree = bothTestable.filter(x => juEq(x.bookJu, x.chaibuJu) === juEq(x.bookJu, x.zhirunJu));
const splitCases = bothTestable.filter(x => juEq(x.bookJu, x.chaibuJu) !== juEq(x.bookJu, x.zhirunJu));

// 预期吉凶判定
const hasVerdict = list.filter(x => x.expectedVerdict !== undefined && x.expectedVerdict !== null && x.expectedVerdict !== '');
const verdictSource = {};
hasVerdict.forEach(x => { const k = String(x.verdictSource || 'unknown'); verdictSource[k] = (verdictSource[k] || 0) + 1; });

// 用神覆盖
const sizhuMissing = list.filter(x => !x.sizhu || (Array.isArray(x.sizhu) && x.sizhu.length === 0)).length;

// 出处分布
const books = {};
list.forEach(x => { const b = String(x.book || 'unknown'); books[b] = (books[b] || 0) + 1; });

// 页码可追溯性
const withPage = list.filter(x => x.page !== undefined && x.page !== null && x.page !== '').length;

const pct = (a, b) => b === 0 ? null : +(a / b * 100).toFixed(1);

console.log(JSON.stringify({
  source: p,
  totalCases: total,
  fieldCompleteness: completeness,
  pageTraceable: { withPage, pct: pct(withPage, total) },
  plateComputable: {
    testable: plateComputable.length,
    trueCount: computable.length,
    falseCount: plateComputable.filter(x => x.plateComputable === false).length,
    unknownCount: total - plateComputable.length,
    pct: pct(computable.length, plateComputable.length)
  },
  juMatch_chaibu: { testable: chaibuTestable.length, match: chaibuMatch.length, pct: pct(chaibuMatch.length, chaibuTestable.length) },
  juMatch_zhirun: { testable: zhirunTestable.length, match: zhirunMatch.length, pct: pct(zhirunMatch.length, zhirunTestable.length) },
  juMethodSplit: {
    bothTestable: bothTestable.length,
    agree: bothAgree.length,
    disagree: splitCases.length,
    disagreeCases: splitCases.slice(0, 12).map(x => ({
      cnum: x.cnum, book: x.book, page: x.page, bookJu: x.bookJu, chaibuJu: x.chaibuJu, zhirunJu: x.zhirunJu
    }))
  },
  verdict: {
    hasExpectedVerdict: hasVerdict.length,
    pct: pct(hasVerdict.length, total),
    bySource: verdictSource
  },
  sizhu: { missing: sizhuMissing, pct: pct(sizhuMissing, total) },
  books
}, null, 2));