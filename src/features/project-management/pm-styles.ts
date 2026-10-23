/**
 * Colours and button styles of the Project Management files, from their Figma variables
 * ("Primary Colors", "Danger Colors", "Info & Positive Colors", "Neutral Colors"). The module's
 * text is Poppins (the app's sans font).
 */
export const PM_COLORS = {
  /** Primary Colors / Primary Purple Color Varients/700 */
  purple: '#7127EA',
  /** Primary Purple Color Varients/400 */
  purpleLight: '#A181FF',
  /** Lavender chips and selected rows. */
  lavender: '#F0E9FD',
  /** Danger Colors/700: Cancel. */
  dangerDark: '#B7192C',
  /** Danger Colors/600: counters, close icon, required marks. */
  danger: '#DC3545',
  /** Info & Positive Colors/700: Done. */
  info: '#2550D0',
  /** Neutral Colors/700: secondary text. */
  neutral: '#5D6481',
  /** Create Workspace Page background. */
  page: '#F1F5F9',
} as const

export const pmButton = {
  /** Continue, Create Workspace, Add Member: purple, white Poppins SemiBold. */
  primary:
    'inline-flex items-center justify-center gap-3 rounded-2xl bg-[#7127EA] px-6 text-base font-semibold text-white transition-colors hover:bg-[#5f1fd0] disabled:cursor-not-allowed disabled:bg-[#D4C2FA] disabled:text-white/80',
  /** Cancel: filled dark red. */
  cancel:
    'inline-flex items-center justify-center rounded-2xl bg-[#B7192C] px-6 text-base font-semibold text-white transition-colors hover:bg-[#9b1524]',
  /** Done on the detail pages: blue. */
  done: 'inline-flex items-center justify-center rounded-xl bg-[#2550D0] px-6 text-base font-semibold text-white transition-colors hover:bg-[#1f44b3]',
  /** Back: purple outline. */
  back: 'inline-flex items-center justify-center gap-2 rounded-2xl border border-[#7127EA] bg-white px-6 text-base font-medium text-[#7127EA] transition-colors hover:bg-[#F0E9FD]',
  /** Save in the task popups: green. */
  save: 'inline-flex items-center justify-center rounded-xl bg-[#2CBD4D] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#25a442]',
} as const

/** The red rounded close (x) at the top right of the modals and popups. */
export const pmCloseButton =
  'inline-flex size-8 items-center justify-center rounded-lg bg-[#FDECEE] text-[#DC3545] transition-colors hover:bg-[#fbd5da]'
