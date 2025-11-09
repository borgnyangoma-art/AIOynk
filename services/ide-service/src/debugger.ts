import esprima from 'esprima'
import ts from 'typescript'
import { v4 as uuidv4 } from 'uuid'

import { CodeProject, DebugSession, DebugVariable, Language } from './types'

const MAX_VARIABLES = 25

const now = () => new Date().toISOString()

export class DebugManager {
  private sessions = new Map<string, DebugSession>()

  createSession(projectId: string, breakpoints: number[] = []) {
    const session: DebugSession = {
      id: uuidv4(),
      projectId,
      breakpoints: this.normalizeBreakpoints(breakpoints),
      status: 'idle',
      variables: [],
      history: [],
      createdAt: now(),
      updatedAt: now(),
    }

    this.sessions.set(session.id, session)
    return session
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId)
  }

  updateBreakpoints(sessionId: string, projectId: string, breakpoints: number[]) {
    const session = this.requireSession(sessionId, projectId)
    session.breakpoints = this.normalizeBreakpoints(breakpoints)
    session.updatedAt = now()
    return session
  }

  run(sessionId: string, project: CodeProject) {
    const session = this.requireSession(sessionId, project.id)
    session.status = 'running'
    session.variables = this.extractVariables(project.language, project.code)
    session.currentLine = session.breakpoints[0]
    session.status = session.currentLine ? 'paused' : 'completed'
    session.history.push({ line: session.currentLine ?? -1, action: 'run', timestamp: now() })
    session.updatedAt = now()
    return session
  }

  step(sessionId: string, project: CodeProject) {
    const session = this.requireSession(sessionId, project.id)
    if (!session.breakpoints.length) {
      session.status = 'completed'
      session.currentLine = undefined
    } else {
      const current = session.currentLine ?? 0
      const next = session.breakpoints.find((line) => line > current)
      session.currentLine = next
      session.status = next ? 'paused' : 'completed'
    }
    session.history.push({ line: session.currentLine ?? -1, action: 'step', timestamp: now() })
    session.updatedAt = now()
    return session
  }

  inspectVariables(sessionId: string, project: CodeProject) {
    const session = this.requireSession(sessionId, project.id)
    session.variables = this.extractVariables(project.language, project.code)
    session.updatedAt = now()
    return session.variables
  }

  private normalizeBreakpoints(breakpoints: number[]) {
    return [...new Set(breakpoints.filter((line) => line > 0))].sort((a, b) => a - b)
  }

  private extractVariables(language: Language, code: string): DebugVariable[] {
    switch (language) {
      case 'javascript':
        return this.extractJsVariables(code)
      case 'typescript':
        return this.extractJsVariables(
          ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS } }).outputText
        )
      case 'python':
        return this.extractPythonVariables(code)
      case 'java':
      case 'cpp':
        return this.extractCLikeVariables(code)
      default:
        return []
    }
  }

  private extractJsVariables(code: string) {
    const variables: DebugVariable[] = []
    try {
      const tree = esprima.parseScript(code, { tolerant: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const addNode = (node: any) => {
        if (node.type === 'VariableDeclarator' && node.id?.name && node.init && 'value' in node.init) {
          variables.push({
            name: node.id.name,
            value: String(node.init.value),
            type: typeof node.init.value,
            scope: 'local',
          })
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const visit = (node: any) => {
        addNode(node)
        Object.values(node || {}).forEach((value) => {
          if (value && typeof value === 'object' && 'type' in value) {
            visit(value)
          } else if (Array.isArray(value)) {
            value.forEach((child) => child && typeof child === 'object' && visit(child))
          }
        })
      }

      visit(tree)
    } catch (error) {
      // ignore parse errors and fallback to regex
    }

    if (!variables.length) {
      const regex = /(const|let|var)\s+([a-zA-Z_][\w]*)\s*=\s*([^;]+)/g
      let match: RegExpExecArray | null
      while ((match = regex.exec(code)) && variables.length < MAX_VARIABLES) {
        variables.push({
          name: match[2],
          value: match[3].trim(),
          type: 'unknown',
          scope: 'local',
        })
      }
    }

    return variables.slice(0, MAX_VARIABLES)
  }

  private extractPythonVariables(code: string) {
    const regex = /([a-zA-Z_][\w]*)\s*=\s*([^#\n]+)/g
    const variables: DebugVariable[] = []
    let match: RegExpExecArray | null
    while ((match = regex.exec(code)) && variables.length < MAX_VARIABLES) {
      variables.push({
        name: match[1],
        value: match[2].trim(),
        type: 'unknown',
        scope: 'local',
      })
    }
    return variables
  }

  private extractCLikeVariables(code: string) {
    const regex = /(int|float|double|String|char|long)\s+([a-zA-Z_][\w]*)\s*=\s*([^;]+)/g
    const variables: DebugVariable[] = []
    let match: RegExpExecArray | null
    while ((match = regex.exec(code)) && variables.length < MAX_VARIABLES) {
      variables.push({
        name: match[2],
        value: match[3].trim(),
        type: match[1],
        scope: 'local',
      })
    }
    return variables
  }

  private requireSession(sessionId: string, projectId: string) {
    const session = this.sessions.get(sessionId)
    if (!session || session.projectId !== projectId) {
      throw new Error('Debug session not found')
    }
    return session
  }
}

export default DebugManager
