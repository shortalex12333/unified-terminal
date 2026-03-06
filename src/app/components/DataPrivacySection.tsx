export default function DataPrivacySection() {
  const bullets = [
    { h: 'Credentials', d: 'You sign in inside Kenoki. macOS Keychain stores credentials. We can’t see them.' },
    { h: 'Local by default', d: 'Projects save to Documents/Kenoki. We only access folders you choose.' },
    { h: 'Telemetry', d: 'No tracking by default. Optional diagnostics are off.' },
    { h: 'Uninstall', d: 'Drag app to Trash. Delete Documents/Kenoki to remove projects.' },
  ];
  return (
    <div className="mx-auto" style={{ maxWidth: 960 }}>
      <div className="text-center mb-6">
        <h3 className="font-eloquia text-3xl" style={{ color: '#1d1d1f' }}>Your data, your Mac</h3>
        <p className="font-eloquia text-base mt-1" style={{ color: '#4A4A4F' }}>We do not sell or share your data.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {bullets.map((b) => (
          <div key={b.h} className="rounded-2xl border border-white/60 bg-white p-5">
            <div className="font-poppins text-lg" style={{ color: '#1d1d1f', fontWeight: 600 }}>{b.h}</div>
            <div className="font-eloquia text-base mt-1" style={{ color: '#4A4A4F' }}>{b.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
