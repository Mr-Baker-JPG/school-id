import { invariantResponse } from '@epic-web/invariant'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { generateBulkEmployeeIDPDF } from '#app/utils/pdf-id.server.tsx'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { type Route } from './+types/print.ts'

/**
 * Bulk print route for multiple employee ID cards
 * Generates a PDF with multiple ID cards arranged per page
 */
export async function loader({ request }: Route.LoaderArgs) {
	try {
		await requireUserWithRole(request, 'admin')

		const searchParams = new URL(request.url).searchParams
		const employeeIds = searchParams.getAll('employeeIds')

		if (employeeIds.length === 0) {
			throw new Response('No employees selected for printing', { status: 400 })
		}

		// Fetch all selected employees
		const employees = await prisma.employee.findMany({
			where: {
				id: {
					in: employeeIds,
				},
			},
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
			orderBy: {
				fullName: 'asc',
			},
		})

		if (employees.length === 0) {
			throw new Response('No employees found', { status: 404 })
		}

		// Ensure all employees have EmployeeID records (create if missing)
		const employeesWithIds = await Promise.all(
			employees.map(async (employee) => {
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
				return {
					id: employee.id,
					fullName: employee.fullName,
					jobTitle: employee.jobTitle,
					email: employee.email,
					status: employee.status,
					sisEmployeeId: employee.sisEmployeeId,
					photoUrl: employeeIdRecord.photoUrl,
					expirationDate: employeeIdRecord.expirationDate,
				}
			}),
		)

		// Validate all employees have required fields
		for (const employee of employeesWithIds) {
			if (!employee.id || !employee.fullName || !employee.jobTitle) {
				throw new Response(
					`Missing required data for employee: ${employee.fullName || employee.id}`,
					{ status: 400 },
				)
			}
		}

		// Generate bulk PDF
		let pdfBuffer: Buffer
		try {
			pdfBuffer = await generateBulkEmployeeIDPDF(employeesWithIds, request)
		} catch (error) {
			const pdfError =
				error instanceof Error
					? error
					: new Error('Failed to generate bulk PDF ID cards')
			console.error('[Bulk Print] PDF generation failed:', pdfError.message)
			throw new Response(
				'Failed to generate ID cards. Please try again or contact support if the problem persists.',
				{ status: 500 },
			)
		}

		// Return PDF response with proper headers
		const filename = `employee-id-cards-${new Date().toISOString().split('T')[0]}.pdf`
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
		console.error('[Bulk Print] Unexpected error:', error)
		throw new Response(
			'An unexpected error occurred while generating the ID cards. Please try again or contact support.',
			{ status: 500 },
		)
	}
}

