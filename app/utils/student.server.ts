/**
 * Student Server Utilities
 *
 * Shared utilities for student-related operations.
 */

import { prisma } from './db.server.ts'

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
