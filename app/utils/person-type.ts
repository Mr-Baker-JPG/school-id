/**
 * Person type utilities for employee classification
 */

import type { PersonType } from '#app/components/employee-id-card.tsx'

/**
 * Determines if an employee should be classified as FACULTY or STAFF
 * based on their department.
 *
 * Business rules:
 * - Department is "Upper School", "Lower School", or "Preschool" → FACULTY
 * - Department is "Administrator" or "Staff" → STAFF
 * - Everything else → STAFF (default)
 *
 * @param department - The employee's department (derived from FACTS department string + boolean flags)
 * @returns 'FACULTY' or 'STAFF'
 */
export function getEmployeePersonType(department: string | undefined | null): 'FACULTY' | 'STAFF' {
	// Handle null/undefined/empty
	if (!department) {
		return 'STAFF'
	}

	const dept = department.trim()

	// Teaching departments → FACULTY
	if (dept === 'Upper School' || dept === 'Lower School' || dept === 'Preschool') {
		return 'FACULTY'
	}

	// Administrator and Staff → STAFF
	// Also handle legacy values that contain "faculty"
	if (dept.toLowerCase().includes('faculty')) {
		return 'FACULTY'
	}

	return 'STAFF'
}

/**
 * Type guard to check if a PersonType is valid for an employee
 */
export function isEmployeePersonType(type: PersonType): type is 'FACULTY' | 'STAFF' {
	return type === 'FACULTY' || type === 'STAFF'
}
