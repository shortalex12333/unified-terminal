import { useEffect, useMemo, useRef, useState } from 'react'

type Frame = {
  id: string
  caption: string
}

const FRAMES: Frame[] = [
  { id: 'spine', caption: 'Understand and plan.' },
  { id: 'guards', caption: 'Stay in bounds.' },
  { id: 'elder', caption: 'Expand the plan.' },
  { id: 'intake', caption: 'Ask three questions.' },
  { id: 'scaffold', caption: 'Scaffold and build.' },
  { id: 'assets', caption: 'Create content.' },
  { id: 'wire', caption: 'Connect services.' },
  { id: 'test', caption: 'Check everything.' },
  { id: 'preview', caption: 'See it evolve.' },
  { id: 'deploy', caption: 'Go live when ready.' },
]

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

export default function SpineStory() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stickyRef = useRef<HTMLDivElement | null>(null)
  const [progress, setProgress] = useState(0)
  const prefersReduced = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  , [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let raf = 0
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight
        const scrolled = clamp(-rect.top, 0, total <= 0 ? 0 : total)
        const p = total > 0 ? scrolled / total : 0
        setProgress(p)
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const steps = FRAMES.length
  const frameFloat = progress * (steps - 1)
  const frameIndex = Math.round(frameFloat)

  // Keyboard navigation between frames
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (!stickyRef.current) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const next = clamp(frameIndex + (e.key === 'ArrowDown' ? 1 : -1), 0, steps - 1)
      const rect = el.getBoundingClientRect()
      const total = el.offsetHeight - window.innerHeight
      const target = total * (next / (steps - 1))
      const absoluteTop = window.scrollY + rect.top + target
      window.scrollTo({ top: absoluteTop, behavior: 'smooth' })
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [frameIndex, steps])

  // Right column (SVG spine) geometry
  const height = 520
  const pad = 24
  const spineY1 = pad
  const spineY2 = height - pad
  const spineLen = spineY2 - spineY1
  const grownLen = prefersReduced ? spineLen : spineLen * clamp(progress, 0, 1)

  // Node milestones along the spine (0..1 positions matching FRAMES)
  const nodePositions = useMemo(() => FRAMES.map((_, i) => (i / (FRAMES.length - 1))), [])

  return (
    <section aria-label="Kenoki spine story" ref={containerRef}
      tabIndex={0}
      className="px-6 mt-8"
      style={{ background: '#ffffff' }}
    >
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
        {/* Tall scroller; sticky inner columns */}
        <div style={{ height: `${Math.max(steps * 100, 200)}vh` }}>
          <div ref={stickyRef} className="grid md:grid-cols-12 gap-6" style={{ position: 'sticky', top: 64, alignItems: 'start' }}>
            {/* Left: App Viewer */}
            <div className="md:col-span-7">
              <div className="rounded-2xl bg-white" style={{ padding: 20, minHeight: height }}>
                {FRAMES.map((f, i) => {
                  const localAlpha = prefersReduced ? (i === frameIndex ? 1 : 0) : clamp(1 - Math.abs(frameFloat - i), 0, 1)
                  return (
                    <div key={f.id} aria-hidden={i !== frameIndex}
                      style={{
                        position: i === 0 ? 'relative' : 'absolute',
                        inset: 0,
                        opacity: localAlpha,
                        transition: prefersReduced ? 'none' : 'opacity 220ms ease',
                      }}
                    >
                      <div className="font-eloquia text-base mb-3" style={{ color: '#4A4A4F' }}>{f.caption}</div>
                      {/* Simple visual state per frame (calm Apple-like cards) */}
                      <div className="rounded-xl border border-white/60 bg-white" style={{ minHeight: 360, padding: 16 }}>
                        {f.id === 'spine' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Understanding what you need…</div>
                        )}
                        {f.id === 'guards' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Safety checks on — rails locked.</div>
                        )}
                        {f.id === 'elder' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Generating a clean plan…</div>
                        )}
                        {f.id === 'intake' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Answer 3 short questions.</div>
                        )}
                        {f.id === 'scaffold' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Scaffolding project files…</div>
                        )}
                        {f.id === 'assets' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Creating content and images…</div>
                        )}
                        {f.id === 'wire' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Connecting services…</div>
                        )}
                        {f.id === 'test' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Testing everything works…</div>
                        )}
                        {f.id === 'preview' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Open preview →</div>
                        )}
                        {f.id === 'deploy' && (
                          <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Publish when ready.</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: SVG Spine */}
            <div className="md:col-span-5">
              <div className="rounded-2xl bg-white" style={{ padding: 20, minHeight: height }}>
                <svg width="100%" height={height} viewBox={`0 0 220 ${height}`} role="img" aria-label="Kenoki build spine">
                  {/* Spine path */}
                  <defs>
                    <linearGradient id="spineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1D1D1F" />
                      <stop offset="100%" stopColor="#1D1D1F" />
                    </linearGradient>
                  </defs>
                  <g>
                    <line x1={40} x2={40} y1={spineY1} y2={spineY1 + grownLen}
                      stroke="url(#spineGrad)" strokeWidth={6} strokeLinecap="round" />
                  </g>

                  {/* Nodes that appear along the spine */}
                  {nodePositions.map((t, i) => {
                    const y = spineY1 + spineLen * t
                    const visible = prefersReduced ? (i <= frameIndex) : (progress >= t - 0.02)
                    const r = 6
                    const alpha = visible ? 1 : 0
                    const label = FRAMES[i].caption
                    return (
                      <g key={i} aria-label={label}>
                        <circle cx={40} cy={y} r={r} fill="#1D1D1F" opacity={alpha} />
                        <text x={60} y={y + 4} style={{ fill: '#4A4A4F', fontFamily: 'Poppins, sans-serif', fontSize: 14, opacity: alpha }}>{label}</text>
                      </g>
                    )
                  })}

                  {/* Light guide rail when guards active */}
                  {(!prefersReduced && progress > 0.1) && (
                    <rect x={28} y={spineY1 - 8} width={24} height={grownLen + 16} rx={12}
                      fill="none" stroke="#E8EFF8" strokeWidth={2} />
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Helper: hint for keyboard nav */}
        <div className="text-center mt-3">
          <span className="font-poppins text-small" style={{ color: '#4A4A4F' }}>Use ↑ ↓ to step frames • Respects reduced motion</span>
        </div>
      </div>
    </section>
  )
}

