import {
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from 'react'

import { cn } from '@/lib/utils'

/** Where pressing must not start a pan: controls, fields, menus and things that drag themselves. */
const NO_PAN = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[draggable="true"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
  '[data-no-pan]',
].join(',')

/** Pixels the pointer moves sideways before a press becomes a pan (a click stays a click). */
const PAN_THRESHOLD = 5

interface PanScrollProps extends ComponentProps<'div'> {
  /** Classes for the outer wrapper; `className` styles the scrolling box itself. */
  wrapperClassName?: string
  /**
   * Soft shadows on the side that has more to show. Leave off where a sticky first column
   * already marks the left edge.
   */
  edges?: boolean
}

/**
 * A box that scrolls sideways, made easy to move when it is taller than the screen:
 * - a horizontal scrollbar floats at the bottom of the screen while the box's own one is out of
 *   view (mouse and trackpad screens; phones swipe), synced both ways with the box;
 * - pressing on empty space and dragging pans it, with the grab hand (mouse only; controls,
 *   fields and draggable cards or rows keep their own behaviour);
 * - optional edge shadows say there is more to the left or right.
 * Shift + wheel and trackpad swipes scroll it as usual. Props go to the scrolling box, so it
 * replaces a plain `overflow-x-auto` div (roles and labels included).
 */
export function PanScroll({
  className,
  wrapperClassName,
  edges = false,
  children,
  onPointerDown,
  ...props
}: PanScrollProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const box = boxRef.current
    const bar = barRef.current
    const spacer = spacerRef.current
    const end = endRef.current
    if (!wrap || !box || !bar || !spacer || !end) return

    let endInView = true
    let boxInView = false
    // State lives in data attributes, so scrolling never re-renders the content.
    const update = () => {
      const max = box.scrollWidth - box.clientWidth
      const overflow = max > 1
      const float = overflow && boxInView && !endInView
      wrap.toggleAttribute('data-overflow', overflow)
      wrap.toggleAttribute('data-float', float)
      wrap.toggleAttribute('data-more-start', overflow && box.scrollLeft > 1)
      wrap.toggleAttribute('data-more-end', overflow && box.scrollLeft < max - 1)
      // The bar is a little narrower than the box; giving it the same scroll range keeps the
      // two positions equal, so syncing is a plain copy.
      spacer.style.width = `${String(bar.clientWidth + Math.max(0, max))}px`
      // A hidden bar forgets its position: catch it up when it shows.
      if (float && Math.abs(bar.scrollLeft - box.scrollLeft) > 0.5) bar.scrollLeft = box.scrollLeft
    }
    const fromBox = () => {
      if (Math.abs(bar.scrollLeft - box.scrollLeft) > 0.5) bar.scrollLeft = box.scrollLeft
      update()
    }
    const fromBar = () => {
      if (Math.abs(box.scrollLeft - bar.scrollLeft) > 0.5) box.scrollLeft = bar.scrollLeft
    }
    box.addEventListener('scroll', fromBox, { passive: true })
    bar.addEventListener('scroll', fromBar, { passive: true })

    // The content's width changes with columns, filters and new cards: watch the box's children.
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    const watch = () => {
      if (!resize) return
      resize.disconnect()
      resize.observe(box)
      for (const child of Array.from(box.children)) resize.observe(child)
    }
    watch()
    const mutations =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            watch()
            update()
          })
    mutations?.observe(box, { childList: true })

    // The floating bar shows only while the box is on screen (at least 48px of it, so the bar
    // never sits over what is above the box) and its bottom, with its own scrollbar, is not.
    const hasObserver = typeof IntersectionObserver !== 'undefined'
    const endWatch = hasObserver
      ? new IntersectionObserver(([entry]) => {
          endInView = entry?.isIntersecting ?? true
          update()
        })
      : null
    const boxWatch = hasObserver
      ? new IntersectionObserver(
          ([entry]) => {
            boxInView = entry?.isIntersecting ?? false
            update()
          },
          { rootMargin: '0px 0px -48px 0px' },
        )
      : null
    endWatch?.observe(end)
    boxWatch?.observe(box)
    update()

    return () => {
      box.removeEventListener('scroll', fromBox)
      bar.removeEventListener('scroll', fromBar)
      resize?.disconnect()
      mutations?.disconnect()
      endWatch?.disconnect()
      boxWatch?.disconnect()
    }
  }, [])

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(event)
    const box = boxRef.current
    if (
      event.defaultPrevented ||
      !box ||
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      box.scrollWidth - box.clientWidth <= 1 ||
      (event.target instanceof Element && event.target.closest(NO_PAN))
    ) {
      return
    }
    const startX = event.clientX
    const startY = event.clientY
    const startLeft = box.scrollLeft
    let panning = false

    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      if (!panning) {
        // Sideways first: a mostly vertical drag is left to select text.
        if (Math.abs(dx) < PAN_THRESHOLD || Math.abs(dx) < Math.abs(moveEvent.clientY - startY)) {
          return
        }
        panning = true
        box.setAttribute('data-panning', '')
        window.getSelection()?.removeAllRanges()
      }
      moveEvent.preventDefault()
      box.scrollLeft = startLeft - dx
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      if (!panning) return
      box.removeAttribute('data-panning')
      // The release after a pan is not a click on whatever is under the pointer.
      const swallow = (clickEvent: MouseEvent) => {
        clickEvent.stopPropagation()
        clickEvent.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => {
        window.removeEventListener('click', swallow, { capture: true })
      }, 0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  return (
    <div ref={wrapRef} className={cn('group/pan relative min-w-0', wrapperClassName)}>
      <div
        ref={boxRef}
        className={cn(
          'relative overflow-x-auto',
          // The grab hand says "drag me" wherever nothing else claims the pointer.
          'data-[panning]:cursor-grabbing data-[panning]:snap-none data-[panning]:select-none pointer-fine:group-data-[overflow]/pan:cursor-grab',
          className,
        )}
        onPointerDown={startPan}
        {...props}
      >
        {children}
      </div>

      {edges && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-[7] w-5 opacity-0 shadow-[inset_14px_0_12px_-12px_rgb(15_23_42/0.2)] transition-opacity duration-200 group-data-[more-start]/pan:opacity-100 dark:shadow-[inset_14px_0_12px_-12px_rgb(0_0_0/0.65)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-[7] w-5 opacity-0 shadow-[inset_-14px_0_12px_-12px_rgb(15_23_42/0.2)] transition-opacity duration-200 group-data-[more-end]/pan:opacity-100 dark:shadow-[inset_-14px_0_12px_-12px_rgb(0_0_0/0.65)]"
          />
        </>
      )}

      {/* A zero-height anchor that sticks to the screen's bottom edge, holding the floating bar. */}
      <div className="pointer-events-none sticky bottom-0 z-[8] h-0">
        <div
          ref={barRef}
          aria-hidden="true"
          tabIndex={-1}
          title="Drag here, drag the list itself, or use Shift + wheel to scroll sideways"
          className="pointer-events-auto absolute inset-x-1 bottom-1.5 hidden scrollbar-brand overflow-x-auto overflow-y-hidden rounded-full bg-card/90 px-1 py-0.5 shadow-[0_2px_10px_-2px_rgb(15_23_42/0.25)] ring-1 ring-border backdrop-blur-sm group-data-[float]/pan:block pointer-coarse:hidden!"
        >
          <div ref={spacerRef} className="h-px" />
        </div>
      </div>
      {/* Marks the box's bottom: while it is on screen the box's own scrollbar is too. */}
      <div ref={endRef} aria-hidden="true" className="-mt-px h-px" />
    </div>
  )
}
