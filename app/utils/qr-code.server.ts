import * as QRCode from 'qrcode'
import { getDomainUrl } from './misc.tsx'

/**
 * Options for QR code generation
 */
export interface QRCodeOptions {
	/**
	 * Error correction level. Higher levels allow more damage but increase QR code size.
	 * Default: 'M' (medium, ~15% error correction)
	 */
	errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
	/**
	 * QR code size in pixels. Default: 200
	 */
	size?: number
	/**
	 * Margin in QR code modules. Default: 4
	 */
	margin?: number
}

/**
 * Generates a QR code for an employee ID verification URL.
 * The QR code links to the public verification page: /verify/:employeeId
 *
 * @param employeeId - The employee ID (Employee.id from database)
 * @param request - The request object to determine the base URL
 * @param options - Optional QR code generation options
 * @returns Promise resolving to base64 data URL (e.g., "data:image/png;base64,...")
 * @throws Error if employeeId is invalid or QR code generation fails
 */
export async function generateEmployeeQRCodeDataURL(
	employeeId: string,
	request: Request,
	options?: QRCodeOptions,
): Promise<string> {
	if (
		!employeeId ||
		typeof employeeId !== 'string' ||
		employeeId.trim().length === 0
	) {
		throw new Error(
			'Invalid employee ID: employeeId must be a non-empty string',
		)
	}

	const baseUrl = getDomainUrl(request)
	const verificationUrl = `${baseUrl}/verify/${employeeId}`

	const qrOptions: QRCode.QRCodeToDataURLOptions = {
		errorCorrectionLevel: options?.errorCorrectionLevel ?? 'M',
		type: 'image/png',
		width: options?.size ?? 200,
		margin: options?.margin ?? 4,
	}

	try {
		return await QRCode.toDataURL(verificationUrl, qrOptions)
	} catch (error) {
		throw new Error(
			`Failed to generate QR code for employee ID ${employeeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}

/**
 * Generates a QR code buffer for an employee ID verification URL.
 * Useful for PDF generation or direct binary handling.
 *
 * @param employeeId - The employee ID (Employee.id from database)
 * @param request - The request object to determine the base URL
 * @param options - Optional QR code generation options
 * @returns Promise resolving to Buffer containing PNG image data
 * @throws Error if employeeId is invalid or QR code generation fails
 */
export async function generateEmployeeQRCodeBuffer(
	employeeId: string,
	request: Request,
	options?: QRCodeOptions,
): Promise<Buffer> {
	if (
		!employeeId ||
		typeof employeeId !== 'string' ||
		employeeId.trim().length === 0
	) {
		throw new Error(
			'Invalid employee ID: employeeId must be a non-empty string',
		)
	}

	const baseUrl = getDomainUrl(request)
	const verificationUrl = `${baseUrl}/verify/${employeeId}`

	const qrOptions: QRCode.QRCodeToBufferOptions = {
		errorCorrectionLevel: options?.errorCorrectionLevel ?? 'M',
		type: 'png',
		width: options?.size ?? 200,
		margin: options?.margin ?? 4,
	}

	try {
		return await QRCode.toBuffer(verificationUrl, qrOptions)
	} catch (error) {
		throw new Error(
			`Failed to generate QR code buffer for employee ID ${employeeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}
