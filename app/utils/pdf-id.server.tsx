import { Document, pdf, Page, View, Svg, Line, Text, StyleSheet } from '@react-pdf/renderer'
import { getBrandingConfig } from './branding.server.ts'
import { generateEmployeeQRCodeBuffer } from './qr-code.server.ts'
import { getSignedGetRequestInfo } from './storage.server.ts'
import { generateBarcodeDataURL } from './barcode.server.ts'
import { getCurrentAcademicYear } from './employee.server.ts'
import { getDomainUrl } from './misc.tsx'
import { registerFonts } from './fonts.server.ts'
import { getPDFDesign, PDF_CARD_WIDTH, PDF_CARD_HEIGHT } from './pdf-card-designs.tsx'
import type { PDFCardFrontProps, PDFCardBackProps } from './pdf-card-designs.tsx'
import {
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
 * Crop mark configuration following print industry best practices:
 * - 0.25pt stroke weight (hairline)
 * - 9pt (1/8") mark length
 * - 9pt (1/8") offset from the card edge to avoid interfering with bleed area
 * - Black color for visibility on any background
 */
const CROP_MARK_LENGTH = 9 // 1/8 inch
const CROP_MARK_OFFSET = 9 // 1/8 inch gap between card edge and mark
const CROP_MARK_STROKE = 0.25 // hairline weight
const CROP_MARK_COLOR = '#000000'

/**
 * Renders crop/cut marks at the four corners of a card.
 * Each corner has two perpendicular lines (horizontal + vertical)
 * offset from the card boundary so they don't overlap the card content.
 *
 * The SVG is absolutely positioned to cover the full area including marks.
 *
 * @param left - x position of the card's left edge on the page
 * @param top - y position of the card's top edge on the page
 * @param cardWidth - width of the card in points
 * @param cardHeight - height of the card in points
 */
function CropMarks({
	left,
	top,
	cardWidth,
	cardHeight,
}: {
	left: number
	top: number
	cardWidth: number
	cardHeight: number
}) {
	// Total SVG area extends beyond card by offset + mark length on each side
	const extend = CROP_MARK_OFFSET + CROP_MARK_LENGTH
	const svgWidth = cardWidth + 2 * extend
	const svgHeight = cardHeight + 2 * extend

	// Card corners relative to SVG origin
	const cLeft = extend
	const cRight = extend + cardWidth
	const cTop = extend
	const cBottom = extend + cardHeight

	// Each corner gets two perpendicular lines extending outward from the card edge
	// with a gap (CROP_MARK_OFFSET) so the marks don't touch the card.
	const marks = [
		// Top-left corner
		{ x1: cLeft - CROP_MARK_OFFSET - CROP_MARK_LENGTH, y1: cTop, x2: cLeft - CROP_MARK_OFFSET, y2: cTop }, // horizontal
		{ x1: cLeft, y1: cTop - CROP_MARK_OFFSET - CROP_MARK_LENGTH, x2: cLeft, y2: cTop - CROP_MARK_OFFSET }, // vertical

		// Top-right corner
		{ x1: cRight + CROP_MARK_OFFSET, y1: cTop, x2: cRight + CROP_MARK_OFFSET + CROP_MARK_LENGTH, y2: cTop },
		{ x1: cRight, y1: cTop - CROP_MARK_OFFSET - CROP_MARK_LENGTH, x2: cRight, y2: cTop - CROP_MARK_OFFSET },

		// Bottom-left corner
		{ x1: cLeft - CROP_MARK_OFFSET - CROP_MARK_LENGTH, y1: cBottom, x2: cLeft - CROP_MARK_OFFSET, y2: cBottom },
		{ x1: cLeft, y1: cBottom + CROP_MARK_OFFSET, x2: cLeft, y2: cBottom + CROP_MARK_OFFSET + CROP_MARK_LENGTH },

		// Bottom-right corner
		{ x1: cRight + CROP_MARK_OFFSET, y1: cBottom, x2: cRight + CROP_MARK_OFFSET + CROP_MARK_LENGTH, y2: cBottom },
		{ x1: cRight, y1: cBottom + CROP_MARK_OFFSET, x2: cRight, y2: cBottom + CROP_MARK_OFFSET + CROP_MARK_LENGTH },
	]

	return (
		<View
			style={{
				position: 'absolute',
				left: left - extend,
				top: top - extend,
				width: svgWidth,
				height: svgHeight,
			}}
		>
			<Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
				{marks.map((m, i) => (
					<Line
						key={i}
						x1={m.x1}
						y1={m.y1}
						x2={m.x2}
						y2={m.y2}
						stroke={CROP_MARK_COLOR}
						strokeWidth={CROP_MARK_STROKE}
					/>
				))}
			</Svg>
		</View>
	)
}

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
 * @param designId - Optional design ID (1-5). Defaults to active design or 3.
 * @returns Promise resolving to PDF buffer
 * @throws Error if PDF generation fails
 */
export async function generateEmployeeIDPDF(
	employee: EmployeePDFData,
	request: Request,
	designId?: number,
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

		// Get the design (default to Design 3 if not specified)
		const design = getPDFDesign(designId ?? 3)
		const cardWidth = PDF_CARD_WIDTH
		const cardHeight = PDF_CARD_HEIGHT

		// Single-card page size: card + space for crop marks on all sides
		const singleCardMargin = CROP_MARK_OFFSET + CROP_MARK_LENGTH + 18 // marks + extra padding
		const singlePageWidth = cardWidth + 2 * singleCardMargin
		const singlePageHeight = cardHeight + 2 * singleCardMargin
		const cardLeft = singleCardMargin
		const cardTop = singleCardMargin

		// Prepare props for the PDF design components
		const frontProps: PDFCardFrontProps = {
			fullName: employee.fullName,
			personType: employee.personType,
			sisId: employee.sisEmployeeId,
			academicYear,
			photoDataURL,
			logoDataURL,
			schoolName: branding.schoolName,
			branding,
		}

		const backProps: PDFCardBackProps = {
			qrCodeDataURL,
			logoDataURL,
			schoolName: branding.schoolName,
			branding,
		}

		// Create PDF document with crop marks around each card
		const doc = (
			<Document>
				<Page size={[singlePageWidth, singlePageHeight]} style={{ padding: 0, fontFamily: 'Times-Roman' }}>
					<View style={{ position: 'absolute', left: cardLeft, top: cardTop, width: cardWidth, height: cardHeight }}>
						<design.Front {...frontProps} />
					</View>
					<CropMarks left={cardLeft} top={cardTop} cardWidth={cardWidth} cardHeight={cardHeight} />
				</Page>
				<Page size={[singlePageWidth, singlePageHeight]} style={{ padding: 0, fontFamily: 'Times-Roman' }}>
					<View style={{ position: 'absolute', left: cardLeft, top: cardTop, width: cardWidth, height: cardHeight }}>
						<design.Back {...backProps} />
					</View>
					<CropMarks left={cardLeft} top={cardTop} cardWidth={cardWidth} cardHeight={cardHeight} />
				</Page>
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
 * Small header rendered in the top margin of each bulk-print page.
 * Uses absolute positioning so it doesn't affect card layout.
 */
function PageHeader({
	schoolName,
	label,
	printDate,
	pageNum,
	totalPages,
}: {
	schoolName: string
	label: string
	printDate: string
	pageNum: number
	totalPages: number
}) {
	return (
		<View
			style={{
				position: 'absolute',
				top: 12,
				left: PAGE_MARGIN,
				right: PAGE_MARGIN,
				flexDirection: 'row',
				justifyContent: 'space-between',
				alignItems: 'baseline',
			}}
		>
			<Text style={{ fontSize: 7, color: '#999999' }}>
				{schoolName} — {label}
			</Text>
			<Text style={{ fontSize: 7, color: '#999999' }}>
				Printed {printDate}  ·  Page {pageNum}/{totalPages}
			</Text>
		</View>
	)
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

		// Build page header info
		const branding = getBrandingConfig()
		const printDate = new Date().toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		})

		// Split cards into pages (6 per page) and create alternating front/back pages
		const pages: React.JSX.Element[] = []
		const totalSheets = Math.ceil(preparedCards.length / CARDS_PER_PAGE)
		const totalPages = totalSheets * 2 // front + back per sheet

		for (
			let pageIndex = 0;
			pageIndex * CARDS_PER_PAGE < preparedCards.length;
			pageIndex++
		) {
			const cardsOnThisPage = preparedCards.slice(
				pageIndex * CARDS_PER_PAGE,
				(pageIndex + 1) * CARDS_PER_PAGE,
			)

			// Create front page with cards and crop marks
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
					<View key={`front-${prepared.employee.id}`}>
						<View
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
						<CropMarks left={left} top={top} cardWidth={ID_WIDTH} cardHeight={ID_HEIGHT} />
					</View>
				)
			})

			// Create back page with cards and crop marks
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
					<View key={`back-${prepared.employee.id}`}>
						<View
							style={[styles.cardContainer, { left, top }]}
						>
							<IDCardBackContentView
								qrCodeDataURL={prepared.qrCodeDataURL}
								branding={prepared.branding}
								logoDataURL={prepared.logoDataURL}
							/>
						</View>
						<CropMarks left={left} top={top} cardWidth={ID_WIDTH} cardHeight={ID_HEIGHT} />
					</View>
				)
			})

			// Add front page (odd pages: 1, 3, 5, ...)
			const frontPageNum = pageIndex * 2 + 1
			pages.push(
				<Page
					key={`front-page-${pageIndex}`}
					size={[PAGE_WIDTH, PAGE_HEIGHT]}
					style={styles.page}
				>
					<PageHeader
						schoolName={branding.schoolName}
						label="ID Cards — Front"
						printDate={printDate}
						pageNum={frontPageNum}
						totalPages={totalPages}
					/>
					{frontCardViews}
				</Page>,
			)

			// Add back page immediately after front (even pages: 2, 4, 6, ...)
			const backPageNum = pageIndex * 2 + 2
			pages.push(
				<Page
					key={`back-page-${pageIndex}`}
					size={[PAGE_WIDTH, PAGE_HEIGHT]}
					style={styles.page}
				>
					<PageHeader
						schoolName={branding.schoolName}
						label="ID Cards — Back"
						printDate={printDate}
						pageNum={backPageNum}
						totalPages={totalPages}
					/>
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
