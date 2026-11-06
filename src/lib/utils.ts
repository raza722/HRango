import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The theme's own shadow sizes (globals.css), so `shadow-glow shadow-primary/50` keeps both: a
// size and a colour, not two colours where the last one wins.
const twMerge = extendTailwindMerge({ extend: { theme: { shadow: ['glow', 'lift'] } } })

/** Merges class names and resolves conflicting Tailwind utilities (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Promise-based sleep, mainly for mocks and tests. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Returns initials for an avatar fallback: "Shelley Kannes" -> "SK". */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/**
 * Accepts only same-origin, absolute paths for post-login redirects,
 * so `?redirect=//evil.example` or `https://...` cannot be abused.
 */
export function toSafeRedirect(value: string | undefined, fallback = '/'): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
