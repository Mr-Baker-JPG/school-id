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
import { DossierHeader } from '#app/ui/components/DossierHeader.tsx'
import { IdPreviewCard } from '#app/ui/components/IdPreviewCard.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { SectionTitle } from '#app/ui/components/SectionTitle.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { generateBarcodeDataURL } from '#app/utils/barcode.server.ts'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	getExpirationStatus,
	getCurrentAcademicYear,
} from '#app/utils/employee.server.ts'
import {
	getNextJuly1ExpirationDate,
	fetchAndCacheFactsProfilePicture,
} from '#app/utils/student.server.ts'
import { getStudentPhotoSrc } from '#app/utils/misc.tsx'
import { generateStudentQRCodeDataURL } from '#app/utils/qr-code.server.ts'
import { type Route } from './+types/id.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)

	const user = await prisma.user.findUnique({
		select: { email: true },
		where: { id: userId },
	})

	invariantResponse(user, 'User not found', { status: 404 })

	const student = await prisma.student.findUnique({
		where: { email: user.email },
		select: {
			id: true,
			sisStudentId: true,
			firstName: true,
			lastName: true,
			fullName: true,
			email: true,
			grade: true,
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

	if (!studentIdRecord?.photoUrl) {
		try {
			await fetchAndCacheFactsProfilePicture(student.id, student.sisStudentId)
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
			console.error('Failed to fetch FACTS profile picture:', error)
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

	let expirationStatus = null
	if (studentIdRecord.expirationDate) {
		expirationStatus = getExpirationStatus(studentIdRecord.expirationDate)
	}

	const academicYear = getCurrentAcademicYear()
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

	const navigation = useNavigation()
	const displayPhotoUrl = photoUrl ? getStudentPhotoSrc(photoUrl) : null
	const expirationDate = student.studentId?.expirationDate
		? new Date(student.studentId.expirationDate).toLocaleDateString()
		: 'Not set'

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

	const isDownloadingPDF =
		navigation.state === 'loading' &&
		navigation.location?.pathname === '/resources/student-pdf'

	return (
		<div className="pb-20 font-body md:pb-8">
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
				actions={
					<a href="/resources/student-pdf">
						<StatusButton
							className="bg-brand-gold font-body text-sm font-semibold text-primary hover:bg-brand-gold/80"
							status={isDownloadingPDF ? 'pending' : 'idle'}
							disabled={isDownloadingPDF}
						>
							<Icon name="download" className="size-4" />
							Download ID Card
						</StatusButton>
					</a>
				}
			/>

			{/* ── 01 YOUR INFO + 02 ID STATUS ── */}
			<div className="mt-10 grid gap-8 md:grid-cols-2">
				<div>
					<SectionTitle number="01">Your Info</SectionTitle>
					<KeyValueList
						items={[
							{ key: 'Name', value: student.fullName },
							{ key: 'Grade', value: student.grade || 'Not set' },
							{ key: 'Email', value: student.email },
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
						]}
					/>
				</div>

				<div>
					<SectionTitle number="02">ID Status</SectionTitle>
					<KeyValueList
						items={[
							{ key: 'Expiration', value: expirationDate, mono: true },
							{
								key: 'Status',
								value: expirationStatus ? (
									<StatusBadge
										variant={
											expirationStatus.type === 'valid'
												? 'valid'
												: expirationStatus.type === 'expiring'
													? 'expiring'
													: 'expired'
										}
										className="rotate-0"
									>
										{expirationStatus.type === 'valid'
											? 'Valid'
											: expirationStatus.type === 'expiring'
												? `Expiring in ${expirationStatus.daysUntilExpiration} days`
												: 'Expired'}
									</StatusBadge>
								) : (
									'Unknown'
								),
							},
						]}
					/>
				</div>
			</div>

			{/* ── GOLD RULE ── */}
			<div className="my-10 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent" />

			{/* ── 03 ID CARD PREVIEW ── */}
			<SectionTitle number="03">ID Card Preview</SectionTitle>
			<div className="grid gap-6 md:grid-cols-2">
				<div className="border border-border bg-card p-5 shadow-sm">
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
					<p className="mt-3 text-center font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
						Front
					</p>
				</div>
				<div className="border border-border bg-card p-5 shadow-sm">
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
					<p className="mt-3 text-center font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
						Back
					</p>
				</div>
			</div>

			{/* Mobile Sticky Download Button */}
			<div
				className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-3 shadow-lg backdrop-blur md:hidden"
				style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
			>
				<a href="/resources/student-pdf" className="block">
					<StatusButton
						className="w-full bg-brand-gold font-body text-sm font-semibold text-primary hover:bg-brand-gold/80"
						status={isDownloadingPDF ? 'pending' : 'idle'}
						disabled={isDownloadingPDF}
					>
						<Icon name="download" className="size-4" />
						Download ID Card
					</StatusButton>
				</a>
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
