/**
 * Person type utilities for employee classification
 */

import type { PersonType } from '#app/components/employee-id-card.tsx'

/**
 * Determines if an employee should be classified as FACULTY or STAFF
 * based on their job title.
 *
 * Business rules:
 * - Job title contains "Faculty" → FACULTY
 * - Job title contains "Staff" but not "Faculty" → STAFF
 * - Everything else → STAFF (default)
 * - If both "Faculty" and "Staff" appear → FACULTY (faculty takes precedence)
 *
 * @param jobTitle - The employee's job title (from FACTS department field)
 * @returns 'FACULTY' or 'STAFF'
 */
export function getEmployeePersonType(jobTitle: string | undefined | null): 'FACULTY' | 'STAFF' {
	// Handle null/undefined/empty
	if (!jobTitle) {
		return 'STAFF'
	}

	const title = jobTitle.toLowerCase()

	// Check for faculty first (takes precedence)
	if (title.includes('faculty')) {
		return 'FACULTY'
	}

	// Check for staff
	if (title.includes('staff')) {
		return 'STAFF'
	}

	// Default to staff for all other job titles
	return 'STAFF'
}

/**
 * Type guard to check if a PersonType is valid for an employee
 */
export function isEmployeePersonType(type: PersonType): type is 'FACULTY' | 'STAFF' {
	return type === 'FACULTY' || type === 'STAFF'
}
