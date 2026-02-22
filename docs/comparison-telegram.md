# claude-code-server vs claude-code-telegram

เปรียบเทียบ 2 วิธี wrap Claude Code CLI เป็น bot/API server

## Architecture

| | claude-code-server | claude-code-telegram |
|---|---|---|
| **Runtime** | Bun + Hono | Python 3.10+ / Poetry |
| **Protocol** | REST API + SSE | Telegram Bot API |
| **วิธีเรียก Claude CLI** | `@anthropic-ai/claude-agent-sdk` (TypeScript) | `claude-agent-sdk` (Python) |
| **SDK mode** | `query()` AsyncGenerator (structured JSON streaming) | `ClaudeSDKClient` async generator (structured JSON streaming) |
| **Docker** | 1 service | 1 service |
| **Port** | 4096 | ไม่มี (Telegram polling/webhook) |

## วิธีเรียก Claude CLI — คล้ายกัน!

ทั้งคู่ใช้ **Claude Agent SDK** wrap Claude Code CLI ด้วย structured JSON streaming — ต่างกันแค่ภาษา

### claude-code-server — TypeScript SDK

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk"

const q = query({
  prompt,
  options: {
    cwd: "/workspace",
    model: "sonnet",
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    includePartialMessages: true,
    resume: sessionId,
    abortController,
  },
})

for await (const msg of q) {
  // msg.type: "system" | "assistant" | "user" | "stream_event" | "result"
  // → publish SSE events
}
```

### claude-code-telegram — Python SDK

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

options = ClaudeAgentOptions(
    cwd="/workspace",
    max_turns=10,
    allowed_tools=["Read", "Write", "Bash"],
    sandbox={"enabled": True},
    cli_path=cli_path,
)

async with ClaudeSDKClient(options) as client:
    await client.query(prompt)
    async for raw_data in client._query.receive_messages():
        message = parse_message(raw_data)
        # AssistantMessage, UserMessage, ResultMessage
```

## Concept

| | claude-code-server | claude-code-telegram |
|---|---|---|
| **Complexity** | ~480 lines, 4 files | ~2000+ lines, dozens of files |
| **Use case** | API สำหรับ bot/app อื่นเรียกใช้ | Telegram bot สำหรับ user ใช้ตรง |
| **Client** | LINE bot, curl, web app | Telegram (user พิมพ์ใน chat) |
| **Streaming** | SSE events (`GET /event`) | อัพเดทใน Telegram ระหว่างทำ |
| **Session storage** | In-memory Map | SQLite persistent |
| **Session resume** | SDK `options.resume` | SDK `options.resume` + auto-resume per user+directory |
| **Message history** | In-memory (`GET /session/:id/message`) | SQLite persistent |
| **Tool approval** | Auto-approve (`bypassPermissions`) | `allowed_tools` allowlist + `ToolMonitor` validation |
| **Auth** | Optional Bearer/Basic | Telegram user whitelist + token auth |
| **Security** | 1 ชั้น (API password) | 5 ชั้น (auth → directory isolation → input validation → rate limit → audit log) |
| **Cost tracking** | Per-response + per-session (in-memory) | Per-response + per-session (SQLite persistent) |
| **Multi-user** | ไม่มี user concept | มี — per-user sessions, limits, permissions |
| **Multi-project** | `x-opencode-directory` header | Per-user project directories + topic routing |
| **Event system** | Simple pub/sub (events.ts) | EventBus (async pub/sub) |
| **Webhook** | ไม่มี | มี — FastAPI server รับ GitHub webhook → trigger Claude |
| **Scheduler** | ไม่มี | มี — APScheduler cron jobs |
| **MCP support** | ไม่มี | มี — load MCP server config |

## Feature Comparison

