export type Language = 'python' | 'javascript' | 'java' | 'cpp' | 'typescript'

export type CodeProject = {
  id: string;
  name: string;
  language: Language;
  code: string;
  files: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export type ExecutionResult = {
  id: string;
  projectId: string;
  status: 'running' | 'success' | 'error' | 'timeout';
  output: string;
  error?: string;
  executionTime: number;
  exitCode?: number;
}

export type SyntaxFinding = {
  file: string;
  line?: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
  source: string;
}

export type SecurityFinding = {
  file: string;
  line?: number;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export type SyntaxReport = {
  valid: boolean;
  findings: SyntaxFinding[];
  metrics: {
    lineCount: number;
    charCount: number;
    files: number;
  };
}

export type SecurityReport = {
  vulnerable: boolean;
  findings: SecurityFinding[];
  recommendations: string[];
}

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertType = 'syntax' | 'security'

export type Alert = {
  id: string;
  projectId?: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export type DebugVariable = {
  name: string;
  value: string;
  type: string;
  scope: 'local' | 'global';
}

export type DebugHistoryEntry = {
  line: number;
  action: 'run' | 'step';
  timestamp: string;
}

export type DebugSession = {
  id: string;
  projectId: string;
  breakpoints: number[];
  status: 'idle' | 'running' | 'paused' | 'completed';
  currentLine?: number;
  variables: DebugVariable[];
  history: DebugHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}
