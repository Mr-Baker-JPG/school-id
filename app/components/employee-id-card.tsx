/**
 * Reusable Employee ID Card Components — "Light Executive" Design
 *
 * Layout: Photo left, structured info right, white bg, thin maroon accent
 * Back: QR left, school info right, maroon top/bottom rules
 *
 * This module provides both PDF (React PDF) and Preview (React/HTML) versions
 * of the employee ID card layout components for use in PDF generation and
 * browser preview.
 *
 * Fonts:
 * - Trajan Pro Bold: Names, titles (classical Roman inscription style)
 * - Garamond: Body text, addresses, motto (elegant 16th-century serif)
 */

import { Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { type BrandingConfig } from '#app/utils/branding.server.ts'
export type { BrandingConfig } from '#app/utils/branding.server.ts'
import { FontFamilies, CSSFontStacks } from '#app/utils/font-families.ts'

// Note: Font registration happens in pdf-id.server.tsx (server-only)
// This component uses FontFamilies constants for PDF and CSSFontStacks for preview

/**
 * Person type for ID card display
 * - FACULTY: Teaching staff (teachers, professors, instructors)
 * - STAFF: Non-teaching staff (administration, support, etc.)
 * - STUDENT: Students
 */
export type PersonType = 'FACULTY' | 'STAFF' | 'STUDENT'

/**
 * Employee data required for ID card generation
 */
export interface EmployeePDFData {
	id: string
	firstName: string
	lastName: string
	fullName: string // Kept for backward compatibility
	jobTitle?: string // Kept for backward compatibility, but personType takes precedence
	personType: PersonType
	email: string
	status: string
	sisEmployeeId: string
	photoUrl?: string | null
	expirationDate: Date
}

// Wallet-size ID card dimensions (in points, 1 point = 1/72 inch)
// Standard ID card: 3.375" x 2.125" = 243 points x 153 points
export const ID_WIDTH = 243
export const ID_HEIGHT = 153

/**
 * Props for ID card front component (PDF version)
 */
export interface IDCardFrontPDFProps {
	employee: EmployeePDFData
	photoDataURL: string | null
	logoDataURL: string | null
	branding: BrandingConfig
	academicYear: string
	barcodeDataURL: string | null
}

/**
 * Props for ID card front component (Preview version)
 */
export interface IDCardFrontPreviewProps {
	employee: EmployeePDFData
	photoUrl: string | null
	logoUrl: string | null
	branding: BrandingConfig
	academicYear: string
	barcodeDataURL: string | null
}

/**
 * Props for ID card back component
 */
export interface IDCardBackProps {
	qrCodeDataURL: string
	branding: BrandingConfig
	logoDataURL?: string | null
}

// Design constants
const NAVY = '#1B2A4A'
const MAROON = '#8B1A2B'

const SCHOOL_ADDRESS_LINE1 = '1522 Carmel Dr.'
const SCHOOL_ADDRESS_LINE2 = 'Lafayette, LA 70501'
const SCHOOL_PHONE = '337-889-5345'

/**
 * Creates PDF styles for the Light Executive design
 * Uses Trajan Pro Bold for titles/names and Garamond for body text
 */
export function createIDCardPDFStyles(_branding: BrandingConfig) {
	return StyleSheet.create({
		page: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			padding: 0,
		},
		// Front card
		frontCard: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			backgroundColor: '#FFFFFF',
			display: 'flex',
			flexDirection: 'column',
		},
		// Watermark (ghosted logo)
		watermark: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			opacity: 0.025,
		},
		watermarkImage: {
			width: 140,
			height: 140,
			objectFit: 'contain',
		},
		maroonTopBar: {
			height: 3,
			backgroundColor: MAROON,
		},
		frontBody: {
			flex: 1,
			display: 'flex',
			flexDirection: 'row',
		},
		// Photo column (left)
		photoColumn: {
			display: 'flex',
			alignItems: 'flex-start',
			justifyContent: 'center',
			paddingLeft: 10,
			paddingTop: 10,
			paddingBottom: 8,
		},
		photoFrame: {
			width: 54,
			height: 68,
			border: `1.5pt solid ${NAVY}`,
			borderRadius: 3,
			overflow: 'hidden',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'flex-start',
		},
		photo: {
			width: 54,
			height: 68,
			objectFit: 'cover',
			// React PDF doesn't support objectPosition, so we use a wrapper approach
			// The photoFrame wrapper has overflow: hidden to clip from top
		},
		photoPlaceholder: {
			width: 54,
			height: 68,
			backgroundColor: '#e5e5e5',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		},
		photoPlaceholderText: {
			fontSize: 5,
			color: '#999999',
		},
		// Info column (right)
		infoColumn: {
			flex: 1,
			display: 'flex',
			flexDirection: 'column',
			padding: '10 10 8 10',
			justifyContent: 'space-between',
		},
		// Top: school identity
		schoolRow: {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			gap: 4,
		},
		schoolLogo: {
			width: 18,
			height: 18,
			objectFit: 'contain',
		},
		schoolName: {
			fontSize: 5.5,
			color: '#888888',
			fontFamily: FontFamilies.GARAMOND,
			letterSpacing: 1,
		},
		maroonRule: {
			height: 0.75,
			backgroundColor: MAROON,
			marginTop: 6,
			marginBottom: 6,
		},
		// Name - Trajan Pro Bold for classical Roman style
		name: {
			fontSize: 11,
			fontWeight: 'bold',
			color: NAVY,
			fontFamily: FontFamilies.TRAJAN,
			lineHeight: 1.2,
		},
		// Role badge + year row
		badgeRow: {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			gap: 6,
			marginTop: 3,
		},
		roleBadge: {
			fontSize: 6,
			color: '#FFFFFF',
			backgroundColor: MAROON,
			paddingHorizontal: 4,
			paddingVertical: 1,
			borderRadius: 1.5,
			fontFamily: FontFamilies.HELVETICA_BOLD,
			letterSpacing: 0.8,
		},
		yearText: {
			fontSize: 6,
			color: '#888888',
			fontFamily: FontFamilies.HELVETICA,
		},
		// Bottom: ID number
		bottomRow: {
			display: 'flex',
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'flex-end',
		},
		idLabel: {
			fontSize: 5,
			color: '#aaaaaa',
			fontFamily: FontFamilies.HELVETICA,
			letterSpacing: 0.5,
		},
		idNumber: {
			fontSize: 8,
			fontWeight: 'bold',
			color: NAVY,
			fontFamily: FontFamilies.HELVETICA_BOLD,
			letterSpacing: 0.3,
		},
		amdg: {
			fontSize: 4.5,
			color: '#bbbbbb',
			fontFamily: FontFamilies.GARAMOND,
		},
		// Back card
		backCard: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			backgroundColor: '#FFFFFF',
			display: 'flex',
			flexDirection: 'column',
		},
		backBody: {
			flex: 1,
			display: 'flex',
			flexDirection: 'row',
			padding: '10 14',
			alignItems: 'center',
			gap: 12,
		},
		qrContainer: {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
		},
		qrCode: {
			width: 65,
			height: 65,
		},
		verifyLabel: {
			fontSize: 5,
			color: NAVY,
			fontFamily: FontFamilies.HELVETICA_BOLD,
			marginTop: 2,
			letterSpacing: 0.5,
		},
		backInfoColumn: {
			flex: 1,
			display: 'flex',
			flexDirection: 'column',
			gap: 3,
		},
		// School name on back - Trajan Pro Bold
		backSchoolName: {
			fontSize: 7,
			fontWeight: 'bold',
			color: NAVY,
			fontFamily: FontFamilies.TRAJAN,
		},
		// Address - Garamond
		backAddress: {
			fontSize: 5.5,
			color: '#555555',
			fontFamily: FontFamilies.GARAMOND,
			lineHeight: 1.5,
		},
		// Motto - Garamond italic
		backMotto: {
			fontSize: 5.5,
			color: MAROON,
			fontFamily: FontFamilies.GARAMOND,
			marginTop: 2,
		},
		backReturnNotice: {
			fontSize: 4.5,
			color: '#aaaaaa',
			fontFamily: FontFamilies.HELVETICA,
			marginTop: 1,
		},
		bottomMaroonBar: {
			height: 3,
			backgroundColor: MAROON,
		},
	})
}

