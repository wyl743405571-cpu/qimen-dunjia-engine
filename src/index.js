/**
 * qimen-dunjia-engine — Qimen Dunjia (奇门遁甲) chart calculation engine for Node.js
 *
 * Hour-based rotating-plate method (时家转盘). Supports both Chabu (拆补)
 * and Zhirun (置闰) ju determination.
 *
 * Key design points:
 *   1. Zhirun strictly follows the futou day (上元符头: 甲子/甲午/己卯/己酉)
 *      to attribute the solar term — no 5-day bucket approximation.
 *   2. Zhi-Shi door (值使门) rotates independently from Zhi-Fu star.
 *   3. Rotating plate paths use plate palace order [1,8,3,4,9,2,7,6],
 *      not linear order.
 *   4. Tian-Qin (天禽) is lodged in Kun palace 2, travelling with Tian-Rui.
 *
 * Validation: reproduced 61 classical case charts palace-by-palace, plus
 * cross-checked against multiple public charting references.
 */

const { Lunar, Solar } = require('lunar-javascript');

// ========== 常量 ==========
const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const LIUYI = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
const XING = {1:'天蓬',2:'天芮',3:'天冲',4:'天辅',5:'天禽',6:'天心',7:'天柱',8:'天任',9:'天英'};
const MEN = {1:'休门',2:'死门',3:'伤门',4:'杜门',6:'开门',7:'惊门',8:'生门',9:'景门'};
const SHEN = ['值符','螣蛇','太阴','六合','白虎','玄武','九地','九天'];
const GUA = {1:'坎',2:'坤',3:'震',4:'巽',5:'中',6:'乾',7:'兑',8:'艮',9:'离'};
const GUAWX = {1:'水',2:'土',3:'木',4:'木',5:'土',6:'金',7:'金',8:'土',9:'火'};
const DIR = {1:'北',2:'西南',3:'东',4:'东南',5:'中',6:'西北',7:'西',8:'东北',9:'南'};
const DIREN = {1:'N',2:'SW',3:'E',4:'SE',5:'C',6:'NW',7:'W',8:'NE',9:'S'};

// 转盘法：后天八卦宫序（阳遁顺排方向）
// 坎1→艮8→震3→巽4→离9→坤2→兑7→乾6
const ZHUA_GONG_ORDER = [1, 8, 3, 4, 9, 2, 7, 6];

// 八门转盘序列：休→生→伤→杜→景→死→惊→开
const MEN_SEQUENCE = ['休门','生门','伤门','杜门','景门','死门','惊门','开门'];

// 九星顺序（原始分布对应的星名）
const XING_SEQUENCE = ['天蓬','天芮','天冲','天辅','天禽','天心','天柱','天任','天英'];

const JQTBL = [
  [1,5,'小寒'],[1,20,'大寒'],[2,4,'立春'],[2,19,'雨水'],[3,5,'惊蛰'],[3,20,'春分'],
  [4,5,'清明'],[4,20,'谷雨'],[5,5,'立夏'],[5,21,'小满'],[6,5,'芒种'],[6,21,'夏至'],
  [7,7,'小暑'],[7,22,'大暑'],[8,7,'立秋'],[8,23,'处暑'],[9,7,'白露'],[9,23,'秋分'],
  [10,8,'寒露'],[10,23,'霜降'],[11,7,'立冬'],[11,22,'小雪'],[12,7,'大雪'],[12,22,'冬至']
];
const JQJU = {
  '冬至':[1,7,4],'小寒':[2,8,5],'大寒':[3,9,6],
  '立春':[8,5,2],'雨水':[9,6,3],'惊蛰':[1,7,4],
  '春分':[3,9,6],'清明':[4,1,7],'谷雨':[5,2,8],
  '立夏':[4,1,7],'小满':[5,2,8],'芒种':[6,3,9],
  '夏至':[9,3,6],'小暑':[8,2,5],'大暑':[7,1,4],
  '立秋':[2,5,8],'处暑':[1,4,7],'白露':[9,3,6],
  '秋分':[7,1,4],'寒露':[6,9,3],'霜降':[5,8,2],
  '立冬':[6,9,3],'小雪':[5,8,2],'大雪':[4,7,1]
};
const YANGJQ = ['冬至','小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种'];
const JQ_SEQ = JQTBL.map(function (r) { return r[2]; });
const XXUN = ['甲子','甲戌','甲申','甲午','甲辰','甲寅'];
const XKONG = [['戌','亥'],['申','酉'],['午','未'],['辰','巳'],['寅','卯'],['子','丑']];
const SHICHEN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const XDUN = {'甲子':'戊','甲戌':'己','甲申':'庚','甲午':'辛','甲辰':'壬','甲寅':'癸'};

// ========== 工具函数 ==========

/** 获取时辰索引（0=子时, 1=丑, ... 11=亥） */
function getShiChenIndex(h, m) {
  if (h >= 23 || h < 1) return 0;
  if (h >= 1 && h < 3) return 1;
  if (h >= 3 && h < 5) return 2;
  if (h >= 5 && h < 7) return 3;
  if (h >= 7 && h < 9) return 4;
  if (h >= 9 && h < 11) return 5;
  if (h >= 11 && h < 13) return 6;
  if (h >= 13 && h < 15) return 7;
  if (h >= 15 && h < 17) return 8;
  if (h >= 17 && h < 19) return 9;
  if (h >= 19 && h < 21) return 10;
  return 11;
}
function shiChenToDZ(h, m) { return DZ[getShiChenIndex(h, m)]; }

/** 地支转九宫 */
function z2G(z) {
  return {'子':1,'丑':8,'寅':8,'卯':3,'辰':4,'巳':4,'午':9,'未':2,'申':6,'酉':7,'戌':6,'亥':6}[z] || 5;
}

/** 获取马星 */
function getMa(z) {
  return {'子':'寅','丑':'亥','寅':'申','卯':'巳','辰':'寅','巳':'亥','午':'申','未':'巳','申':'寅','酉':'亥','戌':'申','亥':'巳'}[z] || '';
}

/** 局数计算辅助：三元划分（按"交节后天数"；现仅作置闰法范围外的降级兜底） */
function getJuNum(jq, daysInJq) {
  var arr = JQJU[jq] || [1];
  if (daysInJq <= 5) return arr[0];
  if (daysInJq <= 10) return arr[1];
  return arr[2];
}

/**
 * 拆补法定元·符头法（v6.24 修正）
 *  甲/己日为符头，每 5 日一元；以符头地支定元：
 *    子午卯酉=上元(0)、寅申巳亥=中元(1)、辰戌丑未=下元(2)
 *  六十甲子序号每 5 个为一块 → 元 = floor(序/5) % 3
 *  校验：甲子(0)→上元、己巳(5)→中元、甲戌(10)→下元、己卯(15)→上元 … 甲辰(40)→下元
 */
function fuTouYuan(dgz) {
  return Math.floor(gXun(dgz) / 5) % 3;
}

/** 六十甲子索引 */
function gXun(gz) {
  var gi = TG.indexOf(gz[0]), zi = DZ.indexOf(gz[1]);
  for (var n = 0; n < 60; n++) if (n % 10 === gi && n % 12 === zi) return n;
  return 0;
}

/**
 * 精确交节时刻查询（v6.25 修正）
 *   原 jqDate 按"日"粒度判定节气 —— Lunar.getJieQi() 只回答"今天是否交节"，
 *   导致交节当天从 00:00 起就被算成新节气：交节时刻之前的排盘会查错局数表。
 *   实测 bug：秋分 2026-09-23 08:05:14 交节，09-23 03:00 排盘被算作「秋分·阴遁1」，
 *   实际应为「白露·阴遁3」（JQJU 白露=[9,3,6] ≠ 秋分=[7,1,4]）。
 *   本函数改用 getPrevJieQi() 按"时刻"判定，精确到分。
 */
