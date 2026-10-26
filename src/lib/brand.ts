/**
 * Product brand. hRango is the product (its logos are in /public); Top Edge Technologies made it and
 * appears only as "Powered by / Created by". The sidebar shows the brand of the organisation using
 * hRango (the signed-in user's company, from `GET /auth/me`), not these logos.
 */
import { env } from './env'

export const PRODUCT_NAME = 'hRango'

export const MAKER_NAME = 'Top Edge Technologies'

const asset = (file: string) => `${env.BASE_URL}${file}`

/** Logos from /public: full = mark + wordmark, icon = the mark alone; white for dark surfaces. */
export const PRODUCT_LOGO = {
  fullColor: asset('logo-full-color.png'),
  fullWhite: asset('logo-full-white.png'),
  iconColor: asset('logo-icon-color.png'),
  iconWhite: asset('logo-icon-white.png'),
} as const
