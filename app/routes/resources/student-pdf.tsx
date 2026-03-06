import { captureException } from '@sentry/react-router'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { generateEmployeeIDPDF } from '#app/utils/pdf-id.server.tsx'
import { getNextJuly1ExpirationDate } from '#app/utils/student.server.ts'
import { type Route } from './+types/student-pdf.ts'

/**
 * Resource route for PDF download - students can download their own ID card
 * This is a resource route (no default export) to ensure proper file download handling
 * Students can only download their own PDF (enforced by email matching)
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
			console.error('[Student ID Download] User not found:', userId)
			captureException(error, {
				tags: { route: 'resources/student-pdf', errorType: 'user_not_found' },
			})
			throw new Response('User not found', { status: 404 })
		}

		// Find student by matching email
		const student = await prisma.student.findUnique({
			where: { email: user.email },
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
			const error = new Error('Student record not found')
			console.error(
				'[Student ID Download] Student not found for email:',
				user.email,
			)
			captureException(error, {
				tags: {
					route: 'resources/student-pdf',
					errorType: 'student_not_found',
					email: user.email,
				},
			})
			throw new Response('Student record not found', { status: 404 })
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
				'[Student ID Download] Missing required data:',
				studentPDFData,
			)
			captureException(error, {
				tags: {
					route: 'resources/student-pdf',
					errorType: 'missing_student_data',
					studentId: studentPDFData.id,
				},
			})
			throw new Response(
				'Missing required student data. Please contact an administrator.',
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
				'[Student ID Download] PDF generation failed:',
				pdfError.message,
				{ studentId: student.id },
			)
			captureException(pdfError, {
				tags: {
					route: 'resources/student-pdf',
					errorType: 'pdf_generation_failed',
					studentId: student.id,
				},
				extra: { studentData: studentPDFData },
			})
			throw new Response(
				'Failed to generate ID card. Please try again or contact an administrator if the problem persists.',
				{ status: 500 },
			)
		}

		// Return PDF response with proper headers
		// Note: Return buffer directly, not base64 encoded
		const filename = `student-id-${student.sisStudentId || student.id}.pdf`
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
		console.error('[Student ID Download] Unexpected error:', error)
		captureException(error, {
			tags: { route: 'resources/student-pdf', errorType: 'unexpected_error' },
		})
		throw new Response(
			'An unexpected error occurred while generating your ID card. Please try again or contact an administrator.',
			{ status: 500 },
		)
	}
}
