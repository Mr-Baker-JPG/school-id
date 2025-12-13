import { prisma } from './db.server.ts'
import { fetchProfilePicture } from './facts-api.server.ts'
import { uploadEmployeePhoto } from './storage.server.ts'
import { invariantResponse } from '@epic-web/invariant'

/**
 * Returns the default expiration date for employee IDs: July 1 of the current school year.
 * School year typically runs from July 1 to June 30, so IDs expire on July 1.
 */
export function getDefaultExpirationDate(): Date {
	const now = new Date()
	const currentYear = now.getFullYear()
	// July 1 (month is 0-indexed, so 6 = July)
	return new Date(currentYear, 6, 1)
}

/**
 * Returns July 1 of next year as the expiration date.
 * Always returns July 1 of the following year, regardless of the current date.
 */
export function getNextJuly1ExpirationDate(): Date {
	const now = new Date()
	const currentYear = now.getFullYear()
	// Always return July 1 of next year (month is 0-indexed, so 6 = July)
	return new Date(currentYear + 1, 6, 1)
}

/**
 * Expiration status for an employee ID
 */
export type ExpirationStatus =
	| { type: 'valid'; daysUntilExpiration: number }
	| { type: 'expiring'; daysUntilExpiration: number }
	| { type: 'expired'; daysSinceExpiration: number }

/**
 * Determines the expiration status of an employee ID.
 * @param expirationDate - The expiration date of the ID
 * @param currentDate - The current date (defaults to now)
 * @param warningDays - Number of days before expiration to show warning (default: 30)
 * @returns ExpirationStatus indicating if ID is valid, expiring, or expired
 */
export function getExpirationStatus(
	expirationDate: Date,
	currentDate: Date = new Date(),
	warningDays: number = 30,
): ExpirationStatus {
	const expiration = new Date(expirationDate)
	expiration.setHours(0, 0, 0, 0)
	const current = new Date(currentDate)
	current.setHours(0, 0, 0, 0)

	const diffTime = expiration.getTime() - current.getTime()
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

	if (diffDays < 0) {
		// Expired
		return {
			type: 'expired',
			daysSinceExpiration: Math.abs(diffDays),
		}
	} else if (diffDays <= warningDays) {
		// Expiring within warning period
		return {
			type: 'expiring',
			daysUntilExpiration: diffDays,
		}
	} else {
		// Valid (not expiring soon)
		return {
			type: 'valid',
			daysUntilExpiration: diffDays,
		}
	}
}

/**
 * Fetches employees with IDs expiring within the specified number of days or already expired.
 * @param warningDays - Number of days before expiration to include (default: 30)
 * @param currentDate - The current date (defaults to now)
 * @returns Array of employees with expiring or expired IDs
 */
export async function getExpiringEmployees(
	warningDays: number = 30,
	currentDate: Date = new Date(),
) {
	const current = new Date(currentDate)
	current.setHours(0, 0, 0, 0)
	const warningThreshold = new Date(current)
	warningThreshold.setDate(warningThreshold.getDate() + warningDays)
	warningThreshold.setHours(23, 59, 59, 999)

	// First, fetch EmployeeID records that are expiring or expired
	const expiringEmployeeIds = await prisma.employeeID.findMany({
		where: {
			expirationDate: {
				lte: warningThreshold, // Expiring within warning days or already expired
			},
		},
		select: {
			employeeId: true,
			expirationDate: true,
			employee: {
				select: {
					id: true,
					fullName: true,
					email: true,
					jobTitle: true,
					status: true,
				},
			},
		},
		orderBy: {
			expirationDate: 'asc',
		},
	})

	// Filter to only active employees and calculate expiration status
	return expiringEmployeeIds
		.filter((eid) => eid.employee.status === 'active')
		.map((eid) => {
			const expirationStatus = getExpirationStatus(
				eid.expirationDate,
				currentDate,
				warningDays,
			)

			return {
				id: eid.employee.id,
				fullName: eid.employee.fullName,
				email: eid.employee.email,
				jobTitle: eid.employee.jobTitle,
				employeeId: {
					expirationDate: eid.expirationDate,
				},
				expirationStatus,
			}
		})
}

/**
 * Fetches and caches a profile picture from FACTS API for an employee.
 * If the employee already has an uploaded photo, this function does nothing.
 * If the FACTS API call fails, returns null without throwing.
 *
 * @param employeeId - The local employee ID (database ID)
 * @param sisEmployeeId - The SIS employee ID (used as personId in FACTS API)
 * @param force - If true, force re-fetch even if photo exists (but only if no uploaded photo)
 * @returns The objectKey (photoUrl) if successfully cached, null otherwise
 */
export async function fetchAndCacheFactsProfilePicture(
	employeeId: string,
	sisEmployeeId: string,
	force: boolean = false,
): Promise<string | null> {
	// Check if employee already has an uploaded photo
	const employeeIdRecord = await prisma.employeeID.findUnique({
		where: { employeeId },
		select: { photoUrl: true },
	})

	// If employee already has a photo and we're not forcing, don't fetch from FACTS
	// Uploaded photos always take precedence
	if (employeeIdRecord?.photoUrl && !force) {
		return null
	}

	// Parse sisEmployeeId to number (personId)
	const personId = parseInt(sisEmployeeId, 10)
	if (isNaN(personId)) {
		console.warn(
			`Invalid sisEmployeeId for employee ${employeeId}: ${sisEmployeeId}`,
		)
		return null
	}

	// Fetch profile picture from FACTS API
	const profilePictureBuffer = await fetchProfilePicture(personId)

	// If no profile picture found or error occurred, return null
	if (!profilePictureBuffer) {
		return null
	}

	// Upload the profile picture to storage
	// Pass Buffer directly - uploadEmployeePhoto supports Buffer and handles it correctly
	try {
		const objectKey = await uploadEmployeePhoto(
			employeeId,
			profilePictureBuffer,
			'image/jpeg',
		)

		// Update EmployeeID record with the cached photo URL
		await prisma.employeeID.upsert({
			where: { employeeId },
			create: {
				employeeId,
				photoUrl: objectKey,
				expirationDate: getDefaultExpirationDate(),
			},
			update: {
				photoUrl: objectKey,
			},
		})

		return objectKey
	} catch (error) {
		console.warn(
			`Failed to cache FACTS profile picture for employee ${employeeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}
}
