// verify/audit-anGan.js
// 暗干(anGan) 引擎预计算的可复现审计脚本。
// 定义性质：anGan[值使门落宫] === 起始干（时干；六甲时用遁干 dunGan）。
// 同时校验：九宫填满、九干互异、且均属三奇六仪。
// 运行：node verify/audit-anGan.js   （需先 npm install 安装 lunar-javascript）
const E = require('../src/index.js');

const LIUYI = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];

// 覆盖四季、阴阳遁、昼/夜、及六甲时（时干=甲，需走遁干分支）
const CASES = [
  [2026, 10, 17, 11, 0], [2026, 10, 17, 23, 30],
  [2026, 1, 15, 9, 0], [2026, 1, 15, 0, 30],
  [2026, 6, 21, 15, 0], [2026, 6, 21, 0, 30],
  [2026, 3, 3, 12, 0], [2026, 3, 3, 0, 30],
  [2026, 10, 19, 0, 30], [2026, 10, 19, 11, 0],
  [2026, 5, 5, 7, 0], [2026, 5, 5, 23, 30],
  [2026, 8, 8, 13, 0], [2026, 8, 8, 0, 30],
  [2026, 12, 12, 10, 0], [2026, 12, 12, 0, 30],
  [2026, 2, 2, 14, 0], [2026, 2, 2, 0, 30],
  [2026, 7, 7, 16, 0], [2026, 7, 7, 0, 30],
];

let fail = 0, jia = 0;
for (const [y, m, d, h, mi] of CASES) {
  const c = E.paipan(y, m, d, h, mi, 'chaibu');
  const sg = c.hgz[0];
  const zs = c.zhiShiGong;
  const ag = c.anGan;
  const expect = (sg === '甲') ? c.dunGan : sg;

  // 定义性质
  if (ag[zs] !== expect) {
    console.log('FAIL def', y, m, d, h, mi, 'zs=', zs, 'ag[zs]=', ag[zs], 'expect=', expect);
    fail++;
  }
  if (sg === '甲') jia++;

  // 九宫填满且均为三奇六仪
  for (let g = 1; g <= 9; g++) {
    if (!ag[g] || LIUYI.indexOf(ag[g]) < 0) {
      console.log('FAIL fill', y, m, d, h, mi, 'g=', g, 'val=', ag[g]);
      fail++;
      break;
    }
  }
  // 九干互异
  const vals = Object.values(ag);
  if (new Set(vals).size !== 9) {
    console.log('FAIL unique', y, m, d, h, mi, vals);
    fail++;
  }
}

// 样例（与生产线对照：阴遁6·甲子·庚午时）
const s = E.paipan(2026, 10, 17, 11, 0, 'chaibu');
console.log('SAMPLE 2026-10-17 11:00:', s.juType, s.juNum, '局', s.xun,
  '时干=', s.hgz[0], '值使落宫=', s.zhiShiGong, '遁干=', s.dunGan);
console.log('  anGan =', JSON.stringify(s.anGan));
console.log('cases =', CASES.length, 'jia-time =', jia, 'failures =', fail,
  fail === 0 ? 'AUDIT PASS' : 'AUDIT FAIL');
process.exit(fail === 0 ? 0 : 1);
