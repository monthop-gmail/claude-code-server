# claude-code-server v1.0 vs v2.0

เปรียบเทียบ 2 เวอร์ชันของ claude-code-server

## Architecture

| | v1.0 (CLI spawn) | v2.0 (Agent SDK) |
|---|---|---|
| **วิธีเรียก Claude** | `Bun.spawn(["claude", "-p", ...])` | `query()` จาก `@anthropic-ai/claude-agent-sdk` |
| **Claude Code CLI** | ต้อง `npm install -g @anthropic-ai/claude-code` | ไม่ต้อง — SDK bundle `cli.js` มาในตัว |
| **Protocol** | ส่ง args → รอ process จบ → parse JSON | AsyncGenerator → stream structured messages ทาง stdio |
| **Runtime** | Bun + Hono | Bun + Hono (เหมือนเดิม) |
| **Port** | 4096 | 4096 |

## วิธีเรียก Claude — ต่างกัน

### v1.0 — CLI spawn -p (one-shot)

```
Client: POST /query { prompt: "hello" }
Server: Bun.spawn(["claude", "-p", "hello", "--output-format", "json", ...])
Server: รอ process จบ → parse JSON ก้อนเดียว → return
Client: ได้ { result: "...", cost_usd: 0.001 }
```

- ทุก request = spawn process ใหม่
- ไม่มี streaming — รอจนจบ
- ใช้ `--dangerously-skip-permissions` flag
- ต้องลง Claude Code CLI แยก
- Resume ใช้ `--resume` CLI flag

### v2.0 — Agent SDK query() (streaming)

```
Client: POST /query { prompt: "hello" }
Server: query({ prompt, options: { cwd, model, permissionMode, ... } })
Server: for await (const msg of q) {
          msg.type: "system"       → session_id
          msg.type: "assistant"    → text + tool calls  → publish SSE event
          msg.type: "stream_event" → text delta          → publish SSE event
          msg.type: "result"       → final result, cost  → return
        }
Client: ได้ { result: "...", cost_usd: 0.001 }
        + SSE events ระหว่างทำ
```

- SDK spawn `cli.js` (bundled) เป็น subprocess ให้อัตโนมัติ
- Streaming — ได้ structured messages ทีละก้อนผ่าน AsyncGenerator
- ใช้ `permissionMode: "bypassPermissions"` (SDK option)
- ไม่ต้องลง CLI แยก
- Resume ใช้ `options.resume`

## API Endpoints

| Endpoint | v1.0 | v2.0 | หมายเหตุ |
|----------|:---:|:---:|---|
| `GET /` | O | O | v2 เพิ่ม endpoint listing |
| `GET /health` | O | O | เหมือนเดิม |
| `GET /models` | O | O | เหมือนเดิม |
| `GET /event` (SSE) | - | **O** | ใหม่ — real-time events |
| `POST /query` | O | O | เหมือนเดิม (SDK ข้างใน) |
| `POST /session` | O | O | v2 เพิ่ม directory support |
| `GET /session` | O | O | เหมือนเดิม |
| `GET /session/:id` | - | **O** | ใหม่ — session detail |
| `GET /session/:id/message` | - | **O** | ใหม่ — message history |
| `POST /session/:id/message` | O | O | v2 มี SSE events ระหว่างทำ |
| `POST /session/:id/abort` | O | O | v2 ใช้ AbortController |
| `DELETE /session/:id` | O | O | เหมือนเดิม |

## Feature Comparison

| Feature | v1.0 | v2.0 |
|---------|:---:|:---:|
| Stateless query | O | O |
| Session create/list/delete | O | O |
| Session resume (multi-turn) | O | O |
| Session abort | O | O |
| SSE event stream | - | O |
| Streaming text deltas | - | O |
| Tool use status events | - | O |
| Message history | - | O |
| Session detail endpoint | - | O |
| Multi-project (directory header) | - | O |
| Optional auth (Bearer/Basic) | O | O |
| Model selection per-request | O | O |
| Cost tracking per-session | O | O |
| Auto-retry expired session | O | O |

## SSE Events (v2.0 only)

| Event | เมื่อไหร่ |
|-------|----------|
| `server.connected` | Client เชื่อมต่อ SSE |
| `server.heartbeat` | ทุก 30 วินาที |
| `session.created` | สร้าง session ใหม่ |
| `session.updated` | session เปลี่ยนสถานะ (idle/running) |
| `session.deleted` | ลบ session |
| `message.updated` | Claude ส่ง message ใหม่ (text + tool calls) |
| `message.part.updated` | Tool status เปลี่ยน (running → completed) |
| `message.part.delta` | Streaming text ทีละ token |

## Session Data

| Field | v1.0 | v2.0 |
|-------|------|------|
| `id` | O | O |
| `claudeSessionId` | O | O |
| `totalCost` | O | O |
| `status` | O | O |
| `createdAt` | O | O |
| `updatedAt` | - | O |
| `directory` | - | O |
| `messages[]` | - | O |

## Abort Mechanism

| | v1.0 | v2.0 |
|---|---|---|
| **วิธี** | `proc.kill()` (SIGTERM) | `abortController.abort()` |
| **ความน่าเชื่อถือ** | อาจ zombie process | SDK cleanup ให้เรียบร้อย |
| **Store** | `Map<id, BunProcess>` | `Map<id, AbortController>` |

## Dockerfile

| | v1.0 | v2.0 |
|---|---|---|
| **Base** | node:22-slim | node:22-slim |
| **Install Bun** | O | O |
| **Install Claude Code CLI** | `npm install -g @anthropic-ai/claude-code@latest` | ไม่ต้อง (SDK bundle) |
| **Non-root user** | O | O |
| **Image size** | ใหญ่กว่า (CLI + SDK) | เล็กกว่า (SDK เท่านั้น) |

## Dependencies

| | v1.0 | v2.0 |
|---|---|---|
| `hono` | O | O |
| `@anthropic-ai/claude-agent-sdk` | - | O |
| `@anthropic-ai/claude-code` (global) | O | - |

## Code Complexity

| | v1.0 | v2.0 |
|---|---|---|
| **Files** | 3 (index, claude, session) | 4 (+events.ts) |
| **Lines** | ~400 | ~480 |
| **claude.ts** | 136 lines (spawn + parse JSON) | 190 lines (SDK query + event publishing) |
| **session.ts** | 72 lines | 96 lines (+messages, directory) |
| **index.ts** | 212 lines | 230 lines (+SSE, directory middleware, new routes) |
| **events.ts** | - | 40 lines |

## Migration — backward compatible

v2.0 เป็น **backward compatible** กับ v1.0:
- Request/response format เหมือนเดิมทุก endpoint
- เพิ่ม features ใหม่โดยไม่ทำลายของเดิม
- Client เดิมใช้งานได้โดยไม่ต้องแก้โค้ด
- SSE events เป็น opt-in (ต้อง connect `/event` เอง)

## เปรียบเทียบแบบง่าย

```
v1.0 = "ตู้โทรศัพท์"
  ส่ง prompt → รอ → ได้คำตอบ
  ง่ายสุด, dependency น้อย
  ข้อเสีย: ไม่เห็นอะไรระหว่างรอ

v2.0 = "ตู้โทรศัพท์ + จอ LED"
  ส่ง prompt → เห็น progress real-time → ได้คำตอบ
  ยัง simple แต่มี visibility ดีขึ้น
  ข้อดี: SSE streaming, message history, multi-project
```
