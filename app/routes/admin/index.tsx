import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Link } from 'react-router'
import { Icon } from '#app/components/ui/icon.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { cn } from '#app/utils/misc.tsx'
import { type Route } from './+types/index.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	// Run all counts in parallel
	const [
		activeEmployees,
		totalEmployees,
		activeStudents,
		totalStudents,
		lastStaffSync,
		lastStudentSync,
		employeesWithoutPhoto,
		studentsWithoutPhoto,
		employeesWithoutSignature,
		expiringEmployeeIds,
		expiredEmployeeIds,
		expiringStudentIds,
		expiredStudentIds,
	] = await Promise.all([
		prisma.employee.count({ where: { status: 'active' } }),
		prisma.employee.count(),
		prisma.student.count({ where: { status: 'active' } }),
		prisma.student.count(),
		prisma.syncHistory.findFirst({
			where: { syncType: 'staff' },
			orderBy: { createdAt: 'desc' },
			select: { createdAt: true, success: true },
		}),
		prisma.syncHistory.findFirst({
			where: { syncType: 'student' },
			orderBy: { createdAt: 'desc' },
			select: { createdAt: true, success: true },
		}),
		prisma.employee.count({
			where: {
				status: 'active',
				OR: [
					{ employeeId: null },
					{ employeeId: { photoUrl: null } },
				],
			},
		}),
		prisma.student.count({
			where: {
				status: 'active',
				OR: [
					{ studentId: null },
					{ studentId: { photoUrl: null } },
				],
			},
		}),
		// Active employees without Gmail signature
		prisma.employee.count({
			where: {
				status: 'active',
				OR: [
					{ employeeId: null },
					{ employeeId: { gmailSignature: null } },
				],
			},
		}),
		// Expiring within 30 days
		prisma.employeeID.count({
			where: {
				expirationDate: {
					gt: new Date(),
					lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
				},
				employee: { status: 'active' },
			},
		}),
		// Already expired
		prisma.employeeID.count({
			where: {
				expirationDate: { lt: new Date() },
				employee: { status: 'active' },
			},
		}),
		prisma.studentID.count({
			where: {
				expirationDate: {
					gt: new Date(),
					lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
				},
				student: { status: 'active' },
			},
		}),
		prisma.studentID.count({
			where: {
				expirationDate: { lt: new Date() },
				student: { status: 'active' },
			},
		}),
	])

	// Get people needing attention (expired or expiring IDs)
	const [attentionEmployees, attentionStudents] = await Promise.all([
		prisma.employee.findMany({
			where: {
				status: 'active',
				employeeId: {
					expirationDate: {
						lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					},
				},
			},
			select: {
				id: true,
				fullName: true,
				employeeId: { select: { expirationDate: true } },
			},
			orderBy: { employeeId: { expirationDate: 'asc' } },
			take: 10,
		}),
		prisma.student.findMany({
			where: {
				status: 'active',
				studentId: {
					expirationDate: {
						lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					},
				},
			},
			select: {
				id: true,
				fullName: true,
				studentId: { select: { expirationDate: true } },
			},
			orderBy: { studentId: { expirationDate: 'asc' } },
			take: 10,
		}),
	])

	const expiringCount =
		expiringEmployeeIds + expiringStudentIds
	const expiredCount =
		expiredEmployeeIds + expiredStudentIds

	// Format "last sync" as relative time
	const formatRelativeTime = (date: Date | null | undefined) => {
		if (!date) return 'Never'
		const diff = Date.now() - new Date(date).getTime()
		const mins = Math.floor(diff / 60000)
		if (mins < 1) return 'Just now'
		if (mins < 60) return `${mins}m ago`
		const hours = Math.floor(mins / 60)
		if (hours < 24) return `${hours}h ago`
		const days = Math.floor(hours / 24)
		return `${days}d ago`
	}

	return {
		stats: {
			activeEmployees,
			totalEmployees,
			activeStudents,
			totalStudents,
			expiringCount,
			expiredCount,
			employeesWithoutPhoto,
			studentsWithoutPhoto,
			employeesWithoutSignature,
			lastStaffSync: formatRelativeTime(lastStaffSync?.createdAt),
			lastStudentSync: formatRelativeTime(lastStudentSync?.createdAt),
			lastSyncSuccess:
				(lastStaffSync?.success ?? true) &&
				(lastStudentSync?.success ?? true),
		},
		attentionItems: [
			...attentionEmployees.map((e) => ({
				id: e.id,
				name: e.fullName,
				type: 'employee' as const,
				expirationDate: e.employeeId!.expirationDate,
				href: `/admin/employees/${e.id}`,
			})),
			...attentionStudents.map((s) => ({
				id: s.id,
				name: s.fullName,
				type: 'student' as const,
				expirationDate: s.studentId!.expirationDate,
				href: `/admin/students/${s.id}`,
			})),
		].sort(
			(a, b) =>
				new Date(a.expirationDate).getTime() -
				new Date(b.expirationDate).getTime(),
		),
	}
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
	const { stats, attentionItems } = loaderData

	return (
		<div className="h-full overflow-y-auto px-6 py-6 font-body">
		<div className="space-y-8">
			<PageTitle
				title="Dashboard"
				subtitle="Overview of the JPG ID System"
			/>

			{/* Stat Cards - Row 1: People Counts */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard
					label="Active Employees"
					value={`${stats.activeEmployees}`}
					detail={`of ${stats.totalEmployees} total`}
					href="/admin/employees?status=active"
					color="green"
					icon="user"
				/>
				<StatCard
					label="Active Students"
					value={`${stats.activeStudents}`}
					detail={`of ${stats.totalStudents} total`}
					href="/admin/students?status=active"
					color="green"
					icon="user"
				/>
				<StatCard
					label="Expiring IDs"
					value={`${stats.expiringCount + stats.expiredCount}`}
					detail={
						stats.expiredCount > 0
							? `${stats.expiredCount} expired · ${stats.expiringCount} expiring`
							: `${stats.expiringCount} within 30 days`
					}
					href="/admin/employees?status=active"
					color={
						stats.expiredCount > 0
							? 'red'
							: stats.expiringCount > 0
								? 'amber'
								: 'green'
					}
					icon="calendar"
				/>
			</div>

			{/* Stat Cards - Row 2: Attention Items */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard
					label="Faculty Missing Photos"
					value={`${stats.employeesWithoutPhoto}`}
					detail="Active employees without a photo"
					href="/admin/employees?photo=no"
					color={stats.employeesWithoutPhoto > 0 ? 'amber' : 'green'}
					icon="camera"
				/>
				<StatCard
					label="Students Missing Photos"
					value={`${stats.studentsWithoutPhoto}`}
					detail="Active students without a photo"
					href="/admin/students?photo=no"
					color={stats.studentsWithoutPhoto > 0 ? 'amber' : 'green'}
					icon="camera"
				/>
				<StatCard
					label="Missing Signatures"
					value={`${stats.employeesWithoutSignature}`}
					detail="Active employees without Gmail signature"
					href="/admin/employees?signature=no"
					color={stats.employeesWithoutSignature > 0 ? 'amber' : 'green'}
					icon="pencil-1"
				/>
			</div>

			{/* Stat Cards - Row 3: System Status */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard
					label="Last Sync"
					value={stats.lastStaffSync}
					detail={`Students: ${stats.lastStudentSync}`}
					href="/admin/sync-status"
					color={stats.lastSyncSuccess ? 'blue' : 'red'}
					icon="cloud-sync"
				/>
			</div>

			{/* Section Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<SectionCard
					title="Employees"
					description="Manage employee IDs, photos, and expirations"
					href="/admin/employees"
					icon="user"
					stat={`${stats.totalEmployees} total`}
				/>
				<SectionCard
					title="Students"
					description="Manage student IDs, photos, and expirations"
					href="/admin/students"
					icon="user"
					stat={`${stats.totalStudents} total`}
				/>
				<SectionCard
					title="Sync Status"
					description="View sync history and trigger manual syncs"
					href="/admin/sync-status"
					icon="cloud-sync"
					stat={
						stats.lastSyncSuccess
							? 'All syncs healthy'
							: 'Sync errors detected'
					}
				/>
			</div>

			{/* Needs Attention */}
			{attentionItems.length > 0 && (
				<div>
					<h2 className="mb-3 font-display text-lg font-semibold text-primary">
						Needs Attention
					</h2>
					<div className="overflow-hidden border border-border">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border bg-muted/60">
									<th className="px-4 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
										Name
									</th>
									<th className="px-4 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
										Type
									</th>
									<th className="px-4 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
										Expiration
									</th>
									<th className="px-4 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
										Status
									</th>
								</tr>
							</thead>
							<tbody>
								{attentionItems.map((item) => {
									const expDate = new Date(item.expirationDate)
									const isExpired = expDate < new Date()
									return (
										<tr
											key={`${item.type}-${item.id}`}
											className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
										>
											<td className="px-4 py-2.5">
												<Link
													to={item.href}
													className="font-body text-sm font-medium text-foreground hover:underline"
												>
													{item.name}
												</Link>
											</td>
											<td className="px-4 py-2.5">
												<span className="font-body text-sm capitalize text-muted-foreground">
													{item.type}
												</span>
											</td>
											<td className="px-4 py-2.5">
												<span className="font-mono text-sm">
													{expDate.toLocaleDateString()}
												</span>
											</td>
											<td className="px-4 py-2.5">
												<StatusBadge
													variant={isExpired ? 'expired' : 'expiring'}
												>
													{isExpired ? 'Expired' : 'Expiring'}
												</StatusBadge>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
		</div>
	)
}

/* ================================================================
 * Subcomponents
 * ================================================================ */

const colorMap = {
	green: 'border-green-500/30 bg-green-500/5',
	amber: 'border-amber-500/30 bg-amber-500/5',
	red: 'border-red-500/30 bg-red-500/5',
	blue: 'border-blue-500/30 bg-blue-500/5',
} as const

const iconColorMap = {
	green: 'text-green-600 dark:text-green-400',
	amber: 'text-amber-600 dark:text-amber-400',
	red: 'text-red-600 dark:text-red-400',
	blue: 'text-blue-600 dark:text-blue-400',
} as const

function StatCard({
	label,
	value,
	detail,
	href,
	color,
	icon,
}: {
	label: string
	value: string
	detail: string
	href: string
	color: keyof typeof colorMap
	icon: Parameters<typeof Icon>[0]['name']
}) {
	return (
		<Link
			to={href}
			className={cn(
				'group border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
				colorMap[color],
			)}
		>
			<div className="flex items-start justify-between">
				<div>
					<div className="font-mono text-[0.6rem] font-medium uppercase tracking-[0.1em] text-muted-foreground">
						{label}
					</div>
					<div className="mt-1 font-display text-2xl font-bold leading-tight text-foreground">
						{value}
					</div>
				</div>
				<Icon
					name={icon}
					className={cn('mt-0.5 size-5', iconColorMap[color])}
				/>
			</div>
			<div className="mt-1.5 font-body text-xs text-muted-foreground">
				{detail}
			</div>
		</Link>
	)
}

function SectionCard({
	title,
	description,
	href,
	icon,
	stat,
}: {
	title: string
	description: string
	href: string
	icon: Parameters<typeof Icon>[0]['name']
	stat: string
}) {
	return (
		<Link
			to={href}
			className="group border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-gold/40 hover:shadow-md"
		>
			<div className="mb-3 inline-flex bg-brand-navy/10 p-2">
				<Icon name={icon} className="size-5 text-brand-navy" />
			</div>
			<div className="font-display text-sm font-semibold text-foreground">
				{title}
			</div>
			<div className="mt-1 font-body text-xs text-muted-foreground">
				{description}
			</div>
			<div className="mt-3 border-t border-border pt-2 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground">
				{stat}
			</div>
		</Link>
	)
}

export const meta: Route.MetaFunction = () => {
	return [
		{ title: 'Admin Dashboard | JPG ID System' },
		{ name: 'description', content: 'Admin overview dashboard' },
	]
}
