/*
 * Page audit for the browser console (used for the frontend review of 23 Oct 2026, see the
 * README's "Frontend review" section). Paste the whole file into DevTools on any page of the
 * running app (signed in), then:
 *
 *   await __sweep(ROUTES)          // layout, contrast and naming checks, one line per route
 *   await __layoutOnly(ROUTES)     // only overflow, clipping and error states
 *   await __contrastOnly(ROUTES)   // only text under 2.5:1 and unnamed controls
 *
 * Run it at the widths and themes you care about (DevTools device toolbar; the theme toggle
 * in the top bar). Each route is opened with pushState, so the app keeps its state and the
 * mock API; the sweep waits for the page's spinners to go, at most 3.5 s per route.
 *
 * It avoids `setTimeout` on purpose: Chrome throttles chained timers to once a minute in a
 * tab that has been hidden for five minutes, which stalled an earlier version of this script.
 * Backgrounds are composited on a canvas, so translucent layers (`bg-primary/10`, `oklab`)
 * count correctly in the contrast check.
 *
 * What a line can report:
 *   docOverflow   page is wider than the viewport (sideways scroll); negative is the scrollbar
 *   beyondRight   visible elements past the right edge, outside any horizontal scroller
 *   clippedText   text cut off without an ellipsis
 *   clippedBox    a box hiding its own overflow (line-clamp and scroll areas excluded)
 *   lowContrast   text under 2.5:1 against its composited background
 *   unnamed       buttons and links with no accessible name
 *   noAlt         images without an alt attribute
 *   errorText     an error or "could not be loaded" state on the page
 */

