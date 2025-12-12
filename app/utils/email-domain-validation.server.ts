/**
 * Get the allowed school email domain from environment variables
 */
export function getAllowedEmailDomain(): string | null {
	return process.env.SCHOOL_EMAIL_DOMAIN || null
}

/**
 * Validate that the email belongs to the allowed school domain
 */
export function validateEmailDomain(email: string): boolean {
	const allowedDomain = getAllowedEmailDomain()
	if (!allowedDomain) {
		// If no domain restriction is configured, allow all emails
		// This is useful for development/testing
		return true
	}

	const emailDomain = email.toLowerCase().split('@')[1]
	return emailDomain === allowedDomain.toLowerCase()
}
