export default function ComparisonTable() {
  const rows = [
    { k: 'What you get', chat: 'Instructions', ken: 'A finished thing', term: 'Depends on skills' },
    { k: 'Effort', chat: 'You do the steps', ken: 'We build it for you', term: 'You manage tools' },
    { k: 'Deploy', chat: 'Manual', ken: 'One‑click (e.g., Vercel)', term: 'Manual CI/CD' },
  ];
  return (
    <div className="max-w-5xl mx-auto rounded-2xl border border-white/60 bg-white overflow-hidden">
        <div className="grid grid-cols-4 text-sm font-poppins" style={{ background: '#FAFBFD', color: '#1d1d1f' }}>
          <div className="px-4 py-3">Aspect</div>
          <div className="px-4 py-3">ChatGPT web</div>
          <div className="px-4 py-3" style={{ fontWeight: 600 }}>Kenoki</div>
          <div className="px-4 py-3">Terminal tools</div>
        </div>
      {rows.map((r, i) => (
        <div key={r.k} className="grid grid-cols-4 text-[14px] font-eloquia" style={{ color: '#1d1d1f', background: i % 2 ? '#fff' : '#FEFEFF' }}>
            <div className="px-4 py-3" style={{ color: '#4A4A4F' }}>{r.k}</div>
          <div className="px-4 py-3">{r.chat}</div>
          <div className="px-4 py-3" style={{ fontWeight: 600 }}>{r.ken}</div>
          <div className="px-4 py-3">{r.term}</div>
        </div>
      ))}
    </div>
  );
}
