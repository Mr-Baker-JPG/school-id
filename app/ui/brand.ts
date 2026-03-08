/**
 * Brand configuration for JPG ID System
 */

export const APP_NAME = 'JPG ID System'
export const SCHOOL_NAME = 'John Paul the Great Academy'
export const LOGO_SRC = '/img/jpg-logo.png'
export const HEADER_LOGO_SRC = '/img/jpg-logo.svg'

export const brand = {
	appName: APP_NAME,
	schoolName: SCHOOL_NAME,
	logoSrc: LOGO_SRC,
	headerLogoSrc: HEADER_LOGO_SRC,
} as const

/**
 * Helper classnames for brand styling
 */
export const headerAccent = 'border-b-4 border-primary'
export const pageBg = 'bg-background'
export const subtleBand = 'bg-muted/40'
