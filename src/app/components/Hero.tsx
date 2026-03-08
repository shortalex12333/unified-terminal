'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import Spline from '@splinetool/react-spline'

const LETTERS = 'Kenoki'.split('')
const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

export default function Hero() {
  const [splineReady, setSplineReady] = useState(false)
  const [logoVisible, setLogoVisible] = useState(false)
  const [ctaVisible, setCtaVisible] = useState(false)

  useEffect(() => {
    if (!splineReady) return
    const logoTimer = setTimeout(() => setLogoVisible(true), 300)
    return () => clearTimeout(logoTimer)
  }, [splineReady])

  useEffect(() => {
    if (!logoVisible) return
    const ctaTimer = setTimeout(() => setCtaVisible(true), 900)
    return () => clearTimeout(ctaTimer)
  }, [logoVisible])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Spline 3D jellyfish background */}
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <Spline
          scene="/scene.splinecode"
          onLoad={() => setSplineReady(true)}
        />
      </div>

      {/* Loading placeholder — prevents flash during 10MB load */}
      <motion.div
        className="absolute inset-0 z-[1] pointer-events-none"
        animate={{ opacity: splineReady ? 0 : 1 }}
        transition={{ duration: 0.6 }}
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #8ab4e8, #d4e4f7)',
        }}
      />

      {/* Text overlay */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Blend-mode wrapper — only around the heading */}
        <div style={{ mixBlendMode: 'difference' }}>
          <h1
            className="font-bumbled"
            style={{
              fontSize: 'clamp(80px, 18vw, 228px)',
              lineHeight: 1,
              color: '#E8C4B0',
            }}
          >
            {LETTERS.map((char, i) => (
              <motion.span
                key={i}
                style={{ display: 'inline-block' }}
                initial={{ opacity: 0, y: 20 }}
                animate={logoVisible ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.5,
                  delay: i * 0.08,
                  ease: EASE_OUT_EXPO,
                }}
              >
                {char}
              </motion.span>
            ))}
          </h1>
        </div>

        {/* CTA group */}
        <motion.div
          className="flex flex-col items-center"
          style={{ marginTop: 44 }}
          initial={{ opacity: 0, y: 16 }}
          animate={ctaVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
        >
          <button
            className="btn-primary font-poppins"
            style={{ padding: '14px 36px', fontSize: 18 }}
          >
            Download
          </button>
          <p
            className="font-poppins"
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.7)',
              marginTop: 16,
            }}
          >
            It's Free.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
