import { captureException } from '@sentry/react-router'
import { invariantResponse } from '@epic-web/invariant'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { generateEmployeeIDPDF } from '#app/utils/pdf-id.server.tsx'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { type Route } from './+types/download.ts'

/**
 * PDF download endpoint for admins to download any employee's ID card
 * Admins can download any employee's PDF
 */
export async function loader({ request, params }: Route.LoaderArgs) {
	try {
		await requireUserWithRole(request, 'admin')

		const { employeeId } = params
		if (!employeeId) {
			const error = new Error('Employee ID is required')
			console.error('[Admin ID Download] Missing employee ID parameter')
			captureException(error, {
				tags: {
					route: 'admin/employees/$employeeId/id/download',
					errorType: 'missing_employee_id',
				},
			})
			throw new Response('Employee ID is required', { status: 400 })
		}

		// Find employee by ID
		const employee = await prisma.employee.findUnique({
			where: { id: employeeId },
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
			const error = new Error('Employee not found')
			console.error('[Admin ID Download] Employee not found:', employeeId)
			captureException(error, {
				tags: {
					route: 'admin/employees/$employeeId/id/download',
					errorType: 'employee_not_found',
					employeeId,
				},
			})
			throw new Response('Employee not found', { status: 404 })
		}

		// Ensure EmployeeID record exists (create if missing)
		let employeeIdRecord = employee.employeeId
		if (!employeeIdRecord) {
			employeeIdRecord = await prisma.employeeID.create({
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
			photoUrl: employeeIdRecord.photoUrl,
			expirationDate: employeeIdRecord.expirationDate,
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
				'[Admin ID Download] Missing required data:',
				employeePDFData,
			)
			captureException(error, {
				tags: {
					route: 'admin/employees/$employeeId/id/download',
					errorType: 'missing_employee_data',
					employeeId: employeePDFData.id,
				},
			})
			throw new Response(
				'Missing required employee data. Please ensure the employee record is complete.',
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
				'[Admin ID Download] PDF generation failed:',
				pdfError.message,
				{ employeeId: employee.id },
			)
			captureException(pdfError, {
				tags: {
					route: 'admin/employees/$employeeId/id/download',
					errorType: 'pdf_generation_failed',
					employeeId: employee.id,
				},
				extra: { employeeData: employeePDFData },
			})
			throw new Response(
				'Failed to generate ID card. Please try again or contact support if the problem persists.',
				{ status: 500 },
			)
		}

		// Return PDF response with proper headers
		const filename = `employee-id-${employee.sisEmployeeId}.pdf`
		return new Response(Buffer.from(pdfBuffer).toString('base64'), {
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
		console.error('[Admin ID Download] Unexpected error:', error)
		captureException(error, {
			tags: {
				route: 'admin/employees/$employeeId/id/download',
				errorType: 'unexpected_error',
			},
		})
		throw new Response(
			'An unexpected error occurred while generating the ID card. Please try again or contact support.',
			{ status: 500 },
		)
	}
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				400: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Invalid Request</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data || 'Invalid request. Please try again.'}
							</p>
						</div>
					</div>
				),
				403: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Access Denied</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data ||
									'You do not have permission to access this resource.'}
							</p>
						</div>
					</div>
				),
				404: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Employee Not Found</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data ||
									'The employee you are looking for does not exist or has been removed.'}
							</p>
						</div>
					</div>
				),
				500: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Error Generating ID Card</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data ||
									'An error occurred while generating the ID card. Please try again or contact support if the problem persists.'}
							</p>
						</div>
					</div>
				),
			}}
			unexpectedErrorHandler={(error) => (
				<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
					<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
						<h1 className="text-h2 mb-4">Unexpected Error</h1>
						<p className="text-body-lg text-muted-foreground">
							An unexpected error occurred. Please try again or contact support.
						</p>
					</div>
				</div>
			)}
		/>
	)
}