function jqAtExact(year, month, day, hour, minute) {
  try {
    var cur = Solar.fromYmdHms(year, month, day, hour || 0, minute || 0, 0);
    var lunar = cur.getLunar();
    var prev = lunar.getPrevJieQi(), next = lunar.getNextJieQi();
    if (!prev || !next) return null;
    var pn = prev.getName();
    if (!JQJU[pn]) return null;
    var ps = prev.getSolar(), ns = next.getSolar();
    return {
      name: pn,
      startTime: ps.toYmdHms().slice(0, 16),
      nextName: next.getName(),
      nextTime: ns.toYmdHms().slice(0, 16),
      totalJqDays: ns.getJulianDay() - ps.getJulianDay(),
      daysInJq: (cur.getJulianDay() - ps.getJulianDay()) + 1
    };
  } catch (e) { return null; }
}

/** 节气查询（回溯最多15天），返回当前节气 + 到下一个节气的天数 */
function jqDate(year, month, day, hour, minute) {
  // v6.25：给了时刻就走精确路径（交节当天按时刻判定节气）
  if (hour !== undefined && hour !== null && hour !== '') {
    var ex = jqAtExact(year, month, day, hour, minute || 0);
    if (ex) return { name: ex.name, daysInJq: ex.daysInJq, totalJqDays: ex.totalJqDays,
                     startTime: ex.startTime, nextName: ex.nextName, nextTime: ex.nextTime };
  }
  for (var i = 0; i <= 15; i++) {
    var dd = new Date(year, month - 1, day - i); dd.setHours(12, 0, 0, 0);
    try {
      var lunar = Lunar.fromDate(dd);
      var j = lunar.getJieQi();
      if (j) {
        var jqStart = new Date(dd);
        for (var k = 1; k <= 15; k++) {
          var prev = new Date(year, month - 1, day - i - k); prev.setHours(12, 0, 0, 0);
          if (Lunar.fromDate(prev).getJieQi() !== j) break;
          jqStart = prev;
        }
        var queryDate = new Date(year, month - 1, day); queryDate.setHours(12, 0, 0, 0);
        var daysDiff = Math.floor((queryDate.getTime() - jqStart.getTime()) / 86400000) + 1;
        
        var nextJqStart = new Date(jqStart);
        var totalDays = 15;
        for (var s = 16; s <= 30; s++) {
          var next = new Date(jqStart.getTime() + s * 86400000); next.setHours(12, 0, 0, 0);
          try {
            var nextJq = Lunar.fromDate(next).getJieQi();
            if (nextJq && nextJq !== j) {
              totalDays = s;
              break;
            }
          } catch(e) { /* continue */ }
        }
        
        return { name: j, daysInJq: daysDiff, totalJqDays: totalDays };
      }
    } catch (e) { /* continue */ }
  }
  return { name: '', daysInJq: 0, totalJqDays: 15 };
}
function jq(dt) { return jqDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }

// ========== 四柱计算 ==========

/** 年柱：使用实际日期查询农历年（v3修复：不再硬编码Feb 1） */
function yGZ(y, m, d) {
  try {
    var solar = Solar.fromYmd(y, m || 6, d || 15);
    return solar.getLunar().getYearInGanZhi();
  } catch (e) {
    // 备用公式：以立春为界（2月4日前后）
    if (m < 2 || (m === 2 && d < 4)) {
      return TG[(y - 5) % 10] + DZ[(y - 5) % 12];
    }
    return TG[(y - 4) % 10] + DZ[(y - 4) % 12];
  }
}

function mGZDate(year, month, day) {
  try {
    var solar = Solar.fromYmd(year, month, day);
    return solar.getLunar().getMonthInGanZhi();
  } catch (e) { return '??'; }
}
function mGZ(dt) { return mGZDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }

function dGZDate(year, month, day) {
  try {
    var solar = Solar.fromYmd(year, month, day);
    return solar.getLunar().getDayInGanZhi();
  } catch (e) { return '??'; }
}
function dGZ(dt) { return dGZDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }

function hGZ(dgz, ts) {
  var h = parseInt(ts.split(':')[0]);
  var dgi = TG.indexOf(dgz[0]);
  var si = getShiChenIndex(h, 0);
  return TG[(dgi * 2 + si) % 10] + DZ[si];
}

// ========== 排盘核心 (标准转盘法 v3) ==========

/**
 * 定局（支持拆补法/置闰法）
 */
// ========== 严格置闰法 v2（2026-09-25）：局随符头 + 超神置闰 ==========
// 规则：每个上元符头日（甲/己+子午卯酉）启动一个节气三元局段（15天）；
// 下一节气交节日比新符头早 >=9 天（超神累积满9天）时置闰——重复当前节气一段。
// 锚点：2022-12-22 己酉日冬至（正授）。与 2025-12-21 甲子日冬至锚点交叉验证收敛。
var _jqDayMap = null, _zhirunSegs = null;
var ZHIRUN_END = new Date(2032, 11, 31, 12, 0, 0, 0);

function buildJieqiDayMap() {
  if (_jqDayMap) return _jqDayMap;
  _jqDayMap = {};
  for (var y = 2022; y <= 2032; y++) {
    for (var m = 1; m <= 12; m++) {
      var dmax = ([1,3,5,7,8,10,12].indexOf(m) >= 0) ? 31 : (m === 2 ? 29 : 30);
      for (var d = 1; d <= dmax; d++) {
        try {
          var j = Solar.fromYmd(y, m, d).getLunar().getJieQi();
          if (j && JQTBL.some(function(r){ return r[2] === j; })) _jqDayMap[y + '-' + m + '-' + d] = j;
        } catch (e) {}
      }
    }
  }
  return _jqDayMap;
}

function zhirunSegments() {
  if (_zhirunSegs) return _zhirunSegs;
  var map = buildJieqiDayMap();
  var jqList = Object.keys(map).map(function (k) {
    var p = k.split('-');
    return { name: map[k], t: new Date(+p[0], +p[1] - 1, +p[2], 12) };
  }).sort(function (a, b) { return a.t - b.t; });
  function jiaRiOf(name, fromT) {
    for (var i = 0; i < jqList.length; i++) {
      if (jqList[i].name === name && jqList[i].t.getTime() >= fromT.getTime() - 3 * 86400000) return jqList[i].t;
    }
    return null;
  }
  var segs = [];
  var F = new Date(2022, 11, 22, 12, 0, 0, 0); // 正授锚点：己酉日冬至
  var jqIdx = JQ_SEQ.indexOf('冬至');
  var guard = 0;
  while (F <= ZHIRUN_END && guard++ < 500) {
    segs.push({ start: new Date(F.getTime()), jqIdx: jqIdx });
    var Fnext = new Date(F.getTime() + 15 * 86400000);
    var XnextIdx = (jqIdx + 1) % 24;
    var jiaRi = jiaRiOf(JQ_SEQ[XnextIdx], F);
    var chaoShen = jiaRi ? Math.round((jiaRi.getTime() - Fnext.getTime()) / 86400000) : 0;
    if (chaoShen >= 9) { /* 置闰：jqIdx 不前进，重复当前节气段 */ }
    else { jqIdx = XnextIdx; }
    F = Fnext;
  }
  _zhirunSegs = segs;
  return segs;
}

function gZFromIdx(i) { return TG[i % 10] + DZ[i % 12]; }  // v3.1 补回：六十甲子索引转干支
function solarToJdn(y, m, d) {  // v3.1 补回：公历转儒略日数（格里历）
  var a = Math.floor((14 - m) / 12);
  var y2 = y + 4800 - a;
  var m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}
