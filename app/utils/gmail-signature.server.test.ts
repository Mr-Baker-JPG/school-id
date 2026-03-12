import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from './db.server.ts'
import { consoleError, consoleWarn } from '#tests/setup/setup-test-env.ts'

describe('GmailSignatureService', () => {
	let service: any
	let originalEnv: NodeJS.ProcessEnv
	let mockRequest: any

	beforeEach(async () => {
		// Save original env
		originalEnv = { ...process.env }
		
		// Set up environment for tests
		process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.iam.gserviceaccount.com'
		process.env.GOOGLE_SERVICE_ACCOUNT_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----'
		
		// Allow console.warn and console.error for these tests
		consoleWarn.mockImplementation(() => {})
		consoleError.mockImplementation(() => {})
		
		// Create fresh mock for each test
		mockRequest = vi.fn()
		
		// Mock google-auth-library with fresh mock
		vi.doMock('google-auth-library', () => ({
			JWT: vi.fn().mockImplementation(() => ({
				request: mockRequest,
			})),
		}))
		
		// Import service fresh for each test (to pick up new mock)
		const { GmailSignatureService } = await import('./gmail-signature.server.ts')
		service = new GmailSignatureService()
	})

	afterEach(() => {
		// Restore original env
		process.env = originalEnv
		vi.clearAllMocks()
		vi.doUnmock('google-auth-library')
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

			vi.resetModules()
			const { GmailSignatureService } = await import('./gmail-signature.server.ts')
			const noConfigService = new GmailSignatureService()

			const result = await noConfigService.getSignature('test@example.com')

			expect(result).toBeNull()
			expect(mockRequest).not.toHaveBeenCalled()

			// Restore env
			process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail
		})
	})

	describe('fetchAndCacheSignature', () => {
		test('fetches signature and saves to database', async () => {
			const email = 'teacher@jpgacademy.org'
			const expectedSignature = '<div>Best regards,<br>Jane Smith</div>'

			// Create employee in database
			const employee = await prisma.employee.create({
				data: {
					sisEmployeeId: 'TEST001',
					fullName: 'Jane Smith',
					jobTitle: 'Teacher',
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

			// Mock Gmail API response
			mockRequest.mockResolvedValueOnce({
				data: {
					signature: expectedSignature,
				},
			})

			console.log('[TEST] Mock setup, calling fetchAndCacheSignature')
			
			// Fetch and cache
			await service.fetchAndCacheSignature(employee.id, email)

			console.log('[TEST] Mock calls:', mockRequest.mock.calls)
			console.log('[TEST] Mock results:', mockRequest.mock.results)

			// Verify database was updated
			const updatedEmployeeId = await prisma.employeeID.findUnique({
				where: { employeeId: employee.id },
			})

			expect(updatedEmployeeId?.gmailSignature).toBe(expectedSignature)
			expect(updatedEmployeeId?.gmailSignatureFetchedAt).toBeTruthy()

			// Cleanup
			await prisma.employeeID.delete({ where: { employeeId: employee.id } })
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('does not update database if signature fetch fails', async () => {
			const email = 'teacher@jpgacademy.org'

			// Create employee in database
			const employee = await prisma.employee.create({
				data: {
					sisEmployeeId: 'TEST002',
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
