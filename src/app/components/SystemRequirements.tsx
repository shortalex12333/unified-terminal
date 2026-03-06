export default function SystemRequirements() {
  const items = [
    { h: 'macOS 13+', d: 'Apple‑notarized. Gatekeeper‑safe.' },
    { h: 'Memory', d: '8 GB RAM recommended.' },
    { h: 'Disk space', d: '≈ 1.5–3 GB for one‑time tool install.' },
    { h: 'Install time', d: '5–10 minutes on first run. Runs in background.' },
    { h: 'What gets installed', d: 'Node, Python, Git, and required build tools — so projects run automatically.' },
  ];
  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="font-eloquia text-3xl" style={{ color: '#1d1d1f' }}>System & setup</h3>
        <p className="font-eloquia text-base mt-1" style={{ color: '#4A4A4F' }}>Everything you need is installed once.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((b) => (
          <div key={b.h} className="rounded-2xl border border-white/60 bg-white p-5">
            <div className="font-poppins text-lg" style={{ color: '#1d1d1f', fontWeight: 600 }}>{b.h}</div>
            <div className="font-eloquia text-base mt-1" style={{ color: '#4A4A4F' }}>{b.d}</div>
          </div>
        ))}
      </div>
      <div className="text-center mt-4">
        <span className="font-poppins text-small rounded-full px-3 py-1" style={{ background: '#ffffff', color: '#4A4A4F', border: '1px solid #E8EFF8' }}>Not affiliated with OpenAI or Anthropic</span>
      </div>
    </div>
  );
}