function jdnToDate(jdn) {  // v3.1 补回：儒略日数转公历
  var a = jdn + 32044;
  var b = Math.floor((4 * a + 3) / 146097);
  var c = a - Math.floor(146097 * b / 4);
  var d2 = Math.floor((4 * c + 3) / 1461);
  var e = c - Math.floor(1461 * d2 / 4);
  var m2 = Math.floor((5 * e + 2) / 153);
  return { y: 100 * b + d2 - 4800 + Math.floor(m2 / 10), m: m2 + 3 - 12 * Math.floor(m2 / 10), d: e - Math.floor((153 * m2 + 2) / 5) + 1 };
}
function getJuDateZhirunStrict(year, month, day, hour, minute) {
  // 置闰法核心：只认四个上元符头（甲子/甲午/己卯/己酉），符头起算5天一元；
  // 节气归属由「符头日」决定，非当日实际节气（三元未走完仍属上一节气）。
  var _dgz = dGZDate(year, month, day);
  var _dgIdx = gXun(_dgz);
  var UPPER_FU = ['甲子', '甲午', '己卯', '己酉'];
  // 向前查找最近的上元符头
  var _back = -1;
  for (var _i = 0; _i < 60; _i++) {
    var _testDgz = gZFromIdx((_dgIdx - _i + 60) % 60);
    if (UPPER_FU.indexOf(_testDgz) >= 0) { _back = _i; break; }
  }
  if (_back < 0) _back = 0;
  // 计算元
  var _yuan = _back < 5 ? 0 : _back < 10 ? 1 : 2;
  // 符头日的节气决定局数表
  var _fuJdn = solarToJdn(year, month, day) - _back;
  var _fdt = jdnToDate(_fuJdn);
  var _fuJq = jqDate(_fdt.y, _fdt.m, _fdt.d, 12, 0);
  var _jqName = _fuJq.name || jqDate(year, month, day).name;
  var _iy = YANGJQ.indexOf(_jqName) !== -1;
  return { jieqi: _jqName, isYang: _iy, juType: _iy ? '阳遁' : '阴遁',
           juNum: JQJU[_jqName][_yuan], isZhiRun: true,
           zhirunYuan: ['上元', '中元', '下元'][_yuan],
           zhirunSegStart: _fdt.y + '-' + _fdt.m + '-' + _fdt.d };
}
function getJuDateZhirun(year, month, day) {  // v3.1 补回丢失的函数声明（修复338语法错误）
  var segs = zhirunSegments();
  var t = new Date(year, month - 1, day, 12, 0, 0, 0);
  for (var i = 0; i < segs.length; i++) {
    var s0 = segs[i].start;
    var s1 = new Date(s0.getTime() + 14 * 86400000);
    if (t >= s0 && t <= s1) {
      var k = Math.round((t.getTime() - s0.getTime()) / 86400000);
      var yuan = Math.min(2, Math.floor(k / 5));
      var jqName = JQ_SEQ[segs[i].jqIdx];
      var isYang = YANGJQ.indexOf(jqName) !== -1;
      return { jieqi: jqName, isYang: isYang, juType: isYang ? '阳遁' : '阴遁',
               juNum: JQJU[jqName][yuan], isZhiRun: true,
               zhirunYuan: ['上元', '中元', '下元'][yuan],
               zhirunSegStart: s0.getFullYear() + '-' + (s0.getMonth() + 1) + '-' + s0.getDate() };
    }
  }
  // 范围外（<2022-12-22 或 >2032-12-31）：退回简化置闰，标记 approx
  var jqInfo = jqDate(year, month, day);
  var jn = jqInfo.name;
  var iy2 = YANGJQ.indexOf(jn) !== -1;
  var arr = JQJU[jn] || [1, 7, 4];
  var juNum2 = (jqInfo.totalJqDays > 15 && jqInfo.daysInJq > 15) ? arr[2] : getJuNum(jn, jqInfo.daysInJq);
  return { jieqi: jn, isYang: iy2, juType: iy2 ? '阳遁' : '阴遁', juNum: juNum2, isZhiRun: true, approx: true };
}
// ========== 严格置闰法结束 ==========
function getJuDate(year, month, day, method, hour, minute) {
  // v6.25：透传时刻，交节当天按精确交节时刻判定节气（避免取错局数表）
  var jqInfo = jqDate(year, month, day, hour, minute);
  var jn = jqInfo.name;
  var iy = YANGJQ.indexOf(jn) !== -1;
  
  var juNum;
  var isZhiRun = (method === 'zhirun');
  
  if (isZhiRun) {
    return getJuDateZhirunStrict(year, month, day, hour, minute);
  }
  // 拆补法·符头定元（v6.24 修正）
  //   甲/己日为符头，每 5 日一元；以符头地支定上中下元（子午卯酉=上、寅申巳亥=中、辰戌丑未=下）
  //   六十甲子序号每 5 个为一块 → 元 = floor(序/5) % 3
  var dgz = dGZDate(year, month, day);
  var yuan = fuTouYuan(dgz);
  juNum = (JQJU[jn] || [1])[yuan];
  
  return { jieqi: jn, isYang: iy, juType: iy ? '阳遁' : '阴遁', juNum: juNum, isZhiRun: isZhiRun, yuan: ['上元','中元','下元'][yuan] };
}
function getJu(dt, method) { return getJuDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), method); }

/** 地盘 (标准：戊起×宫，阳遁顺排，阴遁逆排) */
function diPan(juN, isY) {
  var m = {};
  for (var i = 0; i < 9; i++) {
    var gong = ((juN - 1 + (isY ? i : -i)) % 9 + 9) % 9 + 1;
    m[gong] = LIUYI[i];
  }
  return m;
}

/**
 * 天盘 + 值符 (标准转盘法 v3)
 * 使用转盘宫序 [1,8,3,4,9,2,7,6] 而非线性宫序
 * 值符星 = 旬首宫本星，随时干走
 * 各星携带原宫地盘干，按转盘宫序整体位移
 */
function tiPan(diMap, xSX, sG, isY) {
  var dG = XDUN[xSX] || '戊';
  var xunGong = 1;
  for (var g = 1; g <= 9; g++) { if (diMap[g] === dG) { xunGong = g; break; } }
  var zhiFuXing = XING[xunGong];
  var shiGanGong = 1;
  if (sG === '甲') {
    // v6.36 修复：六甲时辰（甲子/甲戌/甲申/甲午/甲辰/甲寅）地盘无甲（甲遁六仪），
    // 旧代码在此 fallback 到 1 宫 = 值符落错宫、天盘整体错位（影响约 1/10 排盘）。
    // 正确规则：甲不入盘，用旬首遁干宫 —— 值符落旬首宫原地，全局伏吟（天盘=地盘）。
    // 校验点：1997-01-07 20:40（甲戌时，阳遁2局）全局伏吟，乙@1、庚@4=地盘。
    shiGanGong = xunGong;
  } else {
    for (var g = 1; g <= 9; g++) { if (diMap[g] === sG) { shiGanGong = g; break; } }
  }

  // 在转盘宫环中计算偏移量
  var order = ZHUA_GONG_ORDER;
  // v6.20 修复①：旬首/时干落中五宫时 indexOf 返回 -1（order 不含 5），
  // 需按「中宫寄坤」寄到坤二宫 —— 与 jXing() 的处理保持一致（原 tiPan 缺此防御）
  var xunIdx = order.indexOf(xunGong);
  if (xunIdx < 0) xunIdx = order.indexOf(2);
  var shiIdx = order.indexOf(shiGanGong);
  if (shiIdx < 0) shiIdx = order.indexOf(2);

  // v6.20 修复②：JS 负数取模返回负值，原「+8」偏移不足
  // （xunIdx - i - st 最小可达 0-7-7 = -14，+8 后仍为 -6 → order[-6] = undefined
  //   → tMap[undefined] 覆盖，导致每盘丢失 1~2 个宫的天盘干）
  function mod8(n) { return ((n % 8) + 8) % 8; }

  var st = isY ? mod8(shiIdx - xunIdx) : mod8(xunIdx - shiIdx);

  // 天盘天干 = 地盘天干按转盘宫序位移
  var tMap = {};
  for (var i = 0; i < 8; i++) {
    var srcIdx = isY ? mod8(xunIdx + i) : mod8(xunIdx - i);
    // srcIdx 是旬首宫在转盘序中的位置，对应一个星的原宫
    // 这个星携带其原宫的地盘干，移动到目标位置
    // 目标位置 = (srcIdx对应的宫) 位移 st 步
    var srcGong = order[srcIdx];  // i=0:旬首宫, i=1:旬首下一宫...
    var tgtIdx = isY ? mod8(xunIdx + i + st) : mod8(xunIdx - i - st);
    var tgtGong = order[tgtIdx];
    tMap[tgtGong] = diMap[srcGong];
  }
  // v6.21 修复：中宫不参与旋转，中宫天盘干 = 中宫地盘干（旧代码误设为旬首遁干 dG，
  // 造成天盘干重复、某干丢失，如 2026-09-25 22:00 盘壬×2、癸丢失）。
  // 天禽星与中宫干在显示/解读层寄坤二宫（前端 renderDynamicGrid 已有寄宫逻辑）。
  tMap[5] = diMap[5];

  return { tianMap: tMap, zhiFuXing: zhiFuXing, zhiFuOrigGong: xunGong, zhiFuGong: shiGanGong, dunGan: dG };
}

