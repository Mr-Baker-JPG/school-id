/**
 * Font family constants for ID cards
 * 
 * Used by both client (preview) and server (PDF generation) components.
 * 
 * PDF Generation:
 * - Trajan Pro Bold: Registered via fonts.server.ts
 * - Garamond: Registered via fonts.server.ts
 * 
 * Preview (browser):
 * - Falls back to system fonts via CSS font-family stack
 */

/**
 * Font family names for use in styles
 */
export const FontFamilies = {
	// Trajan Pro Bold for titles/names (classical Roman style)
	// In PDF: 'TrajanPro' (registered custom font)
	// In browser: Falls back to Georgia/serif
	TRAJAN: 'TrajanPro',
	
	// Garamond for body text (elegant serif)
	// In PDF: 'Garamond' (registered custom font)
	// In browser: Falls back to Garamond system fonts
	GARAMOND: 'Garamond',
	
	// Fallback fonts (built-in to @react-pdf/renderer)
	HELVETICA: 'Helvetica',
	HELVETICA_BOLD: 'Helvetica-Bold',
	TIMES: 'Times-Roman',
	TIMES_BOLD: 'Times-Bold',
} as const

/**
 * CSS font-family stacks for browser preview
 * Falls back gracefully if custom fonts aren't available
 */
export const CSSFontStacks = {
	// Trajan Pro alternatives: classical Roman inscription style
	TRAJAN: `'TrajanPro', 'Cinzel', Georgia, 'Times New Roman', serif`,
	
	// Garamond alternatives: elegant 16th-century serif
	GARAMOND: `Garamond, 'EB Garamond', 'Cormorant Garamond', Georgia, serif`,
	
	// Sans-serif for labels and badges
	HELVETICA: `system-ui, -apple-system, 'Helvetica Neue', sans-serif`,
} as const
