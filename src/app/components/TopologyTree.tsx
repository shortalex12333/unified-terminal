import { motion } from 'motion/react'
import {
  Brain, MessageSquare, ClipboardList, Shield, Bone, Target, Ruler, PenTool,
  Layout, Image as ImageIcon, Send, Eye, CreditCard, Rocket, Github, CheckSquare,
  Lock, Zap, Activity, BookOpen, CloudLightning, Folder,
} from 'lucide-react'
import { NODES, nodeColor } from '../data/frames'
import type { TopologyNodeDef } from '../data/frames'
import type { LucideIcon } from 'lucide-react'

const Icons: Record<string, LucideIcon> = {
  Brain, MessageSquare, ClipboardList, Shield, Bone, Target, Ruler, PenTool,
  Layout, Image: ImageIcon, Send, Eye, CreditCard, Rocket, Github, CheckSquare,
  Lock, Zap, Activity, BookOpen, CloudLightning, Folder,
}

type TopologyTreeProps = {
  currentFrame: number
  progress: number
}

export default function TopologyTree({ currentFrame }: TopologyTreeProps) {
  const visibleNodes = NODES.filter(n => currentFrame >= n.appears)
  const maxVisibleY = visibleNodes.length > 0 ? Math.max(...visibleNodes.map(n => n.y)) : 0

  return (
    <div className="relative w-full" style={{ height: 730 }}>
      {/* Subtle background radial */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle at center, rgba(120,160,220,0.06) 0%, transparent 70%)',
        }}
      />

      {/* SVG connection lines — fixed viewBox, center=250 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 730" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="topo-glow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Main spine — background tube */}
        {maxVisibleY > 0 && (
          <>
            <line
              x1={250} y1={20} x2={250} y2={maxVisibleY + 20}
              stroke="rgba(0,0,0,0.06)" strokeWidth={4} strokeLinecap="round"
            />
            <motion.line
              x1={250} y1={20} x2={250} y2={maxVisibleY + 20}
              stroke="rgba(172,203,238,0.6)" strokeWidth={4} strokeLinecap="round"
              filter="url(#topo-glow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: currentFrame > 1 ? 1 : 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </>
        )}

        {/* Branch lines to each node */}
        {NODES.map(node => {
          const isVisible = currentFrame >= node.appears
          if (node.x === 0) return null
          const cx = 250
          const nx = cx + node.x
          const d = `M ${cx} ${node.y - 20} C ${cx} ${node.y}, ${nx} ${node.y}, ${nx} ${node.y}`

          return (
            <g key={`branch-${node.id}`}>
              <path d={d} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={4} strokeLinecap="round" />
              <motion.path
                d={d} fill="none" stroke="rgba(172,203,238,0.6)" strokeWidth={4} strokeLinecap="round"
                filter="url(#topo-glow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: isVisible ? 1 : 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease: 'easeInOut' }}
              />
            </g>
          )
        })}
      </svg>

      {/* Nodes as motion.div elements */}
      {NODES.map(node => (
        <NodeElement key={node.id} node={node} currentFrame={currentFrame} />
      ))}
    </div>
  )
}

function NodeElement({ node, currentFrame }: { node: TopologyNodeDef; currentFrame: number }) {
  const isVisible = currentFrame >= node.appears
  const isActive = node.activeFrames?.includes(currentFrame) ?? false
  const isInterrupted = node.interruptedFrames?.includes(currentFrame) ?? false
  const isUnaffected = node.unaffectedFrames?.includes(currentFrame) ?? false
  const color = nodeColor[node.type]
  const IconComponent = Icons[node.icon]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: isVisible ? (isUnaffected ? 0.3 : 1) : 0,
        scale: isVisible ? node.scale : 0.6,
      }}
      transition={{
        opacity: { duration: 0.4 },
        scale: { type: 'spring', stiffness: 200, damping: 15, mass: 1 },
      }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-default"
      style={{
        left: `calc(50% + ${node.x}px)`,
        top: node.y,
        zIndex: node.zIndex,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      {/* Glass sphere node */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center relative transition-all duration-500"
        style={{
          background: isInterrupted
            ? 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.25)), radial-gradient(circle at 50% 50%, rgba(240,138,138,0.15) 0%, transparent 80%)'
            : `linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.3)), radial-gradient(circle at 50% 50%, rgba(${color.rgb}, 0.12) 0%, transparent 80%)`,
          backdropFilter: 'blur(12px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
          border: isInterrupted
            ? '1px solid rgba(240,138,138,0.4)'
            : '1px solid rgba(255,255,255,0.5)',
          boxShadow: isInterrupted
            ? '0 4px 12px rgba(240,138,138,0.1), inset 0 1px 0 rgba(255,255,255,0.6)'
            : `0 4px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(255,255,255,0.3)`,
        }}
      >
        {/* Specular highlight */}
        <div className="absolute top-[6px] left-[10px] w-2 h-2 rounded-full bg-white/40 blur-[1px]" />

        {IconComponent && (
          <IconComponent
            size={20}
            className={isInterrupted ? 'text-[#F08A8A]' : 'text-[var(--text-secondary)]'}
            strokeWidth={1.5}
          />
        )}

        {/* Active pulse animation */}
        {isActive && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 56, height: 56,
              border: `1px solid rgba(${color.rgb}, 0.6)`,
              boxShadow: `0 0 20px rgba(${color.rgb}, 0.3), inset 0 0 10px rgba(${color.rgb}, 0.2)`,
            }}
            animate={{ scale: [0.85, 1], opacity: [0.8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}

        {/* Interrupted flash animation */}
        {isInterrupted && (
          <motion.div
            className="absolute inset-[-2px] rounded-full border border-[#F08A8A]"
            animate={{ opacity: [1, 0.2, 1], scale: [1, 1.05, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>

      {/* Label */}
      <span className="mt-2.5 text-[11px] font-medium text-[var(--text-muted)] whitespace-nowrap tracking-wide">
        {node.label}
      </span>

      {/* Tooltip on hover */}
      <div className="absolute top-[72px] opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--glass-bg)] backdrop-blur-[20px] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[12px] text-[var(--text-secondary)] whitespace-nowrap z-50 shadow-[0_8px_32px_rgba(0,0,0,0.08)] pointer-events-none font-medium">
        {node.desc}
      </div>
    </motion.div>
  )
}
