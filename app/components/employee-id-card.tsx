/**
 * Reusable Employee ID Card Components
 * 
 * This module provides both PDF (React PDF) and Preview (React/HTML) versions
 * of the employee ID card layout components for use in PDF generation and
 * browser preview.
 */

import {
	Document,
	Page,
	Text,
	View,
	Image,
	StyleSheet,
} from '@react-pdf/renderer'
import { format } from 'date-fns'
import { type BrandingConfig } from '#app/utils/branding.server.ts'

/**
 * Employee data required for ID card generation
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
}

/**
 * Props for ID card front component (Preview version)
 */
export interface IDCardFrontPreviewProps {
	employee: EmployeePDFData
	photoUrl: string | null
	logoUrl: string | null
	branding: BrandingConfig
}

/**
 * Props for ID card back component
 */
export interface IDCardBackProps {
	qrCodeDataURL: string
	branding: BrandingConfig
}

/**
 * Creates PDF styles with branding colors
 * Note: React PDF StyleSheet.create doesn't support dynamic values,
 * so we create styles dynamically based on branding config
 */
export function createIDCardPDFStyles(branding: BrandingConfig) {
	return StyleSheet.create({
		page: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			padding: 0,
		},
		frontPage: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			backgroundColor: branding.secondaryColor,
			padding: 12,
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			gap: 12,
		},
		backPage: {
			width: ID_WIDTH,
			height: ID_HEIGHT,
			backgroundColor: branding.secondaryColor,
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
			color: branding.primaryColor,
			marginBottom: 2,
		},
		name: {
			fontSize: 14,
			fontWeight: 'bold',
			color: branding.primaryColor,
			marginBottom: 2,
		},
		jobTitle: {
			fontSize: 10,
			color: branding.primaryColor,
			opacity: 0.7,
			marginBottom: 4,
		},
		employeeId: {
			fontSize: 8,
			color: branding.primaryColor,
			opacity: 0.7,
			marginBottom: 2,
		},
		expiration: {
			fontSize: 8,
			color: branding.primaryColor,
			opacity: 0.7,
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
			color: branding.primaryColor,
			opacity: 0.7,
			textAlign: 'center',
			marginTop: 4,
		},
	})
}

/**
 * PDF version: React PDF component for ID card front
 */
export function IDCardFrontPDF({
	employee,
	photoDataURL,
	logoDataURL,
	branding,
}: IDCardFrontPDFProps) {
	const styles = createIDCardPDFStyles(branding)
	return (
		<Page size={[ID_WIDTH, ID_HEIGHT]} style={styles.page}>
			<View style={styles.frontPage}>
				{/* Photo Section */}
				<View style={styles.photoContainer}>
					{photoDataURL ? (
						<Image src={photoDataURL} style={styles.photo} />
					) : (
						<View style={styles.photoPlaceholder}>
							<Text
								style={{
									fontSize: 8,
									color: branding.primaryColor,
									opacity: 0.5,
								}}
							>
								No Photo
							</Text>
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
 * PDF version: React PDF component for ID card back
 */
export function IDCardBackPDF({
	qrCodeDataURL,
	branding,
}: IDCardBackProps) {
	const styles = createIDCardPDFStyles(branding)
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
 * Preview version: React/HTML component for ID card front
 * Used for browser preview of ID cards
 * Accepts regular URLs (not base64 data URLs) for photos and logos
 */
export function IDCardFrontPreview({
	employee,
	photoUrl,
	logoUrl,
	branding,
}: IDCardFrontPreviewProps) {
	// Convert points to pixels (assuming 72 DPI: 1 point = 1 pixel)
	const widthPx = ID_WIDTH
	const heightPx = ID_HEIGHT

	return (
		<div
			className="flex items-center gap-3 rounded-lg border-2 p-3"
			style={{
				width: `${widthPx}px`,
				height: `${heightPx}px`,
				backgroundColor: branding.secondaryColor,
				borderColor: branding.primaryColor,
			}}
		>
			{/* Photo Section */}
			<div
				className="flex items-center justify-center overflow-hidden rounded"
				style={{
					width: '80px',
					height: '100px',
					backgroundColor: '#f0f0f0',
				}}
			>
				{photoUrl ? (
					<img
						src={photoUrl}
						alt={employee.fullName}
						className="h-full w-full object-cover"
					/>
				) : (
					<div
						className="flex items-center justify-center"
						style={{
							width: '80px',
							height: '100px',
							backgroundColor: '#e0e0e0',
							color: branding.primaryColor,
							opacity: 0.5,
							fontSize: '8px',
						}}
					>
						No Photo
					</div>
				)}
			</div>

			{/* Info Section */}
			<div className="flex flex-1 flex-col gap-1">
				{logoUrl && (
					<div className="mb-1 flex items-center justify-center">
						<img
							src={logoUrl}
							alt={branding.schoolName}
							className="h-10 w-10 object-contain"
						/>
					</div>
				)}
				<div
					className="text-xs font-bold"
					style={{ color: branding.primaryColor }}
				>
					{branding.schoolName}
				</div>
				<div
					className="text-sm font-bold"
					style={{ color: branding.primaryColor }}
				>
					{employee.fullName}
				</div>
				<div
					className="text-xs"
					style={{ color: branding.primaryColor, opacity: 0.7 }}
				>
					{employee.jobTitle}
				</div>
				<div
					className="text-[8px]"
					style={{ color: branding.primaryColor, opacity: 0.7 }}
				>
					ID: {employee.sisEmployeeId}
				</div>
				<div
					className="mt-auto text-[8px]"
					style={{ color: branding.primaryColor, opacity: 0.7 }}
				>
					Expires: {format(employee.expirationDate, 'MM/dd/yyyy')}
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

	return (
		<div
			className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-3"
			style={{
				width: `${widthPx}px`,
				height: `${heightPx}px`,
				backgroundColor: branding.secondaryColor,
				borderColor: branding.primaryColor,
			}}
		>
			<div className="flex items-center justify-center">
				<img
					src={qrCodeDataURL}
					alt="QR Code"
					className="h-[120px] w-[120px]"
				/>
			</div>
			<div
				className="text-center text-[8px]"
				style={{ color: branding.primaryColor, opacity: 0.7 }}
			>
				Scan to verify employee status
			</div>
			<div
				className="text-xs font-bold"
				style={{ color: branding.primaryColor }}
			>
				{branding.schoolName}
			</div>
		</div>
	)
}