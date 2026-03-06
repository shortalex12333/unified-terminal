export default function SafetySection() {
  const items = [
    {
      h: 'Privacy',
      d: 'Kenoki runs locally on your Mac. It reads only what’s inside the Kenoki window to ask questions, show progress, and save outputs. Projects save to your Documents.'
    },
    {
      h: 'Installer',
      d: 'To build things automatically, Kenoki installs a few standard tools once (like Node, Python, Git). You can view the list during setup and uninstall anytime.'
    },
    {
      h: 'Control',
      d: 'Pause or stop any build. Clean up the project folder with one click.'
    },
    {
      h: 'Usage estimate',
      d: 'Before long runs, Kenoki shows an estimate so you can decide.'
    },
  ];

  return (
    <div className="mx-auto" style={{ maxWidth: 960 }}>
      <div className="text-center mb-6">
        <h3 className="font-eloquia text-3xl" style={{ color: '#1d1d1f' }}>Safety & control</h3>
        <p className="font-eloquia text-base mt-1" style={{ color: '#4A4A4F' }}>Clear, simple safeguards you can see.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((b) => (
          <div key={b.h} className="rounded-2xl border border-white/60 bg-white p-5">
            <div className="font-poppins text-lg" style={{ color: '#1d1d1f', fontWeight: 600 }}>{b.h}</div>
            <div className="font-eloquia text-base mt-1" style={{ color: '#4A4A4F' }}>{b.d}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-white/60 bg-white p-5">
        <div className="font-poppins mb-2" style={{ color: '#1d1d1f', fontWeight: 600 }}>Pre‑run check (example)</div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-eloquia" style={{ color: '#1d1d1f' }}>This build will use some of your daily ChatGPT messages (estimate shown).</div>
          <div className="flex items-center gap-2">
            <button className="font-poppins text-sm px-4 py-2 rounded-full border" style={{ color: '#1d1d1f', borderColor: '#D6E4F7' }}>Cancel</button>
            <button className="font-poppins text-sm px-4 py-2 rounded-full" style={{ background: '#ACCBEE', color: '#1D1D1F' }}>Continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}
