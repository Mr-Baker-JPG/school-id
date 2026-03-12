/**
 * @vitest-environment jsdom
 *
 * Tests for ID card layout components
 * Verifies that ID cards display "FACULTY" for employees and "STUDENT" for students
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
	IDCardFrontPreview,
	type EmployeePDFData,
	type BrandingConfig,
} from './employee-id-card.tsx'

describe('ID Card Layout - Person Type Display (F039)', () => {
	const mockBranding: BrandingConfig = {
		schoolName: 'Test School',
		logoUrl: '/logo.png',
		primaryColor: '#1a1a1a',
		secondaryColor: '#ffffff',
	}

	const mockBarcodeDataURL =
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

	it('Employee ID cards display "FACULTY" label', () => {
		const facultyData: EmployeePDFData = {
			id: 'emp-1',
			firstName: 'John',
			lastName: 'Doe',
			fullName: 'John Doe',
			jobTitle: 'Teacher', // Kept for backward compatibility
			personType: 'FACULTY',
			email: 'john.doe@example.com',
			status: 'active',
			sisEmployeeId: 'EMP001',
			photoUrl: null,
			expirationDate: new Date('2024-07-01'),
		}

		const { container } = render(
			<IDCardFrontPreview
				employee={facultyData}
				photoUrl={null}
				logoUrl={mockBranding.logoUrl || null}
				branding={mockBranding}
				academicYear="2023-2024"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		// Check that FACULTY label is displayed
		expect(container.textContent).toContain('FACULTY')
		// Should NOT display the jobTitle
		expect(container.textContent).not.toContain('Teacher')
	})

	it('Student ID cards display "STUDENT" label', () => {
		const studentData: EmployeePDFData = {
			id: 'stu-1',
			firstName: 'Jane',
			lastName: 'Smith',
			fullName: 'Jane Smith',
			personType: 'STUDENT',
			email: 'jane.smith@school.org',
			status: 'active',
			sisEmployeeId: 'STU001',
			photoUrl: null,
			expirationDate: new Date('2024-07-01'),
		}

		const { container } = render(
			<IDCardFrontPreview
				employee={studentData}
				photoUrl={null}
				logoUrl={mockBranding.logoUrl || null}
				branding={mockBranding}
				academicYear="2023-2024"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		// Check that STUDENT label is displayed
		expect(container.textContent).toContain('STUDENT')
	})

	it('Displays firstName + lastName on ID cards', () => {
		// Test case: ID cards show firstName + lastName from database
		const multiPartNameData: EmployeePDFData = {
			id: 'emp-1',
			firstName: 'Mary Jane',
			lastName: 'Smith',
			fullName: 'Mary Jane Watson Smith',
			personType: 'FACULTY',
			email: 'mary.jane@example.com',
			status: 'active',
			sisEmployeeId: 'EMP001',
			photoUrl: null,
			expirationDate: new Date('2024-07-01'),
		}

		const { container } = render(
			<IDCardFrontPreview
				employee={multiPartNameData}
				photoUrl={null}
				logoUrl={mockBranding.logoUrl || null}
				branding={mockBranding}
				academicYear="2023-2024"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		// Should display firstName + lastName: "MARY JANE SMITH"
		expect(container.textContent).toContain('MARY JANE')
		expect(container.textContent).toContain('SMITH')
	})

	it('Displays both names for two-part names', () => {
		// Test case: person with just first and last name should show both
		const twoPartNameData: EmployeePDFData = {
			id: 'emp-1',
			firstName: 'John',
			lastName: 'Smith',
			fullName: 'John Smith',
			personType: 'STAFF',
			email: 'john.smith@example.com',
			status: 'active',
			sisEmployeeId: 'EMP002',
			photoUrl: null,
			expirationDate: new Date('2024-07-01'),
		}

		const { container } = render(
			<IDCardFrontPreview
				employee={twoPartNameData}
				photoUrl={null}
				logoUrl={mockBranding.logoUrl || null}
				branding={mockBranding}
				academicYear="2023-2024"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		// Should display firstName + lastName: "JOHN SMITH"
		expect(container.textContent).toContain('JOHN SMITH')
	})

	it('Academic year displays correctly for both types', () => {
		const facultyData: EmployeePDFData = {
			id: 'emp-1',
			firstName: 'John',
			lastName: 'Doe',
			fullName: 'John Doe',
			personType: 'FACULTY',
			email: 'john.doe@example.com',
			status: 'active',
			sisEmployeeId: 'EMP001',
			photoUrl: null,
			expirationDate: new Date('2024-07-01'),
		}

		const { container, rerender } = render(
			<IDCardFrontPreview
				employee={facultyData}
				photoUrl={null}
				logoUrl={mockBranding.logoUrl || null}
				branding={mockBranding}
				academicYear="2023-2024"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		// Check academic year is displayed
		expect(container.textContent).toContain('2023-2024')

		// Test with student
		const studentData: EmployeePDFData = {
			...facultyData,
			id: 'stu-1',
			personType: 'STUDENT',
			sisEmployeeId: 'STU001',
		}

		rerender(
			<IDCardFrontPreview
				employee={studentData}
				photoUrl={null}
				logoUrl={mockBranding.logoUrl || null}
				branding={mockBranding}
				academicYear="2024-2025"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		// Check academic year updates
		expect(container.textContent).toContain('2024-2025')
	})

	it('PDF generation works for both types', () => {
		// This test verifies that the component structure works for both types
		// Actual PDF generation is tested in pdf-id.server.test.tsx

		const facultyData: EmployeePDFData = {
			id: 'emp-1',
			firstName: 'John',
			lastName: 'Doe',
			fullName: 'John Doe',
			personType: 'FACULTY',
			email: 'john.doe@example.com',
			status: 'active',
			sisEmployeeId: 'EMP001',
			photoUrl: null,
			expirationDate: new Date('2024-07-01'),
		}

		const { container: facultyContainer } = render(
			<IDCardFrontPreview
				employee={facultyData}
				photoUrl={null}
				logoUrl={mockBranding.logoUrl || null}
				branding={mockBranding}
				academicYear="2023-2024"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		expect(facultyContainer.textContent).toContain('FACULTY')

		const studentData: EmployeePDFData = {
			...facultyData,
			id: 'stu-1',
			personType: 'STUDENT',
			sisEmployeeId: 'STU001',
		}

		const { container: studentContainer } = render(
			<IDCardFrontPreview
				employee={studentData}
				photoUrl={null}
				logoUrl={mockBranding.logoUrl || null}
				branding={mockBranding}
				academicYear="2023-2024"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		expect(studentContainer.textContent).toContain('STUDENT')
	})

	it('Branding is applied consistently', () => {
		const customBranding: BrandingConfig = {
			schoolName: 'Custom Academy',
			logoUrl: '/custom-logo.png',
			primaryColor: '#ff0000',
			secondaryColor: '#00ff00',
		}

		const facultyData: EmployeePDFData = {
			id: 'emp-1',
			firstName: 'John',
			lastName: 'Doe',
			fullName: 'John Doe',
			personType: 'FACULTY',
			email: 'john.doe@example.com',
			status: 'active',
			sisEmployeeId: 'EMP001',
			photoUrl: null,
			expirationDate: new Date('2024-07-01'),
		}

		const { container } = render(
			<IDCardFrontPreview
				employee={facultyData}
				photoUrl={null}
				logoUrl={customBranding.logoUrl || null}
				branding={customBranding}
				academicYear="2023-2024"
				barcodeDataURL={mockBarcodeDataURL}
			/>,
		)

		// Check that custom school name is displayed
		expect(container.textContent).toContain('CUSTOM')
		expect(container.textContent).toContain('ACADEMY')
		// Check that FACULTY label is still displayed
		expect(container.textContent).toContain('FACULTY')
	})
})
