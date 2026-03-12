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
	const missingPhotos = employeesWithoutPhoto + studentsWithoutPhoto

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
			missingPhotos,
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
		<div className="space-y-8">
			<PageTitle
				title="Dashboard"
				subtitle="Overview of the JPG ID System"
			/>

			{/* Stat Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label="Active People"
					value={`${stats.activeEmployees + stats.activeStudents}`}
					detail={`${stats.activeEmployees} employees · ${stats.activeStudents} students`}
					href="/admin/employees"
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
				<StatCard
					label="Missing Photos"
					value={`${stats.missingPhotos}`}
					detail="Active people without a photo"
					href="/admin/employees?photo=no"
					color={stats.missingPhotos > 0 ? 'amber' : 'green'}
					icon="camera"
				/>
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
					<h2 className="text-h4 mb-3 font-semibold">Needs Attention</h2>
					<div className="overflow-hidden rounded-lg border">
						<table className="w-full">
							<thead>
								<tr className="bg-muted/60 border-b">
									<th className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold">
										Name
									</th>
									<th className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold">
										Type
									</th>
									<th className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold">
										Expiration
									</th>
									<th className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold">
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
											className="hover:bg-muted/30 border-b last:border-0 transition-colors"
										>
											<td className="px-4 py-2.5">
												<Link
													to={item.href}
													className="text-foreground text-sm font-medium hover:underline"
												>
													{item.name}
												</Link>
											</td>
											<td className="px-4 py-2.5">
												<span className="text-muted-foreground text-sm capitalize">
													{item.type}
												</span>
											</td>
											<td className="px-4 py-2.5">
												<span className="text-sm font-mono">
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
				'group rounded-xl border p-4 transition-shadow hover:shadow-md',
				colorMap[color],
			)}
		>
			<div className="flex items-start justify-between">
				<div>
					<div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
						{label}
					</div>
					<div className="text-foreground mt-1 text-2xl font-bold leading-tight">
						{value}
					</div>
				</div>
				<Icon
					name={icon}
					className={cn('size-5 mt-0.5', iconColorMap[color])}
				/>
			</div>
			<div className="text-muted-foreground mt-1.5 text-xs">{detail}</div>
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
			className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
		>
			<div className="bg-primary/10 mb-3 inline-flex rounded-lg p-2">
				<Icon name={icon} className="text-primary size-5" />
			</div>
			<div className="text-foreground text-sm font-semibold">{title}</div>
			<div className="text-muted-foreground mt-1 text-xs">{description}</div>
			<div className="text-muted-foreground mt-3 border-t pt-2 text-xs font-medium">
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
