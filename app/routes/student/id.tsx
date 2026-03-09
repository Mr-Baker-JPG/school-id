import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useNavigation } from 'react-router'
import {
	IDCardFrontPreview,
	IDCardBackPreview,
} from '#app/components/employee-id-card.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { IdPreviewCard } from '#app/ui/components/IdPreviewCard.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { PrimaryActionBar } from '#app/ui/components/PrimaryActionBar.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { generateBarcodeDataURL } from '#app/utils/barcode.server.ts'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	getExpirationStatus,
	getCurrentAcademicYear,
	getDefaultExpirationDate,
} from '#app/utils/employee.server.ts'
import {
	getNextJuly1ExpirationDate,
	fetchAndCacheFactsProfilePicture,
} from '#app/utils/student.server.ts'
import { cn, getStudentPhotoSrc } from '#app/utils/misc.tsx'
import { generateStudentQRCodeDataURL } from '#app/utils/qr-code.server.ts'
import { type Route } from './+types/id.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)

	// Get the authenticated user's email
	const user = await prisma.user.findUnique({
		select: { email: true },
		where: { id: userId },
	})

	invariantResponse(user, 'User not found', { status: 404 })

	// Find the student record by email
	const student = await prisma.student.findUnique({
		where: { email: user.email },
		select: {
			id: true,
			sisStudentId: true,
			fullName: true,
			email: true,
			status: true,
			studentId: {
				select: {
					photoUrl: true,
					expirationDate: true,
				},
			},
		},
	})

	invariantResponse(
		student,
		'Student record not found. Please contact an administrator if you believe this is an error.',
		{ status: 404 },
	)

	// Ensure StudentID record exists (create if missing)
	let studentIdRecord = student.studentId
	if (!studentIdRecord) {
		studentIdRecord = await prisma.studentID.create({
			data: {
				studentId: student.id,
				expirationDate: getNextJuly1ExpirationDate(),
			},
			select: {
				photoUrl: true,
				expirationDate: true,
			},
		})
	}

	// Fetch FACTS profile picture if no uploaded photo
	if (!studentIdRecord?.photoUrl) {
		try {
			await fetchAndCacheFactsProfilePicture(student.id, student.sisStudentId)
			// Re-fetch to get the updated photoUrl
			const updatedStudentId = await prisma.studentID.findUnique({
				where: { studentId: student.id },
				select: {
					photoUrl: true,
					expirationDate: true,
				},
			})
			if (updatedStudentId) {
				studentIdRecord = updatedStudentId
			}
		} catch (error) {
			// Log error but continue without photo
			console.error('Failed to fetch FACTS profile picture:', error)
		}
	}

	// Get branding config
	const branding = getBrandingConfig()

	// Get photo URL (objectKey from database)
	let photoUrl: string | null = studentIdRecord?.photoUrl ?? null

	// Get logo URL (if configured)
	const logoUrl = branding.logoUrl || null

	// Generate QR code for verification
	const qrCodeDataURL = await generateStudentQRCodeDataURL(student.id, request)

	// Generate barcode for ID card
	const barcodeDataURL = await generateBarcodeDataURL(student.sisStudentId, {
		width: 2,
		height: 40,
		format: 'CODE128',
		displayValue: false,
	})

	// Calculate expiration status
	let expirationStatus = null
	if (studentIdRecord.expirationDate) {
		expirationStatus = getExpirationStatus(studentIdRecord.expirationDate)
	}

	// Get current academic year
	const academicYear = getCurrentAcademicYear()

	// Ensure we always have an expiration date for the component
	const defaultExpirationDate = getNextJuly1ExpirationDate()

	return {
		student: {
			...student,
			studentId: studentIdRecord,
		},
		branding,
		photoUrl,
		logoUrl,
		qrCodeDataURL,
		barcodeDataURL,
		expirationStatus,
		academicYear,
		defaultExpirationDate,
	}
}

