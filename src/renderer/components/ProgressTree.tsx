/**
 * ProgressTree Component
 *
 * Soft-hue vertical pipeline visualization for build progress.
 * Converted from AgentRootTree.jsx prototype to TypeScript.
 *
 * Design: Pill-radius rounded bars flowing vertically top-down.
 * Main spine on the left, branches fork right for parallel agents,
 * sub-branches fork within branches for sub-agents.
 * Soft blue-white watercolour hues. Progress fills downward.
 * Completed = full opacity. Active = animated pulse. Pending = faint.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { RenderTreeNode, StatusState } from '../hooks/useStatusAgent';

// =============================================================================
// TYPES
// =============================================================================

interface QueryOption {
  label: string;
  value: string;
  detail: string | null;
  icon: string | null;
}

interface UserQueryProps {
  id: string;
  question: string;
  options: QueryOption[];
  defaultChoice: string | null;
}

export interface ProgressTreeProps {
  /** Hierarchical tree of status nodes */
  tree: RenderTreeNode[];
  /** Currently active user query */
  query: UserQueryProps | null;
  /** Project name being built */
  projectName: string;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Remaining time on query countdown */
  queryTimer: number;
  /** Interrupt feedback to display */
  interruptFeedback: { text: string; detail: string } | null;
  /** Handler for query response */
  onQueryResponse: (queryId: string, value: string) => void;
  /** Handler for user correction/feedback */
  onCorrection: (text: string) => void;
  /** Handler for stop step request */
  onStopStep: (stepId: number) => void;
  /** Handler for stop all request */
  onStopAll: () => void;
  /** Handler for pause request */
  onPause: () => void;
}

// =============================================================================
// COLORS & CONSTANTS
// =============================================================================

// Colors now come from CSS variables (tokens.css)
// Component uses .theme-dark class to activate dark theme tokens
const C = {
  bg: 'var(--kenoki-bg)',
  spine: 'var(--kenoki-spine)',
  spineDone: 'var(--kenoki-spine-done)',
  spineActive: 'var(--kenoki-spine-active)',
  spinePending: 'var(--kenoki-spine-pending)',
  branchDone: 'var(--kenoki-spine-done)',
  branchActive: 'var(--kenoki-spine-active)',
  branchPending: 'var(--kenoki-spine-pending)',
  dot: 'var(--kenoki-accent)',
  dotDone: 'var(--kenoki-dot-done)',
  dotActive: 'var(--kenoki-dot-active)',
  dotPending: 'var(--kenoki-dot-pending)',
  text: 'var(--kenoki-text)',
  textSub: 'var(--kenoki-text-secondary)',
  textFaint: 'var(--kenoki-text-muted)',
  accent: 'var(--kenoki-accent)',
  accentSoft: 'var(--kenoki-accent-soft)',
  white: 'var(--kenoki-surface)',
  queryBg: 'var(--kenoki-accent-soft)',
  queryBorder: 'var(--kenoki-accent-border)',
  errorSoft: 'var(--kenoki-error-soft)',
  pauseSoft: 'rgba(246, 193, 119, 0.15)',
};

const SPINE_W = 6;
const BRANCH_W = 4;
const SUB_BRANCH_W = 3;
const DOT_R = 5;
const INDENT = 32;

// =============================================================================
// CSS KEYFRAMES
// =============================================================================

const globalStyles = `
  @keyframes dotPulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.3); }
  }
  @keyframes nodeSlideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes feedbackIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .progress-tree * { box-sizing: border-box; }
  .progress-tree button { font-family: inherit; }
  .progress-tree input { font-family: inherit; }
`;

// =============================================================================
// DOT COMPONENT
// =============================================================================

interface DotProps {
  state: StatusState;
  size?: number;
}

