import { invariantResponse } from '@epic-web/invariant'
import { Img } from 'openimg/react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, Link } from 'react-router'
import {
	IDCardFrontPreview,
	IDCardBackPreview,
} from '#app/components/employee-id-card.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { IdPreviewCard } from '#app/ui/components/IdPreviewCard.tsx'
import { prisma } from '#app/utils/db.server.ts'
import {
	getNextJuly1ExpirationDate,
	fetchAndCacheFactsProfilePicture,
	getExpirationStatus,
} from '#app/utils/student.server.ts'
import { getCurrentAcademicYear } from '#app/utils/employee.server.ts'
import { generateBarcodeDataURL } from '#app/utils/barcode.server.ts'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { getStudentPhotoSrc, useIsPending } from '#app/utils/misc.tsx'
import { generateStudentQRCodeDataURL } from '#app/utils/qr-code.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/$studentId.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request, params }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const { studentId } = params

	invariantResponse(studentId, 'Student ID is required', { status: 400 })

	// Check for force photo check parameter
	const url = new URL(request.url)
	const forcePhotoCheck = url.searchParams.get('forcePhotoCheck') === 'true'

	// Fetch student with all related data
	const student = await prisma.student.findUnique({
		where: { id: studentId },
		select: {
			id: true,
			sisStudentId: true,
			firstName: true,
			lastName: true,
			fullName: true,
			email: true,
			grade: true,
			status: true,
			isNameEdited: true,
			createdAt: true,
			updatedAt: true,
			studentId: {
				select: {
					photoUrl: true,
					expirationDate: true,
					createdAt: true,
					updatedAt: true,
					factsPhotoCheckedAt: true,
				},
			},
		},
	})

	invariantResponse(student, 'Student not found', { status: 404 })

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
				createdAt: true,
				updatedAt: true,
				factsPhotoCheckedAt: true,
			},
		})
	}

	// Fetch FACTS profile picture
	// - If forcePhotoCheck=true, bypass rate limiting and always fetch
	// - If no uploaded photo exists, try to fetch (respects 7-day rate limit)
	let photoCheckAttempted = false
	let photoCheckResult: { success: boolean; message: string } | null = null

	if (forcePhotoCheck || !studentIdRecord?.photoUrl) {
		photoCheckAttempted = true
		try {
			const photoUrl = await fetchAndCacheFactsProfilePicture(
				student.id,
				student.sisStudentId,
				forcePhotoCheck, // Force bypass rate limiting if requested
			)
			
			// Re-fetch to get the updated photoUrl
			const updatedStudentId = await prisma.studentID.findUnique({
				where: { studentId: student.id },
				select: {
					photoUrl: true,
					expirationDate: true,
					createdAt: true,
					updatedAt: true,
					factsPhotoCheckedAt: true,
				},
			})
			if (updatedStudentId) {
				studentIdRecord = updatedStudentId
			}

			// Set result message
			if (photoUrl) {
				photoCheckResult = {
					success: true,
					message: 'Profile picture successfully fetched from FACTS and cached.',
				}
			} else {
				photoCheckResult = {
					success: false,
					message: studentIdRecord?.photoUrl
						? 'No new photo found in FACTS (existing photo retained).'
						: 'No profile picture found in FACTS for this student.',
				}
			}
		} catch (error) {
			// Log error but continue without photo
			console.error('Failed to fetch FACTS profile picture:', error)
			photoCheckResult = {
				success: false,
				message: `Error fetching photo from FACTS: ${error instanceof Error ? error.message : 'Unknown error'}`,
			}
		}
	}

	// Get branding config
	const branding = getBrandingConfig()

	// Get photo URL (objectKey from database)
	const photoUrl: string | null = studentIdRecord?.photoUrl ?? null

	// Get logo URL (if configured)
	const logoUrl = branding.logoUrl || null

	// Generate QR code for verification (using SIS ID)
	const qrCodeDataURL = await generateStudentQRCodeDataURL(
		student.sisStudentId,
		request,
	)

	// Generate barcode for ID card
	const barcodeDataURL = await generateBarcodeDataURL(student.sisStudentId, {
		width: 2,
		height: 40,
		format: 'CODE128',
		displayValue: false,
	})

	// Get current academic year
	const academicYear = getCurrentAcademicYear()

	// Calculate expiration status
	let expirationStatus = null
	if (studentIdRecord.expirationDate) {
		expirationStatus = getExpirationStatus(studentIdRecord.expirationDate)
	}

	// Ensure we always have an expiration date for the component
	const defaultExpirationDate = getNextJuly1ExpirationDate()

	return {
		student: {
			...student,
			studentId: studentIdRecord,
		},
		photoCheckResult,
		forcePhotoCheck,
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

export async function action({ request, params }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const { studentId } = params
	const formData = await request.formData()
	const intent = formData.get('intent')

	invariantResponse(studentId, 'Student ID is required', { status: 400 })

	if (intent === 'update-name') {
		const fullName = formData.get('fullName')
		invariantResponse(
			typeof fullName === 'string' && fullName.trim().length > 0,
			'Full name is required',
			{ status: 400 },
		)

		// Update student name and mark as edited
		await prisma.student.update({
			where: { id: studentId },
			data: {
				fullName: fullName.trim(),
				isNameEdited: true, // Mark as edited to preserve during SIS sync
			},
		})

		return redirectWithToast(`/admin/students/${studentId}`, {
			type: 'success',
			title: 'Name Updated',
			description: 'Student name has been updated and will be preserved during SIS syncs.',
		})
	}

	return redirectWithToast(`/admin/students/${studentId}`, {
		type: 'error',
		title: 'Error',
		description: 'Unknown action',
	})
}

export default function AdminStudentDetailRoute({
	loaderData,
}: Route.ComponentProps) {
	const {
		student,
		photoCheckResult,
		forcePhotoCheck,
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
	const lastUpdated = new Date(student.updatedAt).toLocaleString()
	const isNameUpdatePending = useIsPending({
		formAction: `/admin/students/${student.id}`,
		intent: 'update-name',
	})
	const isPhotoCheckPending = useIsPending({
		formAction: `/admin/students/${student.id}`,
	})

	// Prepare student data for ID card component
	const studentCardData = {
		id: student.id,
		firstName: student.firstName,
		lastName: student.lastName,
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

	const downloadButton = (
		<Button
			type="button"
			onClick={() => {
				window.location.href = `/resources/admin/student-pdf/${student.id}`
			}}
		>
			<Icon name="download">Download ID Card</Icon>
		</Button>
	)

	return (
		<div>
			<div className="mb-4">
				<Link
					to="/admin/students"
					className="text-muted-foreground hover:text-foreground flex items-center gap-2"
				>
					<Icon name="arrow-left">Back to Students</Icon>
				</Link>
			</div>

			<PageTitle
				title="Student Details"
				subtitle={student.fullName}
				rightSlot={downloadButton}
			/>

			<div className="mt-8 grid gap-6 md:grid-cols-2">
				{/* Left Column: Photo */}
				<CardSection title="Photo">
					<div className="flex flex-col gap-4">
						{/* Photo display */}
						<div className="flex items-center gap-4">
							{hasPhoto ? (
								<Img
									src={getStudentPhotoSrc(student.studentId?.photoUrl)}
									alt={student.fullName}
									className="size-32 rounded-lg object-cover"
									width={128}
									height={128}
								/>
							) : (
								<div className="bg-muted-foreground/20 flex size-32 items-center justify-center rounded-lg">
									<Icon name="avatar" className="text-muted-foreground size-16" />
								</div>
							)}
							<div className="flex flex-col gap-2">
								<Button asChild variant="outline">
									<Link to={`/admin/students/${student.id}/photo`}>
										<Icon name="pencil-1">
											{hasPhoto ? 'Change Photo' : 'Upload Photo'}
										</Icon>
									</Link>
								</Button>
								<Button
									asChild
									variant="outline"
									className={
										forcePhotoCheck ? 'border-primary bg-primary/10' : ''
									}
								>
									<Link to={`/admin/students/${student.id}?forcePhotoCheck=true`}>
										<Icon name="refresh">
											{isPhotoCheckPending
												? 'Checking FACTS...'
												: 'Refresh from FACTS'}
										</Icon>
									</Link>
								</Button>
							</div>
						</div>

						{/* Photo check result message */}
						{photoCheckResult && (
							<div
								className={`rounded-lg border p-3 ${
									photoCheckResult.success
										? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
										: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
								}`}
							>
								<div className="flex items-start gap-2">
									<Icon
										name={photoCheckResult.success ? 'check' : 'info'}
										className="mt-0.5 size-4 flex-shrink-0"
									/>
									<div className="text-sm">{photoCheckResult.message}</div>
								</div>
							</div>
						)}

						{/* Last checked info */}
						{student.studentId?.factsPhotoCheckedAt && !forcePhotoCheck && (
							<div className="text-muted-foreground text-xs">
								Last checked FACTS:{' '}
								{new Date(
									student.studentId.factsPhotoCheckedAt,
								).toLocaleString()}
							</div>
						)}
					</div>
				</CardSection>

				{/* Right Column: Student Info */}
				<CardSection title="Student Info">
					<KeyValueList
						items={[
							{ key: 'Full Name', value: student.fullName },
							{ key: 'Email', value: student.email },
							{ key: 'Grade', value: student.grade || 'Not set' },
							{
								key: 'SIS Student ID',
								value: student.sisStudentId,
								mono: true,
							},
							{
								key: 'Status',
								value: (
									<StatusBadge
										variant={
											student.status === 'active' ? 'active' : 'inactive'
										}
									>
										{student.status}
									</StatusBadge>
								),
							},
							{
								key: 'Name Edited',
								value: student.isNameEdited ? 'Yes (preserved during sync)' : 'No',
							},
						]}
					/>
				</CardSection>
			</div>

			<div className="mt-6 grid gap-6 md:grid-cols-2">
				{/* Edit Name Section */}
				<CardSection title="Edit Name">
					<p className="text-muted-foreground mb-4 text-sm">
						Edit the student's name. Once edited, the name will be preserved
						during SIS syncs.
					</p>
					<Form method="post" className="flex flex-col gap-4">
						<input type="hidden" name="intent" value="update-name" />
						<div className="flex flex-col gap-1">
							<label htmlFor="fullName" className="text-body-xs">
								Full Name
							</label>
							<input
								type="text"
								id="fullName"
								name="fullName"
								defaultValue={student.fullName}
								className="border-input bg-background h-10 rounded-md border px-3 py-2"
								required
							/>
						</div>
						<StatusButton
							type="submit"
							status={isNameUpdatePending ? 'pending' : 'idle'}
							disabled={isNameUpdatePending}
						>
							<Icon name="pencil-1">Save Name</Icon>
						</StatusButton>
					</Form>
				</CardSection>

				{/* ID Card Info */}
				<CardSection title="ID Card Info">
					<KeyValueList
						items={[
							{
								key: 'Expiration Date',
								value: expirationDate,
								mono: true,
							},
						]}
					/>
					<div className="mt-4">
						<Button asChild variant="outline" size="sm">
							<Link to={`/admin/students/${student.id}/expiration`}>
								<Icon name="pencil-1">Update</Icon>
							</Link>
						</Button>
					</div>
				</CardSection>
			</div>

			<div className="mt-6">
				{/* SIS Sync Status */}
				<CardSection title="SIS Sync Status">
					<KeyValueList
						items={[
							{
								key: 'Last Updated from SIS',
								value: lastUpdated,
								mono: true,
							},
							{
								key: 'Name Protected',
								value: student.isNameEdited
									? 'Yes - name edits will be preserved during sync'
									: 'No - name will be updated from SIS during sync',
							},
						]}
					/>
				</CardSection>
			</div>

			{/* ID Card Preview Section */}
			<div className="mt-6">
				<h2 className="mb-4 text-xl font-semibold">ID Card Preview</h2>
				<div className="grid gap-6 md:grid-cols-2">
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
			</div>
		</div>
	)
}

export const meta: Route.MetaFunction = ({ data }) => {
	return [
		{
			title: `Student Details | ${data?.student.fullName ?? 'Student'}`,
		},
		{
			name: 'description',
			content: `Student details for ${data?.student.fullName ?? 'student'}`,
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
				404: () => <p>Student not found.</p>,
			}}
		/>
	)
}
