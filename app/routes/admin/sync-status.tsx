import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, Link, redirect, useRevalidator } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { syncEmployeesFromFacts } from '#app/utils/employee-sync.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/sync-status.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	// Get the most recent sync history entry
	const lastSync = await prisma.syncHistory.findFirst({
		orderBy: { createdAt: 'desc' },
	})

	// Get sync statistics
	const totalEmployees = await prisma.employee.count()
	const activeEmployees = await prisma.employee.count({
		where: { status: 'active' },
	})
	const inactiveEmployees = await prisma.employee.count({
		where: { status: 'inactive' },
	})

	// Get recent sync errors (last 10 syncs with errors)
	const recentErrors = await prisma.syncHistory.findMany({
		where: {
			OR: [{ success: false }, { errors: { gt: 0 } }],
		},
		orderBy: { createdAt: 'desc' },
		take: 10,
	})

	// Get employees that haven't been updated recently (more than 7 days ago)
	// These might be pending sync issues
	const sevenDaysAgo = new Date()
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
	const employeesWithSyncIssues = await prisma.employee.findMany({
		where: {
			updatedAt: { lt: sevenDaysAgo },
		},
		select: {
			id: true,
			sisEmployeeId: true,
			fullName: true,
			email: true,
			status: true,
			updatedAt: true,
		},
		orderBy: { updatedAt: 'asc' },
		take: 50, // Limit to most recent 50
	})

	return {
		lastSync,
		statistics: {
			total: totalEmployees,
			active: activeEmployees,
			inactive: inactiveEmployees,
		},
		recentErrors,
		employeesWithSyncIssues,
	}
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'sync') {
		const result = await syncEmployeesFromFacts()

		if (result.success) {
			const message =
				result.created > 0 || result.updated > 0
					? `Sync completed: ${result.created} created, ${result.updated} updated${
							result.errors > 0 ? `, ${result.errors} errors` : ''
						}`
					: 'Sync completed: No changes needed'

			return redirectWithToast('/admin/sync-status', {
				type: 'success',
				title: 'Sync Successful',
				description: message,
			})
		} else {
			return redirectWithToast('/admin/sync-status', {
				type: 'error',
				title: 'Sync Failed',
				description: result.errorMessage || 'An error occurred during sync',
			})
		}
	}

	return redirect('/admin/sync-status')
}

