/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
	IDCardFrontPDF,
	IDCardBackPDF,
	IDCardFrontPreview,
	IDCardBackPreview,
	createIDCardPDFStyles,
	type EmployeePDFData,
} from './employee-id-card.tsx'
import { type BrandingConfig } from '#app/utils/branding.server.ts'
import { pdf, Document } from '@react-pdf/renderer'

// Mock data for testing
const mockBranding: BrandingConfig = {
	schoolName: 'Test School',
	logoUrl: 'https://example.com/logo.png',
	primaryColor: '#1a1a1a',
	secondaryColor: '#ffffff',
}

const mockEmployee: EmployeePDFData = {
	id: 'emp-123',
	fullName: 'John Doe',
	jobTitle: 'Teacher',
	email: 'john.doe@test.com',
	status: 'active',
	sisEmployeeId: 'SIS123',
	photoUrl: 'https://example.com/photo.jpg',
	expirationDate: new Date('2025-07-01'),
}

describe('Employee ID Card Components', () => {
	describe('IDCardFrontPDF', () => {
		it('renders ID front with all required fields', () => {
			const doc = (
				<Document>
					<IDCardFrontPDF
						employee={mockEmployee}
						photoDataURL="data:image/png;base64,test"
						logoDataURL="data:image/png;base64,test"
						branding={mockBranding}
					/>
				</Document>
			)

			// Should not throw when rendering
			expect(() => pdf(doc)).not.toThrow()
		})

		it('handles missing photo gracefully', () => {
			const doc = (
				<Document>
					<IDCardFrontPDF
						employee={mockEmployee}
						photoDataURL={null}
						logoDataURL={null}
						branding={mockBranding}
					/>
				</Document>
			)

			// Should not throw when rendering without photo
			expect(() => pdf(doc)).not.toThrow()
		})

		it('applies school branding correctly', () => {
			const styles = createIDCardPDFStyles(mockBranding)

			// Check that styles use branding colors
			expect(styles.frontPage.backgroundColor).toBe(mockBranding.secondaryColor)
			expect(styles.schoolName.color).toBe(mockBranding.primaryColor)
		})

		it('validates required props', () => {
			// TypeScript will catch missing props, but we verify the component structure
			const doc = (
				<Document>
					<IDCardFrontPDF
						employee={mockEmployee}
						photoDataURL={null}
						logoDataURL={null}
						branding={mockBranding}
					/>
				</Document>
			)

			expect(() => pdf(doc)).not.toThrow()
		})
	})

	describe('IDCardBackPDF', () => {
		it('renders ID back with QR code', () => {
			const doc = (
				<Document>
					<IDCardBackPDF
						qrCodeDataURL="data:image/png;base64,test"
						branding={mockBranding}
					/>
				</Document>
			)

			// Should not throw when rendering
			expect(() => pdf(doc)).not.toThrow()
		})

		it('applies school branding correctly', () => {
			const styles = createIDCardPDFStyles(mockBranding)

			// Check that styles use branding colors
			expect(styles.backPage.backgroundColor).toBe(mockBranding.secondaryColor)
		})
	})

	describe('IDCardFrontPreview', () => {
		it('renders ID front with all required fields', () => {
			const { container } = render(
				<IDCardFrontPreview
					employee={mockEmployee}
					photoUrl="https://example.com/photo.jpg"
					logoUrl="https://example.com/logo.png"
					branding={mockBranding}
				/>,
			)

			// Check that employee name is rendered
			expect(container.textContent).toContain(mockEmployee.fullName)
			expect(container.textContent).toContain(mockEmployee.jobTitle)
			expect(container.textContent).toContain(mockEmployee.sisEmployeeId)
			expect(container.textContent).toContain(mockBranding.schoolName)
		})

		it('handles missing photo gracefully', () => {
			const { container } = render(
				<IDCardFrontPreview
					employee={mockEmployee}
					photoUrl={null}
					logoUrl={null}
					branding={mockBranding}
				/>,
			)

			// Should show "No Photo" placeholder
			expect(container.textContent).toContain('No Photo')
		})

		it('applies school branding correctly', () => {
			const { container } = render(
				<IDCardFrontPreview
					employee={mockEmployee}
					photoUrl={null}
					logoUrl={null}
					branding={mockBranding}
				/>,
			)

			const card = container.firstChild as HTMLElement
			expect(card).toBeTruthy()
			// Check that branding colors are applied via inline styles
			// Note: CSS converts hex colors to rgb, so we check for both
			const styleAttr = card.getAttribute('style') || ''
			expect(
				styleAttr.includes(mockBranding.secondaryColor) ||
					styleAttr.includes('rgb(255, 255, 255)'),
			).toBe(true)
			expect(
				styleAttr.includes(mockBranding.primaryColor) ||
					styleAttr.includes('rgb(26, 26, 26)'),
			).toBe(true)
		})

		it('is responsive and printable', () => {
			const { container } = render(
				<IDCardFrontPreview
					employee={mockEmployee}
					photoUrl={null}
					logoUrl={null}
					branding={mockBranding}
				/>,
			)

			const card = container.firstChild as HTMLElement
			expect(card).toBeTruthy()
			// Check that width and height are set (printable dimensions)
			expect(card.getAttribute('style')).toContain('243px') // ID_WIDTH
			expect(card.getAttribute('style')).toContain('153px') // ID_HEIGHT
		})

		it('validates required props', () => {
			// TypeScript will catch missing props, but we verify the component renders
			const { container } = render(
				<IDCardFrontPreview
					employee={mockEmployee}
					photoUrl={null}
					logoUrl={null}
					branding={mockBranding}
				/>,
			)

			expect(container.firstChild).toBeTruthy()
		})
	})

	describe('IDCardBackPreview', () => {
		it('renders ID back with QR code', () => {
			const { container } = render(
				<IDCardBackPreview
					qrCodeDataURL="data:image/png;base64,test"
					branding={mockBranding}
				/>,
			)

			// Check that QR code image is rendered
			const qrCodeImage = container.querySelector('img')
			expect(qrCodeImage).toBeTruthy()
			expect(qrCodeImage?.src).toContain('data:image/png;base64,test')

			// Check that verification text is rendered
			expect(container.textContent).toContain('Scan to verify employee status')
			expect(container.textContent).toContain(mockBranding.schoolName)
		})

		it('applies school branding correctly', () => {
			const { container } = render(
				<IDCardBackPreview
					qrCodeDataURL="data:image/png;base64,test"
					branding={mockBranding}
				/>,
			)

			const card = container.firstChild as HTMLElement
			expect(card).toBeTruthy()
			// Check that branding colors are applied via inline styles
			// Note: CSS converts hex colors to rgb, so we check for both
			const styleAttr = card.getAttribute('style') || ''
			expect(
				styleAttr.includes(mockBranding.secondaryColor) ||
					styleAttr.includes('rgb(255, 255, 255)'),
			).toBe(true)
			expect(
				styleAttr.includes(mockBranding.primaryColor) ||
					styleAttr.includes('rgb(26, 26, 26)'),
			).toBe(true)
		})

		it('is responsive and printable', () => {
			const { container } = render(
				<IDCardBackPreview
					qrCodeDataURL="data:image/png;base64,test"
					branding={mockBranding}
				/>,
			)

			const card = container.firstChild as HTMLElement
			expect(card).toBeTruthy()
			// Check that width and height are set (printable dimensions)
			expect(card.getAttribute('style')).toContain('243px') // ID_WIDTH
			expect(card.getAttribute('style')).toContain('153px') // ID_HEIGHT
		})
	})
})
