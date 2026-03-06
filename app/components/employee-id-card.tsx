/**
 * Reusable Employee ID Card Components
 *
 * This module provides both PDF (React PDF) and Preview (React/HTML) versions
 * of the employee ID card layout components for use in PDF generation and
 * browser preview.
 */

import { Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { type BrandingConfig } from '#app/utils/branding.server.ts'
import { getFirstAndLastName } from '#app/utils/misc.tsx'

/**
 * Person type for ID card display
 */
export type PersonType = 'FACULTY' | 'STUDENT'

/**
 * Employee data required for ID card generation
 */
export interface EmployeePDFData {
	id: string
	fullName: string
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
}

/**
 * Formats school name to uppercase, splitting into two lines if needed
 */
function formatSchoolName(schoolName: string): string[] {
	const upper = schoolName.toUpperCase()
	// Split by common patterns or at natural break points
	const words = upper.split(/\s+/)
	if (words.length <= 3) {
		// For short names, try to split evenly
		const mid = Math.ceil(words.length / 2)
		return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
	}
	// For longer names, split at "THE" or other common words, or at midpoint
	const theIndex = words.indexOf('THE')
	if (theIndex > 0 && theIndex < words.length - 1) {
		return [
			words.slice(0, theIndex + 1).join(' '),
			words.slice(theIndex + 1).join(' '),
		]
	}
	// Otherwise split roughly in half
	const mid = Math.ceil(words.length / 2)
	return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

/**
 * Creates PDF styles matching the reference design
 */
export function createIDCardPDFStyles(_branding: BrandingConfig) {
	// Reference colors: light blue-grey background, black text, dark red separator
	const bgColor = '#d0e0e3' // Light blue-grey
	const textColor = '#000000' // Black
	const separatorColor = '#8B0000' // Dark red

	return StyleSheet.create({
		page: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			padding: 0,
		},
		frontPage: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			backgroundColor: bgColor,
			border: '1px solid #000000',
			padding: 8,
			display: 'flex',
			flexDirection: 'column',
		},
		backPage: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			backgroundColor: bgColor,
			padding: 12,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 8,
		},
		// Top section: logo + school name + photo
		topSection: {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'flex-start',
			marginBottom: 8,
		},
		logoAndNameContainer: {
			flex: 1,
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'flex-start',
			gap: 6,
		},
		logoContainer: {
			width: 35,
			height: 35,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		},
		logo: {
			width: 35,
			height: 35,
			objectFit: 'contain',
		},
		schoolNameContainer: {
			flex: 1,
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'flex-start',
		},
		schoolNameLine1: {
			fontSize: 8,
			fontWeight: 'normal',
			color: textColor,
			fontFamily: 'Times-Roman',
			lineHeight: 1.2,
		},
		schoolNameLine2: {
			fontSize: 8,
			fontWeight: 'normal',
			color: textColor,
			fontFamily: 'Times-Roman',
			lineHeight: 1.2,
		},
		photoContainer: {
			width: 70,
			height: 85,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: '#ffffff',
			overflow: 'hidden',
		},
		photo: {
			width: 70,
			height: 85,
			objectFit: 'cover',
		},
		photoPlaceholder: {
			width: 70,
			height: 85,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: '#e0e0e0',
		},
		// Middle section: name, role, academic year
		middleSection: {
			display: 'flex',
			flexDirection: 'column',
			gap: 2,
			marginBottom: 4,
		},
		name: {
			fontSize: 14,
			fontWeight: 'bold',
			color: textColor,
			fontFamily: 'Times-Bold',
			lineHeight: 1.3,
		},
		role: {
			fontSize: 9,
			fontWeight: 'normal',
			color: textColor,
			fontFamily: 'Times-Roman',
			lineHeight: 1.2,
		},
		academicYear: {
			fontSize: 9,
			fontWeight: 'normal',
			color: textColor,
			fontFamily: 'Times-Roman',
			lineHeight: 1.2,
		},
		// Red separator line
		separator: {
			width: '100%',
			height: 3,
			backgroundColor: separatorColor,
			marginBottom: 8,
		},
		// Bottom section: barcode + ID number
		bottomSection: {
			display: 'flex',
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'flex-end',
			marginTop: 4,
		},
		barcodeContainer: {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'flex-start',
			gap: 2,
		},
		barcode: {
			width: 100,
			height: 25,
			objectFit: 'contain',
		},
		barcodeNumber: {
			fontSize: 7,
			fontWeight: 'normal',
			color: textColor,
			fontFamily: 'Times-Roman',
		},
		idNumberContainer: {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'flex-end',
			gap: 2,
		},
		idNumberLabel: {
			fontSize: 7,
			fontWeight: 'normal',
			color: textColor,
			fontFamily: 'Times-Roman',
		},
		idNumber: {
			fontSize: 12,
			fontWeight: 'bold',
			color: textColor,
			fontFamily: 'Times-Bold',
		},
		qrCodeContainer: {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			width: 100,
			height: 100,
		},
		qrCode: {
			width: 100,
			height: 100,
		},
		verificationText: {
			fontSize: 8,
			color: textColor,
			textAlign: 'center',
			marginTop: 4,
			fontFamily: 'Times-Roman',
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
	barcodeDataURL,
}: IDCardFrontPDFProps) {
	const styles = createIDCardPDFStyles(branding)
	const schoolNameLines = formatSchoolName(branding.schoolName)

	return (
		<View style={styles.frontPage}>
			{/* Top Section: Logo + School Name + Photo */}
			<View style={styles.topSection}>
				<View style={styles.logoAndNameContainer}>
					{logoDataURL ? (
						<View style={styles.logoContainer}>
							<Image src={logoDataURL} style={styles.logo} />
						</View>
					) : null}
					<View style={styles.schoolNameContainer}>
						<Text style={styles.schoolNameLine1}>{schoolNameLines[0]}</Text>
						<Text style={styles.schoolNameLine2}>{schoolNameLines[1]}</Text>
					</View>
				</View>
				{/* Photo */}
				<View style={styles.photoContainer}>
					{photoDataURL ? (
						<Image src={photoDataURL} style={styles.photo} />
					) : (
						<View style={styles.photoPlaceholder}>
							<Text style={{ fontSize: 6, color: '#999999' }}>No Photo</Text>
						</View>
					)}
				</View>
			</View>

			{/* Middle Section: Name, Role, Academic Year */}
			<View style={styles.middleSection}>
				<Text style={styles.name}>
					{getFirstAndLastName(employee.fullName).toUpperCase()}
				</Text>
				<Text style={styles.role}>{employee.personType.toUpperCase()}</Text>
				<Text style={styles.academicYear}>{academicYear}</Text>
			</View>

			{/* Red Separator Line */}
			<View style={styles.separator} />

			{/* Bottom Section: Barcode + ID Number */}
			<View style={styles.bottomSection}>
				{barcodeDataURL && (
					<View style={styles.barcodeContainer}>
						<Image src={barcodeDataURL} style={styles.barcode} />
					</View>
				)}
				<View style={styles.idNumberContainer}>
					<Text style={styles.idNumberLabel}>ID NUMBER:</Text>
					<Text style={styles.idNumber}>{employee.sisEmployeeId}</Text>
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
}: IDCardBackProps) {
	const styles = createIDCardPDFStyles(branding)
	return (
		<View style={styles.backPage}>
			<View style={styles.qrCodeContainer}>
				<Image src={qrCodeDataURL} style={styles.qrCode} />
			</View>
			<Text style={styles.verificationText}>
				Scan to verify ID status
			</Text>
			<Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000000' }}>
				{branding.schoolName.toUpperCase()}
			</Text>
		</View>
	)
}

/**
 * PDF version: React PDF component for ID card back
 */
export function IDCardBackPDF({ qrCodeDataURL, branding }: IDCardBackProps) {
	const styles = createIDCardPDFStyles(branding)
	return (
		<Page size={[ID_WIDTH, ID_HEIGHT]} style={styles.page}>
			<IDCardBackContentView
				qrCodeDataURL={qrCodeDataURL}
				branding={branding}
			/>
		</Page>
	)
}

/**
 * Preview version: React/HTML component for ID card front
 * Used for browser preview of ID cards
 * Accepts regular URLs (not base64 data URLs) for photos and logos
 */
export function IDCardFrontPreview({
	employee,
	photoUrl,
	logoUrl,
	branding,
	academicYear,
	barcodeDataURL,
}: IDCardFrontPreviewProps) {
	// Convert points to pixels (assuming 72 DPI: 1 point = 1 pixel)
	const widthPx = ID_WIDTH
	const heightPx = ID_HEIGHT
	const bgColor = '#d0e0e3'
	const textColor = '#000000'
	const schoolNameLines = formatSchoolName(branding.schoolName)

	return (
		<div
			className="flex flex-col border border-black"
			style={{
				width: `${widthPx}px`,
				height: `${heightPx}px`,
				backgroundColor: bgColor,
				padding: '8px',
				fontFamily: 'Times, "Times New Roman", serif',
			}}
		>
			{/* Top Section: Logo + School Name + Photo */}
			<div
				style={{
					display: 'flex',
					flexDirection: 'row',
					alignItems: 'flex-start',
					marginBottom: '8px',
				}}
			>
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'row',
						alignItems: 'flex-start',
						gap: '6px',
					}}
				>
					{logoUrl && (
						<div
							style={{
								width: '35px',
								height: '35px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<img
								src={logoUrl}
								alt="School Logo"
								style={{ width: '35px', height: '35px', objectFit: 'contain' }}
							/>
						</div>
					)}
					<div
						style={{
							flex: 1,
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'flex-start',
						}}
					>
						<div
							style={{
								fontSize: '8px',
								fontWeight: 'normal',
								color: textColor,
								fontFamily: 'Times, "Times New Roman", serif',
								lineHeight: 1.2,
							}}
						>
							{schoolNameLines[0]}
						</div>
						<div
							style={{
								fontSize: '8px',
								fontWeight: 'normal',
								color: textColor,
								fontFamily: 'Times, "Times New Roman", serif',
								lineHeight: 1.2,
							}}
						>
							{schoolNameLines[1]}
						</div>
					</div>
				</div>
				{/* Photo */}
				<div
					style={{
						width: '70px',
						height: '85px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: '#ffffff',
						overflow: 'hidden',
					}}
				>
					{photoUrl ? (
						<img
							src={photoUrl}
							alt={employee.fullName}
							style={{
								width: '70px',
								height: '85px',
								objectFit: 'cover',
							}}
						/>
					) : (
						<div
							style={{
								width: '70px',
								height: '85px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								backgroundColor: '#e0e0e0',
								fontSize: '6px',
								color: '#999999',
							}}
						>
							No Photo
						</div>
					)}
				</div>
			</div>

			{/* Middle Section: Name, Role, Academic Year */}
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: '2px',
					marginBottom: '4px',
					marginTop: '-35px',
					borderBottom: '3px solid #8B0000',
				}}
			>
				<div
					style={{
						fontSize: '14px',
						fontWeight: 'bold',
						color: textColor,
						fontFamily: 'Times, "Times New Roman", serif',
						lineHeight: 1.3,
					}}
				>
					{getFirstAndLastName(employee.fullName).toUpperCase()}
				</div>
				<div
					style={{
						fontSize: '9px',
						fontWeight: 'normal',
						color: textColor,
						fontFamily: 'Times, "Times New Roman", serif',
						lineHeight: 1.2,
					}}
				>
					{employee.personType.toUpperCase()}
				</div>
				<div
					style={{
						fontSize: '9px',
						fontWeight: 'normal',
						color: textColor,
						fontFamily: 'Times, "Times New Roman", serif',
						lineHeight: 1.2,
					}}
				>
					{academicYear}
				</div>
			</div>

			{/* Red Separator Line */}
			{/* <div
				style={{
					width: '100%',
					height: '3px',
					backgroundColor: separatorColor,
					marginBottom: '8px',
				}}
			/> */}

			{/* Bottom Section: Barcode + ID Number */}
			<div
				style={{
					display: 'flex',
					flexDirection: 'row',
					justifyContent: 'space-between',
					alignItems: 'flex-end',
					marginTop: '0px',
				}}
			>
				{barcodeDataURL && (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'flex-start',
							gap: '2px',
						}}
					>
						<img
							src={barcodeDataURL}
							alt="Barcode"
							style={{
								width: '100px',
								height: '25px',
								objectFit: 'contain',
							}}
						/>
					</div>
				)}
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'flex-end',
						gap: '2px',
					}}
				>
					<div
						style={{
							fontSize: '7px',
							fontWeight: 'normal',
							color: textColor,
							fontFamily: 'Times, "Times New Roman", serif',
						}}
					>
						ID NUMBER:
					</div>
					<div
						style={{
							fontSize: '12px',
							fontWeight: 'bold',
							color: textColor,
							fontFamily: 'Times, "Times New Roman", serif',
						}}
					>
						{employee.sisEmployeeId}
					</div>
				</div>
			</div>
		</div>
	)
}

/**
 * Preview version: React/HTML component for ID card back
 * Used for browser preview of ID cards
 * Accepts QR code data URL (base64) for display
 */
export function IDCardBackPreview({
	qrCodeDataURL,
	branding,
}: IDCardBackProps) {
	// Convert points to pixels (assuming 72 DPI: 1 point = 1 pixel)
	const widthPx = ID_WIDTH
	const heightPx = ID_HEIGHT
	const bgColor = '#d0e0e3'

	return (
		<div
			className="flex flex-col items-center justify-center gap-2 border border-black"
			style={{
				width: `${widthPx}px`,
				height: `${heightPx}px`,
				backgroundColor: bgColor,
				padding: '12px',
			}}
		>
			<div className="flex items-center justify-center">
				<img
					src={qrCodeDataURL}
					alt="QR Code"
					style={{ width: '100px', height: '100px' }}
				/>
			</div>
			<div
				style={{
					fontSize: '8px',
					color: '#000000',
					textAlign: 'center',
				}}
			>
				Scan to verify ID status
			</div>
			<div
				style={{
					fontSize: '10px',
					fontWeight: 'bold',
					color: '#000000',
				}}
			>
				{branding.schoolName.toUpperCase()}
			</div>
		</div>
	)
}
