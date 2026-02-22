# claude-code-server vs opencode-server

เปรียบเทียบ concept ระหว่าง 2 API server สำหรับ AI coding

## Architecture

| | claude-code-server | opencode-server |
|---|---|---|
| **Runtime** | Bun + Hono | Node.js + Hono |
| **AI Engine** | Claude Code CLI (subprocess) | OpenCode built-in (native) |
| **วิธีเรียก AI** | `Bun.spawn(["claude", "-p", ...])` | เรียก function ตรง (in-process) |
| **Docker** | 1 service | 1 service |
| **Default Port** | 4096 | 4096 |

## API Endpoints

| Endpoint | claude-code-server | opencode-server |
|----------|:---:|:---:|
| `POST /query` (stateless) | O | - |
| `POST /session` | O | O |
| `GET /session` | O | O |
| `POST /session/:id/message` | O | O |
| `POST /session/:id/abort` | O | O |
| `DELETE /session/:id` | O | O |
| `GET /session/:id/message` | - | O |
| `PATCH /session/:id` | - | O |
| `POST /session/:id/fork` | - | O |
| `POST /session/:id/share` | - | O |
| `POST /session/:id/summarize` | - | O |
| `POST /session/:id/revert` | - | O |
| `GET /models` | O | - |
| `GET /health` | O | O |
| `GET /event` (SSE) | - | O |
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
| **Complexity** | ~200 lines, 3 files | ~2000+ lines, dozens of files |
| **Session state** | In-memory Map | Persistent (SQLite/file) |
| **Streaming** | ไม่มี — รอ process จบ | มี — SSE real-time events |
| **Tool use** | Claude CLI จัดการภายใน subprocess | OpenCode จัดการ + report ผ่าน SSE |
| **Multi-provider** | Anthropic only (แก้ env ได้) | Multi-provider (OpenAI, DeepSeek, Google, etc.) |
| **Auth** | Optional Bearer/Basic | Basic auth (username:password) |
| **Message format** | `{ prompt: "..." }` text only | `{ parts: [{ type, text }] }` multi-part |
| **Response format** | `{ result, cost_usd, duration_ms }` | Streaming JSON + SSE events |
| **File operations** | ไม่มี API (CLI ทำใน subprocess) | มี `/file` API |
| **Terminal** | ไม่มี | มี `/pty` API |
| **Project context** | `WORKSPACE_DIR` env (single project) | `x-opencode-directory` header (multi-project) |
| **Cost tracking** | Per-response + per-session | ไม่มี built-in |

## เปรียบเทียบแบบง่าย

```
claude-code-server = "ตู้โทรศัพท์"
  ส่ง prompt เข้า → รอ → ได้คำตอบออกมา
  ง่าย, เบา, ทำงานได้เลย

opencode-server = "สำนักงานเต็มรูปแบบ"
  session, streaming, file management, terminal,
  multi-provider, project management, MCP, sharing
  ซับซ้อน, ครบครัน, enterprise-grade
```

## เลือกใช้อันไหน?

**claude-code-server** เหมาะกับ:
- ต้องการ API ง่ายๆ ครอบ Claude Code
- ให้ client อื่น (LINE bot, web app) เรียกใช้ได้
- Prototype / MVP ที่ไม่ต้องการฟีเจอร์เยอะ
- ใช้ Anthropic API เป็นหลัก

**opencode-server** เหมาะกับ:
- ต้องการ full-featured AI coding platform
- ต้องการ streaming, file management, terminal
- ต้องการ multi-provider (OpenAI, DeepSeek, Google, etc.)
- ต้องการ persistent sessions, sharing, forking
- Production / enterprise use case

## Links

- [claude-code-server](https://github.com/monthop-gmail/claude-code-server)
- [opencode](https://github.com/AnomalyCo/opencode)
- [claude-cli-rest-api](https://github.com/bryankthompson/claude-cli-rest-api) — Python FastAPI reference
