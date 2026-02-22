# claude-code-server vs claude-code-web-terminal (backend)

เปรียบเทียบ 2 วิธี wrap Claude Code CLI เป็น server

## Architecture

| | claude-code-server | claude-code-web-terminal |
|---|---|---|
| **Runtime** | Bun + Hono | Node.js + Express |
| **Protocol** | REST API + SSE | WebSocket + REST API |
| **วิธีเรียก Claude** | Claude Agent SDK `query()` (JSON streaming) | `pty.spawn("claude", [])` interactive PTY |
| **Claude mode** | SDK streaming mode (structured JSON over stdio) | Interactive (full terminal) |
| **Streaming** | SSE (`GET /event`) | WebSocket (real-time) |
| **Docker** | 1 service | 1 service |
| **Port** | 4096 | 3000 |

## วิธีเรียก Claude CLI — ต่างกัน

### claude-code-server — Agent SDK (JSON streaming)

```
Client: POST /query { prompt: "hello" }
Server: query({ prompt, options: { cwd, model, permissionMode, ... } })
Server: for await (const msg of q) {
          "system"       → session_id
          "assistant"    → text + tool calls → publish SSE event
          "stream_event" → text delta        → publish SSE event
          "result"       → final result, cost
        }
Client: ได้ { result: "สวัสดี", cost_usd: 0.001 }
        + SSE events ระหว่างทำ (ถ้า connect GET /event)
```

- SDK spawn bundled `cli.js` เป็น subprocess อัตโนมัติ
- Streaming structured messages ผ่าน AsyncGenerator
- ได้ typed message objects (AssistantMessage, ToolUseBlock, ResultMessage)
- ใช้ `permissionMode: "bypassPermissions"` (auto-approve)

### claude-code-web-terminal — PTY (interactive)

```
Client: WebSocket connect → { type: "join", sessionId: "abc" }
Server: pty.spawn("claude", []) → สร้าง pseudo-terminal
Server: claude output → WebSocket broadcast → Client (xterm.js)
Client: พิมพ์ข้อความ → { type: "input", data: "hello\r" }
Server: pty.write("hello\r") → claude ได้รับ input
```

- 1 session = 1 PTY process (ยังเปิดอยู่ตลอด)
- Streaming real-time ผ่าน WebSocket
- ได้ raw terminal output (สี, cursor, ANSI codes)
- User approve/reject tool use ได้เอง

## API Endpoints

| Endpoint | claude-code-server | web-terminal |
|----------|:---:|:---:|
| `GET /health` | O | O |
| `GET /event` (SSE) | O | - |
| `POST /query` (stateless) | O | - |
| `GET /models` | O | - |
| `POST /session` (create) | O | O |
| `GET /session` (list) | O | O |
| `GET /session/:id` | O | - |
| `GET /session/:id/message` | O | - |
| `POST /session/:id/message` | O | - |
| `POST /session/:id/abort` | O | - |
| `DELETE /session/:id` | O | O |
| WebSocket `join` | - | O |
| WebSocket `input` | - | O |
| WebSocket `resize` | - | O |
| WebSocket `signal` (Ctrl+C) | - | O |

## Concept

| | claude-code-server | web-terminal |
|---|---|---|
| **Use case** | API สำหรับ bot/app เรียกใช้ | Web UI สำหรับคนใช้ตรง |
| **Client** | LINE bot, curl, web app | Browser (xterm.js) |
| **Streaming** | SSE — structured events (message, tool, delta) | WebSocket — raw terminal output |
| **Tool approval** | Auto-approve (`bypassPermissions`) | User approve ใน terminal ได้ |
| **Output format** | JSON `{ result, cost }` + typed SSE events | Raw terminal (ANSI escape codes) |
| **Session lifecycle** | สร้าง/ส่ง prompt/ลบ ผ่าน REST | สร้าง ผ่าน REST, ใช้งาน ผ่าน WebSocket |
| **Multi-client** | SSE broadcast ไปทุก subscriber | WebSocket broadcast ไปทุก client |
| **Terminal resize** | ไม่มี (ไม่ใช่ terminal) | มี — `pty.resize(cols, rows)` |
| **Ctrl+C / signals** | `AbortController.abort()` ผ่าน `/abort` | `pty.write('\x03')` ผ่าน WebSocket |
| **Cost tracking** | มี (SDK ResultMessage) | ไม่มี (raw terminal ไม่มี structured data) |
| **Message history** | มี (`GET /session/:id/message`) | ไม่มี |
| **Multi-project** | `x-opencode-directory` header | ไม่มี |
| **Auth** | Optional Bearer/Basic | ไม่มี |
| **Dependencies** | `hono`, `@anthropic-ai/claude-agent-sdk` (2 packages) | `express`, `ws`, `node-pty`, `cors`, `uuid` (5 packages) |

## เปรียบเทียบแบบง่าย

```
claude-code-server = "API Gateway + จอ LED"
  รับ prompt → ส่งให้ Claude → SSE stream progress → return JSON
  เหมาะกับ: bot, automation, programmatic access
  ข้อดี: structured output, SSE streaming, cost tracking, multi-project
  ข้อเสีย: ไม่มี interactive terminal

claude-code-web-terminal = "Remote Desktop"
  เปิด terminal จริง → user พิมพ์ได้เลย
  เหมาะกับ: web UI, interactive coding
  ข้อดี: real-time, interactive, tool approval
  ข้อเสีย: ไม่มี structured output, ไม่มี cost tracking
```

## เลือกใช้อันไหน?

**claude-code-server** เหมาะกับ:
- สร้าง LINE bot / Discord bot / Slack bot
- Automation / CI/CD pipeline
- ต้องการ structured JSON response + SSE streaming
- ต้องการ cost tracking + message history
- Client ไม่ต้องการ interactive terminal

**claude-code-web-terminal** เหมาะกับ:
- สร้าง web-based Claude Code IDE
- ต้องการเห็น output real-time แบบ terminal
- ต้องการ approve/reject tool use
- ต้องการ full terminal experience ใน browser

## ใช้ร่วมกันได้

สามารถรันทั้ง 2 ตัวพร้อมกัน:
- `claude-code-server` (port 4096) — สำหรับ bot/API clients + SSE streaming
- `claude-code-web-terminal` (port 3000) — สำหรับ web UI + interactive terminal

## Links

- [claude-code-server](https://github.com/monthop-gmail/claude-code-server)
- [claude-code-web-terminal](https://github.com/monthop-gmail/claude-code-web-terminal)
