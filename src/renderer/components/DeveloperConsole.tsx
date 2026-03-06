/**
 * Backend Terminal - Shows raw CLI/agent activity for the creator
 *
 * Displays:
 * - Agent spawns (Codex, Claude Code, etc.)
 * - Prompts being sent to agents (stdin)
 * - Agent output (stdout/stderr)
 * - Process exits and status
 *
 * This is terminal-style output - the actual CLI experience,
 * not formatted developer logs. Cmd+Shift+D to toggle.
 */

import React, { useState, useEffect, useRef } from 'react';

interface TerminalLine {
  id: string;
  timestamp: Date;
  sessionId: string;
  type: 'spawn' | 'stdin' | 'stdout' | 'stderr' | 'exit' | 'system';
  content: string;
  tool?: string;
  pid?: number;
  exitCode?: number;
}

interface AgentSession {
  id: string;
  tool: string;
  command: string;
  args: string[];
  pid?: number;
  startedAt: Date;
  endedAt?: Date;
  status: 'running' | 'done' | 'failed';
}

const TYPE_COLORS: Record<string, string> = {
  spawn: '#22c55e',   // green - command launch
  stdin: '#a855f7',   // purple - prompt/input sent
  stdout: '#e5e7eb',  // light gray - normal output
  stderr: '#f59e0b',  // amber - warnings/errors
  exit: '#6b7280',    // gray - process exit
  system: '#3b82f6',  // blue - orchestration events
};

const TOOL_COLORS: Record<string, string> = {
  codex: '#10b981',
  claude: '#8b5cf6',
  gsd: '#3b82f6',
  npm: '#ef4444',
  git: '#f97316',
};

export function DeveloperConsole(): React.ReactElement {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const terminalRef = useRef<HTMLDivElement>(null);

  // Subscribe to backend terminal events
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.backendTerminal) return;

    // Terminal lines (raw CLI content)
    const unsubLine = api.backendTerminal.onTerminalLine?.((line: TerminalLine) => {
      setLines(prev => [...prev.slice(-1000), line]); // Keep last 1000 lines
    });

    // Agent session lifecycle
    const unsubSession = api.backendTerminal.onAgentSession?.((event: {
      action: 'start' | 'end';
      session: AgentSession;
    }) => {
      if (event.action === 'start') {
        setSessions(prev => [...prev, event.session]);
      } else {
        setSessions(prev => prev.map(s =>
          s.id === event.session.id ? event.session : s
        ));
      }
    });

    return () => {
      unsubLine?.();
      unsubSession?.();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const filteredLines = filter === 'all'
    ? lines
    : lines.filter(l => l.type === filter || (filter === 'output' && (l.type === 'stdout' || l.type === 'stderr')));

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const clearTerminal = () => setLines([]);

  const runningCount = sessions.filter(s => s.status === 'running').length;

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '8px 16px',
          cursor: 'pointer',
          color: '#8b949e',
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace',
          zIndex: 9999,
        }}
      >
        Terminal ({runningCount} running)
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0d1117',
      borderLeft: '1px solid #30363d',
      fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace',
      fontSize: 13,
      color: '#c9d1d9',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid #30363d',
        background: '#161b22',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 600, color: '#58a6ff' }}>Backend Terminal</span>
          {runningCount > 0 && (
            <span style={{
              background: '#238636',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 11,
            }}>
              {runningCount} agent{runningCount !== 1 ? 's' : ''} running
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={clearTerminal}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '4px 10px',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '4px 10px',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            _
          </button>
        </div>
      </div>

      {/* Running Agents Bar */}
      {runningCount > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          flexWrap: 'wrap',
        }}>
          {sessions.filter(s => s.status === 'running').map(session => (
            <div key={session.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#21262d',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: TOOL_COLORS[session.tool] || '#22c55e',
                animation: 'pulse 1.5s infinite',
              }} />
              <span style={{ color: TOOL_COLORS[session.tool] || '#c9d1d9', fontWeight: 500 }}>
                {session.tool}
              </span>
              {session.pid && (
                <span style={{ color: '#6e7681', fontSize: 11 }}>
                  PID:{session.pid}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px 12px',
        borderBottom: '1px solid #30363d',
        background: '#161b22',
      }}>
        {['all', 'spawn', 'stdin', 'output', 'system'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? '#388bfd' : '#21262d',
              border: '1px solid ' + (filter === f ? '#388bfd' : '#30363d'),
              borderRadius: 6,
              padding: '4px 10px',
              color: filter === f ? '#fff' : '#8b949e',
              cursor: 'pointer',
              fontSize: 11,
              textTransform: 'capitalize',
            }}
          >
            {f === 'output' ? 'stdout/err' : f}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: '#6e7681',
          fontSize: 11,
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            style={{ accentColor: '#388bfd' }}
          />
          Auto-scroll
        </label>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 0',
        }}
      >
        {filteredLines.length === 0 ? (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: '#6e7681',
          }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Waiting for agent activity...</div>
            <div style={{ fontSize: 12 }}>
              CLI processes, prompts, and outputs will appear here.
            </div>
          </div>
        ) : (
          filteredLines.map(line => (
            <div
              key={line.id}
              style={{
                display: 'flex',
                padding: '2px 12px',
                borderLeft: `3px solid ${TYPE_COLORS[line.type]}`,
                background: line.type === 'stderr' ? 'rgba(245, 158, 11, 0.1)' :
                           line.type === 'stdin' ? 'rgba(168, 85, 247, 0.05)' :
                           line.type === 'spawn' ? 'rgba(34, 197, 94, 0.05)' :
                           'transparent',
                fontFamily: 'inherit',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <span style={{
                color: '#6e7681',
                minWidth: 70,
                fontSize: 11,
                userSelect: 'none',
              }}>
                {formatTime(line.timestamp)}
              </span>
              {line.tool && (
                <span style={{
                  color: TOOL_COLORS[line.tool] || '#6e7681',
                  minWidth: 60,
                  fontSize: 11,
                  fontWeight: 500,
                }}>
                  [{line.tool}]
                </span>
              )}
              <span style={{
                color: TYPE_COLORS[line.type],
                flex: 1,
                lineHeight: 1.5,
              }}>
                {line.type === 'stdin' && <span style={{ color: '#a855f7', marginRight: 8 }}>{'>'}</span>}
                {line.content}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderTop: '1px solid #30363d',
        background: '#161b22',
        fontSize: 11,
        color: '#6e7681',
      }}>
        <span>{filteredLines.length} lines</span>
        <span>Cmd+Shift+D to toggle</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
