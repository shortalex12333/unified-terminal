import { forwardRef } from 'react'

type GlassCardProps = {
  children: React.ReactNode
  className?: string
  hover?: boolean
  active?: boolean
  padding?: string
  fixedHeight?: boolean
  style?: React.CSSProperties
  onClick?: () => void
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className = '', hover = true, active = false, padding = '24px', fixedHeight = false, style, onClick }, ref) => (
    <div
      ref={ref}
      className={`glass ${hover ? 'glass-hover' : ''} ${active ? 'glass-active' : ''} ${className}`}
      style={{
        padding,
        boxShadow: '0 8px 32px rgba(100,120,160,0.1), 0 2px 6px rgba(0,0,0,0.05), inset 0 1.5px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.5)',
        position: 'relative',
        overflow: 'hidden',
        ...(fixedHeight ? { height: 420 } : {}),
        ...style,
      }}
      onClick={onClick}
    >
      {/* Top-edge highlight */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(199,166,216,0.1), transparent)',
        }}
      />
      {/* Liquid glass refraction sweep */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: 'linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.6) 42%, rgba(255, 255, 255, 0.2) 50%, transparent 58%)',
          pointerEvents: 'none',
          opacity: 0.85,
        }}
      />
      {/* Content */}
      <div className="relative z-10" style={{ height: '100%' }}>
        {children}
      </div>
      {/* Bottom inner glow */}
      <div
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(255,255,255,0.3), transparent)',
        }}
      />
    </div>
  )
)

GlassCard.displayName = 'GlassCard'
export default GlassCard
