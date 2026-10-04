/**
 * Snapshot tests — three known-good charts (fact data).
 * Run: node test/test.js
 */
const e = require('../src/index.js');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

console.log('[1] 2026-06-07 11:00 — Yang Dun 6, Chabu');
let r = e.paipan(2026, 6, 7, 11, 0, 'chaibu');
ok(r.juNum === 6 && r.isYang === true, 'ju = Yang 6');
ok(r.zhiFuXing === '天蓬' && r.zhiFuGong === 4, 'Zhi-Fu star 天蓬@4');
ok(r.zhiShiMen === '休门' && r.zhiShiGong === 3, 'Zhi-Shi door 休门@3 (independent rotation)');

console.log('[2] 2022-05-09 12:00 — Zhirun: Guyu lower yuan, Yang 8');
r = e.paipan(2022, 5, 9, 12, 0, 'zhirun');
ok(r.juNum === 8 && r.isYang === true, 'ju = Yang 8 (futou-based attribution)');

console.log('[3] 1997-01-07 20:40 — Yang Dun 2, global Fu-Yin');
r = e.paipan(1997, 1, 7, 20, 40, 'chaibu');
ok(r.juNum === 2 && r.isYang === true, 'ju = Yang 2');
ok(r.geju && r.geju.some(g => g.name && g.name.indexOf('伏吟') >= 0), 'Fu-Yin formation detected');

console.log('[4] Plate structure invariants');
r = e.paipan(2026, 6, 7, 11, 0, 'zhirun');
ok(r.dp && Object.keys(r.dp).length === 9, 'earth plate: 9 palaces');
ok(r.tp && Object.keys(r.tp).length === 9, 'heaven plate: 9 palaces');
ok(r.xing && r.men && r.shen, 'stars/doors/gods present');
ok(r.kong && r.kong.length === 2, 'void branches (xun-kong) present');
ok(typeof r.maGong === 'number', 'horse palace present');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
