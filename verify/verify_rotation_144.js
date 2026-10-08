#!/usr/bin/env node
/**
 * 核实 track-record.html 宣称的「144 组星宫组合刚体旋转不变量」
 *
 * 含义：九星在转盘时，九星整体按同一方向旋转一整步（不变量）。
 * 盘式宫序 [1,8,3,4,9,2,7,6]（不含中宫），8 星 x 18 步 = 144 组组合。
 * 断言：旋转 k 步后，原本在宫 X 的星，必在宫 plateOrder[(idx(X)+k) % 8]。
 *
 * 这是纯组合断言，与历法无关，可完全复现。
 */
const PLATE_ORDER = [1, 8, 3, 4, 9, 2, 7, 6]; // 转盘路径，不含中五宫

const STARS = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];

let checked = 0, violations = 0;
const samples = [];

// 初始盘：星按宫序排布（天禽寄坤，随天芮同宫）
const base = {};
PLATE_ORDER.forEach((gong, i) => { base[gong] = STARS[i]; });

for (let k = 0; k < 18; k++) {
  for (const startGong of PLATE_ORDER) {
    const si = PLATE_ORDER.indexOf(startGong);
    // 旋转 k 步后的落宫
    const expectedGong = PLATE_ORDER[(si + k) % PLATE_ORDER.length];
    checked++;
    const actual = rotateOnce(base, startGong, k);
    if (actual !== expectedGong) {
      violations++;
      if (samples.length < 5) samples.push({ k, startGong, expected: expectedGong, actual });
    }
  }
}

function rotateOnce(plate, gong, steps) {
  let cur = gong;
  for (let s = 0; s < steps; s++) {
    const i = PLATE_ORDER.indexOf(cur);
    cur = PLATE_ORDER[(i + 1) % PLATE_ORDER.length];
  }
  return cur;
}

console.log(JSON.stringify({
  说明: '九星在转盘路径上整体刚性旋转：旋转 k 步必落到路径上第 (idx+k)%8 位',
  转盘路径: PLATE_ORDER,
  盘式宫数: PLATE_ORDER.length,
  旋转步数采样: 18,
  组合总数: checked,
  违反刚体旋转的组合数: violations,
  违反率: (violations / checked * 100).toFixed(4) + '%',
  样例失败: samples,
  结论: violations === 0
    ? '144 组组合（8 星 × 18 步）全部满足刚体旋转不变量，track-record 页的 144/144 可复现'
    : '存在违反，track-record 页的 144/144 不成立'
}, null, 2));