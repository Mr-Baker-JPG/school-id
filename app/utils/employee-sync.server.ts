/**
 * Employee Sync Service
 *
 * Syncs employee data from FACTS SIS to local database.
 * Handles creating new employees and updating existing ones.
 */

import { prisma } from './db.server.ts'
import {
	fetchAllStaff,
	FactsApiError,
	type FactsEmployeeData,
} from './facts-api.server.ts'
import {
	getNextJuly1ExpirationDate,
	fetchAndCacheFactsProfilePicture,
} from './employee.server.ts'

export interface SyncResult {
	success: boolean
	created: number
	updated: number
	errors: number
	photosUpdated: number
	photosErrors: number
	errorMessage?: string
}

/**
 * Sync all employees from FACTS SIS to local database
 */
export async function syncEmployeesFromFacts(): Promise<SyncResult> {
	const result: SyncResult = {
		success: false,
		created: 0,
		updated: 0,
		errors: 0,
		photosUpdated: 0,
		photosErrors: 0,
	}

	try {
		// Fetch all staff from FACTS API
		const factsEmployees = await fetchAllStaff({
			includes: 'demographics',
			filters: 'active==true',
			// sorts: 'lastName asc',
			bypassCache: true,
		})

		// Process each employee
		for (const factsEmployee of factsEmployees) {
			try {
				const employeeId = await syncSingleEmployee(factsEmployee, result)

				// If employee is active, try to fetch and cache their photo from FACTS
				// Only fetch if no photo exists (manually uploaded photos take precedence)
				if (factsEmployee.status === 'active' && employeeId) {
					try {
						// Check if employee already has a photo before attempting to fetch from FACTS
						// This ensures manually uploaded photos are never overwritten
						const employeeIdRecord = await prisma.employeeID.findUnique({
							where: { employeeId },
							select: { photoUrl: true },
						})

						// Only fetch from FACTS if no photo exists
						// Manually uploaded photos always take precedence
						if (!employeeIdRecord?.photoUrl) {
							const photoUrl = await fetchAndCacheFactsProfilePicture(
								employeeId,
								factsEmployee.sisEmployeeId,
								false, // Don't force - only fetch if no photo exists
							)
							if (photoUrl) {
								result.photosUpdated++
							}
						}
					} catch (photoError) {
						result.photosErrors++
						console.warn(
							`Failed to sync photo for employee ${factsEmployee.sisEmployeeId}:`,
							photoError,
						)
						// Don't fail the entire sync if photo fetch fails
					}
				}
			} catch (error) {
				result.errors++
				console.error(
					`Error syncing employee ${factsEmployee.sisEmployeeId}:`,
					error,
				)
				// Continue processing other employees even if one fails
			}
		}

		result.success = true
		// Log sync history
		await logSyncHistory(result)
		return result
	} catch (error) {
		result.success = false
		if (error instanceof FactsApiError) {
			result.errorMessage = `FACTS API error: ${error.message}`
		} else if (error instanceof Error) {
			result.errorMessage = `Sync error: ${error.message}`
		} else {
			result.errorMessage = 'Unknown error during sync'
		}
		console.error('Employee sync failed:', error)
		// Log sync history even on failure
		await logSyncHistory(result).catch((logError) => {
			console.error('Failed to log sync history:', logError)
		})
		return result
	}
}

/**
 * Log sync history to database
 */
async function logSyncHistory(result: SyncResult): Promise<void> {
	await prisma.syncHistory.create({
		data: {
			success: result.success,
			created: result.created,
			updated: result.updated,
			errors: result.errors,
			errorMessage: result.errorMessage || null,
		},
	})
}

/**
 * Sync a single employee from FACTS data
 * @returns The employee ID if successful, null otherwise
 */
async function syncSingleEmployee(
	factsEmployee: FactsEmployeeData,
	result: SyncResult,
): Promise<string | null> {
	// Check if employee already exists by sisEmployeeId
	const existingEmployee = await prisma.employee.findUnique({
		where: { sisEmployeeId: factsEmployee.sisEmployeeId },
		select: { id: true },
	})

	let employeeId: string

	if (existingEmployee) {
		// Update existing employee
		await prisma.employee.update({
			where: { sisEmployeeId: factsEmployee.sisEmployeeId },
			data: {
				fullName: factsEmployee.fullName,
				jobTitle: factsEmployee.jobTitle,
				email: factsEmployee.email,
				status: factsEmployee.status,
			},
		})
		employeeId = existingEmployee.id
		result.updated++
	} else {
		// Create new employee
		const newEmployee = await prisma.employee.create({
			data: {
				sisEmployeeId: factsEmployee.sisEmployeeId,
				fullName: factsEmployee.fullName,
				jobTitle: factsEmployee.jobTitle,
				email: factsEmployee.email,
				status: factsEmployee.status,
			},
			select: { id: true },
		})
		employeeId = newEmployee.id
		result.created++
	}

	// If employee is active, ensure EmployeeID record exists with expiration date set to next July 1
	if (factsEmployee.status === 'active') {
		await prisma.employeeID.upsert({
			where: { employeeId },
			create: {
				employeeId,
				expirationDate: getNextJuly1ExpirationDate(),
			},
			update: {
				expirationDate: getNextJuly1ExpirationDate(),
			},
		})
	}

	return employeeId
}
