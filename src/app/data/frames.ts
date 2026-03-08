export type FrameLeft =
  | { type: 'input'; title: string; subtitle: string }
  | { type: 'status'; title: string; subtitle?: string; icon: string }
  | { type: 'quiz'; title: string; questions: string[] }
  | { type: 'plan'; title: string; steps: { icon: string; text: string }[] }
  | { type: 'progress'; title: string; items: { label: string; state: 'done' | 'active' | 'pending' }[] }
  | { type: 'parallel'; title: string; tracks: { label: string; progress: number; color: string }[] }
  | { type: 'connect'; title: string; service: string; message: string; buttons: string[] }
  | { type: 'checks'; title: string; checks: { label: string; pass: boolean; detail?: string }[] }
  | { type: 'interrupt'; title: string; userMessage: string; result: { affected: string; unaffected: string[]; message: string } }
  | { type: 'live'; title: string; url: string; stats: { label: string; value: string }[] }

export type TopologyNodeDef = {
  id: string
  icon: string
  label: string
  type: 'actor' | 'rail' | 'worker' | 'mcp' | 'output'
  x: number
  y: number
  appears: number
  desc: string
  scale: number
  zIndex: number
  activeFrames?: number[]
  interruptedFrames?: number[]
  unaffectedFrames?: number[]
}

export const NODES: TopologyNodeDef[] = [
  { id: 'conductor', icon: 'Brain', label: 'Conductor', type: 'actor', x: 0, y: 50, appears: 2, desc: 'Coordinates the entire process.', zIndex: 10, scale: 1.05 },
  { id: 'intake', icon: 'MessageSquare', label: 'Intake', type: 'actor', x: -120, y: 120, appears: 3, desc: 'Parses natural language requests.', zIndex: 8, scale: 0.95 },
  { id: 'planner', icon: 'ClipboardList', label: 'Planner', type: 'actor', x: 120, y: 120, appears: 4, desc: 'Creates the execution plan.', zIndex: 8, scale: 0.95 },
  { id: 'bodyguard', icon: 'Shield', label: 'Bodyguard', type: 'rail', x: -160, y: 190, appears: 5, activeFrames: [9], desc: '11 hardcoded checks.', zIndex: 7, scale: 0.9 },
  { id: 'spine', icon: 'Bone', label: 'Spine', type: 'rail', x: 160, y: 190, appears: 5, desc: 'Core safety routing and execution guard.', zIndex: 7, scale: 0.9 },
  { id: 'skill-selector', icon: 'Target', label: 'Skill Selector', type: 'actor', x: 0, y: 260, appears: 6, desc: 'Chooses the right agents for the job.', zIndex: 9, scale: 1 },
  { id: 'scaffold', icon: 'Ruler', label: 'Scaffold', type: 'worker', x: -180, y: 330, appears: 6, desc: 'Sets up project boilerplate.', zIndex: 6, scale: 0.85 },
  { id: 'content', icon: 'PenTool', label: 'Content', type: 'worker', x: -60, y: 330, appears: 6, activeFrames: [7], unaffectedFrames: [10], desc: 'Writes copy.', zIndex: 6, scale: 0.85 },
  { id: 'frontend', icon: 'Layout', label: 'Frontend', type: 'worker', x: 60, y: 330, appears: 6, activeFrames: [7], unaffectedFrames: [10], desc: 'Builds React components.', zIndex: 6, scale: 0.85 },
  { id: 'imggen', icon: 'Image', label: 'Image Gen', type: 'worker', x: 180, y: 330, appears: 6, activeFrames: [7], interruptedFrames: [10], desc: 'Generates necessary assets.', zIndex: 6, scale: 0.85 },
  { id: 'messenger', icon: 'Send', label: 'Messenger', type: 'actor', x: -60, y: 400, appears: 6, activeFrames: [10], desc: 'Handles agent communication.', zIndex: 8, scale: 0.95 },
  { id: 'warden', icon: 'Eye', label: 'Warden', type: 'actor', x: 120, y: 400, appears: 7, desc: 'Oversees ongoing tasks.', zIndex: 8, scale: 0.95 },
  { id: 'stripe', icon: 'CreditCard', label: 'Payments', type: 'mcp', x: -120, y: 470, appears: 8, unaffectedFrames: [10], desc: 'Connects to payment gateway.', zIndex: 7, scale: 0.9 },
  { id: 'vercel', icon: 'Rocket', label: 'Vercel', type: 'mcp', x: 0, y: 470, appears: 8, desc: 'Prepares deployment environment.', zIndex: 9, scale: 1 },
  { id: 'github', icon: 'Github', label: 'GitHub', type: 'mcp', x: 120, y: 470, appears: 8, desc: 'Commits code to repository.', zIndex: 7, scale: 0.9 },
  { id: 'verify', icon: 'CheckSquare', label: 'Verify', type: 'worker', x: -180, y: 540, appears: 9, desc: 'Tests against specifications.', zIndex: 6, scale: 0.85 },
  { id: 'sec', icon: 'Lock', label: 'Security', type: 'worker', x: -60, y: 540, appears: 9, desc: 'Scans for vulnerabilities.', zIndex: 6, scale: 0.85 },
  { id: 'perf', icon: 'Zap', label: 'Performance', type: 'worker', x: 60, y: 540, appears: 9, desc: 'Optimizes load times.', zIndex: 6, scale: 0.85 },
  { id: 'heartbeat', icon: 'Activity', label: 'Heartbeat', type: 'actor', x: 180, y: 540, appears: 9, desc: 'Monitors system vitality.', zIndex: 6, scale: 0.85 },
  { id: 'archivist', icon: 'BookOpen', label: 'Archivist', type: 'actor', x: -60, y: 610, appears: 11, desc: 'Stores final artifacts.', zIndex: 8, scale: 0.95 },
  { id: 'deploy', icon: 'CloudLightning', label: 'Deploy', type: 'worker', x: 60, y: 610, appears: 11, activeFrames: [11], desc: 'Pushes to production.', zIndex: 8, scale: 0.95 },
  { id: 'files', icon: 'Folder', label: 'Your Files', type: 'output', x: 0, y: 680, appears: 11, desc: 'Ready for download.', zIndex: 10, scale: 1.05 },
]

