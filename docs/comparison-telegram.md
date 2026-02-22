# claude-code-server vs claude-code-telegram

เปรียบเทียบ 2 วิธี wrap Claude Code CLI เป็น bot/API server

## Architecture

| | claude-code-server | claude-code-telegram |
|---|---|---|
| **Runtime** | Bun + Hono | Python 3.10+ / Poetry |
| **Protocol** | REST API (HTTP JSON) | Telegram Bot API |
| **วิธีเรียก Claude CLI** | `Bun.spawn(["claude", "-p", ...])` one-shot | `claude-agent-sdk` → spawn `claude` (JSON streaming) |
| **CLI mode** | `-p` flag (non-interactive, JSON output) | SDK streaming mode (structured JSON over stdio) |
| **Docker** | 1 service | 1 service |
| **Port** | 4096 | ไม่มี (Telegram polling/webhook) |

## วิธีเรียก Claude CLI — ต่างกัน

### claude-code-server — spawn -p (one-shot)

```
Client: POST /query { prompt: "hello" }
Server: Bun.spawn(["claude", "-p", "hello", "--output-format", "json"])
Server: รอ process จบ → parse JSON → return result
Client: ได้ { result: "...", cost_usd: 0.001 }
```

- ทุก request = spawn process ใหม่
- ไม่มี streaming ระหว่างรอ
- ได้ structured JSON ก้อนเดียว (result, cost, session_id)
- ใช้ `--dangerously-skip-permissions` (auto-approve)

### claude-code-telegram — claude-agent-sdk (JSON streaming)

```
User: ส่งข้อความใน Telegram
Bot: ClaudeSDKClient(options) → spawn "claude" process
Bot: client.query(prompt)
Bot: async for message in receive_messages():
       → AssistantMessage (text + tool calls)
       → UserMessage (tool results)
       → ResultMessage (final result + cost + session_id)
User: ได้คำตอบใน Telegram (stream ระหว่างทำได้)
```

- SDK spawn `claude` process ใน JSON streaming mode (ไม่ใช่ -p)
- Structured messages ทีละก้อน (AssistantMessage, ToolUseBlock, ResultMessage)
- Streaming callback — อัพเดทผ่าน Telegram ระหว่างทำงาน
- Tool validation 2 ชั้น (SDK `allowed_tools` + app `ToolMonitor`)

## Concept

| | claude-code-server | claude-code-telegram |
|---|---|---|
| **Complexity** | ~200 lines, 3 files | ~2000+ lines, dozens of files |
| **Use case** | API สำหรับ bot/app อื่นเรียกใช้ | Telegram bot สำหรับ user ใช้ตรง |
| **Client** | LINE bot, curl, web app | Telegram (user พิมพ์ใน chat) |
| **Streaming** | ไม่มี — รอ process จบ | มี — อัพเดทใน Telegram ระหว่างทำ |
| **Session storage** | In-memory Map | SQLite persistent |
| **Session resume** | `--resume` flag ใน CLI | SDK `options.resume` + auto-resume per user+directory |
| **Tool approval** | Auto-approve ทั้งหมด | `allowed_tools` allowlist + `ToolMonitor` validation |
| **Auth** | Optional Bearer/Basic | Telegram user whitelist + token auth |
| **Security** | 1 ชั้น (API password) | 5 ชั้น (auth → directory isolation → input validation → rate limit → audit log) |
| **Cost tracking** | Per-response + per-session (in-memory) | Per-response + per-session (SQLite persistent) |
| **Multi-user** | ไม่มี user concept | มี — per-user sessions, limits, permissions |
| **Multi-project** | `WORKSPACE_DIR` env (single project) | Per-user project directories + topic routing |
| **Webhook** | ไม่มี | มี — FastAPI server รับ GitHub webhook → trigger Claude |
| **Event system** | ไม่มี | มี — EventBus (async pub/sub) |
| **Scheduler** | ไม่มี | มี — APScheduler cron jobs |
| **MCP support** | ไม่มี | มี — load MCP server config |

