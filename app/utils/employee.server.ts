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
