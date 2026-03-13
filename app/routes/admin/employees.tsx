import * as React from 'react'
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
	const department = searchParams.get('department')

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
	if (department && department !== 'all') {
		where.department = department
	}

	// Build employeeId conditions for photo and signature filters
	const employeeIdConditions: Record<string, unknown> = {}
	if (photo === 'yes') {
		employeeIdConditions.photoUrl = { not: null }
	} else if (photo === 'no') {
		// Match null photoUrl OR no employeeId record
		employeeIdConditions.photoUrl = { equals: null }
	}
	if (signature === 'yes') {
		// Exclude both null and empty string
		employeeIdConditions.AND = [
			{ gmailSignature: { not: null } },
			{ gmailSignature: { not: '' } },
		]
	} else if (signature === 'no') {
		// Match null OR empty string
		employeeIdConditions.OR = [
			{ gmailSignature: { equals: null } },
			{ gmailSignature: { equals: '' } },
		]
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
			department: true,
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

	// Get unique departments for filter dropdown
	const allDepartments = await prisma.employee.findMany({
		where: { department: { not: null } },
		select: { department: true },
		distinct: ['department'],
		orderBy: { department: 'asc' },
	})
	const departments = allDepartments
		.map((d) => d.department)
		.filter((d): d is string => d !== null)

	return {
		employees: employeesWithStatus,
		departments,
		search: search ?? '',
		status: status ?? 'all',
		photo: photo ?? 'all',
		signature: signature ?? 'all',
		department: department ?? 'all',
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
	const { employees, departments, search, status, photo, signature, department } = loaderData
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
		if (department !== 'all') params.department = department
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
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<h1 className="font-display text-sm font-semibold tracking-wide text-primary">
						Employees
					</h1>
					<Form method="post">
						<input type="hidden" name="intent" value="sync" />
						<StatusButton
							type="submit"
							size="sm"
							variant="outline"
							status={syncPending ? 'pending' : 'idle'}
							disabled={syncPending}
							className="h-7 font-mono text-[0.6rem] uppercase tracking-wide"
						>
							<Icon name="cloud-sync" className="size-3.5" />
							<span className="hidden sm:inline">Sync</span>
						</StatusButton>
					</Form>
				</div>

				{/* Search + Filters */}
				<div className="space-y-2.5 border-b border-border px-3 py-3">
					<Form
						method="get"
						onChange={(e) => handleSearchChange(e.currentTarget)}
					>
						<input
							type="search"
							name="search"
							defaultValue={search}
							placeholder="Search employees…"
							className="h-8 w-full border border-input bg-background px-3 font-body text-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/15"
						/>
						<input type="hidden" name="status" value={status} />
						<input type="hidden" name="photo" value={photo} />
						<input type="hidden" name="signature" value={signature} />
					</Form>

					{/* Filter rows */}
					<div className="space-y-1.5">
						{/* Status */}
						<FilterRow label="Status">
							{['all', 'active', 'inactive'].map((s) => (
								<FilterPill
									key={s}
									to={filterUrl({ status: s })}
									active={status === s}
								>
									{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
								</FilterPill>
							))}
						</FilterRow>

						{/* Photo */}
						<FilterRow label="Photo">
							{[
								{ value: 'all', label: 'All' },
								{ value: 'yes', label: 'Has Photo' },
								{ value: 'no', label: 'Missing' },
							].map((f) => (
								<FilterPill
									key={f.value}
									to={filterUrl({ photo: f.value })}
									active={photo === f.value}
								>
									{f.label}
								</FilterPill>
							))}
						</FilterRow>

						{/* Signature */}
						<FilterRow label="Sig">
							{[
								{ value: 'all', label: 'All' },
								{ value: 'yes', label: 'Has Sig' },
								{ value: 'no', label: 'Missing' },
							].map((f) => (
								<FilterPill
									key={f.value}
									to={filterUrl({ signature: f.value })}
									active={signature === f.value}
								>
									{f.label}
								</FilterPill>
							))}
						</FilterRow>

						{/* Department */}
						{departments.length > 0 && (
							<FilterRow label="Dept">
								<FilterPill
									to={filterUrl({ department: 'all' })}
									active={department === 'all'}
								>
									All
								</FilterPill>
								{departments.map((d) => (
									<FilterPill
										key={d}
										to={filterUrl({ department: d })}
										active={department === d}
									>
										{d}
									</FilterPill>
								))}
							</FilterRow>
						)}
					</div>
				</div>

				{/* Scrollable list */}
				<div className="flex-1 overflow-y-auto">
					{employees.length === 0 ? (
						<div className="flex flex-col items-center justify-center p-8 text-center">
							<Icon name="user" className="mb-2 size-8 text-muted-foreground" />
							<p className="font-body text-sm text-muted-foreground">No employees found</p>
						</div>
					) : (
						employees.map((employee) => (
							<Link
								key={employee.id}
								to={`/admin/employees/${employee.id}?${searchParams.toString()}`}
								className={cn(
									'flex items-center gap-3 border-b border-border px-4 py-3 transition-colors',
									selectedId === employee.id
										? 'border-l-2 border-l-brand-gold bg-brand-navy/5'
										: 'hover:bg-muted/50',
								)}
							>
								{/* Avatar placeholder */}
								<div
									className={cn(
										'flex size-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold',
										employee.hasPhoto
											? 'bg-brand-navy/10 text-brand-navy'
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
										<span className="truncate font-body text-sm font-medium">
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
									<div className="truncate font-body text-xs text-muted-foreground">
										{employee.jobTitle}{employee.department ? ` · ${employee.department}` : ''}
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
				<div className="border-t border-border px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
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

/* ----------------------------------------------------------------
 * Filter UI helpers
 * ---------------------------------------------------------------- */

function FilterRow({
	label,
	children,
}: {
	label: string
	children: React.ReactNode
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-11 shrink-0 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{label}
			</span>
			<div className="flex gap-1">{children}</div>
		</div>
	)
}

function FilterPill({
	to,
	active,
	children,
}: {
	to: string
	active: boolean
	children: React.ReactNode
}) {
	return (
		<Link
			to={to}
			className={cn(
				'px-2 py-0.5 font-body text-[11px] font-medium transition-colors',
				active
					? 'border-b border-brand-gold text-foreground'
					: 'text-muted-foreground hover:text-foreground',
			)}
		>
			{children}
		</Link>
	)
}