/** 九星：值符星随时干，其余星按转盘宫序顺逆排 (v3) */
function jXing(zfOG, zfG, isY) {
  // 九星：天蓬1 天芮2 天冲3 天辅4 天禽5 天心6 天柱7 天任8 天英9
  // 修复 v3-fix：用转盘路径上的星序（ringStars），确保刚体旋转守恒
  // 天禽星寄坤二宫，不参与旋转
  var order = ZHUA_GONG_ORDER;
  var ringStars = order.map(function(g){ return XING[g]; });
  // ringStars = [天蓬,天任,天冲,天辅,天英,天芮,天柱,天心]

  // 值符星本位槽（旬首宫在转盘路径中的索引）
  var srcIdx = order.indexOf(zfOG);
  if (srcIdx < 0) srcIdx = order.indexOf(2); // 中宫寄坤

  // 值符落宫槽
  var tgtIdx = order.indexOf(zfG);
  if (tgtIdx < 0) tgtIdx = order.indexOf(2);

  var m = {};
  for (var i = 0; i < 8; i++) {
    // 阳遁顺转 / 阴遁逆转
    // v3.2-fix: 阴阳遁统一刚体旋转方向（offset 符号已含顺/逆），确保值符星必落值符宫
    var from = (i - (tgtIdx - srcIdx) + 16) % 8;
    m[order[i]] = ringStars[from];
  }

  // 天禽寄坤：传统转盘通例——五宫寄坤二宫，天禽随天芮同行同宫。
  // 用特殊标记让前端知道天禽与天芮同宫
  var ruiGong = null;
  for (var g in m) { if (m[g] === '天芮') { ruiGong = Number(g); break; } }
  if (ruiGong) {
    // 天芮宫同时包含天禽，用特殊格式标记
    m[ruiGong] = '天芮,天禽';  // 天禽随天芮同宫
    delete m[5];               // 从中宫移除
  } else {
    m[2] = '天芮,天禽';        // 安全兜底
    delete m[5];
  }

  return { stars: m, zfOG: zfOG };  // v3-fix: 额外返回值符本位宫
}
/**
 * 八门 (标准转盘法 v3)
 * 使用转盘宫序 [1,8,3,4,9,2,7,6] 而非线性宫序
 * 值使门 = 旬首宫本门，从旬首宫起沿转盘宫序顺数/逆数到时支
 */
function bMen(diMap, xSX, hgz, isY) {
  var dG = XDUN[xSX] || '戊';
  var xunGong = 1;
  for (var g = 1; g <= 9; g++) { if (diMap[g] === dG) { xunGong = g; break; } }
  var xunMenGong = (xunGong === 5) ? 2 : xunGong;

  // 宫环（转盘八卦环）和八门序列
  // 注：值使落宫按九宫数序（含5宫）飞算；此处 order 仅决定八门整体排布走向
  // v3.2-fix：门环用「当前环槽位的本位门」而非 MEN_SEQUENCE——
  //   两者一一对应（休1生8伤3杜4景9死2惊7开6 恰按八卦环排布），语义等价
  var order = ZHUA_GONG_ORDER;
  var ringDoors = order.map(function(g){ return MEN[g]; });
  var doorSeq = MEN_SEQUENCE;

  // 值使门 = 旬首宫本门
  var zhiShiMen = MEN[xunMenGong];
  var startDoorIdx = ringDoors.indexOf(zhiShiMen);

  // 计算步数：时干在旬中的位置差（非时支）
  // 书例验证：甲午旬戊戌时，戊在旬中位置4，甲午时位置0，步数=4
  // 五宫顺数4步：5→9→8→7→6→一宫？不对...
  // 重新理解：步数 = 时干在六十甲子中的位置 % 10
  // 甲午(4) → 戊戌(44)，(44-4)%10 = 0？不对
  // 正确理解：步数 = 时干在旬中的序号
  // 甲子旬：甲0 乙1 丙2 丁3 戊4 己5 庚6 辛7 壬8 癸9
  // 戊戌时：戊在甲午旬中位置 = (gXun(戊戌) - gXun(甲午)) % 10 = (44-4)%10 = 0
  // 但书中说戊时第一步，戌时第五步
  // 实际：步数 = 时干在旬中的索引 = gXun(hgz) % 10
  var step = gXun(hgz) % 10;

  // 值使门按九宫完整序列运转（含5宫）——v3.1 修复
  // 中宫计数通例：未时在五宫、申时在六宫……5宫占一数
  // 酉时到五宫——5宫参与计数，最终落5宫时寄坤二宫
  var gongSeq = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // 九宫完整序列（含5宫）
  var xunOrderIdx = gongSeq.indexOf(xunGong); // 旬首宫若是5，从5起数（寄宫只在落定时处理）
  var zhiShiOrderIdx = isY ? (xunOrderIdx + step) % 9 : (xunOrderIdx - step + 9) % 9;
  var zhiShiPalace = gongSeq[zhiShiOrderIdx];
  var zhiShiRawGong = zhiShiPalace;           // 原始落宫（可能为5）
  if (zhiShiPalace === 5) zhiShiPalace = 2;   // 落5宫寄坤二宫

  // 排布所有门：从值使宫（寄宫后）开始，八门沿转盘保持固定相对序，整体旋转
  var tgtTurnIdx = order.indexOf(zhiShiPalace);
  if (tgtTurnIdx < 0) tgtTurnIdx = order.indexOf(2);
  var mMap = {};
  for (var i = 0; i < 8; i++) {
    var palIdx = isY ? (tgtTurnIdx + i) % 8 : (tgtTurnIdx - i + 8) % 8;
    // 阳遁：门序顺排；阴遁：门序逆排（宫与门同步反转，相对关系不变）
    var doorIdx = isY ? (startDoorIdx + i) % 8 : (startDoorIdx - i + 8) % 8;
    mMap[order[palIdx]] = ringDoors[doorIdx];
  }

  return { menMap: mMap, zhiShiMen: zhiShiMen, zhiShiOrigGong: xunMenGong, zhiShiTarget: zhiShiPalace, zhiShiRawGong: zhiShiRawGong };
}

/** 八神：小值符随大值符 (v4 修复阴阳遁)
 * 阳遁顺布：值符→螣蛇→太阴→六合→白虎→玄武→九地→九天，沿转盘正向
 * 阴遁逆布：值符→九天→九地→玄武→白虎→六合→太阴→螣蛇，沿转盘正向（神序反转，非宫位方向反转）
 */
