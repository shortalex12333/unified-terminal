import { useRef, useState, useMemo } from 'react'
import Spline from '@splinetool/react-spline'
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import TopologyTree from './TopologyTree'
import UserView from './UserView'
import { FRAMES } from '../data/frames'

const GLOW_COLORS: Record<number, { color: string; x: string; y: string }> = {
  1: { color: '#C7A6D8', x: '-10%', y: '-10%' },
  2: { color: '#C7A6D8', x: '-5%', y: '0%' },
  3: { color: '#C7A6D8', x: '0%', y: '10%' },
  4: { color: '#D9A6C7', x: '20%', y: '20%' },
  5: { color: '#D9A6C7', x: '30%', y: '25%' },
  6: { color: '#D9A6C7', x: '40%', y: '30%' },
  7: { color: '#ACCBEE', x: '60%', y: '40%' },
  8: { color: '#ACCBEE', x: '65%', y: '45%' },
  9: { color: '#ACCBEE', x: '70%', y: '50%' },
  10: { color: '#F1A8A6', x: '80%', y: '80%' },
  11: { color: '#F1A8A6', x: '85%', y: '85%' },
}

export default function Scrollytelling() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })
  const [frame, setFrame] = useState(1)
  const [splineReady, setSplineReady] = useState(false)

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const newFrame = Math.min(11, Math.max(1, Math.floor(latest * 11) + 1))
    setFrame(newFrame)
  })

  const progress = useMemo(() => (frame - 1) / 10, [frame])
  const glow = GLOW_COLORS[frame] || GLOW_COLORS[1]

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: `${FRAMES.length * 100}vh` }}
    >
      {/* Scroll progress indicator */}
      <div
        className="fixed top-0 right-0 z-50"
        style={{
          width: 2,
          height: `${progress * 100}vh`,
          background: 'var(--accent-blue)',
          opacity: 0.25,
          transition: 'height 0.1s linear',
        }}
      />

      {/* Sticky viewport */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        {/* Blurred Spline orb — atmospheric background */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ filter: 'blur(40px)', opacity: 0.35 }}
          aria-hidden="true"
        >
          <Spline scene="/celestial-orb.splinecode" />
        </div>

        {/* Caption with AnimatePresence */}
        <div className="absolute top-[5vh] left-0 right-0 h-20 flex items-center justify-center px-4 z-20 relative z-10">
          <AnimatePresence mode="wait">
            <motion.h2
              key={frame}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4 }}
              className="font-eloquia text-center tracking-tight"
              style={{
                fontSize: 'clamp(24px, 3vw, 34px)',
                color: 'var(--text-primary)',
                textShadow: '0 0 40px rgba(199, 166, 216, 0.2)',
              }}
            >
              {FRAMES[frame - 1]?.caption}
            </motion.h2>
          </AnimatePresence>
        </div>

        {/* Two-column layout */}
        <div className="max-w-[1100px] w-full px-8 lg:px-12 grid grid-cols-1 md:grid-cols-2 gap-20 mt-[6vh] items-start relative z-10">
          {/* Left column */}
          <div className="flex flex-col relative">
            <p className="text-[12px] uppercase tracking-[0.15em] text-[var(--text-faint)] font-semibold mb-8 text-center font-poppins">
              What you see
            </p>

            {/* Ambient glow behind card */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-visible flex items-center justify-center">
              <div
                className="w-[400px] h-[400px] rounded-full blur-[80px] absolute"
                style={{
                  backgroundColor: glow.color,
                  opacity: 0.40,
                  transform: `translate(${glow.x}, ${glow.y})`,
                  transition: 'all 1s ease-in-out',
                }}
              />
            </div>

            {/* Card content with AnimatePresence crossfade */}
            <div className="relative z-10" style={{ height: 420 }}>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={frame}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0"
                >
                  <UserView data={FRAMES[frame - 1]?.left} progress={1} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col items-center relative">
            <p className="text-[12px] uppercase tracking-[0.15em] text-[var(--text-faint)] font-semibold mb-8 text-center font-poppins hidden md:block">
              What happens
            </p>

            <TopologyTree currentFrame={frame} progress={progress} />
          </div>
        </div>
      </div>

      {/* Scroll-down indicator */}
      <AnimatePresence>
        {frame < 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 text-[var(--text-faint)] text-sm flex flex-col items-center gap-2 pointer-events-none z-50 font-medium font-poppins"
          >
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowUp className="rotate-180 text-[#ACCBEE]" size={20} />
            </motion.div>
            Scroll to orchestrate
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
