import { motion } from 'motion/react'
import {
  ArrowUp, HelpCircle, CheckCircle2, Circle, Check, Link as LinkIcon,
  Brain, Shield, Ruler, Target, Layout, Image as ImageIcon, BookOpen,
  CreditCard, CheckSquare, Rocket,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FrameLeft } from '../data/frames'
import GlassCard from './GlassCard'

const PlanIcons: Record<string, LucideIcon> = {
  Ruler, Target, Layout, Image: ImageIcon, BookOpen, CreditCard, CheckSquare, Rocket,
}

type UserViewProps = {
  data: FrameLeft
  progress: number
}

const textGlow = { textShadow: '0 0 30px rgba(120, 160, 220, 0.1)' }

function InputView({ data }: { data: Extract<FrameLeft, { type: 'input' }>; progress: number }) {
  return (
    <GlassCard hover={false} fixedHeight className="flex flex-col">
      <div className="flex flex-col h-full justify-between">
        <div>
          <h3
            className="text-[var(--text-primary)] text-[26px] font-light font-eloquia mb-3 tracking-tight"
            style={textGlow}
          >
            {data.title}
          </h3>
          <p className="text-[var(--text-secondary)] text-[15px]">{data.subtitle}</p>
        </div>
        <div className="relative mt-auto">
          <input
            type="text"
            placeholder="Type your idea..."
            className="w-full bg-white/60 border border-[var(--border-subtle)] rounded-full py-4 pl-6 pr-14 text-[15px] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
            disabled
          />
          <button className="absolute right-2 top-2 bottom-2 aspect-square btn-primary rounded-full flex items-center justify-center text-white">
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </GlassCard>
  )
}

function StatusView({ data }: { data: Extract<FrameLeft, { type: 'status' }>; progress: number }) {
  const IconComponent = data.icon === 'Brain' ? Brain : data.icon === 'Shield' ? Shield : Brain
  return (
    <GlassCard hover={false} fixedHeight className="flex items-center justify-center text-center">
      <div className="flex flex-col items-center">
        <IconComponent size={48} className="text-[var(--text-secondary)] mb-6" strokeWidth={1} />
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-[var(--text-primary)] text-xl font-medium font-eloquia" style={textGlow}>
            {data.title}
          </h3>
          <div className="w-2 h-2 rounded-full bg-[#ACCBEE] animate-pulse shadow-[0_0_8px_rgba(172,203,238,0.8)]" />
        </div>
        {data.subtitle && <p className="text-[var(--text-secondary)] text-[15px]">{data.subtitle}</p>}
      </div>
    </GlassCard>
  )
}

function QuizView({ data }: { data: Extract<FrameLeft, { type: 'quiz' }>; progress: number }) {
  return (
    <GlassCard hover={false} fixedHeight>
      <div className="flex flex-col justify-center h-full">
      <h3 className="text-[var(--text-primary)] text-xl font-medium font-eloquia mb-6" style={textGlow}>
        {data.title}
      </h3>
      <div className="space-y-5">
        {data.questions.map((q, i) => (
          <div
            key={i}
            className="flex items-center gap-4 bg-[var(--glass-bg)] border border-[var(--border-subtle)] rounded-[16px] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-md"
          >
            <div className="w-8 h-8 rounded-full bg-[#ACCBEE]/10 border border-[#ACCBEE]/20 flex items-center justify-center text-[#ACCBEE] shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)]">
              <HelpCircle size={16} strokeWidth={2} />
            </div>
            <p className="text-[var(--text-primary)] text-[14px] font-medium">{q}</p>
          </div>
        ))}
      </div>
      </div>
    </GlassCard>
  )
}

function PlanView({ data }: { data: Extract<FrameLeft, { type: 'plan' }>; progress: number }) {
  return (
    <GlassCard hover={false} fixedHeight>
      <div className="flex flex-col justify-center h-full">
      <h3 className="text-[var(--text-primary)] text-[26px] font-light font-eloquia mb-6 tracking-tight" style={textGlow}>
        {data.title}
      </h3>
      <div className="space-y-4">
        {data.steps.map((step, i) => {
          const StepIcon = PlanIcons[step.icon]
          const isHighlighted = i === 2
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${
                isHighlighted ? 'border-l-[2px] border-[#ACCBEE] bg-[var(--glass-bg)] shadow-[inset_0_0_12px_rgba(172,203,238,0.05)]' : ''
              }`}
            >
              <span className="w-6 flex justify-center text-[var(--text-secondary)]">
                {StepIcon ? <StepIcon size={16} /> : null}
              </span>
              <span className={`text-[14px] ${isHighlighted ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                {step.text}
              </span>
            </div>
          )
        })}
      </div>
      </div>
    </GlassCard>
  )
}

