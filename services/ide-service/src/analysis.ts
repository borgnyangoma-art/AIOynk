import esprima from 'esprima'
import ts from 'typescript'

import { emitAlert } from './alerts'
import { SandboxRunner } from './sandbox'
import {
  CodeProject,
  Language,
  SecurityFinding,
  SecurityReport,
  SyntaxFinding,
  SyntaxReport,
} from './types'
import { getEntryFileName } from './utils/project'

const BASE_RECOMMENDATIONS = [
  'Avoid executing untrusted input',
  'Sanitize user data before usage',
  'Prefer parameterized queries for data access',
  'Limit filesystem exposure inside sandboxes',
  'Validate network requests and disable unnecessary protocols',
]

type SecurityRule = {
  pattern: RegExp
  issue: string
  severity: 'low' | 'medium' | 'high'
  recommendation: string
}

const LANGUAGE_RULES: Partial<Record<Language | 'all', SecurityRule[]>> = {
  all: [
    {
      pattern: /process\.env\[/,
      issue: 'Direct environment variable access',
      severity: 'low',
      recommendation: 'Proxy secrets through a vault service',
    },
  ],
  javascript: [
    {
      pattern: /eval\(/,
      issue: 'Use of eval()',
      severity: 'high',
      recommendation: 'Use safer parsers or JSON.parse',
    },
    {
      pattern: /Function\(/,
      issue: 'Dynamic Function constructor',
      severity: 'medium',
      recommendation: 'Avoid constructing functions from user input',
    },
    {
      pattern: /child_process\.(exec|spawn)/,
      issue: 'Spawning shell commands',
      severity: 'high',
      recommendation: 'Proxy subprocess work through vetted services',
    },
  ],
  typescript: [
    {
      pattern: /eval\(/,
      issue: 'Use of eval()',
      severity: 'high',
      recommendation: 'Use safer parsers or JSON.parse',
    },
  ],
  python: [
    {
      pattern: /exec\(/,
      issue: 'Execution via exec()',
      severity: 'high',
      recommendation: 'Avoid exec() for dynamic code paths',
    },
    {
      pattern: /os\.system/,
      issue: 'Shell execution through os.system',
      severity: 'medium',
      recommendation: 'Use subprocess with explicit allow-lists or drop shell access',
    },
    {
      pattern: /subprocess\.(Popen|call|run)/,
      issue: 'Subprocess invocation without sanitization',
      severity: 'medium',
      recommendation: 'Provide vetted arguments and disable shell=True',
    },
  ],
  java: [
    {
      pattern: /Runtime\.getRuntime\(\)\.exec/,
      issue: 'Runtime exec usage',
      severity: 'high',
      recommendation: 'Use ProcessBuilder with strict allow-lists',
    },
    {
      pattern: /ProcessBuilder/,
      issue: 'ProcessBuilder detected',
      severity: 'medium',
      recommendation: 'Validate command strings before execution',
    },
  ],
  cpp: [
    {
      pattern: /system\(/,
      issue: 'system() call can run arbitrary commands',
      severity: 'high',
      recommendation: 'Prefer library calls over shell execution',
    },
    {
      pattern: /popen\(/,
      issue: 'popen() usage',
      severity: 'medium',
      recommendation: 'Avoid piping shell output directly',
    },
  ],
}

export class Analyzer {
  constructor(private sandbox: SandboxRunner) {}

  async syntax(project: CodeProject): Promise<SyntaxReport> {
    const findings: SyntaxFinding[] = []
    const metrics = {
      lineCount: project.code.split('\n').length,
      charCount: project.code.length,
      files: Object.keys(project.files).length,
    }

    if (project.language === 'javascript') {
      try {
        esprima.parseScript(project.code, { tolerant: true, loc: true })
      } catch (error: any) {
        findings.push({
          file: getEntryFileName(project.language),
          line: error?.lineNumber,
          message: error?.description || error?.message || 'JavaScript syntax error',
          severity: 'error',
          source: 'esprima',
        })
      }
    } else if (project.language === 'typescript') {
      const diagnostics = ts.transpileModule(project.code, {
        compilerOptions: { target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS },
        reportDiagnostics: true,
      }).diagnostics

      diagnostics?.forEach((diag) => {
        findings.push({
          file: getEntryFileName(project.language),
          line: diag.file ? diag.file.getLineAndCharacterOfPosition(diag.start || 0).line + 1 : undefined,
          message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
          severity: diag.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error',
          source: 'tsc',
        })
      })
    } else {
      const result = await this.sandbox.checkSyntax(project)
      if (result.exitCode !== 0 || result.stderr.trim().length > 0) {
        findings.push({
          file: getEntryFileName(project.language),
          message: result.stderr || 'Compiler reported an error',
          severity: 'error',
          source: 'sandbox',
        })
      }
    }

    const report: SyntaxReport = { valid: findings.length === 0, findings, metrics }

    if (!report.valid) {
      emitAlert('syntax', findings.some((f) => f.severity === 'error') ? 'warning' : 'info', 'Syntax issues detected', {
        findings,
      }, project.id)
    }

    return report
  }

  scanSecurity(project: CodeProject): SecurityReport {
    const findings: SecurityFinding[] = []
    const rules: SecurityRule[] = [...(LANGUAGE_RULES.all || []), ...(LANGUAGE_RULES[project.language] || [])]

    Object.entries(project.files).forEach(([fileName, contents]) => {
      const lines = String(contents ?? '').split('\n')
      lines.forEach((line, index) => {
        rules.forEach((rule) => {
          if (rule.pattern.test(line)) {
            findings.push({
              file: fileName,
              line: index + 1,
              issue: rule.issue,
              severity: rule.severity,
              recommendation: rule.recommendation,
            })
          }
        })
      })
    })

    const vulnerable = findings.length > 0

    if (vulnerable) {
      const highest = findings.some((f) => f.severity === 'high') ? 'critical' : 'warning'
      emitAlert('security', highest, 'Security findings detected', { findings }, project.id)
    }

    return {
      vulnerable,
      findings,
      recommendations: BASE_RECOMMENDATIONS,
    }
  }
}

export default Analyzer
