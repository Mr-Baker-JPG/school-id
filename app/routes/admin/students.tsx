import * as React from 'react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Outlet, Link, useLocation, Form, useSearchParams, useSubmit } from 'react-router'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import {
	getExpirationStatus,
} from '#app/utils/student.server.ts'
import { cn, useDebounce, useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { syncStudentsFromFacts } from '#app/utils/student-sync.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/students.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const searchParams = new URL(request.url).searchParams
	const search = searchParams.get('search')
	const status = searchParams.get('status')
	const photo = searchParams.get('photo')

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
	if (photo === 'yes') {
		where.studentId = { photoUrl: { not: null } }
	} else if (photo === 'no') {
		where.studentId = { photoUrl: { equals: null } }
	}

	const students = await prisma.student.findMany({
		where,
		select: {
			id: true,
			fullName: true,
			email: true,
			grade: true,
			status: true,
			studentId: {
				select: {
					expirationDate: true,
					photoUrl: true,
				},
			},
		},
		orderBy: { fullName: 'asc' },
	})

	const studentsWithStatus = students.map((s) => ({
		...s,
		hasPhoto: !!s.studentId?.photoUrl,
		expirationStatus: s.studentId?.expirationDate
			? getExpirationStatus(s.studentId.expirationDate)
			: null,
	}))

	return {
		students: studentsWithStatus,
		search: search ?? '',
		status: status ?? 'all',
		photo: photo ?? 'all',
	}
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')

	const searchParams = new URL(request.url).searchParams
	const redirectBase = `/admin/students${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

	if (intent === 'sync') {
		const result = await syncStudentsFromFacts()
		const parts: string[] = []
		if (result.created > 0) parts.push(`${result.created} created`)
		if (result.updated > 0) parts.push(`${result.updated} updated`)
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

	return redirectWithToast(redirectBase, { type: 'error', title: 'Error', description: 'Unknown action' })
}

export default function StudentsLayout({ loaderData }: Route.ComponentProps) {
	const { students, search, status, photo } = loaderData
	const location = useLocation()
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const syncPending = useIsPending({ formAction: '/admin/students' })

	const isDetailView = /\/admin\/students\/[^/]+/.test(location.pathname)
	const selectedId = isDetailView
		? location.pathname.split('/admin/students/')[1]?.split('/')[0]
		: null

	const handleSearchChange = useDebounce(async (form: HTMLFormElement) => {
		await submit(form)
	}, 400)

	function filterUrl(overrides: Record<string, string>) {
		const params: Record<string, string> = {}
		if (search) params.search = search
		if (status !== 'all') params.status = status
		if (photo !== 'all') params.photo = photo
		for (const [k, v] of Object.entries(overrides)) {
			if (v === 'all') {
				delete params[k]
			} else {
				params[k] = v
			}
		}
		const qs = new URLSearchParams(params).toString()
		return `/admin/students${qs ? `?${qs}` : ''}`
	}

	return (
		<div className="flex h-full overflow-hidden">
			{/* Left panel: Student list */}
			<div
				className={cn(
					'flex flex-col border-r bg-card',
					'md:w-80 lg:w-96 md:flex',
					isDetailView ? 'hidden' : 'flex w-full',
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<h1 className="font-display text-sm font-semibold tracking-wide text-primary">
						Students
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
							placeholder="Search students…"
							className="h-8 w-full border border-input bg-background px-3 font-body text-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/15"
						/>
						<input type="hidden" name="status" value={status} />
						<input type="hidden" name="photo" value={photo} />
					</Form>

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
					</div>
				</div>

				{/* Scrollable list */}
				<div className="flex-1 overflow-y-auto">
					{students.length === 0 ? (
						<div className="flex flex-col items-center justify-center p-8 text-center">
							<Icon name="user" className="mb-2 size-8 text-muted-foreground" />
							<p className="font-body text-sm text-muted-foreground">No students found</p>
						</div>
					) : (
						students.map((student) => (
							<Link
								key={student.id}
								to={`/admin/students/${student.id}?${searchParams.toString()}`}
								className={cn(
									'flex items-center gap-3 border-b border-border px-4 py-3 transition-colors',
									selectedId === student.id
										? 'border-l-2 border-l-brand-gold bg-brand-navy/5'
										: 'hover:bg-muted/50',
								)}
							>
								<div
									className={cn(
										'flex size-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold',
										student.hasPhoto
											? 'bg-brand-navy/10 text-brand-navy'
											: 'bg-muted text-muted-foreground',
									)}
								>
									{student.hasPhoto ? (
										<Icon name="camera" className="size-3.5" />
									) : (
										student.fullName.charAt(0)
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate font-body text-sm font-medium">
										{student.fullName}
									</div>
									<div className="truncate font-body text-xs text-muted-foreground">
										{student.grade ? `Grade ${student.grade}` : student.email}
									</div>
								</div>
								<div className="flex shrink-0 flex-col items-end gap-1">
									<StatusBadge
										variant={
											student.status === 'active' ? 'active' : 'inactive'
										}
										className="text-[10px]"
									>
										{student.status}
									</StatusBadge>
									{student.expirationStatus &&
										student.expirationStatus.type !== 'valid' && (
											<StatusBadge
												variant={
													student.expirationStatus.type === 'expiring'
														? 'expiring'
														: 'expired'
												}
												className="text-[10px]"
											>
												{student.expirationStatus.type === 'expiring'
													? `${student.expirationStatus.daysUntilExpiration}d`
													: 'exp'}
											</StatusBadge>
										)}
								</div>
							</Link>
						))
					)}
				</div>

				{/* Footer */}
				<div className="border-t border-border px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
					{students.length} student{students.length !== 1 ? 's' : ''}
				</div>
			</div>

			{/* Right panel: Detail */}
			<div
				className={cn(
					'flex-1 overflow-y-auto',
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
