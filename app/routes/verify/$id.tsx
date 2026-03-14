import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Img } from 'openimg/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { SCHOOL_NAME, LOGO_SRC, CREST_SRC } from '#app/ui/brand.ts'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { fetchAndCacheFactsProfilePicture as fetchEmployeeProfilePicture } from '#app/utils/employee.server.ts'
import { getEmployeePhotoSrc, getStudentPhotoSrc } from '#app/utils/misc.tsx'
import { fetchAndCacheFactsProfilePicture as fetchStudentProfilePicture } from '#app/utils/student.server.ts'
import { getVerificationStatus } from '#app/utils/verification.server.ts'
import { type Route } from './+types/$id.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ params }: Route.LoaderArgs) {
	const { id } = params

	if (!id) {
		throw new Response('ID is required', { status: 400 })
	}

	// Try to find employee by SIS ID first, then by database ID (for backward compatibility)
	const employee = await prisma.employee.findFirst({
		where: {
			OR: [{ sisEmployeeId: id }, { id }],
		},
		select: {
			id: true,
			sisEmployeeId: true,
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
				await fetchEmployeeProfilePicture(employee.id, employee.sisEmployeeId)
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

	// Try to find student by SIS ID first, then by database ID
	const student = await prisma.student.findFirst({
		where: {
			OR: [{ sisStudentId: id }, { id }],
		},
		select: {
			id: true,
			sisStudentId: true,
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
		if (!student.studentId?.photoUrl) {
			try {
				await fetchStudentProfilePicture(student.id, student.sisStudentId)
				const updatedStudent = await prisma.student.findUnique({
					where: { id },
					select: {
						studentId: {
							select: {
								photoUrl: true,
								expirationDate: true,
							},
						},
					},
				})
				if (updatedStudent?.studentId) {
					student.studentId = updatedStudent.studentId
				}
			} catch (error) {
				console.error(
					'Failed to fetch FACTS profile picture for student:',
					error,
				)
			}
		}

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
	const logoSrc = branding.logoUrl || LOGO_SRC
	const crestSrc = branding.crestUrl || CREST_SRC

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
		<div className="bg-background font-body min-h-screen px-4 py-12 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-2xl">
				{/* ── HEADER ── */}
				<div className="mb-10 text-center">
					<div className="bg-card mx-auto mb-4 flex size-20 items-center justify-center rounded-full shadow-sm">
						<Img
							src={crestSrc}
							alt={`${branding.schoolName} crest`}
							className="h-16 w-auto object-contain object-top"
							width={128}
							height={128}
						/>
					</div>
					<h1 className="font-display text-primary text-2xl font-semibold tracking-wide sm:text-3xl">
						ID Verification
					</h1>
					<p className="text-muted-foreground mt-1 font-mono text-[0.65rem] tracking-[0.12em] uppercase">
						{branding.schoolName}
					</p>
				</div>

				{/* ── VERIFICATION STATUS STAMP ── */}
				<div className="mb-8 flex justify-center">
					<div
						className={`flex items-center gap-2.5 border-2 px-5 py-2.5 ${
							verificationStatus.isValid
								? 'border-emerald-700 text-emerald-700'
								: 'border-destructive text-destructive'
						}`}
					>
						<Icon
							name={verificationStatus.isValid ? 'check' : 'cross-1'}
							className="size-5"
						/>
						<span className="font-mono text-sm font-medium tracking-[0.1em] uppercase">
							{verificationStatus.isValid ? 'Verified — Valid ID' : 'Invalid'}
						</span>
					</div>
				</div>

				{/* ── DOSSIER CARD ── */}
				<div className="border-border bg-card relative border shadow-sm">
					{/* Gold accent line */}
					<div className="from-brand-gold via-brand-gold/70 to-brand-gold absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r" />

					<div className="px-6 py-8 sm:px-8">
						{/* Photo + Name header */}
						<div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
							{/* Photo */}
							<div className="relative shrink-0">
								<div className="border-brand-navy/20 border-2 p-0.5">
									<div className="border-brand-gold/30 border">
										{person.photoUrl ? (
											<img
												src={photoSrc}
												alt={`${person.fullName}'s photo`}
												className="size-36 object-cover object-top"
											/>
										) : (
											<div className="bg-muted flex size-36 items-center justify-center">
												<span className="font-display text-muted-foreground text-3xl font-semibold">
													{person.fullName.charAt(0)}
												</span>
											</div>
										)}
									</div>
								</div>
								{/* Type badge */}
								<div className="bg-brand-navy text-brand-gold absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 font-mono text-[0.55rem] tracking-[0.14em] whitespace-nowrap uppercase">
									{personTypeLabel}
								</div>
							</div>

							{/* Name + stamps */}
							<div className="flex-1 text-center sm:text-left">
								<h2 className="font-display text-primary text-xl font-semibold tracking-wide sm:text-2xl">
									{person.fullName}
								</h2>
								{personType === 'employee' && 'jobTitle' in person && (
									<p className="font-body text-muted-foreground mt-1 text-base italic">
										{person.jobTitle}
									</p>
								)}
								<div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
									<StatusBadge
										variant={person.status === 'active' ? 'active' : 'inactive'}
									>
										{person.status}
									</StatusBadge>
									<StatusBadge
										variant={verificationStatus.isValid ? 'valid' : 'expired'}
									>
										{verificationStatus.isValid ? 'ID Valid' : 'ID Invalid'}
									</StatusBadge>
								</div>
							</div>
						</div>

						{/* Gold rule */}
						<div className="via-brand-gold my-6 h-px bg-gradient-to-r from-transparent to-transparent" />

						{/* Details */}
						<KeyValueList
							items={[
								{ key: 'Full Name', value: person.fullName },
								{ key: 'Type', value: personTypeLabel },
								...(personType === 'employee' && 'jobTitle' in person
									? [{ key: 'Title', value: person.jobTitle }]
									: []),
								{
									key: 'Account Status',
									value: (
										<StatusBadge
											variant={
												person.status === 'active' ? 'active' : 'inactive'
											}
											className="rotate-0"
										>
											{person.status}
										</StatusBadge>
									),
								},
								{
									key: 'Expiration',
									value: expirationDisplay,
									mono: true,
								},
							]}
						/>
					</div>

					{/* Footer — verification reason */}
					<div
						className={`border-t px-6 py-4 sm:px-8 ${
							verificationStatus.isValid
								? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
								: 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
						}`}
					>
						<p
							className={`font-body text-center text-sm font-medium ${
								verificationStatus.isValid
									? 'text-emerald-800 dark:text-emerald-400'
									: 'text-red-800 dark:text-red-400'
							}`}
						>
							{verificationStatus.reason}
						</p>
					</div>
				</div>

				{/* Footer text */}
				<div className="mt-8 text-center">
					<p className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.1em] uppercase">
						This verification page is provided by {branding.schoolName}
					</p>
					<p className="font-body text-muted-foreground mt-1 text-xs italic">
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
					<div className="bg-background font-body flex min-h-screen flex-col items-center justify-center px-4 py-20">
						<div className="bg-card mx-auto mb-6 flex size-16 items-center justify-center rounded-full shadow-sm">
							<Img
								src={LOGO_SRC}
								alt={SCHOOL_NAME}
								className="h-12 w-auto object-contain object-top"
								width={96}
								height={96}
							/>
						</div>
						<h1 className="font-display text-primary text-2xl font-semibold">
							Person Not Found
						</h1>
						<p className="font-body text-muted-foreground mt-3 text-base">
							No person found with ID:{' '}
							<span className="font-mono text-sm">{params.id}</span>
						</p>
					</div>
				),
				400: () => (
					<div className="bg-background font-body flex min-h-screen flex-col items-center justify-center px-4 py-20">
						<div className="bg-card mx-auto mb-6 flex size-16 items-center justify-center rounded-full shadow-sm">
							<Img
								src={LOGO_SRC}
								alt={SCHOOL_NAME}
								className="h-12 w-auto object-contain object-top"
								width={96}
								height={96}
							/>
						</div>
						<h1 className="font-display text-primary text-2xl font-semibold">
							Invalid Request
						</h1>
						<p className="font-body text-muted-foreground mt-3 text-base">
							An ID is required for verification.
						</p>
					</div>
				),
			}}
		/>
	)
}
