import { useState, useEffect, useRef } from "react";

/*
 * Agent Root Tree — Soft hue vertical pipeline visualization
 * 
 * Design: Pill-radius rounded bars flowing vertically top→down.
 * Main spine on the left, branches fork right for parallel agents,
 * sub-branches fork within branches for sub-agents.
 * Soft blue-white watercolour hues. Progress fills downward.
 * Completed = full opacity. Active = animated pulse. Pending = faint.
 */

// ── MOCK DATA (simulates Status Agent IPC events) ─────────────────────────

const MOCK_TREE = [
  {
    id: "intake",
    label: "Understanding your vision",
    state: "done",
    progress: 100,
    elapsed: "0:04",
    children: [],
  },
  {
    id: "scaffold",
    label: "Setting up your project",
    state: "done",
    progress: 100,
    elapsed: "0:38",
    children: [
      { id: "scaffold-1", label: "Project structure", state: "done", progress: 100, children: [] },
      { id: "scaffold-2", label: "Dependencies", state: "done", progress: 100, children: [] },
    ],
  },
  {
    id: "pages",
    label: "Building your pages",
    state: "active",
    progress: 65,
    children: [
      { id: "page-home", label: "Homepage layout", state: "done", progress: 100, children: [] },
      { id: "page-nav", label: "Navigation", state: "done", progress: 100, children: [] },
      {
        id: "page-products",
        label: "Product gallery",
        state: "active",
        progress: 40,
        children: [
          { id: "prod-grid", label: "Grid layout", state: "done", progress: 100, children: [] },
          { id: "prod-cards", label: "Product cards", state: "active", progress: 50, children: [] },
          { id: "prod-filter", label: "Filter bar", state: "pending", progress: 0, children: [] },
        ],
      },
      { id: "page-footer", label: "Footer", state: "pending", progress: 0, children: [] },
    ],
  },
  {
    id: "images",
    label: "Creating brand images",
    state: "active",
    progress: 55,
    parallel: true,
    children: [
      { id: "img-hero", label: "Hero banner", state: "done", progress: 100, children: [] },
      { id: "img-products", label: "Product photos", state: "active", progress: 30, children: [] },
      { id: "img-logo", label: "Brand mark", state: "pending", progress: 0, children: [] },
    ],
  },
  {
    id: "payments",
    label: "Setting up payments",
    state: "pending",
    progress: 0,
    children: [],
  },
  {
    id: "testing",
    label: "Testing everything",
    state: "pending",
    progress: 0,
    children: [],
  },
  {
    id: "deploy",
    label: "Publishing your site",
    state: "pending",
    progress: 0,
    children: [],
  },
];

const QUERY_MOCK = {
  active: true,
  question: "What style should your site have?",
  options: [
    { label: "Minimal", detail: "Clean, lots of whitespace", icon: "◻" },
    { label: "Bold", detail: "Strong colours, big type", icon: "◼" },
    { label: "Playful", detail: "Fun, rounded, colourful", icon: "●" },
  ],
  timeoutSeconds: 25,
};

// ── COLORS & CONSTANTS ────────────────────────────────────────────────────

const C = {
  bg: "#F7F9FC",
  spine: "#D6E4F7",
  spineDone: "#A8C4E8",
  spineActive: "#7BAAF0",
  spinePending: "#E8EFF8",
  branchDone: "#B8D4F0",
  branchActive: "#8AB8F4",
  branchPending: "#E0EAF5",
  dot: "#5B9BF0",
  dotDone: "#4A8DE0",
  dotActive: "#3B7FD9",
  dotPending: "#C8D8EC",
  text: "#2C3E5A",
  textSub: "#6B7F9A",
  textFaint: "#9CADC4",
  accent: "#4B8EE8",
  accentSoft: "rgba(75,142,232,0.08)",
  white: "#FFFFFF",
  queryBg: "rgba(75,142,232,0.06)",
  queryBorder: "rgba(75,142,232,0.15)",
  errorSoft: "#F8D7DA",
  pauseSoft: "#FFF3CD",
};

const SPINE_W = 6;
const BRANCH_W = 4;
const SUB_BRANCH_W = 3;
const DOT_R = 5;
const INDENT = 32;

// ── COMPONENT ─────────────────────────────────────────────────────────────

