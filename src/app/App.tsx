import Hero from './components/Hero'
import ValueBridge from './components/ValueBridge'
import Scrollytelling from './components/Scrollytelling'
import RolesGrid from './components/RolesGrid'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'

export default function App() {
  return (
    <div className="min-h-screen w-full" style={{ background: 'var(--bg-primary)' }}>
      <div className="grain-overlay" aria-hidden="true" />
      <Hero />
      <div style={{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, #F6F4FA 50%, var(--bg-primary) 100%)' }}>
        <ValueBridge />
      </div>
      <Scrollytelling />
      <div style={{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, #F4F6FC 50%, var(--bg-primary) 100%)' }}>
        <RolesGrid />
      </div>
      <div style={{ background: 'linear-gradient(180deg, var(--bg-primary) 0%, #FAF8F6 50%, var(--bg-primary) 100%)' }}>
        <FAQ />
      </div>
      <FinalCTA />
    </div>
  )
}
