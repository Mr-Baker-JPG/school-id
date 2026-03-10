/**
 * Font Registration for PDF Generation (Server-Only)
 * 
 * Registers Trajan Pro Bold and Garamond fonts for use with @react-pdf/renderer.
 * Fonts are stored in public/fonts/ and loaded at runtime.
 * 
 * This file must only be imported by server-side code (files ending in .server.ts/.server.tsx)
 */

import { Font } from '@react-pdf/renderer'
import path from 'path'
import { fileURLToPath } from 'url'

// Font file paths (relative to this file)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = path.join(__dirname, '..', '..', 'public', 'fonts')

// Track if fonts have been registered to avoid duplicate registration
let fontsRegistered = false

/**
 * Register custom fonts for PDF generation
 * 
 * Font usage:
 * - Trajan Pro Bold: Names, titles, prominent text (classical Roman inscription style)
 * - Garamond: Body text, addresses, motto (elegant 16th-century serif)
 */
export function registerFonts(): void {
	if (fontsRegistered) return

	try {
		// Register Trajan Pro Bold for titles/names
		Font.register({
			family: 'TrajanPro',
			src: path.join(FONTS_DIR, 'TrajanPro-Bold.otf'),
			fontWeight: 700,
		})

		// Register Garamond for body text
		Font.register({
			family: 'Garamond',
			src: path.join(FONTS_DIR, 'Garamond-Regular.ttf'),
			fontWeight: 400,
		})

		fontsRegistered = true
	} catch (error) {
		console.warn('Failed to register custom fonts, falling back to defaults:', error)
	}
}