function bShen(zfG, isY) {
  var order = ZHUA_GONG_ORDER;
  var zfIdx = order.indexOf(zfG === 5 ? 2 : zfG);
  // 阳遁顺时针，阴遁逆时针，顺序始终是：值符→螣蛇→太阴→六合→白虎→玄武→九地→九天
  var shenArr = SHEN;
  var m = {};
  var fwd = isY;
  for (var i = 0; i < 8; i++) {
    // 顺行：+i，逆行：-i
    var gi = fwd
      ? (zfIdx + i) % 8
      : (zfIdx - i + 16) % 8;
    m[order[gi]] = shenArr[i];
  }
  return m;
}

// ========== 格局检测 ==========

function cFuxin(d) { for (var g = 1; g <= 9; g++) { if (g === 5) continue; if (d.tp.tianMap[g] === d.dp[g]) return true; } return false; }
function cFanin(d) {
  return (d.tp.tianMap[1] === d.dp[9] && d.tp.tianMap[9] === d.dp[1]) &&
         (d.tp.tianMap[2] === d.dp[8] && d.tp.tianMap[8] === d.dp[2]) &&
         (d.tp.tianMap[3] === d.dp[7] && d.tp.tianMap[7] === d.dp[3]) &&
         (d.tp.tianMap[4] === d.dp[6] && d.tp.tianMap[6] === d.dp[4]);
}
function cQing(d) {
  for (var g = 1; g <= 9; g++) { if (g !== 5 && d.tp.tianMap[g] === '戊' && d.dp[g] === '丙') return true; }
  return false;
}
function cFei(d) {
  for (var g = 1; g <= 9; g++) { if (g !== 5 && d.tp.tianMap[g] === '丙' && d.dp[g] === '戊') return true; }
  return false;
}
function cTianw(d) { return d.dp[d.tp.zhiFuGong] === '癸'; }
function cYunv(d) { return d.tp.tianMap[d.tp.zhiFuGong] === '乙' && d.men.menMap[d.tp.zhiFuGong] === '开门'; }
function cGeng(d) { 
  // v4修复：原逻辑检查地盘是否有庚，但庚是六仪之一永远在地盘上 → 100%误报
  // 具体庚格（飞宫/伏宫/大格/小格/刑格）已在detectGeJu中单独检测，此处不再泛化检测
  return false; 
}
function cSanz(d) { var z = d.tp.zhiFuGong; var sh = d.shen[z], me = d.men.menMap[z]; return ['休门','生门','开门'].indexOf(me) !== -1 && ['太阴','六合','九地'].indexOf(sh) !== -1; }
function cWuji(d) { var z = d.tp.zhiFuGong; return ['开门','休门','生门'].indexOf(d.men.menMap[z]) !== -1; }
function cTiany(d) { return ['天辅','天冲','天任','天心'].indexOf(d.tp.zhiFuXing) !== -1; }
function cYiqi(d) { for (var g = 1; g <= 9; g++) if (d.tp.tianMap[g] === '乙' && ['开门','休门','生门'].indexOf(d.men.menMap[g]) !== -1) return true; return false; }
function cZhuq(d) { for (var g = 1; g <= 9; g++) if (d.tp.tianMap[g] === '丙' && d.men.menMap[g] === '景门') return true; return false; }
function cBaih(d) { for (var g = 1; g <= 9; g++) if (d.shen[g] === '白虎' && ['死门','惊门','伤门'].indexOf(d.men.menMap[g]) !== -1) return true; return false; }
function cTengs(d) { var z = d.tp.zhiFuGong; return d.shen[z] === '螣蛇' && (d.dp[z] === '癸' || d.dp[z] === '辛'); }
function cYunvs(d) { for (var g = 1; g <= 9; g++) if (d.tp.tianMap[g] === '乙' && d.men.menMap[g] === '生门') return true; return false; }

