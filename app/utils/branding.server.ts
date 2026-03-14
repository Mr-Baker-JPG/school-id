/**
 * School branding configuration
 * Used for PDF ID generation and verification pages
 *
 * This is now a thin wrapper around SchoolConfig for backward compatibility.
 */

import { getSchoolConfig, type SchoolConfig } from './school-config.server.ts'

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
	 * URL to school crest image
	 */
	crestUrl?: string
	/**
	 * Primary brand color (hex format, e.g., "#1a1a1a")
	 */
	primaryColor: string
	/**
	 * Secondary brand color (hex format, e.g., "#ffffff")
	 */
	secondaryColor: string
	/**
	 * Accent/background color (hex format)
	 */
	accentColor: string
	/**
	 * School address line 1
	 */
	addressLine1: string
	/**
	 * School address line 2
	 */
	addressLine2: string
	/**
	 * School phone number
	 */
	phone: string
	/**
	 * School website URL
	 */
	schoolWebsite: string
}

/**
 * Gets the school branding configuration from the database
 * with environment variable and sensible defaults as fallbacks.
 */
export async function getBrandingConfig(): Promise<BrandingConfig> {
	const config = await getSchoolConfig()
	return brandingFromSchoolConfig(config)
}

/**
 * Convert a SchoolConfig to a BrandingConfig (sync helper for when you already have config)
 */
export function brandingFromSchoolConfig(config: SchoolConfig): BrandingConfig {
	return {
		schoolName: config.schoolName,
		logoUrl: config.logoUrl,
		crestUrl: config.crestUrl,
		primaryColor: config.primaryColor,
		secondaryColor: config.secondaryColor,
		accentColor: config.accentColor,
		addressLine1: config.addressLine1,
		addressLine2: config.addressLine2,
		phone: config.phone,
		schoolWebsite: config.schoolWebsite,
	}
}
