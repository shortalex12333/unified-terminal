export default function TimelineFirstTen() {
  const steps = [
    { t: 'Download & open', d: 'No signup. No email. Just the app.' },
    { t: 'Answer 3 quick questions', d: 'Plain English. Skip anything you’re unsure about.' },
    { t: 'Watch it build & preview', d: 'Live progress. Open the preview when it’s ready.' },
  ];
  return (
    <div className="mx-auto" style={{ maxWidth: 960 }}>
      <div className="text-center mb-6">
        <h3 className="font-eloquia text-2xl md:text-3xl" style={{ color: '#1d1d1f' }}>
          From download to live result in about 10 minutes
        </h3>
        <p className="font-eloquia text-base mt-2" style={{ color: '#475466' }}>
          Here’s your first 10 minutes with Kenoki.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {steps.map((s, i) => (
          <div key={s.t} className="rounded-2xl border border-white/60 bg-white p-5">
            <div className="font-poppins text-sm mb-1" style={{ color: '#1d1d1f', opacity: 0.6 }}>Step {i + 1}</div>
            <div className="font-poppins text-lg" style={{ color: '#1d1d1f', fontWeight: 600 }}>{s.t}</div>
            <div className="font-eloquia text-base mt-1" style={{ color: '#475466' }}>{s.d}</div>
          </div>
        ))}
      </div>
      {/* Demo video embeds here when available */}
    </div>
  );
}
