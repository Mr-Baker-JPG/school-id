/**
 * Student Sync Service
 *
 * Syncs student data from FACTS SIS to local database.
 * Handles creating new students and updating existing ones.
 * Preserves admin-edited names during sync.
 */

import { prisma } from './db.server.ts'
import {
	fetchAllStudents,
	FactsApiError,
	type FactsStudentData,
} from './facts-api.server.ts'
import { getNextJuly1ExpirationDate } from './employee.server.ts'

export interface StudentSyncResult {
	success: boolean
	created: number
	updated: number
	errors: number
	errorMessage?: string
}

/**
 * Sync all students from FACTS SIS to local database
 */
export async function syncStudentsFromFacts(): Promise<StudentSyncResult> {
	const result: StudentSyncResult = {
		success: false,
		created: 0,
		updated: 0,
		errors: 0,
	}

	try {
		// Fetch all students from FACTS API
		const factsStudents = await fetchAllStudents({
			includes: 'demographics',
			filters: 'active==true',
			bypassCache: true,
		})

		// Process each student
		for (const factsStudent of factsStudents) {
			try {
				await syncSingleStudent(factsStudent, result)
			} catch (error) {
				result.errors++
				console.error(
					`Error syncing student ${factsStudent.sisStudentId}:`,
					error,
				)
				// Continue processing other students even if one fails
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
		console.error('Student sync failed:', error)
		return result
	}
}

/**
 * Sync a single student from FACTS data
 * Preserves admin-edited names during sync
 */
async function syncSingleStudent(
	factsStudent: FactsStudentData,
	result: StudentSyncResult,
): Promise<void> {
	// Check if student already exists by sisStudentId
	const existingStudent = await prisma.student.findUnique({
		where: { sisStudentId: factsStudent.sisStudentId },
		select: { id: true, isNameEdited: true },
	})

	let studentId: string

	if (existingStudent) {
		// Update existing student
		// If name was edited by admin (isNameEdited=true), preserve the edited name
		const updateData: {
			email: string
			status: string
			fullName?: string
		} = {
			email: factsStudent.email,
			status: factsStudent.status,
		}

		// Only update fullName if it hasn't been edited by admin
		if (!existingStudent.isNameEdited) {
			updateData.fullName = factsStudent.fullName
		}

		await prisma.student.update({
			where: { sisStudentId: factsStudent.sisStudentId },
			data: updateData,
		})
		studentId = existingStudent.id
		result.updated++
	} else {
		// Create new student
		const newStudent = await prisma.student.create({
			data: {
				sisStudentId: factsStudent.sisStudentId,
				fullName: factsStudent.fullName,
				email: factsStudent.email,
				status: factsStudent.status,
				isNameEdited: false, // New students start with isNameEdited=false
			},
			select: { id: true },
		})
		studentId = newStudent.id
		result.created++
	}

	// If student is active, ensure StudentID record exists with expiration date set to next July 1
	if (factsStudent.status === 'active') {
		await prisma.studentID.upsert({
			where: { studentId },
			create: {
				studentId,
				expirationDate: getNextJuly1ExpirationDate(),
			},
			update: {
				expirationDate: getNextJuly1ExpirationDate(),
			},
		})
	}
}
