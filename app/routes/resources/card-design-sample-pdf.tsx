import { type Route } from './+types/card-design-sample-pdf.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { generateEmployeeIDPDF } from '#app/utils/pdf-id.server.tsx'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'

/**
 * Resource route: generates a sample PDF for a specific card design.
 * Uses sample employee data to show how the card looks printed.
 * 
 * Query params:
 * - design: Design ID (1-5). Defaults to 3 (Light Executive).
 */
export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	const url = new URL(request.url)
	const designParam = url.searchParams.get('design')
	const designId = designParam ? parseInt(designParam, 10) : 3

	const sampleEmployee = {
		id: 'sample-id',
		firstName: 'Samantha',
		lastName: 'Baker',
		fullName: 'Samantha Marie Baker',
		personType: 'FACULTY' as const,
		email: 'sbaker@jpgacademy.org',
		status: 'active',
		sisEmployeeId: '100247',
		photoUrl: null,
		expirationDate: getDefaultExpirationDate(),
	}

	const pdfBuffer = await generateEmployeeIDPDF(sampleEmployee, request, designId)
	const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer as any)

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="card-design-${designId}-sample.pdf"`,
			'Content-Length': String(buffer.length),
		},
	})
}
