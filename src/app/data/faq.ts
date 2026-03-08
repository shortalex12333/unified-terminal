export type FAQItem = { q: string; a: string }

export const FAQ: FAQItem[] = [
  { q: 'Why would I use this?', a: "You already pay for ChatGPT. But ChatGPT can only do one thing at a time in one window. Kenoki turns that same subscription into a team of specialists that research, code, design, test, and deploy — all at once. You type one sentence. You get a real, working website." },
  { q: 'How is this different from ChatGPT?', a: "ChatGPT is one brain in one window. Kenoki is a team. When you say 'build me a store,' ChatGPT gives you instructions. Kenoki actually builds it — real files, real code, real website you can visit." },
  { q: "Why can't ChatGPT just do this?", a: "ChatGPT can write code if you ask nicely and copy-paste it yourself. But it can't run that code, test it, fix bugs, generate images, connect payments, and deploy to a live URL — all in one go. That's what the team behind the scenes does." },
  { q: 'What AI does this use?', a: "Your AI. Whatever you already pay for. ChatGPT Plus, Claude Pro — Kenoki works with what you have. We don't run our own AI. We orchestrate yours." },
  { q: 'How much does it cost?', a: "Free. You're already paying for your AI subscription. Kenoki just makes it dramatically more useful. No extra subscription, no API keys, no hidden fees." },
  { q: 'Where does it run?', a: 'On your computer. The app runs locally on your Mac. Your files stay on your machine in a folder you can open in Finder. Nothing goes to our servers.' },
  { q: 'Is this reading my conversations?', a: 'No. Kenoki creates a separate conversation for each project. Your existing ChatGPT conversations are never touched, never read, never accessed.' },
  { q: "Is this harvesting my data? It's free, so...", a: "Your data stays on your computer. We don't have servers that store your projects, conversations, or files. The app runs locally. We can't see your data because we never have it." },
  { q: 'Is this a browser extension?', a: "No. It's a desktop app you install once. It has ChatGPT built into it (you sign into your account inside the app), plus local AI tools that run on your machine. More powerful than any extension." },
  { q: 'Can I create images with this?', a: "Yes. When your project needs images — a hero banner, product photos, a logo — the system routes that to ChatGPT's DALL-E. The images appear in your project automatically." },
  { q: 'Is this on the cloud?', a: 'No. Everything runs on your Mac. Your project files are saved to Documents/Kenoki/ on your computer. If you choose to deploy (optional), your site goes live on Vercel — but that\'s your choice, not ours.' },
  { q: 'Why does it show two AI tools?', a: "Different tools are better at different things. ChatGPT is great at research, images, and conversation. Codex and Claude Code are great at writing and testing code. Kenoki picks the best tool for each step — you never have to choose." },
  { q: 'Does this read my local documents?', a: 'Only the one file you explicitly ask it to use. Kenoki reads only what is inside the Kenoki project window. Your Desktop, Downloads, Photos — never touched.' },
  { q: "I don't get why I would need this?", a: "If you've ever asked ChatGPT to build something and then spent hours copy-pasting code, fixing errors, and trying to make it work — that's what Kenoki eliminates. You describe what you want. Kenoki does the rest." },
  { q: 'What can it actually build?', a: 'Websites, landing pages, portfolios, research reports, pitch decks, documentation, brand assets. Anything you could ask ChatGPT to help with — except Kenoki actually finishes the job.' },
  { q: 'What AI model does this use?', a: "Whatever model your subscription gives you. If you have ChatGPT Plus, it uses GPT-4o. If you connect Claude Pro, it uses Claude. Kenoki doesn't pick the model — you do, by signing into whichever AI you prefer." },
]
