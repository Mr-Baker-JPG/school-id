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
import { DossierHeader } from '#app/ui/components/DossierHeader.tsx'
import { SectionTitle } from '#app/ui/components/SectionTitle.tsx'
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
	let photoCheckAttempted = false
	let photoCheckResult: { success: boolean; message: string } | null = null

	if (forcePhotoCheck || !studentIdRecord?.photoUrl) {
		photoCheckAttempted = true
		try {
			const photoUrl = await fetchAndCacheFactsProfilePicture(
				student.id,
				student.sisStudentId,
				forcePhotoCheck,
			)

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

			if (photoUrl) {
				photoCheckResult = {
					success: true,
					message:
						'Profile picture successfully fetched from FACTS and cached.',
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
			console.error('Failed to fetch FACTS profile picture:', error)
			photoCheckResult = {
				success: false,
				message: `Error fetching photo from FACTS: ${error instanceof Error ? error.message : 'Unknown error'}`,
			}
		}
	}

	const branding = await getBrandingConfig()
	const photoUrl: string | null = studentIdRecord?.photoUrl ?? null
	const logoUrl = branding.logoUrl || null

	const qrCodeDataURL = await generateStudentQRCodeDataURL(
		student.sisStudentId,
		request,
	)

	const barcodeDataURL = await generateBarcodeDataURL(student.sisStudentId, {
		width: 2,
		height: 40,
		format: 'CODE128',
		displayValue: false,
	})

	const academicYear = getCurrentAcademicYear()

	let expirationStatus = null
	if (studentIdRecord.expirationDate) {
		expirationStatus = getExpirationStatus(studentIdRecord.expirationDate)
	}

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

		await prisma.student.update({
			where: { id: studentId },
			data: {
				fullName: fullName.trim(),
				isNameEdited: true,
			},
		})

		return redirectWithToast(`/admin/students/${studentId}`, {
			type: 'success',
			title: 'Name Updated',
			description:
				'Student name has been updated and will be preserved during SIS syncs.',
		})
	}

	if (intent === 'reset-name-sync') {
		await prisma.student.update({
			where: { id: studentId },
			data: {
				isNameEdited: false,
			},
		})

		return redirectWithToast(`/admin/students/${studentId}`, {
			type: 'success',
			title: 'Name Sync Reset',
			description: 'Name will be updated from FACTS SIS on the next sync.',
		})
	}

	if (intent === 'reset-name-sync') {
		// Reset the isNameEdited flag to allow name to be updated from SIS on next sync
		await prisma.student.update({
			where: { id: studentId },
			data: {
				isNameEdited: false,
			},
		})

		return redirectWithToast(`/admin/students/${studentId}`, {
			type: 'success',
			title: 'Name Sync Reset',
			description: 'Name will be updated from FACTS SIS on the next sync.',
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
	})
	const isPhotoCheckPending = useIsPending({
		formAction: `/admin/students/${student.id}`,
	})

	const studentCardData = {
		id: student.id,
		firstName: student.firstName,
		lastName: student.lastName,
		fullName: student.fullName,
		personType: 'STUDENT' as const,
		email: student.email,
		status: student.status,
		sisEmployeeId: student.sisStudentId,
		photoUrl: student.studentId?.photoUrl || null,
		expirationDate: student.studentId?.expirationDate
			? new Date(student.studentId.expirationDate)
			: new Date(defaultExpirationDate),
	}

	return (
		<div className="font-body">
			{/* Back link — visible only on mobile where the list panel is hidden */}
			<div className="mb-6 md:hidden">
				<Link
					to="/admin/students"
					className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-mono text-xs tracking-[0.1em] uppercase transition-colors"
				>
					<Icon name="arrow-left" className="size-3.5" />
					Back to Students
				</Link>
			</div>

			{/* ── PHOTO CHECK NOTICE ── */}
			{photoCheckResult && (
				<div
					className={`font-body mb-5 flex items-center gap-2 border-l-[3px] px-4 py-2.5 text-sm ${
						photoCheckResult.success
							? 'border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-400'
							: 'border-amber-600 bg-amber-50 text-amber-800 dark:border-amber-400 dark:bg-amber-950/30 dark:text-amber-400'
					}`}
				>
					<Icon
						name={photoCheckResult.success ? 'check' : 'question-mark-circled'}
						className="mt-0.5 size-4 flex-shrink-0"
					/>
					{photoCheckResult.message}
				</div>
			)}

			{/* ── DOSSIER HEADER ── */}
			<DossierHeader
				name={student.fullName}
				subtitle={`${student.grade ? `Grade ${student.grade}` : 'Student'} · ${student.email}`}
				typeLabel="Student"
				photoUrl={displayPhotoUrl}
				photoAlt={student.fullName}
				status={student.status}
				idValid={
					student.studentId?.expirationDate
						? new Date(student.studentId.expirationDate) > new Date()
						: undefined
				}
				extraStamps={
					student.isNameEdited
						? [{ label: 'Name Edited', variant: 'expiring' as const }]
						: undefined
				}
				photoActions={
					<>
						<Button
							asChild
							size="sm"
							className="bg-primary/90 text-brand-gold hover:bg-brand-red flex-1 rounded-none font-mono text-[0.6rem] tracking-wide uppercase"
						>
							<Link to={`/admin/students/${student.id}/photo`}>
								{hasPhoto ? 'Change' : 'Upload'}
							</Link>
						</Button>
						<Button
							asChild
							size="sm"
							className={`bg-primary/90 text-brand-gold hover:bg-brand-red flex-1 rounded-none font-mono text-[0.6rem] tracking-wide uppercase ${
								forcePhotoCheck ? 'bg-brand-red' : ''
							}`}
						>
							<Link to={`/admin/students/${student.id}?forcePhotoCheck=true`}>
								{isPhotoCheckPending ? 'Checking…' : 'Refresh'}
							</Link>
						</Button>
					</>
				}
				actions={
					<>
						<Button
							className="bg-brand-gold font-body text-primary hover:bg-brand-gold/80 text-sm font-semibold"
							onClick={() => {
								window.location.href = `/resources/admin/student-pdf/${student.id}`
							}}
						>
							<Icon name="download" className="size-4" />
							Download ID Card
						</Button>
						<Button variant="outline" asChild className="font-body text-sm">
							<Link to={`/admin/students/${student.id}/expiration`}>
								<Icon name="pencil-1" className="size-4" />
								Edit Expiration
							</Link>
						</Button>
					</>
				}
			/>

			{/* ── 01 STUDENT RECORD + 02 ID CARD ── */}
			<div className="mt-10 grid gap-8 md:grid-cols-2">
				<div>
					<SectionTitle number="01">Student Record</SectionTitle>
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
										className="rotate-0"
									>
										{student.status}
									</StatusBadge>
								),
							},
							{
								key: 'Name Edited',
								value: student.isNameEdited
									? 'Yes (preserved during sync)'
									: 'No',
							},
						]}
					/>
				</div>

				<div>
					<SectionTitle number="02">ID Card</SectionTitle>
					<KeyValueList
						items={[
							{ key: 'Expiration', value: expirationDate, mono: true },
							{
								key: 'Status',
								value: (
									<StatusBadge
										variant={
											student.studentId?.expirationDate &&
											new Date(student.studentId.expirationDate) > new Date()
												? 'valid'
												: 'expired'
										}
										className="rotate-0"
									>
										{student.studentId?.expirationDate &&
										new Date(student.studentId.expirationDate) > new Date()
											? 'Valid'
											: 'Expired'}
									</StatusBadge>
								),
							},
							{ key: 'Last SIS Sync', value: lastUpdated, mono: true },
							{
								key: 'FACTS Photo',
								value: student.studentId?.factsPhotoCheckedAt
									? `Checked ${new Date(student.studentId.factsPhotoCheckedAt).toLocaleString()}`
									: 'Not checked',
								mono: true,
							},
						]}
					/>
				</div>
			</div>

			{/* ── 03 EDIT DISPLAY NAME ── */}
			<div className="mt-10">
				<SectionTitle number="03">Edit Display Name</SectionTitle>
				<div className="border-border bg-card relative overflow-hidden border p-5 shadow-sm">
					{/* Gold top accent */}
					<div className="from-brand-gold via-brand-gold/70 to-brand-gold absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r" />
					<p className="font-body text-muted-foreground mb-3 text-sm italic">
						Once edited, the name will be preserved during SIS syncs.
					</p>
					<Form method="post" className="flex gap-3">
						<input type="hidden" name="intent" value="update-name" />
						<div className="flex-1">
							<label
								htmlFor="fullName"
								className="text-muted-foreground mb-1 block font-mono text-[0.65rem] tracking-[0.08em] uppercase"
							>
								Full Name
							</label>
							<input
								type="text"
								id="fullName"
								name="fullName"
								defaultValue={student.fullName}
								className="border-input bg-background font-body text-foreground focus:border-brand-gold focus:ring-brand-gold/15 h-10 w-full border px-3 text-[0.95rem] transition-colors focus:ring-2 focus:outline-none"
								required
							/>
						</div>
						<div className="self-end">
							<StatusButton
								type="submit"
								status={isNameUpdatePending ? 'pending' : 'idle'}
								disabled={isNameUpdatePending}
								className="bg-primary font-body text-primary-foreground hover:bg-primary/90 text-sm"
							>
								Save Name
							</StatusButton>
						</div>
					</Form>
					{student.isNameEdited && (
						<Form method="post" className="mt-3">
							<input type="hidden" name="intent" value="reset-name-sync" />
							<button
								type="submit"
								className="text-brand-red hover:text-brand-red/80 inline-flex items-center gap-1 font-mono text-[0.68rem] tracking-[0.04em] uppercase transition-colors hover:underline"
							>
								<Icon name="update" className="size-3" />
								Allow Name Sync from SIS
							</button>
						</Form>
					)}
				</div>
			</div>

			{/* ── 04 FACTS SYNC STATUS ── */}
			<div className="mt-10">
				<SectionTitle number="04">FACTS Sync Status</SectionTitle>
				<KeyValueList
					items={[
						{ key: 'Last Updated', value: lastUpdated, mono: true },
						{
							key: 'Name Protected',
							value: student.isNameEdited
								? 'Yes — edits preserved during sync'
								: 'No — updated from FACTS during sync',
						},
					]}
				/>
			</div>

			{/* ── GOLD RULE ── */}
			<div className="via-brand-gold my-10 h-px bg-gradient-to-r from-transparent to-transparent" />

			{/* ── 05 ID CARD PREVIEW ── */}
			<SectionTitle number="05">ID Card Preview</SectionTitle>
			<div className="grid gap-6 md:grid-cols-2">
				<div className="border-border bg-card border p-5 shadow-sm">
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
					<p className="text-muted-foreground mt-3 text-center font-mono text-[0.65rem] tracking-[0.08em] uppercase">
						Front
					</p>
				</div>
				<div className="border-border bg-card border p-5 shadow-sm">
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
					<p className="text-muted-foreground mt-3 text-center font-mono text-[0.65rem] tracking-[0.08em] uppercase">
						Back
					</p>
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
