import * as React from 'react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, useSearchParams, useSubmit } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { cn, useDebounce } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { getEmployeePersonType } from '#app/utils/person-type.ts'
import { type Route } from './+types/print.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	const url = new URL(request.url)
	const search = url.searchParams.get('search') ?? ''
	const peopleType = url.searchParams.get('type') ?? 'all' // 'all' | 'employees' | 'students'
	const status = url.searchParams.get('status') ?? 'active'
	const department = url.searchParams.get('department') ?? 'all'
	const grade = url.searchParams.get('grade') ?? 'all'
	const classification = url.searchParams.get('classification') ?? 'all' // 'all' | 'faculty' | 'staff'

	// Build employee query
	const employeeWhere: Record<string, unknown> = {}
	if (search) {
		employeeWhere.OR = [
			{ fullName: { contains: search } },
			{ email: { contains: search } },
		]
	}
	if (status !== 'all') {
		employeeWhere.status = status
	}
	if (department !== 'all') {
		employeeWhere.department = department
	}

	// Build student query
	const studentWhere: Record<string, unknown> = {}
	if (search) {
		studentWhere.OR = [
			{ fullName: { contains: search } },
			{ email: { contains: search } },
		]
	}
	if (status !== 'all') {
		studentWhere.status = status
	}
	if (grade !== 'all') {
		studentWhere.grade = grade
	}

	// Fetch people based on type filter
	const [employees, students] = await Promise.all([
		peopleType === 'students'
			? Promise.resolve([])
			: prisma.employee.findMany({
					where: employeeWhere,
					select: {
						id: true,
						fullName: true,
						jobTitle: true,
						department: true,
						email: true,
						status: true,
						sisEmployeeId: true,
						employeeId: {
							select: {
								photoUrl: true,
								expirationDate: true,
							},
						},
					},
					orderBy: { fullName: 'asc' },
				}),
		peopleType === 'employees'
			? Promise.resolve([])
			: prisma.student.findMany({
					where: studentWhere,
					select: {
						id: true,
						fullName: true,
						email: true,
						grade: true,
						status: true,
						sisStudentId: true,
						studentId: {
							select: {
								photoUrl: true,
								expirationDate: true,
							},
						},
					},
					orderBy: { fullName: 'asc' },
				}),
	])

	// Apply classification filter (faculty/staff) for employees
	const filteredEmployees =
		classification === 'all'
			? employees
			: employees.filter((e) => {
					const pType = getEmployeePersonType(e.jobTitle)
					return classification === 'faculty'
						? pType === 'FACULTY'
						: pType === 'STAFF'
				})

	// Normalize to a common format for the UI
	const people = [
		...filteredEmployees.map((e) => ({
			id: e.id,
			type: 'employee' as const,
			fullName: e.fullName,
			label: e.department || e.jobTitle,
			email: e.email,
			status: e.status,
			sisId: e.sisEmployeeId,
			hasPhoto: !!e.employeeId?.photoUrl,
			personType: getEmployeePersonType(e.jobTitle),
		})),
		...students.map((s) => ({
			id: s.id,
			type: 'student' as const,
			fullName: s.fullName,
			label: s.grade ? `Grade ${s.grade}` : 'Student',
			email: s.email,
			status: s.status,
			sisId: s.sisStudentId,
			hasPhoto: !!s.studentId?.photoUrl,
			personType: 'STUDENT' as const,
		})),
	]

	// Get filter options
	const [departments, grades] = await Promise.all([
		prisma.employee
			.findMany({
				where: { department: { not: null } },
				select: { department: true },
				distinct: ['department'],
				orderBy: { department: 'asc' },
			})
			.then((ds) => ds.map((d) => d.department).filter(Boolean) as string[]),
		prisma.student
			.findMany({
				where: { grade: { not: null } },
				select: { grade: true },
				distinct: ['grade'],
				orderBy: { grade: 'asc' },
			})
			.then((gs) => gs.map((g) => g.grade).filter(Boolean) as string[]),
	])

	return {
		people,
		departments,
		grades,
		filters: { search, type: peopleType, status, department, grade, classification },
	}
}

