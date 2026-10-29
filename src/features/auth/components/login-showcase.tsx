import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { BadgeCheck, CalendarCheck2, Fingerprint, Wallet } from 'lucide-react'

import { NAV_ITEMS } from '@/app/navigation'
import { useMediaQuery } from '@/hooks/use-media-query'
import { MAKER_NAME, PRODUCT_LOGO, PRODUCT_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

/** What hRango does, one verb at a time: the headline's changing word. */
const VERBS = ['hire', 'schedule', 'pay', 'develop', 'look after'] as const

/** The modules in the sidebar, for the moving strip (the shell's pages, not Dashboard or Settings). */
const MODULES = NAV_ITEMS.filter((item) => item.label !== 'Dashboard' && item.label !== 'Settings')

const REDUCE_MOTION = '(prefers-reduced-motion: reduce)'

/** Staggered entrance: each block rises a little after the one before. */
const rise = (step: number): CSSProperties => ({ animationDelay: `${String(120 + step * 110)}ms` })

function ChangingWord() {
  const still = useMediaQuery(REDUCE_MOTION)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (still) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % VERBS.length)
    }, 2600)
    return () => {
      window.clearInterval(timer)
    }
  }, [still])
  return (
    <span className="block h-[1.2em] overflow-hidden">
      <span
        key={index}
        className="block animate-word-in bg-gradient-to-r from-[#c4b5fd] via-[#a78bfa] to-[#5eead4] bg-clip-text pb-1 text-transparent motion-reduce:animate-none"
      >
        {VERBS[index]}
      </span>
    </span>
  )
}

/** One of the floating "live" cards: a glass panel over the aurora. */
function GlassCard({
  children,
  className,
  delay,
}: {
  children: ReactNode
  className?: string
  /** Seconds the float is offset, so the cards never move together. */
  delay: number
}) {
  return (
    <div
      className={cn(
        'absolute w-72 animate-float rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.65)] backdrop-blur-md motion-reduce:animate-none',
        className,
      )}
      style={{ animationDelay: `${String(-delay)}s` }}
    >
      {children}
    </div>
  )
}

/** The week's attendance as small bars; the last one is today. */
const WEEK = [72, 88, 64, 92, 81]

/**
 * The sign-in page's left panel: what hRango is for, with a moving aurora, a headline whose verb
 * changes, three cards drawn from the product (attendance, a leave approval, payroll) and a strip
 * of the sidebar's modules. Everything here is decorative except the text; all motion stops for
 * `prefers-reduced-motion`.
 */
export function LoginShowcase() {
  return (
    <aside className="relative isolate hidden flex-col justify-between gap-10 overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
      {/* Aurora and dot grid behind everything. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 size-[30rem] animate-aurora rounded-full bg-[#7c3aed]/35 blur-[110px] motion-reduce:animate-none" />
        <div
          className="absolute top-1/3 -right-40 size-[28rem] animate-aurora rounded-full bg-[#4f46e5]/30 blur-[120px] motion-reduce:animate-none"
          style={{ animationDelay: '-6s', animationDuration: '22s' }}
        />
        <div
          className="absolute -bottom-40 left-1/4 size-[26rem] animate-aurora rounded-full bg-[#14b8a6]/20 blur-[120px] motion-reduce:animate-none"
          style={{ animationDelay: '-11s', animationDuration: '26s' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_70%)] bg-[length:22px_22px]" />
      </div>

      <div
        className="flex animate-rise items-center justify-between motion-reduce:animate-none"
        style={rise(0)}
      >
        <img
          src={PRODUCT_LOGO.fullWhite}
          alt={PRODUCT_NAME}
          className="h-9 w-auto"
          width={110}
          height={36}
        />
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-sidebar-subtle">
          <span aria-hidden="true" className="relative flex size-2">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#34d399] motion-reduce:animate-none" />
            <span className="relative size-2 rounded-full bg-[#34d399]" />
          </span>
          HR suite for every branch
        </span>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-center">
        <div className="max-w-lg">
          <p
            className="animate-rise text-sm font-medium tracking-[0.18em] text-[#c4b5fd] uppercase motion-reduce:animate-none"
            style={rise(1)}
          >
            From first interview to final settlement
          </p>
          <p
            className="mt-4 animate-rise text-[2.6rem] leading-[1.15] font-semibold motion-reduce:animate-none xl:text-[2.2rem] 2xl:text-[2.6rem]"
            style={rise(2)}
          >
            <span className="sr-only">
              One place to hire, schedule, pay, develop and look after your whole team.
            </span>
            <span aria-hidden="true">
              One place to
              <ChangingWord />
              your whole team.
            </span>
          </p>
          <p
            className="mt-5 max-w-md animate-rise text-[0.95rem] leading-relaxed text-sidebar-subtle motion-reduce:animate-none"
            style={rise(3)}
          >
            Attendance and rosters, leave and requests, payroll and payslips, recruitment and
            performance: every part of working life in {PRODUCT_NAME}, with one sign-in.
          </p>
        </div>

        {/* Three cards from the product, floating out of step (wide screens: they need the room). */}
        <div
          aria-hidden="true"
          className="relative hidden h-80 animate-rise motion-reduce:animate-none xl:block"
          style={rise(4)}
        >
          <GlassCard className="top-0 left-0" delay={0}>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#34d399]/15 text-[#6ee7b7]">
                <Fingerprint className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">Checked in · 09:02</p>
                <p className="text-xs text-sidebar-subtle">Head Office · on time</p>
              </div>
            </div>
            <div className="mt-3 flex h-10 items-end gap-1.5">
              {WEEK.map((height, index) => (
                <span
                  key={height}
                  className={cn(
                    'flex-1 rounded-t-sm',
                    index === WEEK.length - 1 ? 'bg-[#6ee7b7]' : 'bg-white/15',
                  )}
                  style={{ height: `${String(height)}%` }}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="top-24 left-10 xl:left-6" delay={2.3}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#a78bfa]/15 text-[#c4b5fd]">
                  <CalendarCheck2 className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">Casual leave</p>
                  <p className="text-xs text-sidebar-subtle">Sara Khan · 2 days</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#34d399]/15 px-2 py-0.5 text-[0.6875rem] font-medium text-[#6ee7b7]">
                <BadgeCheck className="size-3.5" />
                Approved
              </span>
            </div>
          </GlassCard>

          <GlassCard className="top-48 left-0 xl:top-52" delay={4.6}>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#5eead4]/15 text-[#5eead4]">
                <Wallet className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">October payroll closed</p>
                <p className="text-xs text-sidebar-subtle">34 payslips released</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#5eead4]" />
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="grid animate-rise gap-6 motion-reduce:animate-none" style={rise(5)}>
        {/* The sidebar's modules, moving left; hovering stops them. */}
        <div
          aria-hidden="true"
          className="group overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]"
        >
          <div className="flex w-max animate-marquee gap-2 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...MODULES, ...MODULES].map((item, index) => {
              const Icon = item.icon
              return (
                <span
                  key={`${item.label}-${String(index)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs whitespace-nowrap text-sidebar-subtle"
                >
                  <Icon className="size-3.5 shrink-0 text-[#c4b5fd]" />
                  {item.label}
                </span>
              )
            })}
          </div>
        </div>
        <p className="text-xs text-sidebar-muted">
          © {new Date().getFullYear()} {PRODUCT_NAME} · Powered by {MAKER_NAME}
        </p>
      </div>
    </aside>
  )
}
