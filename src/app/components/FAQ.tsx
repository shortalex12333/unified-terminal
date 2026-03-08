import { useRef, useState } from 'react'
import { FAQ as faqData } from '../data/faq'
import type { FAQItem } from '../data/faq'
import { useInView } from '../hooks/useScrollProgress'
import GlassCard from './GlassCard'

export default function FAQSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const inView = useInView(sectionRef, 0.1)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => {
    setOpenIndex(prev => (prev === i ? null : i))
  }

  return (
    <section
      ref={sectionRef}
      className="px-8 py-32"
      style={{
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      <h2
        className="font-eloquia text-center mb-12"
        style={{
          fontSize: 'clamp(28px, 4vw, 42px)',
          color: 'var(--text-primary)',
          textShadow: '0 0 30px rgba(172, 203, 238, 0.15)',
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s var(--ease-out-expo), transform 0.6s var(--ease-out-expo)',
        }}
      >
        Questions you're thinking
      </h2>

      <div className="flex flex-col gap-5">
        {faqData.map((item: FAQItem, i: number) => {
          const isOpen = openIndex === i
          return (
            <GlassCard
              key={i}
              hover={!isOpen}
              active={isOpen}
              padding="0px"
              style={{
                overflow: 'hidden',
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(12px)',
                transition: `opacity 0.5s var(--ease-out-expo) ${i * 60}ms, transform 0.5s var(--ease-out-expo) ${i * 60}ms`,
                ...(isOpen ? { boxShadow: '0 14px 44px rgba(100,120,160,0.14), 0 4px 12px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.5)' } : {}),
              }}
            >
              <button
                type="button"
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between gap-4 text-left"
                style={{ padding: '22px 28px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span
                  className="font-poppins"
                  style={{
                    fontSize: 16,
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {item.q}
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.4s var(--ease-out-expo)',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div
                style={{
                  maxHeight: isOpen ? '500px' : '0px',
                  opacity: isOpen ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 0.5s var(--ease-out-expo), opacity 0.3s ease',
                }}
              >
                <div style={{ padding: '0 28px 24px' }}>
                  <p
                    className="font-poppins"
                    style={{
                      fontSize: 15,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            </GlassCard>
          )
        })}
      </div>
    </section>
  )
}