/**
 * PDF version: React PDF component for ID card front content (View only, no Page wrapper)
 * Used for bulk printing where multiple cards are placed on a single page
 */
export function IDCardFrontContentView({
	employee,
	photoDataURL,
	logoDataURL,
	branding,
	academicYear,
}: IDCardFrontPDFProps) {
	const styles = createIDCardPDFStyles(branding)
	const displayName = `${employee.firstName} ${employee.lastName}`.toUpperCase()

	return (
		<View style={styles.frontCard}>
			{/* Watermark */}
			{logoDataURL ? (
				<View style={styles.watermark} fixed>
					<Image src={logoDataURL} style={styles.watermarkImage} />
				</View>
			) : null}
			{/* Thin maroon top accent */}
			<View style={styles.maroonTopBar} />

			<View style={styles.frontBody}>
				{/* Left: Photo */}
				<View style={styles.photoColumn}>
					<View style={styles.photoFrame}>
						{photoDataURL ? (
							<Image src={photoDataURL} style={styles.photo} />
						) : (
							<View style={styles.photoPlaceholder}>
								<Text style={styles.photoPlaceholderText}>No Photo</Text>
							</View>
						)}
					</View>
				</View>

				{/* Right: Info */}
				<View style={styles.infoColumn}>
					<View>
						{/* School identity */}
						<View style={styles.schoolRow}>
							{logoDataURL ? (
								<Image src={logoDataURL} style={styles.schoolLogo} />
							) : null}
							<Text style={styles.schoolName}>
								{branding.schoolName.toUpperCase()}
							</Text>
						</View>

						{/* Maroon rule */}
						<View style={styles.maroonRule} />

						{/* Name */}
						<Text style={styles.name}>{displayName}</Text>

						{/* Role + Year */}
						<View style={styles.badgeRow}>
							<Text style={styles.roleBadge}>
								{employee.personType}
							</Text>
							<Text style={styles.yearText}>{academicYear}</Text>
						</View>
					</View>

					{/* Bottom: ID number */}
					<View style={styles.bottomRow}>
						<View>
							<Text style={styles.idLabel}>ID NUMBER</Text>
							<Text style={styles.idNumber}>{employee.sisEmployeeId}</Text>
						</View>
						<Text style={styles.amdg}>AMDG</Text>
					</View>
				</View>
			</View>
		</View>
	)
}

