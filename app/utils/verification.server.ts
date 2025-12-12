/**
 * Verification status logic for employee IDs
 * Determines if an ID is valid based on employee status and expiration date
 */

export interface VerificationStatus {
	/**
	 * Whether the ID is valid
	 */
	isValid: boolean
	/**
	 * Reason for validity status
	 */
	reason: string
}

/**
 * Determines if an employee ID is valid.
 * An ID is valid if:
 * - Employee status is 'active' AND
 * - Current date <= expiration date
 *
 * @param status - Employee status ('active' or 'inactive')
 * @param expirationDate - Expiration date of the ID
 * @param currentDate - Current date (defaults to new Date())
 * @returns Verification status with validity and reason
 */
export function getVerificationStatus(
	status: string,
	expirationDate: Date | null,
	currentDate: Date = new Date(),
): VerificationStatus {
	// If employee is inactive, ID is invalid
	if (status !== 'active') {
		return {
			isValid: false,
			reason: 'Employee is not active',
		}
	}

	// If no expiration date, consider invalid (shouldn't happen, but safety check)
	if (!expirationDate) {
		return {
			isValid: false,
			reason: 'Expiration date not set',
		}
	}

	// If expiration date is in the past, ID is invalid
	if (currentDate > expirationDate) {
		return {
			isValid: false,
			reason: 'ID has expired',
		}
	}

	// ID is valid
	return {
		isValid: true,
		reason: 'Valid ID',
	}
}
