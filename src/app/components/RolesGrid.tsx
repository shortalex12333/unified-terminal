'use client'

import { useRef, useState, useCallback } from 'react'
import Spline from '@splinetool/react-spline'
import {
  Brain, MessageSquare, ClipboardList, Shield, Bone, Target, Send, Eye,
  Activity, BookOpen, Layout, Image as ImageIcon, PenTool, Search, Ruler,
  CloudLightning, CheckSquare, Lock, Zap, CreditCard, Github, Database,
  Link as LinkIcon, Mail,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import GlassCard from './GlassCard'
import { useInView } from '../hooks/useScrollProgress'

type Role = {
  icon: LucideIcon
  label: string
  desc: string
}

const ROLES: Role[] = [
  { icon: Brain, label: 'Conductor', desc: 'Routes tasks to the right specialist' },
  { icon: MessageSquare, label: 'Intake', desc: 'Asks 3-4 simple questions to understand your vision' },
  { icon: ClipboardList, label: 'Planner', desc: 'Breaks complex projects into executable steps' },
  { icon: Shield, label: 'Bodyguard', desc: '11 safety checks before and after every action' },
  { icon: Bone, label: 'Spine', desc: 'Snapshots your project to catch unexpected changes' },
  { icon: Target, label: 'Skill Selector', desc: 'Picks the right expertise for each step' },
  { icon: Send, label: 'Messenger', desc: 'Passes compressed context between agents' },
  { icon: Eye, label: 'Warden', desc: 'Monitors memory usage, recycles agents' },
  { icon: Activity, label: 'Heartbeat', desc: 'Detects stuck workers, auto-restarts' },
  { icon: BookOpen, label: 'Archivist', desc: 'Saves everything, remembers where you left off' },
  { icon: Layout, label: 'Frontend', desc: 'Builds pages, layouts, and UI components' },
  { icon: ImageIcon, label: 'Image Gen', desc: 'Creates visuals via DALL-E when needed' },
  { icon: PenTool, label: 'Content', desc: 'Writes copy, descriptions, and documentation' },
  { icon: Search, label: 'Researcher', desc: 'Finds competitors, trends, and best practices' },
  { icon: Ruler, label: 'Scaffold', desc: 'Sets up project structure and boilerplate' },
  { icon: CloudLightning, label: 'Deploy', desc: 'Publishes your site to a live URL' },
  { icon: CheckSquare, label: 'Verifier', desc: 'Tests that everything works correctly' },
  { icon: Lock, label: 'Security', desc: 'Scans for vulnerabilities and secrets' },
  { icon: Zap, label: 'Performance', desc: 'Optimizes speed and loading times' },
  { icon: CreditCard, label: 'Payments', desc: 'Connects Stripe and payment flows' },
  { icon: Github, label: 'GitHub', desc: 'Version control and code management' },
  { icon: Database, label: 'Database', desc: 'Sets up data storage and queries' },
  { icon: LinkIcon, label: 'API', desc: 'Connects to external services and APIs' },
  { icon: Mail, label: 'Email', desc: 'Sets up contact forms and notifications' },
]

const ROLE_COLORS: Record<string, string> = {
  Conductor: 'rgba(199, 166, 216, 0.12)',
  Intake: 'rgba(199, 166, 216, 0.12)',
  Planner: 'rgba(199, 166, 216, 0.12)',
  'Skill Selector': 'rgba(199, 166, 216, 0.12)',
  Bodyguard: 'rgba(241, 168, 166, 0.12)',
  Spine: 'rgba(241, 168, 166, 0.12)',
  Security: 'rgba(241, 168, 166, 0.12)',
  Verifier: 'rgba(241, 168, 166, 0.12)',
  Messenger: 'rgba(172, 203, 238, 0.15)',
  Warden: 'rgba(172, 203, 238, 0.15)',
  Heartbeat: 'rgba(172, 203, 238, 0.15)',
  Archivist: 'rgba(172, 203, 238, 0.15)',
  Frontend: 'rgba(217, 166, 199, 0.12)',
  'Image Gen': 'rgba(217, 166, 199, 0.12)',
  Content: 'rgba(217, 166, 199, 0.12)',
  Researcher: 'rgba(217, 166, 199, 0.12)',
  Scaffold: 'rgba(217, 166, 199, 0.12)',
  Deploy: 'rgba(232, 196, 176, 0.15)',
  Performance: 'rgba(232, 196, 176, 0.15)',
  Payments: 'rgba(232, 196, 176, 0.15)',
  GitHub: 'rgba(232, 196, 176, 0.15)',
  Database: 'rgba(232, 196, 176, 0.15)',
  API: 'rgba(232, 196, 176, 0.15)',
  Email: 'rgba(232, 196, 176, 0.15)',
}

const textGlow = { textShadow: '0 0 30px rgba(120, 160, 220, 0.1)' }

export default function RolesGrid() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const inView = useInView(sectionRef, 0.1)
  const [splineReady, setSplineReady] = useState(false)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return
    const rect = gridRef.current.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setMousePos(null)
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden mx-auto px-8 py-32"
      style={{ maxWidth: 1100 }}
    >
      {/* Blurred rotating orb — atmospheric background */}
      <div
        className="absolute z-0 pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          width: '60vw',
          height: '60vw',
          maxWidth: 700,
          maxHeight: 700,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(30px)',
          opacity: 0.5,
        }}
        aria-hidden="true"
      >
        <Spline scene="/celestial-orb.splinecode" onLoad={() => setSplineReady(true)} />
      </div>

      <div className="relative z-10 text-center mb-12">
        <h2
          className="font-eloquia"
          style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            color: 'var(--text-primary)',
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s var(--ease-out-expo), transform 0.6s var(--ease-out-expo)',
            ...textGlow,
          }}
        >
          32 specialists. One conversation.
        </h2>
        <p
          className="font-poppins mt-5"
          style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 0.6s var(--ease-out-expo) 0.1s, transform 0.6s var(--ease-out-expo) 0.1s',
          }}
        >
          Every role activates only when needed. You never manage them.
        </p>
      </div>

      <div
        ref={gridRef}
        className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        style={{ gap: 20 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Cursor-following glow */}
        {mousePos && (
          <div
            className="absolute pointer-events-none z-0"
            style={{
              left: mousePos.x - 200,
              top: mousePos.y - 200,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(172, 203, 238, 0.35) 0%, rgba(199, 166, 216, 0.15) 40%, transparent 70%)',
              filter: 'blur(30px)',
              transition: 'left 0.15s ease-out, top 0.15s ease-out',
            }}
          />
        )}

        {ROLES.map((role, i) => {
          const delay = Math.min(i * 30, 600)
          const Icon = role.icon
          return (
            <RoleCard
              key={role.label}
              icon={Icon}
              label={role.label}
              desc={role.desc}
              delay={delay}
              inView={inView}
            />
          )
        })}
      </div>
    </section>
  )
}

