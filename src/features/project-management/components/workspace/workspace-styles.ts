/**
 * Classes of the workspace page, from the Figma "CSS (all layers)" exports of Workspace Page
 * (1:2755), its task row group (1:2779), the task row menu (288:156930) and Set Role Permission
 * (132:126211). Sizes are the frames' px in rem (÷16). Text is Poppins (the app's sans font).
 */

/** Task row menu (288:156930) and the other row-style menus. */
export const menuStyles = {
  /** White card, 15 px padding, 12 px between rows, 13 px radius, soft shadow. */
  content:
    'z-50 flex max-h-(--radix-dropdown-menu-content-available-height) max-w-[calc(100vw-1rem)] min-w-[15rem] flex-col gap-3 overflow-y-auto rounded-[0.8125rem] bg-white p-[0.9375rem] shadow-[0_0.18rem_0.78rem_rgba(0,0,0,0.14)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
  /** Rows 52 px: 0.73 px #E9E9E9 outline, purple icon, Regular 16 #454545. */
  item: 'flex min-h-[3.25rem] shrink-0 cursor-pointer items-center gap-3.5 rounded-[0.8125rem] border-[0.045rem] border-[#E9E9E9] bg-white px-[0.97rem] text-base text-[#454545] outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:border-[#D9C8FB] data-[highlighted]:bg-[#F8F5FF] data-[state=open]:border-[#D9C8FB] data-[state=open]:bg-[#F8F5FF]',
  icon: 'flex size-[1.375rem] shrink-0 items-center justify-center text-[#7127EA] [&_svg]:max-h-[1.375rem] [&_svg]:w-[1.375rem]',
  label: 'px-1 text-[0.9375rem] font-semibold text-[#4A4A4A]',
  /** 1.8 px rgba(0,0,0,0.08), 20 px clear above and below (12 px gap + 8 px margin). */
  separator: 'my-2 h-[0.1136rem] shrink-0 bg-black/[0.08]',
  /** Sharing & Permissions: outlined blue, SemiBold 14. */
  outline:
    'flex min-h-[3.395rem] shrink-0 cursor-pointer items-center justify-center rounded-[0.539rem] border-[0.0665rem] border-[#2550D0] bg-white px-3 text-sm font-semibold text-[#2550D0] outline-none select-none data-[highlighted]:bg-[#EEF2FC]',
  /** Delete: filled #B7192C, SemiBold 14 white. */
  danger:
    'flex min-h-[3.25rem] shrink-0 cursor-pointer items-center justify-center rounded-[0.596rem] bg-[#B7192C] px-3 text-sm font-semibold text-white outline-none select-none data-[highlighted]:bg-[#9b1524]',
} as const

/** Column header menu ("Sorting Order Menu" in 1:2755): two columns of 54 px rows. */
export const headerMenuStyles = {
  content:
    'z-50 grid max-h-(--radix-dropdown-menu-content-available-height) w-[34.625rem] max-w-[calc(100vw-1rem)] grid-cols-1 gap-x-[1.875rem] gap-y-4 overflow-y-auto rounded-[0.8125rem] bg-white p-[0.9375rem] shadow-[0_0.18rem_0.78rem_rgba(0,0,0,0.14)] outline-none sm:grid-cols-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
  item: 'flex min-h-[3.375rem] cursor-pointer items-center gap-3 rounded-[0.8125rem] border-[0.045rem] border-[#E9E9E9] bg-white px-[0.97rem] text-base text-[#454545] outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:border-[#D9C8FB] data-[highlighted]:bg-[#F8F5FF] data-[state=checked]:border-[#D9C8FB] data-[state=checked]:bg-[#F8F5FF]',
  title: 'pb-1 text-[0.9375rem] font-semibold text-[#4A4A4A] sm:col-span-2',
  separator: 'h-[0.125rem] bg-black/[0.08] sm:col-span-2',
  danger:
    'flex min-h-[3.375rem] cursor-pointer items-center justify-center rounded-[0.9rem] bg-[#B7192C] px-3 text-base font-semibold text-white outline-none select-none data-[highlighted]:bg-[#9b1524]',
} as const

