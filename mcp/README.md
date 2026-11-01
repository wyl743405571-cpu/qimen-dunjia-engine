# MCP server

Model Context Protocol access to the QiMen Dunjia engine — for Claude Desktop,
Cursor, and any MCP client.

## Option A — hosted endpoint (recommended, zero install)

The live site runs a streamable-HTTP MCP server with the full tool set:

```
https://qimenseek.aicreditsapi.com/mcp
```

- Protocol: MCP `2025-06-18` (JSON-RPC 2.0, stateless streamable HTTP)
- Tools: `qimen_pan` (chart + rule-based reading), `bazi_chart` (Four Pillars,
  ten gods, strength evidence chain, useful gods, luck pillars — zh/en)
- Free, no auth, rate limit 60 requests/hour/IP, zero LLM calls
- Docs with curl examples: <https://qimenseek.aicreditsapi.com/mcp.html>

Quick check:

```bash
curl -X POST https://qimenseek.aicreditsapi.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
```

## Option B — local stdio server (this repo, pure offline)

Runs the engine from [`../src`](../src) directly. Offline, no network, no
rate limit — but only the Qimen tool (the hosted server additionally serves
`bazi_chart` and rule-based readings).

```bash
git clone https://github.com/wyl743405571-cpu/qimen-dunjia-engine.git
cd qimen-dunjia-engine && npm install
node mcp/stdio-server.js
```

Point your MCP client at the command above. For a manual smoke test:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}' | node mcp/stdio-server.js
```

### Tool: `qimen_pan`

| Argument | Type | Notes |
|---|---|---|
| `date` | string, required | Solar date `YYYY-MM-DD` |
| `time` | string, required | 24h `HH:MM` |
| `method` | string | `chaibu` (default) \| `zhirun` \| `shenjieqi` |

Returns compacted plate: bureau (`juType`/`juNum`), ganzhi for the four
pillars, ruling star/gate with palaces, heaven/earth stems, gates, stars,
deities, hidden stems, void palaces, horse palace and detected formations.

The same numbers every run — the engine is deterministic and its validation
sweep (44,064 charts, 0 crashes) is reproducible from [`../verify`](../verify).
