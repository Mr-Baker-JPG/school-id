/**
 * PDF Card Design Components
 *
 * React PDF versions of all 12 ID card designs for PDF generation.
 * Each design has Front and Back components that use @react-pdf/renderer primitives.
 */

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { type BrandingConfig } from './branding.server.ts'
import { FontFamilies } from './font-families.ts'
import { getFirstAndLastName } from './misc.tsx'

// Design constants
const NAVY = '#1B2A4A'
const MAROON = '#8B1A2B'
const CREAM = '#F5F0E8'

// Standard ID card dimensions (wallet size)
export const PDF_CARD_WIDTH = 243
export const PDF_CARD_HEIGHT = 153

// School contact info (shared across all designs)
const SCHOOL_ADDRESS_LINE1 = '1522 Carmel Dr.'
const SCHOOL_ADDRESS_LINE2 = 'Lafayette, LA 70501'
const SCHOOL_PHONE = '337-889-5345'

/**
 * Props for PDF card front components
 */
export interface PDFCardFrontProps {
	fullName: string
	personType: string
	sisId: string
	academicYear: string
	photoDataURL: string | null
	logoDataURL: string | null
	schoolName: string
	branding: BrandingConfig
}

/**
 * Props for PDF card back components
 */
export interface PDFCardBackProps {
	qrCodeDataURL: string
	logoDataURL: string | null
	schoolName: string
	branding: BrandingConfig
}

/**
 * Shared styles helper
 */
function createStyles() {
	return StyleSheet.create({
		// Common elements
		photoFrame: {
			width: 54,
			height: 68,
			borderWidth: 1.5,
			borderColor: NAVY,
			borderRadius: 3,
			overflow: 'hidden',
		},
		photo: {
			width: 54,
			height: 68,
			objectFit: 'cover',
		},
		photoPlaceholder: {
			width: 54,
			height: 68,
			backgroundColor: '#e5e5e5',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		},
		logo: {
			width: 24,
			height: 24,
			objectFit: 'contain',
		},
		logoSmall: {
			width: 18,
			height: 18,
			objectFit: 'contain',
		},
		logoLarge: {
			width: 140,
			height: 140,
			objectFit: 'contain',
		},
		watermark: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			opacity: 0.04,
		},
	})
}

/* ================================================================
 * DESIGN 1: "Classic Band" — Navy top/bottom bands, cream body
 * ================================================================ */
export function PDFDesign1Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: CREAM, overflow: 'hidden', position: 'relative' }}>
			{/* Watermark */}
			{props.logoDataURL && (
				<View style={styles.watermark} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			{/* Navy top band */}
			<View style={{ backgroundColor: NAVY, height: 40, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 }}>
				{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 24, height: 24, objectFit: 'contain' }} />}
				<Text style={{ color: '#fff', fontSize: 8, fontFamily: FontFamilies.GARAMOND, letterSpacing: 1.5 }}>{props.schoolName.toUpperCase()}</Text>
			</View>
			{/* Maroon stripe */}
			<View style={{ height: 3, backgroundColor: MAROON }} />
			{/* Body */}
			<View style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '6 12 4' }}>
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
					<Text style={{ fontSize: 12, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.2 }}>{name}</Text>
					<View style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 3 }}>
						<Text style={{ fontSize: 6, color: MAROON, fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 1 }}>{props.personType}</Text>
						<Text style={{ fontSize: 6, color: '#888', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
					</View>
				</View>
				<View style={{ display: 'flex', alignItems: 'center', marginLeft: 10 }}>
					<View style={styles.photoFrame}>
						{props.photoDataURL ? (
							<Image src={props.photoDataURL} style={styles.photo} />
						) : (
							<View style={styles.photoPlaceholder}>
								<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
							</View>
						)}
					</View>
				</View>
			</View>
			{/* Navy bottom band */}
			<View style={{ backgroundColor: NAVY, height: 20, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
				<Text style={{ fontSize: 6, color: '#ccc', fontFamily: FontFamilies.HELVETICA }}>ID: {props.sisId}</Text>
				<Text style={{ fontSize: 5, color: '#999', fontFamily: FontFamilies.GARAMOND }}>Ad Majorem Dei Gloriam</Text>
			</View>
		</View>
	)
}

export function PDFDesign1Back(props: PDFCardBackProps) {
	const styles = createStyles()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: CREAM, overflow: 'hidden', position: 'relative' }}>
			{/* Watermark */}
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.03 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			{/* Maroon top stripe */}
			<View style={{ height: 3, backgroundColor: MAROON }} />
			{/* Body */}
			<View style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '10 14', alignItems: 'center', gap: 12 }}>
				{/* QR */}
				<View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<Image src={props.qrCodeDataURL} style={{ width: 65, height: 65 }} />
					<Text style={{ fontSize: 5, color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD, marginTop: 2, letterSpacing: 0.5 }}>VERIFY ID</Text>
				</View>
				{/* Info */}
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
					<Text style={{ fontSize: 7, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN }}>{props.schoolName}</Text>
					<Text style={{ fontSize: 5.5, color: '#555', fontFamily: FontFamilies.GARAMOND, lineHeight: 1.5 }}>
						{SCHOOL_ADDRESS_LINE1}{'\n'}{SCHOOL_ADDRESS_LINE2}{'\n'}{SCHOOL_PHONE}
					</Text>
					<Text style={{ fontSize: 5.5, color: MAROON, fontFamily: FontFamilies.GARAMOND, marginTop: 2 }}>Ad Majorem Dei Gloriam</Text>
					<Text style={{ fontSize: 4.5, color: '#aaa', fontFamily: FontFamilies.HELVETICA, marginTop: 1 }}>If found, please return to the school office.</Text>
				</View>
			</View>
			{/* Navy bottom stripe */}
			<View style={{ height: 3, backgroundColor: NAVY }} />
		</View>
	)
}