export default function AgentRootTree() {
  const [tree, setTree] = useState(MOCK_TREE);
  const [expanded, setExpanded] = useState(new Set(["pages", "images", "page-products"]));
  const [query, setQuery] = useState(QUERY_MOCK);
  const [queryTimer, setQueryTimer] = useState(QUERY_MOCK.timeoutSeconds);
  const [userInput, setUserInput] = useState("");
  const [interruptFeedback, setInterruptFeedback] = useState(null);
  const scrollRef = useRef(null);

  // Countdown timer for query
  useEffect(() => {
    if (!query?.active || queryTimer <= 0) return;
    const t = setTimeout(() => setQueryTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [query, queryTimer]);

  // Simulate live progress (slow, smooth updates)
  useEffect(() => {
    const interval = setInterval(() => {
      setTree((prev) =>
        prev.map((node) => {
          if (node.state === "active" && node.progress < 95) {
            return {
              ...node,
              progress: Math.min(node.progress + Math.random() * 1.5, 95),
              children: node.children.map((c) =>
                c.state === "active" && c.progress < 95
                  ? {
                      ...c,
                      progress: Math.min(c.progress + Math.random() * 2, 95),
                      children: c.children?.map((sc) =>
                        sc.state === "active"
                          ? { ...sc, progress: Math.min(sc.progress + Math.random() * 2.5, 95) }
                          : sc
                      ) || [],
                    }
                  : c
              ),
            };
          }
          return node;
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleInterrupt = () => {
    if (!userInput.trim()) return;
    setInterruptFeedback({
      text: `Got it — updating based on your feedback`,
      detail: `"${userInput.trim()}"`,
    });
    setUserInput("");
    setTimeout(() => setInterruptFeedback(null), 4000);
  };

  const overallProgress = Math.round(
    tree.reduce((sum, n) => sum + (n.progress || 0), 0) / tree.length
  );

  // ── NODE DOT ──────────────────────────────────────────────────────────

  const Dot = ({ state, size = DOT_R }) => {
    const colors = {
      done: C.dotDone,
      active: C.dotActive,
      pending: C.dotPending,
      error: "#E85B5B",
      paused: "#E8B85B",
      waiting_user: C.accent,
    };
    return (
      <div
        style={{
          width: size * 2,
          height: size * 2,
          borderRadius: "50%",
          background: colors[state] || C.dotPending,
          flexShrink: 0,
          position: "relative",
        }}
      >
        {state === "active" && (
          <div
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${C.accent}`,
              animation: "dotPulse 2s ease-in-out infinite",
            }}
          />
        )}
        {state === "done" && (
          <svg
            viewBox="0 0 10 10"
            style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
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
  };

  // ── SPINE BAR (vertical connector) ────────────────────────────────────

  const SpineBar = ({ height, state, width = SPINE_W, progress = 100 }) => {
    const bgColor = state === "done" ? C.spineDone : state === "active" ? C.spine : C.spinePending;
    const fillColor = state === "active" ? C.spineActive : "transparent";
    return (
      <div
        style={{
          width: width,
          height: height,
          borderRadius: width,
          background: bgColor,
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {state === "active" && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: `${progress}%`,
              background: fillColor,
              borderRadius: width,
              transition: "height 0.6s ease-out",
            }}
          />
        )}
      </div>
    );
  };

  // ── BRANCH CONNECTOR (horizontal + vertical) ─────────────────────────

  const BranchConnector = ({ state }) => {
    const color =
      state === "done" ? C.branchDone : state === "active" ? C.branchActive : C.branchPending;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", marginLeft: -BRANCH_W / 2 }}>
        <div
          style={{
            width: INDENT - 8,
            height: BRANCH_W,
            borderRadius: BRANCH_W,
            background: color,
          }}
        />
      </div>
    );
  };

  // ── NODE ROW ──────────────────────────────────────────────────────────

  const NodeRow = ({ node, depth = 0, isLast = false }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isParallel = node.parallel;
    const barWidth = depth === 0 ? SPINE_W : depth === 1 ? BRANCH_W : SUB_BRANCH_W;

    return (
      <div style={{ animation: "none" }}>
        {/* Main row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 0",
            cursor: hasChildren ? "pointer" : "default",
          }}
          onClick={() => hasChildren && toggleExpand(node.id)}
        >
          <Dot state={node.state} size={depth === 0 ? DOT_R : DOT_R - 1} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: depth === 0 ? 14 : 13,
                fontWeight: depth === 0 ? 500 : 400,
                color: node.state === "pending" ? C.textFaint : C.text,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isParallel && (
                <span
                  style={{
                    fontSize: 9,
                    background: C.accentSoft,
                    color: C.accent,
                    padding: "1px 6px",
                    borderRadius: 8,
                    fontWeight: 500,
                    letterSpacing: "0.03em",
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
                    transition: "transform 0.2s",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                    display: "inline-block",
                  }}
                >
                  ▸
                </span>
              )}
            </div>
            {node.state === "active" && (
              <div
                style={{
                  marginTop: 4,
                  height: 3,
                  borderRadius: 3,
                  background: C.spinePending,
                  overflow: "hidden",
                  maxWidth: 140,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${node.progress}%`,
                    background: `linear-gradient(90deg, ${C.spineActive}, ${C.accent})`,
                    borderRadius: 3,
                    transition: "width 0.6s ease-out",
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
            <div style={{ position: "relative" }}>
              {/* The vertical spine of this branch group */}
              <div
                style={{
                  position: "absolute",
                  left: -(INDENT - 16),
                  top: 0,
                  bottom: 0,
                  width: barWidth,
                  borderRadius: barWidth,
                  background:
                    node.state === "done"
                      ? C.branchDone
                      : node.state === "active"
                      ? C.spine
                      : C.branchPending,
                  opacity: 0.6,
                }}
              />

              {node.children.map((child, i) => (
                <div key={child.id} style={{ position: "relative" }}>
                  {/* Horizontal branch connector */}
                  <div
                    style={{
                      position: "absolute",
                      left: -(INDENT - 16),
                      top: 16,
                      width: INDENT - 20,
                      height: barWidth - 1,
                      borderRadius: barWidth,
                      background:
                        child.state === "done"
                          ? C.branchDone
                          : child.state === "active"
                          ? C.branchActive
                          : C.branchPending,
                      opacity: 0.6,
                    }}
                  />

                  <NodeRow
                    node={child}
                    depth={depth + 1}
                    isLast={i === node.children.length - 1}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── QUERY WIDGET ────────────────────────────────────────────────────

  const QueryWidget = () => {
    if (!query?.active) return null;
    return (
      <div
        style={{
          margin: "12px 0",
          padding: "16px 18px",
          background: C.queryBg,
          border: `1px solid ${C.queryBorder}`,
          borderRadius: 14,
          animation: "none",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 12 }}>
          {query.question}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {query.options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setQuery({ ...query, active: false })}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: `1px solid ${C.queryBorder}`,
                background: C.white,
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minWidth: 90,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.accentSoft;
                e.currentTarget.style.borderColor = C.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = C.white;
                e.currentTarget.style.borderColor = C.queryBorder;
              }}
            >
              <span style={{ fontSize: 18 }}>{opt.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{opt.label}</span>
              <span style={{ fontSize: 11, color: C.textSub }}>{opt.detail}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 10 }}>
          Auto-selecting "{query.options[0].label}" in {queryTimer}s
        </div>
      </div>
    );
  };

  // ── MAIN RENDER ─────────────────────────────────────────────────────

  return (
    <div
      style={{
        fontFamily: "'SF Pro Display', 'SF Pro Text', -apple-system, system-ui, sans-serif",
        background: C.bg,
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <style>{`
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
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        input { font-family: inherit; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>
            Setting up your project...
          </h1>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                flex: 1,
                height: 5,
                borderRadius: 5,
                background: C.spinePending,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${overallProgress}%`,
                  background: `linear-gradient(90deg, ${C.spineDone}, ${C.accent})`,
                  borderRadius: 5,
                  transition: "width 0.8s ease-out",
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500, flexShrink: 0 }}>
              {overallProgress}%
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.textFaint, marginTop: 6 }}>
            ~12 minutes remaining
          </div>
        </div>

        {/* Tree */}
        <div ref={scrollRef} style={{ position: "relative" }}>
          {/* Main spine bar (behind everything) */}
          <div
            style={{
              position: "absolute",
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
                width: "100%",
                height: `${overallProgress}%`,
                borderRadius: SPINE_W,
                background: `linear-gradient(180deg, ${C.spineDone}, ${C.spineActive})`,
                transition: "height 0.8s ease-out",
              }}
            />
          </div>

          {/* Nodes */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {tree.map((node, i) => (
              <div key={node.id}>
                <NodeRow node={node} depth={0} isLast={i === tree.length - 1} />

                {/* Query widget appears after the active building step */}
                {node.id === "pages" && query?.active && <QueryWidget />}
              </div>
            ))}

            {/* Final output node */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 0",
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: DOT_R * 2 + 4,
                  height: DOT_R * 2 + 4,
                  borderRadius: 6,
                  background: C.spinePending,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                📦
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textFaint }}>
                  Your finished site
                </div>
                <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>
                  Live URL, project files, performance report
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interrupt feedback */}
        {interruptFeedback && (
          <div
            style={{
              margin: "16px 0",
              padding: "12px 16px",
              background: "rgba(75,142,232,0.06)",
              border: `1px solid rgba(75,142,232,0.12)`,
              borderRadius: 12,
              animation: "feedbackIn 0.25s ease-out",
            }}
          >
            <div style={{ fontSize: 13, color: C.accent, fontWeight: 500 }}>
              ✓ {interruptFeedback.text}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 4, fontStyle: "italic" }}>
              {interruptFeedback.detail}
            </div>
          </div>
        )}

        {/* Controls */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: `1px solid ${C.queryBorder}`,
              background: C.white,
              fontSize: 13,
              color: C.textSub,
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.accentSoft)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.white)}
          >
            ⏸ Pause
          </button>
          <button
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid rgba(232,91,91,0.15)",
              background: C.white,
              fontSize: 13,
              color: "#C45050",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232,91,91,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.white)}
          >
            ✕ Cancel
          </button>
        </div>

        {/* User input bar */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInterrupt()}
            placeholder="Type feedback or a correction..."
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 12,
              border: `1px solid ${C.queryBorder}`,
              background: C.white,
              fontSize: 13,
              color: C.text,
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = C.queryBorder)}
          />
          <button
            onClick={handleInterrupt}
            disabled={!userInput.trim()}
            style={{
              padding: "11px 18px",
              borderRadius: 12,
              border: "none",
              background: userInput.trim() ? C.accent : C.spinePending,
              color: userInput.trim() ? "white" : C.textFaint,
              fontSize: 13,
              fontWeight: 500,
              cursor: userInput.trim() ? "pointer" : "default",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>

        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8, textAlign: "center" }}>
          Your feedback is routed to the right step — other work continues
        </div>
      </div>
    </div>
  );
}
