/**
 * Wallet Pass Generation Service
 *
 * Generates Apple Wallet (.pkpass) and Google Pay passes for employee IDs
 *
 * Note: Apple Wallet passes require Apple Developer certificates for signing.
 * Configure APPLE_WALLET_* environment variables for production use.
 */

import { PKPass } from 'passkit-generator'
import { type EmployeePDFData } from '#app/components/employee-id-card.tsx'
import { getDomainUrl, getFirstAndLastName } from './misc.tsx'
import { generateEmployeeQRCodeBuffer } from './qr-code.server.ts'
import { getSignedGetRequestInfo } from './storage.server.ts'

/**
 * Fetches an image and returns it as a Buffer
 */
async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
	try {
		const response = await fetch(url)
		if (!response.ok) {
			return null
		}
		const arrayBuffer = await response.arrayBuffer()
		return Buffer.from(arrayBuffer)
	} catch (error) {
		console.warn(
			`Error fetching image from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}
}

/**
 * Gets the employee photo as a Buffer
 * Returns null if no photo is available
 */
async function getEmployeePhotoBuffer(
	photoUrl: string | null | undefined,
): Promise<Buffer | null> {
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
		return Buffer.from(arrayBuffer)
	} catch (error) {
		console.warn(
			`Error fetching employee photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}
}

/**
 * Gets the school logo as a Buffer
 * Returns null if no logo is configured
 * Handles both absolute URLs and relative paths (converts relative paths to full URLs)
 */