/* ================================================================
 * DESIGN 2: "Full-Height Photo" — Photo spans right edge
 * ================================================================ */
export function PDFDesign2Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden' }}>
			<View style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
				{/* Left content */}
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10 10 8', backgroundColor: CREAM }}>
					{/* Header */}
					<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
						{props.logoDataURL && <Image src={props.logoDataURL} style={styles.logoSmall} />}
						<Text style={{ fontSize: 6.5, fontFamily: FontFamilies.GARAMOND, color: NAVY, letterSpacing: 0.8 }}>{props.schoolName.toUpperCase()}</Text>
					</View>
					{/* Name and info at bottom */}
					<View style={{ marginTop: 'auto' }}>
						<Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.2 }}>{name}</Text>
						<View style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 3 }}>
							<View style={{ backgroundColor: MAROON, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 1.5 }}>
								<Text style={{ fontSize: 6, color: '#fff', fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 0.8 }}>{props.personType}</Text>
							</View>
							<Text style={{ fontSize: 6, color: '#777', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
						</View>
					</View>
					{/* ID at very bottom */}
					<View style={{ marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: `${NAVY}33` }}>
						<Text style={{ fontSize: 5, color: '#888', fontFamily: FontFamilies.HELVETICA }}>ID NUMBER</Text>
						<Text style={{ fontSize: 9, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.sisId}</Text>
					</View>
				</View>
				{/* Right: full-height photo */}
				<View style={{ width: 75, backgroundColor: '#e5e5e5', borderLeftWidth: 2, borderLeftColor: MAROON }}>
					{props.photoDataURL ? (
						<Image src={props.photoDataURL} style={{ width: 75, height: '100%', objectFit: 'cover' }} />
					) : (
						<View style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
							<Text style={{ fontSize: 7, color: '#999' }}>No Photo</Text>
						</View>
					)}
				</View>
			</View>
		</View>
	)
}

export function PDFDesign2Back(props: PDFCardBackProps) {
	const styles = createStyles()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' }}>
			{/* Watermark */}
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.025 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			<View style={{ height: 3, backgroundColor: MAROON }} />
			<View style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '10 14', alignItems: 'center', gap: 12 }}>
				<View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<Image src={props.qrCodeDataURL} style={{ width: 65, height: 65 }} />
					<Text style={{ fontSize: 5, color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD, marginTop: 2, letterSpacing: 0.5 }}>VERIFY ID</Text>
				</View>
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
					<Text style={{ fontSize: 7, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN }}>{props.schoolName}</Text>
					<Text style={{ fontSize: 5.5, color: '#555', fontFamily: FontFamilies.GARAMOND, lineHeight: 1.5 }}>
						{SCHOOL_ADDRESS_LINE1}{'\n'}{SCHOOL_ADDRESS_LINE2}{'\n'}{SCHOOL_PHONE}
					</Text>
					<Text style={{ fontSize: 5.5, color: MAROON, fontFamily: FontFamilies.GARAMOND, marginTop: 2 }}>Ad Majorem Dei Gloriam</Text>
					<Text style={{ fontSize: 4.5, color: '#aaa', fontFamily: FontFamilies.HELVETICA, marginTop: 1 }}>If found, please return to the school office.</Text>
				</View>
			</View>
			<View style={{ height: 3, backgroundColor: MAROON }} />
		</View>
	)
}

