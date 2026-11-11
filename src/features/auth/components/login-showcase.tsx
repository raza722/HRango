import type { CSSProperties, ReactNode } from 'react'
import { CalendarCheck2, Clock3, Wallet } from 'lucide-react'

import { PRODUCT_LOGO, PRODUCT_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

/** The modules named under the art (the big ones; the sidebar has the full list). */
const MODULES = ['Attendance', 'Leaves', 'Requests', 'Payroll', 'Recruitment', 'Performance']

/** One of the small "live" cards around the Pegasus, drawn from the product. */
function StatusChip({
  icon,
  tone,
  title,
  detail,
  className,
  delay,
}: {
  icon: ReactNode
  /** Icon tile: background and icon colour. */
  tone: string
  title: string
  detail: string
  className?: string
  /** Seconds the float is offset, so the chips never move together. */
  delay: number
}) {
  const style: CSSProperties = { animationDelay: `${String(-delay)}s` }
  return (
    <div
      className={cn(
        'absolute flex animate-float items-center gap-3 rounded-2xl border border-[#26344d] bg-[#111b2e] py-3 pr-5 pl-3 shadow-[0_18px_40px_-20px_#000] motion-reduce:animate-none',
        className,
      )}
      style={style}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-white">{title}</span>
        <span className="truncate text-xs text-[#94a3b8]">{detail}</span>
      </span>
    </div>
  )
}

/**
 * The sign-in page's art: the Pegasus inside quiet rings, three cards from the product around it
 * (attendance, payroll, a leave approval), the tagline and the main modules. On a phone it is a
 * short band above the form with one card; the cards and the tagline need a wide screen. The art
 * is decorative; the tagline and modules are text. All motion stops for `prefers-reduced-motion`.
 */
export function LoginShowcase({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <section
      aria-label={`What ${PRODUCT_NAME} covers`}
      className={cn('flex min-w-0 flex-col items-center gap-7', className)}
      style={style}
    >
      <div
        aria-hidden="true"
        className="relative h-56 w-full max-w-[760px] overflow-hidden sm:h-72 lg:h-[500px]"
      >
        <div className="absolute top-1/2 left-1/2 size-[340px] -translate-1/2 rounded-full border border-[#1a2640] sm:size-[420px] lg:size-[520px]" />
        <div className="absolute top-1/2 left-1/2 size-[260px] -translate-1/2 rounded-full border border-[#22304b] sm:size-[320px] lg:size-[400px]" />
        <div className="absolute top-1/2 left-1/2 size-[170px] -translate-1/2 rounded-full bg-[#121c31] sm:size-[210px] lg:size-[280px]" />
        <img
          src={PRODUCT_LOGO.iconColor}
          alt=""
          width={472}
          height={345}
          className="absolute top-1/2 left-[52%] w-[58%] max-w-[470px] -translate-1/2 sm:w-[54%] lg:w-[66%]"
        />

        <StatusChip
          className="bottom-3 left-0 sm:left-[4%] lg:top-9 lg:bottom-auto lg:left-[2%]"
          delay={0}
          tone="bg-[#0e3b33] text-[#34d399]"
          icon={<Clock3 className="size-5" />}
          title="Checked in · 09:02"
          detail="Head Office · on time"
        />
        <StatusChip
          className="top-[150px] right-0 hidden lg:flex"
          delay={2.3}
          tone="bg-[#2a1f55] text-[#c4b5fd]"
          icon={<Wallet className="size-5" />}
          title="October payroll closed"
          detail="34 payslips released"
        />
        <StatusChip
          className="bottom-11 left-[8%] hidden lg:flex"
          delay={4.6}
          tone="bg-[#3a2a12] text-[#fbbf24]"
          icon={<CalendarCheck2 className="size-5" />}
          title="Casual leave approved"
          detail="Sara Khan · 2 days"
        />
      </div>

      <p className="hidden max-w-[560px] text-center text-[1.875rem] leading-tight font-semibold tracking-[-0.01em] text-balance text-white lg:block">
        One place to <span className="text-[#a78bfa]">develop</span> your whole team.
      </p>
      <ul className="hidden max-w-[620px] flex-wrap justify-center gap-2 lg:flex">
        {MODULES.map((module) => (
          <li
            key={module}
            className="rounded-full border border-[#26344d] px-3.5 py-2 font-inter text-[0.8125rem] text-[#94a3b8]"
          >
            {module}
          </li>
        ))}
      </ul>
    </section>
  )
}
