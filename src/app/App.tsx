import { useState, lazy, Suspense } from 'react';
import { Monitor, Zap, Eye, Shield, ArrowRight } from 'lucide-react';
const AgentRootTree = lazy(() => import('./components/AgentRootTree'));
// PrivacyStrip removed from above the fold to reduce clutter
import TimelineFirstTen from './components/TimelineFirstTen';
import TemplatesGrid from './components/TemplatesGrid';
import GuidedSelector from './components/GuidedSelector';
import StickyMobileCTA from './components/StickyMobileCTA';
import HeroProofCard from './components/HeroProofCard';
import SafetySection from './components/SafetySection';
import SpineStory from './components/SpineStory';

export default function App() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div className="min-h-screen w-full" style={{ background: '#FAFAFA' }}>

      {/* ─── NAV ─── */}
      <nav className="w-full px-8 py-5 flex items-center justify-between max-w-5xl mx-auto">
        <span
          className="font-bumbled text-3xl bg-clip-text text-transparent select-none"
          style={{ backgroundImage: 'linear-gradient(135deg, #C7A6D8, #D9A6C7, #EAA7B6, #F1A8A6)' }}
          aria-label="Kenoki"
        >
          Kenoki
        </span>
        <span />
      </nav>

      {/* ─── HERO ─── */}
      <main role="main">
      <section className="px-6 pt-20 pb-6 mx-auto text-center" style={{ maxWidth: 960 }}>
        <h1
          className="font-bumbled bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(135deg, #C7A6D8, #D9A6C7, #EAA7B6, #F1A8A6)', letterSpacing: '-0.02em', fontSize: 64, lineHeight: '44px' }}
        >
          Kenoki
        </h1>
        <p className="font-eloquia text-2xl md:text-3xl mt-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em', maxWidth: '40ch', margin: '0 auto' }}>
          ChatGPT talks. Kenoki builds real things on your Mac.
        </p>
        <div className="mt-4">
          <a
            href="#download"
            aria-label="Begin with Kenoki on macOS"
            className="font-poppins inline-block rounded-full text-lg border-0 transition-colors btn-primary"
            style={{ padding: '0 24px', height: 48, lineHeight: '48px' }}
          >
            Begin
          </a>
          <div className="mt-3">
            <a href="#demo" className="font-poppins text-small link-secondary" aria-label="Watch 30-second demo">Watch 30‑second demo →</a>
          </div>
          <p className="font-poppins text-small mt-3" style={{ color: '#4A4A4F' }}>
            Runs locally. Reads only what’s in the Kenoki window to do the work. Saves to your Documents.
          </p>
        </div>
        {/* Spine story directly beneath Begin CTA */}
        <SpineStory />
      </section>

      {/* macOS first · Private beta badge can be moved lower if needed */}

      {/* ─── PROOF (fast) ─── */}
      <section className="px-6 py-12" style={{ background: '#ffffff' }}>
        <HeroProofCard />
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="px-6 py-16" style={{ background: '#ffffff' }}>
        <div className="mx-auto" style={{ maxWidth: 960 }}>
          <div className="text-center mb-6">
            <h2 className="font-eloquia text-3xl md:text-4xl" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
              Here’s your first 10 minutes with Kenoki.
            </h2>
          </div>
          <TimelineFirstTen />
        </div>
      </section>

      {/* ─── PROGRESS UI MOCK (demo) ─── */}
      <section className="px-6 py-16 mx-auto" style={{ maxWidth: 960 }}>
        <div className="relative max-w-lg mx-auto">
          <div className="relative rounded-[16px] bg-white shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E8EFF8] bg-[#FAFBFD]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              </div>
              <span className="font-poppins text-small" style={{ color: '#4A4A4F' }}>Kenoki</span>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <Suspense fallback={<div className="p-6 text-center font-eloquia" style={{ color: '#4A4A4F' }}>Loading demo…</div>}>
                <AgentRootTree />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="px-6 py-16" style={{ background: '#ffffff' }}>
        <div className="mx-auto" style={{ maxWidth: 960 }}>
          <div className="text-center mb-16">
            <h2 className="font-eloquia text-3xl md:text-4xl" style={{ color: '#1d1d1f' }}>
              Three steps. Zero config.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: '1',
                title: 'Sign in with your AI',
                desc: 'Open Kenoki and sign into your existing ChatGPT or Claude account. That\'s your engine — we just drive it better.',
                icon: <Monitor className="w-6 h-6" />,
              },
              {
                step: '2',
                title: 'Describe what you want',
                desc: '"Build me a landing page for my dog walking business." Kenoki asks a few smart questions, then gets to work.',
                icon: <Zap className="w-6 h-6" />,
              },
              {
                step: '3',
                title: 'Watch it get built',
                desc: 'See every step happen in real-time. Pages, images, code, tests — all orchestrated automatically. You stay in control.',
                icon: <Eye className="w-6 h-6" />,
              },
            ].map(({ step, title, desc, icon }) => (
              <div key={step} className="text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: '#e7f0fd', color: '#1d1d1f' }}>
                  {icon}
                </div>
                <h3 className="font-poppins text-xl" style={{ color: '#1d1d1f', fontWeight: 500 }}>{title}</h3>
                <p className="font-eloquia text-base leading-relaxed" style={{ color: '#4A4A4F' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GUIDED SELECTOR ─── */}
      <section className="px-6 py-16" style={{ background: '#ffffff' }}>
        <GuidedSelector />
      </section>

      {/* ─── WHAT YOU CAN BUILD ─── */}
      <section className="px-6 py-16" style={{ background: '#ffffff' }}>
          <div className="text-center mb-8">
            <h2 className="font-eloquia text-3xl md:text-4xl" style={{ color: '#1d1d1f' }}>
              First outcomes
            </h2>
            <p className="font-eloquia text-base mt-2" style={{ color: '#4A4A4F' }}>
              Five templates with time estimates.
            </p>
          </div>
        <TemplatesGrid />
      </section>

      {/* (Live example hidden until assets are ready) */}

      

      {/* (Provider details moved to FAQ; single‑line mention stays in hero) */}

      {/* (Comparison removed to reduce redundancy) */}

      {/* ─── SAFETY & CONTROL ─── */}
      <section className="px-6 py-16" style={{ background: '#ffffff' }}>
        <SafetySection />
      </section>

      {/* (Privacy/system sections trimmed to reduce clutter; trust shown near CTAs) */}

      {/* (Why section removed to avoid duplication) */}

      {/* ─── FAQ (top five) ─── */}
      <section className="px-6 py-16" style={{ background: '#ffffff' }}>
        <div className="mx-auto" style={{ maxWidth: 960 }}>
          <h2 className="font-eloquia text-3xl md:text-4xl text-center mb-10" style={{ color: '#1d1d1f' }}>
            Questions people ask
          </h2>
          <div className="space-y-6">
            {[ 
              { q: 'What is it?', a: 'A desktop app that makes your ChatGPT do the work for you.' },
              { q: 'What do I get?', a: 'Finished things — live sites, docs, research, decks — not instructions.' },
              { q: 'How fast?', a: 'About 10 minutes to a first live result (for example, a portfolio site).' },
              { q: 'How hard?', a: 'No keys, no setup, no terminal. Just tell us your goal.' },
              { q: 'Is it safe/free?', a: 'Runs on your Mac. Uses your ChatGPT. Free for personal use.' },
            ].map(({ q, a }) => (
              <div key={q} className="p-5 rounded-2xl border border-white/60 bg-white">
                <div className="font-poppins text-base mb-1" style={{ color: '#1d1d1f', fontWeight: 500 }}>{q}</div>
                <div className="font-eloquia text-base" style={{ color: '#4A4A4F' }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section id="download" className="px-6 py-24 text-center" style={{ background: '#e7f0fd' }}>
        <h2 className="font-eloquia text-4xl md:text-5xl" style={{ color: '#1d1d1f' }}>
          From idea to live link.
        </h2>
        <p className="font-eloquia text-xl mt-4" style={{ color: '#4A4A4F' }}>
          Works with the AI subscription you already have.
        </p>
        <div className="mt-8">
          <a
            href="#download"
            aria-label="Begin"
            className="font-poppins inline-block rounded-full text-lg border-0 transition-colors btn-primary"
            style={{ padding: '0 24px', height: 48, lineHeight: '48px' }}
          >
            Begin
          </a>
          <a id="demo" href="#demo" className="font-poppins text-small link-secondary ml-4">
            Watch 30‑sec demo →
          </a>
          <div className="mt-4 font-poppins text-small" style={{ color: '#4A4A4F' }}>
            Uninstall anytime
          </div>
          <div className="mt-4 max-w-3xl mx-auto text-left">
            <div className="grid md:grid-cols-3 gap-3">
              {[ 
                { h: 'Download', d: 'Open the app.' },
                { h: 'Tell us your goal', d: 'Answer 3 short questions.' },
                { h: 'See it ship', d: 'Open the live link.' },
              ].map(s => (
                <div key={s.h} className="rounded-2xl border border-white/60 bg-white p-4">
                  <div className="font-poppins text-sm" style={{ color: '#1d1d1f', fontWeight: 600 }}>{s.h}</div>
                  <div className="font-eloquia text-sm" style={{ color: '#4A4A4F' }}>{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="font-poppins text-xs mt-4" style={{ color: '#1d1d1f', opacity: 0.3 }}>
          v0.1.0 &middot; macOS 13+ &middot; 95 MB &middot; Apple‑notarized
        </p>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="px-6 py-6 text-center" style={{ background: '#e7f0fd' }}>
        <div className="flex items-center justify-center gap-4 mb-2">
          <a className="font-poppins text-small" style={{ color: '#4A4A4F' }} href="/terms.html">Terms</a>
          <a className="font-poppins text-small" style={{ color: '#4A4A4F' }} href="/privacy.html">Privacy</a>
          <a className="font-poppins text-small" style={{ color: '#4A4A4F' }} href="/uninstall.html">Uninstall</a>
          <a className="font-poppins text-small" style={{ color: '#4A4A4F' }} href="/support.html">Support</a>
          <a className="font-poppins text-small" style={{ color: '#4A4A4F' }} href="/roadmap.html">Roadmap</a>
        </div>
        <div className="font-eloquia text-sm" style={{ color: '#1d1d1f', opacity: 0.3 }}>
          Not affiliated with OpenAI or Anthropic • &copy; 2026 Kenoki
        </div>
      </footer>

      {/* Sticky CTA for mobile */}
      <StickyMobileCTA />
      </main>
    </div>
  );
}
