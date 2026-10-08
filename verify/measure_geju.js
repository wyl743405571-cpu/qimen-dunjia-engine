// 格局引擎覆盖率与命中率实测
// 回答三个问题：
//   1. 一盘平均命中多少条格局？会不会出现"零命中"（说明判定挂空转）？
//   2. 同一格局在不同盘里命中率是否正常（会不会像恒真断言那样 100%）？
//   3. 有多少条格局规则在全时段里从不命中（可能写错的死规则）？
// 用法: node measure_geju.js [年份数]
const ENGINE = process.env.ENGINE_PATH || require('path').join(__dirname, '..', 'src', 'index.js');
const qimen = require(ENGINE);

const Y0 = 2000;
const NY = parseInt(process.argv[2] || '30', 10);
const SHICHEN = ['00:00','02:00','04:00','06:00','08:00','10:00',
                 '12:00','14:00','16:00','18:00','20:00','22:00'];
const DAYS = ['01','15','28'];
const METHODS = ['chaibu','zhirun'];

const hitCount = {};      // 格局名 -> 命中盘数
const levelCount = {};    // 等级 -> 次数
const gongScope = {};     // 格局名 -> '全局' | '落宫'
const perChart = [];      // 每盘命中条数
let total = 0, zeroCharts = 0, errored = 0;
const samples = [];

for (let y = Y0; y < Y0 + NY; y++) {
  for (let m = 1; m <= 12; m++) {
    for (const d of DAYS) {
      const ds = `${y}-${String(m).padStart(2,'0')}-${d}`;
      for (const t of SHICHEN) {
        for (const method of METHODS) {
          total++;
          let c;
          try { c = qimen.paipanLegacy(ds, t, method); }
          catch(e){ errored++; continue; }
          const gs = (c && c.geju) || [];
          if (!Array.isArray(gs)) { errored++; continue; }
          if (gs.length === 0) zeroCharts++;
          perChart.push(gs.length);
          for (const g of gs) {
            hitCount[g.name] = (hitCount[g.name]||0)+1;
            levelCount[g.level] = (levelCount[g.level]||0)+1;
            // 伏吟局/白虎猖狂这类是全局格局，本就不落单宫，引擎不给 gong
            gongScope[g.name] = g.gong == null ? '全局' : '落宫';
          }
          if (samples.length < 6 && gs.length > 0) {
            samples.push({
              moment: ds+' '+t+' '+method,
              //全局格局（如伏吟局、白虎猖狂）本就不落单宫，引擎不给 gong 字段
              hits: gs.slice(0,4).map(x => x.gong == null
                ? `${x.name}(${x.level})` : `${x.name}(${x.level})@${x.gong}宫`)
            });
          }
        }
      }
    }
  }
}

const names = Object.keys(hitCount).sort((a,b)=>hitCount[b]-hitCount[a]);
const avg = perChart.length ? (perChart.reduce((a,b)=>a+b,0)/perChart.length).toFixed(2) : 0;
const max = perChart.length ? Math.max(...perChart) : 0;

// 恒真断言筛查：命中率 > 95% 的格局很可疑
const suspicious = names.filter(n => hitCount[n]/total > 0.95);
const dead = names.filter(n => hitCount[n] === 0);

console.log(JSON.stringify({
  range: `${Y0}-${Y0+NY-1}`,
  totalCharts: total,
  erroredCharts: errored,
  零命中盘占比: (zeroCharts/total*100).toFixed(1) + '%',
  每盘平均命中格局数: avg,
  单盘最多命中: max,
  不同格局总数: names.length,
  全局格局数: Object.values(gongScope).filter(v => v === '全局').length,
  落宫格局数: Object.values(gongScope).filter(v => v === '落宫').length,
  各格局命中盘数: hitCount,
  吉凶等级分布: levelCount,
  可疑恒真格局_命中率超95pct: suspicious,
  从不命中格局: dead,
  samples
}, null, 2));