function RoleCard({
  icon: Icon,
  label,
  desc,
  delay,
  inView,
}: {
  icon: LucideIcon
  label: string
  desc: string
  delay: number
  inView: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <GlassCard
      hover
      padding="20px"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.5s var(--ease-out-expo) ${delay}ms, transform 0.5s var(--ease-out-expo) ${delay}ms`,
        minHeight: 120,
        cursor: 'default',
      }}
    >
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ height: '100%', transition: 'all 0.3s ease' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: hovered
              ? (ROLE_COLORS[label] || 'rgba(172, 203, 238, 0.12)').replace(/[\d.]+\)$/, '0.25)')
              : (ROLE_COLORS[label] || 'rgba(172, 203, 238, 0.12)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: hovered ? 'translateY(-8px) scale(1.08)' : 'translateY(0) scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease',
          }}
        >
          <Icon
            size={20}
            className="text-[var(--text-muted)]"
            strokeWidth={1.5}
          />
        </div>
        <div
          className="font-poppins mt-2"
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
            transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {label}
        </div>
        <div
          className="font-poppins mt-1"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            opacity: hovered ? 1 : 0,
            maxHeight: hovered ? 60 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.3s ease, max-height 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
            overflow: 'hidden',
          }}
        >
          {desc}
        </div>
      </div>
    </GlassCard>
  )
}
