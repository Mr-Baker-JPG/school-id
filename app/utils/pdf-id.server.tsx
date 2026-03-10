import { Document, pdf, Page, View, StyleSheet } from '@react-pdf/renderer'
import { getBrandingConfig } from './branding.server.ts'
import { generateEmployeeQRCodeBuffer } from './qr-code.server.ts'
import { getSignedGetRequestInfo } from './storage.server.ts'
import { generateBarcodeDataURL } from './barcode.server.ts'
import { getCurrentAcademicYear } from './employee.server.ts'
import { getDomainUrl } from './misc.tsx'
import { registerFonts } from './fonts.server.ts'
import {
	IDCardFrontPDF,
	IDCardBackPDF,
	IDCardFrontContentView,
	IDCardBackContentView,
	ID_WIDTH,
	ID_HEIGHT,
	type EmployeePDFData,
} from '#app/components/employee-id-card.tsx'

// Re-export EmployeePDFData from employee-id-card component for backward compatibility
export type { EmployeePDFData } from '#app/components/employee-id-card.tsx'

// Register fonts at module load time (safe for server-only code)
registerFonts()

/**
 * Fetches an image from a URL and converts it to a base64 data URL
 * Preserves SVG format and transparency
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

		// Detect content type from response or URL extension
		let contentType = response.headers.get('content-type')
		if (!contentType) {
			// Fallback to detecting from URL extension
			if (url.endsWith('.svg')) {
				contentType = 'image/svg+xml'
			} else if (url.endsWith('.png')) {
				contentType = 'image/png'
			} else if (url.endsWith('.jpg') || url.endsWith('.jpeg')) {
				contentType = 'image/jpeg'
			} else {
				contentType = 'image/png'
			}
		}

		// For SVG, we can use the SVG directly or convert to data URL
		// React PDF supports SVG via data URLs
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
 * Handles both absolute URLs and relative paths (converts relative paths to full URLs)
 */
