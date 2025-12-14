/**
 * Barcode generation utility for ID cards
 */

import * as JsBarcode from 'jsbarcode'
import { createCanvas } from 'canvas'

/**
 * Generates a 1D barcode (Code128 format) as a base64 data URL
 * @param value - The value to encode in the barcode
 * @param options - Optional barcode options
 * @returns Base64 data URL of the barcode image
 */
export async function generateBarcodeDataURL(
	value: string,
	options?: {
		width?: number
		height?: number
		format?: 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39'
		displayValue?: boolean
	},
): Promise<string> {
	const {
		width = 2,
		height = 60,
		format = 'CODE128',
		displayValue = true,
	} = options || {}

	// Create a canvas for barcode generation
	const canvas = createCanvas(200, height + (displayValue ? 20 : 0))

	// Generate the barcode
	JsBarcode(canvas, value, {
		format,
		width,
		height,
		displayValue,
		font: 'Arial',
		fontSize: 12,
		margin: 10,
	})

	// Convert canvas to buffer, then to base64 data URL
	const buffer = canvas.toBuffer('image/png')
	const base64 = buffer.toString('base64')
	return `data:image/png;base64,${base64}`
}