/* ================================================================
 * DESIGN 3: "Light Executive" — Design 4 layout, Design 5 colors
 * ================================================================ */
export function PDFDesign3Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' }}>
			{/* Watermark */}
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.025 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			{/* Maroon top stripe */}
			<View style={{ height: 3, backgroundColor: MAROON }} />
			{/* Body */}
			<View style={{ display: 'flex', flexDirection: 'row', height: 'calc(100% - 3px)' }}>
				{/* Left: Photo */}
				<View style={{ display: 'flex', alignItems: 'center', padding: '10 0 10 10' }}>
					<View style={styles.photoFrame}>
						{props.photoDataURL ? (
							<Image src={props.photoDataURL} style={styles.photo} />
						) : (
							<View style={styles.photoPlaceholder}>
								<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
							</View>
						)}
					</View>
				</View>
				{/* Right: Info */}
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10 10 8 10', justifyContent: 'space-between' }}>
					<View>
						<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
							{props.logoDataURL && <Image src={props.logoDataURL} style={styles.logoSmall} />}
							<Text style={{ fontSize: 5.5, color: '#888', fontFamily: FontFamilies.GARAMOND, letterSpacing: 1 }}>{props.schoolName.toUpperCase()}</Text>
						</View>
						<View style={{ height: 0.75, backgroundColor: MAROON, marginTop: 6, marginBottom: 6 }} />
						<Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.2 }}>{name}</Text>
						<View style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 3 }}>
							<View style={{ backgroundColor: MAROON, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 1.5 }}>
								<Text style={{ fontSize: 6, color: '#fff', fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 0.8 }}>{props.personType}</Text>
							</View>
							<Text style={{ fontSize: 6, color: '#888', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
						</View>
					</View>
					<View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
						<View>
							<Text style={{ fontSize: 5, color: '#aaa', fontFamily: FontFamilies.HELVETICA }}>ID NUMBER</Text>
							<Text style={{ fontSize: 8, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.sisId}</Text>
						</View>
						<Text style={{ fontSize: 4.5, color: '#bbb', fontFamily: FontFamilies.GARAMOND }}>AMDG</Text>
					</View>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign3Back(props: PDFCardBackProps) {
	const styles = createStyles()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' }}>
			{/* Watermark */}
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.025 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			<View style={{ height: 3, backgroundColor: MAROON }} />
			<View style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '10 14', alignItems: 'center', gap: 12 }}>
				<View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<Image src={props.qrCodeDataURL} style={{ width: 65, height: 65 }} />
					<Text style={{ fontSize: 5, color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD, marginTop: 2, letterSpacing: 0.5 }}>VERIFY ID</Text>
				</View>
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
					<Text style={{ fontSize: 7, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN }}>{props.schoolName}</Text>
					<Text style={{ fontSize: 5.5, color: '#555', fontFamily: FontFamilies.GARAMOND, lineHeight: 1.5 }}>
						{SCHOOL_ADDRESS_LINE1}{'\n'}{SCHOOL_ADDRESS_LINE2}{'\n'}{SCHOOL_PHONE}
					</Text>
					<Text style={{ fontSize: 5.5, color: MAROON, fontFamily: FontFamilies.GARAMOND, marginTop: 2 }}>Ad Majorem Dei Gloriam</Text>
					<Text style={{ fontSize: 4.5, color: '#aaa', fontFamily: FontFamilies.HELVETICA, marginTop: 1 }}>If found, please return to the school office.</Text>
				</View>
			</View>
			<View style={{ height: 3, backgroundColor: MAROON }} />
		</View>
	)
}

/* ================================================================
 * DESIGN 4: "Dark Executive" — Navy card, white/gold text
 * ================================================================ */
