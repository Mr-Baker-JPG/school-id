import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateEmployeeIDPDF } from './pdf-id.server.ts'
import { generateEmployeeQRCodeBuffer } from './qr-code.server.ts'
import { getSignedGetRequestInfo } from './storage.server.ts'
import { getBrandingConfig } from './branding.server.ts'

// Mock dependencies
vi.mock('./qr-code.server.ts')
vi.mock('./storage.server.ts')
vi.mock('./branding.server.ts')
vi.mock('./misc.tsx', () => ({
	getDomainUrl: (request: Request) => {
		const url = new URL(request.url)
		return `${url.protocol}//${url.host}`
	},
}))

// Mock fetch for image fetching
global.fetch = vi.fn()

describe('generateEmployeeIDPDF', () => {
	const mockEmployee = {
		id: 'emp-123',
		fullName: 'John Doe',
		jobTitle: 'Teacher',
		email: 'john.doe@school.edu',
		status: 'active',
		sisEmployeeId: 'SIS-12345',
		photoUrl: 'employees/emp-123/photos/photo.jpg',
		expirationDate: new Date('2025-07-01'),
	}

	const mockRequest = new Request('http://localhost:3000')

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock branding config
		vi.mocked(getBrandingConfig).mockReturnValue({
			schoolName: 'Test School',
			logoUrl: 'https://example.com/logo.png',
			primaryColor: '#1a1a1a',
			secondaryColor: '#ffffff',
		})

		// Mock QR code generation
		const mockQRCodeBuffer = Buffer.from('mock-qr-code-png-data')
		vi.mocked(generateEmployeeQRCodeBuffer).mockResolvedValue(mockQRCodeBuffer)

		// Mock signed URL for photo
		vi.mocked(getSignedGetRequestInfo).mockReturnValue({
			url: 'https://storage.example.com/photo.jpg',
			headers: {},
		})

		// Mock fetch for images
		vi.mocked(global.fetch).mockImplementation((url) => {
			if (typeof url === 'string' && url.includes('photo')) {
				return Promise.resolve({
					ok: true,
					arrayBuffer: () => Promise.resolve(Buffer.from('mock-photo-data')),
					headers: new Headers({ 'content-type': 'image/jpeg' }),
				} as Response)
			}
			if (typeof url === 'string' && url.includes('logo')) {
				return Promise.resolve({
					ok: true,
					arrayBuffer: () => Promise.resolve(Buffer.from('mock-logo-data')),
					headers: new Headers({ 'content-type': 'image/png' }),
				} as Response)
			}
			return Promise.reject(new Error('Unexpected URL'))
		})
	})

	it('generates PDF successfully for valid employee', async () => {
		const pdfBuffer = await generateEmployeeIDPDF(mockEmployee, mockRequest)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		expect(pdfBuffer.length).toBeGreaterThan(0)
		// PDF files start with %PDF
		expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF')
	})

	it('includes all required fields (name, title, photo, expiration, logo)', async () => {
		const pdfBuffer = await generateEmployeeIDPDF(mockEmployee, mockRequest)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		expect(pdfBuffer.length).toBeGreaterThan(0)

		// Verify that employee data is included in PDF
		const pdfText = pdfBuffer.toString('utf8')
		expect(pdfText).toContain('John Doe')
		expect(pdfText).toContain('Teacher')
		expect(pdfText).toContain('SIS-12345')
		expect(pdfText).toContain('07/01/2025') // Expiration date format
		expect(pdfText).toContain('Test School')
	})

	it('includes QR code on back', async () => {
		const pdfBuffer = await generateEmployeeIDPDF(mockEmployee, mockRequest)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		// Verify QR code generation was called
		expect(generateEmployeeQRCodeBuffer).toHaveBeenCalledWith(
			mockEmployee.id,
			mockRequest,
		)
	})

	it('is wallet-sized and printable', async () => {
		const pdfBuffer = await generateEmployeeIDPDF(mockEmployee, mockRequest)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		// Wallet size: 3.375" x 2.125" = 243 points x 153 points
		// Check that PDF contains size information
		const pdfText = pdfBuffer.toString('utf8')
		// PDF should contain page size information (in points)
		expect(pdfText).toMatch(/243|153/) // Either width or height
	})

	it('applies school branding (logo, colors) correctly', async () => {
		const pdfBuffer = await generateEmployeeIDPDF(mockEmployee, mockRequest)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		// Verify branding config was used
		expect(getBrandingConfig).toHaveBeenCalled()
		// Verify logo was fetched if configured
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('logo'),
			expect.any(Object),
		)
	})

	it('handles missing photo gracefully', async () => {
		const employeeWithoutPhoto = {
			...mockEmployee,
			photoUrl: null,
		}

		const pdfBuffer = await generateEmployeeIDPDF(
			employeeWithoutPhoto,
			mockRequest,
		)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		expect(pdfBuffer.length).toBeGreaterThan(0)
		// PDF should still be generated successfully
		expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF')
	})

	it('handles missing logo gracefully', async () => {
		vi.mocked(getBrandingConfig).mockReturnValue({
			schoolName: 'Test School',
			logoUrl: undefined,
			primaryColor: '#1a1a1a',
			secondaryColor: '#ffffff',
		})

		const pdfBuffer = await generateEmployeeIDPDF(mockEmployee, mockRequest)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		expect(pdfBuffer.length).toBeGreaterThan(0)
		// PDF should still be generated successfully without logo
		expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF')
	})

	it('handles photo fetch errors gracefully', async () => {
		vi.mocked(global.fetch).mockImplementation((url) => {
			if (typeof url === 'string' && url.includes('photo')) {
				return Promise.resolve({
					ok: false,
					statusText: 'Not Found',
				} as Response)
			}
			if (typeof url === 'string' && url.includes('logo')) {
				return Promise.resolve({
					ok: true,
					arrayBuffer: () => Promise.resolve(Buffer.from('mock-logo-data')),
					headers: new Headers({ 'content-type': 'image/png' }),
				} as Response)
			}
			return Promise.reject(new Error('Unexpected URL'))
		})

		const pdfBuffer = await generateEmployeeIDPDF(mockEmployee, mockRequest)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		expect(pdfBuffer.length).toBeGreaterThan(0)
		// PDF should still be generated even if photo fetch fails
		expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF')
	})

	it('handles logo fetch errors gracefully', async () => {
		vi.mocked(global.fetch).mockImplementation((url) => {
			if (typeof url === 'string' && url.includes('photo')) {
				return Promise.resolve({
					ok: true,
					arrayBuffer: () => Promise.resolve(Buffer.from('mock-photo-data')),
					headers: new Headers({ 'content-type': 'image/jpeg' }),
				} as Response)
			}
			if (typeof url === 'string' && url.includes('logo')) {
				return Promise.resolve({
					ok: false,
					statusText: 'Not Found',
				} as Response)
			}
			return Promise.reject(new Error('Unexpected URL'))
		})

		const pdfBuffer = await generateEmployeeIDPDF(mockEmployee, mockRequest)

		expect(pdfBuffer).toBeInstanceOf(Buffer)
		expect(pdfBuffer.length).toBeGreaterThan(0)
		// PDF should still be generated even if logo fetch fails
		expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF')
	})

	it('throws error for missing required employee data', async () => {
		const invalidEmployee = {
			...mockEmployee,
			fullName: '',
		}

		await expect(
			generateEmployeeIDPDF(invalidEmployee, mockRequest),
		).rejects.toThrow('Missing required employee data')
	})

	it('throws error for missing employee ID', async () => {
		const invalidEmployee = {
			...mockEmployee,
			id: '',
		}

		await expect(
			generateEmployeeIDPDF(invalidEmployee, mockRequest),
		).rejects.toThrow('Missing required employee data')
	})

	it('throws error for missing job title', async () => {
		const invalidEmployee = {
			...mockEmployee,
			jobTitle: '',
		}

		await expect(
			generateEmployeeIDPDF(invalidEmployee, mockRequest),
		).rejects.toThrow('Missing required employee data')
	})

	it('handles QR code generation errors', async () => {
		vi.mocked(generateEmployeeQRCodeBuffer).mockRejectedValue(
			new Error('QR code generation failed'),
		)

		await expect(
			generateEmployeeIDPDF(mockEmployee, mockRequest),
		).rejects.toThrow('Failed to generate PDF ID card')
	})
})
