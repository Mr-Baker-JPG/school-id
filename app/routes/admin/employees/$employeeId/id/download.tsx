import { invariantResponse } from '@epic-web/invariant'
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
	await requireUserWithRole(request, 'admin')

	const { employeeId } = params
	invariantResponse(employeeId, 'Employee ID is required', { status: 400 })

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

	invariantResponse(employee, 'Employee not found', { status: 404 })

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

	// Generate PDF
	const pdfBuffer = await generateEmployeeIDPDF(employeePDFData, request)

	// Return PDF response with proper headers
	const filename = `employee-id-${employee.sisEmployeeId}.pdf`
	return new Response(pdfBuffer, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': pdfBuffer.length.toString(),
		},
	})
}
