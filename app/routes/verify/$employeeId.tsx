import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { captureException } from '@sentry/react-router'
import { Img } from 'openimg/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Card } from '#app/components/ui/card.tsx'
import { SCHOOL_NAME, HEADER_LOGO_SRC } from '#app/ui/brand.ts'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { fetchAndCacheFactsProfilePicture } from '#app/utils/employee.server.ts'
import { getDomainUrl, getEmployeePhotoSrc } from '#app/utils/misc.tsx'
import { getVerificationStatus } from '#app/utils/verification.server.ts'
import { type Route } from './+types/$employeeId.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ params, request }: Route.LoaderArgs) {
	const { employeeId } = params

	if (!employeeId) {
		const error = new Error('Employee ID is required')
		console.error('[Verification] Missing employee ID parameter')
		captureException(error, {
			tags: {
				route: 'verify/$employeeId',
				errorType: 'missing_employee_id',
			},
		})
		throw new Response('Employee ID is required', { status: 400 })
	}

	// Fetch employee with their ID record
	let employee
	try {
		employee = await prisma.employee.findUnique({
			where: { id: employeeId },
			select: {
				id: true,
				sisEmployeeId: true,
				fullName: true,
				jobTitle: true,
				status: true,
				employeeId: {
					select: {
						expirationDate: true,
						photoUrl: true,
					},
				},
			},
		})
	} catch (error) {
		console.error('[Verification] Database error:', error)
		captureException(error, {
			tags: {
				route: 'verify/$employeeId',
				errorType: 'database_error',
				employeeId,
			},
		})
		throw new Response(
			'An error occurred while fetching employee information. Please try again later.',
			{ status: 500 },
		)
	}

	// If employee not found, return 404
	if (!employee) {
		const error = new Error('Employee not found')
		console.warn('[Verification] Employee not found:', employeeId)
		// Don't capture 404s as exceptions (they're expected for invalid IDs)
		throw new Response('Employee not found', { status: 404 })
	}

	// If no uploaded photo exists, try to fetch and cache from FACTS
	// Note: This is done asynchronously to avoid blocking the loader response
	// The photo will be available on the next page load if successfully cached
	let photoUrl = employee.employeeId?.photoUrl ?? null
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

	// Get verification status
	const expirationDate = employee.employeeId?.expirationDate
		? new Date(employee.employeeId.expirationDate)
		: null
	const verificationStatus = getVerificationStatus(
		employee.status,
		expirationDate,
	)

	// Get branding config
	const branding = getBrandingConfig()

	// Construct verification URL for SEO metadata
	const domainUrl = getDomainUrl(request)
	const verificationUrl = `${domainUrl}/verify/${employeeId}`

	return {
		employee: {
			id: employee.id,
			fullName: employee.fullName,
			jobTitle: employee.jobTitle,
			status: employee.status,
			expirationDate: expirationDate ? expirationDate.toISOString() : null,
			photoUrl,
		},
		verificationStatus,
		branding,
		verificationUrl,
	}
}

