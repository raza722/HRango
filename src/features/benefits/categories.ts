// Kept apart from constants.ts so the route search schema (in the main chunk) does not pull in
// the categories' labels and options.

/** The Add New Plan menu's categories, in its order. */
export const CATEGORY_VALUES = [
  'medical',
  'dental',
  'vision',
  'retirement',
  'hsa',
  'life',
  'others',
] as const
