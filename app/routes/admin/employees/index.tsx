import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	redirect,
	Form,
	Link,
	useSearchParams,
	useSubmit,
	useNavigation,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Field } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { syncEmployeesFromFacts } from '#app/utils/employee-sync.server.ts'
import {
	fetchAndCacheFactsProfilePicture,
	getExpirationStatus,
	type ExpirationStatus,
} from '#app/utils/employee.server.ts'
import {
	cn,
	useDebounce,
	useDelayedIsPending,
	useIsPending,
} from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
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

	// Calculate expiration status for each employee
	const employeesWithExpirationStatus = employees.map((employee) => {
		let expirationStatus: ExpirationStatus | null = null
		if (employee.employeeId?.expirationDate) {
			expirationStatus = getExpirationStatus(employee.employeeId.expirationDate)
		}

		return {
			...employee,
			expirationStatus,
		}
	})

	// Calculate summary statistics
	const expiringCount = employeesWithExpirationStatus.filter(
		(e) => e.expirationStatus?.type === 'expiring',
	).length
	const expiredCount = employeesWithExpirationStatus.filter(
		(e) => e.expirationStatus?.type === 'expired',
	).length

	return {
		employees: employeesWithExpirationStatus,
		search: search ?? '',
		status: status ?? 'all',
		expiringCount,
		expiredCount,
	}
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'sync') {
		const result = await syncEmployeesFromFacts()
		console.log('result', JSON.stringify(result, null, 2))

		// Preserve search params
		const searchParams = new URL(request.url).searchParams
		const redirectUrl = `/admin/employees${
			searchParams.toString() ? `?${searchParams.toString()}` : ''
		}`

		if (result.success) {
			const message =
				result.created > 0 || result.updated > 0
					? `Sync completed: ${result.created} created, ${result.updated} updated${
							result.errors > 0 ? `, ${result.errors} errors` : ''
						}`
					: 'Sync completed: No changes needed'

			return redirectWithToast(redirectUrl, {
				type: 'success',
				title: 'Sync Successful',
				description: message,
			})
		} else {
			return redirectWithToast(redirectUrl, {
				type: 'error',
				title: 'Sync Failed',
				description: result.errorMessage || 'An error occurred during sync',
			})
		}
	}

	if (intent === 'recheck-facts-photo') {
		const employeeId = formData.get('employeeId')

		if (!employeeId || typeof employeeId !== 'string') {
			const searchParams = new URL(request.url).searchParams
			const redirectUrl = `/admin/employees${
				searchParams.toString() ? `?${searchParams.toString()}` : ''
			}`
			return redirectWithToast(redirectUrl, {
				type: 'error',
				title: 'Error',
				description: 'Employee ID is required',
			})
		}

		// Fetch employee to get sisEmployeeId
		const employee = await prisma.employee.findUnique({
			where: { id: employeeId },
			select: { sisEmployeeId: true, fullName: true },
		})

		if (!employee) {
			const searchParams = new URL(request.url).searchParams
			const redirectUrl = `/admin/employees${
				searchParams.toString() ? `?${searchParams.toString()}` : ''
			}`
			return redirectWithToast(redirectUrl, {
				type: 'error',
				title: 'Error',
				description: 'Employee not found',
			})
		}

		// Force re-fetch from FACTS
		const cachedPhotoUrl = await fetchAndCacheFactsProfilePicture(
			employeeId,
			employee.sisEmployeeId,
			true, // force re-fetch
		)

		const searchParams = new URL(request.url).searchParams
		const redirectUrl = `/admin/employees${
			searchParams.toString() ? `?${searchParams.toString()}` : ''
		}`

		if (cachedPhotoUrl) {
			return redirectWithToast(redirectUrl, {
				type: 'success',
				title: 'Photo Updated',
				description: `Successfully refreshed FACTS profile picture for ${employee.fullName}`,
			})
		} else {
			return redirectWithToast(redirectUrl, {
				type: 'message',
				title: 'No Photo Available',
				description: `No FACTS profile picture found for ${employee.fullName}, or employee has an uploaded photo that takes precedence`,
			})
		}
	}

	const searchParams = new URL(request.url).searchParams
	const redirectUrl = `/admin/employees${
		searchParams.toString() ? `?${searchParams.toString()}` : ''
	}`
	return redirect(redirectUrl)
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

	const syncPending = useIsPending({ formAction: '/admin/employees' })
	const navigation = useNavigation()

	const handleFormChange = useDebounce(async (form: HTMLFormElement) => {
		await submit(form)
	}, 400)

	return (
		<div className="container">
			<div className="flex items-center justify-between">
				<h1 className="text-h1">Employee Management</h1>
				<Form method="post">
					<input type="hidden" name="intent" value="sync" />
					<StatusButton
						type="submit"
						variant="outline"
						status={syncPending ? 'pending' : 'idle'}
						disabled={syncPending}
					>
						<Icon name="update" />
						Sync from FACTS
					</StatusButton>
				</Form>
			</div>
			<Spacer size="2xs" />
			{(loaderData.expiringCount > 0 || loaderData.expiredCount > 0) && (
				<div className="bg-muted/50 rounded-lg border p-4">
					<h2 className="text-h4 mb-2">Expiration Warnings</h2>
					<div className="flex flex-wrap gap-4">
						{loaderData.expiringCount > 0 && (
							<div className="flex items-center gap-2">
								<span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
									{loaderData.expiringCount} ID
									{loaderData.expiringCount !== 1 ? 's' : ''} expiring within 30
									days
								</span>
							</div>
						)}
						{loaderData.expiredCount > 0 && (
							<div className="flex items-center gap-2">
								<span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
									{loaderData.expiredCount} ID
									{loaderData.expiredCount !== 1 ? 's' : ''} expired
								</span>
							</div>
						)}
					</div>
				</div>
			)}
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
									<th className="p-2 text-left">Actions</th>
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
											<div className="flex flex-col gap-1">
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
												{employee.expirationStatus &&
													employee.expirationStatus.type !== 'valid' && (
														<span
															className={cn(
																'inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-medium',
																{
																	'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200':
																		employee.expirationStatus.type ===
																		'expiring',
																	'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200':
																		employee.expirationStatus.type ===
																		'expired',
																},
															)}
														>
															{employee.expirationStatus.type === 'expiring'
																? `Expires in ${employee.expirationStatus.daysUntilExpiration} day${employee.expirationStatus.daysUntilExpiration !== 1 ? 's' : ''}`
																: `Expired ${employee.expirationStatus.daysSinceExpiration} day${employee.expirationStatus.daysSinceExpiration !== 1 ? 's' : ''} ago`}
														</span>
													)}
											</div>
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
										<td className="p-2">
											<Form method="post" className="inline">
												<input
													type="hidden"
													name="intent"
													value="recheck-facts-photo"
												/>
												<input
													type="hidden"
													name="employeeId"
													value={employee.id}
												/>
												<StatusButton
													type="submit"
													variant="outline"
													size="sm"
													status={
														navigation.state === 'submitting' &&
														navigation.formData?.get('employeeId') ===
															employee.id
															? 'pending'
															: 'idle'
													}
													disabled={
														navigation.state === 'submitting' &&
														navigation.formData?.get('employeeId') ===
															employee.id
													}
												>
													<Icon name="update" className="scale-75">
														Recheck
													</Icon>
												</StatusButton>
											</Form>
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
