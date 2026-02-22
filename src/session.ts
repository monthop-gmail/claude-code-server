// --- Session Manager ---

export interface SessionInfo {
  id: string
  claudeSessionId: string | null
  totalCost: number
  status: "idle" | "running"
  createdAt: string
}

const sessions = new Map<string, SessionInfo>()
const activeProcesses = new Map<string, ReturnType<typeof Bun.spawn>>()

let counter = 0

export function createSession(): SessionInfo {
  const id = `s-${Date.now()}-${++counter}`
  const session: SessionInfo = {
    id,
    claudeSessionId: null,
    totalCost: 0,
    status: "idle",
    createdAt: new Date().toISOString(),
  }
  sessions.set(id, session)
  return session
}

export function getSession(id: string): SessionInfo | undefined {
  return sessions.get(id)
}

export function listSessions(): SessionInfo[] {
  return Array.from(sessions.values())
}

export function deleteSession(id: string): boolean {
  const session = sessions.get(id)
  if (!session) return false
  // Kill active process if running
  abortSession(id)
  sessions.delete(id)
  return true
}

export function updateSession(id: string, update: Partial<SessionInfo>): void {
  const session = sessions.get(id)
  if (session) {
    Object.assign(session, update)
  }
}

export function setActiveProcess(id: string, proc: ReturnType<typeof Bun.spawn>): void {
  activeProcesses.set(id, proc)
}

export function clearActiveProcess(id: string): void {
  activeProcesses.delete(id)
}

export function abortSession(id: string): boolean {
  const proc = activeProcesses.get(id)
  if (proc) {
    proc.kill()
    activeProcesses.delete(id)
    const session = sessions.get(id)
    if (session) session.status = "idle"
    return true
  }
  return false
}
