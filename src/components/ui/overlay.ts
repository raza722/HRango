/**
 * The layer behind a popup form or confirmation: the brand navy at 30% with a light 3px blur, so
 * the form stands out while the page behind stays recognisable (a heavier blur reads as fog). Dark
 * mode tints darker. A popup opened over another one (a "Delete?" over an edit form) gets no
 * second blur and only a faint tint (`.popup-overlay ~ .popup-overlay` in globals.css), so the
 * screen never turns muddy. One place for every popup: the shared Dialog and AlertDialog, and the
 * Benefits and Manpower Planning popups.
 */
export const popupOverlayClass =
  'popup-overlay fixed inset-0 z-50 bg-sidebar/30 backdrop-blur-[3px] dark:bg-black/55 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'

/**
 * Behind a side panel (Sheet): a light tint and no blur, since a panel is read beside the page.
 */
export const panelOverlayClass =
  'fixed inset-0 z-50 bg-sidebar/25 dark:bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'
