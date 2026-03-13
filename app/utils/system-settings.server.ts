import { prisma } from './db.server.ts'

/**
 * System settings keys - defines all available system-wide settings
 */
export const SYSTEM_SETTING_KEYS = {
	ACTIVE_CARD_DESIGN: 'activeCardDesign',
	SCHOOL_NAME: 'schoolName',
	SCHOOL_PHONE: 'schoolPhone',
	SCHOOL_ADDRESS: 'schoolAddress',
	SCHOOL_WEBSITE: 'schoolWebsite',
	SCHOOL_LOGO_URL: 'schoolLogoUrl',
} as const

export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[keyof typeof SYSTEM_SETTING_KEYS]

/**
 * Default values for system settings
 */
export const DEFAULT_SYSTEM_SETTINGS: Record<SystemSettingKey, string> = {
	[SYSTEM_SETTING_KEYS.ACTIVE_CARD_DESIGN]: '3',
	[SYSTEM_SETTING_KEYS.SCHOOL_NAME]: 'School Name',
	[SYSTEM_SETTING_KEYS.SCHOOL_PHONE]: '',
	[SYSTEM_SETTING_KEYS.SCHOOL_ADDRESS]: '',
	[SYSTEM_SETTING_KEYS.SCHOOL_WEBSITE]: '',
	[SYSTEM_SETTING_KEYS.SCHOOL_LOGO_URL]: '',
}

/**
 * Get a system setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
	const setting = await prisma.systemSetting.findUnique({ where: { key } })
	return setting?.value ?? null
}

/**
 * Set a system setting (upsert)
 */
export async function setSetting(key: string, value: string): Promise<void> {
	await prisma.systemSetting.upsert({
		where: { key },
		update: { value },
		create: { key, value },
	})
}

/**
 * Get a single system setting value with default
 */
export async function getSystemSetting(key: SystemSettingKey): Promise<string> {
	const setting = await prisma.systemSetting.findUnique({ where: { key } })
	return setting?.value ?? DEFAULT_SYSTEM_SETTINGS[key]
}

/**
 * Get multiple system settings at once
 */
export async function getSystemSettings(
	keys: SystemSettingKey[],
): Promise<Record<SystemSettingKey, string>> {
	const settings = await prisma.systemSetting.findMany({
		where: { key: { in: keys } },
	})

	const result = { ...DEFAULT_SYSTEM_SETTINGS }
	for (const setting of settings) {
		result[setting.key as SystemSettingKey] = setting.value
	}
	return result
}

/**
 * Set multiple system settings at once
 */
export async function setSystemSettings(
	settings: Partial<Record<SystemSettingKey, string>>,
): Promise<void> {
	await prisma.$transaction(
		Object.entries(settings).map(([key, value]) =>
			prisma.systemSetting.upsert({
				where: { key },
				update: { value },
				create: { key, value },
			}),
		),
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Card Design Settings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the active card design ID (defaults to 3 — "Light Executive")
 */
export async function getActiveCardDesignId(): Promise<number> {
	const value = await getSetting(SYSTEM_SETTING_KEYS.ACTIVE_CARD_DESIGN)
	const parsed = value ? parseInt(value, 10) : NaN
	return isNaN(parsed) ? 3 : parsed
}

/**
 * Set the active card design ID
 */
export async function setActiveCardDesignId(designId: number): Promise<void> {
	await setSetting(SYSTEM_SETTING_KEYS.ACTIVE_CARD_DESIGN, String(designId))
}

// ─────────────────────────────────────────────────────────────────────────────
// School Settings for Signatures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all school-related settings for signature templates
 */
export async function getSchoolSettingsForSignatures(): Promise<{
	schoolName: string
	schoolPhone: string
	schoolAddress: string
	schoolWebsite: string
	schoolLogoUrl: string
}> {
	const settings = await getSystemSettings([
		SYSTEM_SETTING_KEYS.SCHOOL_NAME,
		SYSTEM_SETTING_KEYS.SCHOOL_PHONE,
		SYSTEM_SETTING_KEYS.SCHOOL_ADDRESS,
		SYSTEM_SETTING_KEYS.SCHOOL_WEBSITE,
		SYSTEM_SETTING_KEYS.SCHOOL_LOGO_URL,
	])

	return {
		schoolName: settings[SYSTEM_SETTING_KEYS.SCHOOL_NAME],
		schoolPhone: settings[SYSTEM_SETTING_KEYS.SCHOOL_PHONE],
		schoolAddress: settings[SYSTEM_SETTING_KEYS.SCHOOL_ADDRESS],
		schoolWebsite: settings[SYSTEM_SETTING_KEYS.SCHOOL_WEBSITE],
		schoolLogoUrl: settings[SYSTEM_SETTING_KEYS.SCHOOL_LOGO_URL],
	}
}
