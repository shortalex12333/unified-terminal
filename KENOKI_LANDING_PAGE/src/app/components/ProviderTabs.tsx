import { useState } from 'react'

export default function ProviderTabs() {
  const [tab, setTab] = useState<'chatgpt' | 'anthropic'>('chatgpt');
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-4">
        <button
          onClick={() => setTab('chatgpt')}
          className={`px-4 py-2 rounded-full font-poppins text-sm ${tab === 'chatgpt' ? 'text-white' : ''}`}
          style={{ background: tab === 'chatgpt' ? '#1b70db' : '#e7f0fd', color: tab === 'chatgpt' ? '#fff' : '#1d1d1f' }}
        >
          ChatGPT
        </button>
        <button
          onClick={() => setTab('anthropic')}
          className={`px-4 py-2 rounded-full font-poppins text-sm ${tab === 'anthropic' ? 'text-white' : ''}`}
          style={{ background: tab === 'anthropic' ? '#1b70db' : '#e7f0fd', color: tab === 'anthropic' ? '#fff' : '#1d1d1f' }}
        >
          Anthropic
        </button>
      </div>
      <div className="rounded-2xl border border-white/60 bg-white p-5 text-center">
        {tab === 'chatgpt' ? (
          <div>
            <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Use the subscription you already have</div>
            <div className="font-eloquia text-[15px] mt-1" style={{ color: '#475466' }}>
              Sign into ChatGPT inside Kenoki. That’s your engine — we just drive it better.
            </div>
          </div>
        ) : (
          <div>
            <div className="font-poppins" style={{ color: '#1d1d1f', fontWeight: 500 }}>Prefer Claude? That works too</div>
            <div className="font-eloquia text-[15px] mt-1" style={{ color: '#475466' }}>
              Connect Claude Pro in the app. Switch providers anytime.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
