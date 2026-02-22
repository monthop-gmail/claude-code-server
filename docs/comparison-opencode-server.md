# claude-code-server vs opencode-server

เปรียบเทียบ concept ระหว่าง 2 API server สำหรับ AI coding

## Architecture

| | claude-code-server | opencode-server |
|---|---|---|
| **Runtime** | Bun + Hono | Node.js + Hono |
| **AI Engine** | Claude Agent SDK → Claude Code CLI (bundled) | OpenCode built-in (native) |
| **วิธีเรียก AI** | `query()` จาก `@anthropic-ai/claude-agent-sdk` (AsyncGenerator) | เรียก function ตรง (in-process) |
| **Streaming** | SSE via event bus (`GET /event`) | SSE via event bus (`GET /event`) |
| **Docker** | 1 service | 1 service |
| **Default Port** | 4096 | 4096 |

## API Endpoints

| Endpoint | claude-code-server | opencode-server |
|----------|:---:|:---:|
| `GET /event` (SSE) | O | O |
| `POST /query` (stateless) | O | - |
| `POST /session` | O | O |
| `GET /session` | O | O |
| `GET /session/:id` | O | O |
| `GET /session/:id/message` | O | O |
| `POST /session/:id/message` | O | O |
| `POST /session/:id/abort` | O | O |
| `DELETE /session/:id` | O | O |
| `PATCH /session/:id` | - | O |
| `POST /session/:id/fork` | - | O |
| `POST /session/:id/share` | - | O |
| `POST /session/:id/summarize` | - | O |
| `POST /session/:id/revert` | - | O |
| `GET /models` | O | - |
| `GET /health` | O | O |
| `/project/*` | - | O |
| `/pty/*` | - | O |
| `/file/*` | - | O |
| `/config/*` | - | O |
| `/provider/*` | - | O |
| `/mcp/*` | - | O |
| `/permission/*` | - | O |

## Concept

| | claude-code-server | opencode-server |
|---|---|---|
| **Complexity** | ~480 lines, 4 files | ~2000+ lines, dozens of files |
| **Session state** | In-memory Map (with message history) | Persistent (SQLite/file) |
| **Streaming** | SSE — real-time events (message, tool, delta) | SSE — real-time events (message, tool, delta) |
| **Tool use** | Claude Agent SDK จัดการ + report ผ่าน SSE | OpenCode จัดการ + report ผ่าน SSE |
| **Multi-provider** | Anthropic only (แก้ env ได้) | Multi-provider (OpenAI, DeepSeek, Google, etc.) |
| **Auth** | Optional Bearer/Basic | Basic auth (username:password) |
| **Message format** | `{ prompt: "..." }` text only | `{ parts: [{ type, text }] }` multi-part |
| **Response format** | `{ result, cost_usd, duration_ms }` + SSE events | Streaming JSON + SSE events |
| **File operations** | ไม่มี API (Claude Code ทำผ่าน SDK) | มี `/file` API |
| **Terminal** | ไม่มี | มี `/pty` API |
| **Project context** | `x-opencode-directory` header (multi-project) | `x-opencode-directory` header (multi-project) |
| **Cost tracking** | Per-response + per-session | ไม่มี built-in |

## SSE Events

| Event | claude-code-server | opencode-server |
|-------|:---:|:---:|
| `server.connected` | O | O |
| `server.heartbeat` | O | O |
| `session.created` | O | O |
| `session.updated` | O | O |
| `session.deleted` | O | O |
| `message.updated` | O | O |
| `message.part.updated` | O | O |
| `message.part.delta` | O | O |
| `session.error` | - | O |
| `permission.asked` | - | O |
| `question.asked` | - | O |

## เปรียบเทียบแบบง่าย

```
claude-code-server = "ตู้โทรศัพท์ + จอ LED"
  ส่ง prompt → เห็น progress real-time (SSE) → ได้คำตอบ
  ง่าย, เบา, SSE streaming, multi-project
  ทำงานได้ทันที

opencode-server = "สำนักงานเต็มรูปแบบ"
  session, streaming, file management, terminal,
  multi-provider, project management, MCP, sharing
  ซับซ้อน, ครบครัน, enterprise-grade
```

## เลือกใช้อันไหน?

**claude-code-server** เหมาะกับ:
- ต้องการ API ง่ายๆ ครอบ Claude Code พร้อม streaming
- ให้ client อื่น (LINE bot, web app) เรียกใช้ได้
- ต้องการ SSE real-time events แต่ไม่ต้องการ feature เยอะ
- ใช้ Anthropic API เป็นหลัก
- Prototype / MVP ที่ deploy เร็ว

**opencode-server** เหมาะกับ:
- ต้องการ full-featured AI coding platform
- ต้องการ file management, terminal, MCP
- ต้องการ multi-provider (OpenAI, DeepSeek, Google, etc.)
- ต้องการ persistent sessions, sharing, forking
- Production / enterprise use case

## Links

- [claude-code-server](https://github.com/monthop-gmail/claude-code-server)
- [opencode](https://github.com/AnomalyCo/opencode)
- [claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) — Official Claude Agent SDK