function ProgressView({ data }: { data: Extract<FrameLeft, { type: 'progress' }>; progress: number }) {
  return (
    <GlassCard hover={false} fixedHeight>
      <div className="flex flex-col justify-center h-full">
      <h3 className="text-[var(--text-primary)] text-xl font-medium font-eloquia mb-5" style={textGlow}>
        {data.title}
      </h3>
      <div className="space-y-4">
        {data.items.map((item, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-5 flex justify-center">
              {item.state === 'done' && (
                <CheckCircle2
                  size={18}
                  className="text-[#7ED9B5]"
                  strokeWidth={2}
                  style={{ filter: 'drop-shadow(0 0 6px rgba(126,217,181,0.6))' }}
                />
              )}
              {item.state === 'active' && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#ACCBEE] animate-pulse shadow-[0_0_8px_rgba(172,203,238,0.8)]" />
              )}
              {item.state === 'pending' && <Circle size={18} className="text-[var(--text-faint)]" strokeWidth={2} />}
            </div>
            <span
              className={`text-[14.5px] ${
                item.state === 'active'
                  ? 'text-[var(--text-primary)] font-medium'
                  : item.state === 'pending'
                  ? 'text-[var(--text-faint)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
      </div>
    </GlassCard>
  )
}

function ParallelView({ data }: { data: Extract<FrameLeft, { type: 'parallel' }>; progress: number }) {
  return (
    <GlassCard hover={false} fixedHeight>
      <div className="flex flex-col justify-center h-full">
      <h3 className="text-[var(--text-primary)] text-xl font-medium font-eloquia mb-6" style={textGlow}>
        {data.title}
      </h3>
      <div className="space-y-6">
        {data.tracks.map((bar, i) => (
          <div key={i}>
            <div className="flex justify-between text-[14px] mb-3">
              <span className="text-[var(--text-primary)] font-medium">{bar.label}</span>
              <span className="text-[var(--text-secondary)]">{bar.progress}%</span>
            </div>
            <div className="h-2 w-full bg-[var(--glass-bg)] rounded-full overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]">
              <motion.div
                className={`h-full bg-gradient-to-b ${bar.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${bar.progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
      </div>
    </GlassCard>
  )
}

function ConnectView({ data }: { data: Extract<FrameLeft, { type: 'connect' }>; progress: number }) {
  return (
    <GlassCard hover={false} fixedHeight>
      <div className="flex flex-col h-full">
        <div className="inline-flex items-center self-start gap-2 px-3 py-1.5 bg-[var(--glass-bg)] rounded-full text-[12px] font-medium text-[var(--text-secondary)] mb-6 border border-[var(--border-subtle)]">
          <CreditCard size={14} /> {data.service}
        </div>
        <h3 className="text-[var(--text-primary)] text-[26px] font-light font-eloquia mb-3 tracking-tight" style={textGlow}>
          {data.title}
        </h3>
        <p className="text-[var(--text-secondary)] text-[14.5px] mb-6 leading-relaxed">{data.message}</p>
        <div className="flex gap-3 mt-auto">
          <button className="flex-1 btn-primary py-3.5 text-[14px] font-medium font-poppins">
            {data.buttons[0]}
          </button>
          <button className="flex-1 btn-glass py-3.5 text-[14px] font-medium font-poppins">
            {data.buttons[1]}
          </button>
        </div>
      </div>
    </GlassCard>
  )
}

function ChecksView({ data }: { data: Extract<FrameLeft, { type: 'checks' }>; progress: number }) {
  return (
    <GlassCard hover={false} fixedHeight>
      <div className="flex flex-col justify-center h-full">
      <h3 className="text-[var(--text-primary)] text-xl font-medium font-eloquia mb-5" style={textGlow}>
        {data.title}
      </h3>
      <div className="space-y-5">
        {data.checks.map((check, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-[22px] h-[22px] rounded-full bg-[#7ED9B5]/15 border border-[#7ED9B5]/30 flex items-center justify-center text-[#7ED9B5] shadow-[0_0_10px_rgba(126,217,181,0.2)]">
              <Check size={13} strokeWidth={3} />
            </div>
            <span className="text-[var(--text-secondary)] text-[14.5px] font-medium flex-1">{check.label}</span>
            {check.detail && <span className="text-[var(--text-secondary)] text-[13px]">{check.detail}</span>}
          </div>
        ))}
      </div>
      </div>
    </GlassCard>
  )
}

function InterruptView({ data }: { data: Extract<FrameLeft, { type: 'interrupt' }>; progress: number }) {
  const cardBase =
    'bg-[var(--glass-bg)] backdrop-blur-[40px] border border-[var(--border-subtle)] rounded-[24px] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] w-full relative overflow-hidden'

  return (
    <div className="flex flex-col gap-5 relative" style={{ height: 420 }}>
      {/* User message */}
      <div className={`${cardBase}`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/[0.8] to-transparent pointer-events-none" />
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C7A6D8] via-[#EAA7B6] to-[#F1A8A6] flex-shrink-0 shadow-[0_0_15px_rgba(217,166,199,0.3)]" />
          <div className="pt-0.5">
            <p className="text-[var(--text-primary)] text-[13px] font-semibold">You</p>
            <p className="text-[var(--text-secondary)] text-[15px] mt-1 italic leading-snug">
              &ldquo;{data.userMessage}&rdquo;
            </p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/[0.3] to-transparent pointer-events-none" />
      </div>

      {/* System response */}
      <div className={`${cardBase} flex-1 flex flex-col justify-center`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/[0.8] to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-[var(--text-primary)] text-[16px] font-medium mb-6 font-eloquia" style={textGlow}>
            {data.result.message}
          </h3>
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-2.5 px-3 py-2 bg-[#F08A8A]/10 border border-[#F08A8A]/30 text-[#F08A8A] rounded-full text-[13px] font-medium self-start shadow-[0_0_15px_rgba(240,138,138,0.15)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F08A8A] drop-shadow-[0_0_4px_rgba(240,138,138,1)]" />
              Canceled: {data.result.affected}
            </div>
            {data.result.unaffected.map((name, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2.5 px-3 py-2 bg-[#7ED9B5]/10 border border-[#7ED9B5]/30 text-[#7ED9B5] rounded-full text-[13px] font-medium self-start shadow-[0_0_15px_rgba(126,217,181,0.1)]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#7ED9B5]" />
                Unchanged: {name}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/[0.3] to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

function LiveView({ data }: { data: Extract<FrameLeft, { type: 'live' }>; progress: number }) {
  return (
    <GlassCard hover={false} fixedHeight>
      <div className="flex flex-col justify-center h-full">
      <div className="flex flex-col items-center justify-center text-center py-6 border-b border-[var(--border-subtle)] mb-5 flex-1">
        <div className="w-16 h-16 rounded-full bg-[#7ED9B5]/15 border border-[#7ED9B5]/30 flex items-center justify-center text-[#7ED9B5] mb-4 shadow-[0_0_20px_rgba(126,217,181,0.2)]">
          <Check size={32} strokeWidth={2} />
        </div>
        <h3
          className="text-[#7ED9B5] text-[26px] font-medium font-eloquia mb-3"
          style={{ textShadow: '0 0 30px rgba(126,217,181,0.2)' }}
        >
          {data.title}
        </h3>
        <a
          href="#"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#ACCBEE] hover:text-[#C7A6D8] transition-colors bg-[var(--glass-bg)] px-4 py-2 rounded-full border border-[var(--border-subtle)] backdrop-blur-sm"
        >
          <LinkIcon size={14} />
          {data.url}
        </a>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {data.stats.map((stat, i) => (
          <div
            key={i}
            className="bg-[var(--glass-bg)] rounded-[16px] p-4 text-center border border-[var(--border-subtle)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)] backdrop-blur-md"
          >
            <p className="text-[var(--text-faint)] text-[10px] font-bold uppercase tracking-wider mb-2">{stat.label}</p>
            <p className="text-[var(--text-primary)] font-semibold text-lg" style={textGlow}>{stat.value}</p>
          </div>
        ))}
      </div>
      </div>
    </GlassCard>
  )
}

export default function UserView({ data, progress }: UserViewProps) {
  if (!data) return null
  switch (data.type) {
    case 'input':
      return <InputView data={data} progress={progress} />
    case 'status':
      return <StatusView data={data} progress={progress} />
    case 'quiz':
      return <QuizView data={data} progress={progress} />
    case 'plan':
      return <PlanView data={data} progress={progress} />
    case 'progress':
      return <ProgressView data={data} progress={progress} />
    case 'parallel':
      return <ParallelView data={data} progress={progress} />
    case 'connect':
      return <ConnectView data={data} progress={progress} />
    case 'checks':
      return <ChecksView data={data} progress={progress} />
    case 'interrupt':
      return <InterruptView data={data} progress={progress} />
    case 'live':
      return <LiveView data={data} progress={progress} />
  }
}
