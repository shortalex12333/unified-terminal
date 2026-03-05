export default function ZeroRiskBadges() {
  const items = ['Runs locally', 'Saves to your Documents', 'Free for personal use'];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {items.map(i => (
        <span key={i} className="font-poppins text-[12px] rounded-full px-3 py-1" style={{ background: '#ffffff', color: '#475466', border: '1px solid #E8EFF8' }}>{i}</span>
      ))}
    </div>
  );
}
