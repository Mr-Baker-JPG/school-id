/**
 * Person type utilities for employee classification
 */

import type { PersonType } from '#app/components/employee-id-card.tsx'

/**
 * Determines if an employee should be classified as FACULTY, STAFF, or ADMINISTRATION
 * based on their department.
 *
 * Business rules:
 * - Department is "Upper School", "Lower School", or "Preschool" → FACULTY
 * - Department is "Administrator" → ADMINISTRATION
 * - Department is "Staff" or anything else → STAFF
 * - Everything else → STAFF (default)
 *
 * @param department - The employee's department (derived from FACTS department string + boolean flags)
 * @returns 'FACULTY', 'STAFF', or 'ADMINISTRATION'
 */
export function getEmployeePersonType(department: string | undefined | null): 'FACULTY' | 'STAFF' | 'ADMINISTRATION' {
	// Handle null/undefined/empty
	if (!department) {
		return 'STAFF'
	}

	const dept = department.trim()

	// Teaching departments → FACULTY
	if (dept === 'Upper School' || dept === 'Lower School' || dept === 'Preschool') {
		return 'FACULTY'
	}

	// Administrator → ADMINISTRATION
	if (dept === 'Administration') {
		return 'ADMINISTRATION'
	}

	// Also handle legacy values that contain "faculty"
	if (dept.toLowerCase().includes('faculty')) {
		return 'FACULTY'
	}

	return 'STAFF'
}

/**
 * Type guard to check if a PersonType is valid for an employee
 */
export function isEmployeePersonType(type: PersonType): type is 'FACULTY' | 'STAFF' | 'ADMINISTRATION' {
	return type === 'FACULTY' || type === 'STAFF' || type === 'ADMINISTRATION'
}
