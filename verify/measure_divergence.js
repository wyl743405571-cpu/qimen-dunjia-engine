// 口径分歧率实测：同一时刻，换一种定局法，看局数/值符值使/宫位差在哪
// 目的不是"证明我们最准"，而是量化"分歧确实存在"——用于对外如实披露
// 用法: node measure_divergence.js [年份数]
const ENGINE = process.env.ENGINE_PATH || require('path').join(__dirname, '..', 'src', 'index.js');
const qimen = require(ENGINE);

const Y0 = 2000;
const NY = parseInt(process.argv[2] || '30', 10);   // 默认 30 年
const SHICHEN = ['00:00','02:00','04:00','06:00','08:00','10:00',
                 '12:00','14:00','16:00','18:00','20:00','22:00'];
const DAYS = ['01','15','28'];
const METHODS = ['chaibu','zhirun'];
const GONGS = [1,2,3,4,6,7,8,9];

const stat = {
  juNumDiff: 0, zhiFuGongDiff: 0, zhiShiGongDiff: 0,
  anyGongDiff: 0, identical: 0, total: 0,
  gongDiffCountHist: {},
  examples: []
};

function safe(d,t,m) { try { return qimen.paipanLegacy(d,t,m); } catch(e){ return null; } }

for (let y = Y0; y < Y0+NY; y++) {
  for (let m = 1; m <= 12; m++) {
    for (const d of DAYS) {
      const ds = `${y}-${String(m).padStart(2,'0')}-${d}`;
      for (const t of SHICHEN) {
        const a = safe(ds,t,'chaibu'), b = safe(ds,t,'zhirun');
        if (!a || !b) continue;
        stat.total++;
        const juDiff = a.juNum !== b.juNum;
        const zfDiff = a.zhiFuGong !== b.zhiFuGong;
        const zsDiff = a.zhiShiGong !== b.zhiShiGong;
        let gongDiff = 0;
        for (const g of GONGS) {
          if ((a.tp[g]||'')!==(b.tp[g]||'') || (a.dp[g]||'')!==(b.dp[g]||'')
           || (a.men[g]||'')!==(b.men[g]||'') || (a.xing[g]||'')!==(b.xing[g]||'')) gongDiff++;
        }
        if (juDiff) stat.juNumDiff++;
        if (zfDiff) stat.zhiFuGongDiff++;
        if (zsDiff) stat.zhiShiGongDiff++;
        if (gongDiff > 0) stat.anyGongDiff++; else stat.identical++;
        stat.gongDiffCountHist[gongDiff] = (stat.gongDiffCountHist[gongDiff]||0)+1;
        if (stat.examples.length < 8 && gongDiff > 0) {
          stat.examples.push({
            datetime: ds+' '+t,
            chaibu: { ju: a.juType+a.juNum+'局', zhiFu: a.zhiFuXing+'落'+a.zhiFuGong+'宫', zhiShi: a.zhiShiMen+'落'+a.zhiShiGong+'宫' },
            zhirun: { ju: b.juType+b.juNum+'局', zhiFu: b.zhiFuXing+'落'+b.zhiFuGong+'宫', zhiShi: b.zhiShiMen+'落'+b.zhiShiGong+'宫' },
            gongDiff
          });
        }
      }
    }
  }
}

const pct = n => stat.total ? (n/stat.total*100).toFixed(1)+'%' : 'n/a';
console.log(JSON.stringify({
  range: `${Y0}-${Y0+NY-1}`,
  sampledDatetimes: stat.total,
  method: '拆补法(chaibu) vs 置闰法(zhirun)',
  局数不同: { count: stat.juNumDiff, pct: pct(stat.juNumDiff) },
  值符宫不同: { count: stat.zhiFuGongDiff, pct: pct(stat.zhiFuGongDiff) },
  值使宫不同: { count: stat.zhiShiGongDiff, pct: pct(stat.zhiShiGongDiff) },
  九宫有任一差异: { count: stat.anyGongDiff, pct: pct(stat.anyGongDiff) },
  完全相同: { count: stat.identical, pct: pct(stat.identical) },
  差异宫数分布: stat.gongDiffCountHist,
  examples: stat.examples
}, null, 2));