/** The List view (1:2779). */
export const listStyles = {
  /** Header row: 51 px white bar, #ECECEC outline, 10 px radius. */
  headerRow: 'flex h-[3.1875rem] w-max min-w-full items-stretch',
  /** Header cell: 39 px, SemiBold 18 #626262; #F8F5FF on hover. */
  headerCell:
    'flex h-[2.4375rem] min-w-0 items-center gap-2.5 rounded-md bg-white px-1.5 text-lg font-semibold text-[#626262] transition-colors hover:bg-[#F8F5FF]',
  /** Task row: 80 px white card, #ECECEC outline, 14 px radius. */
  row: 'group/row flex min-h-[5rem] w-max min-w-full items-stretch',
  /** Task Name stays put while the other columns scroll, once the list is wide enough. */
  stickyStart:
    'flex shrink-0 items-center rounded-l-[0.875rem] border-y border-l border-[#ECECEC] bg-white @5xl/list:sticky @5xl/list:left-0 @5xl/list:z-[5]',
  /** The scrolling middle of a row: the columns after Task Name. */
  middle: 'flex min-w-0 flex-1 items-center border-y border-[#ECECEC] bg-white',
  /** Gap between the columns after Task Name. */
  cell: 'flex min-w-0 shrink-0 items-center',
  /** The 57 px end of a row (three dots) and of the header ("+"). */
  tail: 'flex shrink-0 items-center justify-center rounded-r-[0.875rem] border border-[#ECECEC] bg-white @5xl/list:sticky @5xl/list:right-0 @5xl/list:z-[5]',
  iconButton:
    'inline-flex shrink-0 items-center justify-center rounded-lg text-[#7127EA] transition-colors hover:bg-[#F0E9FD] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none',
  /** Unticked: #F1F2F3 with a faint navy outline; ticked: purple. */
  checkbox:
    'size-[1.4375rem] rounded-[0.25rem] border-[#17263A]/30 bg-[#F1F2F3] shadow-none data-[state=checked]:border-[#7127EA] data-[state=checked]:bg-[#7127EA] data-[state=indeterminate]:border-[#7127EA] data-[state=indeterminate]:bg-[#7127EA] data-[state=indeterminate]:text-white',
} as const

/** Cover banner (1:3842). */
export const bannerStyles = {
  /** 50 px frosted circles; the label slides out on hover, as the hidden "Collapse …" pills. */
  iconButton:
    'group/banner inline-flex h-[3.125rem] min-w-[3.125rem] shrink-0 items-center justify-center rounded-full border border-white/45 bg-white/60 px-[0.8rem] text-[#262424] backdrop-blur-[0.55rem] transition-colors hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none data-[state=open]:bg-white/80',
  label:
    'max-w-0 overflow-hidden text-lg font-semibold whitespace-nowrap text-[#1D1A1A] transition-[max-width,margin] duration-200 group-hover/banner:ml-2.5 group-hover/banner:max-w-[12rem] group-focus-visible/banner:ml-2.5 group-focus-visible/banner:max-w-[12rem]',
  frosted: 'bg-white/60 backdrop-blur-[0.55rem]',
} as const

/** Popups opened from the page (Add Description, Change Cover, Filters, Customize). */
export const popupStyles = {
  content:
    'rounded-[0.8125rem] border-0 bg-white p-[0.9375rem] shadow-[0_0.18rem_0.78rem_rgba(0,0,0,0.14)]',
  title: 'text-lg font-semibold text-[#393636]',
  text: 'text-xs font-medium tracking-[0.012rem] text-[#4A4A4A]',
  field:
    'w-full rounded-[0.8125rem] border-[0.045rem] border-[#E9E9E9] bg-white px-3 py-2 text-[0.9rem] text-[#454545] outline-none placeholder:text-[#909090] focus:border-[#7127EA] focus:ring-4 focus:ring-[#7127EA]/20',
} as const
