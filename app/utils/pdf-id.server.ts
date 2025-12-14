import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { getBrandingConfig } from './branding.server.ts'
import { generateEmployeeQRCodeBuffer } from './qr-code.server.ts'
import { getSignedGetRequestInfo } from './storage.server.ts'
import { getDomainUrl } from './misc.tsx'

/**
 * Employee data required for PDF generation
 */
export interface EmployeePDFData {
	id: string
	fullName: string
	jobTitle: string
	email: string
	status: string
	sisEmployeeId: string
	photoUrl?: string | null
	expirationDate: Date
}

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

// Wallet-size ID card dimensions (in points, 1 point = 1/72 inch)
// Standard ID card: 3.375" x 2.125" = 243 points x 153 points
const ID_WIDTH = 243
const ID_HEIGHT = 153

// Create styles for the PDF
const styles = StyleSheet.create({
	page: {
		width: ID_WIDTH,
		height: ID_HEIGHT,
		padding: 0,
	},
	frontPage: {
		width: ID_WIDTH,
		height: ID_HEIGHT,
		backgroundColor: '#ffffff',
		padding: 12,
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	backPage: {
		width: ID_WIDTH,
		height: ID_HEIGHT,
		backgroundColor: '#ffffff',
		padding: 12,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	logoContainer: {
		width: 40,
		height: 40,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 4,
	},
	logo: {
		width: 40,
		height: 40,
		objectFit: 'contain',
	},
	photoContainer: {
		width: 80,
		height: 100,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#f0f0f0',
		borderRadius: 4,
		overflow: 'hidden',
	},
	photo: {
		width: 80,
		height: 100,
		objectFit: 'cover',
	},
	photoPlaceholder: {
		width: 80,
		height: 100,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#e0e0e0',
		borderRadius: 4,
	},
	infoContainer: {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		gap: 4,
	},
	schoolName: {
		fontSize: 10,
		fontWeight: 'bold',
		color: '#1a1a1a',
		marginBottom: 2,
	},
	name: {
		fontSize: 14,
		fontWeight: 'bold',
		color: '#1a1a1a',
		marginBottom: 2,
	},
	jobTitle: {
		fontSize: 10,
		color: '#666666',
		marginBottom: 4,
	},
	employeeId: {
		fontSize: 8,
		color: '#666666',
		marginBottom: 2,
	},
	expiration: {
		fontSize: 8,
		color: '#666666',
		marginTop: 'auto',
	},
	qrCodeContainer: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 120,
		height: 120,
	},
	qrCode: {
		width: 120,
		height: 120,
	},
	verificationText: {
		fontSize: 8,
		color: '#666666',
		textAlign: 'center',
		marginTop: 4,
	},
})

/**
 * React PDF component for ID card front
 */
function IDCardFront({
	employee,
	photoDataURL,
	logoDataURL,
	branding,
}: {
	employee: EmployeePDFData
	photoDataURL: string | null
	logoDataURL: string | null
	branding: ReturnType<typeof getBrandingConfig>
}) {
	return (
		<Page size={[ID_WIDTH, ID_HEIGHT]} style={styles.page}>
			<View style={styles.frontPage}>
				{/* Photo Section */}
				<View style={styles.photoContainer}>
					{photoDataURL ? (
						<Image src={photoDataURL} style={styles.photo} />
					) : (
						<View style={styles.photoPlaceholder}>
							<Text style={{ fontSize: 8, color: '#999999' }}>No Photo</Text>
						</View>
					)}
				</View>

				{/* Info Section */}
				<View style={styles.infoContainer}>
					{logoDataURL && (
						<View style={styles.logoContainer}>
							<Image src={logoDataURL} style={styles.logo} />
						</View>
					)}
					<Text style={styles.schoolName}>{branding.schoolName}</Text>
					<Text style={styles.name}>{employee.fullName}</Text>
					<Text style={styles.jobTitle}>{employee.jobTitle}</Text>
					<Text style={styles.employeeId}>ID: {employee.sisEmployeeId}</Text>
					<Text style={styles.expiration}>
						Expires: {format(employee.expirationDate, 'MM/dd/yyyy')}
					</Text>
				</View>
			</View>
		</Page>
	)
}

/**
 * React PDF component for ID card back
 */
function IDCardBack({
	qrCodeDataURL,
	branding,
}: {
	qrCodeDataURL: string
	branding: ReturnType<typeof getBrandingConfig>
}) {
	return (
		<Page size={[ID_WIDTH, ID_HEIGHT]} style={styles.page}>
			<View style={styles.backPage}>
				<View style={styles.qrCodeContainer}>
					<Image src={qrCodeDataURL} style={styles.qrCode} />
				</View>
				<Text style={styles.verificationText}>
					Scan to verify employee status
				</Text>
				<Text style={styles.schoolName}>{branding.schoolName}</Text>
			</View>
		</Page>
	)
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
				<IDCardFront
					employee={employee}
					photoDataURL={photoDataURL}
					logoDataURL={logoDataURL}
					branding={branding}
				/>
				<IDCardBack qrCodeDataURL={qrCodeDataURL} branding={branding} />
			</Document>
		)

		// Generate PDF buffer
		const pdfBuffer = await pdf(doc).toBuffer()

		return pdfBuffer
	} catch (error) {
		throw new Error(
			`Failed to generate PDF ID card for employee ${employee.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}

