import { invariantResponse } from '@epic-web/invariant'
import { Img } from 'openimg/react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, Link } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getNextJuly1ExpirationDate } from '#app/utils/student.server.ts'
import { getStudentPhotoSrc, useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/$studentId.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request, params }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const { studentId } = params

	invariantResponse(studentId, 'Student ID is required', { status: 400 })

	// Fetch student with all related data
	const student = await prisma.student.findUnique({
		where: { id: studentId },
		select: {
			id: true,
			sisStudentId: true,
			fullName: true,
			email: true,
			status: true,
			isNameEdited: true,
			createdAt: true,
			updatedAt: true,
			studentId: {
				select: {
					photoUrl: true,
					expirationDate: true,
					createdAt: true,
					updatedAt: true,
				},
			},
		},
	})

	invariantResponse(student, 'Student not found', { status: 404 })

	// Ensure StudentID record exists (create if missing)
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
				createdAt: true,
				updatedAt: true,
			},
		})
	}

	return {
		student: {
			...student,
			studentId: studentIdRecord,
		},
	}
}

export async function action({ request, params }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const { studentId } = params
	const formData = await request.formData()
	const intent = formData.get('intent')

	invariantResponse(studentId, 'Student ID is required', { status: 400 })

	if (intent === 'update-name') {
		const fullName = formData.get('fullName')
		invariantResponse(
			typeof fullName === 'string' && fullName.trim().length > 0,
			'Full name is required',
			{ status: 400 },
		)

		// Update student name and mark as edited
		await prisma.student.update({
			where: { id: studentId },
			data: {
				fullName: fullName.trim(),
				isNameEdited: true, // Mark as edited to preserve during SIS sync
			},
		})

		return redirectWithToast(`/admin/students/${studentId}`, {
			type: 'success',
			title: 'Name Updated',
			description: 'Student name has been updated and will be preserved during SIS syncs.',
		})
	}

	return redirectWithToast(`/admin/students/${studentId}`, {
		type: 'error',
		title: 'Error',
		description: 'Unknown action',
	})
}

export default function AdminStudentDetailRoute({
	loaderData,
}: Route.ComponentProps) {
	const { student } = loaderData
	const hasPhoto = !!student.studentId?.photoUrl
	const expirationDate = student.studentId?.expirationDate
		? new Date(student.studentId.expirationDate).toLocaleDateString()
		: 'Not set'
	const lastUpdated = new Date(student.updatedAt).toLocaleString()
	const isNameUpdatePending = useIsPending({
		formAction: `/admin/students/${student.id}`,
		intent: 'update-name',
	})

	const downloadButton = (
		<Button
			type="button"
			onClick={() => {
				window.location.href = `/resources/admin/student-pdf/${student.id}`
			}}
		>
			<Icon name="download">Download ID Card</Icon>
		</Button>
	)

	return (
		<div>
			<div className="mb-4">
				<Link
					to="/admin/students"
					className="text-muted-foreground hover:text-foreground flex items-center gap-2"
				>
					<Icon name="arrow-left">Back to Students</Icon>
				</Link>
			</div>

			<PageTitle
				title="Student Details"
				subtitle={student.fullName}
				rightSlot={downloadButton}
			/>

			<div className="mt-8 grid gap-6 md:grid-cols-2">
				{/* Left Column: Photo */}
				<CardSection title="Photo">
					<div className="flex items-center gap-4">
						{hasPhoto ? (
							<Img
								src={getStudentPhotoSrc(student.studentId?.photoUrl)}
								alt={student.fullName}
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
								<Link to={`/admin/students/${student.id}/photo`}>
									<Icon name="pencil-1">
										{hasPhoto ? 'Change Photo' : 'Upload Photo'}
									</Icon>
								</Link>
							</Button>
						</div>
					</div>
				</CardSection>

				{/* Right Column: Student Info */}
				<CardSection title="Student Info">
					<KeyValueList
						items={[
							{ key: 'Full Name', value: student.fullName },
							{ key: 'Email', value: student.email },
							{
								key: 'SIS Student ID',
								value: student.sisStudentId,
								mono: true,
							},
							{
								key: 'Status',
								value: (
									<StatusBadge
										variant={
											student.status === 'active' ? 'active' : 'inactive'
										}
									>
										{student.status}
									</StatusBadge>
								),
							},
							{
								key: 'Name Edited',
								value: student.isNameEdited ? 'Yes (preserved during sync)' : 'No',
							},
						]}
					/>
				</CardSection>
			</div>

			<div className="mt-6 grid gap-6 md:grid-cols-2">
				{/* Edit Name Section */}
				<CardSection title="Edit Name">
					<p className="text-muted-foreground mb-4 text-sm">
						Edit the student's name. Once edited, the name will be preserved
						during SIS syncs.
					</p>
					<Form method="post" className="flex flex-col gap-4">
						<input type="hidden" name="intent" value="update-name" />
						<div className="flex flex-col gap-1">
							<label htmlFor="fullName" className="text-body-xs">
								Full Name
							</label>
							<input
								type="text"
								id="fullName"
								name="fullName"
								defaultValue={student.fullName}
								className="border-input bg-background h-10 rounded-md border px-3 py-2"
								required
							/>
						</div>
						<StatusButton
							type="submit"
							status={isNameUpdatePending ? 'pending' : 'idle'}
							disabled={isNameUpdatePending}
						>
							<Icon name="pencil-1">Save Name</Icon>
						</StatusButton>
					</Form>
				</CardSection>

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
							<Link to={`/admin/students/${student.id}/expiration`}>
								<Icon name="pencil-1">Update</Icon>
							</Link>
						</Button>
					</div>
				</CardSection>
			</div>

			<div className="mt-6">
				{/* SIS Sync Status */}
				<CardSection title="SIS Sync Status">
					<KeyValueList
						items={[
							{
								key: 'Last Updated from SIS',
								value: lastUpdated,
								mono: true,
							},
							{
								key: 'Name Protected',
								value: student.isNameEdited
									? 'Yes - name edits will be preserved during sync'
									: 'No - name will be updated from SIS during sync',
							},
						]}
					/>
				</CardSection>
			</div>
		</div>
	)
}

export const meta: Route.MetaFunction = ({ data }) => {
	return [
		{
			title: `Student Details | ${data?.student.fullName ?? 'Student'}`,
		},
		{
			name: 'description',
			content: `Student details for ${data?.student.fullName ?? 'student'}`,
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
				404: () => <p>Student not found.</p>,
			}}
		/>
	)
}