/**
 * PDF version: React PDF component for ID card front
 */
export function IDCardFrontPDF({
	employee,
	photoDataURL,
	logoDataURL,
	branding,
	academicYear,
	barcodeDataURL,
}: IDCardFrontPDFProps) {
	const styles = createIDCardPDFStyles(branding)

	return (
		<Page size={[ID_WIDTH, ID_HEIGHT]} style={styles.page}>
			<IDCardFrontContentView
				employee={employee}
				photoDataURL={photoDataURL}
				logoDataURL={logoDataURL}
				branding={branding}
				academicYear={academicYear}
				barcodeDataURL={barcodeDataURL}
			/>
		</Page>
	)
}

/**
 * PDF version: React PDF component for ID card back content (View only, no Page wrapper)
 * Used for bulk printing where multiple cards are placed on a single page
 */
export function IDCardBackContentView({
	qrCodeDataURL,
	branding,
	logoDataURL,
}: IDCardBackProps) {
	const styles = createIDCardPDFStyles(branding)
	return (
		<View style={styles.backCard}>
			{/* Watermark */}
			{logoDataURL ? (
				<View style={styles.watermark} fixed>
					<Image src={logoDataURL} style={styles.watermarkImage} />
				</View>
			) : null}
			<View style={styles.maroonTopBar} />
			<View style={styles.backBody}>
				{/* Left: QR code */}
				<View style={styles.qrContainer}>
					<Image src={qrCodeDataURL} style={styles.qrCode} />
					<Text style={styles.verifyLabel}>VERIFY ID</Text>
				</View>

				{/* Right: School info */}
				<View style={styles.backInfoColumn}>
					<Text style={styles.backSchoolName}>{branding.schoolName}</Text>
					<Text style={styles.backAddress}>
						{SCHOOL_ADDRESS_LINE1}{'\n'}
						{SCHOOL_ADDRESS_LINE2}{'\n'}
						{SCHOOL_PHONE}
					</Text>
					<Text style={styles.backMotto}>Ad Majorem Dei Gloriam</Text>
					<Text style={styles.backReturnNotice}>
						If found, please return to the school office.
					</Text>
				</View>
			</View>
			<View style={styles.bottomMaroonBar} />
		</View>
	)
}

