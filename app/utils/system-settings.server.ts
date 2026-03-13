import { prisma } from './db.server.ts'

export const ACTIVE_CARD_DESIGN_KEY = 'activeCardDesign'

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
 * Get the active card design ID (defaults to 3 — "Light Executive")
 */
export async function getActiveCardDesignId(): Promise<number> {
	const value = await getSetting(ACTIVE_CARD_DESIGN_KEY)
	const parsed = value ? parseInt(value, 10) : NaN
	return isNaN(parsed) ? 3 : parsed
}

/**
 * Set the active card design ID
 */
export async function setActiveCardDesignId(designId: number): Promise<void> {
	await setSetting(ACTIVE_CARD_DESIGN_KEY, String(designId))
}
