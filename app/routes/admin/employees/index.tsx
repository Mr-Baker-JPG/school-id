import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { redirect, Form, Link, useSearchParams, useSubmit } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Field } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { useDebounce, useDelayedIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { cn } from '#app/utils/misc.tsx'
import { type Route } from './+types/index.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const searchParams = new URL(request.url).searchParams
	const search = searchParams.get('search')
	const status = searchParams.get('status') // 'active', 'inactive', or null for all

	// Redirect if search is empty string
	if (search === '') {
		searchParams.delete('search')
		return redirect(`/admin/employees?${searchParams.toString()}`)
	}

	// Build where clause for filtering
	const where: {
		OR?: Array<
			{ fullName: { contains: string } } | { email: { contains: string } }
		>
		status?: string
	} = {}

	// Add search filter (name or email)
	if (search) {
		where.OR = [
			{ fullName: { contains: search } },
			{ email: { contains: search } },
		]
	}

	// Add status filter
	if (status === 'active' || status === 'inactive') {
		where.status = status
	}

	// Fetch employees with their EmployeeID data
	const employees = await prisma.employee.findMany({
		where,
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
		orderBy: {
			fullName: 'asc',
		},
	})

	return {
		employees,
		search: search ?? '',
		status: status ?? 'all',
	}
}

export default function AdminEmployeesRoute({
	loaderData,
}: Route.ComponentProps) {
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const search = searchParams.get('search') ?? loaderData.search
	const status = searchParams.get('status') ?? loaderData.status

	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/admin/employees',
	})

	const handleFormChange = useDebounce(async (form: HTMLFormElement) => {
		await submit(form)
	}, 400)

	return (
		<div className="container">
			<h1 className="text-h1">Employee Management</h1>
			<Spacer size="2xs" />
			<Form
				method="get"
				className="flex flex-col gap-4"
				onChange={(e) => handleFormChange(e.currentTarget)}
			>
				<div className="flex flex-wrap items-center gap-4">
					<Field
						className="min-w-[200px] flex-1"
						labelProps={{ children: 'Search' }}
						inputProps={{
							type: 'search',
							name: 'search',
							defaultValue: search,
							placeholder: 'Search by name or email',
						}}
					/>
					<div className="flex flex-col gap-1">
						<label htmlFor="status-filter" className="text-body-xs">
							Status
						</label>
						<select
							id="status-filter"
							name="status"
							defaultValue={status}
							className="border-input bg-background h-16 rounded-md border px-3 py-2"
						>
							<option value="all">All</option>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
						</select>
					</div>
				</div>
			</Form>
			<Spacer size="2xs" />
			<div
				className={cn('flex flex-col gap-4', {
					'opacity-50': isPending,
				})}
			>
				{loaderData.employees.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="border-b">
									<th className="p-2 text-left">Name</th>
									<th className="p-2 text-left">Job Title</th>
									<th className="p-2 text-left">Email</th>
									<th className="p-2 text-left">Status</th>
									<th className="p-2 text-left">Expiration Date</th>
									<th className="p-2 text-left">Photo</th>
								</tr>
							</thead>
							<tbody>
								{loaderData.employees.map((employee) => (
									<tr key={employee.id} className="hover:bg-muted/50 border-b">
										<td className="p-2">
											<Link
												to={`/admin/employees/${employee.id}`}
												className="text-foreground hover:underline"
											>
												{employee.fullName}
											</Link>
										</td>
										<td className="p-2">{employee.jobTitle}</td>
										<td className="p-2">{employee.email}</td>
										<td className="p-2">
											<span
												className={cn(
													'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
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
										</td>
										<td className="p-2">
											<Link
												to={`/admin/employees/${employee.id}/expiration`}
												className="text-foreground hover:underline"
											>
												{employee.employeeId?.expirationDate
													? new Date(
															employee.employeeId.expirationDate,
														).toLocaleDateString()
													: 'Not set'}
											</Link>
										</td>
										<td className="p-2">
											<Link
												to={`/admin/employees/${employee.id}/photo`}
												className="text-foreground hover:underline"
											>
												{employee.employeeId?.photoUrl ? (
													<span className="text-green-600 dark:text-green-400">
														✓ Has photo
													</span>
												) : (
													<span className="text-muted-foreground">
														No photo
													</span>
												)}
											</Link>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className="text-muted-foreground">No employees found</p>
				)}
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: ({ error }) => (
					<p>You are not allowed to do that: {error?.data.message}</p>
				),
			}}
		/>
	)
}
