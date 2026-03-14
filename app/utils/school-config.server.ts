/**
 * School Configuration Service
 *
 * Reads school configuration from the SystemSetting table with
 * environment variable fallbacks. This is the single source of truth
 * for all school-specific configuration.
 */

import { prisma } from './db.server.ts'

export interface SchoolConfig {
	/** Full school name, e.g. "John Paul the Great Academy" */
	schoolName: string
	/** Short name for headers/badges, e.g. "JPG" */
	schoolShortName: string
	/** Address line 1 */
	addressLine1: string
	/** Address line 2 (city, state, zip) */
	addressLine2: string
	/** Phone number */
	phone: string
	/** Email domain for OAuth restriction, e.g. "jpgacademy.org" */
	emailDomain: string
	/** URL to school logo image */
	logoUrl: string
	/** URL to school crest image */
	crestUrl: string
	/** Primary brand color (hex), e.g. "#1B2A4A" */
	primaryColor: string
	/** Secondary brand color (hex), e.g. "#8B1A2B" */
	secondaryColor: string
	/** Accent/background color (hex), e.g. "#F5F0E8" */
	accentColor: string
	/** School website URL */
	schoolWebsite: string
	/** Whether Google Workspace integration is enabled */
	googleEnabled: boolean
}

/** Default config used when nothing is configured yet */
const DEFAULTS: SchoolConfig = {
	schoolName: 'Your School',
	schoolShortName: 'School',
	addressLine1: '',
	addressLine2: '',
	phone: '',
	emailDomain: '',
	logoUrl: '/img/placeholder-logo.png',
	crestUrl: '/img/placeholder-crest.png',
	primaryColor: '#1B2A4A',
	secondaryColor: '#8B1A2B',
	accentColor: '#F5F0E8',
	schoolWebsite: '',
	googleEnabled: false,
}

/**
 * SystemSetting key → SchoolConfig field mapping
 */
const SETTING_KEYS: Record<string, keyof SchoolConfig> = {
	school_name: 'schoolName',
	school_short_name: 'schoolShortName',
	school_address_line1: 'addressLine1',
	school_address_line2: 'addressLine2',
	school_phone: 'phone',
	school_email_domain: 'emailDomain',
	school_logo_url: 'logoUrl',
	school_crest_url: 'crestUrl',
	school_primary_color: 'primaryColor',
	school_secondary_color: 'secondaryColor',
	school_accent_color: 'accentColor',
	school_website: 'schoolWebsite',
	google_enabled: 'googleEnabled',
}

/**
 * Environment variable → SchoolConfig field mapping (fallbacks)
 */
const ENV_KEYS: Partial<Record<keyof SchoolConfig, string>> = {
	schoolName: 'SCHOOL_NAME',
	emailDomain: 'SCHOOL_EMAIL_DOMAIN',
	logoUrl: 'SCHOOL_LOGO_URL',
	primaryColor: 'SCHOOL_PRIMARY_COLOR',
	secondaryColor: 'SCHOOL_SECONDARY_COLOR',
}

// Simple in-memory cache to avoid hitting DB on every request
let cachedConfig: SchoolConfig | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 30_000 // 30 seconds

/**
 * Get the school configuration.
 * Reads from SystemSetting table, falls back to env vars, then defaults.
 */
export async function getSchoolConfig(): Promise<SchoolConfig> {
	const now = Date.now()
	if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedConfig
	}

	const config = { ...DEFAULTS }

	// Read all school settings from DB in one query
	try {
		const settings = await prisma.systemSetting.findMany({
			where: {
				key: { in: Object.keys(SETTING_KEYS) },
			},
		})

		for (const setting of settings) {
			const field = SETTING_KEYS[setting.key]
			if (field && setting.value) {
				if (field === 'googleEnabled') {
					;(config as any)[field] = setting.value === 'true'
				} else {
					;(config as any)[field] = setting.value
				}
			}
		}
	} catch {
		// DB might not be ready yet (e.g., during initial setup)
		// Fall through to env var defaults
	}

	// Apply env var fallbacks for any fields still at default
	for (const [field, envKey] of Object.entries(ENV_KEYS)) {
		const key = field as keyof SchoolConfig
		const envValue = process.env[envKey as string]
		if (envValue && config[key] === DEFAULTS[key]) {
			;(config as any)[key] = envValue
		}
	}

	// Also check legacy env vars
	if (config.schoolName === DEFAULTS.schoolName) {
		const legacy =
			process.env.SCHOOL_BRAND_NAME || process.env.SCHOOL_NAME
		if (legacy) config.schoolName = legacy
	}

	cachedConfig = config
	cacheTimestamp = now
	return config
}

/**
 * Invalidate the cached config (call after saving settings)
 */
export function invalidateSchoolConfigCache() {
	cachedConfig = null
	cacheTimestamp = 0
}

/**
 * Save a school config field to the SystemSetting table
 */
export async function setSchoolConfigValue(
	key: string,
	value: string,
): Promise<void> {
	await prisma.systemSetting.upsert({
		where: { key },
		update: { value },
		create: { key, value },
	})
	invalidateSchoolConfigCache()
}

/**
 * Save multiple school config fields at once
 */
export async function setSchoolConfigValues(
	values: Record<string, string>,
): Promise<void> {
	await prisma.$transaction(
		Object.entries(values).map(([key, value]) =>
			prisma.systemSetting.upsert({
				where: { key },
				update: { value },
				create: { key, value },
			}),
		),
	)
	invalidateSchoolConfigCache()
}

/**
 * Check if initial setup wizard has been completed
 */
export async function isSetupComplete(): Promise<boolean> {
	try {
		const setting = await prisma.systemSetting.findUnique({
			where: { key: 'setup_complete' },
		})
		return setting?.value === 'true'
	} catch {
		return false
	}
}
