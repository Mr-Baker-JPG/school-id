import { invariantResponse } from '@epic-web/invariant'
import { Img } from 'openimg/react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import {
	IDCardFrontPreview,
	IDCardBackPreview,
} from '#app/components/employee-id-card.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import {
	getDefaultExpirationDate,
	fetchAndCacheFactsProfilePicture,
	getExpirationStatus,
} from '#app/utils/employee.server.ts'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { generateEmployeeQRCodeDataURL } from '#app/utils/qr-code.server.ts'
import { cn, getEmployeePhotoSrc } from '#app/utils/misc.tsx'
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

	const downloadButton = (
		<Button size="lg" asChild>
			<a href="/employee/id/download">
				<Icon name="download">Download ID Card (PDF)</Icon>
			</a>
		</Button>
	)

	const addToWalletButton = (
		<Button size="lg" variant="outline" asChild>
			<a href="/employee/id/wallet">
				<Icon name="plus">Add to Wallet</Icon>
			</a>
		</Button>
	)

	return (
		<div className="pb-20 md:pb-8">
			<PageTitle
				title="My Employee ID"
				rightSlot={
					<div className="hidden md:flex md:gap-2">
						{addToWalletButton}
						{downloadButton}
					</div>
				}
			/>

			<div className="mt-8 grid gap-6 md:grid-cols-2">
				{/* Left Column: ID Card Previews */}
				<div className="space-y-6">
					<CardSection title="Front">
						<div className="flex justify-center">
							<IDCardFrontPreview
								employee={employeeCardData}
								photoUrl={photoUrl ? getEmployeePhotoSrc(photoUrl) : null}
								logoUrl={logoUrl}
								branding={branding}
							/>
						</div>
					</CardSection>
					<CardSection title="Back">
						<div className="flex justify-center">
							<IDCardBackPreview
								qrCodeDataURL={qrCodeDataURL}
								branding={branding}
							/>
						</div>
					</CardSection>
				</div>

				{/* Right Column: Status and Info */}
				<div className="space-y-6">
					<CardSection title="Status">
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

					<CardSection title="Your Info">
						<KeyValueList
							items={[
								{ key: 'Name', value: employee.fullName },
								{ key: 'Job Title', value: employee.jobTitle },
								{ key: 'Email', value: employee.email },
								{ key: 'Status', value: employee.status },
								{
									key: 'Expiration Date',
									value: expirationDate,
									mono: true,
								},
							]}
						/>
					</CardSection>
				</div>
			</div>

			{/* Mobile Sticky Download Buttons */}
			<div className="bg-background/95 fixed inset-x-0 bottom-0 border-t p-3 backdrop-blur md:hidden">
				<div className="flex gap-2">
					{addToWalletButton}
					{downloadButton}
				</div>
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
