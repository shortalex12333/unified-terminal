export default function HeroProofCard() {
  return (
    <div className="mt-4 max-w-md mx-auto">
      <div className="rounded-2xl bg-white p-4 flex items-center justify-between" style={{ borderRadius: 16 }}>
        <div>
          <div className="font-poppins text-sm" style={{ color: '#1d1d1f', fontWeight: 600 }}>A portfolio site — live in about 10 minutes.</div>
          <div className="font-eloquia text-sm" style={{ color: '#475466' }}>Watch the exact build from download → preview → live link.</div>
        </div>
        <a href="#demo" aria-label="Watch 30-second demo" className="font-poppins text-sm px-3 py-2 rounded-full" style={{ background: '#1b70db', color: '#fff' }}>Watch demo</a>
      </div>
    </div>
  );
}
