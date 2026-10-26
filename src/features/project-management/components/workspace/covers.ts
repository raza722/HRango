import type { CSSProperties } from 'react'

import defaultCoverUrl from '@/assets/images/project-management/workspace-cover.jpg'

/**
 * Change Cover uploads an image (`POST /files`, module projects) and sets it with
 * `PUT /workspaces/{id}/cover`; removing it brings back the design's purple image.
 */
export const COVER_TYPES = '.png,.jpg,.jpeg,.gif,.webp'
export const COVER_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/** Covers stay small: the banner is 180 px high. */
export const COVER_MAX_BYTES = 5 * 1024 * 1024

/** The banner background for a cover's signed link (null: the design's purple image). */
export function coverStyle(coverUrl: string | null): CSSProperties {
  return {
    backgroundImage: `url("${coverUrl ?? defaultCoverUrl}")`,
    backgroundSize: 'cover',
    // The frame shows the image's band from 28% down (Cover BG Section 1:3842).
    backgroundPosition: 'center 38%',
  }
}
