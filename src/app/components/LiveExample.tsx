export default function LiveExample() {
  return (
    <div className="mx-auto grid md:grid-cols-2 gap-6" style={{ maxWidth: 960 }}>
      <div className="rounded-2xl border border-white/60 bg-white p-5">
        <div className="font-poppins text-lg mb-2" style={{ color: '#1d1d1f', fontWeight: 600 }}>Live example</div>
        <div className="w-full h-48 md:h-64 rounded-xl flex items-center justify-center mb-3" style={{ background: '#e7f0fd', color: '#4A4A4F' }}>
          Screenshot placeholder
        </div>
        <a href="#demo" className="font-poppins text-small link-secondary">Watch demo →</a>
      </div>
      <div className="rounded-2xl border border-white/60 bg-white p-5">
        <div className="font-poppins text-lg mb-2" style={{ color: '#1d1d1f', fontWeight: 600 }}>Downloadable sample</div>
        <p className="font-eloquia text-base mb-3" style={{ color: '#4A4A4F' }}>A short plan/deck made by Kenoki.</p>
        <a href="#demo" className="font-poppins text-small link-secondary">See sample →</a>
      </div>
    </div>
  );
}