function detectGeJu(d) {
  var r = [];
  var ch = [
    // [v4.3-fix] 青龙返首/飞鸟跌穴移出通用表：下方专检带 gong+detail，通用表重复推送致 UI 重复
    [cYiqi, '乙奇得使', '吉'],
    [cSanz, '三诈', '吉'], [cTiany, '天乙贵人', '吉'], [cYunvs, '玉女关', '吉'],
    [cWuji, '三吉门', '吉'], [cZhuq, '朱雀投江', '特殊'], [cYunv, '玉女关', '特殊'],
    [cFuxin, '伏吟局', '平'], [cFanin, '反吟局', '凶'], [cTianw, '天网四张', '凶'],
    [cBaih, '白虎猖狂', '凶'], [cTengs, '螣蛇夭矫', '凶'], [cGeng, '庚格', '凶']
  ];
  for (var i = 0; i < ch.length; i++) {
    if (ch[i][0](d)) r.push({ name: ch[i][1], level: ch[i][2] });
  }
  
  // 五不遇时：时干克日干（甲日庚时、乙日辛时、丙日壬时、丁日癸时、戊日甲时）
  var wubuMap = {'甲':'庚','乙':'辛','丙':'壬','丁':'癸','戊':'甲'};
  var cWubu = wubuMap[d.ygz && d.ygz[0]] === (d.hgz && d.hgz[0]) ? '五不遇时' : null;
  if (cWubu) r.push({ name: cWubu, level: '凶', detail: '时干克日干,凡事不成' });
  
  // 飞宫格：值符落宫天盘含庚
  var cFeiGong = d.tp.tianMap[d.tp.zhiFuGong] === '庚' ? '飞宫格' : null;
  if (cFeiGong) r.push({ name: cFeiGong, level: '凶', gong: d.tp.zhiFuGong, detail: '值符宫天盘庚,动能受阻' });
  
  // 伏宫格：值使落宫天盘含庚
  var cFuGong = d.tp.tianMap[d.men.zhiShiTarget] === '庚' ? '伏宫格' : null;
  if (cFuGong) r.push({ name: cFuGong, level: '凶', gong: d.men.zhiShiTarget, detail: '值使宫天盘庚,行动遇阻' });
  
  // 大格：庚+癸
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '庚' && d.dp[g] === '癸') {
      r.push({ name: '大格', level: '凶', gong: g, detail: '庚+癸,事有隔阂,宜缓不宜急' });
    }
  }
  
  // 小格：庚+壬
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '庚' && d.dp[g] === '壬') {
      r.push({ name: '小格', level: '凶', gong: g, detail: '庚+壬,财帛损耗,宜静守' });
    }
  }
  
  // 刑格：庚+己
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '庚' && d.dp[g] === '己') {
      r.push({ name: '刑格', level: '凶', gong: g, detail: '庚+己,刑罚官司,慎言慎行' });
    }
  }
  
  // 悖格：丙+戊（值符宫）
  if (d.tp.tianMap[d.tp.zhiFuGong] === '丙' && d.dp[d.tp.zhiFuGong] === '戊') {
    r.push({ name: '悖格', level: '凶', gong: d.tp.zhiFuGong, detail: '丙+戊,事情反复,宜守不宜攻' });
  }
  
  // 天遁：丙+丁
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '丙' && d.dp[g] === '丁') {
      r.push({ name: '天遁', level: '吉', gong: g, detail: '丙+丁,天遁格,百事可为,光明通达' });
    }
  }
  
  // 地遁：乙+己
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '乙' && d.dp[g] === '己') {
      r.push({ name: '地遁', level: '吉', gong: g, detail: '乙+己,地遁格,密谋策划,暗中推进' });
    }
  }
  
  // 人遁：天盘丁+三吉门(休/生/开)
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '丁' && (d.men.menMap[g] === '休门' || d.men.menMap[g] === '生门' || d.men.menMap[g] === '开门')) {
      r.push({ name: '人遁', level: '吉', gong: g, detail: '丁+三吉门,人遁格,人际通达,合作有利' });
    }
  }
  
  // 青龙返首：天盘戊+地盘丙
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '戊' && d.dp[g] === '丙') {
      r.push({ name: '青龙返首', level: '吉', gong: g, detail: '戊+丙,青龙返首,百事吉昌' });
    }
  }
  
  // 飞鸟跌穴：天盘丙+地盘戊
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '丙' && d.dp[g] === '戊') {
      r.push({ name: '飞鸟跌穴', level: '吉', gong: g, detail: '丙+戊,飞鸟跌穴,谋事可成' });
    }
  }
  
  // 风遁：天辅星+乙+杜门
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.xing[g] === '天辅' && d.tp.tianMap[g] === '乙' && d.men.menMap[g] === '杜门') {
      r.push({ name: '风遁', level: '吉', gong: g, detail: '天辅+乙+杜门,风遁格,顺势而为,事半功倍' });
    }
  }
  
  // 龙遁：天盘乙+地盘癸+三吉门(休/生/开)
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '乙' && d.dp[g] === '癸' && (d.men.menMap[g] === '休门' || d.men.menMap[g] === '生门' || d.men.menMap[g] === '开门')) {
      r.push({ name: '龙遁', level: '吉', gong: g, detail: '乙+癸+三吉门,龙遁格,筹谋得利' });
    }
  }
  
  // 虎遁：天盘庚+天盘辛+三吉门(休/生/开)
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '庚' && d.dp[g] === '辛' && (d.men.menMap[g] === '休门' || d.men.menMap[g] === '生门' || d.men.menMap[g] === '开门')) {
      r.push({ name: '虎遁', level: '吉', gong: g, detail: '庚+辛+三吉门,虎遁格,威权在握' });
    }
  }
  
  // 云遁：天盘壬+地盘辛+三吉门(休/生/开)
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.tp.tianMap[g] === '壬' && d.dp[g] === '辛' && (d.men.menMap[g] === '休门' || d.men.menMap[g] === '生门' || d.men.menMap[g] === '开门')) {
      r.push({ name: '云遁', level: '吉', gong: g, detail: '壬+辛+三吉门,云遁格,隐蔽行事' });
    }
  }
  
  // 天辅时：天辅星+开门+天盘乙
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (d.xing[g] === '天辅' && d.men.menMap[g] === '开门' && d.tp.tianMap[g] === '乙') {
      r.push({ name: '天辅时', level: '吉', gong: g, detail: '天辅+开门+乙,天辅时格,百事可行' });
    }
  }
  
  // 玉女守门：值使落宫得三奇(乙/丙/丁)
  var zhiShiGongXing = d.men.zhiShiTarget || 0;
  if (zhiShiGongXing > 0 && ['乙','丙','丁'].indexOf(d.tp.tianMap[zhiShiGongXing]) !== -1) {
    r.push({ name: '玉女守门', level: '吉', gong: zhiShiGongXing, detail: '值使落宫得三奇,玉女守门格' });
  }
  
  // v4.5 十干克应：有传统专名的干加干组合（格局名出自《奇门遁甲统宗》《烟波钓叟歌》等公版古籍一脉）
  // 每条=[天盘干,地盘干,格局名,吉凶,断语+cite]；每宫只推首个命中；同名去重交给尾部安全网
  var _GJ = [
    ['丁','丙','星随月转','吉','丁+丙,贵人越级高升,常人婚姻财喜'],
    ['丙','乙','日月并行','吉','丙+乙,日月并行,公谋私为皆为吉'],
    ['丙','丙','月奇悖师','凶','丙+丙,月奇悖师,文书逼迫,单据票证耗失'],
    ['乙','癸','华盖逢星','特殊','乙+癸,华盖逢星,遁迹藏形,躲灾避难为吉'],
    ['辛','丁','狱神得奇','吉','辛+丁,狱神得奇,经商求财获利倍增,囚人逢赦'],
    ['辛','己','入狱自刑','凶','辛+己,入狱自刑,奴背主,有苦诉讼难伸'],
    ['辛','庚','白虎出力','凶','辛+庚,白虎出力,刀刃相交主客相残,退让稍可强进血溅'],
    ['辛','辛','伏吟天庭','平','辛+辛,伏吟天庭,自刑笼罩,公废私就,讼狱自罹'],
    ['丙','庚','荧入太白','凶','丙+庚,荧入太白,阳火克阳金争战不已,门户破败盗贼耗失事业难成'],
    ['庚','丙','太白入荧','特殊','庚+丙,太白入荧,贼必来;进主先贫后富'],
    ['戊','辛','青龙折足','凶','戊+辛,青龙折足,吉门有生助尚能谋事,凶门主招灾失财折伤'],
    ['辛','戊','困龙被伤','凶','辛+戊,困龙被伤,甲受辛冲克被困受伤主凶'],
    ['乙','己','日奇入墓','凶','乙+己,日奇入墓,乙奇被土埋没,门凶事必凶门吉有救'],
    ['己','乙','地户逢星','特殊','己+乙,地户逢星,宜遁迹隐形,宜退不宜进']
  ];
  for (var _t = 0; _t < _GJ.length; _t++) {
    var _def = _GJ[_t];
    for (var g = 1; g <= 9; g++) {
      if (g === 5) continue;
      if (d.tp.tianMap[g] === _def[0] && d.dp[g] === _def[1]) {
        r.push({ name: _def[2], level: _def[3], gong: g, detail: _def[4] });
        break;
      }
    }
  }
  
  // [v4.3-fix] 尾部安全网：同名格局去重（合并 detail/gong，不重复推送）
  var _seen = {}, _out = [];
  for (var _i = 0; _i < r.length; _i++) {
    var _e = r[_i];
    if (!_seen[_e.name]) { _seen[_e.name] = _e; _out.push(_e); }
    else {
      var _p = _seen[_e.name];
      if (!_p.detail && _e.detail) _p.detail = _e.detail;
      if (!_p.gong && _e.gong) _p.gong = _e.gong;
    }
  }
  return _out;
}

// ========== 主入口 ==========

