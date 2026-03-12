import { invariantResponse } from '@epic-web/invariant'
import { Img } from 'openimg/react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, Link } from 'react-router'
import {
	IDCardFrontPreview,
	IDCardBackPreview,
	type PersonType,
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
import { getEmployeePersonType } from '#app/utils/person-type.ts'
import { generateBarcodeDataURL } from '#app/utils/barcode.server.ts'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	getDefaultExpirationDate,
	fetchAndCacheFactsProfilePicture,
	getCurrentAcademicYear,
} from '#app/utils/employee.server.ts'
import { gmailSignatureService } from '#app/utils/gmail-signature.server.ts'
import { getEmployeePhotoSrc, useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { generateEmployeeQRCodeDataURL } from '#app/utils/qr-code.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/$employeeId.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request, params }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const { employeeId } = params

	invariantResponse(employeeId, 'Employee ID is required', { status: 400 })

	// Fetch employee with all related data
	const employee = await prisma.employee.findUnique({
		where: { id: employeeId },
		select: {
			id: true,
			sisEmployeeId: true,
			firstName: true,
			lastName: true,
			fullName: true,
			jobTitle: true,
			email: true,
			status: true,
			createdAt: true,
			updatedAt: true,
			employeeId: {
				select: {
					photoUrl: true,
					expirationDate: true,
					createdAt: true,
					updatedAt: true,
					gmailSignature: true,
					gmailSignatureFetchedAt: true,
				},
			},
		},
	})

	invariantResponse(employee, 'Employee not found', { status: 404 })

	// Ensure EmployeeID record exists (create if missing) - per F015
	let employeeIdRecord = employee.employeeId
	if (!employeeIdRecord) {
		employeeIdRecord = await prisma.employeeID.create({
			data: {
				employeeId: employee.id,
				expirationDate: getDefaultExpirationDate(),
			},
			select: {
				photoUrl: true,
				expirationDate: true,
				createdAt: true,
				updatedAt: true,
				gmailSignature: true,
				gmailSignatureFetchedAt: true,
			},
		})
	}

	// Fetch Gmail signature in background if missing or stale (> 7 days)
	const DAYS_BEFORE_RECHECK = 7
	const shouldFetchSignature =
		!employeeIdRecord.gmailSignature ||
		!employeeIdRecord.gmailSignatureFetchedAt ||
		Date.now() - employeeIdRecord.gmailSignatureFetchedAt.getTime() >
			DAYS_BEFORE_RECHECK * 24 * 60 * 60 * 1000

	if (shouldFetchSignature) {
		gmailSignatureService
			.fetchAndCacheSignature(employee.id, employee.email)
			.catch((error) => {
				console.warn(
					`Background Gmail signature fetch failed for employee ${employee.id}:`,
					error,
				)
			})
	}

	let photoUrl = employeeIdRecord?.photoUrl ?? null
	if (!photoUrl && employee.sisEmployeeId) {
		fetchAndCacheFactsProfilePicture(employee.id, employee.sisEmployeeId).catch(
			(error) => {
				console.warn(
					`Background FACTS photo fetch failed for employee ${employee.id}:`,
					error,
				)
			},
		)
	}

	// Get branding config
	const branding = getBrandingConfig()
	const logoUrl = branding.logoUrl || null

	// Generate QR code for verification
	const qrCodeDataURL = await generateEmployeeQRCodeDataURL(
		employee.id,
		request,
	)

	// Generate barcode for ID card
	const barcodeDataURL = await generateBarcodeDataURL(
		employee.sisEmployeeId || employee.id,
		{
			width: 2,
			height: 40,
			format: 'CODE128',
			displayValue: false,
		},
	)

	// Get current academic year
	const academicYear = getCurrentAcademicYear()

	return {
		employee: {
			...employee,
			employeeId: employeeIdRecord || {
				photoUrl: null,
				expirationDate: getDefaultExpirationDate(),
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		},
		photoUrl,
		branding,
		logoUrl,
		qrCodeDataURL,
		barcodeDataURL,
		academicYear,
	}
}

export async function action({ request, params }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const { employeeId } = params
	const formData = await request.formData()
	const intent = formData.get('intent')

	invariantResponse(employeeId, 'Employee ID is required', { status: 400 })

	if (intent === 'recheck-facts-photo') {
		const employee = await prisma.employee.findUnique({
			where: { id: employeeId },
			select: { sisEmployeeId: true, fullName: true },
		})

		invariantResponse(employee, 'Employee not found', { status: 404 })

		try {
			const cachedPhotoUrl = await fetchAndCacheFactsProfilePicture(
				employeeId,
				employee.sisEmployeeId,
				true,
			)

			if (cachedPhotoUrl) {
				return redirectWithToast(`/admin/employees/${employeeId}`, {
					type: 'success',
					title: 'Photo Updated',
					description: `Successfully refreshed FACTS profile picture for ${employee.fullName}`,
				})
			} else {
				return redirectWithToast(`/admin/employees/${employeeId}`, {
					type: 'message',
					title: 'No Photo Available',
					description: `No FACTS profile picture found for ${employee.fullName}, or employee has an uploaded photo that takes precedence`,
				})
			}
		} catch (error) {
			console.error(
				`Error rechecking FACTS photo for employee ${employeeId}:`,
				error,
			)
			return redirectWithToast(`/admin/employees/${employeeId}`, {
				type: 'error',
				title: 'Error',
				description: `Failed to refresh FACTS profile picture: ${error instanceof Error ? error.message : 'Unknown error'}`,
			})
		}
	}

	return redirectWithToast(`/admin/employees/${employeeId}`, {
		type: 'success',
		title: 'Photo Updated',
		description: `Successfully refreshed FACTS profile picture for ${employeeId}`,
	})
}

export default function AdminEmployeeDetailRoute({
	loaderData,
}: Route.ComponentProps) {
	const {
		employee,
		photoUrl,
		branding,
		logoUrl,
		qrCodeDataURL,
		barcodeDataURL,
		academicYear,
	} = loaderData
	const hasPhoto = !!photoUrl
	const displayPhotoUrl = photoUrl ? getEmployeePhotoSrc(photoUrl) : null
	const expirationDate = employee.employeeId?.expirationDate
		? new Date(employee.employeeId.expirationDate).toLocaleDateString()
		: 'Not set'
	const lastUpdated = new Date(employee.updatedAt).toLocaleString()
	const isPending = useIsPending({
		formAction: `/admin/employees/${employee.id}`,
	})

	// Determine personType based on job title
	const personType = getEmployeePersonType(employee.jobTitle)

	// Prepare employee data for ID card component
	const employeeCardData = {
		id: employee.id,
		firstName: employee.firstName,
		lastName: employee.lastName,
		fullName: employee.fullName,
		personType,
		email: employee.email,
		status: employee.status,
		sisEmployeeId: employee.sisEmployeeId || employee.id,
		photoUrl: employee.employeeId?.photoUrl || null,
		expirationDate: new Date(employee.employeeId?.expirationDate ?? new Date()),
	}

	return (
		<div className="font-body">
			{/* Back link — visible only on mobile where the list panel is hidden */}
			<div className="mb-6 md:hidden">
				<Link
					to="/admin/employees"
					className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
				>
					<Icon name="arrow-left" className="size-3.5" />
					Back to Employees
				</Link>
			</div>

			{/* ── DOSSIER HEADER ── */}
			<DossierHeader
				name={employee.fullName}
				subtitle={`${employee.jobTitle} · ${employee.email}`}
				typeLabel={`Employee · ${personType === 'FACULTY' ? 'Faculty' : 'Staff'}`}
				photoUrl={displayPhotoUrl}
				photoAlt={employee.fullName}
				status={employee.status}
				idValid={
					employee.employeeId?.expirationDate
						? new Date(employee.employeeId.expirationDate) > new Date()
						: undefined
				}
				photoActions={
					<>
						<Button
							asChild
							size="sm"
							className="flex-1 rounded-none bg-primary/90 font-mono text-[0.6rem] uppercase tracking-wide text-brand-gold hover:bg-brand-red"
						>
							<Link to={`/admin/employees/${employee.id}/photo`}>
								{hasPhoto ? 'Change' : 'Upload'}
							</Link>
						</Button>
						<Form method="post" className="flex flex-1">
							<input type="hidden" name="intent" value="recheck-facts-photo" />
							<StatusButton
								type="submit"
								size="sm"
								status={isPending ? 'pending' : 'idle'}
								disabled={isPending}
								className="w-full rounded-none bg-primary/90 font-mono text-[0.6rem] uppercase tracking-wide text-brand-gold hover:bg-brand-red"
							>
								Refresh
							</StatusButton>
						</Form>
					</>
				}
				actions={
					<>
						<Button
							className="bg-brand-gold font-body text-sm font-semibold text-primary hover:bg-brand-gold/80"
							onClick={() => {
								window.location.href = `/resources/admin/employee-pdf/${employee.id}`
							}}
						>
							<Icon name="download" className="size-4" />
							Download ID Card
						</Button>
						<Button variant="outline" asChild className="font-body text-sm">
							<Link to={`/admin/employees/${employee.id}/expiration`}>
								<Icon name="pencil-1" className="size-4" />
								Edit Expiration
							</Link>
						</Button>
					</>
				}
			/>

			{/* ── 01 PERSONNEL RECORD + 02 ID CARD ── */}
			<div className="mt-10 grid gap-8 md:grid-cols-2">
				<div>
					<SectionTitle number="01">Personnel Record</SectionTitle>
					<KeyValueList
						items={[
							{ key: 'Full Name', value: employee.fullName },
							{ key: 'Job Title', value: employee.jobTitle },
							{ key: 'Email', value: employee.email },
							{
								key: 'SIS ID',
								value: employee.sisEmployeeId || 'N/A',
								mono: true,
							},
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
					<SectionTitle number="02">ID Card</SectionTitle>
					<KeyValueList
						items={[
							{ key: 'Expiration', value: expirationDate, mono: true },
							{
								key: 'Status',
								value: (
									<StatusBadge
										variant={
											employee.employeeId?.expirationDate &&
											new Date(employee.employeeId.expirationDate) > new Date()
												? 'valid'
												: 'expired'
										}
										className="rotate-0"
									>
										{employee.employeeId?.expirationDate &&
										new Date(employee.employeeId.expirationDate) > new Date()
											? 'Valid'
											: 'Expired'}
									</StatusBadge>
								),
							},
							{ key: 'Last SIS Sync', value: lastUpdated, mono: true },
						]}
					/>
				</div>
			</div>

			{/* ── 03 GMAIL SIGNATURE ── */}
			<div className="mt-10">
				<SectionTitle number="03">Gmail Signature</SectionTitle>
				{employee.employeeId?.gmailSignature ? (
					<div>
						<p className="mb-2 font-mono text-[0.68rem] text-muted-foreground">
							Last fetched:{' '}
							{employee.employeeId.gmailSignatureFetchedAt
								? new Date(
										employee.employeeId.gmailSignatureFetchedAt,
									).toLocaleString()
								: 'Unknown'}
						</p>
						{/*
							Security Note: Using dangerouslySetInnerHTML to render Gmail signature HTML.
							This is safe because:
							1. Content comes from Gmail API (trusted source)
							2. Only admins can view this page
							3. Content is fetched via service account (not user input)
							4. Gmail sanitizes signatures on their end
						*/}
						<div
							className="rounded border border-border bg-white p-4 font-body text-sm leading-relaxed text-gray-700"
							dangerouslySetInnerHTML={{
								__html: employee.employeeId.gmailSignature,
							}}
						/>
					</div>
				) : (
					<div className="text-muted-foreground">
						<p className="font-body italic">No Gmail signature found</p>
						<p className="mt-1 font-body text-sm">
							Signature will be fetched automatically when available
						</p>
					</div>
				)}
			</div>

			{/* ── GOLD RULE ── */}
			<div className="my-10 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent" />

			{/* ── 04 ID CARD PREVIEW ── */}
			<SectionTitle number="04">ID Card Preview</SectionTitle>
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
		</div>
	)
}

export const meta: Route.MetaFunction = ({ data }) => {
	return [
		{
			title: `Employee Details | ${data?.employee.fullName ?? 'Employee'}`,
		},
		{
			name: 'description',
			content: `Employee details for ${data?.employee.fullName ?? 'employee'}`,
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
				404: () => <p>Employee not found.</p>,
			}}
		/>
	)
}
