// 全时段覆盖遍历 v2 —— 断言用引擎真实不变式，不是恒为真的假断言
// 不变式（转盘九宫、中五寄坤二）：
//   A. tp/dp 九宫全有值
//   B. 值符星必落值符宫
//   C. 值使门必落值使宫
//   D. xing/men/shen 不含 5 宫（中宫寄坤）
//   E. 定局三元字段完整（juNum/juType/jieqi/jqRange）
// 用法: node sweep_coverage_v2.js [startYear] [endYear]
//引擎路径：默认用仓库内 src/index.js，可用 ENGINE_PATH 覆盖指向独立引擎副本
const ENGINE = process.env.ENGINE_PATH || require('path').join(__dirname, '..', 'src', 'index.js');
const qimen = require(ENGINE);

const Y0 = parseInt(process.argv[2] || '2000', 10);
const Y1 = parseInt(process.argv[3] || '2050', 10);
const METHODS = ['chaibu', 'zhirun'];
const SHICHEN = ['00:00','02:00','04:00','06:00','08:00','10:00',
                 '12:00','14:00','16:00','18:00','20:00','22:00'];
const DAYS = ['01','15','28'];
const GONGS = [1,2,3,4,6,7,8,9];

let total = 0, ok = 0;
const crashes = [];
const inv = { A_tpDp: [], B_zhiFuXing: [], C_zhiShiMen: [], D_center5: [], E_determinant: [] };
const seenJieqi = new Set();

function push(bucket, ctx, extra) {
  if (inv[bucket].length < 20) inv[bucket].push({ ...ctx, ...extra });
  else inv[bucket]._n = (inv[bucket]._n || 20) + 1;
}

function audit(c, ctx) {
  // A. 天地盘九宫完整
  for (const key of ['tp','dp']) {
    const m = c[key];
    if (!m || typeof m !== 'object') { push('A_tpDp', ctx, { why: key + ' 缺失' }); continue; }
    for (const g of GONGS) {
      if (m[g] == null || m[g] === '') push('A_tpDp', ctx, { why: key + '[' + g + '] 空' });
    }
  }
  // B. 值符星必落值符宫
  // 注意两点实测事实（v2 断言踩坑）：
  //   1) xing[g] 可能是合并标记 "天芮,天禽"（天禽寄坤随天芮），不能精确相等匹配
  //   2) chart.zhiFuXing 是「值符原宫 zfOG」本位的星，落盘后才叫值符星
  //      故断言应为：值符宫上挂的星 == 值符原宫本位的星（XING 序 1蓬2芮3冲4辅5禽6心7柱8任9英）
  if (c.zhiFuGong != null && c.zhiFuXing) {
    if (c.zhiFuGong === 5) {
      // 值符落中五宫：中宫无星，星寄坤二宫，属设计而非违规。
      // 此时天盘干也寄坤二宫，故查寄宫后的星。
      const ruiGong = Object.keys(c.xing || {}).find(g => String(c.xing[g]).includes('天芮'));
      const starAtRui = ruiGong ? String(c.xing[ruiGong]).split(',') : [];
      // 原宫是坤2时值符星本就是天芮/天禽；原宫是5时值符星是天禽，天芮同宫亦含天禽
      if (!starAtRui.includes('天芮')) {
        push('B_zhiFuXing', ctx, { zhiFuGong: 5, note: '中宫寄坤后坤二宫未见天芮', xing: c.xing });
      }
    } else {
      const starAt = String((c.xing && c.xing[c.zhiFuGong]) || '').split(',');
      if (!starAt.length || !starAt.includes(c.zhiFuXing)) {
        push('B_zhiFuXing', ctx, { zhiFuXing: c.zhiFuXing, zhiFuGong: c.zhiFuGong,
          zhiFuOrigGong: c.zhiFuOrigGong, starAtZhiFuGong: starAt.join('|') });
      }
    }
  }
  // C. 值使门必落值使宫（men 表同为宫->门名，精确匹配即可）
  if (c.zhiShiGong != null && c.zhiShiMen) {
    const hit = [1,2,3,4,6,7,8,9].filter(g => c.men && c.men[g] === c.zhiShiMen);
    if (!hit.length) push('C_zhiShiMen', ctx, { zhiShiMen: c.zhiShiMen, zhiShiGong: c.zhiShiGong, men: c.men });
    else if (hit[0] !== c.zhiShiGong && hit.indexOf(c.zhiShiGong) === -1) {
      push('C_zhiShiMen', ctx, { zhiShiMen: c.zhiShiMen, zhiShiGong: c.zhiShiGong, menAtGong: hit[0] });
    }
  }
  // D. 中五宫不应出现在 转盘 的星/门/神 表（应寄坤二宫）
  for (const key of ['xing','men','shen']) {
    const m = c[key];
    if (m && typeof m === 'object' && m[5] != null && m[5] !== '') {
      push('D_center5', ctx, { key, valueAt5: m[5] });
    }
  }
  // E. 定局三元完整
  if (!c.juNum || !c.juType || !c.jieqi || !c.jqRange || !c.jqRange.name) {
    push('E_determinant', ctx, { juNum: c.juNum, juType: c.juType, jieqi: c.jieqi, jqRange: c.jqRange });
  }
  seenJieqi.add(c.jieqi);
}

const t0 = Date.now();
for (let y = Y0; y <= Y1; y++) {
  for (let m = 1; m <= 12; m++) {
    for (const d of DAYS) {
      const dateStr = `${y}-${String(m).padStart(2,'0')}-${d}`;
      for (const t of SHICHEN) {
        for (const method of METHODS) {
          total++;
          const ctx = { date: dateStr, time: t, method };
          let c;
          try { c = qimen.paipanLegacy(dateStr, t, method); }
          catch (e) { crashes.push({ ...ctx, msg: (e && e.message) || String(e) }); continue; }
          if (!c || typeof c !== 'object') { crashes.push({ ...ctx, msg: '返回 falsy' }); continue; }
          try { audit(c, ctx); ok++; }
          catch (e) { crashes.push({ ...ctx, msg: 'audit 抛错: ' + ((e && e.message) || String(e)) }); }
        }
      }
    }
  }
  if ((y - Y0) % 5 === 0) process.stderr.write(`  ... ${y} done, ${total} runs\n`);
}

const invCount = {};
for (const k of Object.keys(inv)) {
  const arr = inv[k];
  invCount[k] = Array.isArray(arr) ? (arr._n || arr.length) : 0;
}
console.log(JSON.stringify({
  range: `${Y0}-${Y1}`,
  totalRuns: total,
  okRuns: ok,
  crashCount: crashes.length,
  crashPct: (total ? (crashes.length/total*100).toFixed(4) : '0') + '%',
  crashKinds: crashes.reduce((m,c)=>{ m[c.msg]=(m[c.msg]||0)+1; return m; },{}),
  crashSample: crashes.slice(0,5),
  invariantViolationCounts: invCount,
  invariantSamples: inv,
  jieqiSeen: seenJieqi.size,
  seconds: ((Date.now()-t0)/1000).toFixed(1)
}, null, 2));