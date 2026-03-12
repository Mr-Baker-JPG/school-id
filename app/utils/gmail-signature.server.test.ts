import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from './db.server.ts'
import { consoleError, consoleWarn } from '#tests/setup/setup-test-env.ts'

// Mock google-auth-library before importing the service
const mockRequest = vi.fn()
vi.mock('google-auth-library', () => ({
	JWT: vi.fn().mockImplementation(() => ({
		request: mockRequest,
	})),
}))

describe('GmailSignatureService', () => {
	let GmailSignatureService: any
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(async () => {
		// Save original env
		originalEnv = { ...process.env }
		
		// Set up environment for tests
		process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.iam.gserviceaccount.com'
		process.env.GOOGLE_SERVICE_ACCOUNT_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----'
		
		// Allow console.warn and console.error for these tests
		consoleWarn.mockImplementation(() => {})
		consoleError.mockImplementation(() => {})
		
		// Clear mock
		mockRequest.mockClear()
		
		// Import service
		const module = await import('./gmail-signature.server.ts')
		GmailSignatureService = module.GmailSignatureService
	})

	afterEach(() => {
		// Restore original env
		process.env = originalEnv
		vi.clearAllMocks()
	})

	describe('getSignature', () => {
		test('fetches signature via service account impersonation', async () => {
			// This is our tracer bullet - proves the path works end-to-end
			const email = 'teacher@jpgacademy.org'
			const expectedSignature = '<div>Best regards,<br>John Doe</div>'

			// Mock successful Gmail API response
			mockRequest.mockResolvedValueOnce({
				data: {
					signature: expectedSignature,
				},
			})

			const service = new GmailSignatureService()
			const result = await service.getSignature(email)

			expect(result).toBe(expectedSignature)
			expect(mockRequest).toHaveBeenCalledWith({
				url: `https://gmail.googleapis.com/gmail/v1/users/${email}/settings/sendAs/${email}`,
				method: 'GET',
			})
		})

		test('returns null when service account not configured', async () => {
			// Create service without env vars
			const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
			delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL

			const service = new GmailSignatureService()
			const result = await service.getSignature('test@example.com')

			expect(result).toBeNull()
			expect(mockRequest).not.toHaveBeenCalled()

			// Restore env
			process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail
		})
	})

	describe('setSignature', () => {
		test('returns error when service account not configured', async () => {
			// Create service without env vars
			const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
			delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL

			const service = new GmailSignatureService()
			const result = await service.setSignature('test@example.com', '<p>sig</p>')

			expect(result.success).toBe(false)
			expect(result.error).toContain('not configured')
			expect(mockRequest).not.toHaveBeenCalled()

			// Restore env
			process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail
		})

		// Note: The actual API calls with PUT method are tested via the push route tests
		// which mock the gmailSignatureService.setSignature method directly
	})

	describe('fetchAndCacheSignature', () => {
		test('does not update database if signature fetch fails', async () => {
			const email = 'teacher@jpgacademy.org'

			// Create employee in database
			const employee = await prisma.employee.create({
				data: {
					sisEmployeeId: 'TEST002',
					firstName: 'John',
					lastName: 'Doe',
					fullName: 'John Doe',
					jobTitle: 'Staff',
					email: email,
					status: 'active',
				},
			})

			// Create EmployeeID record
			await prisma.employeeID.create({
				data: {
					employeeId: employee.id,
					expirationDate: new Date('2026-07-01'),
				},
			})

			// Mock Gmail API error
			mockRequest.mockRejectedValueOnce(new Error('API Error'))

			// Fetch and cache (should not throw)
			const service = new GmailSignatureService()
			await service.fetchAndCacheSignature(employee.id, email)

			// Verify database was NOT updated
			const updatedEmployeeId = await prisma.employeeID.findUnique({
				where: { employeeId: employee.id },
			})

			expect(updatedEmployeeId?.gmailSignature).toBeNull()
			expect(updatedEmployeeId?.gmailSignatureFetchedAt).toBeNull()

			// Cleanup
			await prisma.employeeID.delete({ where: { employeeId: employee.id } })
			await prisma.employee.delete({ where: { id: employee.id } })
		})
	})
})