function paipan(year, month, day, hour, minute, method) {
  if (hour === undefined) hour = 12;
  if (minute === undefined) minute = 0;
  if (!method) method = 'chaibu';
  // 注：时区 / 真太阳时换算由调用方（server 的 qimen-location 层）完成，
  //     引擎只负责「给定时刻 → 确定性盘面」，不感知地理位置。
  var timeStr = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  var dateStr = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  
  // 子时换日（次日派 / 子初 23:00）v6.24 修正
  //   23:00–24:00 日柱进次日，时柱用次日日干推算（对齐专业排盘软件与《奇门法窍》刻数算例）
  //   注：getShiChenIndex 已把 hour>=23 归为子时(0)，故此处仅需在 23 点把日柱推进到次日
  if (hour >= 23) {
    var dObj = new Date(year, month - 1, day + 1);
    year = dObj.getFullYear();
    month = dObj.getMonth() + 1;
    day = dObj.getDate();
    dateStr = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  
  // 1. 四柱（v3: yGZ传月日）
  var ygz = yGZ(year, month, day);
  var mgz = mGZDate(year, month, day);
  var dgz = dGZDate(year, month, day);
  var hgz = hGZ(dgz, timeStr);
  
  // 2. 定局（透传时刻：交节当天按精确交节时刻判定节气）
  var juInfo = getJuDate(year, month, day, method, hour, minute);
  // 节气精确区间（供验盘卡展示）
  var jqEx = jqAtExact(year, month, day, hour, minute);
  var xunIdx = Math.floor(gXun(hgz) / 10);
  var xun = { xun: XXUN[xunIdx], kong: XKONG[xunIdx] };
  
  // 3. 排盘
  var dp = diPan(juInfo.juNum, juInfo.isYang);
  var tp = tiPan(dp, xun.xun, hgz[0], juInfo.isYang);
  var jxingResult = jXing(tp.zhiFuOrigGong, tp.zhiFuGong, juInfo.isYang);
  var xing = jxingResult.stars;
  // v3-fix: 九星修正后，jXing 返回 zfOG 字段，保存供 paipan 结果使用
  var men = bMen(dp, xun.xun, hgz, juInfo.isYang);
  var shen = bShen(tp.zhiFuGong, juInfo.isYang);
  
  // 4. 马星和空亡
  // 时家奇门马星按时支起，不用日支（v6.24 修正）
  var mz = getMa(hgz[1]);
  var mg = z2G(mz);
  var kg = [];
  for (var ki = 0; ki < xun.kong.length; ki++) kg.push(z2G(xun.kong[ki]));
  
  // 5. 格局
  var chartDataForGeju = { dp: dp, tp: tp, xing: xing, men: men, shen: shen, ygz: ygz, hgz: hgz };
  var geju = detectGeJu(chartDataForGeju);
  
  return {
    ygz: ygz, mgz: mgz, dgz: dgz, hgz: hgz,
    jqRange: jqEx ? { name: jqEx.name, startTime: jqEx.startTime,
                      nextName: jqEx.nextName, nextTime: jqEx.nextTime } : null,
    jieqi: juInfo.jieqi,
    isYang: juInfo.isYang,
    juType: juInfo.juType,
    juNum: juInfo.juNum,
    isZhiRun: juInfo.isZhiRun,
    zhirunYuan: juInfo.zhirunYuan,
    zhirunSegStart: juInfo.zhirunSegStart,
    approx: juInfo.approx,
    method: method,
    pan: 'zhuan',   // 产品定位：只做转盘（两书案例与断语体系均为转盘框架，2026-10-02 龙哥拍板全删飞盘）
    xun: xun.xun,
    kong: xun.kong,
    zhiFuXing: tp.zhiFuXing,
    zhiFuOrigGong: jxingResult ? jxingResult.zfOG : null,
    zhiFuGong: tp.zhiFuGong,
    zhiShiMen: men.zhiShiMen,
    zhiShiGong: men.zhiShiTarget,
    zhiShiRawGong: men.zhiShiRawGong,
    dp: dp,
    tp: tp.tianMap,
    xing: xing,
    men: men.menMap,
    shen: shen,
    maGong: mg,
    kongGongs: kg,
    dunGan: tp.dunGan,
    geju: geju,
    date: dateStr,
    time: timeStr,
    gongWei: {
      1: { name: '坎一', gua: '坎', wx: '水', dir: '北', dirEn: 'N' },
      2: { name: '坤二', gua: '坤', wx: '土', dir: '西南', dirEn: 'SW' },
      3: { name: '震三', gua: '震', wx: '木', dir: '东', dirEn: 'E' },
      4: { name: '巽四', gua: '巽', wx: '木', dir: '东南', dirEn: 'SE' },
      5: { name: '中五', gua: '中', wx: '土', dir: '中', dirEn: 'C' },
      6: { name: '乾六', gua: '乾', wx: '金', dir: '西北', dirEn: 'NW' },
      7: { name: '兑七', gua: '兑', wx: '金', dir: '西', dirEn: 'W' },
      8: { name: '艮八', gua: '艮', wx: '土', dir: '东北', dirEn: 'NE' },
      9: { name: '离九', gua: '离', wx: '火', dir: '南', dirEn: 'S' },
    }
  };
}

function paipanLegacy(dateStr, timeStr, method) {
  if (!timeStr) timeStr = '12:00';
  var parts = dateStr.split('-');
  var tParts = timeStr.split(':');
  return paipan(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]),
                parseInt(tParts[0]), parseInt(tParts[1]), method);
}

// ============================================================
// 年命计算
// ============================================================
function calcNianMing(birthYear) {
  var ganIdx = (birthYear - 4) % 10;
  var zhiIdx = (birthYear - 4) % 12;
  if (ganIdx < 0) ganIdx += 10;
  if (zhiIdx < 0) zhiIdx += 12;
  var gan = TG[ganIdx];
  var zhi = DZ[zhiIdx];
  var wxMap = { '甲':'木', '乙':'木', '丙':'火', '丁':'火', '戊':'土', '己':'土', '庚':'金', '辛':'金', '壬':'水', '癸':'水' };
  return {
    year: birthYear,
    gan: gan,
    zhi: zhi,
    ganzhi: gan + zhi,
    wx: wxMap[gan] || '',
    ganIdx: ganIdx,
    zhiIdx: zhiIdx
  };
}

// 根据排盘 chart 找出年命天干的落宫
function getNianMingGong(chart, nianMing) {
  if (!chart || !chart.tp || !nianMing) return -1;
  for (var g = 1; g <= 9; g++) {
    if (g === 5) continue;
    if (chart.tp[g] === nianMing.gan) return g;
  }
  return -1;
}

// 从排盘结果中提取年/月/日/时四干及其落宫
function getSiGan(chart) {
  if (!chart || !chart.ygz) return null;
  var gongNames = {1:'坎一',2:'坤二',3:'震三',4:'巽四',6:'乾六',7:'兑七',8:'艮八',9:'离九'};
  var wxMap = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
  function findGong(gan) {
    if (!chart.tp || !gan) return -1;
    for (var g = 1; g <= 9; g++) { if (g !== 5 && chart.tp[g] === gan) return g; }
    return -1;
  }
  var nianGan = chart.ygz.charAt(0), yueGan = chart.mgz.charAt(0);
  var riGan = chart.dgz.charAt(0), shiGan = chart.hgz.charAt(0);
  var nG = findGong(nianGan), yG = findGong(yueGan);
  var rG = findGong(riGan), sG = findGong(shiGan);

  return {
    gan: { nian: nianGan, yue: yueGan, ri: riGan, shi: shiGan },
    gong: { nian: nG, yue: yG, ri: rG, shi: sG },
    gongName: { nian: nG>0?gongNames[nG]:'', yue: yG>0?gongNames[yG]:'', ri: rG>0?gongNames[rG]:'', shi: sG>0?gongNames[sG]:'' },
    wx: { nian: wxMap[nianGan]||'', yue: wxMap[yueGan]||'', ri: wxMap[riGan]||'', shi: wxMap[shiGan]||'' }
  };
}

// ========== 旺衰计算（P2 引擎级） ==========

/** 五行生克 */
const WX_SHENG = {'木':'火','火':'土','土':'金','金':'水','水':'木'};
const WX_KE = {'木':'土','火':'金','土':'水','金':'木','水':'火'};

/** 月令五行（节气对应） */
const MONTH_WX = {
  '冬至':'水','小寒':'水','大寒':'水',
  '立春':'土','雨水':'土','惊蛰':'木',
  '春分':'木','清明':'木','谷雨':'木',
  '立夏':'火','小满':'火','芒种':'火',
  '夏至':'火','小暑':'火','大暑':'火',
  '立秋':'土','处暑':'土','白露':'金',
  '秋分':'金','寒露':'金','霜降':'金',
  '立冬':'土','小雪':'土','大雪':'土'
};

/** 计算天干在月令下的旺衰状态 */
function calcWangShuai(gan, jieqi) {
  const ganWx = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' }[gan] || '';
  const monthWx = MONTH_WX[jieqi] || '';
  
  if (!ganWx || !monthWx) return { status: '未知', reason: '' };
  
  // 得令：月令生天干（月令旺）或天干与月令相同（临官）
  if (WX_SHENG[monthWx] === ganWx) return { status: '得令', reason: monthWx + '生' + ganWx, score: 2 };
  if (monthWx === ganWx) return { status: '临官', reason: '同气', score: 1.5 };
  // 失令：月令克天干
  if (WX_KE[monthWx] === ganWx) return { status: '失令', reason: monthWx + '克' + ganWx, score: 0.5 };
  // 天干克月令（耗气）
  if (WX_KE[ganWx] === monthWx) return { status: '休囚', reason: ganWx + '克' + monthWx + '耗气', score: 0.8 };
  // 月令生天干（相生）
  if (WX_SHENG[ganWx] === monthWx) return { status: '相', reason: ganWx + '生' + monthWx, score: 1.2 };
  
  return { status: '平', reason: '', score: 1.0 };
}