async function getSchoolLogoBuffer(
	logoUrl: string | undefined,
	request: Request,
): Promise<Buffer | null> {
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
		return await fetchImageAsBuffer(fullLogoUrl)
	} catch (error) {
		console.warn(
			`Error fetching school logo: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}
}

/**
 * Gets Apple Wallet certificates from environment variables
 * Returns null if certificates are not configured
 */
function getAppleWalletCertificates(): {
	wwdr: Buffer
	signerCert: Buffer
	signerKey: Buffer | string
	signerKeyPassphrase?: string
} | null {
	const wwdrCert = process.env.APPLE_WALLET_WWDR_CERT
	const signerCert = process.env.APPLE_WALLET_SIGNER_CERT
	const signerKey = process.env.APPLE_WALLET_SIGNER_KEY
	const signerKeyPassphrase = process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE

	if (!wwdrCert || !signerCert || !signerKey) {
		return null
	}

	return {
		wwdr: Buffer.from(wwdrCert, 'base64'),
		signerCert: Buffer.from(signerCert, 'base64'),
		signerKey: Buffer.from(signerKey, 'base64'),
		signerKeyPassphrase,
	}
}

/**
 * Generates an Apple Wallet pass (.pkpass) for an employee
 *
 * Note: This requires Apple Developer certificates for signing.
 * Configure APPLE_WALLET_* environment variables for production use.
 *
 * @param employee - Employee data for the pass
 * @param request - Request object to determine base URL for QR code
 * @returns Promise resolving to .pkpass file as Buffer
 * @throws Error if pass generation fails or certificates are missing
 */
export async function generateAppleWalletPass(
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
		const { getBrandingConfig } = await import('./branding.server.ts')
		const branding = getBrandingConfig()

		// Get certificates
		const certificates = getAppleWalletCertificates()
		if (!certificates) {
			throw new Error(
				'Apple Wallet certificates not configured. Please set APPLE_WALLET_WWDR_CERT, APPLE_WALLET_SIGNER_CERT, and APPLE_WALLET_SIGNER_KEY environment variables.',
			)
		}

		// Get pass type identifier and team identifier from environment
		const passTypeIdentifier =
			process.env.APPLE_WALLET_PASS_TYPE_IDENTIFIER ||
			'pass.com.school.employeeid'
		const teamIdentifier = process.env.APPLE_WALLET_TEAM_IDENTIFIER || 'TEAM_ID'

		// Fetch employee photo
		const photoBuffer = await getEmployeePhotoBuffer(employee.photoUrl)

		// Fetch school logo
		const logoBuffer = await getSchoolLogoBuffer(branding.logoUrl, request)

		// Generate QR code
		const qrCodeBuffer = await generateEmployeeQRCodeBuffer(
			employee.id,
			request,
		)

		// Get verification URL
		const baseUrl = getDomainUrl(request)
		const verificationUrl = `${baseUrl}/verify/${employee.id}`

		// Format expiration date (ISO 8601 format)
		const expirationDate = employee.expirationDate
			.toISOString()
			.replace(/\.\d{3}Z$/, 'Z')

		// Get first and last name only
		const displayName = getFirstAndLastName(employee.fullName)

		// Create pass data structure
		const passData = {
			description: `Employee ID for ${displayName}`,
			formatVersion: 1,
			organizationName: branding.schoolName,
			passTypeIdentifier,
			serialNumber: employee.sisEmployeeId || employee.id,
			teamIdentifier,
			backgroundColor: branding.secondaryColor,
			foregroundColor: branding.primaryColor,
			labelColor: branding.primaryColor,
			logoText: branding.schoolName,
			generic: {
				primaryFields: [
					{
						key: 'name',
						label: 'Name',
						value: displayName,
					},
				],
				secondaryFields: [
					{
						key: 'jobTitle',
						label: 'Job Title',
						value: employee.jobTitle,
					},
					{
						key: 'employeeId',
						label: 'Employee ID',
						value: employee.sisEmployeeId || employee.id,
					},
				],
				auxiliaryFields: [
					{
						key: 'expiration',
						label: 'Expires',
						value: expirationDate,
						dateStyle: 'PKDateStyleShort',
					},
				],
				barcode: {
					message: verificationUrl,
					format: 'PKBarcodeFormatQR',
					messageEncoding: 'iso-8859-1',
				},
			},
		}

		// Create pass.json buffer
		const passJsonBuffer = Buffer.from(JSON.stringify(passData, null, 2))

		// Build buffers object for PKPass constructor
		const buffers: Record<string, Buffer> = {
			'pass.json': passJsonBuffer,
		}

		// Add images if available
		if (photoBuffer) {
			buffers['photo.png'] = photoBuffer
		}
		if (logoBuffer) {
			buffers['logo.png'] = logoBuffer
			// Use logo as icon if available (icon is required for Apple Wallet)
			buffers['icon.png'] = logoBuffer
		}
		// Add QR code as strip image
		buffers['strip.png'] = qrCodeBuffer

		// Create PKPass instance with buffers and certificates
		const pass = new PKPass(buffers, certificates)

		// Generate and return the .pkpass buffer
		return pass.getAsBuffer()
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message.includes('certificates') ||
				error.message.includes('not configured'))
		) {
			throw error
		}
		throw new Error(
			`Failed to generate Apple Wallet pass for employee ${employee.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}

/**
 * Generates a Google Pay pass (JSON format) for an employee
 *
 * Note: Google Pay passes are typically created through Google's Wallet API.
 * This function generates a JSON file that follows Google Wallet's format,
 * but it may need to be uploaded via Google's API for full functionality.
 *
 * @param employee - Employee data for the pass
 * @param request - Request object to determine base URL for QR code
 * @returns Promise resolving to JSON string
 * @throws Error if pass generation fails
 */
export async function generateGooglePayPass(
	employee: EmployeePDFData,
	request: Request,
): Promise<string> {
	try {
		// Validate required fields
		if (!employee.id || !employee.fullName || !employee.jobTitle) {
			throw new Error(
				'Missing required employee data: id, fullName, and jobTitle are required',
			)
		}

		// Get branding configuration
		const { getBrandingConfig } = await import('./branding.server.ts')
		const branding = getBrandingConfig()

		// Get verification URL
		const baseUrl = getDomainUrl(request)
		const verificationUrl = `${baseUrl}/verify/${employee.id}`

		// Create Google Wallet pass object
		// This follows Google Wallet's Generic Object format
		const passObject = {
			issuerId: 'ISSUER_ID', // Replace with your Google Wallet Issuer ID
			classId: `${branding.schoolName.replace(/\s+/g, '_').toLowerCase()}_employee_id_class`,
			objectId: `employee_${employee.sisEmployeeId || employee.id}`,
			genericObject: {
				classId: `${branding.schoolName.replace(/\s+/g, '_').toLowerCase()}_employee_id_class`,
				id: `employee_${employee.sisEmployeeId || employee.id}`,
				state: 'ACTIVE',
				barcode: {
					type: 'QR_CODE',
					value: verificationUrl,
					alternateText: verificationUrl,
				},
				cardTitle: {
					defaultValue: {
						language: 'en-US',
						value: getFirstAndLastName(employee.fullName),
					},
				},
				subheader: {
					defaultValue: {
						language: 'en-US',
						value: employee.jobTitle,
					},
				},
				header: {
					defaultValue: {
						language: 'en-US',
						value: branding.schoolName,
					},
				},
				textModulesData: [
					{
						header: 'Employee ID',
						body: employee.sisEmployeeId || employee.id,
						id: 'employee_id',
					},
					{
						header: 'Expiration Date',
						body: new Date(employee.expirationDate).toLocaleDateString(),
						id: 'expiration',
					},
				],
				imageModulesData: employee.photoUrl
					? [
							{
								mainImage: {
									sourceUri: {
										uri: `${baseUrl}/resources/images/${employee.photoUrl}`,
									},
									contentDescription: {
										defaultValue: {
											language: 'en-US',
											value: `Photo of ${employee.fullName}`,
										},
									},
								},
								id: 'photo',
							},
						]
					: [],
				hexBackgroundColor: branding.secondaryColor.replace('#', ''),
			},
		}

		return JSON.stringify(passObject, null, 2)
	} catch (error) {
		throw new Error(
			`Failed to generate Google Pay pass for employee ${employee.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}
