import { invariantResponse } from '@epic-web/invariant'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { generateBulkEmployeeIDPDF } from '#app/utils/pdf-id.server.tsx'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { getNextJuly1ExpirationDate } from '#app/utils/student.server.ts'
import { getEmployeePersonType } from '#app/utils/person-type.ts'
import { type EmployeePDFData } from '#app/components/employee-id-card.tsx'
import { type Route } from './+types/print.generate.ts'

/**
 * Unified bulk print endpoint for both employee and student ID cards.
 * Accepts employeeIds[] and studentIds[] query parameters.
 * Generates a single PDF with all selected cards.
 */
export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	const url = new URL(request.url)
	const employeeIds = url.searchParams.getAll('employeeIds')
	const studentIds = url.searchParams.getAll('studentIds')

	invariantResponse(
		employeeIds.length > 0 || studentIds.length > 0,
		'No people selected for printing',
		{ status: 400 },
	)

	const cards: EmployeePDFData[] = []

	// Fetch employees
	if (employeeIds.length > 0) {
		const employees = await prisma.employee.findMany({
			where: { id: { in: employeeIds } },
			select: {
				id: true,
				fullName: true,
				firstName: true,
				lastName: true,
				jobTitle: true,
				email: true,
				status: true,
				sisEmployeeId: true,
				employeeId: {
					select: { photoUrl: true, expirationDate: true },
				},
			},
			orderBy: { fullName: 'asc' },
		})

		for (const emp of employees) {
			let eid = emp.employeeId
			if (!eid) {
				eid = await prisma.employeeID.create({
					data: {
						employeeId: emp.id,
						expirationDate: getDefaultExpirationDate(),
					},
					select: { photoUrl: true, expirationDate: true },
				})
			}
			cards.push({
				id: emp.id,
				firstName: emp.firstName,
				lastName: emp.lastName,
				fullName: emp.fullName,
				personType: getEmployeePersonType(emp.jobTitle),
				email: emp.email,
				status: emp.status,
				sisEmployeeId: emp.sisEmployeeId,
				photoUrl: eid.photoUrl,
				expirationDate: eid.expirationDate,
			})
		}
	}

	// Fetch students
	if (studentIds.length > 0) {
		const students = await prisma.student.findMany({
			where: { id: { in: studentIds } },
			select: {
				id: true,
				fullName: true,
				firstName: true,
				lastName: true,
				email: true,
				status: true,
				sisStudentId: true,
				studentId: {
					select: { photoUrl: true, expirationDate: true },
				},
			},
			orderBy: { fullName: 'asc' },
		})

		for (const stu of students) {
			let sid = stu.studentId
			if (!sid) {
				sid = await prisma.studentID.create({
					data: {
						studentId: stu.id,
						expirationDate: getNextJuly1ExpirationDate(),
					},
					select: { photoUrl: true, expirationDate: true },
				})
			}
			cards.push({
				id: stu.id,
				firstName: stu.firstName,
				lastName: stu.lastName,
				fullName: stu.fullName,
				personType: 'STUDENT',
				email: stu.email,
				status: stu.status,
				sisEmployeeId: stu.sisStudentId, // reuse field for barcode/QR
				photoUrl: sid.photoUrl,
				expirationDate: sid.expirationDate,
			})
		}
	}

	invariantResponse(cards.length > 0, 'No valid people found for printing', {
		status: 404,
	})

	const pdfBuffer = await generateBulkEmployeeIDPDF(cards, request)

	const filename = `id-cards-${new Date().toISOString().split('T')[0]}.pdf`
	return new Response(pdfBuffer, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': pdfBuffer.length.toString(),
		},
	})
}
