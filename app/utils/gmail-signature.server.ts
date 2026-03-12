import { JWT } from 'google-auth-library'
import { prisma } from './db.server.ts'

/**
 * Gmail Signature Service
 * Uses Google Workspace domain-wide delegation to fetch user signatures
 * via service account impersonation
 */
export class GmailSignatureService {
	/**
	 * Set a mock client for testing purposes
	 * @internal
	 */
	_setMockClient(client: any) {
		// For testing - will be removed later
		(this as any).mockClient = client
	}

	/**
	 * Fetch Gmail signature for a user via service account impersonation
	 * @param email - The user's email address
	 * @returns The HTML signature or null if not available
	 */
	async getSignature(email: string): Promise<string | null> {
		// Read credentials lazily (allows for test environment changes)
		const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
		const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n')

		if (!serviceAccountEmail || !privateKey) {
			console.warn('Gmail signature service not configured - missing service account credentials')
			return null
		}

		try {
			// Create JWT client with subject for domain-wide delegation
			// The "subject" parameter is critical - it tells Google which user to impersonate
			const client = new JWT({
				email: serviceAccountEmail,
				key: privateKey,
				scopes: ['https://www.googleapis.com/auth/gmail.settings.basic'],
				subject: email, // This is the user we're impersonating
			})

			console.log('[GmailSignature] Fetching signature for:', email)
			
			// Impersonate the user to fetch their signature
			const response = await client.request({
				url: `https://gmail.googleapis.com/gmail/v1/users/${email}/settings/sendAs/${email}`,
				method: 'GET',
			})

			console.log('[GmailSignature] Response:', response)
			
			return response.data?.signature ?? null
		} catch (error) {
			console.error(`Failed to fetch Gmail signature for ${email}:`, error)
			return null
		}
	}

	/**
	 * Fetch Gmail signature and cache it to the database
	 * @param employeeId - The employee's database ID
	 * @param email - The employee's email address
	 */
	async fetchAndCacheSignature(employeeId: string, email: string): Promise<void> {
		try {
			const signature = await this.getSignature(email)

			// Only update database if we successfully fetched a signature
			if (signature !== null) {
				await prisma.employeeID.update({
					where: { employeeId },
					data: {
						gmailSignature: signature,
						gmailSignatureFetchedAt: new Date(),
					},
				})
			}
		} catch (error) {
			console.error(`Failed to fetch and cache Gmail signature for employee ${employeeId}:`, error)
			// Don't throw - this is a background operation
		}
	}

	/**
	 * Batch fetch and cache signatures for all active employees
	 * @returns Summary of sync results
	 */
	async syncAllSignatures(): Promise<{
		success: boolean
		fetched: number
		skipped: number
		errors: number
		errorMessages: string[]
	}> {
		const result = {
			success: true,
			fetched: 0,
			skipped: 0,
			errors: 0,
			errorMessages: [] as string[],
		}

		try {
			// Get all active employees
			const employees = await prisma.employee.findMany({
				where: {
					status: 'active',
				},
				select: {
					id: true,
					email: true,
					fullName: true,
				},
			})

			console.log(`[GmailSignature] Starting batch sync for ${employees.length} employees`)

			// Fetch signatures one by one (Gmail API has rate limits)
			for (const employee of employees) {
				try {
					const signature = await this.getSignature(employee.email)

					if (signature !== null) {
						// Update database
						await prisma.employeeID.updateMany({
							where: { employeeId: employee.id },
							data: {
								gmailSignature: signature,
								gmailSignatureFetchedAt: new Date(),
							},
						})
						result.fetched++
					} else {
						result.skipped++
					}

					// Small delay to avoid hitting rate limits (200ms between requests)
					await new Promise((resolve) => setTimeout(resolve, 200))
				} catch (error) {
					result.errors++
					const errorMsg = `Failed to sync ${employee.fullName}: ${error instanceof Error ? error.message : 'Unknown error'}`
					result.errorMessages.push(errorMsg)
					console.error(errorMsg)
				}
			}

			console.log(
				`[GmailSignature] Batch sync complete: ${result.fetched} fetched, ${result.skipped} skipped, ${result.errors} errors`,
			)

			return result
		} catch (error) {
			result.success = false
			result.errors++
			result.errorMessages.push(
				`Batch sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
			return result
		}
	}
}

// Export singleton instance
export const gmailSignatureService = new GmailSignatureService()
