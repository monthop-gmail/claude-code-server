import { Hono } from "hono"
import { cors } from "hono/cors"
import { runClaude } from "./claude"
import {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  updateSession,
  abortSession,
} from "./session"

const port = Number(process.env.PORT ?? 4096)
const apiPassword = process.env.API_PASSWORD
const defaultModel = process.env.CLAUDE_MODEL ?? "sonnet"

const app = new Hono()

// --- Middleware ---
app.use("*", cors())

// Optional basic auth
if (apiPassword) {
  app.use("*", async (c, next) => {
    // Skip auth for health and root
    if (c.req.path === "/health" || c.req.path === "/") {
      return next()
    }

    const auth = c.req.header("Authorization")
    if (!auth) {
      return c.json({ error: "Authorization required" }, 401)
    }

    // Support "Bearer <password>" and "Basic base64(user:password)"
    if (auth.startsWith("Bearer ")) {
      if (auth.slice(7) !== apiPassword) {
        return c.json({ error: "Invalid password" }, 403)
      }
    } else if (auth.startsWith("Basic ")) {
      const decoded = atob(auth.slice(6))
      const password = decoded.includes(":") ? decoded.split(":")[1] : decoded
      if (password !== apiPassword) {
        return c.json({ error: "Invalid password" }, 403)
      }
    } else {
      return c.json({ error: "Invalid auth format" }, 401)
    }

    return next()
  })
}

// --- Routes: Info ---

app.get("/", (c) => {
  return c.json({
    name: "cc-api-server",
    description: "Claude Code CLI REST API Server",
    version: "1.0.0",
    endpoints: [
      "POST /query — Send a prompt (stateless)",
      "GET /models — List available models",
      "GET /health — Health check",
      "POST /session — Create a session",
      "GET /session — List sessions",
      "POST /session/:id/message — Send prompt in session",
      "POST /session/:id/abort — Abort active prompt",
      "DELETE /session/:id — Delete session",
    ],
  })
})

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.get("/models", (c) => {
  return c.json({
    default: defaultModel,
    models: [
      { id: "sonnet", name: "Claude Sonnet", description: "Balanced — good for most tasks" },
      { id: "opus", name: "Claude Opus", description: "Strongest — best quality" },
      { id: "haiku", name: "Claude Haiku", description: "Fast — cheapest" },
    ],
  })
})

// --- Routes: Stateless Query ---

app.post("/query", async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.prompt) {
    return c.json({ error: "Missing 'prompt' in request body" }, 400)
  }

  const { prompt, model, system_prompt, max_turns, max_budget } = body

  console.log(`[query] prompt: ${prompt.slice(0, 100)}...`)

  const result = await runClaude(prompt, {
    model,
    systemPrompt: system_prompt,
    maxTurns: max_turns?.toString(),
    maxBudget: max_budget?.toString(),
  })

  console.log(`[query] done: ${result.duration_ms}ms, cost: $${result.cost_usd.toFixed(4)}`)

  return c.json({
    result: result.result,
    model: model ?? defaultModel,
    session_id: result.session_id,
    cost_usd: result.cost_usd,
    duration_ms: result.duration_ms,
    is_error: result.is_error,
  })
})

// --- Routes: Session Management ---

app.post("/session", (c) => {
  const session = createSession()
  console.log(`[session] created: ${session.id}`)
  return c.json(session)
})

app.get("/session", (c) => {
  return c.json({ sessions: listSessions() })
})

app.post("/session/:id/message", async (c) => {
  const { id } = c.req.param()
  const session = getSession(id)
  if (!session) {
    return c.json({ error: "Session not found" }, 404)
  }

  const body = await c.req.json().catch(() => null)
  if (!body?.prompt) {
    return c.json({ error: "Missing 'prompt' in request body" }, 400)
  }

  if (session.status === "running") {
    return c.json({ error: "Session is busy — use /session/:id/abort to cancel" }, 409)
  }

  const { prompt, model, system_prompt, max_turns, max_budget } = body

  updateSession(id, { status: "running" })
  console.log(`[session:${id}] prompt: ${prompt.slice(0, 100)}...`)

  const result = await runClaude(prompt, {
    model,
    systemPrompt: system_prompt,
    maxTurns: max_turns?.toString(),
    maxBudget: max_budget?.toString(),
    resumeSessionId: session.claudeSessionId ?? undefined,
  })

  // Update session state
  updateSession(id, {
    status: "idle",
    claudeSessionId: result.session_id || session.claudeSessionId,
    totalCost: session.totalCost + result.cost_usd,
  })

  console.log(`[session:${id}] done: ${result.duration_ms}ms, cost: $${result.cost_usd.toFixed(4)}`)

  return c.json({
    result: result.result,
    model: model ?? defaultModel,
    session_id: result.session_id,
    cost_usd: result.cost_usd,
    total_cost_usd: session.totalCost + result.cost_usd,
    duration_ms: result.duration_ms,
    is_error: result.is_error,
  })
})

app.post("/session/:id/abort", (c) => {
  const { id } = c.req.param()
  const session = getSession(id)
  if (!session) {
    return c.json({ error: "Session not found" }, 404)
  }

  const aborted = abortSession(id)
  return c.json({ aborted })
})

app.delete("/session/:id", (c) => {
  const { id } = c.req.param()
  const deleted = deleteSession(id)
  if (!deleted) {
    return c.json({ error: "Session not found" }, 404)
  }
  return c.json({ deleted: true })
})

// --- Start Server ---

console.log("CC API Server configuration:")
console.log("- Port:", port)
console.log("- Default model:", defaultModel)
console.log("- Auth:", apiPassword ? "enabled" : "disabled")
console.log("- Workspace:", process.env.WORKSPACE_DIR ?? "/workspace")

export default {
  port,
  fetch: app.fetch,
}