/* eslint-disable */
;(() => {
  const pc = document.createElement('canvas')
  pc.width = pc.height = 1
  const pctx = pc.getContext('2d', { willReadFrequently: true })
  const sc = document.createElement('canvas')
  sc.width = sc.height = 1
  const sctx = sc.getContext('2d', { willReadFrequently: true })

  /** Any CSS colour to [r, g, b, alpha], or null when the browser cannot parse it. */
  const parse = (c) => {
    pctx.clearRect(0, 0, 1, 1)
    pctx.fillStyle = '#010203'
    pctx.fillStyle = c
    if (pctx.fillStyle === '#010203') return null
    pctx.fillRect(0, 0, 1, 1)
    const d = pctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }
  const lumOf = ([r, g, b]) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  /** The background behind an element: every ancestor's background composited, outermost first. */
  window.__bgOf = (el) => {
    const chain = []
    for (let p = el; p; p = p.parentElement) chain.push(p)
    sctx.clearRect(0, 0, 1, 1)
    sctx.fillStyle = '#ffffff'
    sctx.fillRect(0, 0, 1, 1)
    for (let i = chain.length - 1; i >= 0; i--) {
      const v = parse(getComputedStyle(chain[i]).backgroundColor)
      if (!v || v[3] === 0) continue
      sctx.fillStyle = `rgba(${v[0]},${v[1]},${v[2]},${v[3]})`
      sctx.fillRect(0, 0, 1, 1)
    }
    const d = sctx.getImageData(0, 0, 1, 1).data
    return { l: lumOf([d[0], d[1], d[2]]), c: `rgb(${d[0]},${d[1]},${d[2]})` }
  }
  window.__fgOf = (el, bg) => {
    const v = parse(getComputedStyle(el).color)
    if (!v || v[3] === 0) return null
    const [r, g, b, a] = v
    if (a < 1) {
      const [br, bgc, bb] = bg.c.match(/\d+/g).map(Number)
      return lumOf([r * a + br * (1 - a), g * a + bgc * (1 - a), b * a + bb * (1 - a)])
    }
    return lumOf([r, g, b])
  }

  window.__audit = function () {
    const W = innerWidth
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (/(auto|scroll)/.test(s.overflowX) || /(auto|scroll)/.test(s.overflow)) return true
      }
      return false
    }
    const desc = (el) =>
      `${el.tagName.toLowerCase()}.${typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 3).join('.') : ''} "${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 34)}"`
    const out = {
      url: location.pathname + location.search,
      title: document.title.replace(/ \| .*$/, ''),
      docOverflow: document.documentElement.scrollWidth - W,
      beyondRight: [],
      clippedText: [],
      clippedBox: [],
      lowContrast: [],
      unnamed: [],
      noAlt: 0,
      errorText: null,
    }
    const main = document.querySelector('main') || document.body
    const txt = main.innerText || ''
    const m = txt.match(/Something went wrong|Page not found|could not be loaded|Failed to/i)
    if (m) out.errorText = txt.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ')
    const seen = new Set()
    for (const el of main.querySelectorAll('*')) {
      if (!el.checkVisibility() || el.closest('.sr-only, caption')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const s = getComputedStyle(el)
      if (r.right > W + 1 && r.left < W && !inScroller(el)) {
        const d = desc(el)
        if (!seen.has(d)) {
          seen.add(d)
          out.beyondRight.push(`${d} right=${Math.round(r.right)}`)
        }
      }
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      const hidX = /hidden|clip/.test(s.overflowX) || /hidden|clip/.test(s.overflow)
      if (hidX && el.scrollWidth > el.clientWidth + 2 && s.textOverflow !== 'ellipsis' && hasText)
        out.clippedText.push(`${desc(el)} ${el.scrollWidth}>${el.clientWidth}`)
      const hidY = /hidden|clip/.test(s.overflowY) || /hidden|clip/.test(s.overflow)
      if (
        hidY &&
        el.scrollHeight > el.clientHeight + 2 &&
        el.clientHeight > 0 &&
        !el.closest('[data-radix-scroll-area-viewport]') &&
        !s.transition.includes('height') &&
        !/line-clamp/.test(el.className)
      )
        out.clippedBox.push(`${desc(el)} ${el.scrollHeight}>${el.clientHeight}`)
      if (
        hasText &&
        r.height >= 8 &&
        r.width >= 4 &&
        !el.closest('[aria-disabled="true"], :disabled, [data-disabled]')
      ) {
        const bg = window.__bgOf(el)
        const fl = window.__fgOf(el, bg)
        if (fl !== null) {
          const ratio = (Math.max(fl, bg.l) + 0.05) / (Math.min(fl, bg.l) + 0.05)
          if (ratio < 2.5)
            out.lowContrast.push(`${desc(el)} ${ratio.toFixed(1)} ${s.color} on ${bg.c}`)
        }
      }
      if (
        (el.tagName === 'BUTTON' || el.tagName === 'A') &&
        !(el.innerText || '').trim() &&
        !el.getAttribute('aria-label') &&
        !el.getAttribute('aria-labelledby') &&
        !el.getAttribute('title') &&
        !(el.id && document.querySelector(`label[for="${el.id}"]`)) &&
        !el.querySelector('img[alt]:not([alt=""]), [aria-label], .sr-only')
      )
        out.unnamed.push(desc(el))
      if (el.tagName === 'IMG' && el.getAttribute('alt') === null) out.noAlt++
    }
    for (const k of ['beyondRight', 'clippedText', 'clippedBox', 'lowContrast', 'unnamed'])
      out[k] = [...new Set(out[k])].slice(0, 6)
    return out
  }

  /** Waits without timers: yields through the task queue until the page has settled. */
  const yieldTask = () =>
    new Promise((r) => {
      const ch = new MessageChannel()
      ch.port1.onmessage = () => r()
      ch.port2.postMessage(0)
    })
  window.__settle = async (min = 1200, max = 3500) => {
    const t0 = performance.now()
    for (;;) {
      await yieldTask()
      const el = performance.now() - t0
      const busy = document.querySelector('main .animate-spin, main [aria-busy="true"]')
      if ((el >= min && !busy) || el >= max) return Math.round(el)
    }
  }
  const open = async (path) => {
    history.pushState({}, '', path)
    dispatchEvent(new PopStateEvent('popstate'))
    return window.__settle()
  }
  const line = (o, keys) => {
    const parts = keys
      .filter((k) => (Array.isArray(o[k]) ? o[k].length : o[k]))
      .map((k) => `${k}=${JSON.stringify(o[k])}`)
    return parts.length ? `${o.url} ${parts.join(' ')}` : null
  }
  const run = (keys, keepDocOverflow) => async (routes) => {
    const out = []
    for (const r of routes) {
      try {
        await open(r)
        const o = window.__audit()
        if (keepDocOverflow && o.docOverflow <= 0) o.docOverflow = 0
        const l = line(o, keys)
        if (l) out.push(l)
      } catch (e) {
        out.push(`${r} ERROR ${e.message}`)
      }
    }
    return out.join('\n') || 'all clean'
  }
  window.__sweep = run(
    [
      'docOverflow',
      'beyondRight',
      'clippedText',
      'clippedBox',
      'lowContrast',
      'unnamed',
      'noAlt',
      'errorText',
    ],
    true,
  )
  window.__layoutOnly = run(
    ['docOverflow', 'beyondRight', 'clippedText', 'clippedBox', 'errorText'],
    true,
  )
  window.__contrastOnly = run(['lowContrast', 'unnamed'])
  console.log('page audit ready: __sweep(routes), __layoutOnly(routes), __contrastOnly(routes)')
})()
