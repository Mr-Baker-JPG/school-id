import { captureException } from '@sentry/react-router'
import { invariantResponse } from '@epic-web/invariant'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { generateEmployeeIDPDF } from '#app/utils/pdf-id.server.tsx'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { type Route } from './+types/employee-pdf.ts'

/**
 * Resource route for PDF download - employees can download their own ID card
 * This is a resource route (no default export) to ensure proper file download handling
 * Employees can only download their own PDF (enforced by email matching)
 */
export async function loader({ request }: Route.LoaderArgs) {
	try {
		const userId = await requireUserId(request)

		// Get the authenticated user's email
		const user = await prisma.user.findUnique({
			select: { email: true },
			where: { id: userId },
		})

		if (!user) {
			const error = new Error('User not found')
			console.error('[Employee ID Download] User not found:', userId)
			captureException(error, {
				tags: { route: 'resources/employee-pdf', errorType: 'user_not_found' },
			})
			throw new Response('User not found', { status: 404 })
		}

		// Find employee by matching email
		const employee = await prisma.employee.findUnique({
			where: { email: user.email },
			select: {
				id: true,
				fullName: true,
				jobTitle: true,
				email: true,
				status: true,
				sisEmployeeId: true,
				employeeId: {
					select: {
						photoUrl: true,
						expirationDate: true,
					},
				},
			},
		})

		if (!employee) {
			const error = new Error('Employee record not found')
			console.error(
				'[Employee ID Download] Employee not found for email:',
				user.email,
			)
			captureException(error, {
				tags: {
					route: 'resources/employee-pdf',
					errorType: 'employee_not_found',
					email: user.email,
				},
			})
			throw new Response('Employee record not found', { status: 404 })
		}

		// Ensure EmployeeID record exists (create if missing)
		let employeeId = employee.employeeId
		if (!employeeId) {
			employeeId = await prisma.employeeID.create({
				data: {
					employeeId: employee.id,
					expirationDate: getDefaultExpirationDate(),
				},
				select: {
					photoUrl: true,
					expirationDate: true,
				},
			})
		}

		// Prepare employee data for PDF generation
		const employeePDFData = {
			id: employee.id,
			fullName: employee.fullName,
			jobTitle: employee.jobTitle,
			email: employee.email,
			status: employee.status,
			sisEmployeeId: employee.sisEmployeeId,
			photoUrl: employeeId.photoUrl,
			expirationDate: employeeId.expirationDate,
		}

		// Validate required fields before PDF generation
		if (
			!employeePDFData.id ||
			!employeePDFData.fullName ||
			!employeePDFData.jobTitle
		) {
			const error = new Error(
				'Missing required employee data for PDF generation',
			)
			console.error(
				'[Employee ID Download] Missing required data:',
				employeePDFData,
			)
			captureException(error, {
				tags: {
					route: 'resources/employee-pdf',
					errorType: 'missing_employee_data',
					employeeId: employeePDFData.id,
				},
			})
			throw new Response(
				'Missing required employee data. Please contact an administrator.',
				{ status: 400 },
			)
		}

		// Generate PDF
		let pdfBuffer: Buffer
		try {
			pdfBuffer = await generateEmployeeIDPDF(employeePDFData, request)
		} catch (error) {
			const pdfError =
				error instanceof Error
					? error
					: new Error('Failed to generate PDF ID card')
			console.error(
				'[Employee ID Download] PDF generation failed:',
				pdfError.message,
				{ employeeId: employee.id },
			)
			captureException(pdfError, {
				tags: {
					route: 'resources/employee-pdf',
					errorType: 'pdf_generation_failed',
					employeeId: employee.id,
				},
				extra: { employeeData: employeePDFData },
			})
			throw new Response(
				'Failed to generate ID card. Please try again or contact an administrator if the problem persists.',
				{ status: 500 },
			)
		}

		// Return PDF response with proper headers
		// Note: Return buffer directly, not base64 encoded
		const filename = `employee-id-${employee.sisEmployeeId || employee.id}.pdf`
		return new Response(pdfBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': pdfBuffer.length.toString(),
			},
		})
	} catch (error) {
		// Re-throw Response objects (these are handled by error boundaries)
		if (error instanceof Response) {
			throw error
		}
		// Log and capture unexpected errors
		console.error('[Employee ID Download] Unexpected error:', error)
		captureException(error, {
			tags: { route: 'resources/employee-pdf', errorType: 'unexpected_error' },
		})
		throw new Response(
			'An unexpected error occurred while generating your ID card. Please try again or contact an administrator.',
			{ status: 500 },
		)
	}
}