export const nodeColor: Record<string, { rgb: string; hex: string }> = {
  actor: { rgb: '172,203,238', hex: '#ACCBEE' },
  rail: { rgb: '126,217,181', hex: '#7ED9B5' },
  worker: { rgb: '199,166,216', hex: '#C7A6D8' },
  mcp: { rgb: '246,193,119', hex: '#F6C177' },
  output: { rgb: '241,168,166', hex: '#F1A8A6' },
}

export type Frame = {
  id: string
  caption: string
  left: FrameLeft
}

export const FRAMES: Frame[] = [
  {
    id: 'intro',
    caption: 'You type. We orchestrate.',
    left: { type: 'input', title: 'Build me a candle store', subtitle: "That's all you say." },
  },
  {
    id: 'understand',
    caption: 'Understanding your intent.',
    left: { type: 'status', title: 'Understanding what you need...', subtitle: 'Classifying your request.', icon: 'Brain' },
  },
  {
    id: 'intake',
    caption: 'Clarifying the details.',
    left: {
      type: 'quiz',
      title: 'Quick questions',
      questions: ['Who are your customers?', 'Any colours or style you like?', 'Do you have a logo?'],
    },
  },
  {
    id: 'plan',
    caption: 'Creating the master plan.',
    left: {
      type: 'plan',
      title: 'Your Candle Store',
      steps: [
        { icon: 'Ruler', text: 'Scaffold project' },
        { icon: 'Target', text: 'Research competitors' },
        { icon: 'Layout', text: 'Build homepage' },
        { icon: 'Image', text: 'Generate assets' },
        { icon: 'BookOpen', text: 'Product catalog' },
        { icon: 'CreditCard', text: 'Stripe integration' },
        { icon: 'CheckSquare', text: 'Run verifications' },
        { icon: 'Rocket', text: 'Deploy to Vercel' },
      ],
    },
  },
  {
    id: 'rails',
    caption: 'Setting up safety rails.',
    left: { type: 'status', title: 'Safety checks on', subtitle: 'Every step is verified before and after.', icon: 'Shield' },
  },
  {
    id: 'workers',
    caption: 'Assembling the expert team.',
    left: {
      type: 'progress',
      title: 'Building your candle store',
      items: [
        { label: 'Project scaffolded', state: 'done' },
        { label: 'Market research complete', state: 'done' },
        { label: 'Building React components', state: 'active' },
        { label: 'Writing copy', state: 'active' },
        { label: 'Generating images', state: 'pending' },
        { label: 'Setting up payments', state: 'pending' },
      ],
    },
  },
  {
    id: 'parallel',
    caption: 'Working in parallel.',
    left: {
      type: 'parallel',
      title: 'Working in parallel',
      tracks: [
        { label: 'Building pages', progress: 65, color: 'from-[#ACCBEE]/80 to-[#ACCBEE]' },
        { label: 'Creating images', progress: 40, color: 'from-[#C7A6D8]/80 to-[#C7A6D8]' },
        { label: 'Writing content', progress: 80, color: 'from-[#7ED9B5]/80 to-[#7ED9B5]' },
      ],
    },
  },
  {
    id: 'mcp',
    caption: 'Connecting external services.',
    left: {
      type: 'connect',
      title: 'Set up payments?',
      service: 'Stripe',
      message: 'Connect your Stripe account to start accepting payments immediately when your store goes live.',
      buttons: ['Connect Stripe', 'Skip for now'],
    },
  },
  {
    id: 'verify',
    caption: 'Verifying every detail.',
    left: {
      type: 'checks',
      title: 'Testing everything works...',
      checks: [
        { label: 'All pages load', pass: true },
        { label: 'Mobile responsive', pass: true },
        { label: 'Payments working', pass: true },
        { label: 'Performance score', pass: true, detail: '94/100' },
        { label: 'No security issues', pass: true },
      ],
    },
  },
  {
    id: 'interrupt',
    caption: 'Handling sudden changes gracefully.',
    left: {
      type: 'interrupt',
      title: 'User interrupts mid-build',
      userMessage: 'Actually, use my existing logo instead',
      result: { affected: 'Image Gen', unaffected: ['Frontend', 'Content'], message: 'Got it \u2014 using your logo. Updated 1 step.' },
    },
  },
  {
    id: 'deploy',
    caption: 'Your vision, realized.',
    left: {
      type: 'live',
      title: 'Your candle store is live!',
      url: 'mycandlestore.vercel.app',
      stats: [
        { label: 'Performance', value: '94/100' },
        { label: 'Pages built', value: '6' },
        { label: 'Build time', value: '38 min' },
      ],
    },
  },
]
