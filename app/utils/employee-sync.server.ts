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

export interface SyncResult {
	success: boolean
	created: number
	updated: number
	errors: number
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
				await syncSingleEmployee(factsEmployee, result)
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
		return result
	}
}

/**
 * Sync a single employee from FACTS data
 */
async function syncSingleEmployee(
	factsEmployee: FactsEmployeeData,
	result: SyncResult,
): Promise<void> {
	// Check if employee already exists by sisEmployeeId
	const existingEmployee = await prisma.employee.findUnique({
		where: { sisEmployeeId: factsEmployee.sisEmployeeId },
	})

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
		result.updated++
	} else {
		// Create new employee
		await prisma.employee.create({
			data: {
				sisEmployeeId: factsEmployee.sisEmployeeId,
				fullName: factsEmployee.fullName,
				jobTitle: factsEmployee.jobTitle,
				email: factsEmployee.email,
				status: factsEmployee.status,
			},
		})
		result.created++
	}
}
