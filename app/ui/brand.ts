/**
 * Brand configuration for School ID System
 *
 * These are compile-time defaults used in the client-side UI.
 * For server-side configuration that reads from the database,
 * use school-config.server.ts instead.
 *
 * These values are overridden at runtime by SchoolConfig from the DB.
 */

export const APP_NAME = 'School ID System'
export const SCHOOL_NAME = 'Your School'
export const LOGO_SRC = '/img/placeholder-logo.png'
export const HEADER_LOGO_SRC = '/img/placeholder-logo.svg'
export const CREST_SRC = '/img/placeholder-crest.png'

export const brand = {
	appName: APP_NAME,
	schoolName: SCHOOL_NAME,
	logoSrc: LOGO_SRC,
	headerLogoSrc: HEADER_LOGO_SRC,
} as const

/**
 * Helper classnames for brand styling
 */
export const headerAccent = 'border-b-2 border-brand-gold/60'
export const pageBg = 'bg-background'
export const subtleBand = 'bg-muted/40'
