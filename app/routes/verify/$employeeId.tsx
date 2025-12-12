import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Img } from 'openimg/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { getVerificationStatus } from '#app/utils/verification.server.ts'
import { cn } from '#app/utils/misc.tsx'
import { type Route } from './+types/$employeeId.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ params, request }: Route.LoaderArgs) {
	const { employeeId } = params

	if (!employeeId) {
		throw new Response('Employee ID is required', { status: 400 })
	}

	// Fetch employee with their ID record
	const employee = await prisma.employee.findUnique({
		where: { id: employeeId },
		select: {
			id: true,
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

	// If employee not found, return 404
	if (!employee) {
		throw new Response('Employee not found', { status: 404 })
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

	return {
		employee: {
			id: employee.id,
			fullName: employee.fullName,
			jobTitle: employee.jobTitle,
			status: employee.status,
			expirationDate: expirationDate ? expirationDate.toISOString() : null,
			photoUrl: employee.employeeId?.photoUrl ?? null,
		},
		verificationStatus,
		branding,
	}
}

export default function VerifyRoute({ loaderData }: Route.ComponentProps) {
	const { employee, verificationStatus, branding } = loaderData
	const expirationDate = employee.expirationDate
		? new Date(employee.expirationDate).toLocaleDateString()
		: 'Not set'

	return (
		<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
			<Spacer size="4xs" />
			<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
				{/* School Logo */}
				{branding.logoUrl && (
					<div className="mb-6">
						<Img
							src={branding.logoUrl}
							alt={branding.schoolName}
							className="h-16 w-auto object-contain"
							width={256}
							height={64}
						/>
					</div>
				)}

				{/* School Name */}
				<h1 className="text-h2 mb-6">{branding.schoolName}</h1>
				<h2 className="text-h3 text-muted-foreground mb-8">
					Employee Verification
				</h2>

				{/* Employee Photo */}
				<div className="mb-6">
					{employee.photoUrl ? (
						<Img
							src={employee.photoUrl}
							alt={employee.fullName}
							className="size-48 rounded-lg object-cover"
							width={384}
							height={384}
						/>
					) : (
						<div className="bg-muted-foreground/20 flex size-48 items-center justify-center rounded-lg">
							<span className="text-muted-foreground text-4xl">
								{employee.fullName.charAt(0).toUpperCase()}
							</span>
						</div>
					)}
				</div>

				{/* Validity Badge */}
				<div className="mb-8">
					<span
						className={cn(
							'inline-flex items-center rounded-full px-4 py-2 text-lg font-semibold',
							{
								'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200':
									verificationStatus.isValid,
								'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200':
									!verificationStatus.isValid,
							},
						)}
					>
						{verificationStatus.isValid ? '✓ Valid' : '✗ Invalid'}
					</span>
				</div>

				{/* Employee Information */}
				<div className="flex w-full max-w-md flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label className="text-body-xs text-muted-foreground">Name</label>
						<p className="text-body-lg">{employee.fullName}</p>
					</div>

					<div className="flex flex-col gap-2">
						<label className="text-body-xs text-muted-foreground">
							Job Title
						</label>
						<p className="text-body-lg">{employee.jobTitle}</p>
					</div>

					<div className="flex flex-col gap-2">
						<label className="text-body-xs text-muted-foreground">Status</label>
						<span
							className={cn(
								'inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-medium',
								{
									'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200':
										employee.status === 'active',
									'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200':
										employee.status === 'inactive',
								},
							)}
						>
							{employee.status}
						</span>
					</div>

					<div className="flex flex-col gap-2">
						<label className="text-body-xs text-muted-foreground">
							Expiration Date
						</label>
						<p className="text-body-lg">{expirationDate}</p>
					</div>

					{!verificationStatus.isValid && (
						<div className="bg-muted-foreground/10 mt-4 rounded-lg p-4">
							<p className="text-body-sm text-muted-foreground">
								<strong>Reason:</strong> {verificationStatus.reason}
							</p>
						</div>
					)}
				</div>
			</div>
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

	const { employee, verificationStatus, branding } = data
	const statusText = verificationStatus.isValid ? 'Valid' : 'Invalid'

	return [
		{
			title: `${employee.fullName} - ${statusText} | ${branding.schoolName} Employee Verification`,
		},
		{
			name: 'description',
			content: `Employee verification for ${employee.fullName} (${employee.jobTitle}). Status: ${statusText}.`,
		},
		{
			property: 'og:title',
			content: `${employee.fullName} - ${statusText} | ${branding.schoolName}`,
		},
		{
			property: 'og:description',
			content: `Employee verification for ${employee.fullName} (${employee.jobTitle}). Status: ${statusText}.`,
		},
		{
			property: 'og:type',
			content: 'profile',
		},
	]
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
								{error?.data?.message || 'Invalid employee ID provided.'}
							</p>
						</div>
					</div>
				),
				404: () => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Employee Not Found</h1>
							<p className="text-body-lg text-muted-foreground">
								The employee ID you are looking for does not exist or has been
								removed.
							</p>
						</div>
					</div>
				),
			}}
		/>
	)
}
