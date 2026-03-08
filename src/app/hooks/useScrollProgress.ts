import { useEffect, useRef, useState } from 'react'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight
        if (total <= 0) { setProgress(0); return }
        const scrolled = clamp(-rect.top, 0, total)
        setProgress(scrolled / total)
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref])

  return progress
}

export function useFrameProgress(
  globalProgress: number,
  frameIndex: number,
  totalFrames: number
) {
  const frameSize = 1 / totalFrames
  const start = frameIndex * frameSize
  const end = start + frameSize
  return clamp((globalProgress - start) / (end - start), 0, 1)
}

export function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.15) {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, threshold])

  return inView
}
