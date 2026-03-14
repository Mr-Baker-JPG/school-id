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
	getDefaultExpirationDate,
	fetchAndCacheFactsProfilePicture,
	getExpirationStatus,
	getCurrentAcademicYear,
} from '#app/utils/employee.server.ts'
import { getEmployeePhotoSrc } from '#app/utils/misc.tsx'
import { getEmployeePersonType } from '#app/utils/person-type.ts'
import { generateEmployeeQRCodeDataURL } from '#app/utils/qr-code.server.ts'
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

	if (!user) {
		throw new Response('User not found', { status: 404 })
	}

	const employee = await prisma.employee.findUnique({
		where: { email: user.email },
		select: {
			id: true,
			sisEmployeeId: true,
			firstName: true,
			lastName: true,
			fullName: true,
			jobTitle: true,
			department: true,
			email: true,
			status: true,
			employeeId: {
				select: {
					photoUrl: true,
					expirationDate: true,
				},
			},
		},
	})

	invariantResponse(employee, 'Employee record not found', { status: 404 })

	let employeeId = employee.employeeId
	if (!employeeId) {
		employeeId = await prisma.employeeID.create({
			data: {
				employeeId: employee.id,
				expirationDate: getDefaultExpirationDate(),
			},
			select: {
				photoUrl: true,
				expirationDate: true,
			},
		})
	}

	if (!employeeId.photoUrl && employee.sisEmployeeId) {
		fetchAndCacheFactsProfilePicture(employee.id, employee.sisEmployeeId).catch(
			(error) => {
				console.warn(
					`Background FACTS photo fetch failed for employee ${employee.id}:`,
					error,
				)
			},
		)
	}

	const branding = await getBrandingConfig()
	const photoUrl: string | null = employeeId?.photoUrl ?? null
	const logoUrl = branding.logoUrl || null

	const qrCodeDataURL = await generateEmployeeQRCodeDataURL(
		employee.sisEmployeeId,
		request,
	)

	const barcodeDataURL = await generateBarcodeDataURL(employee.sisEmployeeId, {
		width: 2,
		height: 40,
		format: 'CODE128',
		displayValue: false,
	})

	const academicYear = getCurrentAcademicYear()
	const defaultExpirationDate = getDefaultExpirationDate()

	const expirationStatus = employeeId?.expirationDate
		? getExpirationStatus(employeeId.expirationDate)
		: null

	return {
		employee: {
			...employee,
			employeeId: employeeId || {
				photoUrl: null,
				expirationDate: defaultExpirationDate,
			},
		},
		branding,
		photoUrl,
		logoUrl,
		qrCodeDataURL,
		barcodeDataURL,
		academicYear,
		defaultExpirationDate,
		expirationStatus,
	}
}

export default function EmployeeIdRoute({ loaderData }: Route.ComponentProps) {
	const {
		employee,
		branding,
		photoUrl,
		logoUrl,
		qrCodeDataURL,
		barcodeDataURL,
		academicYear,
		defaultExpirationDate,
		expirationStatus,
	} = loaderData
	const navigation = useNavigation()
	const displayPhotoUrl = photoUrl ? getEmployeePhotoSrc(photoUrl) : null
	const expirationDate = employee.employeeId?.expirationDate
		? new Date(employee.employeeId.expirationDate).toLocaleDateString()
		: 'Not set'

	const personType = getEmployeePersonType(employee.department)

	const employeeCardData = {
		id: employee.id,
		firstName: employee.firstName,
		lastName: employee.lastName,
		fullName: employee.fullName,
		jobTitle: employee.jobTitle,
		personType,
		email: employee.email,
		status: employee.status,
		sisEmployeeId: employee.sisEmployeeId,
		photoUrl: employee.employeeId?.photoUrl || null,
		expirationDate: employee.employeeId?.expirationDate
			? new Date(employee.employeeId.expirationDate)
			: new Date(defaultExpirationDate),
	}

	const isDownloadingPDF =
		navigation.state === 'loading' &&
		navigation.location?.pathname === '/resources/employee-pdf'

	return (
		<div className="pb-20 font-body md:pb-8">
			{/* ── DOSSIER HEADER ── */}
			<DossierHeader
				name={employee.fullName}
				subtitle={`${employee.jobTitle}${employee.department ? ` · ${employee.department}` : ''} · ${employee.email}`}
				typeLabel={`Employee · ${personType === 'FACULTY' ? 'Faculty' : 'Staff'}`}
				photoUrl={displayPhotoUrl}
				photoAlt={employee.fullName}
				status={employee.status}
				idValid={
					employee.employeeId?.expirationDate
						? new Date(employee.employeeId.expirationDate) > new Date()
						: undefined
				}
				actions={
					<a href="/resources/employee-pdf">
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
							{ key: 'Name', value: employee.fullName },
							{ key: 'Job Title', value: employee.jobTitle },
							{ key: 'Department', value: employee.department || 'N/A' },
							{ key: 'Email', value: employee.email },
							{
								key: 'Status',
								value: (
									<StatusBadge
										variant={
											employee.status === 'active' ? 'active' : 'inactive'
										}
										className="rotate-0"
									>
										{employee.status}
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
								employee={employeeCardData}
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
								employee={employeeCardData}
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
				<a href="/resources/employee-pdf" className="block">
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
		{ title: `My Employee ID | ${data?.employee.fullName ?? 'Employee'}` },
		{
			name: 'description',
			content: `Employee ID for ${data?.employee.fullName ?? 'employee'}`,
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
						Employee record not found. Please contact an administrator if you
						believe this is an error.
					</p>
				),
			}}
		/>
	)
}
