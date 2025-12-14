/**
 * School branding configuration
 * Used for PDF ID generation and verification pages
 */

import { SCHOOL_NAME, LOGO_SRC } from '#app/ui/brand.ts'

export interface BrandingConfig {
	/**
	 * School name to display on IDs
	 */
	schoolName: string
	/**
	 * URL to school logo image (must be accessible)
	 */
	logoUrl?: string
	/**
	 * Primary brand color (hex format, e.g., "#1a1a1a")
	 */
	primaryColor: string
	/**
	 * Secondary brand color (hex format, e.g., "#ffffff")
	 */
	secondaryColor: string
}

/**
 * Gets the school branding configuration from environment variables
 * Falls back to brand.ts configuration, then to sensible defaults if not configured
 */
export function getBrandingConfig(): BrandingConfig {
	return {
		schoolName:
			process.env.SCHOOL_NAME ||
			process.env.SCHOOL_BRAND_NAME ||
			SCHOOL_NAME ||
			'School',
		logoUrl: process.env.SCHOOL_LOGO_URL || LOGO_SRC,
		primaryColor: process.env.SCHOOL_PRIMARY_COLOR || '#1a1a1a',
		secondaryColor: process.env.SCHOOL_SECONDARY_COLOR || '#ffffff',
	}
}
