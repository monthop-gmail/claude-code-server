# claude-code-server vs claude-code-web-terminal (backend)

เปรียบเทียบ 2 วิธี wrap Claude Code CLI เป็น server

## Architecture

| | claude-code-server | claude-code-web-terminal |
|---|---|---|
| **Runtime** | Bun + Hono | Node.js + Express |
| **Protocol** | REST API (HTTP JSON) | WebSocket + REST API |
| **วิธีเรียก Claude** | `Bun.spawn(["claude", "-p", ...])` non-interactive | `pty.spawn("claude", [])` interactive PTY |
| **Claude mode** | `-p` flag (one-shot, JSON output) | Interactive (full terminal) |
| **Docker** | 1 service | 1 service |
| **Port** | 4096 | 3000 |

## วิธีเรียก Claude CLI — ต่างกันมาก

### claude-code-server — spawn -p (non-interactive)

```
Client: POST /query { prompt: "hello" }
Server: Bun.spawn(["claude", "-p", "hello", "--output-format", "json"])
Server: รอ process จบ → parse JSON → return result
Client: ได้ { result: "สวัสดี", cost_usd: 0.001 }
```

- ทุก request = spawn process ใหม่
- ไม่มี streaming ระหว่างรอ
- ได้ structured JSON response (result, cost, session_id)
- ใช้ `--dangerously-skip-permissions` (auto-approve ทุกอย่าง)

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
| `POST /query` (stateless) | O | - |
| `GET /models` | O | - |
| `POST /session` (create) | O | O |
| `GET /session` (list) | O | O |
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
| **Streaming** | ไม่มี — รอ process จบ | มี — real-time ผ่าน WebSocket |
| **Tool approval** | Auto-approve ทั้งหมด | User approve ใน terminal ได้ |
| **Output format** | JSON `{ result, cost }` | Raw terminal (ANSI escape codes) |
| **Session lifecycle** | สร้าง/ลบ ผ่าน REST | สร้าง ผ่าน REST, ใช้งาน ผ่าน WebSocket |
| **Multi-client** | 1 request = 1 process | 1 session = หลาย client broadcast ได้ |
| **Terminal resize** | ไม่มี (ไม่ใช่ terminal) | มี — `pty.resize(cols, rows)` |
| **Ctrl+C / signals** | kill process ผ่าน /abort | `pty.write('\x03')` ผ่าน WebSocket |
| **Cost tracking** | มี (parse จาก JSON output) | ไม่มี (raw terminal ไม่มี structured data) |
| **Auth** | Optional Bearer/Basic | ไม่มี |
| **Dependencies** | `hono` (1 package) | `express`, `ws`, `node-pty`, `cors`, `uuid` (5 packages) |

## เปรียบเทียบแบบง่าย

```
claude-code-server = "API Gateway"
  รับ prompt → ส่งให้ Claude → รอ → return JSON
  เหมาะกับ: bot, automation, programmatic access
  ข้อดี: ง่าย, structured output, cost tracking
  ข้อเสีย: ไม่มี streaming, ไม่มี interactive

claude-code-web-terminal = "Remote Desktop"
  เปิด terminal จริง → user พิมพ์ได้เลย
  เหมาะกับ: web UI, interactive coding
  ข้อดี: real-time, interactive, tool approval
  ข้อเสีย: ซับซ้อน, ไม่มี structured output
```

## เลือกใช้อันไหน?

**claude-code-server** เหมาะกับ:
- สร้าง LINE bot / Discord bot / Slack bot
- Automation / CI/CD pipeline
- ต้องการ structured JSON response
- ต้องการ cost tracking
- Client ไม่ต้องการ interactive terminal

**claude-code-web-terminal** เหมาะกับ:
- สร้าง web-based Claude Code IDE
- ต้องการเห็น output real-time
- ต้องการ approve/reject tool use
- ต้องการ full terminal experience ใน browser

## ใช้ร่วมกันได้

สามารถรันทั้ง 2 ตัวพร้อมกัน:
- `claude-code-server` (port 4096) — สำหรับ bot/API clients
- `claude-code-web-terminal` (port 3000) — สำหรับ web UI

## Links

- [claude-code-server](https://github.com/monthop-gmail/claude-code-server)
- [claude-code-web-terminal](https://github.com/monthop-gmail/claude-code-web-terminal)
