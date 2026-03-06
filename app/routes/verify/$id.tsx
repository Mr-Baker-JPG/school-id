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
import { getDomainUrl, getEmployeePhotoSrc, getStudentPhotoSrc } from '#app/utils/misc.tsx'
import { getVerificationStatus } from '#app/utils/verification.server.ts'
import { type Route } from './+types/$id.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ params, request }: Route.LoaderArgs) {
	const { id } = params

	if (!id) {
		throw new Response('ID is required', { status: 400 })
	}

	// Try to find employee first
	const employee = await prisma.employee.findUnique({
		where: { id },
		select: {
			id: true,
			fullName: true,
			jobTitle: true,
			email: true,
			status: true,
			employeeId: {
				select: {
					expirationDate: true,
					photoUrl: true,
				},
			},
		},
	})

	if (employee) {
		// Fetch FACTS profile picture if no uploaded photo
		if (!employee.employeeId?.photoUrl) {
			try {
				await fetchAndCacheFactsProfilePicture(employee.id, request)
				// Re-fetch to get the updated photoUrl
				const updatedEmployee = await prisma.employee.findUnique({
					where: { id },
					select: {
						employeeId: {
							select: {
								photoUrl: true,
								expirationDate: true,
							},
						},
					},
				})
				if (updatedEmployee?.employeeId) {
					employee.employeeId = updatedEmployee.employeeId
				}
			} catch (error) {
				// Log error but continue without photo
				console.error('Failed to fetch FACTS profile picture:', error)
			}
		}

		const expirationDate = employee.employeeId?.expirationDate ?? null
		const photoUrl = employee.employeeId?.photoUrl ?? null

		const verificationStatus = getVerificationStatus(
			employee.status,
			expirationDate,
		)

		const branding = await getBrandingConfig()

		return {
			personType: 'employee' as const,
			person: {
				id: employee.id,
				fullName: employee.fullName,
				jobTitle: employee.jobTitle,
				email: employee.email,
				status: employee.status,
				expirationDate: expirationDate?.toISOString() ?? null,
				photoUrl,
			},
			verificationStatus,
			branding,
		}
	}

	// Try to find student
	const student = await prisma.student.findUnique({
		where: { id },
		select: {
			id: true,
			fullName: true,
			email: true,
			status: true,
			studentId: {
				select: {
					expirationDate: true,
					photoUrl: true,
				},
			},
		},
	})

	if (student) {
		const expirationDate = student.studentId?.expirationDate ?? null
		const photoUrl = student.studentId?.photoUrl ?? null

		const verificationStatus = getVerificationStatus(
			student.status,
			expirationDate,
		)

		const branding = await getBrandingConfig()

		return {
			personType: 'student' as const,
			person: {
				id: student.id,
				fullName: student.fullName,
				email: student.email,
				status: student.status,
				expirationDate: expirationDate?.toISOString() ?? null,
				photoUrl,
			},
			verificationStatus,
			branding,
		}
	}

	throw new Response('Person not found', { status: 404 })
}

export function meta({ data }: Route.MetaArgs) {
	if (!data) {
		return [
			{ title: 'ID Verification' },
			{ name: 'description', content: 'Verify ID status' },
		]
	}

	const personTypeLabel =
		data.personType === 'employee' ? 'Employee' : 'Student'
	const statusLabel = data.verificationStatus.isValid ? 'Valid' : 'Invalid'

	return [
		{
			title: `${personTypeLabel} Verification: ${data.person.fullName} - ${statusLabel}`,
		},
		{
			name: 'description',
			content: `${personTypeLabel} verification for ${data.person.fullName}: ${data.verificationStatus.reason}`,
		},
	]
}

export default function VerifyId({ loaderData }: Route.ComponentProps) {
	const { personType, person, verificationStatus, branding } = loaderData
	const personTypeLabel = personType === 'employee' ? 'Faculty' : 'Student'

	const photoSrc =
		personType === 'employee'
			? getEmployeePhotoSrc(person.photoUrl)
			: getStudentPhotoSrc(person.photoUrl)

	const expirationDisplay = person.expirationDate
		? new Date(person.expirationDate).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			})
		: 'Not set'

	return (
		<div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-3xl">
				{/* Header with logo */}
				<div className="mb-8 text-center">
					<img
						src={HEADER_LOGO_SRC}
						alt={`${branding.schoolName} logo`}
						className="mx-auto h-20 w-auto"
					/>
					<h1 className="mt-4 text-3xl font-bold text-gray-900">
						ID Verification
					</h1>
				</div>

				{/* Main Card */}
				<Card className="overflow-hidden">
					<div className="px-6 py-8 sm:px-8">
						{/* Status Banner */}
						<div className="mb-6 flex justify-center">
							<StatusBadge
								isValid={verificationStatus.isValid}
								reason={verificationStatus.reason}
							/>
						</div>

						{/* Person Info Grid */}
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							{/* Photo */}
							<div className="flex justify-center sm:justify-start">
								{person.photoUrl ? (
									<img
										src={photoSrc}
										alt={`${person.fullName}'s photo`}
										className="h-48 w-48 rounded-lg object-cover shadow-md"
									/>
								) : (
									<div className="flex h-48 w-48 items-center justify-center rounded-lg bg-gray-200 shadow-md">
										<span className="text-4xl font-semibold text-gray-400">
											{person.fullName.charAt(0)}
										</span>
									</div>
								)}
							</div>

							{/* Details */}
							<KeyValueList
								items={[
									{ label: 'Name', value: person.fullName },
									{ label: 'Type', value: personTypeLabel },
									...(personType === 'employee' && 'jobTitle' in person
										? [{ label: 'Title' as const, value: person.jobTitle }]
										: []),
									{ label: 'Status', value: person.status },
									{
										label: 'Expiration Date',
										value: expirationDisplay,
									},
								]}
							/>
						</div>
					</div>

					{/* Footer with verification reason */}
					<div
						className={`px-6 py-4 sm:px-8 ${
							verificationStatus.isValid
								? 'bg-green-50'
								: 'bg-red-50'
						}`}
					>
						<p
							className={`text-center text-sm font-medium ${
								verificationStatus.isValid
									? 'text-green-800'
									: 'text-red-800'
							}`}
						>
							{verificationStatus.reason}
						</p>
					</div>
				</Card>

				{/* Footer */}
				<div className="mt-8 text-center text-sm text-gray-500">
					<p>
						This verification page is provided by {branding.schoolName}.
					</p>
					<p className="mt-2">
						For questions or concerns, please contact your administrator.
					</p>
				</div>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<div className="flex flex-col items-center justify-center py-20">
						<h1 className="text-4xl font-bold text-gray-900">
							Person Not Found
						</h1>
						<p className="mt-4 text-lg text-gray-600">
							No person found with ID: {params.id}
						</p>
					</div>
				),
				400: () => (
					<div className="flex flex-col items-center justify-center py-20">
						<h1 className="text-4xl font-bold text-gray-900">
							Invalid Request
						</h1>
						<p className="mt-4 text-lg text-gray-600">
							An ID is required for verification.
						</p>
					</div>
				),
			}}
		/>
	)
}