| Feature | claude-code-server | claude-code-telegram |
|---------|:---:|:---:|
| Stateless query | O | - |
| Session create/delete | O | O (auto) |
| Session resume | O | O (auto per user+dir) |
| Session abort | O | - |
| Session detail | O | O |
| Message history | O | O |
| Model selection | O (per-request) | O (config) |
| SSE streaming | O | - (Telegram updates instead) |
| Streaming text deltas | O | O |
| Tool status events | O | O |
| Event bus | O (simple) | O (full async pub/sub) |
| Tool monitoring | - | O |
| Tool validation | - | O |
| Rate limiting | - | O |
| Input sanitization | - | O |
| Audit logging | - | O |
| Cost persistence | - | O (SQLite) |
| Multi-user | - | O |
| Multi-project | O (directory header) | O (per-user dirs) |
| Webhook triggers | - | O |
| Scheduled tasks | - | O |
| MCP servers | - | O |
| Health check | O | - |
| Model list API | O | - |

## Tech Stack

| | claude-code-server | claude-code-telegram |
|---|---|---|
| **Language** | TypeScript | Python 3.10+ |
| **Package manager** | Bun | Poetry |
| **HTTP framework** | Hono | FastAPI (webhook API) |
| **Bot framework** | ไม่มี (pure API) | python-telegram-bot |
| **Claude integration** | `@anthropic-ai/claude-agent-sdk` (TS) | `claude-agent-sdk` (Python) |
| **Claude CLI install** | ไม่ต้อง (SDK bundle) | ต้องลงแยก (`npm install -g`) |
| **Database** | ไม่มี (in-memory) | SQLite (aiosqlite) |
| **Logging** | console.log | structlog (JSON) |
| **Config** | env vars | Pydantic Settings v2 |
| **Dependencies** | 2 packages | 10+ packages |

## เปรียบเทียบแบบง่าย

```
claude-code-server = "ตู้โทรศัพท์ + จอ LED"
  รับ prompt → SSE stream progress → return JSON
  เหมาะกับ: bot backend, automation, programmatic access
  ข้อดี: ง่าย, เบา, SSE streaming, multi-project, deploy เร็ว
  ข้อเสีย: ไม่มี security layers, ไม่มี user management, ไม่มี persistence

claude-code-telegram = "สำนักงาน full-stack"
  Telegram → Security 5 ชั้น → Claude SDK streaming → SQLite → Telegram
  เหมาะกับ: production Telegram bot, multi-user, enterprise
  ข้อดี: security, streaming, persistence, multi-user, webhook, scheduler
  ข้อเสีย: ซับซ้อน, Python ecosystem, deploy ยากกว่า
```

## เลือกใช้อันไหน?

**claude-code-server** เหมาะกับ:
- ต้องการ API ง่ายๆ ให้ client อื่นเรียกใช้ พร้อม streaming
- สร้าง LINE bot / Discord bot ที่เรียก Claude ผ่าน HTTP + SSE
- Prototype / MVP ที่ต้องการ deploy เร็ว
- Automation / CI/CD pipeline
- ไม่ต้องการ user management หรือ security ซับซ้อน

**claude-code-telegram** เหมาะกับ:
- ต้องการ Telegram bot สำเร็จรูปที่ใช้งานได้เลย
- ต้องการ multi-user + per-user sessions
- ต้องการ security layers (auth, rate limit, audit)
- ต้องการ persistent storage (cost tracking, audit log)
- ต้องการ webhook integration (GitHub → Claude)

## ใช้ร่วมกันได้

```
claude-code-server (port 4096) — API สำหรับ bot/app อื่นๆ
claude-code-telegram — Telegram bot สำหรับ user ใช้ตรง
```

ทั้งคู่ใช้ Claude Agent SDK เหมือนกัน — ต่างแค่ภาษา:
- claude-code-server: TypeScript SDK (`@anthropic-ai/claude-agent-sdk`)
- claude-code-telegram: Python SDK (`claude-agent-sdk`)

## Links

- [claude-code-server](https://github.com/monthop-gmail/claude-code-server)
- [claude-code-telegram](https://github.com/RichardAtCT/claude-code-telegram)
- [claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
