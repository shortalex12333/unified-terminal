import { useEffect, useState } from 'react'

export default function StickyMobileCTA() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    setIsMac(/Macintosh|Mac OS X/i.test(ua));
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden" style={{ background: '#ffffffee', backdropFilter: 'blur(6px)', borderTop: '1px solid #E8EFF8' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="font-eloquia text-sm" style={{ color: '#1d1d1f' }}>Ready to try Kenoki?</div>
        {isMac ? (
          <a href="mailto:beta@kenoki.app" className="font-poppins text-sm px-4 py-2 rounded-full" style={{ background: '#1b70db', color: '#fff' }}>Join the beta</a>
        ) : (
          <div className="flex items-center gap-2">
            <a href="#demo" className="font-poppins text-sm px-4 py-2 rounded-full border" style={{ color: '#1d1d1f', borderColor: '#D6E4F7' }}>Watch demo</a>
            <a href="/support.html" className="font-poppins text-sm px-4 py-2 rounded-full" style={{ background: '#1b70db', color: '#fff' }}>Windows waitlist</a>
          </div>
        )}
      </div>
    </div>
  );
}
