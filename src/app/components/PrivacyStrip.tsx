export default function PrivacyStrip() {
  const items = [
    { label: 'Runs locally', desc: 'On your Mac' },
    { label: 'No keys', desc: 'No configs' },
    { label: 'Your subscriptions', desc: 'ChatGPT or Claude' },
    { label: 'No data harvesting', desc: 'Projects stay in Documents' },
  ];

  return (
    <div className="w-full px-6">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border border-white/60 bg-white px-4 py-3 text-center">
            <div className="font-poppins text-[13px]" style={{ color: '#1d1d1f', fontWeight: 600 }}>{it.label}</div>
            <div className="font-eloquia text-[12px]" style={{ color: '#475466' }}>{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