/**
 * PDF version: React PDF component for ID card back
 */
export function IDCardBackPDF({ qrCodeDataURL, branding, logoDataURL }: IDCardBackProps) {
	const styles = createIDCardPDFStyles(branding)
	return (
		<Page size={[ID_WIDTH, ID_HEIGHT]} style={styles.page}>
			<IDCardBackContentView
				qrCodeDataURL={qrCodeDataURL}
				branding={branding}
				logoDataURL={logoDataURL}
			/>
		</Page>
	)
}

/**
 * Preview version: React/HTML component for ID card front
 * "Light Executive" — white bg, photo left, structured info right
 */
export function IDCardFrontPreview({
	employee,
	photoUrl,
	logoUrl,
	branding,
	academicYear,
}: IDCardFrontPreviewProps) {
	const displayName = `${employee.firstName} ${employee.lastName}`.toUpperCase()

	return (
		<div
			style={{
				width: ID_WIDTH,
				height: ID_HEIGHT,
				backgroundColor: '#FFFFFF',
				borderRadius: 8,
				overflow: 'hidden',
				display: 'flex',
				flexDirection: 'column',
				boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
				position: 'relative',
			}}
		>
			{/* Watermark */}
			{logoUrl ? (
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						opacity: 0.025,
						pointerEvents: 'none',
						zIndex: 0,
					}}
				>
					<img
						src={logoUrl}
						alt=""
						style={{ width: 140, height: 140, objectFit: 'contain' }}
					/>
				</div>
			) : null}
			{/* Thin maroon top accent */}
			<div style={{ height: 3, backgroundColor: MAROON, flexShrink: 0 }} />

			<div style={{ flex: 1, display: 'flex' }}>
				{/* Left: Photo */}
				<div
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						justifyContent: 'center',
						paddingLeft: 10,
						paddingTop: 10,
						paddingBottom: 8,
					}}
				>
					<div
						style={{
							width: 54,
							height: 68,
							border: `1.5px solid ${NAVY}`,
							borderRadius: 3,
							overflow: 'hidden',
							flexShrink: 0,
							backgroundColor: '#e5e5e5',
						}}
					>
						{photoUrl ? (
							<img
								src={photoUrl}
								alt={employee.fullName}
								style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
							/>
						) : (
							<div
								style={{
									width: '100%',
									height: '100%',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									fontSize: 5,
									color: '#999',
									fontFamily: 'system-ui, sans-serif',
								}}
							>
								No Photo
							</div>
						)}
					</div>
				</div>

				{/* Right: Info */}
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						padding: '10px 10px 8px 10px',
						justifyContent: 'space-between',
					}}
				>
					<div>
						{/* School identity */}
						<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
							{logoUrl && (
								<img
									src={logoUrl}
									alt=""
									style={{ width: 18, height: 18, objectFit: 'contain' }}
								/>
							)}
							<div
								style={{
									fontSize: 5.5,
									color: '#888',
									fontFamily: CSSFontStacks.GARAMOND,
									letterSpacing: 1,
								}}
							>
								{branding.schoolName.toUpperCase()}
							</div>
						</div>

						{/* Maroon rule */}
						<div
							style={{
								height: 0.75,
								backgroundColor: MAROON,
								marginTop: 6,
								marginBottom: 6,
							}}
						/>

						{/* Name */}
						<div
							style={{
								fontSize: 11,
								fontWeight: 700,
								color: NAVY,
								fontFamily: CSSFontStacks.TRAJAN,
								lineHeight: 1.2,
							}}
						>
							{displayName}
						</div>

						{/* Role badge + year */}
						<div
							style={{
								display: 'flex',
								gap: 6,
								alignItems: 'center',
								marginTop: 3,
							}}
						>
							<span
								style={{
									fontSize: 6,
									color: '#fff',
									backgroundColor: MAROON,
									padding: '1px 4px',
									borderRadius: 1.5,
									fontFamily: 'system-ui, sans-serif',
									fontWeight: 600,
									letterSpacing: 0.8,
								}}
							>
								{employee.personType}
							</span>
							<span
								style={{
									fontSize: 6,
									color: '#888',
									fontFamily: 'system-ui, sans-serif',
								}}
							>
								{academicYear}
							</span>
						</div>
					</div>

					{/* Bottom: ID number */}
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'flex-end',
						}}
					>
						<div>
							<div
								style={{
									fontSize: 5,
									color: '#aaa',
									fontFamily: 'system-ui, sans-serif',
									letterSpacing: 0.5,
								}}
							>
								ID NUMBER
							</div>
							<div
								style={{
									fontSize: 8,
									fontWeight: 700,
									color: NAVY,
									fontFamily: 'system-ui, sans-serif',
									letterSpacing: 0.3,
								}}
							>
								{employee.sisEmployeeId}
							</div>
						</div>
						<div
							style={{
								fontSize: 4.5,
								color: '#bbb',
								fontFamily: CSSFontStacks.GARAMOND,
							}}
						>
							AMDG
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

