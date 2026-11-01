#!/usr/bin/env node
/* QiMen Dunjia MCP server (stdio) — local, pure calculation, zero LLM calls.
 *
 * Reads JSON-RPC 2.0 (MCP protocol 2025-06-18) messages from stdin, one per
 * line; writes responses to stdout. Implements: initialize, tools/list,
 * tools/call, ping, notifications/initialized (ack only).
 *
 * Exposes one tool:
 *   qimen_pan — cast a Qimen Dunjia chart via the engine in ../src.
 *
 * A hosted version with MORE tools (bazi_chart, rule-based readings in
 * zh/en) runs at https://qimenseek.aicreditsapi.com/mcp — see ../README.md.
 *
 * Run:  node mcp/stdio-server.js
 */
'use strict';
const path = require('path');
const readline = require('readline');
const qimen = require(path.join(__dirname, '..', 'src'));

const PROTOCOL_VERSION = '2025-06-18';

/* ---------- chart compaction (defensive: open-source engine fields) ---------- */
function compactQimen(c) {
  return {
    meta: {
      juType: c.juType, juNum: c.juNum, isYang: c.isYang, jieqi: c.jieqi,
      method: c.method, pan: c.pan, xun: c.xun, kong: c.kong,
      year: c.ygz, month: c.mgz, day: c.dgz, hour: c.hgz,
      zhiFu: c.zhiFuXing + ' 落' + c.zhiFuGong + '宫',
      zhiShi: c.zhiShiMen + ' 落' + c.zhiShiGong + '宫',
      maGong: c.maGong
    },
    heavenStems: c.tp, earthStems: c.dp, gates: c.men,
    stars: c.xing, deities: c.shen,
    hiddenGans: c.dunGan || c.anGan || null,
    kongGongs: c.kongGongs,
    geju: (c.geju || []).map(function (g) {
      return { name: g.name, desc: (g.desc || '').slice(0, 120) };
    })
  };
}

/* ---------- tools ---------- */
const TOOLS = [
  {
    name: 'qimen_pan',
    title: 'Qimen Dunjia Chart',
    description:
      'Cast a Qimen Dunjia (奇门遁甲) chart for a given date and time. ' +
      'Deterministic rotating-plate engine: hour-based method with Chaibu (拆补), ' +
      'Zhirun (置闰) or Shen Jie Qi (超神接气) ju determination. Returns the nine-palace ' +
      'plate (heaven/earth stems, 8 gates, 9 stars, 8 deities), ruling star and ruling ' +
      'gate, void palaces and detected formations. Pure calculation — no AI, no network. ' +
      'A hosted sibling at https://qimenseek.aicreditsapi.com/mcp adds BaZi charts and ' +
      'rule-based readings.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Solar date, YYYY-MM-DD' },
        time: { type: 'string', description: '24h time, HH:MM' },
        method: {
          type: 'string',
          enum: ['chaibu', 'zhirun', 'shenjieqi'],
          description: 'Ju-setting method. Default chaibu.'
        }
      },
      required: ['date', 'time']
    },
    run: function (args) {
      const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(args.date || ''));
      const t = /^(\d{1,2}):(\d{1,2})$/.exec(String(args.time || ''));
      if (!m || !t) return Promise.reject(new Error('date must be YYYY-MM-DD and time must be HH:MM'));
      const method = ['zhirun', 'shenjieqi'].indexOf(args.method) >= 0 ? args.method : 'chaibu';
      const chart = qimen.paipan(
        +m[1], +m[2], +m[3], +t[1], +t[2], method
      );
      return Promise.resolve(compactQimen(chart));
    }
  }
];

/* ---------- JSON-RPC dispatch ---------- */
function rpc(msg) {
  const method = msg && msg.method;
  if (method === 'initialize') {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'qimen-dunjia-mcp', version: '1.0.0' }
    };
  }
  if (method === 'ping') return {};
  if (method === 'tools/list') {
    return {
      tools: TOOLS.map(function (t) {
        return {
          name: t.name, title: t.title, description: t.description,
          inputSchema: t.inputSchema
        };
      })
    };
  }
  if (method === 'tools/call') {
    const tool = TOOLS.filter(function (t) { return t.name === msg.params.name; })[0];
    if (!tool) {
      return { isError: true, content: [{ type: 'text', text: 'unknown tool: ' + msg.params.name }] };
    }
    return tool.run(msg.params.arguments || {}).then(function (data) {
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }, function (err) {
      return { isError: true, content: [{ type: 'text', text: String(err && err.message || err) }] };
    });
  }
  if (method && method.indexOf('notifications/') === 0) return undefined; // no reply
  return Promise.reject(new Error('method not found: ' + method));
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', function (line) {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch (e) { return; }
  if (!msg || msg.id === undefined) { rpc(msg); return; } // notification
  Promise.resolve()
    .then(function () { return rpc(msg); })
    .then(function (result) {
      if (result === undefined) return;
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: result }) + '\n');
    })
    .catch(function (err) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        error: { code: -32603, message: String(err && err.message || err) }
      }) + '\n');
    });
});
