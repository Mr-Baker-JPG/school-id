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
import fs from 'fs'

// Font file paths (relative to this file)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Find the fonts directory in development or production
 * In development: /app/public/fonts
 * In production: could be at multiple locations depending on build
 */
function findFontsDir(): string | null {
	const possiblePaths = [
		// Development: relative to source
		path.join(__dirname, '..', '..', 'public', 'fonts'),
		// Production: relative to server-build
		path.join(__dirname, '..', '..', '..', 'public', 'fonts'),
		// Production: in build/client
		path.join(__dirname, '..', '..', '..', 'build', 'client', 'fonts'),
		// Production: at root
		path.join('/', 'myapp', 'public', 'fonts'),
		path.join('/', 'myapp', 'build', 'client', 'fonts'),
	]

	for (const fontPath of possiblePaths) {
		if (fs.existsSync(fontPath)) {
			console.log(`[Fonts] Found fonts directory at: ${fontPath}`)
			return fontPath
		}
	}

	console.warn('[Fonts] Could not find fonts directory in any of the expected locations')
	return null
}

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
		const FONTS_DIR = findFontsDir()
		
		if (!FONTS_DIR) {
			console.warn('Fonts directory not found, PDF generation will use fallback fonts')
			fontsRegistered = true
			return
		}

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
		console.log('[Fonts] Successfully registered custom fonts')
	} catch (error) {
		console.warn('Failed to register custom fonts, falling back to defaults:', error)
	}
}
