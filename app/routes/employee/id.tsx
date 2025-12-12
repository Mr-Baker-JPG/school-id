import { invariantResponse } from '@epic-web/invariant'
import { Img } from 'openimg/react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { cn } from '#app/utils/misc.tsx'
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

	return {
		employee: {
			...employee,
			employeeId,
		},
	}
}

export default function EmployeeIdRoute({ loaderData }: Route.ComponentProps) {
	const { employee } = loaderData
	const hasPhoto = !!employee.employeeId?.photoUrl
	const expirationDate = employee.employeeId?.expirationDate
		? new Date(employee.employeeId.expirationDate).toLocaleDateString()
		: 'Not set'
	const hasEmployeeId = !!employee.employeeId

	return (
		<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
			<Spacer size="4xs" />
			<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
				<h1 className="text-h2 mb-6">My Employee ID</h1>

				{/* Employee Photo */}
				<div className="mb-6">
					{hasPhoto && hasEmployeeId ? (
						<Img
							src={employee.employeeId?.photoUrl!}
							alt={employee.fullName}
							className="size-48 rounded-lg object-cover"
							width={384}
							height={384}
						/>
					) : (
						<div className="bg-muted-foreground/20 flex size-48 items-center justify-center rounded-lg">
							<Icon name="avatar" className="text-muted-foreground size-24" />
						</div>
					)}
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
						<label className="text-body-xs text-muted-foreground">Email</label>
						<p className="text-body-lg">{employee.email}</p>
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
				</div>

				<Spacer size="md" />

				{/* Download Button */}
				<Button size="lg" asChild>
					<a href="/employee/id/download">
						<Icon name="download" className="scale-125">
							Download ID Card
						</Icon>
					</a>
				</Button>
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
