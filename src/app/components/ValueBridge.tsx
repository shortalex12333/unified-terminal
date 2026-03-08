'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import Spline from '@splinetool/react-spline'
import { useInView } from '../hooks/useScrollProgress'
import GlassCard from './GlassCard'

const PILLS = ['Your AI', 'Your Mac', 'Your files'] as const

export default function ValueBridge() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const [splineReady, setSplineReady] = useState(false)

  return (
    <section ref={ref} className="relative overflow-hidden flex justify-center" style={{ padding: '128px 32px' }}>
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <Spline scene="/pale-iris.splinecode" onLoad={() => setSplineReady(true)} />
      </div>
      <motion.div
        className="absolute inset-0 z-[1] pointer-events-none"
        animate={{ opacity: splineReady ? 0 : 1 }}
        transition={{ duration: 0.6 }}
        style={{ background: 'var(--bg-primary)' }}
      />

      <GlassCard
        hover={false}
        padding="56px 48px"
        className="relative z-10 max-w-[800px] w-full"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.6s var(--ease-out-expo), transform 0.6s var(--ease-out-expo)',
        }}
      >
        <h2
          className="font-eloquia text-gradient-brand"
          style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}
        >
          ChatGPT talks. Kenoki builds.
        </h2>

        <p
          className="font-poppins"
          style={{
            fontSize: 18,
            color: 'var(--text-secondary)',
            marginTop: 22,
            lineHeight: 1.6,
          }}
        >
          You already pay for AI. But it can only do one thing at a time. Kenoki
          turns that subscription into a team of 32 specialists.
        </p>

        <div className="flex flex-wrap gap-3" style={{ marginTop: 32 }}>
          {PILLS.map((label, i) => (
            <span
              key={label}
              className="glass font-poppins"
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '10px 24px',
                fontSize: 15,
                color: 'var(--text-secondary)',
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(12px)',
                transition: `opacity 0.5s var(--ease-out-expo) ${300 + i * 100}ms, transform 0.5s var(--ease-out-expo) ${300 + i * 100}ms, background 0.3s ease, border-color 0.3s ease`,
                cursor: 'default',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(199, 166, 216, 0.12)'; e.currentTarget.style.borderColor = 'rgba(199, 166, 216, 0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = '' }}
            >
              {label}
            </span>
          ))}
        </div>
      </GlassCard>
    </section>
  )
}
