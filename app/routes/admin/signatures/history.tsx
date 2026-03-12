import * as React from 'react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useSearchParams } from 'react-router'
import { Icon } from '#app/components/ui/icon.tsx'
import { Badge } from '#app/components/ui/badge.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { type Route } from './+types/history.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	const url = new URL(request.url)
	const searchParams = {
		templateId: url.searchParams.get('templateId') || 'all',
		employeeId: url.searchParams.get('employeeId') || 'all',
		success: url.searchParams.get('success') || 'all',
	}

	// Build filter
	const where: any = {}
	if (searchParams.templateId !== 'all') {
		where.templateId = searchParams.templateId
	}
	if (searchParams.employeeId !== 'all') {
		where.employeeId = searchParams.employeeId
	}
	if (searchParams.success !== 'all') {
		where.success = searchParams.success === 'true'
	}

	// Fetch push logs with pagination
	const pushLogs = await prisma.signaturePushLog.findMany({
		where,
		include: {
			employee: {
				select: {
					id: true,
					fullName: true,
					email: true,
				},
			},
			template: {
				select: {
					id: true,
					name: true,
				},
			},
		},
		orderBy: { pushedAt: 'desc' },
		take: 100,
	})

	// Fetch all templates and employees for filters
	const templates = await prisma.signatureTemplate.findMany({
		select: { id: true, name: true },
		orderBy: { name: 'asc' },
	})

	const employees = await prisma.employee.findMany({
		select: { id: true, fullName: true, email: true },
		orderBy: { fullName: 'asc' },
	})

	return {
		pushLogs,
		templates,
		employees,
		searchParams,
	}
}

export default function SignaturePushHistoryPage({
	loaderData,
}: Route.ComponentProps) {
	const { pushLogs, templates, employees, searchParams } = loaderData
	const [, setSearchParams] = useSearchParams()

	function updateFilter(key: string, value: string) {
		const newParams = new URLSearchParams(window.location.search)
		if (value && value !== 'all') {
			newParams.set(key, value)
		} else {
			newParams.delete(key)
		}
		setSearchParams(newParams)
	}

	return (
		<div className="h-full overflow-y-auto px-6 py-6">
			<div className="mx-auto max-w-5xl space-y-6">
				{/* Navigation Tabs */}
				<div className="flex items-center gap-4 border-b pb-4">
					<a
						href="/admin/signatures/templates"
						className="text-muted-foreground hover:text-foreground"
					>
						Templates
					</a>
					<a
						href="/admin/signatures/push"
						className="text-muted-foreground hover:text-foreground"
					>
						Push to Gmail
					</a>
					<a
						href="/admin/signatures/history"
						className="text-primary font-semibold"
					>
						Push History
					</a>
				</div>

				<PageTitle
					title="Push History"
					subtitle="View signature push history and track delivery status."
				/>

				{/* Filters */}
				<div className="grid gap-4 sm:grid-cols-3">
					<div className="space-y-2">
						<label className="text-sm font-medium">Template</label>
						<select
							value={searchParams.templateId}
							onChange={(e) => updateFilter('templateId', e.target.value)}
							className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="all">All Templates</option>
							{templates.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium">Employee</label>
						<select
							value={searchParams.employeeId}
							onChange={(e) => updateFilter('employeeId', e.target.value)}
							className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="all">All Employees</option>
							{employees.map((e) => (
								<option key={e.id} value={e.id}>
									{e.fullName} ({e.email})
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium">Status</label>
						<select
							value={searchParams.success}
							onChange={(e) => updateFilter('success', e.target.value)}
							className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="all">All Statuses</option>
							<option value="true">Success</option>
							<option value="false">Failed</option>
						</select>
					</div>
				</div>

				{/* Push Logs Table */}
				{pushLogs.length === 0 ? (
					<div className="py-12 text-center">
						<div className="bg-muted/50 mb-4 inline-flex rounded-full p-4">
							<Icon name="clock" className="text-muted-foreground size-8" />
						</div>
						<h2 className="text-foreground text-lg font-semibold">
							No Push History
						</h2>
						<p className="text-muted-foreground mt-2 max-w-xs text-sm">
							No signature push logs match your filters.
						</p>
					</div>
				) : (
					<div className="overflow-hidden rounded-lg border">
						<table className="w-full text-sm">
							<thead className="bg-muted/50 border-b">
								<tr>
									<th className="px-4 py-3 text-left font-medium">Status</th>
									<th className="px-4 py-3 text-left font-medium">Employee</th>
									<th className="px-4 py-3 text-left font-medium">Template</th>
									<th className="px-4 py-3 text-left font-medium">Date</th>
									<th className="px-4 py-3 text-left font-medium">Error</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{pushLogs.map((log) => (
									<tr key={log.id} className="hover:bg-muted/30">
										<td className="px-4 py-3">
											{log.success ? (
												<Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
													<Icon name="check-circle" className="mr-1 size-3" />
													Success
												</Badge>
											) : (
												<Badge variant="destructive">
													<Icon name="cross-circle" className="mr-1 size-3" />
													Failed
												</Badge>
											)}
										</td>
										<td className="px-4 py-3">
											<a
												href={`/admin/employees/${log.employee.id}`}
												className="hover:underline"
											>
												{log.employee.fullName}
											</a>
											<p className="text-muted-foreground text-xs">
												{log.employee.email}
											</p>
										</td>
										<td className="px-4 py-3">{log.template?.name || 'Unknown'}</td>
										<td className="px-4 py-3 font-mono text-xs text-muted-foreground">
											{new Date(log.pushedAt).toLocaleString()}
										</td>
										<td className="px-4 py-3">
											{log.error && (
												<span className="text-destructive text-xs">{log.error}</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* Summary Stats */}
				{pushLogs.length > 0 && (
					<div className="flex gap-4 text-sm text-muted-foreground">
						<span>
							Showing {pushLogs.length} push{pushLogs.length !== 1 ? 'es' : ''}
						</span>
						<span>•</span>
						<span className="text-green-600">
							{pushLogs.filter((l) => l.success).length} successful
						</span>
						<span>•</span>
						<span className="text-red-600">
							{pushLogs.filter((l) => !l.success).length} failed
						</span>
					</div>
				)}
			</div>
		</div>
	)
}
