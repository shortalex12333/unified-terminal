/**
 * Developer Console - Split-screen view for creator to see backend processes
 *
 * Shows:
 * - CLI process output (Codex, Claude Code, etc.)
 * - Conductor decisions and DAG creation
 * - Step scheduler events
 * - MCP connection status
 *
 * This is for development/staging ONLY - users don't see this.
 */

import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: string;
  timestamp: Date;
  source: 'cli' | 'conductor' | 'scheduler' | 'mcp' | 'system';
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  message: string;
  details?: string;
}

interface CLIProcess {
  id: string;
  command: string;
  startedAt: Date;
  status: 'running' | 'done' | 'failed';
  pid?: number;
}

const SOURCE_COLORS: Record<string, string> = {
  cli: '#10b981',      // green
  conductor: '#8b5cf6', // purple
  scheduler: '#3b82f6', // blue
  mcp: '#f59e0b',       // amber
  system: '#6b7280',    // gray
};

const LEVEL_COLORS: Record<string, string> = {
  info: '#e5e7eb',
  warn: '#fbbf24',
  error: '#ef4444',
  debug: '#9ca3af',
  success: '#10b981',
};

export function DeveloperConsole(): React.ReactElement {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processes, setProcesses] = useState<CLIProcess[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to backend events
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.devConsole) return;

    // Dev log entries (CLI output, conductor, scheduler, etc.)
    const unsubLog = api.devConsole.onDevLog?.((data: any) => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        source: data.source || 'system',
        level: data.level || 'info',
        message: data.message,
        details: data.details,
      };
      setLogs(prev => [...prev.slice(-500), entry]); // Keep last 500 entries
    });

    // CLI process lifecycle tracking
    const unsubProcess = api.devConsole.onCliProcess?.((data: any) => {
      if (data.action === 'start') {
        setProcesses(prev => [...prev, {
          id: data.id,
          command: data.command,
          startedAt: new Date(),
          status: 'running',
          pid: data.pid,
        }]);
      } else if (data.action === 'end') {
        setProcesses(prev => prev.map(p =>
          p.id === data.id ? { ...p, status: data.success ? 'done' : 'failed' } : p
        ));
      }
    });

    return () => {
      unsubLog?.();
      unsubProcess?.();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l => l.source === filter);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const clearLogs = () => setLogs([]);

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          background: '#1f2937',
          border: '1px solid #374151',
          borderRadius: 8,
          padding: '8px 16px',
          cursor: 'pointer',
          color: '#9ca3af',
          fontSize: 12,
          fontFamily: 'monospace',
          zIndex: 9999,
        }}
      >
        🔧 Dev Console ({logs.length} logs)
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#111827',
      borderLeft: '1px solid #374151',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 12,
      color: '#e5e7eb',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #374151',
        background: '#1f2937',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>🔧 Developer Console</span>
          <span style={{ color: '#6b7280', fontSize: 11 }}>
            (Creator View - Users don't see this)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={clearLogs}
            style={{
              background: '#374151',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: '#374151',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Minimize
          </button>
        </div>
      </div>

      {/* Process Status Bar */}
      {processes.filter(p => p.status === 'running').length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '6px 12px',
          background: '#1e3a5f',
          borderBottom: '1px solid #374151',
          flexWrap: 'wrap',
        }}>
          {processes.filter(p => p.status === 'running').map(proc => (
            <div key={proc.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#1f2937',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 11,
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 1.5s infinite',
              }} />
              <span style={{ color: '#10b981' }}>{proc.command}</span>
              {proc.pid && <span style={{ color: '#6b7280' }}>PID:{proc.pid}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '6px 12px',
        borderBottom: '1px solid #374151',
        background: '#1f2937',
      }}>
        {['all', 'cli', 'conductor', 'scheduler', 'mcp', 'system'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? '#374151' : 'transparent',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              color: filter === f ? '#fff' : '#9ca3af',
              cursor: 'pointer',
              fontSize: 11,
              textTransform: 'capitalize',
            }}
          >
            {f === 'all' ? 'All' : f}
            {f !== 'all' && (
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SOURCE_COLORS[f],
                marginLeft: 4,
              }} />
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', fontSize: 11 }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>

      {/* Log Output */}
      <div
        ref={logContainerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 0',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
            Waiting for backend events...
            <br />
            <span style={{ fontSize: 11 }}>
              CLI processes, conductor decisions, and scheduler events will appear here.
            </span>
          </div>
        ) : (
          filteredLogs.map(entry => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                padding: '2px 12px',
                borderLeft: `3px solid ${SOURCE_COLORS[entry.source]}`,
                background: entry.level === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              }}
            >
              <span style={{ color: '#6b7280', minWidth: 70 }}>
                {formatTime(entry.timestamp)}
              </span>
              <span style={{
                color: SOURCE_COLORS[entry.source],
                minWidth: 80,
                textTransform: 'uppercase',
                fontSize: 10,
                fontWeight: 600,
              }}>
                [{entry.source}]
              </span>
              <span style={{ color: LEVEL_COLORS[entry.level], flex: 1 }}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderTop: '1px solid #374151',
        background: '#1f2937',
        fontSize: 11,
        color: '#6b7280',
      }}>
        <span>{filteredLogs.length} log entries</span>
        <span>
          Processes: {processes.filter(p => p.status === 'running').length} running,{' '}
          {processes.filter(p => p.status === 'done').length} done,{' '}
          {processes.filter(p => p.status === 'failed').length} failed
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
