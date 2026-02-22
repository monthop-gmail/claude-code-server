# Claude Code Server

REST API Server สำหรับ **Claude Code** — เรียกใช้ Claude Code ผ่าน HTTP API พร้อม SSE streaming

## Architecture

```
Client (curl / LINE bot / web app)
  ↕  HTTP REST API (port 4096)
claude-code-server (Bun + Hono)
  ↕  Claude Agent SDK → query() AsyncGenerator
Claude Code CLI (bundled in SDK)
  ↕  ANTHROPIC_API_KEY
Anthropic API → Claude
```

## Quick Start

```bash
cp .env.example .env
# แก้ไข .env: ANTHROPIC_API_KEY=sk-ant-...

docker compose up -d --build
```

## API Endpoints

### Info

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API info + endpoint list |
| `GET` | `/health` | Health check |
| `GET` | `/models` | Available models |

### SSE Event Stream

```bash
# Connect to receive real-time events
curl -N http://localhost:4096/event
```

Events:
- `server.connected` — Initial connection
- `server.heartbeat` — Keep-alive (every 30s)
- `session.created` / `session.updated` / `session.deleted`
- `message.updated` — New message from Claude
- `message.part.updated` — Tool use status change
- `message.part.delta` — Streaming text token

### Stateless Query

```bash
curl -X POST http://localhost:4096/query \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "สวัสดี"}'
```

Response:
```json
{
  "result": "สวัสดีครับ!",
  "model": "sonnet",
  "session_id": "abc-123",
  "cost_usd": 0.0012,
  "duration_ms": 3200,
  "is_error": false
}
```

Options:
```json
{
  "prompt": "สวัสดี",
  "model": "opus",
  "system_prompt": "ตอบเป็นภาษาไทย",
  "max_turns": 5,
  "max_budget": 0.50
}
```

### Session (multi-turn)

```bash
# Create session
curl -X POST http://localhost:4096/session

# Create session for specific directory
curl -X POST http://localhost:4096/session \
  -H 'x-opencode-directory: /workspace/project-a'

# Send message (with auto-resume)
curl -X POST http://localhost:4096/session/s-123/message \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "ต่อจากที่คุยกัน..."}'

# Get session details
curl http://localhost:4096/session/s-123

# Get message history
curl http://localhost:4096/session/s-123/message

# List sessions
curl http://localhost:4096/session

# Abort active prompt
curl -X POST http://localhost:4096/session/s-123/abort

# Delete session
curl -X DELETE http://localhost:4096/session/s-123
```

### Multi-Project (directory header)

```bash
# Via header
curl -X POST http://localhost:4096/query \
  -H 'x-opencode-directory: /workspace/project-b' \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "what files are here?"}'

# Via query param
curl -X POST http://localhost:4096/query?directory=/workspace/project-b \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "what files are here?"}'
```

### Authentication (optional)

ตั้ง `API_PASSWORD` ใน `.env` แล้วส่ง header:

```bash
# Bearer token
curl -H 'Authorization: Bearer your-password' http://localhost:4096/query ...

# Basic auth
curl -u opencode:your-password http://localhost:4096/query ...
```

## Models

| Model | Description |
|-------|-------------|
| `sonnet` (default) | Balanced — good for most tasks |
| `opus` | Strongest — best quality |
| `haiku` | Fast — cheapest |

## Docker Commands

```bash
# Build and deploy
docker compose up -d --build

# Logs
docker logs claude-code-server --tail 30

# Test
curl http://localhost:4096/health
```

## What's New in v2.0

- **Claude Agent SDK** — ใช้ `@anthropic-ai/claude-agent-sdk` แทน CLI spawn
- **SSE Streaming** — `GET /event` real-time events ระหว่าง Claude ทำงาน
- **Multi-project** — `x-opencode-directory` header/query param
- **Message history** — `GET /session/:id/message`
- **Simplified Docker** — SDK bundles CLI, ไม่ต้องลงแยก

## Inspired by

- [claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) — Official Claude Agent SDK
- [bryankthompson/claude-cli-rest-api](https://github.com/bryankthompson/claude-cli-rest-api) — Python FastAPI version
- [OpenCode server](https://github.com/AnomalyCo/opencode) — Full-featured AI coding server
