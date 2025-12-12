import { invariantResponse } from '@epic-web/invariant'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { generateEmployeeIDPDF } from '#app/utils/pdf-id.server.tsx'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { type Route } from './+types/download.ts'

/**
 * PDF download endpoint for employees to download their own ID card
 * Employees can only download their own PDF (enforced by email matching)
 */
export async function loader({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)

	// Get the authenticated user's email
	const user = await prisma.user.findUnique({
		select: { email: true },
		where: { id: userId },
	})

	if (!user) {
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

	invariantResponse(employee, 'Employee record not found', { status: 404 })

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
