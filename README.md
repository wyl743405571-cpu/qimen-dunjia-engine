# qimen-dunjia-engine

**Qimen Dunjia (奇门遁甲) chart calculation engine for Node.js** — deterministic, no AI/LLM dependency, pure calculation.

> 时家转盘法 · 置闰符头定元 · 值使独立转门 · 61 个书载案例逐宫对拍通过

## Why this engine

Most open-source Qimen libraries cut corners. This one implements the classical mainstream ruleset faithfully:

| Rule | Common shortcut in other libraries | This engine |
|---|---|---|
| **Zhirun (置闰) ju determination** | ~5-day bucket approximation | **Futou-based**: solar-term attribution decided by the futou day (上元符头 = 甲子/甲午/己卯/己酉) |
| **Zhi-Shi door (值使门)** | Falls into the same palace as Zhi-Fu star (skipped rotation) | **Rotates independently** from the hour-stem position in the xun |
| **Rotating plate paths** | Linear palace order 1-9 | Plate palace order **[1,8,3,4,9,2,7,6]** |
| **Validation** | Spot checks at best | **61 classical case charts reproduced palace-by-palace** |

## Features

- Hour-based rotating-plate method (时家转盘), both **Chabu (拆补)** and **Zhirun (置闰)** determination
- Full plate: earth plate (地盘), heaven plate (天盘), 9 stars (九星), 8 doors (八门), 8 gods (八神), hidden stems (遁干)
- **Formation detection (格局)**: Fu-Yin (伏吟), Fan-Yin (反吟), 门迫, 击刑, 入墓, 青龙返首, 飞鸟跌穴, 玉女守门, 三奇得使, 十干克应 combinations, and more
- Horse palace (马星), void branches (旬空), year/month stems lodging
- Four-pillar (干支) calculation for year/month/day/hour via [lunar-javascript](https://github.com/6tail/lunar-javascript)
- Zero network, zero AI — same numbers every run

## Install

```bash
npm install qimen-dunjia-engine
```

(or `git clone` + `npm install` if the npm package is not yet published)

## Usage

```js
const qimen = require('qimen-dunjia-engine');

// year, month, day, hour, minute, method: 'zhirun' | 'chaibu'
const chart = qimen.paipan(2026, 6, 7, 11, 0, 'zhirun');

console.log(chart.juNum);        // 6  (Yang Dun 6)
console.log(chart.isYang);       // true
console.log(chart.zhiFuXing);    // 天蓬 — Zhi-Fu star
console.log(chart.zhiFuGong);    // 4
console.log(chart.zhiShiMen);    // 休门 — Zhi-Shi door (independently rotated)
console.log(chart.zhiShiGong);   // 3
console.log(chart.dp);           // earth plate stems, keyed by palace 1-9
console.log(chart.tp);           // heaven plate stems
console.log(chart.xing);         // 9 stars by palace
console.log(chart.men);          // 8 doors by palace
console.log(chart.shen);         // 8 gods by palace
console.log(chart.geju);         // detected formations [{name, level, gong, detail}]
console.log(chart.maGong);       // horse palace
console.log(chart.kong);         // void branches, e.g. ['寅','卯']
console.log(chart.ygz);          // four pillars: year/month/day/hour ganzhi
```

See [`examples/basic.js`](examples/basic.js) for a runnable demo that prints a full nine-palace grid.

## Output reference

| Field | Meaning |
|---|---|
| `juNum` / `isYang` | Ju number (1–9) and Yin/Yang dun |
| `method` | `zhirun` or `chaibu` |
| `xun` / `kong` / `kongGongs` | Hour xun, void branches, void palaces |
| `zhiFuXing` / `zhiFuGong` | Zhi-Fu star and its palace |
| `zhiShiMen` / `zhiShiGong` | Zhi-Shi door and its palace |
| `dp` / `tp` | Earth / heaven plate stems by palace |
| `xing` / `men` / `shen` | Stars / doors / gods by palace |
| `dunGan` | Hidden stems (遁干) |
| `geju` | Detected formations with auspicious/inauspicious level |
| `maGong` | Horse palace (驿马) |
| `ygz` / `mgz` / `dgz` / `hgz` | Year / month / day / hour pillars |

## Scope

**This package computes charts only.** Interpretation, judgment rules (用神/断法), and case libraries are *not* included — those are product-layer assets of [QiMenSeek](https://qimen-static.aicreditsapi.com/calculator.html).

The engine is流派-aware in one dimension: it implements the mainstream **hour-based rotating-plate** tradition (时家转盘). It does not compute flying-plate (飞盘) charts.

## Test

```bash
npm test
```

Three known-good snapshot charts (fact data) plus plate-structure invariants.

## Live tools

- Free online calculator: **https://qimen-static.aicreditsapi.com/calculator.html**
- Today's chart + daily verse: **https://qimen-static.aicreditsapi.com/daily.html**
- Published charting ruleset (口径公开): **https://qimen-static.aicreditsapi.com/ruleset.html**

## License

MIT