export function PDFDesign4Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: NAVY, overflow: 'hidden', position: 'relative' }}>
			{/* Watermark */}
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.06 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			<View style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
				{/* Left: Photo */}
				<View style={{ display: 'flex', alignItems: 'center', padding: '10 0 10 10' }}>
					<View style={{ ...styles.photoFrame, borderColor: '#ffffff44' }}>
						{props.photoDataURL ? (
							<Image src={props.photoDataURL} style={styles.photo} />
						) : (
							<View style={styles.photoPlaceholder}>
								<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
							</View>
						)}
					</View>
				</View>
				{/* Right: Info */}
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10 10 8 10', justifyContent: 'space-between' }}>
					<View>
						<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
							{props.logoDataURL && <Image src={props.logoDataURL} style={styles.logoSmall} />}
							<Text style={{ fontSize: 5.5, color: '#ccc', fontFamily: FontFamilies.GARAMOND, letterSpacing: 1 }}>{props.schoolName.toUpperCase()}</Text>
						</View>
						<View style={{ height: 0.75, backgroundColor: MAROON, marginTop: 6, marginBottom: 6 }} />
						<Text style={{ fontSize: 11, fontWeight: 'bold', color: '#fff', fontFamily: FontFamilies.TRAJAN, lineHeight: 1.2 }}>{name}</Text>
						<View style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 3 }}>
							<View style={{ backgroundColor: MAROON, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 1.5 }}>
								<Text style={{ fontSize: 6, color: CREAM, fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 0.8 }}>{props.personType}</Text>
							</View>
							<Text style={{ fontSize: 6, color: '#999', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
						</View>
					</View>
					<View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
						<View>
							<Text style={{ fontSize: 5, color: '#888', fontFamily: FontFamilies.HELVETICA }}>ID NUMBER</Text>
							<Text style={{ fontSize: 8, fontWeight: 'bold', color: '#fff', fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.sisId}</Text>
						</View>
						<Text style={{ fontSize: 4.5, color: '#666', fontFamily: FontFamilies.GARAMOND }}>AMDG</Text>
					</View>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign4Back(props: PDFCardBackProps) {
	const styles = createStyles()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: NAVY, overflow: 'hidden', position: 'relative' }}>
			{/* Watermark */}
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.06 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			<View style={{ height: 3, backgroundColor: MAROON }} />
			<View style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '10 14', alignItems: 'center', gap: 12 }}>
				<View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<Image src={props.qrCodeDataURL} style={{ width: 65, height: 65 }} />
					<Text style={{ fontSize: 5, color: '#ccc', fontFamily: FontFamilies.HELVETICA_BOLD, marginTop: 2, letterSpacing: 0.5 }}>VERIFY ID</Text>
				</View>
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
					<Text style={{ fontSize: 7, fontWeight: 'bold', color: '#fff', fontFamily: FontFamilies.TRAJAN }}>{props.schoolName}</Text>
					<Text style={{ fontSize: 5.5, color: '#ccc', fontFamily: FontFamilies.GARAMOND, lineHeight: 1.5 }}>
						{SCHOOL_ADDRESS_LINE1}{'\n'}{SCHOOL_ADDRESS_LINE2}{'\n'}{SCHOOL_PHONE}
					</Text>
					<Text style={{ fontSize: 5.5, color: '#ccc', fontFamily: FontFamilies.GARAMOND, marginTop: 2 }}>Ad Majorem Dei Gloriam</Text>
					<Text style={{ fontSize: 4.5, color: '#888', fontFamily: FontFamilies.HELVETICA, marginTop: 1 }}>If found, please return to the school office.</Text>
				</View>
			</View>
			<View style={{ height: 3, backgroundColor: MAROON }} />
		</View>
	)
}

/* ================================================================
 * DESIGN 5: "Modern Minimal" — White card, thin accents
 * ================================================================ */
