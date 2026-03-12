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
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { getEmployeePersonType } from '#app/utils/person-type.ts'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { IdPreviewCard } from '#app/ui/components/IdPreviewCard.tsx'
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
		// Don't await - let it run in the background
		gmailSignatureService
			.fetchAndCacheSignature(employee.id, employee.email)
			.catch((error) => {
				console.warn(
					`Background Gmail signature fetch failed for employee ${employee.id}:`,
					error,
				)
			})
	}

	// If no uploaded photo exists, try to fetch and cache from FACTS
	// Note: This is done asynchronously to avoid blocking the loader response
	// The photo will be available on the next page load if successfully cached
	let photoUrl = employeeIdRecord?.photoUrl ?? null
	if (!photoUrl && employee.sisEmployeeId) {
		// Don't await - let it run in the background to avoid loader timeout
		// The photo will be cached for the next page load
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

	// Get logo URL (if configured)
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
		// Fetch employee to get sisEmployeeId
		const employee = await prisma.employee.findUnique({
			where: { id: employeeId },
			select: { sisEmployeeId: true, fullName: true },
		})

		invariantResponse(employee, 'Employee not found', { status: 404 })

		try {
			// Force re-fetch from FACTS
			const cachedPhotoUrl = await fetchAndCacheFactsProfilePicture(
				employeeId,
				employee.sisEmployeeId,
				true, // force re-fetch
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

	const downloadButton = (
		<Button
			type="button"
			onClick={() => {
				window.location.href = `/resources/admin/employee-pdf/${employee.id}`
			}}
		>
			<Icon name="download">Download ID Card</Icon>
		</Button>
	)

	return (
		<div>
			<div className="mb-4">
				<Link
					to="/admin/employees"
					className="text-muted-foreground hover:text-foreground flex items-center gap-2"
				>
					<Icon name="arrow-left">Back to Employees</Icon>
				</Link>
			</div>

			<PageTitle
				title="Employee Details"
				subtitle={employee.fullName}
				rightSlot={downloadButton}
			/>

			<div className="mt-8 grid gap-6 md:grid-cols-2">
				{/* Left Column: Photo */}
				<CardSection title="Photo">
					<div className="flex items-center gap-4">
						{hasPhoto ? (
							<Img
								src={getEmployeePhotoSrc(photoUrl)}
								alt={employee.fullName}
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
								<Link to={`/admin/employees/${employee.id}/photo`}>
									<Icon name="pencil-1">
										{hasPhoto ? 'Change Photo' : 'Upload Photo'}
									</Icon>
								</Link>
							</Button>
							<Form method="post">
								<input
									type="hidden"
									name="intent"
									value="recheck-facts-photo"
								/>
								<StatusButton
									type="submit"
									variant="outline"
									size="sm"
									status={isPending ? 'pending' : 'idle'}
									disabled={isPending}
								>
									<Icon name="update">Recheck</Icon>
								</StatusButton>
							</Form>
						</div>
					</div>
				</CardSection>

				{/* Right Column: Employee Info */}
				<CardSection title="Employee Info">
					<KeyValueList
						items={[
							{ key: 'Full Name', value: employee.fullName },
							{ key: 'Job Title', value: employee.jobTitle },
							{ key: 'Email', value: employee.email },
							{
								key: 'SIS Employee ID',
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
									>
										{employee.status}
									</StatusBadge>
								),
							},
						]}
					/>
				</CardSection>
			</div>

			<div className="mt-6 grid gap-6 md:grid-cols-2">
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
							<Link to={`/admin/employees/${employee.id}/expiration`}>
								<Icon name="pencil-1">Update</Icon>
							</Link>
						</Button>
					</div>
				</CardSection>

				{/* SIS Sync Status */}
				<CardSection title="SIS Sync Status">
					<KeyValueList
						items={[
							{
								key: 'Last Updated from SIS',
								value: lastUpdated,
								mono: true,
							},
						]}
					/>
				</CardSection>
			</div>

			{/* Gmail Signature Section */}
			<div className="mt-6">
				<CardSection title="Gmail Signature">
					{employee.employeeId?.gmailSignature ? (
						<div>
							<div className="mb-2 text-sm text-muted-foreground">
								Last updated:{' '}
								{employee.employeeId.gmailSignatureFetchedAt
									? new Date(
											employee.employeeId.gmailSignatureFetchedAt,
										).toLocaleString()
									: 'Unknown'}
							</div>
							{/*
								Security Note: Using dangerouslySetInnerHTML to render Gmail signature HTML.
								This is safe because:
								1. Content comes from Gmail API (trusted source)
								2. Only admins can view this page
								3. Content is fetched via service account (not user input)
								4. Gmail sanitizes signatures on their end
							*/}
							<div
								className="rounded-lg border bg-white p-4"
								dangerouslySetInnerHTML={{
									__html: employee.employeeId.gmailSignature,
								}}
							/>
						</div>
					) : (
						<div className="text-muted-foreground">
							<p className="italic">No Gmail signature found</p>
							<p className="mt-1 text-sm">
								Signature will be fetched automatically when available
							</p>
						</div>
					)}
				</CardSection>
			</div>

			{/* ID Card Preview Section */}
			<div className="mt-8">
				<h2 className="mb-4 text-xl font-semibold">ID Card Preview</h2>
				<div className="grid gap-6 md:grid-cols-2">
					{/* Front of ID */}
					<CardSection title="Front" className="border-muted/50 shadow-sm">
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
					</CardSection>

					{/* Back of ID */}
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