/** 计算所有宫位的旺衰 */
function calculateWangShuai(chart) {
  if (!chart || !chart.tp || !chart.jieqi) return null;
  
  const result = {};
  for (let g = 1; g <= 9; g++) {
    if (g === 5) continue;
    const gan = chart.tp[g];
    if (!gan) continue;
    result[g] = calcWangShuai(gan, chart.jieqi);
    result[g].gong = g;
    result[g].gongName = chart.gongWei?.[g]?.name || '';
    result[g].gan = gan;
  }
  return result;
}

/** 计算宫位间生克关系 */
function analyzePalaceRelations(chart) {
  if (!chart || !chart.tp) return null;

  const relations = [];
  const wxMap = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };

  for (let g1 = 1; g1 <= 9; g1++) {
    if (g1 === 5) continue;
    const gan1 = chart.tp[g1];
    if (!gan1) continue;
    const wx1 = wxMap[gan1] || '';

    for (let g2 = 1; g2 <= 9; g2++) {
      if (g2 === 5 || g1 === g2) continue;
      const gan2 = chart.tp[g2];
      if (!gan2) continue;
      const wx2 = wxMap[gan2] || '';

      let relation = null;
      if (WX_SHENG[wx1] === wx2) relation = { type: '生', from: g1, to: g2, desc: gan1 + '生' + gan2 };
      else if (WX_KE[wx1] === wx2) relation = { type: '克', from: g1, to: g2, desc: gan1 + '克' + gan2 };
      else if (wx1 === wx2) relation = { type: '比和', from: g1, to: g2, desc: gan1 + '=' + gan2 };

      if (relation) relations.push(relation);
    }
  }

  return relations;
}

/** P2-2 宫位组合分析：关键宫位生克链路 */
function analyzePalaceCombinations(chart, scene) {
  if (!chart || !chart.tp) return null;

  const wxMap = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
  const gongName = {1:'坎一',2:'坤二',3:'震三',4:'巽四',6:'乾六',7:'兑七',8:'艮八',9:'离九'};

  // 找关键天干落宫
  function findGong(gan) {
    if (!chart.tp || !gan) return -1;
    for (let g = 1; g <= 9; g++) { if (g !== 5 && chart.tp[g] === gan) return g; }
    return -1;
  }

  const riGong = findGong(chart.dgz?.[0]);  // 日干
  const shiGong = findGong(chart.hgz?.[0]); // 时干
  const nianMingGong = chart.nianMingGong || -1;
  const zhiFuGong = chart.zhiFuGong;
  const zhiShiGong = chart.zhiShiGong;

  // 场景用神宫
  const sceneGongs = {
    career: { yongShen: findGong(chart.men[1] === '开门' ? 1 : chart.men[2] === '开门' ? 2 : chart.men[3] === '开门' ? 3 : chart.men[4] === '开门' ? 4 : chart.men[6] === '开门' ? 6 : chart.men[7] === '开门' ? 7 : chart.men[8] === '开门' ? 8 : chart.men[9] === '开门' ? 9 : -1), label: '开门' },
    wealth: { yongShen: findGong(chart.men[1] === '生门' ? 1 : chart.men[2] === '生门' ? 2 : chart.men[3] === '生门' ? 3 : chart.men[4] === '生门' ? 4 : chart.men[6] === '生门' ? 6 : chart.men[7] === '生门' ? 7 : chart.men[8] === '生门' ? 8 : chart.men[9] === '生门' ? 9 : -1), label: '生门' },
    love: { yongShen: findGong('六合' in chart.shen ? Object.keys(chart.shen).find(k => chart.shen[k] === '六合') : -1), label: '六合' }
  };

  const combos = [];

  // 日干宫 vs 时干宫
  if (riGong > 0 && shiGong > 0 && riGong !== shiGong) {
    const wx1 = wxMap[chart.tp[riGong]] || '';
    const wx2 = wxMap[chart.tp[shiGong]] || '';
    let relation = null;
    if (WX_SHENG[wx1] === wx2) relation = '生';
    else if (WX_KE[wx1] === wx2) relation = '克';
    else if (wx1 === wx2) relation = '比和';
    if (relation) combos.push({ type: relation, from: riGong, to: shiGong, desc: gongName[riGong] + '(' + chart.tp[riGong] + ') ' + relation + ' ' + gongName[shiGong] + '(' + chart.tp[shiGong] + ')' });
  }

  // 值符宫 vs 日干宫
  if (zhiFuGong && riGong > 0 && zhiFuGong !== riGong) {
    const wx1 = wxMap[chart.tp[zhiFuGong]] || '';
    const wx2 = wxMap[chart.tp[riGong]] || '';
    let relation = null;
    if (WX_SHENG[wx1] === wx2) relation = '生';
    else if (WX_KE[wx1] === wx2) relation = '克';
    else if (wx1 === wx2) relation = '比和';
    if (relation) combos.push({ type: relation, from: zhiFuGong, to: riGong, desc: '值符' + gongName[zhiFuGong] + '(' + chart.tp[zhiFuGong] + ') ' + relation + ' 日干' + gongName[riGong] + '(' + chart.tp[riGong] + ')' });
  }

  // 年命宫 vs 日干宫
  if (nianMingGong > 0 && riGong > 0 && nianMingGong !== riGong) {
    const wx1 = wxMap[chart.tp[nianMingGong]] || '';
    const wx2 = wxMap[chart.tp[riGong]] || '';
    let relation = null;
    if (WX_SHENG[wx1] === wx2) relation = '生';
    else if (WX_KE[wx1] === wx2) relation = '克';
    else if (wx1 === wx2) relation = '比和';
    if (relation) combos.push({ type: relation, from: nianMingGong, to: riGong, desc: '年命' + gongName[nianMingGong] + '(' + chart.tp[nianMingGong] + ') ' + relation + ' 日干' + gongName[riGong] + '(' + chart.tp[riGong] + ')' });
  }

  // 场景用神 vs 日干
  if (scene && sceneGongs[scene]) {
    const ysGong = sceneGongs[scene].yongShen;
    if (ysGong > 0 && riGong > 0 && ysGong !== riGong) {
      const wx1 = wxMap[chart.tp[ysGong]] || '';
      const wx2 = wxMap[chart.tp[riGong]] || '';
      let relation = null;
      if (WX_SHENG[wx1] === wx2) relation = '生';
      else if (WX_KE[wx1] === wx2) relation = '克';
      else if (wx1 === wx2) relation = '比和';
      if (relation) combos.push({ type: relation, from: ysGong, to: riGong, desc: sceneGongs[scene].label + gongName[ysGong] + '(' + chart.tp[ysGong] + ') ' + relation + ' 日干' + gongName[riGong] + '(' + chart.tp[riGong] + ')' });
    }
  }

  return combos;
}

module.exports = {
  TG, DZ, LIUYI, XING, MEN, SHEN, GUA, GUAWX, DIR, DIREN,
  JQTBL, JQJU, YANGJQ, XXUN, XKONG, SHICHEN, XDUN,
  ZHUA_GONG_ORDER, MEN_SEQUENCE, XING_SEQUENCE,
  getShiChenIndex, shiChenToDZ, z2G, getMa, gXun, jq, jqDate,
  yGZ, mGZ, dGZ, hGZ, mGZDate, dGZDate,
  getJu, getJuDate, diPan, tiPan, jXing, bMen, bShen,
  detectGeJu, cFuxin, cFanin, cQing, cFei, cTianw, cYunv, cGeng,
  cSanz, cWuji, cTiany, cYiqi, cZhuq, cBaih, cTengs, cYunvs,
  paipan, paipanLegacy, calcNianMing, getNianMingGong, getSiGan,
  calculateWangShuai, analyzePalaceRelations, analyzePalaceCombinations,
  WX_SHENG, WX_KE, MONTH_WX
};
