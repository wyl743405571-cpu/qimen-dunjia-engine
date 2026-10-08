// 悖格可达性验证：扩大采样，确认它罕见但非死规则
const ENGINE = process.env.ENGINE_PATH || require('path').join(__dirname, '..', 'src', 'index.js');
const q = require(ENGINE);
const DAYS = ['01','15','28'];
const SHICHEN = ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'];
const METHODS = ['chaibu','zhirun'];
let tot = 0, tgHit = 0, hit = 0;
const found = [];
for (let y = 2000; y < 2030; y++) {
  for (let m = 1; m <= 12; m++) {
    for (const d of DAYS) {
      const ds = `${y}-${String(m).padStart(2,'0')}-${d}`;
      for (const t of SHICHEN) {
        for (const method of METHODS) {
          const c = q.paipanLegacy(ds, t, method);
          tot++;
          const z = c.zhiFuGong;
          const cond = (c.tp[z] === '丙' && c.dp[z] === '戊');
          const out = (c.geju || []).some(g => g.name === '悖格');
          if (cond) tgHit++;
          if (out) hit++;
          if (cond && out && found.length < 5) {
            found.push(`${ds} ${t} ${method} 值符宫${z}宫 天盘${c.tp[z]}/地盘${c.dp[z]}`);
          }
        }
      }
    }
  }
}
console.log('样本盘:', tot);
console.log('理论条件成立:', tgHit, '=', (tgHit/tot*100).toFixed(3)+'%');
console.log('引擎输出:', hit, '=', (hit/tot*100).toFixed(3)+'%');
console.log('两者一致:', tgHit === hit ? '是' : '否');
console.log('样例:');
found.forEach(f => console.log('  ' + f));