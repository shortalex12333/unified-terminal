'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import Spline from '@splinetool/react-spline'
import { useInView } from '../hooks/useScrollProgress'

const FOOTER_LINKS = [
  { label: 'Terms', href: '#terms' },
  { label: 'Privacy', href: '#privacy' },
  { label: 'Support', href: '#support' },
  { label: 'Uninstall', href: '#uninstall' },
  { label: 'Roadmap', href: '#roadmap' },
]

export default function FinalCTA() {
  const contentRef = useRef<HTMLDivElement>(null)
  const inView = useInView(contentRef, 0.15)
  const [splineReady, setSplineReady] = useState(false)

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ padding: '96px 32px' }}
    >
      {/* Spline canvas */}
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <Spline
          scene="/particles-flow.splinecode"
          onLoad={() => setSplineReady(true)}
        />
      </div>

      {/* Loading placeholder */}
      <motion.div
        className="absolute inset-0 z-[1] pointer-events-none"
        animate={{ opacity: splineReady ? 0 : 1 }}
        transition={{ duration: 0.6 }}
        style={{ background: 'var(--bg-primary)' }}
      />

      <div
        ref={contentRef}
        className="relative z-10 flex flex-col items-center text-center gap-8"
      >
        {/* Kenoki wordmark */}
        <div style={{ mixBlendMode: 'difference' }}>
          <h2
            className="font-bumbled"
            style={{
              fontSize: 'clamp(64px, 12vw, 120px)',
              lineHeight: 1,
              color: '#E8C4B0',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.7s var(--ease-out-expo), transform 0.7s var(--ease-out-expo)',
            }}
          >
            Kenoki
          </h2>
        </div>

        {/* Tagline */}
        <p
          className="font-eloquia"
          style={{
            fontSize: 'clamp(20px, 3vw, 32px)',
            color: 'var(--text-primary)',
            textShadow: '0 0 30px rgba(120, 160, 220, 0.1)',
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.7s var(--ease-out-expo) 0.12s, transform 0.7s var(--ease-out-expo) 0.12s',
          }}
        >
          From idea to live link.
        </p>

        {/* Download button */}
        <div
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.7s var(--ease-out-expo) 0.24s, transform 0.7s var(--ease-out-expo) 0.24s',
          }}
        >
          <button
            className="btn-primary font-poppins"
            style={{ padding: '18px 56px', fontSize: 20, transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)' }}
          >
            Download for Mac
          </button>
        </div>

        {/* Small text */}
        <p
          className="font-poppins"
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            opacity: inView ? 1 : 0,
            transition: 'opacity 0.7s var(--ease-out-expo) 0.34s',
          }}
        >
          Free. macOS 13+.
        </p>

        {/* Footer links */}
        <nav
          className="flex flex-wrap justify-center gap-8 mt-16"
          style={{
            opacity: inView ? 1 : 0,
            transition: 'opacity 0.7s var(--ease-out-expo) 0.44s',
          }}
        >
          {FOOTER_LINKS.map((link, i) => (
            <a
              key={link.label}
              href={link.href}
              className="font-poppins"
              style={{
                fontSize: 13,
                color: 'var(--text-faint)',
                textDecoration: 'none',
                transition: 'color var(--duration-fast) ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.textDecoration = 'underline' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.textDecoration = 'none' }}
            >
              {link.label}
              {i < FOOTER_LINKS.length - 1 ? '' : ''}
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}
