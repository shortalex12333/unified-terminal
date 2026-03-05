import { useState } from 'react'

const OPTIONS = [
  { k: 'website', t: 'Website', ex: 'Build me a modern portfolio site with a contact form.' },
  { k: 'research', t: 'Research', ex: 'Research the protein powder market: competitors, pricing, trends.' },
  { k: 'plan', t: 'Business plan', ex: 'Create a simple plan: audience, pricing, differentiation, next steps.' },
  { k: 'presentation', t: 'Presentation', ex: 'Make a 10‑slide pitch deck with speaker notes for investors.' },
];

export default function GuidedSelector() {
  const [sel, setSel] = useState(OPTIONS[0]);
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="font-eloquia text-3xl" style={{ color: '#1d1d1f' }}>What should I ask for?</h3>
        <p className="font-eloquia text-base mt-1" style={{ color: '#475466' }}>Pick a goal to see an example prompt.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        {OPTIONS.map(o => (
          <button key={o.k} onClick={() => setSel(o)} className="px-4 py-2 rounded-full font-poppins text-sm" style={{ background: sel.k === o.k ? '#1b70db' : '#e7f0fd', color: sel.k === o.k ? '#fff' : '#1d1d1f' }}>{o.t}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/60 bg-white p-5 text-center">
        <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Example prompt</div>
        <div className="font-eloquia text-base mt-1" style={{ color: '#475466' }}>{sel.ex}</div>
      </div>
    </div>
  );
}
