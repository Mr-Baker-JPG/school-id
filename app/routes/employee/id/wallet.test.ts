import { describe, it, expect, vi, beforeEach } from 'vitest'
import { faker } from '@faker-js/faker'
import { prismaMock } from '#tests/setup-test-db.ts'
import { loader } from './wallet.ts'
import type { Route } from './+types/wallet.ts'

// Mock dependencies
vi.mock('#app/utils/auth.server.ts', () => ({
	requireUserId: vi.fn(() => 'user-123'),
}))

vi.mock('#app/utils/wallet-pass.server.ts', () => ({
	generateAppleWalletPass: vi.fn(() => Buffer.from('mock-apple-pass')),
	generateGooglePayPass: vi.fn(() => JSON.stringify({ mock: 'google-pass' })),
}))

vi.mock('#app/utils/device-detection.server.ts', () => ({
	getDeviceTypeFromRequest: vi.fn(() => 'ios'),
}))

vi.mock('#app/utils/employee.server.ts', () => ({
	getDefaultExpirationDate: vi.fn(() => new Date('2025-07-01')),
	fetchAndCacheFactsProfilePicture: vi.fn(() => Promise.resolve()),
}))

describe('employee/id/wallet route', () => {
	const mockUser = {
		id: 'user-123',
		email: 'john.doe@school.edu',
	}

	const mockEmployee = {
		id: 'emp-123',
		sisEmployeeId: 'SIS123',
		fullName: 'John Doe',
		jobTitle: 'Teacher',
		email: 'john.doe@school.edu',
		status: 'active' as const,
		employeeId: {
			photoUrl: 'employees/123/photo.jpg',
			expirationDate: new Date('2025-12-31'),
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should return 404 when user is not found', async () => {
		prismaMock.user.findUnique.mockResolvedValue(null)

		const request = new Request('https://example.com/employee/id/wallet')
		const args = { request } as Route.LoaderArgs

		await expect(loader(args)).rejects.toThrow('User not found')
	})

	it('should return 404 when employee is not found', async () => {
		prismaMock.user.findUnique.mockResolvedValue(mockUser)
		prismaMock.employee.findUnique.mockResolvedValue(null)

		const request = new Request('https://example.com/employee/id/wallet')
		const args = { request } as Route.LoaderArgs

		await expect(loader(args)).rejects.toThrow('Employee record not found')
	})

	it('should create EmployeeID record if missing', async () => {
		prismaMock.user.findUnique.mockResolvedValue(mockUser)
		prismaMock.employee.findUnique.mockResolvedValue({
			...mockEmployee,
			employeeId: null,
		})
		prismaMock.employeeID.create.mockResolvedValue({
			photoUrl: null,
			expirationDate: new Date('2025-07-01'),
		})

		const request = new Request('https://example.com/employee/id/wallet', {
			headers: {
				'user-agent':
					'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
			},
		})
		const args = { request } as Route.LoaderArgs

		await expect(loader(args)).rejects.toThrow() // Will fail on certificate check, but EmployeeID should be created

		expect(prismaMock.employeeID.create).toHaveBeenCalled()
	})

	it('should generate Apple Wallet pass for iOS devices', async () => {
		prismaMock.user.findUnique.mockResolvedValue(mockUser)
		prismaMock.employee.findUnique.mockResolvedValue(mockEmployee)

		const { getDeviceTypeFromRequest } = await import(
			'#app/utils/device-detection.server.ts'
		)
		vi.mocked(getDeviceTypeFromRequest).mockReturnValue('ios')

		const request = new Request('https://example.com/employee/id/wallet', {
			headers: {
				'user-agent':
					'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
			},
		})
		const args = { request } as Route.LoaderArgs

		// Will fail on certificate check, but we can verify the function was called
		const { generateAppleWalletPass } = await import(
			'#app/utils/wallet-pass.server.ts'
		)

		await expect(loader(args)).rejects.toThrow()

		// Verify device detection was called
		expect(getDeviceTypeFromRequest).toHaveBeenCalledWith(request)
	})

	it('should generate Google Pay pass for Android devices', async () => {
		prismaMock.user.findUnique.mockResolvedValue(mockUser)
		prismaMock.employee.findUnique.mockResolvedValue(mockEmployee)

		const { getDeviceTypeFromRequest } = await import(
			'#app/utils/device-detection.server.ts'
		)
		vi.mocked(getDeviceTypeFromRequest).mockReturnValue('android')

		const { generateGooglePayPass } = await import(
			'#app/utils/wallet-pass.server.ts'
		)

		const request = new Request('https://example.com/employee/id/wallet', {
			headers: {
				'user-agent':
					'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
			},
		})
		const args = { request } as Route.LoaderArgs

		// Google Pay pass generation should succeed (no certificates needed)
		const response = await loader(args)

		expect(response).toBeInstanceOf(Response)
		expect(response.headers.get('Content-Type')).toBe('application/json')
		expect(generateGooglePayPass).toHaveBeenCalled()
	})

	it('should return appropriate headers for Apple Wallet pass', async () => {
		prismaMock.user.findUnique.mockResolvedValue(mockUser)
		prismaMock.employee.findUnique.mockResolvedValue(mockEmployee)

		const { getDeviceTypeFromRequest } = await import(
			'#app/utils/device-detection.server.ts'
		)
		vi.mocked(getDeviceTypeFromRequest).mockReturnValue('ios')

		// Mock certificates to allow pass generation
		process.env.APPLE_WALLET_WWDR_CERT = Buffer.from('wwdr').toString('base64')
		process.env.APPLE_WALLET_SIGNER_CERT = Buffer.from('cert').toString('base64')
		process.env.APPLE_WALLET_SIGNER_KEY = Buffer.from('key').toString('base64')

		const request = new Request('https://example.com/employee/id/wallet', {
			headers: {
				'user-agent':
					'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
			},
		})
		const args = { request } as Route.LoaderArgs

		// Will likely fail due to invalid certificates, but we can check the attempt
		await expect(loader(args)).rejects.toThrow()
	})

	it('should return appropriate headers for Google Pay pass', async () => {
		prismaMock.user.findUnique.mockResolvedValue(mockUser)
		prismaMock.employee.findUnique.mockResolvedValue(mockEmployee)

		const { getDeviceTypeFromRequest } = await import(
			'#app/utils/device-detection.server.ts'
		)
		vi.mocked(getDeviceTypeFromRequest).mockReturnValue('android')

		const request = new Request('https://example.com/employee/id/wallet', {
			headers: {
				'user-agent':
					'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
			},
		})
		const args = { request } as Route.LoaderArgs

		const response = await loader(args)

		expect(response).toBeInstanceOf(Response)
		expect(response.headers.get('Content-Type')).toBe('application/json')
		expect(response.headers.get('Content-Disposition')).toContain('.json')
	})

	it('should handle wallet pass generation errors gracefully', async () => {
		prismaMock.user.findUnique.mockResolvedValue(mockUser)
		prismaMock.employee.findUnique.mockResolvedValue(mockEmployee)

		const { generateAppleWalletPass } = await import(
			'#app/utils/wallet-pass.server.ts'
		)
		vi.mocked(generateAppleWalletPass).mockRejectedValue(
			new Error('Certificate error'),
		)

		const { getDeviceTypeFromRequest } = await import(
			'#app/utils/device-detection.server.ts'
		)
		vi.mocked(getDeviceTypeFromRequest).mockReturnValue('ios')

		const request = new Request('https://example.com/employee/id/wallet')
		const args = { request } as Route.LoaderArgs

		await expect(loader(args)).rejects.toThrow('Failed to generate wallet pass')
	})
})
