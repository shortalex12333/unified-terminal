export default function NoPlusPanel() {
  return (
    <div className="max-w-3xl mx-auto rounded-2xl border border-white/60 bg-white p-5 text-center">
      <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 600 }}>Don’t have ChatGPT Plus?</div>
      <div className="font-eloquia text-[15px] mt-1" style={{ color: '#475466' }}>
        Works best with Plus. Without it, try Preview mode and a sample project demo.
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <a href="#demo" className="font-poppins text-sm px-4 py-2 rounded-full border" style={{ color: '#1d1d1f', borderColor: '#D6E4F7' }}>Watch demo</a>
        <a href="https://chat.openai.com" target="_blank" rel="noreferrer" className="font-poppins text-sm px-4 py-2 rounded-full" style={{ background: '#1b70db', color: '#fff' }}>Get Plus</a>
      </div>
    </div>
  );
}
