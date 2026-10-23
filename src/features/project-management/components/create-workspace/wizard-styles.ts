/**
 * Classes of the Create Workspace wizard, from the frames' CSS exports (Figma "CSS (all layers)",
 * `HRango2/Design/project-management/css`). Sizes are the design's pixels in rem (1rem = 16px) so
 * they follow the app's fluid UI scale; below `sm` the biggest type steps down so a phone fits.
 */
export const wz = {
  // --- modal ---------------------------------------------------------------------------------
  /** Rectangle 34624579: the page dims to rgba(0, 0, 0, 0.24). */
  overlay:
    'fixed inset-0 z-50 bg-black/24 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
  /** Rectangle 34624580: 1081 x 949, #F1F5F9, radius 16. */
  modal:
    'fixed top-1/2 left-1/2 z-50 flex h-[min(59.3125rem,calc(100dvh-1rem))] w-[calc(100%-1rem)] max-w-[67.5625rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-[#F1F5F9] font-sans text-[#262626] shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
  /** 50px side padding at desktop width. */
  gutter: 'px-4 sm:px-8 lg:px-[3.125rem]',
  /** The scrolling middle of a step. */
  body: 'min-h-0 flex-1 overflow-y-auto',
  /** Footer buttons sit 20px above the modal's bottom edge. */
  footer:
    'flex shrink-0 flex-wrap items-center justify-end gap-3 pt-4 pb-4 sm:gap-[1.5625rem] sm:pb-5',

  // --- type ----------------------------------------------------------------------------------
  /** "Create Workspace", "Select Your Department *": Poppins Medium 25 / 38 #262626. */
  title:
    'text-xl leading-snug font-medium text-[#262626] sm:text-[1.5625rem] sm:leading-[2.375rem]',
  /** Detail page titles: Poppins SemiBold 30 / 45 #262626. */
  pageTitle:
    'text-xl leading-snug font-semibold text-[#262626] sm:text-[1.875rem] sm:leading-[2.8125rem]',
  /** Intro text: Poppins Regular 18 / 27 #3D3D3D. */
  intro: 'text-base leading-relaxed text-[#3D3D3D] sm:text-[1.125rem] sm:leading-[1.6875rem]',
  /** Field labels: Poppins SemiBold 18 / 27 #3D3D3D. */
  label: 'text-base leading-[1.6875rem] font-semibold text-[#3D3D3D] sm:text-[1.125rem]',
  /** "28/50 character": Poppins Regular 14 / 21, Danger Colors/500. */
  counter: 'text-[0.875rem] leading-[1.3125rem] tracking-[0.0168rem] text-[#EC474F]',
  /** Values and placeholders in the fields: Poppins Regular 20 / 30 #454545. */
  value:
    'text-base leading-[1.875rem] tracking-[0.0168rem] text-[#454545] sm:text-[1.25rem] sm:leading-[1.875rem]',
  /** Server and validation messages under a field. */
  error: 'mt-1.5 text-[0.875rem] leading-5 text-[#DC3545]',

  // --- fields --------------------------------------------------------------------------------
  /** Input Field: white, radius 18, 65 tall; focused: 1px #7127EA inside a 4px rgba(132,78,255,.2) ring. */
  field:
    'flex min-h-[4.0625rem] w-full items-center gap-[1.0625rem] rounded-[1.125rem] border border-transparent bg-white px-5 transition-[border-color,box-shadow] outline-none',
  fieldFocus:
    'focus-within:border-[#7127EA] focus-within:shadow-[0_0_0_4px_rgba(132,78,255,0.2)] has-[[aria-expanded=true]]:border-[#7127EA] has-[[aria-expanded=true]]:shadow-[0_0_0_4px_rgba(132,78,255,0.2)]',
  fieldInvalid: 'border-[#DC3545]',
  /** WorkSpace Icons: 31.6 x 33, #F8F8F8, radius 8. */
  iconTile:
    'flex h-[2.0625rem] w-[1.975rem] shrink-0 items-center justify-center rounded-lg bg-[#F8F8F8]',
  /** Workspace / owner icons: Primary Purple 600. */
  iconPurple600: 'text-[#762AFD]',
  iconPurple: 'text-[#7127EA]',

  // --- buttons -------------------------------------------------------------------------------
  /** Cancel Rectangel Button: 225 x 74, Danger 700, radius 16, Poppins SemiBold 18 white. */
  cancel:
    'inline-flex h-14 min-w-[8rem] items-center justify-center rounded-2xl bg-[#B7192C] px-8 text-base font-semibold text-white transition-colors hover:bg-[#9b1524] focus-visible:ring-2 focus-visible:ring-[#B7192C]/40 focus-visible:ring-offset-2 focus-visible:outline-none sm:h-[4.625rem] sm:w-[14.0625rem] sm:text-[1.125rem]',
  /** Continue Rectangel Button: 295 x 74, Primary 700 (disabled: Purple 200 with a Purple 400 line). */
  continue:
    'inline-flex h-14 min-w-[10rem] items-center justify-center gap-6 rounded-2xl border-[1.5px] border-[#7127EA] bg-[#7127EA] pr-[1.25rem] pl-10 sm:pr-[2.1875rem] text-base font-semibold text-white transition-colors hover:bg-[#5f1fd0] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-[#A181FF] disabled:bg-[#DBD2FF] disabled:text-[#BFAFFF] sm:h-[4.625rem] sm:w-[18.4375rem] sm:justify-end sm:gap-[3.3125rem] sm:pl-[5.75rem] sm:text-[1.125rem]',
  /** The round badge with a chevron (or plus) inside Continue / Create Workspace. */
  continueBadge:
    'flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.735rem] bg-white/13 shadow-[0_0_3.6px_3.6px_rgba(0,0,0,0.03)]',
  /** Create Workspace Rectangel Button: 381 x 74. */
  create: 'sm:w-[23.8125rem]',
  /** Back Button (steps 2 and 3): 180 x 73, 1.5px Primary 700 outline, radius 12, SemiBold 20. */
  back: 'inline-flex h-14 min-w-[7.5rem] items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-[#7127EA] bg-transparent px-6 text-[1.125rem] leading-[1.875rem] font-semibold text-[#7127EA] transition-colors hover:bg-[#7127EA]/5 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none sm:h-[4.5625rem] sm:w-[11.25rem] sm:text-[1.25rem]',
  /** Done (Create Rectangel Button on the detail pages): 225 x 74, Info 700, radius 12. */
  done: 'inline-flex h-14 min-w-[8rem] items-center justify-center rounded-xl bg-[#2550D0] px-8 text-base font-semibold text-white transition-colors hover:bg-[#1f44b3] focus-visible:ring-2 focus-visible:ring-[#2550D0]/40 focus-visible:ring-offset-2 focus-visible:outline-none sm:h-[4.625rem] sm:w-[14.0625rem] sm:text-[1.125rem]',
  /** Save in the template popups: Success Colors/600, radius 12. */
  save: 'inline-flex h-14 min-w-[8rem] items-center justify-center rounded-xl bg-[#318845] px-8 text-base font-semibold text-white transition-colors hover:bg-[#2a753b] focus-visible:ring-2 focus-visible:ring-[#318845]/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:h-[4.625rem] sm:w-[14.0625rem] sm:text-[1.125rem]',
  /** Add Member Rectangel Button: 303 x 71, Primary 700, radius 16. */
  addMember:
    'inline-flex h-14 w-full max-w-[18.9375rem] items-center justify-center rounded-2xl bg-[#7127EA] px-8 text-base font-semibold text-white transition-colors hover:bg-[#5f1fd0] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-[#DBD2FF] disabled:text-[#BFAFFF] sm:h-[4.4375rem] sm:text-[1.125rem]',
  /** Cross Icon: 40 x 40, rgba(236, 71, 79, 0.1), radius 9.33, X in Danger 600. */
  close:
    'inline-flex size-10 shrink-0 items-center justify-center rounded-[0.583rem] bg-[#EC474F]/10 text-[#DC3545] transition-colors hover:bg-[#EC474F]/20 focus-visible:ring-2 focus-visible:ring-[#DC3545]/40 focus-visible:outline-none',
  /** The small close of the colour picker: 22 x 22, radius 5.13. */
  closeSmall:
    'inline-flex size-[1.375rem] shrink-0 items-center justify-center rounded-[0.32rem] bg-[#EC474F]/10 text-[#DC3545] transition-colors hover:bg-[#EC474F]/20 focus-visible:ring-2 focus-visible:ring-[#DC3545]/40 focus-visible:outline-none',
  /** Hovering Back Button of the detail pages: 175 x 70, no outline, SemiBold 20 Primary 700. */
  backLink:
    'inline-flex h-12 items-center gap-2.5 rounded-xl px-3 text-[1.125rem] leading-[1.875rem] font-semibold text-[#7127EA] transition-colors hover:bg-[#7127EA]/5 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none sm:h-[4.375rem] sm:px-[3.125rem] sm:text-[1.25rem]',

  // --- popups ----------------------------------------------------------------------------------
  /** Add Product Owner Employee Lists Popup: 685 wide, white, radius 18. */
  popup:
    'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[42.8125rem] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[1.125rem] bg-white font-sans outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  /** The owner / members popups dim the modal by rgba(0, 0, 0, 0.13). */
  popupOverlay: 'fixed inset-0 z-50 bg-black/13',
  /** Template popups (New Template / Rename): 644 wide, #F1F5F9, radius 18, overlay 0.25. */
  smallPopup:
    'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[40.25rem] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[1.125rem] bg-[#F1F5F9] p-5 font-sans outline-none sm:px-[1.5625rem] sm:pt-[1.875rem] sm:pb-[1.875rem] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  smallPopupOverlay: 'fixed inset-0 z-50 bg-black/25',
  /** A dropdown panel under a field: white, radius 18. */
  panel:
    'z-50 flex w-(--radix-popover-trigger-width) max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[1.125rem] bg-white font-sans shadow-[0_8px_24px_rgba(15,23,42,0.08)] outline-none',
  /** Search Bar of the popups and dropdowns: white pill with a soft shadow, 44 tall. */
  search:
    'flex h-11 w-full items-center gap-2.5 rounded-full bg-white px-2.5 shadow-[0_0_12.95px_rgba(0,0,0,0.12)] focus-within:ring-2 focus-within:ring-[#A181FF]',
  searchInput:
    'min-w-0 flex-1 bg-transparent text-base leading-[1.5rem] tracking-[0.0144rem] text-[#454545] outline-none placeholder:text-[#909090] sm:text-[1.0547rem]',
  /** Row menus (the 3-dot menus): white, shadow 0 1 11.8 rgba(0,0,0,.1), radius 18. */
  menu: 'z-50 min-w-[11.5rem] rounded-[1.125rem] bg-white p-3 font-sans shadow-[0_1px_11.8px_rgba(0,0,0,0.1)] outline-none',
  /** Rename / Delete rows: Poppins Regular 18 #262626, hover #F3F0FE radius 12. */
  menuItem:
    'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-base leading-[1.6875rem] text-[#262626] outline-none select-none focus:bg-[#F3F0FE] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 sm:text-[1.125rem]',

  // --- choices ----------------------------------------------------------------------------------
  /** Thin scrollbars like the design's (7px track rgba(41,55,73,.07), thumb #E4E4E4). */
  scrollbar:
    '[scrollbar-color:#E4E4E4_rgba(41,55,73,0.07)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[7px] [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-[#E4E4E4] [&::-webkit-scrollbar-track]:rounded-lg [&::-webkit-scrollbar-track]:bg-[rgba(41,55,73,0.07)]',
  /** The statuses and organizer columns use a darker thumb (#B4BBC1). */
  scrollbarDark:
    '[scrollbar-color:#B4BBC1_rgba(41,55,73,0.07)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[7px] [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-[#B4BBC1] [&::-webkit-scrollbar-track]:rounded-lg [&::-webkit-scrollbar-track]:bg-[rgba(41,55,73,0.07)]',
  /** Purple option titles: Poppins SemiBold 20, Primary Colors. */
  optionTitle:
    'text-[1.125rem] leading-[1.875rem] font-semibold tracking-[0.0168rem] text-[#7127EA] sm:text-[1.25rem]',
  /** Option descriptions: Poppins Regular 18 / 27 #3D3D3D. */
  optionText:
    'text-[0.9375rem] leading-[1.5rem] tracking-[0.0168rem] text-[#3D3D3D] sm:text-[1.125rem] sm:leading-[1.6875rem]',
  /** Card titles: Poppins SemiBold 22 / 33, Primary Colors. */
  cardTitle:
    'text-[1.125rem] leading-[1.75rem] font-semibold tracking-[0.0168rem] text-[#7127EA] sm:text-[1.375rem] sm:leading-[2.0625rem]',
  /** Card and summary text: Poppins Regular 18 / 27 #454545. */
  cardText:
    'text-[0.9375rem] leading-[1.5rem] tracking-[0.0168rem] text-[#454545] sm:text-[1.125rem] sm:leading-[1.6875rem]',
  /** Detail page rows: white, radius 18, 72 tall. */
  row: 'flex min-h-[4.5rem] items-center gap-3 rounded-[1.125rem] bg-white pr-4 pl-3.5',
  /** Row icon tiles: 46 x 46, #F4F4F4, radius 8, icon #5D5D5D. */
  rowTile:
    'flex size-[2.875rem] shrink-0 items-center justify-center rounded-lg bg-[#F4F4F4] text-[#5D5D5D]',
  /** Row names: Poppins SemiBold 20, Primary Colors. */
  rowName:
    'min-w-0 flex-1 truncate text-[1.0625rem] leading-[1.875rem] font-semibold tracking-[0.0168rem] text-[#7127EA] sm:text-[1.25rem]',
  /** Status names: Poppins Medium 20 #5D5D5D. */
  statusName:
    'min-w-0 flex-1 truncate text-[1.0625rem] leading-[1.875rem] font-medium tracking-[0.0168rem] text-[#5D5D5D] sm:text-[1.25rem]',
  /** The purple 3-dot buttons: 35 x 30, radius 8. */
  dotsButton:
    'inline-flex h-[1.875rem] w-[2.1875rem] shrink-0 items-center justify-center rounded-lg text-[#7127EA] transition-colors hover:bg-[#7127EA]/10 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none data-[state=open]:bg-[#7127EA]/10',
} as const
