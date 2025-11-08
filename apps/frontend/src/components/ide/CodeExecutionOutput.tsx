import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Copy, Trash2, Download, CheckCircle, AlertCircle, Info, Clock } from 'lucide-react';

interface OutputLine {
  id: string;
  type: 'log' | 'error' | 'warning' | 'info' | 'result' | 'time';
  content: string;
  timestamp: Date;
}

interface CodeExecutionOutputProps {
  output: string;
  isExecuting: boolean;
  onClear: () => void;
  onCopy: () => void;
  executionTime?: number;
  memoryUsage?: string;
  exitCode?: number | null;
}

const CodeExecutionOutput: React.FC<CodeExecutionOutputProps> = ({
  output,
  isExecuting,
  onClear,
  onCopy,
  executionTime,
  memoryUsage,
  exitCode
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings' | 'logs'>('all');
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  const parseOutput = (output: string): OutputLine[] => {
    const lines = output.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('[ERROR]')) {
        return {
          id: `line-${index}`,
          type: 'error',
          content: line.replace('[ERROR]', '').trim(),
          timestamp: new Date()
        };
      } else if (line.startsWith('[WARN]')) {
        return {
          id: `line-${index}`,
          type: 'warning',
          content: line.replace('[WARN]', '').trim(),
          timestamp: new Date()
        };
      } else if (line.startsWith('[INFO]')) {
        return {
          id: `line-${index}`,
          type: 'info',
          content: line.replace('[INFO]', '').trim(),
          timestamp: new Date()
        };
      } else if (line.includes('Program executed') || line.includes('Exit code')) {
        return {
          id: `line-${index}`,
          type: 'time',
          content: line,
          timestamp: new Date()
        };
      } else if (line.trim()) {
        return {
          id: `line-${index}`,
          type: 'log',
          content: line,
          timestamp: new Date()
        };
      }
      return {
        id: `line-${index}`,
        type: 'log',
        content: '',
        timestamp: new Date()
      };
    }).filter(line => line.content !== '');
  };

  const outputLines = parseOutput(output);

  const filteredLines = outputLines.filter(line => {
    if (filter === 'all') return true;
    if (filter === 'errors') return line.type === 'error';
    if (filter === 'warnings') return line.type === 'warning';
    if (filter === 'logs') return line.type === 'log' || line.type === 'info' || line.type === 'result';
    return true;
  });

  const getOutputIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertCircle size={16} className="text-yellow-500" />;
      case 'info':
        return <Info size={16} className="text-blue-500" />;
      case 'result':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'time':
        return <Clock size={16} className="text-gray-500" />;
      default:
        return <div className="w-4 h-4" />;
    }
  };

  const getOutputColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-400 bg-red-900/20';
      case 'warning':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'info':
        return 'text-blue-400 bg-blue-900/20';
      case 'result':
        return 'text-green-400 bg-green-900/20';
      case 'time':
        return 'text-gray-400 bg-gray-900/20';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-gray-300">Output</h3>

          {isExecuting && (
            <div className="flex items-center gap-2 text-yellow-400">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-xs">Executing...</span>
            </div>
          )}

          {exitCode !== null && !isExecuting && (
            <div className={`flex items-center gap-2 text-xs ${
              exitCode === 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {exitCode === 0 ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span>Exit code: {exitCode}</span>
            </div>
          )}

          {executionTime !== undefined && (
            <div className="text-xs text-gray-400">
              Time: {executionTime}ms
            </div>
          )}

          {memoryUsage && (
            <div className="text-xs text-gray-400">
              Memory: {memoryUsage}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
          >
            <option value="all">All</option>
            <option value="errors">Errors</option>
            <option value="warnings">Warnings</option>
            <option value="logs">Logs</option>
          </select>

          <button
            onClick={onCopy}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Copy output"
          >
            <Copy size={16} />
          </button>

          <button
            onClick={onClear}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Clear output"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div
        ref={outputRef}
        className="flex-1 overflow-auto p-4 font-mono text-sm"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          setAutoScroll(scrollTop + clientHeight >= scrollHeight - 10);
        }}
      >
        {filteredLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Play size={48} className="mx-auto mb-4 opacity-30" />
              <p>Output will appear here</p>
              <p className="text-xs mt-2">Run your code to see results</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLines.map((line) => (
              <div
                key={line.id}
                className={`flex items-start gap-2 p-2 rounded ${getOutputColor(line.type)}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getOutputIcon(line.type)}
                </div>
                <div className="flex-1 break-all whitespace-pre-wrap">
                  {line.content}
                </div>
                <div className="flex-shrink-0 text-xs opacity-50">
                  {line.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            {isExecuting && (
              <div className="flex items-center gap-2 text-yellow-400">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!autoScroll && (
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            ↓ Scroll to bottom
          </button>
        </div>
      )}
    </div>
  );
};

export default CodeExecutionOutput;
