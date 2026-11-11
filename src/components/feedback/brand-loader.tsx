import type { CSSProperties } from 'react'

import { PRODUCT_LOGO } from '@/lib/brand'
import { cn } from '@/lib/utils'

/**
 * Box, ring width (px) and extras per size: `xs` sits in the saving pill, `sm` in a card or
 * dialog, `md` in a section, `lg` on a page. The shadow and sparkles need room, so only md / lg.
 */
const SIZES = {
  xs: { box: 'size-7', ring: 2.5, extras: false },
  sm: { box: 'size-11', ring: 3, extras: false },
  md: { box: 'size-16', ring: 3.5, extras: true },
  lg: { box: 'size-24', ring: 4, extras: true },
} as const

export type BrandLoaderSize = keyof typeof SIZES

/** A four-point star, for the sparkles around the mark. */
function Sparkle({ className, delay }: { className: string; delay: number }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cn(
        'absolute animate-twinkle opacity-0 motion-reduce:hidden',
        'text-[#a78bfa] dark:text-[#c4b5fd]',
        className,
      )}
      style={{ animationDelay: `${String(delay)}s` }}
    >
      <path
        fill="currentColor"
        d="M6 0c.5 3.3 2.2 5 6 6-3.8 1-5.5 2.7-6 6-.5-3.3-2.2-5-6-6 3.8-1 5.5-2.7 6-6Z"
      />
    </svg>
  )
}

/**
 * The hRango loader, without words: the Pegasus mark glides up and down inside a violet comet
 * that circles it (a fading arc with a bright head), over a faint track. Decorative; `BrandLoader`
 * adds the status and its words.
 */
export function BrandMark({
  size = 'md',
  className,
}: {
  size?: BrandLoaderSize
  className?: string
}) {
  const { box, ring, extras } = SIZES[size]
  const band = `radial-gradient(farthest-side, transparent calc(100% - ${String(ring)}px), #000 calc(100% - ${String(ring - 0.5)}px))`
  // Only the arc is masked to the ring; the head sits beside it so its glow is not cut off.
  const arc: CSSProperties = {
    background:
      'conic-gradient(from 0deg, transparent 0deg 120deg, color-mix(in oklab, var(--primary) 22%, transparent) 220deg, var(--primary) 335deg, #c4b5fd 360deg)',
    mask: band,
    WebkitMask: band,
  }
  const head = ring * 1.9
  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-grid shrink-0 place-items-center', box, className)}
    >
      {/* The track and a soft glow behind the mark. */}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `inset 0 0 0 ${String(ring)}px color-mix(in oklab, var(--primary) 13%, transparent)`,
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--primary) 14%, transparent) 0%, transparent 68%)',
        }}
      />
      {/* The comet: an arc that brightens towards its head, turning clockwise. */}
      <span className="absolute inset-0 animate-spin" style={{ animationDuration: '1.1s' }}>
        <span className="absolute inset-0 rounded-full" style={arc} />
        <span
          className="absolute left-1/2 rounded-full bg-[#ddd6fe]"
          style={{
            width: head,
            height: head,
            top: (ring - head) / 2,
            translate: '-50% 0',
            boxShadow: `0 0 ${String(ring * 2)}px ${String(ring / 2)}px var(--primary)`,
          }}
        />
      </span>
      {extras && (
        <span className="absolute bottom-[19%] left-1/2 h-[5%] w-[34%] -translate-x-1/2 animate-pegasus-shadow rounded-full bg-primary/40 blur-[1.5px] motion-reduce:animate-none" />
      )}
      <img
        src={PRODUCT_LOGO.iconColor}
        alt=""
        width={472}
        height={345}
        draggable={false}
        className="relative w-[56%] animate-pegasus-glide select-none motion-reduce:animate-none"
      />
      {extras && (
        <>
          <Sparkle className="-top-[4%] -right-[4%] size-[16%]" delay={0} />
          <Sparkle className="bottom-[4%] -left-[6%] size-[12%]" delay={0.6} />
          <Sparkle className="top-[22%] -left-[14%] size-[9%]" delay={1.2} />
        </>
      )}
    </span>
  )
}

/** "Loading the employee" followed by three dots that bounce in turn. */
export function LoadingCaption({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-baseline gap-1 text-sm text-muted-foreground', className)}
    >
      {label}
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1 animate-dot-bounce rounded-full bg-current motion-reduce:animate-none"
            style={{ animationDelay: `${String(dot * 0.15)}s` }}
          />
        ))}
      </span>
    </span>
  )
}

/**
 * The Pegasus loader as a status: screen readers hear `label` ("Loading the employee"); with
 * `showLabel` it is also written under the mark.
 */
export function BrandLoader({
  size = 'md',
  label = 'Loading',
  showLabel = false,
  className,
}: {
  size?: BrandLoaderSize
  label?: string
  showLabel?: boolean
  className?: string
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-flex flex-col items-center gap-3', className)}
    >
      <BrandMark size={size} />
      {showLabel ? <LoadingCaption label={label} /> : <span className="sr-only">{label}</span>}
    </span>
  )
}
