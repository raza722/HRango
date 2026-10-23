import type { CSSProperties } from 'react'

import defaultCoverUrl from '@/assets/images/project-management/workspace-cover.jpg'

/** Covers "Change Cover" offers; `coverUrl` stores the key (or an uploaded data URL). */
export const COVER_PRESETS = [
  { key: 'cover:default', label: 'Purple waves', background: `url("${defaultCoverUrl}")` },
  {
    key: 'gradient:violet',
    label: 'Violet',
    background: 'linear-gradient(120deg, #7127EA 0%, #A181FF 55%, #E9D8FD 100%)',
  },
  {
    key: 'gradient:ocean',
    label: 'Ocean',
    background: 'linear-gradient(120deg, #2550D0 0%, #0BA5EC 60%, #B9E6FE 100%)',
  },
  {
    key: 'gradient:sunset',
    label: 'Sunset',
    background: 'linear-gradient(120deg, #B7192C 0%, #F79009 60%, #FEDF89 100%)',
  },
  {
    key: 'gradient:mint',
    label: 'Mint',
    background: 'linear-gradient(120deg, #027A48 0%, #12B76A 55%, #A6F4C5 100%)',
  },
  {
    key: 'gradient:night',
    label: 'Night',
    background: 'linear-gradient(120deg, #17263A 0%, #293749 50%, #7127EA 100%)',
  },
] as const

/** Uploaded covers are kept as data URLs; this keeps them small enough to store. */
export const COVER_MAX_BYTES = 2 * 1024 * 1024

/** The banner background for a workspace's `coverUrl` (null: the design's purple image). */
export function coverStyle(coverUrl: string | null): CSSProperties {
  const preset = COVER_PRESETS.find((entry) => entry.key === coverUrl)
  const background = preset
    ? preset.background
    : coverUrl
      ? `url("${coverUrl}")`
      : `url("${defaultCoverUrl}")`
  return {
    backgroundImage: background,
    backgroundSize: 'cover',
    // The frame shows the image's band from 28% down (Cover BG Section 1:3842).
    backgroundPosition: 'center 38%',
  }
}

/** True when `coverUrl` is this preset (null counts as the default image). */
export const isCover = (coverUrl: string | null, key: string) =>
  (coverUrl ?? 'cover:default') === key
