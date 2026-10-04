/**
 * Basic demo — cast a chart and print a nine-palace grid.
 * Run: node examples/basic.js
 */
const qimen = require('../src/index.js');

const chart = qimen.paipan(2026, 6, 7, 11, 0, 'zhirun');

console.log('Qimen Dunjia chart — 2026-06-07 11:00 (zhirun)');
console.log('Ju: ' + (chart.isYang ? 'Yang' : 'Yin') + ' Dun ' + chart.juNum +
            '  [' + (chart.jieqi || '') + ' ' + (chart.zhirunYuan || '') +
            ', seg start ' + (chart.zhirunSegStart || '-') + ']');
console.log('Four pillars: ' + chart.ygz + ' ' + chart.mgz + ' ' + chart.dgz + ' ' + chart.hgz);
console.log('Zhi-Fu: ' + chart.zhiFuXing + '@' + chart.zhiFuGong +
            '  Zhi-Shi: ' + chart.zhiShiMen + '@' + chart.zhiShiGong);
console.log('Void: ' + chart.kong.join('/') + '  Horse: palace ' + chart.maGong);
console.log('');

// Nine-palace grid: palaces laid out as
//   4 9 2
//   3 5 7
//   8 1 6
const rows = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
for (const row of rows) {
  const cells = row.map(p => {
    const star = (chart.xing[p] || '').split(',')[0];
    const men = chart.men[p] || '—';
    const tp = chart.tp[p] || '';
    const dp = chart.dp[p] || '';
    const shen = chart.shen[p] || '';
    return `P${p} ${shen} ${star} ${men} ${tp}/${dp}`;
  });
  console.log(cells.join('  |  '));
}

console.log('');
console.log('Formations detected:');
for (const g of chart.geju || []) {
  console.log('  [' + g.level + '] ' + g.name +
              (g.gong != null ? ' @palace ' + g.gong : ' (global)'));
}
