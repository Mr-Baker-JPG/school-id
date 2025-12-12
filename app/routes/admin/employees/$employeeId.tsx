import { invariantResponse } from '@epic-web/invariant'
import { Img } from 'openimg/react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Link } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { getEmployeePhotoSrc, cn } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
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

	return {
		employee: {
			...employee,
			employeeId: employeeIdRecord,
		},
	}
}

export default function AdminEmployeeDetailRoute({
	loaderData,
}: Route.ComponentProps) {
	const { employee } = loaderData
	const hasPhoto = !!employee.employeeId?.photoUrl
	const expirationDate = employee.employeeId?.expirationDate
		? new Date(employee.employeeId.expirationDate).toLocaleDateString()
		: 'Not set'
	const lastUpdated = new Date(employee.updatedAt).toLocaleString()

	return (
		<div className="container">
			<div className="mb-4">
				<Link
					to="/admin/employees"
					className="text-muted-foreground hover:text-foreground flex items-center gap-2"
				>
					<Icon name="arrow-left">Back to Employees</Icon>
				</Link>
			</div>

			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-h1">Employee Details</h1>
					<p className="text-muted-foreground">{employee.fullName}</p>
				</div>
				<Button asChild variant="outline">
					<a href={`/admin/employees/${employee.id}/id/download`}>
						<Icon name="download">Download ID Card</Icon>
					</a>
				</Button>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				{/* Employee Photo */}
				<div className="flex flex-col gap-4">
					<h2 className="text-h3">Photo</h2>
					<div className="flex items-center gap-4">
						{hasPhoto ? (
							<Img
								src={employee.employeeId?.photoUrl!}
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
						<Button asChild variant="outline">
							<Link to={`/admin/employees/${employee.id}/photo`}>
								<Icon name="pencil-1">
									{hasPhoto ? 'Change Photo' : 'Upload Photo'}
								</Icon>
							</Link>
						</Button>
					</div>
				</div>

				{/* Employee Information */}
				<div className="flex flex-col gap-4">
					<h2 className="text-h3">Information</h2>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<label className="text-body-xs text-muted-foreground">
								Full Name
							</label>
							<p className="text-body-lg">{employee.fullName}</p>
						</div>

						<div className="flex flex-col gap-2">
							<label className="text-body-xs text-muted-foreground">
								Job Title
							</label>
							<p className="text-body-lg">{employee.jobTitle}</p>
						</div>

						<div className="flex flex-col gap-2">
							<label className="text-body-xs text-muted-foreground">
								Email
							</label>
							<p className="text-body-lg">{employee.email}</p>
						</div>

						<div className="flex flex-col gap-2">
							<label className="text-body-xs text-muted-foreground">
								SIS Employee ID
							</label>
							<p className="text-body-lg">{employee.sisEmployeeId}</p>
						</div>

						<div className="flex flex-col gap-2">
							<label className="text-body-xs text-muted-foreground">
								Status
							</label>
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
					</div>
				</div>
			</div>

			<Spacer size="md" />

			{/* SIS Sync Status */}
			<div className="flex flex-col gap-4">
				<h2 className="text-h3">SIS Sync Status</h2>
				<div className="flex flex-col gap-2">
					<label className="text-body-xs text-muted-foreground">
						Last Updated from SIS
					</label>
					<p className="text-body-lg">{lastUpdated}</p>
				</div>
			</div>

			<Spacer size="md" />

			{/* ID Card Information */}
			<div className="flex flex-col gap-4">
				<h2 className="text-h3">ID Card Information</h2>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label className="text-body-xs text-muted-foreground">
							Expiration Date
						</label>
						<div className="flex items-center gap-4">
							<p className="text-body-lg">{expirationDate}</p>
							<Button asChild variant="outline" size="sm">
								<Link to={`/admin/employees/${employee.id}/expiration`}>
									<Icon name="pencil-1">Update</Icon>
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<Spacer size="md" />

			{/* Actions */}
			<div className="flex flex-col gap-4">
				<h2 className="text-h3">Actions</h2>
				<div className="flex flex-wrap gap-4">
					<Button asChild variant="outline">
						<Link to={`/admin/employees/${employee.id}/photo`}>
							<Icon name="pencil-1">
								{hasPhoto ? 'Change Photo' : 'Upload Photo'}
							</Icon>
						</Link>
					</Button>
					<Button asChild variant="outline">
						<Link to={`/admin/employees/${employee.id}/expiration`}>
							<Icon name="calendar">Update Expiration Date</Icon>
						</Link>
					</Button>
					<Button asChild variant="outline">
						<a href={`/admin/employees/${employee.id}/id/download`}>
							<Icon name="download">Download ID Card</Icon>
						</a>
					</Button>
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