export default function VerifyRoute({ loaderData }: Route.ComponentProps) {
	const { employee, verificationStatus, branding } = loaderData
	const expirationDate = employee.expirationDate
		? new Date(employee.expirationDate).toLocaleDateString()
		: 'Not set'

	return (
		<div className="bg-muted/20 flex min-h-screen items-center justify-center px-4 py-10">
			<Card className="mx-auto w-full max-w-md p-8">
				{/* School Logo and Name */}
				<div className="mb-6 flex flex-col items-center gap-3">
					{branding.logoUrl && (
						<Img
							src={HEADER_LOGO_SRC}
							alt={SCHOOL_NAME}
							className="h-12 w-auto object-contain"
							width={228}
							height={48}
						/>
					)}
					{/* <h1 className="text-h2 text-center">{SCHOOL_NAME}</h1> */}
					<h2 className="text-h4 text-muted-foreground text-center">
						Employee Verification
					</h2>
				</div>

				{/* Employee Photo */}
				<div className="mb-6 flex justify-center">
					<img
						src={getEmployeePhotoSrc(employee.photoUrl)}
						alt={employee.fullName}
						className="size-32 rounded-lg object-cover"
						width={128}
						height={128}
					/>
				</div>

				{/* Validity Badge */}
				<div className="mb-6 flex justify-center">
					<StatusBadge
						variant={verificationStatus.isValid ? 'valid' : 'invalid'}
					>
						{verificationStatus.isValid ? '✓ Valid' : '✗ Invalid'}
					</StatusBadge>
				</div>

				{/* Employee Information */}
				<div className="mb-6">
					<KeyValueList
						items={[
							{ key: 'Status', value: employee.status },
							{
								key: 'Expiration Date',
								value: expirationDate,
								mono: true,
							},
						]}
					/>
				</div>

				{/* Invalid Reason */}
				{!verificationStatus.isValid && (
					<div className="border-destructive/20 bg-destructive/5 rounded-lg border p-4">
						<p className="text-body-sm text-destructive">
							<strong>Reason:</strong> {verificationStatus.reason}
						</p>
					</div>
				)}
			</Card>
		</div>
	)
}

export const meta: Route.MetaFunction = ({ data }) => {
	if (!data) {
		return [
			{ title: 'Employee Verification' },
			{
				name: 'description',
				content: 'Verify employee ID status',
			},
		]
	}

	const { employee, verificationStatus, branding, verificationUrl } = data
	const statusText = verificationStatus.isValid ? 'Valid' : 'Invalid'
	const title = `${employee.fullName} - ${statusText} | ${branding.schoolName} Employee Verification`
	const description = `Employee verification for ${employee.fullName} (${employee.jobTitle}). Status: ${statusText}.`

	// Determine image URL for Open Graph (prefer employee photo, fallback to school logo)
	const imageUrl = employee.photoUrl
		? employee.photoUrl
		: (branding.logoUrl ?? undefined)

	const metaTags = [
		{
			title,
		},
		{
			name: 'description',
			content: description,
		},
		// Open Graph tags
		{
			property: 'og:title',
			content: `${employee.fullName} - ${statusText} | ${branding.schoolName}`,
		},
		{
			property: 'og:description',
			content: description,
		},
		{
			property: 'og:type',
			content: 'profile',
		},
		{
			property: 'og:url',
			content: verificationUrl,
		},
		{
			property: 'og:site_name',
			content: branding.schoolName,
		},
		// Twitter Card tags
		{
			name: 'twitter:card',
			content: 'summary' as const,
		},
		{
			name: 'twitter:title',
			content: `${employee.fullName} - ${statusText} | ${branding.schoolName}`,
		},
		{
			name: 'twitter:description',
			content: description,
		},
	]

	// Add image tags if image URL is available
	if (imageUrl) {
		metaTags.push({
			property: 'og:image',
			content: imageUrl,
		})
		metaTags.push({
			name: 'twitter:image',
			content: imageUrl,
		})
	}

	return metaTags
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				400: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Invalid Request</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data?.message ||
									error?.data ||
									'Invalid employee ID provided. Please check the verification link and try again.'}
							</p>
						</div>
					</div>
				),
				404: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Employee Not Found</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data ||
									'The employee ID you are looking for does not exist or has been removed. Please verify the ID and try again.'}
							</p>
						</div>
					</div>
				),
				500: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Verification Error</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data ||
									'An error occurred while verifying the employee ID. Please try again later.'}
							</p>
						</div>
					</div>
				),
			}}
			unexpectedErrorHandler={(error) => (
				<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
					<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
						<h1 className="text-h2 mb-4">Unexpected Error</h1>
						<p className="text-body-lg text-muted-foreground">
							An unexpected error occurred while verifying the employee ID.
							Please try again later.
						</p>
					</div>
				</div>
			)}
		/>
	)
}
