export default function LiveExample() {
  return (
    <div className="mx-auto grid md:grid-cols-2 gap-6" style={{ maxWidth: 960 }}>
      <div className="rounded-2xl border border-white/60 bg-white p-5">
        <div className="font-poppins text-lg mb-2" style={{ color: '#1d1d1f', fontWeight: 600 }}>Live example</div>
        <div className="w-full h-48 md:h-64 rounded-xl flex items-center justify-center mb-3" style={{ background: '#e7f0fd', color: '#475466' }}>
          Screenshot placeholder
        </div>
        <a href="#demo" className="font-poppins text-sm px-4 py-2 rounded-full" style={{ background: '#1b70db', color: '#fff' }}>Watch demo</a>
      </div>
      <div className="rounded-2xl border border-white/60 bg-white p-5">
        <div className="font-poppins text-lg mb-2" style={{ color: '#1d1d1f', fontWeight: 600 }}>Downloadable sample</div>
        <p className="font-eloquia text-base mb-3" style={{ color: '#475466' }}>A short plan/deck made by Kenoki.</p>
        <a href="#demo" className="font-poppins text-sm px-4 py-2 rounded-full border" style={{ color: '#1d1d1f', borderColor: '#D6E4F7' }}>See sample</a>
      </div>
    </div>
  );
}
