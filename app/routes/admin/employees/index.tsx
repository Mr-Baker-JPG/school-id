import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useState, useMemo, useCallback } from 'react'
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
import { Card } from '#app/components/ui/card.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '#app/components/ui/tooltip.tsx'
import { BulkActionsBar } from '#app/ui/components/BulkActionsBar.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { EmployeeQuickViewDrawer } from '#app/ui/components/EmployeeQuickViewDrawer.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
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
import { createColumns } from './columns.tsx'
import { DataTable } from './data-table.tsx'

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
			const parts: string[] = []
			if (result.created > 0) parts.push(`${result.created} created`)
			if (result.updated > 0) parts.push(`${result.updated} updated`)
			if (result.photosUpdated > 0)
				parts.push(`${result.photosUpdated} photos updated`)
			if (result.errors > 0) parts.push(`${result.errors} errors`)
			if (result.photosErrors > 0)
				parts.push(`${result.photosErrors} photo errors`)

			const message =
				parts.length > 0
					? `Sync completed: ${parts.join(', ')}`
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
		const employeeIds = formData.getAll('employeeIds')

		// Handle bulk recheck
		if (employeeIds.length > 0) {
			const searchParams = new URL(request.url).searchParams
			const redirectUrl = `/admin/employees${
				searchParams.toString() ? `?${searchParams.toString()}` : ''
			}`

			let successCount = 0
			let errorCount = 0

			for (const id of employeeIds) {
				if (typeof id !== 'string') continue

				const employee = await prisma.employee.findUnique({
					where: { id },
					select: { sisEmployeeId: true, fullName: true },
				})

				if (!employee) {
					errorCount++
					continue
				}

				try {
					const cachedPhotoUrl = await fetchAndCacheFactsProfilePicture(
						id,
						employee.sisEmployeeId,
						true, // force re-fetch
					)
					if (cachedPhotoUrl) {
						successCount++
					} else {
						errorCount++
					}
				} catch {
					errorCount++
				}
			}

			if (successCount > 0 && errorCount === 0) {
				return redirectWithToast(redirectUrl, {
					type: 'success',
					title: 'Photos Updated',
					description: `Successfully refreshed ${successCount} employee photo${successCount !== 1 ? 's' : ''}`,
				})
			} else if (successCount > 0) {
				return redirectWithToast(redirectUrl, {
					type: 'success',
					title: 'Photos Updated',
					description: `Refreshed ${successCount} photo${successCount !== 1 ? 's' : ''}. ${errorCount} failed.`,
				})
			} else {
				return redirectWithToast(redirectUrl, {
					type: 'error',
					title: 'Photo Update Failed',
					description: `Failed to refresh ${errorCount} employee photo${errorCount !== 1 ? 's' : ''}`,
				})
			}
		}

		// Handle single recheck
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
	const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
		new Set(),
	)
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [selectedEmployeeForDrawer, setSelectedEmployeeForDrawer] = useState<
		(typeof loaderData.employees)[0] | null
	>(null)

	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/admin/employees',
	})

	const syncPending = useIsPending({ formAction: '/admin/employees' })
	const navigation = useNavigation()

	const handleFormChange = useDebounce(async (form: HTMLFormElement) => {
		await submit(form)
	}, 400)

	const handleRowClick = useCallback(
		(employee: (typeof loaderData.employees)[0]) => {
			setSelectedEmployeeForDrawer(employee)
			setDrawerOpen(true)
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	)

	const handleClearAllSelection = useCallback(() => {
		setSelectedEmployees(new Set())
	}, [])

	const columns = useMemo(
		() => createColumns(handleRowClick, handleClearAllSelection),
		[handleRowClick, handleClearAllSelection],
	)

	// Convert selectedEmployees Set to TanStack Table rowSelection format
	const rowSelection = useMemo(() => {
		const selection: Record<string, boolean> = {}
		selectedEmployees.forEach((id) => {
			selection[id] = true
		})
		return selection
	}, [selectedEmployees])

	const handleRowSelectionChange = useCallback(
		(selection: Record<string, boolean>) => {
			console.log('handleRowSelectionChange called with:', selection)
			const newSelection = new Set<string>()
			Object.keys(selection).forEach((id) => {
				if (selection[id]) {
					newSelection.add(id)
				}
			})
			console.log('Setting selectedEmployees to:', Array.from(newSelection))
			setSelectedEmployees(newSelection)
		},
		[],
	)

	const handleSelectEmployee = useCallback((employeeId: string) => {
		setSelectedEmployees((prev) => {
			const newSelection = new Set(prev)
			if (newSelection.has(employeeId)) {
				newSelection.delete(employeeId)
			} else {
				newSelection.add(employeeId)
			}
			return newSelection
		})
	}, [])

	const handlePrintSelected = useCallback(() => {
		if (selectedEmployees.size === 0) {
			console.warn('No employees selected for printing')
			return
		}

		// Build URL with employee IDs as query parameters
		const params = new URLSearchParams()
		Array.from(selectedEmployees).forEach((id) => {
			params.append('employeeIds', id)
		})

		// Open in new window to trigger download
		const printUrl = `/admin/employees/print?${params.toString()}`
		window.open(printUrl, '_blank')
	}, [selectedEmployees])

	const handleBulkRecheckPhotos = () => {
		if (selectedEmployees.size === 0) return

		// Create form with all selected employee IDs
		const form = document.createElement('form')
		form.method = 'POST'
		form.style.display = 'none'

		const intentInput = document.createElement('input')
		intentInput.type = 'hidden'
		intentInput.name = 'intent'
		intentInput.value = 'recheck-facts-photo'
		form.appendChild(intentInput)

		// Add all selected employee IDs
		Array.from(selectedEmployees).forEach((employeeId) => {
			const employeeIdInput = document.createElement('input')
			employeeIdInput.type = 'hidden'
			employeeIdInput.name = 'employeeIds'
			employeeIdInput.value = employeeId
			form.appendChild(employeeIdInput)
		})

		document.body.appendChild(form)
		form.submit()
		// Note: Form will be removed by page navigation
	}

	const syncButton = (
		<Form method="post">
			<input type="hidden" name="intent" value="sync" />
			<StatusButton
				type="submit"
				status={syncPending ? 'pending' : 'idle'}
				disabled={syncPending}
			>
				<Icon name="update" className="mr-4" />
				Sync from FACTS
			</StatusButton>
		</Form>
	)

	return (
		<div>
			<PageTitle
				title="Employee Management"
				rightSlot={
					<div className="flex items-center gap-2">
						{/* {selectedEmployees.size > 0 ? (
							<StatusButton
								type="button"
								onClick={handlePrintSelected}
								status="idle"
								className="ml-2"
							>
								<Icon name="file-text" />
								Print Selected ({selectedEmployees.size})
							</StatusButton>
						) : null} */}
						{syncButton}
					</div>
				}
			/>

			{(loaderData.expiringCount > 0 || loaderData.expiredCount > 0) && (
				<Card className="mt-6 border-amber-500/50 bg-amber-50/50 shadow-sm dark:bg-amber-950/20">
					<div className="p-4">
						<h2 className="text-h4 mb-2">Expiration Warnings</h2>
						<div className="flex flex-wrap gap-4">
							{loaderData.expiringCount > 0 && (
								<StatusBadge variant="expiring">
									{loaderData.expiringCount} ID
									{loaderData.expiringCount !== 1 ? 's' : ''} expiring within 30
									days
								</StatusBadge>
							)}
							{loaderData.expiredCount > 0 && (
								<StatusBadge variant="expired">
									{loaderData.expiredCount} ID
									{loaderData.expiredCount !== 1 ? 's' : ''} expired
								</StatusBadge>
							)}
						</div>
					</div>
				</Card>
			)}

			<div className="mt-6">
				<Form
					method="get"
					className="flex flex-col gap-4"
					onChange={(e) => handleFormChange(e.currentTarget)}
				>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
						<Field
							className="min-w-0 flex-1"
							labelProps={{ children: 'Search' }}
							inputProps={{
								type: 'search',
								name: 'search',
								defaultValue: search,
								placeholder: 'Search by name or email',
							}}
						/>
						<div className="flex flex-col gap-1 sm:w-auto">
							<label htmlFor="status-filter" className="text-body-xs">
								Status
							</label>
							<select
								id="status-filter"
								name="status"
								defaultValue={status}
								className="border-input bg-background h-10 rounded-md border px-3 py-2"
							>
								<option value="all">All</option>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</select>
						</div>
					</div>
				</Form>
			</div>

			{/* Bulk Action Bar */}
			<BulkActionsBar
				selectedCount={selectedEmployees.size}
				onClearSelection={() => setSelectedEmployees(new Set())}
				actions={[
					{
						label: 'Recheck Photos',
						icon: 'update',
						onClick: handleBulkRecheckPhotos,
						variant: 'default',
					},
					{
						label: 'Download ID Cards',
						icon: 'download',
						onClick: handlePrintSelected,
						variant: 'outline',
					},
				]}
			/>

			<div className="mt-6">
				<div className={cn('flex flex-col gap-4', isPending && 'opacity-50')}>
					{loaderData.employees.length > 0 ? (
						<>
							{/* Mobile Card View */}
							<div className="flex flex-col gap-4 md:hidden">
								{loaderData.employees.map((employee) => (
									<Card
										key={employee.id}
										className="border-muted/50 hover:bg-muted/50 shadow-sm"
									>
										<CardSection>
											<div className="flex flex-col gap-4">
												<div className="flex items-start gap-2">
													<input
														type="checkbox"
														checked={selectedEmployees.has(employee.id)}
														onChange={() => handleSelectEmployee(employee.id)}
														className="mt-1 h-4 w-4 rounded border-gray-300"
													/>
													<div className="flex-1">
														<div>
															<Link
																to={`/admin/employees/${employee.id}`}
																className="text-h4 text-foreground hover:underline"
															>
																{employee.fullName}
															</Link>
														</div>
													</div>
												</div>
												<KeyValueList
													items={[
														{ key: 'Job Title', value: employee.jobTitle },
														{ key: 'Email', value: employee.email },
														{
															key: 'Status',
															value: (
																<StatusBadge
																	variant={
																		employee.status === 'active'
																			? 'active'
																			: 'inactive'
																	}
																>
																	{employee.status}
																</StatusBadge>
															),
														},
														{
															key: 'Expiration Date',
															value: (
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
																		employee.expirationStatus.type !==
																			'valid' && (
																			<StatusBadge
																				variant={
																					employee.expirationStatus.type ===
																					'expiring'
																						? 'expiring'
																						: 'expired'
																				}
																			>
																				{employee.expirationStatus.type ===
																				'expiring'
																					? `Expires in ${employee.expirationStatus.daysUntilExpiration} day${employee.expirationStatus.daysUntilExpiration !== 1 ? 's' : ''}`
																					: `Expired ${employee.expirationStatus.daysSinceExpiration} day${employee.expirationStatus.daysSinceExpiration !== 1 ? 's' : ''} ago`}
																			</StatusBadge>
																		)}
																</div>
															),
														},
														{
															key: 'Photo',
															value: (
																<Link
																	to={`/admin/employees/${employee.id}/photo`}
																	className="text-foreground flex items-center gap-1.5 text-sm hover:underline"
																>
																	{employee.employeeId?.photoUrl ? (
																		<>
																			<Icon
																				name="check"
																				className="size-4 text-green-600 dark:text-green-400"
																			/>
																			<span>Has photo</span>
																		</>
																	) : (
																		<>
																			<Icon
																				name="cross-1"
																				className="text-muted-foreground size-4"
																			/>
																			<span className="text-muted-foreground">
																				No photo
																			</span>
																		</>
																	)}
																</Link>
															),
														},
													]}
												/>
												<div className="pt-2">
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
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<div>
																		<StatusButton
																			type="submit"
																			variant="outline"
																			size="sm"
																			status={
																				navigation.state === 'submitting' &&
																				navigation.formData?.get(
																					'employeeId',
																				) === employee.id
																					? 'pending'
																					: 'idle'
																			}
																			disabled={
																				navigation.state === 'submitting' &&
																				navigation.formData?.get(
																					'employeeId',
																				) === employee.id
																			}
																		>
																			<Icon name="update" className="scale-75">
																				Re-verify
																			</Icon>
																		</StatusButton>
																	</div>
																</TooltipTrigger>
																<TooltipContent>
																	Re-sync employee record from FACTS SIS
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</Form>
												</div>
											</div>
										</CardSection>
									</Card>
								))}
							</div>

							{/* Desktop Table View */}
							<div className="hidden md:block">
								<DataTable
									columns={columns}
									data={loaderData.employees}
									onRowClick={handleRowClick}
									rowSelection={rowSelection}
									onRowSelectionChange={handleRowSelectionChange}
								/>
							</div>
						</>
					) : (
						<div className="bg-muted/30 border-border flex flex-col items-center justify-center rounded-lg border p-12 text-center">
							<Icon
								name="user"
								className="text-muted-foreground mb-4 size-12"
							/>
							<p className="text-foreground mb-2 text-lg font-semibold">
								No employees found
							</p>
							<p className="text-muted-foreground text-sm">
								{search || status !== 'all'
									? 'Try adjusting your search or filter criteria'
									: 'No employees have been added yet'}
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Employee Quick View Drawer */}
			{selectedEmployeeForDrawer && (
				<EmployeeQuickViewDrawer
					open={drawerOpen}
					onOpenChange={setDrawerOpen}
					employee={selectedEmployeeForDrawer}
				/>
			)}
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