function Dot({ state, size = DOT_R }: DotProps): React.ReactElement {
  const colors: Record<StatusState, string> = {
    done: C.dotDone,
    active: C.dotActive,
    pending: C.dotPending,
    error: '#E85B5B',
    paused: '#E8B85B',
    waiting_user: C.accent,
  };

  return (
    <div
      style={{
        width: size * 2,
        height: size * 2,
        borderRadius: '50%',
        background: colors[state] || C.dotPending,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {state === 'active' && (
        <div
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            border: `2px solid ${C.accent}`,
            animation: 'dotPulse 2s ease-in-out infinite',
          }}
        />
      )}
      {state === 'done' && (
        <svg
          viewBox="0 0 10 10"
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        >
          <path
            d="M2.5 5.2 L4.2 7 L7.5 3.5"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

// =============================================================================
// NODE ROW COMPONENT
// =============================================================================

interface NodeRowProps {
  node: RenderTreeNode;
  depth?: number;
  isLast?: boolean;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
}

function NodeRow({
  node,
  depth = 0,
  isLast = false,
  expanded,
  onToggleExpand,
}: NodeRowProps): React.ReactElement {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isParallel = node.parallel;
  const barWidth = depth === 0 ? SPINE_W : depth === 1 ? BRANCH_W : SUB_BRANCH_W;

  return (
    <div style={{ animation: 'nodeSlideIn 0.3s ease-out' }}>
      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 0',
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={() => hasChildren && onToggleExpand(node.id)}
      >
        <Dot state={node.state} size={depth === 0 ? DOT_R : DOT_R - 1} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: depth === 0 ? 14 : 13,
              fontWeight: depth === 0 ? 500 : 400,
              color: node.state === 'pending' ? C.textFaint : C.text,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isParallel && (
              <span
                style={{
                  fontSize: 9,
                  background: C.accentSoft,
                  color: C.accent,
                  padding: '1px 6px',
                  borderRadius: 8,
                  fontWeight: 500,
                  letterSpacing: '0.03em',
                }}
              >
                parallel
              </span>
            )}
            <span>{node.label}</span>
            {hasChildren && (
              <span
                style={{
                  fontSize: 11,
                  color: C.textFaint,
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                  display: 'inline-block',
                }}
              >
                {'\u25B8'}
              </span>
            )}
          </div>
          {node.state === 'active' && (
            <div
              style={{
                marginTop: 4,
                height: 3,
                borderRadius: 3,
                background: C.spinePending,
                overflow: 'hidden',
                maxWidth: 140,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${node.progress}%`,
                  background: `linear-gradient(90deg, ${C.spineActive}, ${C.accent})`,
                  borderRadius: 3,
                  transition: 'width 0.6s ease-out',
                }}
              />
            </div>
          )}
        </div>

        {node.elapsed && (
          <span style={{ fontSize: 11, color: C.textFaint, flexShrink: 0 }}>
            {node.elapsed}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div style={{ marginLeft: depth === 0 ? 5 : 4, paddingLeft: INDENT - 12 }}>
          {/* Vertical connector bar */}
          <div style={{ position: 'relative' }}>
            {/* The vertical spine of this branch group */}
            <div
              style={{
                position: 'absolute',
                left: -(INDENT - 16),
                top: 0,
                bottom: 0,
                width: barWidth,
                borderRadius: barWidth,
                background:
                  node.state === 'done'
                    ? C.branchDone
                    : node.state === 'active'
                    ? C.spine
                    : C.branchPending,
                opacity: 0.6,
              }}
            />

            {node.children.map((child, i) => (
              <div key={child.id} style={{ position: 'relative' }}>
                {/* Horizontal branch connector */}
                <div
                  style={{
                    position: 'absolute',
                    left: -(INDENT - 16),
                    top: 16,
                    width: INDENT - 20,
                    height: barWidth - 1,
                    borderRadius: barWidth,
                    background:
                      child.state === 'done'
                        ? C.branchDone
                        : child.state === 'active'
                        ? C.branchActive
                        : C.branchPending,
                    opacity: 0.6,
                  }}
                />

                <NodeRow
                  node={child}
                  depth={depth + 1}
                  isLast={i === node.children.length - 1}
                  expanded={expanded}
                  onToggleExpand={onToggleExpand}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// QUERY WIDGET COMPONENT
// =============================================================================

interface QueryWidgetProps {
  query: UserQueryProps;
  queryTimer: number;
  onResponse: (queryId: string, value: string) => void;
}

function QueryWidget({ query, queryTimer, onResponse }: QueryWidgetProps): React.ReactElement {
  return (
    <div
      style={{
        margin: '12px 0',
        padding: '16px 18px',
        background: C.queryBg,
        border: `1px solid ${C.queryBorder}`,
        borderRadius: 14,
        animation: 'nodeSlideIn 0.3s ease-out',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
        {query.question}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {query.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onResponse(query.id, opt.value)}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: `1px solid ${C.queryBorder}`,
              background: C.white,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              minWidth: 90,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = C.accentSoft;
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = C.white;
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.queryBorder;
            }}
          >
            {opt.icon && <span style={{ fontSize: 18 }}>{opt.icon}</span>}
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{opt.label}</span>
            {opt.detail && <span style={{ fontSize: 11, color: C.textSub }}>{opt.detail}</span>}
          </button>
        ))}
      </div>
      {query.defaultChoice && queryTimer > 0 && (
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 10 }}>
          Auto-selecting &quot;{query.options.find((o) => o.value === query.defaultChoice)?.label || query.defaultChoice}&quot; in {queryTimer}s
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PROGRESS TREE COMPONENT
// =============================================================================

export default function ProgressTree({
  tree,
  query,
  projectName,
  overallProgress,
  queryTimer,
  interruptFeedback,
  onQueryResponse,
  onCorrection,
  onStopStep,
  onStopAll,
  onPause,
}: ProgressTreeProps): React.ReactElement {
  // Track which nodes are expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand active nodes
    const initialExpanded = new Set<string>();
    const findActive = (nodes: RenderTreeNode[]) => {
      for (const node of nodes) {
        if (node.state === 'active') {
          initialExpanded.add(node.id);
        }
        if (node.children?.length) {
          findActive(node.children);
        }
      }
    };
    findActive(tree);
    return initialExpanded;
  });

  // User input for corrections
  const [userInput, setUserInput] = useState('');

  // Scroll ref for auto-scroll to active
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand newly active nodes
  useEffect(() => {
    const findActive = (nodes: RenderTreeNode[]): string[] => {
      const activeIds: string[] = [];
      for (const node of nodes) {
        if (node.state === 'active') {
          activeIds.push(node.id);
        }
        if (node.children?.length) {
          activeIds.push(...findActive(node.children));
        }
      }
      return activeIds;
    };

    const activeIds = findActive(tree);
    if (activeIds.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const id of activeIds) {
          next.add(id);
        }
        return next;
      });
    }
  }, [tree]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleInterrupt = () => {
    if (!userInput.trim()) return;
    onCorrection(userInput.trim());
    setUserInput('');
  };

  return (
    <div
      className="progress-tree theme-dark"
      style={{
        fontFamily: "'SF Pro Display', 'SF Pro Text', -apple-system, system-ui, sans-serif",
        background: C.bg,
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      <style>{globalStyles}</style>

      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>
            {projectName || 'Building...'}
          </h1>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                flex: 1,
                height: 5,
                borderRadius: 5,
                background: C.spinePending,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${overallProgress}%`,
                  background: `linear-gradient(90deg, ${C.spineDone}, ${C.accent})`,
                  borderRadius: 5,
                  transition: 'width 0.8s ease-out',
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500, flexShrink: 0 }}>
              {overallProgress}%
            </span>
          </div>
        </div>

        {/* Tree */}
        <div ref={scrollRef} style={{ position: 'relative' }}>
          {/* Main spine bar (behind everything) */}
          <div
            style={{
              position: 'absolute',
              left: DOT_R - SPINE_W / 2,
              top: 12,
              bottom: 60,
              width: SPINE_W,
              borderRadius: SPINE_W,
              background: C.spinePending,
              zIndex: 0,
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${overallProgress}%`,
                borderRadius: SPINE_W,
                background: `linear-gradient(180deg, ${C.spineDone}, ${C.spineActive})`,
                transition: 'height 0.8s ease-out',
              }}
            />
          </div>

          {/* Nodes */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {tree.map((node, i) => (
              <div key={node.id}>
                <NodeRow
                  node={node}
                  depth={0}
                  isLast={i === tree.length - 1}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                />

                {/* Query widget appears after the active building step */}
                {query && node.state === 'active' && (
                  <QueryWidget
                    query={query}
                    queryTimer={queryTimer}
                    onResponse={onQueryResponse}
                  />
                )}
              </div>
            ))}

            {/* Final output node (placeholder for build output) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 0',
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: DOT_R * 2 + 4,
                  height: DOT_R * 2 + 4,
                  borderRadius: 6,
                  background: C.spinePending,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {overallProgress === 100 ? '\u2705' : '\uD83D\uDCE6'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textFaint }}>
                  Your finished project
                </div>
                <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
                  Output artifacts will appear here
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interrupt feedback */}
        {interruptFeedback && (
          <div
            style={{
              margin: '16px 0',
              padding: '12px 16px',
              background: 'rgba(75,142,232,0.06)',
              border: '1px solid rgba(75,142,232,0.12)',
              borderRadius: 12,
              animation: 'feedbackIn 0.25s ease-out',
            }}
          >
            <div style={{ fontSize: 13, color: C.accent, fontWeight: 500 }}>
              {'\u2713'} {interruptFeedback.text}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 4, fontStyle: 'italic' }}>
              &quot;{interruptFeedback.detail}&quot;
            </div>
          </div>
        )}

        {/* Controls */}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            onClick={onPause}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: `1px solid ${C.queryBorder}`,
              background: C.white,
              fontSize: 13,
              color: C.textSub,
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.accentSoft)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.white)}
          >
            {'\u23F8'} Pause
          </button>
          <button
            onClick={onStopAll}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: '1px solid rgba(232,91,91,0.15)',
              background: C.white,
              fontSize: 13,
              color: '#C45050',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(232,91,91,0.05)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = C.white)}
          >
            {'\u2715'} Cancel
          </button>
        </div>

        {/* User input bar */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInterrupt()}
            placeholder="Type feedback or a correction..."
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 12,
              border: `1px solid ${C.queryBorder}`,
              background: C.white,
              fontSize: 13,
              color: C.text,
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = C.accent)}
            onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = C.queryBorder)}
          />
          <button
            onClick={handleInterrupt}
            disabled={!userInput.trim()}
            style={{
              padding: '11px 18px',
              borderRadius: 12,
              border: 'none',
              background: userInput.trim() ? C.accent : C.spinePending,
              color: userInput.trim() ? 'white' : C.textFaint,
              fontSize: 13,
              fontWeight: 500,
              cursor: userInput.trim() ? 'pointer' : 'default',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>

        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8, textAlign: 'center' }}>
          Your feedback is routed to the right step - other work continues
        </div>
      </div>
    </div>
  );
}
