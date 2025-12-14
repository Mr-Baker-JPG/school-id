import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	IDCardFrontPreview,
	IDCardBackPreview,
} from '#app/components/employee-id-card.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
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
	getDefaultExpirationDate,
	fetchAndCacheFactsProfilePicture,
	getExpirationStatus,
	getCurrentAcademicYear,
} from '#app/utils/employee.server.ts'
import { cn, getEmployeePhotoSrc } from '#app/utils/misc.tsx'
import { generateEmployeeQRCodeDataURL } from '#app/utils/qr-code.server.ts'
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

	if (!user) {
		throw new Response('User not found', { status: 404 })
	}

	// Find employee by matching email
	const employee = await prisma.employee.findUnique({
		where: { email: user.email },
		select: {
			id: true,
			sisEmployeeId: true,
			fullName: true,
			jobTitle: true,
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

	// Ensure EmployeeID record exists (create if missing)
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

	// If no uploaded photo exists, try to fetch and cache from FACTS
	// Note: This is done asynchronously to avoid blocking the loader response
	// The photo will be available on the next page load if successfully cached
	if (!employeeId.photoUrl && employee.sisEmployeeId) {
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

	// Get branding configuration
	const branding = getBrandingConfig()

	// Get photo URL (objectKey from database)
	let photoUrl: string | null = employeeId?.photoUrl ?? null

	// Get logo URL (if configured)
	const logoUrl = branding.logoUrl || null

	// Generate QR code data URL for preview
	const qrCodeDataURL = await generateEmployeeQRCodeDataURL(
		employee.id,
		request,
	)

	// Generate barcode data URL for preview
	const barcodeDataURL = await generateBarcodeDataURL(employee.sisEmployeeId, {
		width: 2,
		height: 40,
		format: 'CODE128',
		displayValue: false,
	})

	// Get current academic year
	const academicYear = getCurrentAcademicYear()

	// Ensure we always have an expiration date for the component
	const defaultExpirationDate = getDefaultExpirationDate()

	// Calculate expiration status in the loader (server-side)
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
	const expirationDate = employee.employeeId?.expirationDate
		? new Date(employee.employeeId.expirationDate).toLocaleDateString()
		: 'Not set'

	// Prepare employee data for ID card component
	const employeeCardData = {
		id: employee.id,
		fullName: employee.fullName,
		jobTitle: employee.jobTitle,
		email: employee.email,
		status: employee.status,
		sisEmployeeId: employee.sisEmployeeId,
		photoUrl: employee.employeeId?.photoUrl || null,
		expirationDate: employee.employeeId?.expirationDate
			? new Date(employee.employeeId.expirationDate)
			: new Date(defaultExpirationDate),
	}

	const primaryAction = (
		<Button size="lg" asChild>
			<a href="/employee/id/wallet">
				<Icon name="plus">Add to Wallet</Icon>
			</a>
		</Button>
	)

	const secondaryActions = [
		{
			label: 'Download PDF',
			icon: 'download',
			href: '/resources/employee-pdf',
			asChild: true,
		},
	]

	return (
		<div className="pb-20 md:pb-8">
			<PageTitle title="My Employee ID" />

			{/* Actions Section */}
			<div className="mt-6">
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
									employee={employeeCardData}
									photoUrl={photoUrl ? getEmployeePhotoSrc(photoUrl) : null}
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
									photoUrl={photoUrl ? getEmployeePhotoSrc(photoUrl) : null}
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
					<CardSection title="Status" className="border-muted/50 shadow-sm">
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

					<CardSection title="Expiration" className="border-muted/50 shadow-sm">
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
								{ key: 'Name', value: employee.fullName },
								{ key: 'Job Title', value: employee.jobTitle },
								{ key: 'Email', value: employee.email },
							]}
						/>
					</CardSection>
				</div>
			</div>

			{/* Mobile Sticky Action Buttons */}
			<div className="bg-background/95 fixed inset-x-0 bottom-0 border-t p-3 backdrop-blur md:hidden">
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
