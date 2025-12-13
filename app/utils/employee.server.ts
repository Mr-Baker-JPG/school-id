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
 * Fetches and caches a profile picture from FACTS API for an employee.
 * If the employee already has an uploaded photo, this function does nothing.
 * If the FACTS API call fails, returns null without throwing.
 *
 * @param employeeId - The local employee ID (database ID)
 * @param sisEmployeeId - The SIS employee ID (used as personId in FACTS API)
 * @returns The objectKey (photoUrl) if successfully cached, null otherwise
 */
export async function fetchAndCacheFactsProfilePicture(
	employeeId: string,
	sisEmployeeId: string,
): Promise<string | null> {
	// Check if employee already has an uploaded photo
	const employeeIdRecord = await prisma.employeeID.findUnique({
		where: { employeeId },
		select: { photoUrl: true },
	})

	// If employee already has a photo, don't fetch from FACTS
	// Uploaded photos always take precedence
	if (employeeIdRecord?.photoUrl) {
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
	// Convert Buffer to File for uploadEmployeePhoto
	try {
		// Create a File from the buffer
		// File constructor is available in Node.js 18+
		const file = new File(
			[profilePictureBuffer],
			`facts-profile-${personId}.jpg`,
			{
				type: 'image/jpeg',
			},
		)

		const objectKey = await uploadEmployeePhoto(employeeId, file)

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
