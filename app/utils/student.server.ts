/**
 * Student Server Utilities
 *
 * Shared utilities for student-related operations.
 */

import { prisma } from './db.server.ts'
import { fetchProfilePicture } from './facts-api.server.ts'
import { uploadStudentPhoto } from './storage.server.ts'

/**
 * Expiration status for a student ID
 */
export type ExpirationStatus =
	| { type: 'valid'; daysUntilExpiration: number }
	| { type: 'expiring'; daysUntilExpiration: number }
	| { type: 'expired'; daysSinceExpiration: number }

/**
 * Determines the expiration status of a student ID.
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
 * Fetches students with IDs expiring within the specified number of days or already expired.
 * @param warningDays - Number of days before expiration to include (default: 30)
 * @param currentDate - The current date (defaults to now)
 * @returns Array of students with expiring or expired IDs
 */
export async function getExpiringStudents(
	warningDays: number = 30,
	currentDate: Date = new Date(),
) {
	const current = new Date(currentDate)
	current.setHours(0, 0, 0, 0)
	const warningThreshold = new Date(current)
	warningThreshold.setDate(warningThreshold.getDate() + warningDays)
	warningThreshold.setHours(23, 59, 59, 999)

	// First, fetch StudentID records that are expiring or expired
	const expiringStudentIds = await prisma.studentID.findMany({
		where: {
			expirationDate: {
				lte: warningThreshold, // Expiring within warning days or already expired
			},
		},
		select: {
			studentId: true,
			expirationDate: true,
			student: {
				select: {
					id: true,
					fullName: true,
					email: true,
					status: true,
				},
			},
		},
		orderBy: {
			expirationDate: 'asc',
		},
	})

	// Filter to only active students and calculate expiration status
	return expiringStudentIds
		.filter((sid) => sid.student.status === 'active')
		.map((sid) => {
			const expirationStatus = getExpirationStatus(
				sid.expirationDate,
				currentDate,
				warningDays,
			)
			return {
				...sid.student,
				expirationDate: sid.expirationDate,
				expirationStatus,
			}
		})
}

/**
 * Get the next July 1 expiration date from the current date
 */
export function getNextJuly1ExpirationDate(): Date {
	const now = new Date()
	const currentYear = now.getFullYear()
	const currentMonth = now.getMonth() // 0-indexed (0 = January, 6 = July)

	// If we're before July 1, expiration is July 1 of current year
	// If we're on or after July 1, expiration is July 1 of next year
	const expirationYear =
		currentMonth < 6 // Before July (months 0-5)
			? currentYear
			: currentYear + 1

	return new Date(expirationYear, 6, 1) // July 1st (month 6, day 1)
}

/**
 * Fetches and caches a profile picture from FACTS API for a student.
 * If the student already has an uploaded photo, this function does nothing.
 * If the FACTS API call fails, returns null without throwing.
 *
 * Rate limiting: Only fetches if we haven't checked FACTS in the last 7 days.
 *
 * @param studentId - The local student ID (database ID)
 * @param sisStudentId - The SIS student ID (used as personId in FACTS API)
 * @param force - If true, force re-fetch even if checked recently (but only if no uploaded photo)
 * @returns The objectKey (photoUrl) if successfully cached, null otherwise
 */
export async function fetchAndCacheFactsProfilePicture(
	studentId: string,
	sisStudentId: string,
	force: boolean = false,
): Promise<string | null> {
	// Check if student already has an uploaded photo
	const studentIdRecord = await prisma.studentID.findUnique({
		where: { studentId },
		select: { photoUrl: true, factsPhotoCheckedAt: true },
	})

	// If student already has a photo and we're not forcing, don't fetch from FACTS
	// Uploaded photos always take precedence
	if (studentIdRecord?.photoUrl && !force) {
		return null
	}

	// Rate limiting: Only check FACTS if we haven't checked in the last 7 days
	// This prevents hitting API rate limits on every page load
	const DAYS_BEFORE_RECHECK = 7
	if (!force && studentIdRecord?.factsPhotoCheckedAt) {
		const daysSinceLastCheck = Math.floor(
			(Date.now() - studentIdRecord.factsPhotoCheckedAt.getTime()) /
				(1000 * 60 * 60 * 24),
		)
		if (daysSinceLastCheck < DAYS_BEFORE_RECHECK) {
			// Skip FACTS photo check - we checked recently
			return null
		}
	}

	// Parse sisStudentId to number (personId)
	const personId = parseInt(sisStudentId, 10)
	if (isNaN(personId)) {
		console.warn(
			`Invalid sisStudentId for student ${studentId}: ${sisStudentId}`,
		)
		return null
	}

	// Mark that we're checking FACTS now (even before the API call)
	// This prevents multiple concurrent checks
	await prisma.studentID.upsert({
		where: { studentId },
		create: {
			studentId,
			factsPhotoCheckedAt: new Date(),
			expirationDate: getNextJuly1ExpirationDate(),
		},
		update: {
			factsPhotoCheckedAt: new Date(),
		},
	})

	// Fetch profile picture from FACTS API
	const profilePictureBuffer = await fetchProfilePicture(personId)

	// If no profile picture found or error occurred, return null
	// (we've already marked that we checked, so won't retry for 7 days)
	if (!profilePictureBuffer) {
		return null
	}

	// Upload the profile picture to storage
	try {
		const objectKey = await uploadStudentPhoto(
			studentId,
			profilePictureBuffer,
			'image/jpeg',
		)

		// Update StudentID record with the cached photo URL
		await prisma.studentID.update({
			where: { studentId },
			data: {
				photoUrl: objectKey,
			},
		})

		return objectKey
	} catch (error) {
		console.warn(
			`Failed to cache FACTS profile picture for student ${studentId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}
}