## Feature Comparison

| Feature | claude-code-server | claude-code-telegram |
|---------|:---:|:---:|
| Stateless query | O | - |
| Session create/delete | O | O (auto) |
| Session resume | O | O (auto per user+dir) |
| Session abort | O | - |
| Model selection | O (per-request) | O (config) |
| Streaming updates | - | O |
| Tool monitoring | - | O |
| Tool validation | - | O |
| Rate limiting | - | O |
| Input sanitization | - | O |
| Audit logging | - | O |
| Cost persistence | - | O (SQLite) |
| Multi-user | - | O |
| Multi-project | - | O |
| Webhook triggers | - | O |
| Scheduled tasks | - | O |
| MCP servers | - | O |
| Health check | O | - |
| Model list API | O | - |

## เปรียบเทียบแบบง่าย

```
claude-code-server = "ตู้โทรศัพท์"
  รับ prompt → ส่งให้ Claude → รอ → return JSON
  เหมาะกับ: bot backend, automation, programmatic access
  ข้อดี: ง่าย, เบา, structured output, deploy เร็ว
  ข้อเสีย: ไม่มี streaming, ไม่มี security layers, ไม่มี user management

claude-code-telegram = "สำนักงาน full-stack"
  Telegram → Security 5 ชั้น → Claude SDK streaming → SQLite → Telegram
  เหมาะกับ: production Telegram bot, multi-user, enterprise
  ข้อดี: security, streaming, persistence, multi-user, webhook, scheduler
  ข้อเสีย: ซับซ้อน, Python ecosystem, deploy ยากกว่า
```

## Tech Stack

| | claude-code-server | claude-code-telegram |
|---|---|---|
| **Language** | TypeScript | Python 3.10+ |
| **Package manager** | Bun | Poetry |
| **HTTP framework** | Hono | FastAPI (webhook API) |
| **Bot framework** | ไม่มี (pure API) | python-telegram-bot |
| **Claude integration** | CLI spawn (`Bun.spawn`) | claude-agent-sdk (`ClaudeSDKClient`) |
| **Database** | ไม่มี (in-memory) | SQLite (aiosqlite) |
| **Logging** | console.log | structlog (JSON) |
| **Config** | env vars | Pydantic Settings v2 |
| **Dependencies** | 1 package (hono) | 10+ packages |

## เลือกใช้อันไหน?

**claude-code-server** เหมาะกับ:
- ต้องการ API ง่ายๆ ให้ client อื่นเรียกใช้
- สร้าง LINE bot / Discord bot ที่เรียก Claude ผ่าน HTTP
- Prototype / MVP ที่ต้องการ deploy เร็ว
- Automation / CI/CD pipeline
- ไม่ต้องการ user management หรือ security ซับซ้อน

**claude-code-telegram** เหมาะกับ:
- ต้องการ Telegram bot สำเร็จรูปที่ใช้งานได้เลย
- ต้องการ multi-user + per-user sessions
- ต้องการ security layers (auth, rate limit, audit)
- ต้องการ streaming updates ระหว่าง Claude ทำงาน
- ต้องการ persistent storage (cost tracking, audit log)
- ต้องการ webhook integration (GitHub → Claude)

## ใช้ร่วมกันได้

```
claude-code-server (port 4096) — API สำหรับ bot/app อื่นๆ
claude-code-telegram — Telegram bot สำหรับ user ใช้ตรง
```

ทั้งคู่ใช้ Claude Code CLI เหมือนกัน — ต่างกันแค่วิธี wrap:
- claude-code-server: spawn `-p` (one-shot, simple)
- claude-code-telegram: `claude-agent-sdk` (streaming, feature-rich)

## Links

- [claude-code-server](https://github.com/monthop-gmail/claude-code-server)
- [claude-code-telegram](https://github.com/RichardAtCT/claude-code-telegram)