/**
 * Preview version: React/HTML component for ID card back
 * Two-column: QR left, school info right
 */
export function IDCardBackPreview({
	qrCodeDataURL,
	branding,
	logoDataURL,
}: IDCardBackProps) {
	// Use logoDataURL if provided, otherwise fall back to branding.logoUrl
	const watermarkLogo = logoDataURL || branding.logoUrl

	return (
		<div
			style={{
				width: ID_WIDTH,
				height: ID_HEIGHT,
				backgroundColor: '#FFFFFF',
				borderRadius: 8,
				overflow: 'hidden',
				display: 'flex',
				flexDirection: 'column',
				boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
				position: 'relative',
			}}
		>
			{/* Watermark */}
			{watermarkLogo ? (
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						opacity: 0.025,
						pointerEvents: 'none',
						zIndex: 0,
					}}
				>
					<img
						src={watermarkLogo}
						alt=""
						style={{ width: 140, height: 140, objectFit: 'contain' }}
					/>
				</div>
			) : null}
			{/* Top maroon rule */}
			<div style={{ height: 3, backgroundColor: MAROON, flexShrink: 0 }} />

			<div
				style={{
					flex: 1,
					display: 'flex',
					alignItems: 'center',
					padding: '10px 14px',
					gap: 12,
				}}
			>
				{/* Left: QR */}
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
					}}
				>
					<img
						src={qrCodeDataURL}
						alt="QR Code"
						style={{ width: 65, height: 65 }}
					/>
					<div
						style={{
							fontSize: 5,
							color: NAVY,
							fontFamily: 'system-ui, sans-serif',
							fontWeight: 600,
							marginTop: 2,
							letterSpacing: 0.5,
						}}
					>
						VERIFY ID
					</div>
				</div>

				{/* Right: School info */}
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						gap: 3,
					}}
				>
					<div
						style={{
							fontSize: 7,
							fontWeight: 700,
							color: NAVY,
							fontFamily: CSSFontStacks.TRAJAN,
						}}
					>
						{branding.schoolName}
					</div>
					<div
						style={{
							fontSize: 5.5,
							color: '#555',
							fontFamily: CSSFontStacks.GARAMOND,
							lineHeight: 1.5,
						}}
					>
						{SCHOOL_ADDRESS_LINE1}
						<br />
						{SCHOOL_ADDRESS_LINE2}
						<br />
						{SCHOOL_PHONE}
					</div>
					<div
						style={{
							fontSize: 5.5,
							color: MAROON,
							fontFamily: CSSFontStacks.GARAMOND,
							marginTop: 2,
						}}
					>
						Ad Majorem Dei Gloriam
					</div>
					<div
						style={{
							fontSize: 4.5,
							color: '#aaa',
							fontFamily: CSSFontStacks.HELVETICA,
							marginTop: 1,
						}}
					>
						If found, please return to the school office.
					</div>
				</div>
			</div>

			{/* Bottom maroon rule */}
			<div style={{ height: 3, backgroundColor: MAROON, flexShrink: 0 }} />
		</div>
	)
}
