// --- Claude Code CLI subprocess wrapper ---

export interface ClaudeOptions {
  model?: string
  maxTurns?: string
  maxBudget?: string
  systemPrompt?: string
  resumeSessionId?: string
  timeoutMs?: number
  workspaceDir?: string
}

export interface ClaudeResult {
  result: string
  session_id: string
  cost_usd: number
  duration_ms: number
  is_error: boolean
}

const defaultModel = process.env.CLAUDE_MODEL ?? "sonnet"
const defaultMaxTurns = process.env.CLAUDE_MAX_TURNS ?? "10"
const defaultMaxBudget = process.env.CLAUDE_MAX_BUDGET_USD ?? "1.00"
const defaultTimeoutMs = Number(process.env.CLAUDE_TIMEOUT_MS ?? 300_000)
const defaultWorkspaceDir = process.env.WORKSPACE_DIR ?? "/workspace"

export async function runClaude(
  prompt: string,
  options: ClaudeOptions = {},
  isRetry = false,
): Promise<ClaudeResult> {
  const start = Date.now()

  const model = options.model ?? defaultModel
  const maxTurns = options.maxTurns ?? defaultMaxTurns
  const maxBudget = options.maxBudget ?? defaultMaxBudget
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs
  const workspaceDir = options.workspaceDir ?? defaultWorkspaceDir

  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--max-turns",
    maxTurns,
    "--max-budget-usd",
    maxBudget,
    "--dangerously-skip-permissions",
    "--model",
    model,
  ]

  if (options.systemPrompt) {
    args.push("--system-prompt", options.systemPrompt)
  }

  if (options.resumeSessionId) {
    args.push("--resume", options.resumeSessionId)
  }

  // Build clean environment
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v
  }
  delete env.CLAUDECODE

  const proc = Bun.spawn(["claude", ...args], {
    cwd: workspaceDir,
    env,
    stdout: "pipe",
    stderr: "pipe",
  })

  const timeoutId = setTimeout(() => {
    proc.kill()
  }, timeoutMs)

  try {
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    await proc.exited

    clearTimeout(timeoutId)

    if (stderr) {
      console.error(`[claude] stderr:`, stderr.slice(0, 500))
    }

    // Parse JSON output
    let parsed: any
    try {
      parsed = JSON.parse(stdout)
    } catch {
      // If resume failed, retry without --resume (once)
      if (
        !isRetry &&
        options.resumeSessionId &&
        (stdout.includes("No conversation found") ||
          stdout.includes("not found"))
      ) {
        console.log(`[claude] Session expired, retrying without resume`)
        return runClaude(prompt, { ...options, resumeSessionId: undefined }, true)
      }
      return {
        result: stdout || stderr || "Claude process returned no output",
        session_id: options.resumeSessionId ?? "",
        cost_usd: 0,
        duration_ms: Date.now() - start,
        is_error: true,
      }
    }

    return {
      result: parsed.result ?? "Done. (no text output)",
      session_id: parsed.session_id ?? options.resumeSessionId ?? "",
      cost_usd: parsed.total_cost_usd ?? 0,
      duration_ms: Date.now() - start,
      is_error: parsed.is_error ?? false,
    }
  } catch (err: any) {
    clearTimeout(timeoutId)
    return {
      result: err?.message ?? "Unknown error",
      session_id: options.resumeSessionId ?? "",
      cost_usd: 0,
      duration_ms: Date.now() - start,
      is_error: true,
    }
  }
}

// Store active processes for abort
export const activeProcesses = new Map<string, ReturnType<typeof Bun.spawn>>()
