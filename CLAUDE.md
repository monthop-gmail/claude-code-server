# CLAUDE.md

## Project Overview

Claude Code Server — REST API Server ที่ wrap Claude Code CLI ให้เป็น HTTP API. Built with Bun + Hono. Single Docker service.

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
curl -X POST http://localhost:4096/query -H 'Content-Type: application/json' -d '{"prompt":"hello"}'
```

## Architecture

```
Client → HTTP API (Hono, port 4096) → Bun.spawn(["claude", "-p", ...]) → Anthropic API → Claude
```

- **`src/index.ts`** — Hono HTTP server + routes
- **`src/claude.ts`** — Claude Code CLI subprocess wrapper (runClaude function)
- **`src/session.ts`** — In-memory session manager
- **`Dockerfile`** — Node 22 + Bun + Claude Code CLI, non-root user
- **`docker-compose.yml`** — 1 service (api)

## Key Design

**Two modes:**
- `/query` — Stateless, one-shot prompt (no session needed)
- `/session/:id/message` — Session-based with `--resume` for multi-turn conversations

**Claude Code CLI as subprocess:** `Bun.spawn(["claude", "-p", prompt, "--output-format", "json", ...])`. Returns JSON with result, cost, session_id.

**Optional auth:** Set `API_PASSWORD` env to require Bearer/Basic auth on all endpoints (except / and /health).

## Environment Variables

- `ANTHROPIC_API_KEY` — Anthropic API key
- `API_PASSWORD` — API auth password (optional, empty = no auth)
- `CLAUDE_MODEL` — Default model (default: `sonnet`)
- `CLAUDE_MAX_TURNS` — Max agentic turns (default: 10)
- `CLAUDE_MAX_BUDGET_USD` — Max spend per prompt (default: $1.00)
- `CLAUDE_TIMEOUT_MS` — Timeout per prompt (default: 300000 = 5 min)
- `PORT` — Server port (default: 4096)
- `WORKSPACE_DIR` — Working directory for Claude (default: /workspace)

## Gotchas

- `--dangerously-skip-permissions` is required — Claude Code CLI prompts interactively
- Non-root Docker user — Claude Code refuses --dangerously-skip-permissions as root
- Session busy check — returns 409 if session already has active prompt
- Auto-retry on expired session — if `--resume` fails, retries without it once
- No streaming yet — response waits for process to complete (add SSE later)
