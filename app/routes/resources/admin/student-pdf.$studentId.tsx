import { captureException } from '@sentry/react-router'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { generateEmployeeIDPDF } from '#app/utils/pdf-id.server.tsx'
import {
	getNextJuly1ExpirationDate,
	fetchAndCacheFactsProfilePicture,
} from '#app/utils/student.server.ts'
import { type Route } from './+types/admin/student-pdf.$studentId.ts'

/**
 * Resource route for PDF download - admins can download any student's ID card
 * This is a resource route (no default export) to ensure proper file download handling
 */
export async function loader({ request, params }: Route.LoaderArgs) {
	try {
		await requireUserWithRole(request, 'admin')

		const { studentId } = params
		if (!studentId) {
			const error = new Error('Student ID is required')
			console.error('[Admin Student ID Download] Missing student ID parameter')
			captureException(error, {
				tags: {
					route: 'resources/admin/student-pdf',
					errorType: 'missing_student_id',
				},
			})
			throw new Response('Student ID is required', { status: 400 })
		}

		// Find student by ID
		const student = await prisma.student.findUnique({
			where: { id: studentId },
			select: {
				id: true,
				fullName: true,
				email: true,
				status: true,
				sisStudentId: true,
				studentId: {
					select: {
						photoUrl: true,
						expirationDate: true,
					},
				},
			},
		})

		if (!student) {
			const error = new Error('Student not found')
			console.error('[Admin Student ID Download] Student not found:', studentId)
			captureException(error, {
				tags: {
					route: 'resources/admin/student-pdf',
					errorType: 'student_not_found',
					studentId,
				},
			})
			throw new Response('Student not found', { status: 404 })
		}

		// Ensure StudentID record exists (create if missing)
		let studentIdRecord = student.studentId
		if (!studentIdRecord) {
			studentIdRecord = await prisma.studentID.create({
				data: {
					studentId: student.id,
					expirationDate: getNextJuly1ExpirationDate(),
				},
				select: {
					photoUrl: true,
					expirationDate: true,
				},
			})
		}

		// Fetch FACTS profile picture if no uploaded photo
		if (!studentIdRecord?.photoUrl) {
			try {
				await fetchAndCacheFactsProfilePicture(student.id, student.sisStudentId)
				// Re-fetch to get the updated photoUrl
				const updatedStudentId = await prisma.studentID.findUnique({
					where: { studentId: student.id },
					select: {
						photoUrl: true,
						expirationDate: true,
					},
				})
				if (updatedStudentId) {
					studentIdRecord = updatedStudentId
				}
			} catch (error) {
				// Log error but continue without photo
				console.error('Failed to fetch FACTS profile picture:', error)
			}
		}

		// Prepare student data for PDF generation
		const studentPDFData = {
			id: student.id,
			fullName: student.fullName,
			personType: 'STUDENT' as const,
			email: student.email,
			status: student.status,
			sisEmployeeId: student.sisStudentId,
			photoUrl: studentIdRecord.photoUrl,
			expirationDate: studentIdRecord.expirationDate,
		}

		// Validate required fields before PDF generation
		if (!studentPDFData.id || !studentPDFData.fullName || !studentPDFData.personType) {
			const error = new Error(
				'Missing required student data for PDF generation',
			)
			console.error(
				'[Admin Student ID Download] Missing required data:',
				studentPDFData,
			)
			captureException(error, {
				tags: {
					route: 'resources/admin/student-pdf',
					errorType: 'missing_student_data',
					studentId: studentPDFData.id,
				},
			})
			throw new Response(
				'Missing required student data. Please ensure the student record is complete.',
				{ status: 400 },
			)
		}

		// Generate PDF
		let pdfBuffer: Buffer
		try {
			pdfBuffer = await generateEmployeeIDPDF(studentPDFData, request)
		} catch (error) {
			const pdfError =
				error instanceof Error
					? error
					: new Error('Failed to generate PDF ID card')
			console.error(
				'[Admin Student ID Download] PDF generation failed:',
				pdfError.message,
				{ studentId: student.id },
			)
			captureException(pdfError, {
				tags: {
					route: 'resources/admin/student-pdf',
					errorType: 'pdf_generation_failed',
					studentId: student.id,
				},
				extra: { studentData: studentPDFData },
			})
			throw new Response(
				'Failed to generate ID card. Please try again or contact support if the problem persists.',
				{ status: 500 },
			)
		}

		// Return PDF response with proper headers
		const filename = `student-id-${student.sisStudentId}.pdf`
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
		console.error('[Admin Student ID Download] Unexpected error:', error)
		captureException(error, {
			tags: {
				route: 'resources/admin/student-pdf',
				errorType: 'unexpected_error',
			},
		})
		throw new Response(
			'An unexpected error occurred while generating the ID card. Please try again or contact support.',
			{ status: 500 },
		)
	}
}