export default function SyncStatusRoute({ loaderData }: Route.ComponentProps) {
	const { lastSync, statistics, recentErrors, employeesWithSyncIssues } =
		loaderData
	const syncPending = useIsPending({ formAction: '/admin/sync-status' })
	const revalidator = useRevalidator()

	return (
		<div className="container">
			<div className="flex items-center justify-between">
				<h1 className="text-h1">SIS Sync Status</h1>
				<div className="flex gap-2">
					<StatusButton
						type="button"
						variant="outline"
						status={revalidator.state === 'loading' ? 'pending' : 'idle'}
						disabled={revalidator.state === 'loading'}
						onClick={() => revalidator.revalidate()}
					>
						<Icon name="update" />
						Refresh
					</StatusButton>
					<Form method="post">
						<input type="hidden" name="intent" value="sync" />
						<StatusButton
							type="submit"
							status={syncPending ? 'pending' : 'idle'}
							disabled={syncPending}
						>
							<Icon name="update" />
							Sync Now
						</StatusButton>
					</Form>
				</div>
			</div>
			<Spacer size="2xs" />

			{/* Last Sync Status */}
			<div className="border-border bg-card rounded-lg border p-6">
				<h2 className="text-h2 mb-4">Last Sync</h2>
				{lastSync ? (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Icon
								name={lastSync.success ? 'check' : 'cross'}
								className={
									lastSync.success ? 'text-success' : 'text-destructive'
								}
							/>
							<span className="font-semibold">
								{lastSync.success ? 'Successful' : 'Failed'}
							</span>
							<span className="text-muted-foreground">
								• {new Date(lastSync.createdAt).toLocaleString()}
							</span>
						</div>
						<div className="grid grid-cols-3 gap-4 text-sm">
							<div>
								<span className="text-muted-foreground">Created:</span>{' '}
								<span className="font-medium">{lastSync.created}</span>
							</div>
							<div>
								<span className="text-muted-foreground">Updated:</span>{' '}
								<span className="font-medium">{lastSync.updated}</span>
							</div>
							<div>
								<span className="text-muted-foreground">Errors:</span>{' '}
								<span
									className={
										lastSync.errors > 0
											? 'text-destructive font-medium'
											: 'font-medium'
									}
								>
									{lastSync.errors}
								</span>
							</div>
						</div>
						{lastSync.errorMessage && (
							<div className="bg-destructive/10 text-destructive mt-2 rounded p-2 text-sm">
								{lastSync.errorMessage}
							</div>
						)}
					</div>
				) : (
					<p className="text-muted-foreground">No sync history available</p>
				)}
			</div>

			<Spacer size="xs" />

			{/* Statistics */}
			<div className="border-border bg-card rounded-lg border p-6">
				<h2 className="text-h2 mb-4">Sync Statistics</h2>
				<div className="grid grid-cols-3 gap-4">
					<div>
						<div className="text-2xl font-bold">{statistics.total}</div>
						<div className="text-muted-foreground text-sm">Total Employees</div>
					</div>
					<div>
						<div className="text-success text-2xl font-bold">
							{statistics.active}
						</div>
						<div className="text-muted-foreground text-sm">Active</div>
					</div>
					<div>
						<div className="text-muted-foreground text-2xl font-bold">
							{statistics.inactive}
						</div>
						<div className="text-muted-foreground text-sm">Inactive</div>
					</div>
				</div>
			</div>

			<Spacer size="xs" />

			{/* Recent Errors */}
			{recentErrors.length > 0 && (
				<>
					<div className="border-border bg-card rounded-lg border p-6">
						<h2 className="text-h2 mb-4">Recent Sync Errors</h2>
						<div className="space-y-3">
							{recentErrors.map((error) => (
								<div
									key={error.id}
									className="border-destructive/20 bg-destructive/5 rounded border p-3"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Icon name="cross" className="text-destructive" />
											<span className="font-medium">
												{new Date(error.createdAt).toLocaleString()}
											</span>
										</div>
										<span className="text-muted-foreground text-sm">
											{error.errors} error{error.errors !== 1 ? 's' : ''}
										</span>
									</div>
									{error.errorMessage && (
										<div className="text-destructive mt-2 text-sm">
											{error.errorMessage}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
					<Spacer size="xs" />
				</>
			)}

			{/* Employees with Sync Issues */}
			{employeesWithSyncIssues.length > 0 && (
				<div className="border-border bg-card rounded-lg border p-6">
					<h2 className="text-h2 mb-4">
						Employees Pending Sync ({employeesWithSyncIssues.length})
					</h2>
					<p className="text-muted-foreground mb-4 text-sm">
						Employees that haven't been updated in the last 7 days
					</p>
					<div className="space-y-2">
						{employeesWithSyncIssues.map((employee) => (
							<div
								key={employee.id}
								className="border-border flex items-center justify-between rounded border p-2"
							>
								<div>
									<Link
										to={`/admin/employees/${employee.id}`}
										className="font-medium hover:underline"
									>
										{employee.fullName}
									</Link>
									<div className="text-muted-foreground text-sm">
										{employee.email} • Last updated:{' '}
										{new Date(employee.updatedAt).toLocaleDateString()}
									</div>
								</div>
								<span
									className={`rounded px-2 py-1 text-xs ${
										employee.status === 'active'
											? 'bg-success/20 text-success'
											: 'bg-muted text-muted-foreground'
									}`}
								>
									{employee.status}
								</span>
							</div>
						))}
					</div>
				</div>
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