async function getSchoolLogoDataURL(
	logoUrl: string | undefined,
	request: Request,
): Promise<string | null> {
	if (!logoUrl) {
		return null
	}

	try {
		// If logoUrl is a relative path, convert it to a full URL
		let fullLogoUrl = logoUrl
		if (logoUrl.startsWith('/')) {
			const domainUrl = getDomainUrl(request)
			fullLogoUrl = `${domainUrl}${logoUrl}`
		}
		return await fetchImageAsDataURL(fullLogoUrl)
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
		if (!employee.id || !employee.fullName || !employee.personType) {
			throw new Error(
				'Missing required employee data: id, fullName, and personType are required',
			)
		}

		// Get branding configuration
		const branding = getBrandingConfig()

		// Fetch employee photo
		const photoDataURL = await getEmployeePhotoDataURL(employee.photoUrl)

		// Fetch school logo
		const logoDataURL = await getSchoolLogoDataURL(branding.logoUrl, request)

		// Generate QR code for back of card
		const qrCodeBuffer = await generateEmployeeQRCodeBuffer(
			employee.id,
			request,
		)
		const qrCodeDataURL = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`

		// Generate barcode for front of card
		const barcodeDataURL = await generateBarcodeDataURL(
			employee.sisEmployeeId,
			{
				width: 2,
				height: 40,
				format: 'CODE128',
				displayValue: false,
			},
		)

		// Get current academic year
		const academicYear = getCurrentAcademicYear()

		// Create PDF document
		const doc = (
			<Document>
				<IDCardFrontPDF
					employee={employee}
					photoDataURL={photoDataURL}
					logoDataURL={logoDataURL}
					branding={branding}
					academicYear={academicYear}
					barcodeDataURL={barcodeDataURL}
				/>
				<IDCardBackPDF qrCodeDataURL={qrCodeDataURL} branding={branding} logoDataURL={logoDataURL} />
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

/**
 * Internal type for prepared employee card data (with all assets loaded)
 */
interface PreparedEmployeeCard {
	employee: EmployeePDFData
	photoDataURL: string | null
	logoDataURL: string | null
	barcodeDataURL: string | null
	qrCodeDataURL: string
	branding: ReturnType<typeof getBrandingConfig>
	academicYear: string
}

/**
 * Prepares all assets needed for an employee ID card
 */
async function prepareEmployeeCard(
	employee: EmployeePDFData,
	request: Request,
): Promise<PreparedEmployeeCard> {
	const branding = getBrandingConfig()
	const photoDataURL = await getEmployeePhotoDataURL(employee.photoUrl)
	const logoDataURL = await getSchoolLogoDataURL(branding.logoUrl, request)

	// Use SIS ID for QR code (verification URL)
	const qrCodeBuffer = await generateEmployeeQRCodeBuffer(
		employee.sisEmployeeId,
		request,
	)
	const qrCodeDataURL = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`

	const barcodeDataURL = await generateBarcodeDataURL(employee.sisEmployeeId, {
		width: 2,
		height: 40,
		format: 'CODE128',
		displayValue: false,
	})

	const academicYear = getCurrentAcademicYear()

	return {
		employee,
		photoDataURL,
		logoDataURL,
		barcodeDataURL,
		qrCodeDataURL,
		branding,
		academicYear,
	}
}

/**
 * Cards per page configuration
 * Layout: 2 columns x 3 rows = 6 cards per page
 */
const CARDS_PER_PAGE = 6
const CARDS_PER_ROW = 2
const CARDS_PER_COLUMN = 3

// Standard US Letter: 612 x 792 points
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792

// Margins
const PAGE_MARGIN = 36 // 0.5 inch
const CARD_SPACING = 18 // 0.25 inch

// Calculate available space
const AVAILABLE_WIDTH = PAGE_WIDTH - 2 * PAGE_MARGIN
const AVAILABLE_HEIGHT = PAGE_HEIGHT - 2 * PAGE_MARGIN

// Calculate card positions
const CARD_AREA_WIDTH =
	(AVAILABLE_WIDTH - (CARDS_PER_ROW - 1) * CARD_SPACING) / CARDS_PER_ROW
const CARD_AREA_HEIGHT =
	(AVAILABLE_HEIGHT - (CARDS_PER_COLUMN - 1) * CARD_SPACING) / CARDS_PER_COLUMN

/**
 * Creates styles for bulk print layout
 */
function createBulkPrintStyles() {
	return StyleSheet.create({
		page: {
			padding: 0,
			fontFamily: 'Times-Roman',
		},
		cardContainer: {
			position: 'absolute',
			width: ID_WIDTH,
			height: ID_HEIGHT,
			// Cards will be positioned via left and top
		},
	})
}

/**
 * Generates a bulk PDF with multiple employee ID cards arranged per page
 * Prints card fronts and backs alternating: Page 1 (front), Page 2 (back), Page 3 (front), etc.
 *
 * @param employees - Array of employee data for ID cards
 * @param request - Request object to determine base URL for QR codes
 * @returns Promise resolving to PDF buffer
 * @throws Error if PDF generation fails
 */
export async function generateBulkEmployeeIDPDF(
	employees: EmployeePDFData[],
	request: Request,
): Promise<Buffer> {
	try {
		if (employees.length === 0) {
			throw new Error('No employees provided for bulk PDF generation')
		}

		// Validate all employees have required fields
		for (const employee of employees) {
			if (!employee.id || !employee.fullName || !employee.personType) {
				throw new Error(
					`Missing required employee data for ${employee.fullName || employee.id}: id, fullName, and personType are required`,
				)
			}
		}

		// Prepare all employee cards (load all assets in parallel)
		const preparedCards = await Promise.all(
			employees.map((employee) => prepareEmployeeCard(employee, request)),
		)

		const styles = createBulkPrintStyles()

		// Split cards into pages (6 per page) and create alternating front/back pages
		const pages: React.JSX.Element[] = []

		for (
			let pageIndex = 0;
			pageIndex * CARDS_PER_PAGE < preparedCards.length;
			pageIndex++
		) {
			const cardsOnThisPage = preparedCards.slice(
				pageIndex * CARDS_PER_PAGE,
				(pageIndex + 1) * CARDS_PER_PAGE,
			)

			// Create front page with cards
			const frontCardViews = cardsOnThisPage.map((prepared, cardIndex) => {
				const row = Math.floor(cardIndex / CARDS_PER_ROW)
				const col = cardIndex % CARDS_PER_ROW

				const left =
					PAGE_MARGIN +
					col * (CARD_AREA_WIDTH + CARD_SPACING) +
					(CARD_AREA_WIDTH - ID_WIDTH) / 2
				const top =
					PAGE_MARGIN +
					row * (CARD_AREA_HEIGHT + CARD_SPACING) +
					(CARD_AREA_HEIGHT - ID_HEIGHT) / 2

				return (
					<View
						key={`front-${prepared.employee.id}`}
						style={[styles.cardContainer, { left, top }]}
					>
						<IDCardFrontContentView
							employee={prepared.employee}
							photoDataURL={prepared.photoDataURL}
							logoDataURL={prepared.logoDataURL}
							branding={prepared.branding}
							academicYear={prepared.academicYear}
							barcodeDataURL={prepared.barcodeDataURL}
						/>
					</View>
				)
			})

			// Create back page with cards
			const backCardViews = cardsOnThisPage.map((prepared, cardIndex) => {
				const row = Math.floor(cardIndex / CARDS_PER_ROW)
				const col = cardIndex % CARDS_PER_ROW

				const left =
					PAGE_MARGIN +
					col * (CARD_AREA_WIDTH + CARD_SPACING) +
					(CARD_AREA_WIDTH - ID_WIDTH) / 2
				const top =
					PAGE_MARGIN +
					row * (CARD_AREA_HEIGHT + CARD_SPACING) +
					(CARD_AREA_HEIGHT - ID_HEIGHT) / 2

				return (
					<View
						key={`back-${prepared.employee.id}`}
						style={[styles.cardContainer, { left, top }]}
					>
						<IDCardBackContentView
							qrCodeDataURL={prepared.qrCodeDataURL}
							branding={prepared.branding}
							logoDataURL={prepared.logoDataURL}
						/>
					</View>
				)
			})

			// Add front page (odd pages: 1, 3, 5, ...)
			pages.push(
				<Page
					key={`front-page-${pageIndex}`}
					size={[PAGE_WIDTH, PAGE_HEIGHT]}
					style={styles.page}
				>
					{frontCardViews}
				</Page>,
			)

			// Add back page immediately after front (even pages: 2, 4, 6, ...)
			pages.push(
				<Page
					key={`back-page-${pageIndex}`}
					size={[PAGE_WIDTH, PAGE_HEIGHT]}
					style={styles.page}
				>
					{backCardViews}
				</Page>,
			)
		}

		// Create PDF document with alternating front/back pages
		const doc = <Document>{pages}</Document>

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
			`Failed to generate bulk PDF ID cards: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}
