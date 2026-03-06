import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
	generateAppleWalletPass,
	generateGooglePayPass,
} from './wallet-pass.server.ts'
import { type EmployeePDFData } from '#app/components/employee-id-card.tsx'

// Mock dependencies
vi.mock('./branding.server.ts', () => ({
	getBrandingConfig: vi.fn(() => ({
		schoolName: 'Test School',
		logoUrl: 'https://example.com/logo.png',
		primaryColor: '#1a1a1a',
		secondaryColor: '#ffffff',
	})),
}))

vi.mock('./qr-code.server.ts', () => ({
	generateEmployeeQRCodeBuffer: vi.fn(() => Buffer.from('mock-qr-code')),
}))

vi.mock('./storage.server.ts', () => ({
	getSignedGetRequestInfo: vi.fn(() => ({
		url: 'https://example.com/photo.jpg',
		headers: {},
	})),
}))

vi.mock('./misc.tsx', () => ({
	getDomainUrl: vi.fn(() => 'https://example.com'),
}))

// Mock fetch for image fetching
global.fetch = vi.fn()

describe('wallet-pass.server', () => {
	const mockEmployee: EmployeePDFData = {
		id: 'emp-123',
		fullName: 'John Doe',
		jobTitle: 'Teacher',
		email: 'john.doe@school.edu',
		status: 'active',
		sisEmployeeId: 'SIS123',
		photoUrl: 'employees/123/photo.jpg',
		expirationDate: new Date('2025-12-31'),
	}

	const mockRequest = new Request('https://example.com/employee/id/wallet')

	beforeEach(() => {
		vi.clearAllMocks()
		// Mock successful image fetch
		;(global.fetch as any).mockResolvedValue({
			ok: true,
			arrayBuffer: async () => new ArrayBuffer(8),
			headers: new Headers({ 'content-type': 'image/jpeg' }),
		})
	})

	describe('generateAppleWalletPass', () => {
		it('should throw error when certificates are not configured', async () => {
			// Clear any existing certificate env vars
			delete process.env.APPLE_WALLET_WWDR_CERT
			delete process.env.APPLE_WALLET_SIGNER_CERT
			delete process.env.APPLE_WALLET_SIGNER_KEY

			await expect(
				generateAppleWalletPass(mockEmployee, mockRequest),
			).rejects.toThrow('Apple Wallet certificates not configured')
		})

		it('should validate required employee data', async () => {
			delete process.env.APPLE_WALLET_WWDR_CERT
			delete process.env.APPLE_WALLET_SIGNER_CERT
			delete process.env.APPLE_WALLET_SIGNER_KEY

			const invalidEmployee = { ...mockEmployee, fullName: '' }

			await expect(
				generateAppleWalletPass(invalidEmployee, mockRequest),
			).rejects.toThrow('Missing required employee data')
		})

		it('should handle missing photo gracefully', async () => {
			delete process.env.APPLE_WALLET_WWDR_CERT
			delete process.env.APPLE_WALLET_SIGNER_CERT
			delete process.env.APPLE_WALLET_SIGNER_KEY

			const employeeWithoutPhoto = { ...mockEmployee, photoUrl: null }

			await expect(
				generateAppleWalletPass(employeeWithoutPhoto, mockRequest),
			).rejects.toThrow('Apple Wallet certificates not configured')
		})

		// Note: Full pass generation tests would require actual certificates
		// These are better suited for integration/E2E tests
	})

	describe('generateGooglePayPass', () => {
		it('should generate valid Google Pay pass JSON', async () => {
			const passJson = await generateGooglePayPass(mockEmployee, mockRequest)

			expect(passJson).toBeTruthy()
			const passObject = JSON.parse(passJson)

			expect(passObject).toHaveProperty('genericObject')
			expect(passObject.genericObject).toHaveProperty('cardTitle')
			expect(passObject.genericObject.cardTitle.defaultValue.value).toBe(
				mockEmployee.fullName,
			)
			expect(passObject.genericObject).toHaveProperty('barcode')
			expect(passObject.genericObject.barcode.value).toContain(
				'/verify/emp-123',
			)
		})

		it('should include employee information in pass', async () => {
			const passJson = await generateGooglePayPass(mockEmployee, mockRequest)
			const passObject = JSON.parse(passJson)

			expect(passObject.genericObject.subheader.defaultValue.value).toBe(
				mockEmployee.jobTitle,
			)
			expect(passObject.genericObject.textModulesData).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						header: 'Employee ID',
						body: mockEmployee.sisEmployeeId,
					}),
				]),
			)
		})

		it('should include photo in imageModulesData when available', async () => {
			const passJson = await generateGooglePayPass(mockEmployee, mockRequest)
			const passObject = JSON.parse(passJson)

			expect(passObject.genericObject.imageModulesData).toHaveLength(1)
			expect(passObject.genericObject.imageModulesData[0]).toHaveProperty(
				'mainImage',
			)
		})

		it('should omit photo in imageModulesData when not available', async () => {
			const employeeWithoutPhoto = { ...mockEmployee, photoUrl: null }
			const passJson = await generateGooglePayPass(
				employeeWithoutPhoto,
				mockRequest,
			)
			const passObject = JSON.parse(passJson)

			expect(passObject.genericObject.imageModulesData).toHaveLength(0)
		})

		it('should validate required employee data', async () => {
			const invalidEmployee = { ...mockEmployee, fullName: '' }

			await expect(
				generateGooglePayPass(invalidEmployee, mockRequest),
			).rejects.toThrow('Missing required employee data')
		})

		it('should format expiration date correctly', async () => {
			const passJson = await generateGooglePayPass(mockEmployee, mockRequest)
			const passObject = JSON.parse(passJson)

			const expirationField = passObject.genericObject.textModulesData.find(
				(field: any) => field.id === 'expiration',
			)
			expect(expirationField).toBeDefined()
			expect(expirationField.body).toBeTruthy()
		})

		it('should use branding colors', async () => {
			const passJson = await generateGooglePayPass(mockEmployee, mockRequest)
			const passObject = JSON.parse(passJson)

			expect(passObject.genericObject.hexBackgroundColor).toBe('ffffff')
		})
	})
})


