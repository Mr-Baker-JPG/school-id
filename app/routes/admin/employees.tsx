import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Outlet, Link, useLocation, Form, useSearchParams, useSubmit } from 'react-router'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import {
	getExpirationStatus,
	type ExpirationStatus,
} from '#app/utils/employee.server.ts'
import { cn, useDebounce, useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { syncEmployeesFromFacts } from '#app/utils/employee-sync.server.ts'
import { fetchAndCacheFactsProfilePicture } from '#app/utils/employee.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/employees.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const searchParams = new URL(request.url).searchParams
	const search = searchParams.get('search')
	const status = searchParams.get('status')
	const photo = searchParams.get('photo')
	const signature = searchParams.get('signature')

	const where: Record<string, unknown> = {}

	if (search) {
		where.OR = [
			{ fullName: { contains: search } },
			{ email: { contains: search } },
		]
	}
	if (status === 'active' || status === 'inactive') {
		where.status = status
	}

	// Build employeeId conditions for photo and signature filters
	const employeeIdConditions: Record<string, unknown> = {}
	if (photo === 'yes') {
		employeeIdConditions.photoUrl = { not: null }
	} else if (photo === 'no') {
		employeeIdConditions.photoUrl = { equals: null }
	}
	if (signature === 'yes') {
		employeeIdConditions.gmailSignature = { not: null }
	} else if (signature === 'no') {
		employeeIdConditions.gmailSignature = { equals: null }
	}
	if (Object.keys(employeeIdConditions).length > 0) {
		where.employeeId = employeeIdConditions
	}

	const employees = await prisma.employee.findMany({
		where,
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
					gmailSignature: true,
				},
			},
		},
		orderBy: { fullName: 'asc' },
	})

	const employeesWithStatus = employees.map((e) => ({
		...e,
		hasPhoto: !!e.employeeId?.photoUrl,
		hasSignature: !!e.employeeId?.gmailSignature,
		expirationStatus: e.employeeId?.expirationDate
			? getExpirationStatus(e.employeeId.expirationDate)
			: null,
	}))

	return {
		employees: employeesWithStatus,
		search: search ?? '',
		status: status ?? 'all',
		photo: photo ?? 'all',
		signature: signature ?? 'all',
	}
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')

	const searchParams = new URL(request.url).searchParams
	const redirectBase = `/admin/employees${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

	if (intent === 'sync') {
		const result = await syncEmployeesFromFacts()
		const parts: string[] = []
		if (result.created > 0) parts.push(`${result.created} created`)
		if (result.updated > 0) parts.push(`${result.updated} updated`)
		if (result.photosUpdated > 0) parts.push(`${result.photosUpdated} photos updated`)
		if (result.errors > 0) parts.push(`${result.errors} errors`)

		if (result.success) {
			return redirectWithToast(redirectBase, {
				type: 'success',
				title: 'Sync Successful',
				description: parts.length > 0 ? `Sync completed: ${parts.join(', ')}` : 'Sync completed: No changes needed',
			})
		} else {
			return redirectWithToast(redirectBase, {
				type: 'error',
				title: 'Sync Failed',
				description: result.errorMessage || 'An error occurred during sync',
			})
		}
	}

	if (intent === 'recheck-facts-photo') {
		const employeeId = formData.get('employeeId')
		const employeeIds = formData.getAll('employeeIds')

		if (employeeIds.length > 0) {
			let successCount = 0
			let errorCount = 0
			for (const id of employeeIds) {
				if (typeof id !== 'string') continue
				const employee = await prisma.employee.findUnique({
					where: { id },
					select: { sisEmployeeId: true },
				})
				if (!employee) { errorCount++; continue }
				try {
					const url = await fetchAndCacheFactsProfilePicture(id, employee.sisEmployeeId, true)
					if (url) successCount++; else errorCount++
				} catch { errorCount++ }
			}
			return redirectWithToast(redirectBase, {
				type: successCount > 0 ? 'success' : 'error',
				title: successCount > 0 ? 'Photos Updated' : 'Photo Update Failed',
				description: `Refreshed ${successCount} photo(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
			})
		}

		if (typeof employeeId === 'string') {
			const employee = await prisma.employee.findUnique({
				where: { id: employeeId },
				select: { sisEmployeeId: true, fullName: true },
			})
			if (employee) {
				const cachedPhotoUrl = await fetchAndCacheFactsProfilePicture(employeeId, employee.sisEmployeeId, true)
				return redirectWithToast(redirectBase, {
					type: cachedPhotoUrl ? 'success' : 'message',
					title: cachedPhotoUrl ? 'Photo Updated' : 'No Photo Available',
					description: cachedPhotoUrl
						? `Successfully refreshed photo for ${employee.fullName}`
						: `No FACTS photo found for ${employee.fullName}`,
				})
			}
		}
	}

	return redirectWithToast(redirectBase, { type: 'error', title: 'Error', description: 'Unknown action' })
}

