import { format, parse } from 'date-fns'

/** What the "Regenerate" button needs to write a transfer application. */
export interface TransferLetterInput {
  employee: string
  finalAuthority: string
  /** `yyyy-MM-dd`. */
  effectiveDate: string
  from: { location: string | null; branch: string | null; department: string }
  to: { location: string; branch: string; department: string }
  lineManager: string | null
  description: string
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

const place = (where: { location: string | null; branch: string | null; department: string }) => {
  const site = [where.branch, where.location].filter(Boolean).join(', ')
  return `the ${where.department} department${site ? ` at ${site}` : ''}`
}

/**
 * The transfer application the editor's "Regenerate" writes: the same input
 * always gives the same letter, in the design's sample layout (subject, greeting,
 * request, reason, thanks, signature).
 */
export function transferLetter(input: TransferLetterInput): string {
  const effective = day(input.effectiveDate)
  const paragraphs = [
    `Subject: Transfer Request for ${format(effective, 'EEE, MMM d, yyyy')}`,
    `Dear ${input.finalAuthority},`,
    `I hope this message finds you well. I am writing to request a transfer from ${place(input.from)} to ${place(input.to)}, effective ${format(effective, 'EEEE, MMMM d, yyyy')}.`,
    ...(input.description.trim()
      ? [`The reason for my request: ${input.description.trim().replace(/\.?$/, '.')}`]
      : []),
    input.lineManager
      ? `After the move I would report to ${input.lineManager} as my line manager. I will hand over my current work in good time before the effective date.`
      : 'I will hand over my current work in good time before the effective date.',
    'Thank you for your understanding and consideration.',
  ]
  return [
    ...paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`),
    `<p>Sincerely,<br>${escapeHtml(input.employee)}</p>`,
  ].join('')
}

const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'DIV',
  'SPAN',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'UL',
  'OL',
  'LI',
  'H2',
  'H3',
  'FONT',
])
/** Dropped with everything inside them. */
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE'])
const COLOUR = /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i
const ALLOWED_STYLES: Record<string, RegExp> = {
  'text-align': /^(left|right|center|justify|start|end)$/,
  'font-family': /^[\w\s,'"-]+$/,
  'background-color': COLOUR,
  color: COLOUR,
  'font-weight': /^(bold|normal|[1-9]00)$/,
  'text-decoration': /^[a-z\s-]+$/,
  'text-decoration-line': /^[a-z\s-]+$/,
}

const allowed = (name: string, value: string) => ALLOWED_STYLES[name]?.test(value) ?? false

function clean(node: Node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove()
      continue
    }
    if (!(child instanceof Element)) continue
    if (DROPPED_TAGS.has(child.tagName)) {
      child.remove()
      continue
    }
    clean(child)
    if (!ALLOWED_TAGS.has(child.tagName)) {
      child.replaceWith(...child.childNodes)
      continue
    }
    const style = child.getAttribute('style') ?? ''
    const face = child.tagName === 'FONT' ? child.getAttribute('face') : null
    for (const attribute of [...child.attributes]) child.removeAttribute(attribute.name)
    const kept = style.split(';').flatMap((rule) => {
      const [name = '', ...rest] = rule.split(':')
      const key = name.trim().toLowerCase()
      const value = rest.join(':').trim()
      return allowed(key, value) ? [`${key}: ${value}`] : []
    })
    if (kept.length > 0) child.setAttribute('style', kept.join('; '))
    if (face && allowed('font-family', face)) child.setAttribute('face', face)
  }
}

const bodyOf = (html: string) =>
  new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body

/**
 * Keeps only the editor's own formatting (paragraphs, bold, underline, lists,
 * alignment, font and highlight) and drops scripts, links, images and every
 * other attribute, so the stored letter is safe to show.
 */
export function sanitizeApplication(html: string): string {
  if (!html.trim()) return ''
  const body = bodyOf(html)
  clean(body)
  return body.innerHTML
}