export function PDFDesign5Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' }}>
			{/* Watermark */}
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.025 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			{/* Thin maroon top line */}
			<View style={{ height: 3, backgroundColor: MAROON }} />
			<View style={{ display: 'flex', flexDirection: 'row', height: 'calc(100% - 3px)', padding: 10 }}>
				{/* Photo column */}
				<View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 10 }}>
					<View style={{ ...styles.photoFrame, width: 51, height: 64 }}>
						{props.photoDataURL ? (
							<Image src={props.photoDataURL} style={{ width: 51, height: 64, objectFit: 'cover' }} />
						) : (
							<View style={{ ...styles.photoPlaceholder, width: 51, height: 64 }}>
								<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
							</View>
						)}
					</View>
					<Text style={{ fontSize: 7, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD, marginTop: 4 }}>{props.sisId}</Text>
				</View>
				{/* Info column */}
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
					<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
						{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 17, height: 17, objectFit: 'contain' }} />}
						<Text style={{ fontSize: 5, color: NAVY, fontFamily: FontFamilies.GARAMOND, letterSpacing: 1 }}>{props.schoolName.toUpperCase()}</Text>
					</View>
					<View style={{ width: 22, height: 1.5, backgroundColor: MAROON, marginTop: 4, marginBottom: 8 }} />
					<Text style={{ fontSize: 12, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.15, marginTop: 'auto' }}>{name}</Text>
					<View style={{ display: 'flex', flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 2 }}>
						<View>
							<Text style={{ fontSize: 4.5, color: '#aaa', fontFamily: FontFamilies.HELVETICA, letterSpacing: 0.5 }}>ROLE</Text>
							<Text style={{ fontSize: 7, color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.personType}</Text>
						</View>
						<View>
							<Text style={{ fontSize: 4.5, color: '#aaa', fontFamily: FontFamilies.HELVETICA, letterSpacing: 0.5 }}>YEAR</Text>
							<Text style={{ fontSize: 7, color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.academicYear}</Text>
						</View>
					</View>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign5Back(props: PDFCardBackProps) {
	// Same as Design 2 and 3 back
	return PDFDesign3Back(props)
}

/* ================================================================
 * DESIGN 6: "Ribbon Banner" — Maroon ribbon band across center
 * ================================================================ */
export function PDFDesign6Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' }}>
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.025 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			{/* Top section: photo + school/name */}
			<View style={{ display: 'flex', flexDirection: 'row', padding: '8 12 0', alignItems: 'flex-start', gap: 9 }}>
				<View style={{ ...styles.photoFrame, width: 51, height: 64 }}>
					{props.photoDataURL ? (
						<Image src={props.photoDataURL} style={{ width: 51, height: 64, objectFit: 'cover' }} />
					) : (
						<View style={{ ...styles.photoPlaceholder, width: 51, height: 64 }}>
							<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
						</View>
					)}
				</View>
				<View style={{ flex: 1, paddingTop: 1 }}>
					<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
						{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 17, height: 17, objectFit: 'contain' }} />}
						<Text style={{ fontSize: 5, color: NAVY, fontFamily: FontFamilies.GARAMOND, letterSpacing: 1 }}>{props.schoolName.toUpperCase()}</Text>
					</View>
					<View style={{ width: 22, height: 0.75, backgroundColor: `${NAVY}33`, marginTop: 4, marginBottom: 4 }} />
					<Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.15 }}>{name}</Text>
				</View>
			</View>
			{/* Maroon ribbon band */}
			<View style={{ backgroundColor: MAROON, marginTop: 6, paddingHorizontal: 12, paddingVertical: 3, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
				<Text style={{ fontSize: 6, color: '#fff', fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 1.5 }}>{props.personType}</Text>
				<Text style={{ fontSize: 5, color: '#ffffffaa', fontFamily: FontFamilies.GARAMOND }}>Ad Majorem Dei Gloriam</Text>
			</View>
			{/* Bottom: ID + year */}
			<View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '4 12 6' }}>
				<View>
					<Text style={{ fontSize: 4.5, color: '#aaa', fontFamily: FontFamilies.HELVETICA, letterSpacing: 0.5 }}>ID NUMBER</Text>
					<Text style={{ fontSize: 8, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.sisId}</Text>
				</View>
				<Text style={{ fontSize: 6, color: '#999', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
			</View>
		</View>
	)
}

export function PDFDesign6Back(props: PDFCardBackProps) {
	return PDFDesign3Back(props)
}

/* ================================================================
 * DESIGN 7: "Centered Portrait" — Photo centered top, symmetric
 * ================================================================ */
export function PDFDesign7Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: CREAM, overflow: 'hidden', position: 'relative' }}>
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.04 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			<View style={{ backgroundColor: NAVY, height: 6 }} />
			<View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6 12 4', flex: 1 }}>
				<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
					{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 12, height: 12, objectFit: 'contain' }} />}
					<Text style={{ fontSize: 5, color: NAVY, fontFamily: FontFamilies.GARAMOND, letterSpacing: 1.5 }}>{props.schoolName.toUpperCase()}</Text>
				</View>
				<View style={{ ...styles.photoFrame, width: 47, height: 59, borderColor: MAROON }}>
					{props.photoDataURL ? (
						<Image src={props.photoDataURL} style={{ width: 47, height: 59, objectFit: 'cover' }} />
					) : (
						<View style={{ ...styles.photoPlaceholder, width: 47, height: 59 }}>
							<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
						</View>
					)}
				</View>
				<Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, marginTop: 3, textAlign: 'center', lineHeight: 1.2 }}>{name}</Text>
				<View style={{ backgroundColor: MAROON, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 1.5, marginTop: 2 }}>
					<Text style={{ fontSize: 6, color: '#fff', fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 0.8 }}>{props.personType}</Text>
				</View>
				<View style={{ marginTop: 'auto', display: 'flex', flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }}>
					<Text style={{ fontSize: 5.5, color: '#888', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
					<Text style={{ fontSize: 7, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>ID: {props.sisId}</Text>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign7Back(props: PDFCardBackProps) {
	return PDFDesign1Back(props)
}

/* ================================================================
 * DESIGN 8: "Sidebar Accent" — Bold navy left sidebar
 * ================================================================ */
export function PDFDesign8Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' }}>
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.02 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			<View style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
				{/* Navy sidebar */}
				<View style={{ width: 32, backgroundColor: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '10 0' }}>
					{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 20, height: 20, objectFit: 'contain' }} />}
					<Text style={{ fontSize: 5, color: '#ffffff66', fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 2, transform: 'rotate(-90deg)', width: 60 }}>{props.personType}</Text>
					<View style={{ width: 12, height: 1.5, backgroundColor: MAROON }} />
				</View>
				{/* Maroon divider */}
				<View style={{ width: 2, backgroundColor: MAROON }} />
				{/* Content */}
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '9 10 6' }}>
					<Text style={{ fontSize: 5, color: '#999', fontFamily: FontFamilies.GARAMOND, letterSpacing: 1 }}>{props.schoolName.toUpperCase()}</Text>
					<View style={{ display: 'flex', flexDirection: 'row', flex: 1, alignItems: 'center', gap: 9, marginTop: 4 }}>
						<View style={styles.photoFrame}>
							{props.photoDataURL ? (
								<Image src={props.photoDataURL} style={styles.photo} />
							) : (
								<View style={styles.photoPlaceholder}>
									<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
								</View>
							)}
						</View>
						<View style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
							<Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.2 }}>{name}</Text>
							<Text style={{ fontSize: 6, color: '#888', fontFamily: FontFamilies.HELVETICA, marginTop: 3 }}>{props.academicYear}</Text>
						</View>
					</View>
					<View style={{ borderTopWidth: 0.75, borderTopColor: `${NAVY}22`, paddingTop: 3, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
						<Text style={{ fontSize: 4.5, color: '#aaa', fontFamily: FontFamilies.HELVETICA }}>ID NUMBER</Text>
						<Text style={{ fontSize: 8, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.sisId}</Text>
					</View>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign8Back(props: PDFCardBackProps) {
	return PDFDesign3Back(props)
}

/* ================================================================
 * DESIGN 9: "Heritage Frame" — Cream, ornamental double border
 * ================================================================ */
export function PDFDesign9Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: CREAM, overflow: 'hidden', position: 'relative' }}>
			{/* Outer border */}
			<View style={{ position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderWidth: 1, borderColor: `${NAVY}33`, borderRadius: 3 }} />
			{/* Inner border */}
			<View style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 0.5, borderColor: `${MAROON}44`, borderRadius: 2 }} />
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.035 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			<View style={{ display: 'flex', flexDirection: 'row', height: '100%', padding: '14 15 10' }}>
				<View style={{ display: 'flex', alignItems: 'center', marginRight: 10 }}>
					<View style={{ ...styles.photoFrame, width: 53, height: 66 }}>
						{props.photoDataURL ? (
							<Image src={props.photoDataURL} style={{ width: 53, height: 66, objectFit: 'cover' }} />
						) : (
							<View style={{ ...styles.photoPlaceholder, width: 53, height: 66 }}>
								<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
							</View>
						)}
					</View>
				</View>
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
					<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
						{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 17, height: 17, objectFit: 'contain' }} />}
						<Text style={{ fontSize: 5, color: NAVY, fontFamily: FontFamilies.GARAMOND, letterSpacing: 1 }}>{props.schoolName.toUpperCase()}</Text>
					</View>
					<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 4 }}>
						<View style={{ flex: 1, height: 0.75, backgroundColor: `${NAVY}33` }} />
						<Text style={{ fontSize: 4.5, color: MAROON, fontFamily: FontFamilies.GARAMOND }}>AMDG</Text>
						<View style={{ flex: 1, height: 0.75, backgroundColor: `${NAVY}33` }} />
					</View>
					<Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.2 }}>{name}</Text>
					<View style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 }}>
						<Text style={{ fontSize: 6, color: MAROON, fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 0.8 }}>{props.personType}</Text>
						<Text style={{ fontSize: 5, color: '#999' }}>•</Text>
						<Text style={{ fontSize: 6, color: '#888', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
					</View>
					<Text style={{ fontSize: 7, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD, marginTop: 4 }}>ID: {props.sisId}</Text>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign9Back(props: PDFCardBackProps) {
	return PDFDesign1Back(props)
}

/* ================================================================
 * DESIGN 10: "Split Tone" — Navy left / white right
 * ================================================================ */
export function PDFDesign10Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden' }}>
			<View style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
				{/* Navy left */}
				<View style={{ width: '40%', backgroundColor: NAVY, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10 9 8' }}>
					<View>
						{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 21, height: 21, objectFit: 'contain', marginBottom: 4 }} />}
						<Text style={{ fontSize: 5, color: '#ccc', fontFamily: FontFamilies.GARAMOND, letterSpacing: 1, lineHeight: 1.4 }}>{props.schoolName.toUpperCase()}</Text>
					</View>
					<View>
						<Text style={{ fontSize: 4.5, color: '#888', fontFamily: FontFamilies.HELVETICA }}>ID</Text>
						<Text style={{ fontSize: 7.5, fontWeight: 'bold', color: '#fff', fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.sisId}</Text>
					</View>
				</View>
				{/* Maroon divider */}
				<View style={{ width: 2, backgroundColor: MAROON }} />
				{/* White right */}
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10 10 8', justifyContent: 'space-between', alignItems: 'center' }}>
					<View style={styles.photoFrame}>
						{props.photoDataURL ? (
							<Image src={props.photoDataURL} style={styles.photo} />
						) : (
							<View style={styles.photoPlaceholder}>
								<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
							</View>
						)}
					</View>
					<View style={{ textAlign: 'center', alignItems: 'center' }}>
						<Text style={{ fontSize: 10, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.2, textAlign: 'center' }}>{name}</Text>
						<View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center', marginTop: 2 }}>
							<View style={{ backgroundColor: MAROON, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 1.5 }}>
								<Text style={{ fontSize: 5.5, color: '#fff', fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 0.8 }}>{props.personType}</Text>
							</View>
							<Text style={{ fontSize: 5.5, color: '#888', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
						</View>
					</View>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign10Back(props: PDFCardBackProps) {
	return PDFDesign4Back(props)
}

/* ================================================================
 * DESIGN 11: "Top Photo Strip" — Navy header with overlapping photo
 * ================================================================ */
export function PDFDesign11Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' }}>
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.02 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			{/* Navy top band */}
			<View style={{ height: 60, backgroundColor: NAVY, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12, gap: 4 }}>
				{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 17, height: 17, objectFit: 'contain' }} />}
				<Text style={{ fontSize: 6, color: '#fff', fontFamily: FontFamilies.GARAMOND, letterSpacing: 1 }}>{props.schoolName.toUpperCase()}</Text>
			</View>
			{/* Maroon divider */}
			<View style={{ height: 2, backgroundColor: MAROON }} />
			{/* Photo overlapping from navy area */}
			<View style={{ position: 'absolute', left: 12, top: 15, zIndex: 2 }}>
				<View style={{ ...styles.photoFrame, width: 48, height: 60, borderColor: '#fff' }}>
					{props.photoDataURL ? (
						<Image src={props.photoDataURL} style={{ width: 48, height: 60, objectFit: 'cover' }} />
					) : (
						<View style={{ ...styles.photoPlaceholder, width: 48, height: 60 }}>
							<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
						</View>
					)}
				</View>
			</View>
			{/* Bottom info section */}
			<View style={{ display: 'flex', flexDirection: 'row', padding: '4 12 6', flex: 1 }}>
				<View style={{ width: 54 }} />
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 6 }}>
					<Text style={{ fontSize: 10, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.2 }}>{name}</Text>
					<View style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2 }}>
						<Text style={{ fontSize: 5.5, color: MAROON, fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 0.8 }}>{props.personType}</Text>
						<Text style={{ fontSize: 5, color: '#aaa' }}>|</Text>
						<Text style={{ fontSize: 5.5, color: '#888', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
					</View>
				</View>
				<View style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
					<Text style={{ fontSize: 4.5, color: '#aaa', fontFamily: FontFamilies.HELVETICA, letterSpacing: 0.5 }}>ID</Text>
					<Text style={{ fontSize: 8, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.sisId}</Text>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign11Back(props: PDFCardBackProps) {
	return PDFDesign3Back(props)
}

/* ================================================================
 * DESIGN 12: "Monogram Shield" — Large faded initial background
 * ================================================================ */
export function PDFDesign12Front(props: PDFCardFrontProps) {
	const styles = createStyles()
	const name = getFirstAndLastName(props.fullName).toUpperCase()
	const initial = name.charAt(0)

	return (
		<View style={{ width: PDF_CARD_WIDTH, height: PDF_CARD_HEIGHT, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' }}>
			{/* Giant faded monogram */}
			<Text style={{ position: 'absolute', right: -8, top: -15, fontSize: 135, fontWeight: 'bold', color: NAVY, opacity: 0.04, fontFamily: FontFamilies.TRAJAN, lineHeight: 1 }}>{initial}</Text>
			{props.logoDataURL && (
				<View style={{ ...styles.watermark, opacity: 0.02 }} fixed>
					<Image src={props.logoDataURL} style={styles.logoLarge} />
				</View>
			)}
			{/* Maroon top */}
			<View style={{ height: 3, backgroundColor: MAROON }} />
			{/* Navy thin line */}
			<View style={{ height: 1, backgroundColor: NAVY }} />
			<View style={{ display: 'flex', flexDirection: 'row', height: 'calc(100% - 4px)', padding: '8 12 6' }}>
				<View style={{ display: 'flex', alignItems: 'center', marginRight: 10 }}>
					<View style={{ ...styles.photoFrame, width: 53, height: 66 }}>
						{props.photoDataURL ? (
							<Image src={props.photoDataURL} style={{ width: 53, height: 66, objectFit: 'cover' }} />
						) : (
							<View style={{ ...styles.photoPlaceholder, width: 53, height: 66 }}>
								<Text style={{ fontSize: 5, color: '#999' }}>No Photo</Text>
							</View>
						)}
					</View>
				</View>
				<View style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
					<View>
						<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
							{props.logoDataURL && <Image src={props.logoDataURL} style={{ width: 15, height: 15, objectFit: 'contain' }} />}
							<Text style={{ fontSize: 5, color: NAVY, fontFamily: FontFamilies.GARAMOND, letterSpacing: 1 }}>{props.schoolName.toUpperCase()}</Text>
						</View>
						<View style={{ width: 38, height: 1, backgroundColor: MAROON, marginTop: 4, marginBottom: 6 }} />
						<Text style={{ fontSize: 12, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.TRAJAN, lineHeight: 1.15 }}>{name}</Text>
						<View style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 }}>
							<View style={{ backgroundColor: NAVY, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 1.5 }}>
								<Text style={{ fontSize: 5.5, color: '#fff', fontFamily: FontFamilies.HELVETICA_BOLD, letterSpacing: 0.8 }}>{props.personType}</Text>
							</View>
							<Text style={{ fontSize: 6, color: '#888', fontFamily: FontFamilies.HELVETICA }}>{props.academicYear}</Text>
						</View>
					</View>
					<View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
						<View>
							<Text style={{ fontSize: 4.5, color: '#bbb', fontFamily: FontFamilies.HELVETICA, letterSpacing: 0.5 }}>ID NUMBER</Text>
							<Text style={{ fontSize: 8, fontWeight: 'bold', color: NAVY, fontFamily: FontFamilies.HELVETICA_BOLD }}>{props.sisId}</Text>
						</View>
						<Text style={{ fontSize: 4.5, color: '#ccc', fontFamily: FontFamilies.GARAMOND }}>AMDG</Text>
					</View>
				</View>
			</View>
		</View>
	)
}

export function PDFDesign12Back(props: PDFCardBackProps) {
	return PDFDesign3Back(props)
}

/**
 * All 12 PDF designs with Front and Back components
 */
export const PDF_DESIGNS = [
	{ id: 1, name: 'Classic Band', Front: PDFDesign1Front, Back: PDFDesign1Back },
	{ id: 2, name: 'Full-Height Photo', Front: PDFDesign2Front, Back: PDFDesign2Back },
	{ id: 3, name: 'Light Executive', Front: PDFDesign3Front, Back: PDFDesign3Back },
	{ id: 4, name: 'Dark Executive', Front: PDFDesign4Front, Back: PDFDesign4Back },
	{ id: 5, name: 'Modern Minimal', Front: PDFDesign5Front, Back: PDFDesign5Back },
	{ id: 6, name: 'Ribbon Banner', Front: PDFDesign6Front, Back: PDFDesign6Back },
	{ id: 7, name: 'Centered Portrait', Front: PDFDesign7Front, Back: PDFDesign7Back },
	{ id: 8, name: 'Sidebar Accent', Front: PDFDesign8Front, Back: PDFDesign8Back },
	{ id: 9, name: 'Heritage Frame', Front: PDFDesign9Front, Back: PDFDesign9Back },
	{ id: 10, name: 'Split Tone', Front: PDFDesign10Front, Back: PDFDesign10Back },
	{ id: 11, name: 'Top Photo Strip', Front: PDFDesign11Front, Back: PDFDesign11Back },
	{ id: 12, name: 'Monogram Shield', Front: PDFDesign12Front, Back: PDFDesign12Back },
] as const

/**
 * Get PDF design components by ID
 */
export function getPDFDesign(designId: number) {
	return PDF_DESIGNS.find(d => d.id === designId) ?? PDF_DESIGNS[2] // Default to Design 3
}