export default function EmployeesLayout({ loaderData }: Route.ComponentProps) {
	const { employees, search, status, photo, signature } = loaderData
	const location = useLocation()
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const syncPending = useIsPending({ formAction: '/admin/employees' })

	// Determine if a specific employee is selected (child route active)
	const isDetailView = /\/admin\/employees\/[^/]+/.test(location.pathname)
	const selectedId = isDetailView
		? location.pathname.split('/admin/employees/')[1]?.split('/')[0]
		: null

	const handleSearchChange = useDebounce(async (form: HTMLFormElement) => {
		await submit(form)
	}, 400)

	/** Build filter URL preserving other active filters */
	function filterUrl(overrides: Record<string, string>) {
		const params: Record<string, string> = {}
		if (search) params.search = search
		if (status !== 'all') params.status = status
		if (photo !== 'all') params.photo = photo
		if (signature !== 'all') params.signature = signature
		// Apply overrides, removing 'all' values
		for (const [k, v] of Object.entries(overrides)) {
			if (v === 'all') {
				delete params[k]
			} else {
				params[k] = v
			}
		}
		const qs = new URLSearchParams(params).toString()
		return `/admin/employees${qs ? `?${qs}` : ''}`
	}

	return (
		<div className="flex h-full overflow-hidden">
			{/* Left panel: Employee list (desktop only, or mobile when no detail) */}
			<div
				className={cn(
					'flex flex-col border-r bg-card',
					// Desktop: always visible, fixed width
					'md:w-80 lg:w-96 md:flex',
					// Mobile: full width when list view, hidden when detail view
					isDetailView ? 'hidden' : 'flex w-full',
				)}
			>
				{/* Header: title + sync */}
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h1 className="text-sm font-bold">Employees</h1>
					<Form method="post">
						<input type="hidden" name="intent" value="sync" />
						<StatusButton
							type="submit"
							size="sm"
							variant="outline"
							status={syncPending ? 'pending' : 'idle'}
							disabled={syncPending}
							className="h-7 text-xs"
						>
							<Icon name="cloud-sync" className="size-3.5" />
							<span className="hidden sm:inline">Sync</span>
						</StatusButton>
					</Form>
				</div>

				{/* Search + Filters */}
				<div className="space-y-2 border-b px-3 py-2">
					<Form
						method="get"
						onChange={(e) => handleSearchChange(e.currentTarget)}
					>
						<input
							type="search"
							name="search"
							defaultValue={search}
							placeholder="Search employees…"
							className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
						/>
						<input type="hidden" name="status" value={status} />
						<input type="hidden" name="photo" value={photo} />
						<input type="hidden" name="signature" value={signature} />
					</Form>

					{/* Status filter */}
					<div className="flex flex-wrap gap-1.5">
						{['all', 'active', 'inactive'].map((s) => (
							<Link
								key={s}
								to={filterUrl({ status: s })}
								className={cn(
									'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
									status === s || (s === 'all' && status === 'all')
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-muted',
								)}
							>
								{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
							</Link>
						))}

						<span className="text-border mx-0.5">|</span>

						{/* Photo filter */}
						{[
							{ value: 'all', label: 'Any Photo' },
							{ value: 'yes', label: '📷' },
							{ value: 'no', label: 'No Photo' },
						].map((f) => (
							<Link
								key={f.value}
								to={filterUrl({ photo: f.value })}
								className={cn(
									'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
									photo === f.value
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-muted',
								)}
							>
								{f.label}
							</Link>
						))}

						<span className="text-border mx-0.5">|</span>

						{/* Signature filter */}
						{[
							{ value: 'all', label: 'Any Sig' },
							{ value: 'yes', label: '✉️' },
							{ value: 'no', label: 'No Sig' },
						].map((f) => (
							<Link
								key={f.value}
								to={filterUrl({ signature: f.value })}
								className={cn(
									'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
									signature === f.value
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-muted',
								)}
							>
								{f.label}
							</Link>
						))}
					</div>
				</div>

				{/* Scrollable list */}
				<div className="flex-1 overflow-y-auto">
					{employees.length === 0 ? (
						<div className="flex flex-col items-center justify-center p-8 text-center">
							<Icon name="user" className="text-muted-foreground mb-2 size-8" />
							<p className="text-muted-foreground text-sm">No employees found</p>
						</div>
					) : (
						employees.map((employee) => (
							<Link
								key={employee.id}
								to={`/admin/employees/${employee.id}?${searchParams.toString()}`}
								className={cn(
									'flex items-center gap-3 border-b px-4 py-3 transition-colors',
									selectedId === employee.id
										? 'bg-primary/5 border-l-2 border-l-primary'
										: 'hover:bg-muted/50',
								)}
							>
								{/* Avatar placeholder */}
								<div
									className={cn(
										'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
										employee.hasPhoto
											? 'bg-primary/10 text-primary'
											: 'bg-muted text-muted-foreground',
									)}
								>
									{employee.hasPhoto ? (
										<Icon name="camera" className="size-3.5" />
									) : (
										employee.fullName.charAt(0)
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<span className="truncate text-sm font-medium">
											{employee.fullName}
										</span>
										{/* Signature indicator */}
										{employee.hasSignature && (
											<Icon
												name="envelope-closed"
												className="size-3 shrink-0 text-green-600 dark:text-green-400"
											/>
										)}
									</div>
									<div className="text-muted-foreground truncate text-xs">
										{employee.jobTitle}
									</div>
								</div>
								<div className="flex shrink-0 flex-col items-end gap-1">
									<StatusBadge
										variant={
											employee.status === 'active' ? 'active' : 'inactive'
										}
										className="text-[10px]"
									>
										{employee.status}
									</StatusBadge>
									{employee.expirationStatus &&
										employee.expirationStatus.type !== 'valid' && (
											<StatusBadge
												variant={
													employee.expirationStatus.type === 'expiring'
														? 'expiring'
														: 'expired'
												}
												className="text-[10px]"
											>
												{employee.expirationStatus.type === 'expiring'
													? `${employee.expirationStatus.daysUntilExpiration}d`
													: 'exp'}
											</StatusBadge>
										)}
								</div>
							</Link>
						))
					)}
				</div>

				{/* Footer: count */}
				<div className="text-muted-foreground border-t px-4 py-2 text-xs">
					{employees.length} employee{employees.length !== 1 ? 's' : ''}
				</div>
			</div>

			{/* Right panel: Detail (Outlet) */}
			<div
				className={cn(
					'flex-1 overflow-y-auto',
					// Mobile: full width when detail view, hidden when list view
					!isDetailView ? 'hidden md:block' : 'block',
				)}
			>
				<div className="p-6">
					<Outlet />
				</div>
			</div>
		</div>
	)
}
