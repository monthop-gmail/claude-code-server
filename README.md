# Claude Code Server

REST API Server สำหรับ **Claude Code CLI** — เรียกใช้ Claude Code ผ่าน HTTP API

## Architecture

```
Client (curl / LINE bot / web app)
  ↕  HTTP REST API (port 4096)
claude-code-server (Bun + Hono)
  ↕  Bun.spawn(["claude", "-p", prompt, ...])
Claude Code CLI
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

# Send message (with --resume)
curl -X POST http://localhost:4096/session/s-123/message \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "ต่อจากที่คุยกัน..."}'

# List sessions
curl http://localhost:4096/session

# Abort active prompt
curl -X POST http://localhost:4096/session/s-123/abort

# Delete session
curl -X DELETE http://localhost:4096/session/s-123
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

## Inspired by

- [bryankthompson/claude-cli-rest-api](https://github.com/bryankthompson/claude-cli-rest-api) — Python FastAPI version
- [OpenCode server](https://github.com/AnomalyCo/opencode) — Full-featured AI coding server
