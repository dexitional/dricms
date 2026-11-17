import { useEffect, useRef, useState } from 'react'
import { FolderCheck, FolderKanban, Handshake, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { num } from '#/lib/format'

// "DRIC at a glance": the landing page's headline figures. Each figure counts
// up when the strip scrolls into view, the tiles rise in one after another,
// and each has a small graphic that draws itself in. All motion is skipped
// for people who prefer reduced motion.

type Graphic = 'ring' | 'bars' | 'partners' | 'people'
type Stat = {
  label: string
  caption: string
  value: number | undefined
  icon: LucideIcon
  accent: string
  graphic: Graphic
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts up to `target` once `run` turns true; jumps straight there for reduced motion. */
function useCountUp(target: number | undefined, run: boolean, delayMs = 0, durationMs = 1400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === undefined || !run) return
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now() + delayMs
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / durationMs))
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, run, delayMs, durationMs])
  return value
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** Share of all projects that are active, drawn as a ring. */
function RingGraphic({ run, accent, share }: { run: boolean; accent: string; share: number }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className="size-10 -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={run ? c * (1 - share) : c}
          style={{ transition: `stroke-dashoffset 1.6s ${EASE} 0.3s` }}
        />
      </svg>
      <span className="text-[0.7rem] font-semibold text-slate-500">{Math.round(share * 100)}% of all projects</span>
    </div>
  )
}

/** Rising bars, a nod to a growing portfolio. */
function BarsGraphic({ run, accent }: { run: boolean; accent: string }) {
  const heights = [35, 50, 42, 64, 58, 80, 72, 100]
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-2.5 rounded-t-[3px]"
          style={{
            height: run ? `${h}%` : '8%',
            background: `color-mix(in oklab, ${accent} ${40 + i * 7}%, white)`,
            transition: `height 0.9s ${EASE} ${0.25 + i * 0.07}s`,
          }}
        />
      ))}
    </div>
  )
}

/** Overlapping discs: funders working together. */
function PartnersGraphic({ run, accent }: { run: boolean; accent: string }) {
  const mixes = [100, 78, 58, 40, 26]
  return (
    <div className="flex h-10 items-center" aria-hidden="true">
      {mixes.map((m, i) => (
        <span
          key={i}
          className="-ml-2.5 size-8 rounded-full border-2 border-white first:ml-0"
          style={{
            background: `color-mix(in oklab, ${accent} ${m}%, white)`,
            transform: run ? 'scale(1)' : 'scale(0)',
            transition: `transform 0.6s ${EASE} ${0.3 + i * 0.1}s`,
          }}
        />
      ))}
    </div>
  )
}

/** A small crowd of people: the investigators. */
function PeopleGraphic({ run, accent }: { run: boolean; accent: string }) {
  return (
    <div className="flex h-10 items-end gap-1.5" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 26"
          className="h-7 w-[1.1rem]"
          style={{
            opacity: run ? 1 : 0,
            transform: run ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 0.5s ease ${0.3 + i * 0.08}s, transform 0.6s ${EASE} ${0.3 + i * 0.08}s`,
          }}
        >
          <circle cx="10" cy="7" r="5" fill={`color-mix(in oklab, ${accent} ${100 - i * 11}%, white)`} />
          <path d="M1 26c0-6 4-10 9-10s9 4 9 10z" fill={`color-mix(in oklab, ${accent} ${85 - i * 10}%, white)`} />
        </svg>
      ))}
    </div>
  )
}

function StatTile({ stat, run, index, share }: { stat: Stat; run: boolean; index: number; share: number }) {
  const shown = useCountUp(stat.value, run, index * 120)
  const Icon = stat.icon
  return (
    <div
      className="group relative h-full overflow-hidden px-5 py-6 sm:px-7 sm:py-7"
      style={{
        opacity: run ? 1 : 0,
        transform: run ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity 0.6s ease ${index * 0.12}s, transform 0.7s ${EASE} ${index * 0.12}s`,
      }}
    >
      {/* A soft wash of the stat's colour that blooms on hover. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `color-mix(in oklab, ${stat.accent} 18%, transparent)` }}
      />
      <div className="relative flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:-rotate-6"
          style={{
            background: `linear-gradient(135deg, ${stat.accent}, color-mix(in oklab, ${stat.accent} 65%, black))`,
            boxShadow: `0 10px 22px -10px ${stat.accent}`,
          }}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{stat.label}</p>
      </div>
      <p className="relative mt-4 text-[2.6rem] leading-none font-black tracking-tight text-primary tabular-nums">
        {/* Screen readers get the final figure, not the animation. */}
        <span aria-hidden="true">{stat.value === undefined ? '—' : num(shown, 0)}</span>
        <span className="sr-only">{stat.value === undefined ? 'Loading' : num(stat.value, 0)}</span>
      </p>
      <p className="relative mt-1.5 text-xs text-muted-foreground">{stat.caption}</p>
      <div className="relative mt-5">
        {stat.graphic === 'ring' && <RingGraphic run={run} accent={stat.accent} share={share} />}
        {stat.graphic === 'bars' && <BarsGraphic run={run} accent={stat.accent} />}
        {stat.graphic === 'partners' && <PartnersGraphic run={run} accent={stat.accent} />}
        {stat.graphic === 'people' && <PeopleGraphic run={run} accent={stat.accent} />}
      </div>
    </div>
  )
}

/** Headline figures for the landing page, floating over the bottom of the hero. */
export function StatsStrip({ stats }: { stats: Record<string, number> | undefined }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // Animate once the figures have arrived and the strip is on screen.
  const run = inView && stats !== undefined

  const items: Array<Stat> = [
    {
      label: 'Active projects',
      caption: 'Under way right now',
      value: stats?.ongoingProjects,
      icon: FolderKanban,
      accent: '#1e3a8a',
      graphic: 'ring',
    },
    {
      label: 'Projects managed',
      caption: 'Grants and consultancies',
      value: stats?.projects,
      icon: FolderCheck,
      accent: '#dc2626',
      graphic: 'bars',
    },
    {
      label: 'Funding partners',
      caption: 'Agencies backing UCC research',
      value: stats?.funders,
      icon: Handshake,
      accent: '#d97706',
      graphic: 'partners',
    },
    {
      label: 'Investigators',
      caption: 'Leading the work',
      value: stats?.investigators,
      icon: Users,
      // The DRIC accent (--secondary-foreground), its deep red.
      accent: '#991b1b',
      graphic: 'people',
    },
  ]
  const share = stats?.projects ? Math.min(1, (stats.ongoingProjects ?? 0) / stats.projects) : 0

  return (
    <section className="relative z-10 mx-auto -mt-14 max-w-6xl px-5" aria-label="DRIC at a glance">
      <div
        ref={ref}
        className="relative overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 shadow-primary/10 ring-slate-900/5"
      >
        <span aria-hidden="true" className="stats-accent absolute inset-x-0 top-0 h-1" />
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pt-5 pb-3 sm:px-7">
          <p className="text-sm font-bold tracking-tight text-slate-900">DRIC at a glance</p>
          <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-secondary-strong opacity-80 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-secondary-foreground" />
            </span>
            Live from the DRIC register
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((stat, i) => (
            <div
              key={stat.label}
              className={[
                'border-slate-100',
                i > 0 ? 'border-t sm:border-t-0' : '',
                i >= 2 ? 'sm:border-t lg:border-t-0' : '',
                i % 2 === 1 ? 'sm:border-l' : '',
                i > 0 ? 'lg:border-l' : '',
              ].join(' ')}
            >
              <StatTile stat={stat} run={run} index={i} share={share} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
