# CLAUDE.md

## Project Overview

Claude Code Server — REST API Server ที่ใช้ Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) ให้เป็น HTTP API พร้อม SSE streaming. Built with Bun + Hono. Single Docker service.

## Commands

```bash
# Docker deployment
docker compose up -d --build
docker logs claude-code-server --tail 30

# Local development
cp .env.example .env
bun install
bun dev

# Test
curl http://localhost:4096/health
curl -N http://localhost:4096/event  # SSE stream
curl -X POST http://localhost:4096/query -H 'Content-Type: application/json' -d '{"prompt":"hello"}'
```

## Architecture

```
Client → HTTP API (Hono, port 4096) → Claude Agent SDK query() → Claude Code CLI (bundled) → Anthropic API
         ↓ SSE /event
Client ← real-time events (message.updated, message.part.delta, ...)
```

- **`src/index.ts`** — Hono HTTP server + routes + SSE endpoint
- **`src/claude.ts`** — Claude Agent SDK wrapper (query() AsyncGenerator)
- **`src/session.ts`** — In-memory session manager with message history
- **`src/events.ts`** — Simple pub/sub event bus for SSE broadcasting
- **`Dockerfile`** — Node 22 + Bun (SDK bundles Claude Code CLI)
- **`docker-compose.yml`** — 1 service (api)

## Key Design

**Two modes:**
- `/query` — Stateless, one-shot prompt (no session needed)
- `/session/:id/message` — Session-based with SDK `resume` for multi-turn

**Claude Agent SDK:** Uses `query()` from `@anthropic-ai/claude-agent-sdk` which spawns a bundled Claude Code process. Returns structured messages via AsyncGenerator.

**SSE streaming:** `GET /event` streams real-time events (message.updated, message.part.delta, session.updated). Heartbeat every 30s.

**Multi-project:** `x-opencode-directory` header or `?directory=` query param sets working directory per request.

**Optional auth:** Set `API_PASSWORD` env to require Bearer/Basic auth (except /, /health, /event).

## Environment Variables

- `ANTHROPIC_API_KEY` — Anthropic API key
- `API_PASSWORD` — API auth password (optional, empty = no auth)
- `CLAUDE_MODEL` — Default model (default: `sonnet`)
- `CLAUDE_MAX_TURNS` — Max agentic turns (default: 10)
- `CLAUDE_MAX_BUDGET_USD` — Max spend per prompt (default: $1.00)
- `PORT` — Server port (default: 4096)
- `WORKSPACE_DIR` — Default working directory (default: /workspace)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/event` | SSE event stream |
| `POST` | `/query` | Stateless prompt |
| `POST` | `/session` | Create session |
| `GET` | `/session` | List sessions |
| `GET` | `/session/:id` | Get session detail |
| `GET` | `/session/:id/message` | Get message history |
| `POST` | `/session/:id/message` | Send prompt in session |
| `POST` | `/session/:id/abort` | Abort active prompt |
| `DELETE` | `/session/:id` | Delete session |
| `GET` | `/models` | Available models |
| `GET` | `/health` | Health check |

## Gotchas

- SDK bundles Claude Code CLI — no need to install separately
- Non-root Docker user required — Claude Code won't run as root
- `permissionMode: "bypassPermissions"` replaces `--dangerously-skip-permissions`
- Session busy check — returns 409 if session has active prompt
- Auto-retry on expired session — if resume fails, retries without it
- SSE events fire during prompt execution — connect to /event before sending prompts
