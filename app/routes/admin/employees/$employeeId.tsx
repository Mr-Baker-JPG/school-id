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
import {
	getDefaultExpirationDate,
	fetchAndCacheFactsProfilePicture,
} from '#app/utils/employee.server.ts'
import { getEmployeePhotoSrc, useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
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
			},
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
	const { employee, photoUrl } = loaderData
	const hasPhoto = !!photoUrl
	const expirationDate = employee.employeeId?.expirationDate
		? new Date(employee.employeeId.expirationDate).toLocaleDateString()
		: 'Not set'
	const lastUpdated = new Date(employee.updatedAt).toLocaleString()
	const isPending = useIsPending({
		formAction: `/admin/employees/${employee.id}`,
	})

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