export default function AdminPrintRoute({ loaderData }: Route.ComponentProps) {
	const { people, departments, grades, filters } = loaderData
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

	const allSelected =
		people.length > 0 && selectedIds.size === people.length
	const someSelected = selectedIds.size > 0

	function toggleAll() {
		if (allSelected) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(people.map((p) => `${p.type}:${p.id}`)))
		}
	}

	function toggleOne(type: string, id: string) {
		const key = `${type}:${id}`
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(key)) {
				next.delete(key)
			} else {
				next.add(key)
			}
			return next
		})
	}

	const handleSearchChange = useDebounce(async (form: HTMLFormElement) => {
		await submit(form)
	}, 400)

	function filterUrl(overrides: Record<string, string>) {
		const params: Record<string, string> = {}
		if (filters.search) params.search = filters.search
		if (filters.type !== 'all') params.type = filters.type
		if (filters.status !== 'active') params.status = filters.status
		if (filters.department !== 'all') params.department = filters.department
		if (filters.grade !== 'all') params.grade = filters.grade
		if (filters.classification !== 'all') params.classification = filters.classification
		for (const [k, v] of Object.entries(overrides)) {
			if (v === 'all' || v === 'active') {
				delete params[k]
			} else {
				params[k] = v
			}
		}
		const qs = new URLSearchParams(params).toString()
		return `/admin/print${qs ? `?${qs}` : ''}`
	}

	// Build print URL from selected IDs
	function getPrintUrl() {
		const employeeIds: string[] = []
		const studentIds: string[] = []
		for (const key of selectedIds) {
			const [type, id] = key.split(':')
			if (type === 'employee') employeeIds.push(id!)
			else studentIds.push(id!)
		}
		const params = new URLSearchParams()
		for (const id of employeeIds) params.append('employeeIds', id)
		for (const id of studentIds) params.append('studentIds', id)
		return `/admin/print/generate?${params.toString()}`
	}

	return (
		<div className="h-full overflow-y-auto px-6 py-6 font-body">
			<div className="space-y-6">
				<PageTitle
					title="Print ID Cards"
					subtitle="Select people and generate printable ID card sheets"
				/>

				{/* Filters */}
				<div className="space-y-3 border border-border bg-card p-4">
					{/* Search */}
					<Form
						method="get"
						onChange={(e) => handleSearchChange(e.currentTarget)}
					>
						<input
							type="search"
							name="search"
							defaultValue={filters.search}
							placeholder="Search by name or email…"
							className="h-9 w-full border border-input bg-background px-3 font-body text-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/15"
						/>
						<input type="hidden" name="type" value={filters.type} />
						<input type="hidden" name="status" value={filters.status} />
						<input type="hidden" name="department" value={filters.department} />
						<input type="hidden" name="grade" value={filters.grade} />
						<input type="hidden" name="classification" value={filters.classification} />
					</Form>

					{/* Filter rows */}
					<div className="flex flex-wrap gap-x-6 gap-y-2">
						<FilterGroup label="Type">
							{['all', 'employees', 'students'].map((v) => (
								<FilterChip key={v} to={filterUrl({ type: v })} active={filters.type === v}>
									{v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
								</FilterChip>
							))}
						</FilterGroup>

						<FilterGroup label="Status">
							{['active', 'inactive', 'all'].map((v) => (
								<FilterChip key={v} to={filterUrl({ status: v })} active={filters.status === v}>
									{v.charAt(0).toUpperCase() + v.slice(1)}
								</FilterChip>
							))}
						</FilterGroup>

						{filters.type !== 'students' && (
							<FilterGroup label="Role">
								{['all', 'faculty', 'staff'].map((v) => (
									<FilterChip key={v} to={filterUrl({ classification: v })} active={filters.classification === v}>
										{v.charAt(0).toUpperCase() + v.slice(1)}
									</FilterChip>
								))}
							</FilterGroup>
						)}

						{filters.type !== 'students' && departments.length > 0 && (
							<FilterGroup label="Dept">
								<FilterChip to={filterUrl({ department: 'all' })} active={filters.department === 'all'}>
									All
								</FilterChip>
								{departments.map((d) => (
									<FilterChip key={d} to={filterUrl({ department: d })} active={filters.department === d}>
										{d}
									</FilterChip>
								))}
							</FilterGroup>
						)}

						{filters.type !== 'employees' && grades.length > 0 && (
							<FilterGroup label="Grade">
								<FilterChip to={filterUrl({ grade: 'all' })} active={filters.grade === 'all'}>
									All
								</FilterChip>
								{grades.map((g) => (
									<FilterChip key={g} to={filterUrl({ grade: g })} active={filters.grade === g}>
										{g}
									</FilterChip>
								))}
							</FilterGroup>
						)}
					</div>
				</div>

				{/* Action bar */}
				<div className="flex items-center justify-between border border-border bg-muted/30 px-4 py-3">
					<div className="flex items-center gap-3">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={allSelected}
								onChange={toggleAll}
								className="size-4 accent-brand-gold"
							/>
							<span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
								{someSelected
									? `${selectedIds.size} selected`
									: `${people.length} people`}
							</span>
						</label>
					</div>
					<Button
						disabled={!someSelected}
						className="bg-brand-gold font-body text-sm font-semibold text-primary hover:bg-brand-gold/80 disabled:opacity-40"
						onClick={() => {
							window.location.href = getPrintUrl()
						}}
					>
						<Icon name="download" className="size-4" />
						Print {selectedIds.size > 0 ? `${selectedIds.size} ID Cards` : 'ID Cards'}
					</Button>
				</div>

				{/* People list */}
				{people.length === 0 ? (
					<div className="flex flex-col items-center justify-center border border-border p-12 text-center">
						<Icon name="user" className="mb-3 size-10 text-muted-foreground" />
						<p className="font-body text-sm text-muted-foreground">
							No people found matching your filters
						</p>
					</div>
				) : (
					<div className="border border-border">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border bg-muted/60">
									<th className="w-10 px-3 py-2">
										<input
											type="checkbox"
											checked={allSelected}
											onChange={toggleAll}
											className="size-3.5 accent-brand-gold"
										/>
									</th>
									<th className="px-3 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
										Name
									</th>
									<th className="hidden px-3 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:table-cell">
										Type
									</th>
									<th className="hidden px-3 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:table-cell">
										Details
									</th>
									<th className="hidden px-3 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:table-cell">
										Photo
									</th>
								</tr>
							</thead>
							<tbody>
								{people.map((person) => {
									const key = `${person.type}:${person.id}`
									const isSelected = selectedIds.has(key)
									return (
										<tr
											key={key}
											className={cn(
												'border-b border-border transition-colors last:border-0',
												isSelected ? 'bg-brand-gold/5' : 'hover:bg-muted/30',
											)}
										>
											<td className="px-3 py-2.5">
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => toggleOne(person.type, person.id)}
													className="size-3.5 accent-brand-gold"
												/>
											</td>
											<td className="px-3 py-2.5">
												<div className="font-body text-sm font-medium">
													{person.fullName}
												</div>
												<div className="font-body text-xs text-muted-foreground sm:hidden">
													{person.type === 'employee' ? person.personType : 'Student'}
												</div>
											</td>
											<td className="hidden px-3 py-2.5 sm:table-cell">
												<StatusBadge
													variant={
														person.type === 'employee'
															? person.personType === 'FACULTY'
																? 'active'
																: 'valid'
															: 'expiring'
													}
													className="text-[10px]"
												>
													{person.type === 'employee' ? person.personType : 'STUDENT'}
												</StatusBadge>
											</td>
											<td className="hidden px-3 py-2.5 font-body text-xs text-muted-foreground md:table-cell">
												{person.label}
											</td>
											<td className="hidden px-3 py-2.5 lg:table-cell">
												{person.hasPhoto ? (
													<Icon name="camera" className="size-3.5 text-green-600" />
												) : (
													<Icon name="cross-1" className="size-3.5 text-muted-foreground/40" />
												)}
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				)}

				{/* Footer count */}
				<div className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
					{people.length} people · {people.filter((p) => p.type === 'employee').length} employees · {people.filter((p) => p.type === 'student').length} students
				</div>
			</div>
		</div>
	)
}

/* Filter UI helpers */

function FilterGroup({
	label,
	children,
}: {
	label: string
	children: React.ReactNode
}) {
	return (
		<div className="flex items-center gap-1.5">
			<span className="w-12 shrink-0 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{label}
			</span>
			<div className="flex flex-wrap gap-1">{children}</div>
		</div>
	)
}

function FilterChip({
	to,
	active,
	children,
}: {
	to: string
	active: boolean
	children: React.ReactNode
}) {
	return (
		<a
			href={to}
			className={cn(
				'px-2 py-0.5 font-body text-[11px] font-medium transition-colors',
				active
					? 'border-b border-brand-gold text-foreground'
					: 'text-muted-foreground hover:text-foreground',
			)}
		>
			{children}
		</a>
	)
}

export const meta: Route.MetaFunction = () => [
	{ title: 'Print ID Cards | Admin | JPG ID System' },
	{ name: 'description', content: 'Bulk print ID cards for employees and students' },
]