export default function StudentIdRoute({ loaderData }: Route.ComponentProps) {
	const {
		student,
		branding,
		photoUrl,
		logoUrl,
		qrCodeDataURL,
		barcodeDataURL,
		expirationStatus,
		academicYear,
		defaultExpirationDate,
	} = loaderData

	const hasPhoto = !!student.studentId?.photoUrl
	const displayPhotoUrl = photoUrl ? getStudentPhotoSrc(photoUrl) : null
	const expirationDate = student.studentId?.expirationDate
		? new Date(student.studentId.expirationDate).toLocaleDateString()
		: 'Not set'

	// Prepare student data for ID card component
	// Students use "STUDENT" as their personType label
	const studentCardData = {
		id: student.id,
		fullName: student.fullName,
		personType: 'STUDENT' as const,
		email: student.email,
		status: student.status,
		sisEmployeeId: student.sisStudentId, // Using sisEmployeeId field name for component compatibility
		photoUrl: student.studentId?.photoUrl || null,
		expirationDate: student.studentId?.expirationDate
			? new Date(student.studentId.expirationDate)
			: new Date(defaultExpirationDate),
	}

	// Check if navigating to wallet route
	const navigation = useNavigation()
	const isAddingToWallet =
		navigation.state === 'loading' &&
		navigation.location?.pathname === `/resources/student/wallet/${student.id}`

	// Check if downloading PDF
	const isDownloadingPDF =
		navigation.state === 'loading' &&
		navigation.location?.pathname === `/resources/student-pdf`

	const primaryAction = (
		<a href={`/resources/student/wallet/${student.id}`}>
			<StatusButton
				size="lg"
				status={isAddingToWallet ? 'pending' : 'idle'}
				disabled={isAddingToWallet}
			>
				<Icon name="plus">Add to Wallet</Icon>
			</StatusButton>
		</a>
	)

	const secondaryActions = [
		{
			label: 'Download PDF',
			icon: 'download' as const,
			href: `/resources/student-pdf`,
			asChild: true,
			loading: isDownloadingPDF,
		},
	]

	return (
		<div className="pb-20 md:pb-8">
			<PageTitle title="My Student ID" />

			{/* Actions Section - Hidden on mobile, shown on desktop */}
			<div className="mt-6 hidden md:block">
				<PrimaryActionBar
					primaryAction={primaryAction}
					secondaryActions={secondaryActions}
				/>
			</div>

			<div className="mt-8 grid gap-6 md:grid-cols-2">
				{/* Left Column: ID Card Previews */}
				<div className="space-y-6">
					<CardSection title="Front" className="border-muted/50 shadow-sm">
						<IdPreviewCard
							title="Front of ID"
							previewContent={
								<IDCardFrontPreview
									employee={studentCardData}
									photoUrl={displayPhotoUrl}
									logoUrl={logoUrl}
									branding={branding}
									academicYear={academicYear}
									barcodeDataURL={barcodeDataURL}
								/>
							}
						>
							<div className="flex justify-center">
								<IDCardFrontPreview
									employee={studentCardData}
									photoUrl={displayPhotoUrl}
									logoUrl={logoUrl}
									branding={branding}
									academicYear={academicYear}
									barcodeDataURL={barcodeDataURL}
								/>
							</div>
						</IdPreviewCard>
					</CardSection>
					<CardSection title="Back" className="border-muted/50 shadow-sm">
						<IdPreviewCard
							title="Back of ID"
							previewContent={
								<IDCardBackPreview
									qrCodeDataURL={qrCodeDataURL}
									branding={branding}
								/>
							}
						>
							<div className="flex justify-center">
								<IDCardBackPreview
									qrCodeDataURL={qrCodeDataURL}
									branding={branding}
								/>
							</div>
						</IdPreviewCard>
					</CardSection>
				</div>

				{/* Right Column: Status and Info */}
				<div className="space-y-6">
					{/* Mobile: Compact Status + Expiration Card */}
					<CardSection className="border-muted/50 shadow-sm md:hidden">
						<div className="flex flex-col gap-3">
							{expirationStatus && (
								<div className="flex items-center gap-2">
									<StatusBadge
										variant={
											expirationStatus.type === 'valid'
												? 'valid'
												: expirationStatus.type === 'expiring'
													? 'expiring'
													: 'expired'
										}
									>
										{expirationStatus.type === 'valid'
											? '✓ Valid'
											: expirationStatus.type === 'expiring'
												? `Expiring in ${expirationStatus.daysUntilExpiration} days`
												: 'Expired'}
									</StatusBadge>
									<span className="text-muted-foreground">·</span>
									<div className="flex items-center gap-1.5">
										<Icon name="calendar" className="size-4" />
										<span className="text-sm">Expires {expirationDate}</span>
									</div>
								</div>
							)}
						</div>
					</CardSection>

					{/* Desktop: Separate Status Card */}
					<CardSection
						title="Status"
						className="border-muted/50 hidden shadow-sm md:block"
					>
						<div className="flex flex-col gap-4">
							{expirationStatus && (
								<div>
									<StatusBadge
										variant={
											expirationStatus.type === 'valid'
												? 'valid'
												: expirationStatus.type === 'expiring'
													? 'expiring'
													: 'expired'
										}
									>
										{expirationStatus.type === 'valid'
											? 'Valid'
											: expirationStatus.type === 'expiring'
												? `Expiring in ${expirationStatus.daysUntilExpiration} days`
												: 'Expired'}
									</StatusBadge>
								</div>
							)}
						</div>
					</CardSection>

					{/* Desktop: Separate Expiration Card */}
					<CardSection
						title="Expiration"
						className="border-muted/50 hidden shadow-sm md:block"
					>
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Icon name="calendar" className="size-5" />
								<span className="text-h4 font-semibold">{expirationDate}</span>
							</div>
							{expirationStatus && expirationStatus.type !== 'valid' && (
								<p
									className={cn(
										'text-sm',
										expirationStatus.type === 'expired'
											? 'text-destructive'
											: 'text-amber-600 dark:text-amber-500',
									)}
								>
									{expirationStatus.type === 'expired'
										? 'Expired'
										: 'Expiring soon'}
								</p>
							)}
						</div>
					</CardSection>

					<CardSection title="Your Info" className="border-muted/50 shadow-sm">
						<KeyValueList
							items={[
								{ key: 'Name', value: student.fullName },
								{ key: 'Type', value: 'STUDENT' },
								{ key: 'Email', value: student.email },
							]}
						/>
					</CardSection>
				</div>
			</div>

			{/* Mobile Sticky Action Buttons */}
			<div
				className="bg-background/95 fixed inset-x-0 bottom-0 z-50 border-t p-3 shadow-lg backdrop-blur md:hidden"
				style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
			>
				<PrimaryActionBar
					primaryAction={primaryAction}
					secondaryActions={secondaryActions}
				/>
			</div>
		</div>
	)
}

export const meta: Route.MetaFunction = ({ data }) => {
	return [
		{ title: `My Student ID | ${data?.student.fullName ?? 'Student'}` },
		{
			name: 'description',
			content: `Student ID for ${data?.student.fullName ?? 'student'}`,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: ({ error }) => (
					<p>You are not allowed to access this page: {error?.data.message}</p>
				),
				404: () => (
					<p>
						Student record not found. Please contact an administrator if you
						believe this is an error.
					</p>
				),
			}}
		/>
	)
}
