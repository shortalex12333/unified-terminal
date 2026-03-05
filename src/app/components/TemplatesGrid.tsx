type T = { t: string; d: string; time: string };

export default function TemplatesGrid() {
  const items: T[] = [
    { t: 'Website', d: '“Build me a modern portfolio site with a contact form.”', time: 'about 10 min' },
    { t: 'Research', d: '“Research competitors and pricing for a new coffee brand.”', time: 'about 10 min' },
    { t: 'Presentation', d: '“Create a pitch deck with speaker notes.”', time: 'about 10 min' },
    { t: 'Business plan', d: '“Write a simple plan and a go‑to‑market checklist.”', time: 'about 10 min' },
  ];

  return (
    <div className="mx-auto" style={{ maxWidth: 960 }}>
      <div className="grid md:grid-cols-3 gap-6">
        {items.map((it) => (
          <div key={it.t} className="p-6 rounded-2xl border border-white/60 bg-white">
            <div className="font-poppins text-lg" style={{ color: '#1d1d1f', fontWeight: 600 }}>{it.t}</div>
            <div className="font-eloquia text-base mt-1" style={{ color: '#475466' }}>{it.d}</div>
            <div className="font-poppins text-sm mt-3" style={{ color: '#1d1d1f' }}>{it.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
