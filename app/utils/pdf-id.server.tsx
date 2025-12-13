import { Document, pdf } from '@react-pdf/renderer'
import { getBrandingConfig } from './branding.server.ts'
import { generateEmployeeQRCodeBuffer } from './qr-code.server.ts'
import { getSignedGetRequestInfo } from './storage.server.ts'
import {
	IDCardFrontPDF,
	IDCardBackPDF,
	type EmployeePDFData,
} from '#app/components/employee-id-card.tsx'

// Re-export EmployeePDFData from employee-id-card component for backward compatibility
export type { EmployeePDFData } from '#app/components/employee-id-card.tsx'

/**
 * Fetches an image from a URL and converts it to a base64 data URL
 */
async function fetchImageAsDataURL(url: string): Promise<string> {
	try {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.statusText}`)
		}
		const arrayBuffer = await response.arrayBuffer()
		const buffer = Buffer.from(arrayBuffer)
		const base64 = buffer.toString('base64')
		const contentType = response.headers.get('content-type') || 'image/png'
		return `data:${contentType};base64,${base64}`
	} catch (error) {
		throw new Error(
			`Failed to fetch image from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}

/**
 * Gets the employee photo as a data URL for PDF embedding
 * Returns null if no photo is available
 */
async function getEmployeePhotoDataURL(
	photoUrl: string | null | undefined,
): Promise<string | null> {
	if (!photoUrl) {
		return null
	}

	try {
		// If photoUrl is an objectKey, get signed URL
		const { url: signedUrl, headers } = getSignedGetRequestInfo(photoUrl)
		const response = await fetch(signedUrl, { headers })
		if (!response.ok) {
			console.warn(`Failed to fetch employee photo: ${response.statusText}`)
			return null
		}
		const arrayBuffer = await response.arrayBuffer()
		const buffer = Buffer.from(arrayBuffer)
		const base64 = buffer.toString('base64')
		const contentType = response.headers.get('content-type') || 'image/jpeg'
		return `data:${contentType};base64,${base64}`
	} catch (error) {
		console.warn(
			`Error fetching employee photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}
}

/**
 * Gets the school logo as a data URL for PDF embedding
 * Returns null if no logo is configured
 */
async function getSchoolLogoDataURL(logoUrl?: string): Promise<string | null> {
	if (!logoUrl) {
		return null
	}

	try {
		return await fetchImageAsDataURL(logoUrl)
	} catch (error) {
		console.warn(
			`Error fetching school logo: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}
}

/**
 * Generates a PDF ID card for an employee
 *
 * @param employee - Employee data for the ID card
 * @param request - Request object to determine base URL for QR code
 * @returns Promise resolving to PDF buffer
 * @throws Error if PDF generation fails
 */
export async function generateEmployeeIDPDF(
	employee: EmployeePDFData,
	request: Request,
): Promise<Buffer> {
	try {
		// Validate required fields
		if (!employee.id || !employee.fullName || !employee.jobTitle) {
			throw new Error(
				'Missing required employee data: id, fullName, and jobTitle are required',
			)
		}

		// Get branding configuration
		const branding = getBrandingConfig()

		// Fetch employee photo
		const photoDataURL = await getEmployeePhotoDataURL(employee.photoUrl)

		// Fetch school logo
		const logoDataURL = await getSchoolLogoDataURL(branding.logoUrl)

		// Generate QR code
		const qrCodeBuffer = await generateEmployeeQRCodeBuffer(
			employee.id,
			request,
		)
		const qrCodeDataURL = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`

		// Create PDF document
		const doc = (
			<Document>
				<IDCardFrontPDF
					employee={employee}
					photoDataURL={photoDataURL}
					logoDataURL={logoDataURL}
					branding={branding}
				/>
				<IDCardBackPDF qrCodeDataURL={qrCodeDataURL} branding={branding} />
			</Document>
		)

		// Generate PDF buffer
		const pdfInstance = pdf(doc)
		const pdfStream = await pdfInstance.toBuffer()

		// Convert stream to buffer if needed
		if (Buffer.isBuffer(pdfStream)) {
			return pdfStream
		}

		// If it's a stream, convert it to a buffer
		const chunks: Buffer[] = []
		for await (const chunk of pdfStream as any) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
		}
		return Buffer.concat(chunks)
	} catch (error) {
		throw new Error(
			`Failed to generate PDF ID card for employee ${employee.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}
