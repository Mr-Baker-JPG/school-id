import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useEffect, useRef, useState } from 'react'
import {
	Form,
	Link,
	redirect,
	useNavigation,
	useRevalidator,
	useRouteLoaderData,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '#app/components/ui/dialog.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { syncEmployeesFromFacts } from '#app/utils/employee-sync.server.ts'
import { gmailSignatureService } from '#app/utils/gmail-signature.server.ts'
import { syncPhotosToGoogle } from '#app/utils/google-photo-sync.server.ts'
import { syncStudentsFromFacts } from '#app/utils/student-sync.server.ts'
import { cn, useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/sync-status.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	// Get the most recent staff sync history entry
	const lastStaffSync = await prisma.syncHistory.findFirst({
		where: { syncType: 'staff' },
		orderBy: { createdAt: 'desc' },
	})

	// Get the most recent student sync history entry
	const lastStudentSync = await prisma.syncHistory.findFirst({
		where: { syncType: 'student' },
		orderBy: { createdAt: 'desc' },
	})

	// Get staff statistics
	const totalStaff = await prisma.employee.count()
	const activeStaff = await prisma.employee.count({
		where: { status: 'active' },
	})
	const inactiveStaff = await prisma.employee.count({
		where: { status: 'inactive' },
	})

	// Get student statistics
	const totalStudents = await prisma.student.count()
	const activeStudents = await prisma.student.count({
		where: { status: 'active' },
	})
	const inactiveStudents = await prisma.student.count({
		where: { status: 'inactive' },
	})

	// Get recent sync errors (last 10 syncs with errors for each type)
	const recentStaffErrors = await prisma.syncHistory.findMany({
		where: {
			syncType: 'staff',
			OR: [{ success: false }, { errors: { gt: 0 } }],
		},
		orderBy: { createdAt: 'desc' },
		take: 10,
	})

	const recentStudentErrors = await prisma.syncHistory.findMany({
		where: {
			syncType: 'student',
			OR: [{ success: false }, { errors: { gt: 0 } }],
		},
		orderBy: { createdAt: 'desc' },
		take: 10,
	})

	// Get staff that haven't been updated recently (more than 7 days ago)
	const sevenDaysAgo = new Date()
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
	const staffWithSyncIssues = await prisma.employee.findMany({
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

	// Get students that haven't been updated recently (more than 7 days ago)
	const studentsWithSyncIssues = await prisma.student.findMany({
		where: {
			updatedAt: { lt: sevenDaysAgo },
		},
		select: {
			id: true,
			sisStudentId: true,
			fullName: true,
			email: true,
			status: true,
			updatedAt: true,
		},
		orderBy: { updatedAt: 'asc' },
		take: 50, // Limit to most recent 50
	})

	return {
		lastStaffSync,
		lastStudentSync,
		staffStatistics: {
			total: totalStaff,
			active: activeStaff,
			inactive: inactiveStaff,
		},
		studentStatistics: {
			total: totalStudents,
			active: activeStudents,
			inactive: inactiveStudents,
		},
		recentStaffErrors,
		recentStudentErrors,
		staffWithSyncIssues,
		studentsWithSyncIssues,
	}
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'sync-staff') {
		const result = await syncEmployeesFromFacts()

		if (result.success) {
			const message =
				result.created > 0 || result.updated > 0
					? `Staff sync completed: ${result.created} created, ${result.updated} updated${
							result.errors > 0 ? `, ${result.errors} errors` : ''
						}`
					: 'Staff sync completed: No changes needed'

			return redirectWithToast('/admin/sync-status', {
				type: 'success',
				title: 'Staff Sync Successful',
				description: message,
			})
		} else {
			return redirectWithToast('/admin/sync-status', {
				type: 'error',
				title: 'Staff Sync Failed',
				description: result.errorMessage || 'An error occurred during sync',
			})
		}
	}

	if (intent === 'sync-students') {
		const result = await syncStudentsFromFacts()

		if (result.success) {
			const message =
				result.created > 0 || result.updated > 0
					? `Student sync completed: ${result.created} created, ${result.updated} updated${
							result.errors > 0 ? `, ${result.errors} errors` : ''
						}`
					: 'Student sync completed: No changes needed'

			return redirectWithToast('/admin/sync-status', {
				type: 'success',
				title: 'Student Sync Successful',
				description: message,
			})
		} else {
			return redirectWithToast('/admin/sync-status', {
				type: 'error',
				title: 'Student Sync Failed',
				description: result.errorMessage || 'An error occurred during sync',
			})
		}
	}

	if (intent === 'sync-google-photos-staff') {
		const result = await syncPhotosToGoogle({
			employeesOnly: true,
			studentsOnly: false,
			dryRun: false,
		})

		if (result.success) {
			const message =
				result.updated > 0
					? `Google photo sync completed: ${result.updated} updated, ${result.skipped} skipped (no photo)`
					: 'Google photo sync completed: No photos to update'

			return redirectWithToast('/admin/sync-status', {
				type: 'success',
				title: 'Staff Google Photo Sync Successful',
				description: message,
			})
		} else {
			return redirectWithToast('/admin/sync-status', {
				type: 'error',
				title: 'Staff Google Photo Sync Failed',
				description:
					result.errors.length > 0
						? result.errors.slice(0, 3).join('; ')
						: 'An error occurred during sync',
			})
		}
	}

	if (intent === 'sync-google-photos-students') {
		const result = await syncPhotosToGoogle({
			employeesOnly: false,
			studentsOnly: true,
			dryRun: false,
		})

		if (result.success) {
			const message =
				result.updated > 0
					? `Google photo sync completed: ${result.updated} updated, ${result.skipped} skipped (no photo)`
					: 'Google photo sync completed: No photos to update'

			return redirectWithToast('/admin/sync-status', {
				type: 'success',
				title: 'Student Google Photo Sync Successful',
				description: message,
			})
		} else {
			return redirectWithToast('/admin/sync-status', {
				type: 'error',
				title: 'Student Google Photo Sync Failed',
				description:
					result.errors.length > 0
						? result.errors.slice(0, 3).join('; ')
						: 'An error occurred during sync',
			})
		}
	}

	if (intent === 'sync-gmail-signatures') {
		const result = await gmailSignatureService.syncAllSignatures()

		if (result.success) {
			const message =
				result.fetched > 0
					? `Gmail signature sync completed: ${result.fetched} fetched, ${result.skipped} skipped (no signature)`
					: 'Gmail signature sync completed: No signatures found'

			return redirectWithToast('/admin/sync-status', {
				type: 'success',
				title: 'Gmail Signature Sync Successful',
				description: message,
			})
		} else {
			return redirectWithToast('/admin/sync-status', {
				type: 'error',
				title: 'Gmail Signature Sync Failed',
				description:
					result.errorMessages.length > 0
						? result.errorMessages.slice(0, 3).join('; ')
						: 'An error occurred during sync',
			})
		}
	}

	return redirect('/admin/sync-status')
}

/* ================================================================
 * Stat mini-card (matches dashboard pattern)
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

function StatMini({
	label,
	value,
	color,
	icon,
}: {
	label: string
	value: string | number
	color: keyof typeof colorMap
	icon: Parameters<typeof Icon>[0]['name']
}) {
	return (
		<div
			className={cn(
				'border-border bg-card border p-4 shadow-sm',
				colorMap[color],
			)}
		>
			<div className="flex items-start justify-between">
				<div>
					<div className="text-muted-foreground font-mono text-[0.6rem] font-medium tracking-[0.1em] uppercase">
						{label}
					</div>
					<div className="font-display text-foreground mt-1 text-2xl leading-tight font-bold">
						{value}
					</div>
				</div>
				<Icon
					name={icon}
					className={cn('mt-0.5 size-5', iconColorMap[color])}
				/>
			</div>
		</div>
	)
}

/* ================================================================
 * Confirmation Dialog (shared)
 * ================================================================ */

function SyncConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	warningText,
	bulletPoints,
	confirmLabel,
	confirmationText,
	intent,
	pending,
	checked,
	setChecked,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	warningText?: string
	bulletPoints: string[]
	confirmLabel: string
	confirmationText: string
	intent: string
	pending: boolean
	checked: boolean
	setChecked: (v: boolean) => void
}) {
	const navigation = useNavigation()
	const wasSubmitting = useRef(false)

	// Auto-close dialog when form submission completes
	useEffect(() => {
		const isSubmitting =
			navigation.state === 'submitting' &&
			navigation.formData?.get('intent') === intent
		const isLoading = navigation.state === 'loading' && wasSubmitting.current

		if (isSubmitting) {
			wasSubmitting.current = true
		}

		if (navigation.state === 'idle' && wasSubmitting.current) {
			wasSubmitting.current = false
			onOpenChange(false)
			setChecked(false)
		}

		if (isLoading) {
			// Still in the redirect phase, keep tracking
		}
	}, [navigation.state, navigation.formData, intent, onOpenChange, setChecked])
	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				onOpenChange(o)
				if (!o) setChecked(false)
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="font-display">{title}</DialogTitle>
					<DialogDescription className="font-body">
						{description}
					</DialogDescription>
				</DialogHeader>

				{warningText && (
					<div className="border-destructive/30 bg-destructive/5 font-body text-destructive mx-6 border-2 p-3 text-sm">
						<div className="flex items-start gap-2">
							<Icon name="cross-1" className="mt-0.5 size-4 flex-shrink-0" />
							<div>
								<p className="font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase">
									Warning: Potential Data Overwrite
								</p>
								<p className="mt-1">{warningText}</p>
							</div>
						</div>
					</div>
				)}

				<div className="border-border bg-muted/30 font-body mx-6 border p-3 text-sm">
					<p className="text-foreground font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase">
						What will happen:
					</p>
					<ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
						{bulletPoints.map((bp, i) => (
							<li key={i}>{bp}</li>
						))}
					</ul>
				</div>

				<div className="mx-6 mb-2 flex items-start gap-2">
					<input
						type="checkbox"
						id={`confirm-${intent}`}
						checked={checked}
						onChange={(e) => setChecked(e.target.checked)}
						className="accent-brand-navy mt-1 h-4 w-4"
					/>
					<label
						htmlFor={`confirm-${intent}`}
						className="font-body text-foreground text-sm leading-relaxed"
					>
						{confirmationText}
					</label>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							onOpenChange(false)
							setChecked(false)
						}}
						disabled={pending}
						className="font-mono text-[0.65rem] tracking-wide uppercase"
					>
						Cancel
					</Button>
					<Form method="post" action="/admin/sync-status">
						<input type="hidden" name="intent" value={intent} />
						<Button
							type="submit"
							size="sm"
							disabled={pending || !checked}
							className="gap-1.5 font-mono text-[0.65rem] tracking-wide uppercase"
						>
							{pending ? (
								<>
									<Icon name="update" className="size-3.5 animate-spin" />
									Syncing…
								</>
							) : (
								confirmLabel
							)}
						</Button>
					</Form>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

/* ================================================================
 * Sync Section (Staff or Students)
 * ================================================================ */

function SyncSection({
	title,
	lastSync,
	statistics,
	recentErrors,
	personsWithSyncIssues,
	personType,
	syncPending,
	googleSyncPending,
	gmailSyncPending,
	googleEnabled = false,
}: {
	title: string
	lastSync: any
	statistics: { total: number; active: number; inactive: number }
	recentErrors: any[]
	personsWithSyncIssues: any[]
	personType: 'staff' | 'students'
	syncPending: boolean
	googleSyncPending: boolean
	gmailSyncPending?: boolean
	googleEnabled?: boolean
}) {
	const revalidator = useRevalidator()
	const personLinkBase =
		personType === 'staff' ? '/admin/employees' : '/admin/students'

	// Dialog states
	const [syncDialogOpen, setSyncDialogOpen] = useState(false)
	const [syncChecked, setSyncChecked] = useState(false)
	const [googleDialogOpen, setGoogleDialogOpen] = useState(false)
	const [googleChecked, setGoogleChecked] = useState(false)
	const [gmailDialogOpen, setGmailDialogOpen] = useState(false)
	const [gmailChecked, setGmailChecked] = useState(false)

	const syncIntent = personType === 'staff' ? 'sync-staff' : 'sync-students'
	const googleIntent =
		personType === 'staff'
			? 'sync-google-photos-staff'
			: 'sync-google-photos-students'

	return (
		<div className="space-y-6">
			{/* Section heading + action buttons */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h2 className="font-display text-primary text-lg font-semibold">
					{title} Sync
				</h2>
				<div className="flex flex-wrap gap-2">
					<StatusButton
						type="button"
						variant="outline"
						size="sm"
						status={revalidator.state === 'loading' ? 'pending' : 'idle'}
						disabled={revalidator.state === 'loading'}
						onClick={() => revalidator.revalidate()}
						className="gap-1.5 font-mono text-[0.6rem] tracking-wide uppercase"
					>
						<Icon name="update" className="size-3.5" />
						Refresh
					</StatusButton>
					<StatusButton
						type="button"
						size="sm"
						status={syncPending ? 'pending' : 'idle'}
						disabled={syncPending}
						onClick={() => setSyncDialogOpen(true)}
						className="gap-1.5 font-mono text-[0.6rem] tracking-wide uppercase"
					>
						<Icon name="cloud-sync" className="size-3.5" />
						Sync {title}
					</StatusButton>
					{googleEnabled && (
					<StatusButton
						type="button"
						variant="secondary"
						size="sm"
						status={googleSyncPending ? 'pending' : 'idle'}
						disabled={googleSyncPending}
						onClick={() => setGoogleDialogOpen(true)}
						className="gap-1.5 font-mono text-[0.6rem] tracking-wide uppercase"
					>
						<Icon name="update" className="size-3.5" />
						Google Photos
					</StatusButton>
					)}
					{personType === 'staff' && googleEnabled && (
						<StatusButton
							type="button"
							variant="outline"
							size="sm"
							status={gmailSyncPending ? 'pending' : 'idle'}
							disabled={gmailSyncPending}
							onClick={() => setGmailDialogOpen(true)}
							className="gap-1.5 font-mono text-[0.6rem] tracking-wide uppercase"
						>
							<Icon name="envelope-closed" className="size-3.5" />
							Gmail Signatures
						</StatusButton>
					)}
				</div>
			</div>

			{/* Statistics row */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<StatMini
					label={`Total ${title}`}
					value={statistics.total}
					color="blue"
					icon="user"
				/>
				<StatMini
					label="Active"
					value={statistics.active}
					color="green"
					icon="check"
				/>
				<StatMini
					label="Inactive"
					value={statistics.inactive}
					color={statistics.inactive > 0 ? 'amber' : 'green'}
					icon="cross-1"
				/>
			</div>

			{/* Last Sync Status */}
			<CardSection title="Last Sync" goldAccent>
				{lastSync ? (
					<div className="space-y-3">
						<div className="flex items-center gap-3">
							<StatusBadge variant={lastSync.success ? 'active' : 'expired'}>
								{lastSync.success ? 'Success' : 'Failed'}
							</StatusBadge>
							<span className="text-muted-foreground font-mono text-xs">
								{new Date(lastSync.createdAt).toLocaleString()}
							</span>
						</div>
						<div className="grid grid-cols-3 gap-4">
							<div>
								<span className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.1em] uppercase">
									Created
								</span>
								<div className="font-display text-foreground text-lg font-bold">
									{lastSync.created}
								</div>
							</div>
							<div>
								<span className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.1em] uppercase">
									Updated
								</span>
								<div className="font-display text-foreground text-lg font-bold">
									{lastSync.updated}
								</div>
							</div>
							<div>
								<span className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.1em] uppercase">
									Errors
								</span>
								<div
									className={cn(
										'font-display text-lg font-bold',
										lastSync.errors > 0
											? 'text-destructive'
											: 'text-foreground',
									)}
								>
									{lastSync.errors}
								</div>
							</div>
						</div>
						{lastSync.errorMessage && (
							<div className="border-destructive/30 bg-destructive/5 font-body text-destructive border-2 p-2 text-sm">
								{lastSync.errorMessage}
							</div>
						)}
					</div>
				) : (
					<p className="font-body text-muted-foreground text-sm italic">
						No sync history available
					</p>
				)}
			</CardSection>

			{/* Recent Errors */}
			{recentErrors.length > 0 && (
				<CardSection title="Recent Sync Errors">
					<div className="space-y-2">
						{recentErrors.map((error) => (
							<div
								key={error.id}
								className="border-destructive/20 bg-destructive/5 border-2 p-3"
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Icon
											name="cross-1"
											className="text-destructive size-3.5"
										/>
										<span className="text-foreground font-mono text-xs font-medium">
											{new Date(error.createdAt).toLocaleString()}
										</span>
									</div>
									<StatusBadge variant="expired" className="text-[9px]">
										{error.errors} error{error.errors !== 1 ? 's' : ''}
									</StatusBadge>
								</div>
								{error.errorMessage && (
									<div className="font-body text-destructive mt-2 text-sm">
										{error.errorMessage}
									</div>
								)}
							</div>
						))}
					</div>
				</CardSection>
			)}

			{/* Persons with Sync Issues */}
			{personsWithSyncIssues.length > 0 && (
				<CardSection
					title={`${title} Pending Sync (${personsWithSyncIssues.length})`}
					description={`${title} not updated in the last 7 days`}
				>
					<div className="border-border overflow-hidden border">
						<table className="w-full">
							<thead>
								<tr className="border-border bg-muted/60 border-b">
									<th className="text-muted-foreground px-4 py-2 text-left font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase">
										Name
									</th>
									<th className="text-muted-foreground hidden px-4 py-2 text-left font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase sm:table-cell">
										Email
									</th>
									<th className="text-muted-foreground px-4 py-2 text-left font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase">
										Last Updated
									</th>
									<th className="text-muted-foreground px-4 py-2 text-left font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase">
										Status
									</th>
								</tr>
							</thead>
							<tbody>
								{personsWithSyncIssues.map((person) => (
									<tr
										key={person.id}
										className="border-border hover:bg-muted/30 border-b transition-colors last:border-0"
									>
										<td className="px-4 py-2.5">
											<Link
												to={`${personLinkBase}/${person.id}`}
												className="font-body text-foreground text-sm font-medium hover:underline"
											>
												{person.fullName}
											</Link>
										</td>
										<td className="hidden px-4 py-2.5 sm:table-cell">
											<span className="font-body text-muted-foreground text-sm">
												{person.email}
											</span>
										</td>
										<td className="px-4 py-2.5">
											<span className="text-muted-foreground font-mono text-xs">
												{new Date(person.updatedAt).toLocaleDateString()}
											</span>
										</td>
										<td className="px-4 py-2.5">
											<StatusBadge
												variant={
													person.status === 'active' ? 'active' : 'inactive'
												}
												className="text-[10px]"
											>
												{person.status}
											</StatusBadge>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</CardSection>
			)}

			{/* Dialogs */}
			<SyncConfirmDialog
				open={syncDialogOpen}
				onOpenChange={setSyncDialogOpen}
				title={`Sync ${title} from FACTS SIS`}
				description={`This will pull the latest ${title.toLowerCase()} data from FACTS and may overwrite local changes.`}
				warningText={`Local changes to ${title.toLowerCase()} records may be overwritten by data from FACTS SIS. This action cannot be undone.`}
				bulletPoints={[
					`${title} records will be updated from FACTS`,
					`New ${title.toLowerCase()} may be added`,
					'Local changes may be overwritten',
					'Profile pictures may be refreshed',
				]}
				confirmLabel={`Sync ${title} Now`}
				confirmationText="I understand that local changes may be overwritten by this sync operation."
				intent={syncIntent}
				pending={syncPending}
				checked={syncChecked}
				setChecked={setSyncChecked}
			/>

			<SyncConfirmDialog
				open={googleDialogOpen}
				onOpenChange={setGoogleDialogOpen}
				title={`Sync ${title} Photos to Google Workspace`}
				description={`This will update profile photos in Google Workspace for all ${title.toLowerCase()} that have photos in the ID system.`}
				bulletPoints={[
					'Photos from the ID system will be uploaded to Google',
					'Users without photos will be skipped',
					'Existing Google profile photos may be replaced',
					'This may take a few minutes for large batches',
				]}
				confirmLabel="Sync to Google"
				confirmationText="I understand that Google Workspace profile photos will be updated."
				intent={googleIntent}
				pending={googleSyncPending}
				checked={googleChecked}
				setChecked={setGoogleChecked}
			/>

			{personType === 'staff' && (
				<SyncConfirmDialog
					open={gmailDialogOpen}
					onOpenChange={setGmailDialogOpen}
					title="Sync Gmail Signatures"
					description="This will fetch Gmail signatures for all active staff and faculty members and cache them in the ID system."
					bulletPoints={[
						'Gmail signatures will be fetched via Google Workspace API',
						'Signatures will be cached in the database for 7 days',
						'Staff and faculty without Gmail signatures will be skipped',
						'This may take a few minutes for large batches',
					]}
					confirmLabel="Sync Gmail Signatures"
					confirmationText="I understand that Gmail signatures will be fetched and cached in the ID system."
					intent="sync-gmail-signatures"
					pending={gmailSyncPending ?? false}
					checked={gmailChecked}
					setChecked={setGmailChecked}
				/>
			)}
		</div>
	)
}

/* ================================================================
 * Tab pill
 * ================================================================ */

function TabPill({
	active,
	onClick,
	children,
}: {
	active: boolean
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				'px-3 py-1.5 font-mono text-[0.6rem] font-semibold tracking-[0.1em] uppercase transition-colors',
				active
					? 'border-brand-gold text-foreground border-b-2'
					: 'text-muted-foreground hover:text-foreground',
			)}
		>
			{children}
		</button>
	)
}

/* ================================================================
 * Main route component
 * ================================================================ */

export default function SyncStatusRoute({ loaderData }: Route.ComponentProps) {
	const {
		lastStaffSync,
		lastStudentSync,
		staffStatistics,
		studentStatistics,
		recentStaffErrors,
		recentStudentErrors,
		staffWithSyncIssues,
		studentsWithSyncIssues,
	} = loaderData

	const syncPending = useIsPending({ formAction: '/admin/sync-status' })
	const [activeTab, setActiveTab] = useState<'staff' | 'students'>('staff')
	const rootData = useRouteLoaderData('root') as
		| { schoolConfig?: { googleEnabled?: boolean } }
		| undefined
	const googleEnabled = rootData?.schoolConfig?.googleEnabled ?? false

	return (
		<div className="font-body h-full overflow-y-auto px-6 py-6">
			<div className="space-y-6">
				<PageTitle
					title="FACTS Sync Status"
					subtitle="Monitor and trigger data synchronization"
				/>

				{/* Help callout */}
				<div className="border-border bg-muted/30 font-body border p-3 text-sm">
					<p className="text-muted-foreground">
						<strong className="text-foreground">Refresh</strong> reloads the
						status page without making changes.{' '}
						<strong className="text-foreground">Sync</strong> pulls the latest
						data from FACTS and may overwrite local changes.
					</p>
				</div>

				{/* Tab bar */}
				<div className="border-border flex gap-4 border-b">
					<TabPill
						active={activeTab === 'staff'}
						onClick={() => setActiveTab('staff')}
					>
						Staff ({staffStatistics.total})
					</TabPill>
					<TabPill
						active={activeTab === 'students'}
						onClick={() => setActiveTab('students')}
					>
						Students ({studentStatistics.total})
					</TabPill>
				</div>

				{/* Tab content */}
				{activeTab === 'staff' && (
					<SyncSection
						title="Staff"
						lastSync={lastStaffSync}
						statistics={staffStatistics}
						recentErrors={recentStaffErrors}
						personsWithSyncIssues={staffWithSyncIssues}
						personType="staff"
						syncPending={syncPending}
						googleSyncPending={syncPending}
						gmailSyncPending={syncPending}
						googleEnabled={googleEnabled}
					/>
				)}

				{activeTab === 'students' && (
					<SyncSection
						title="Students"
						lastSync={lastStudentSync}
						statistics={studentStatistics}
						recentErrors={recentStudentErrors}
						personsWithSyncIssues={studentsWithSyncIssues}
						personType="students"
						syncPending={syncPending}
						googleSyncPending={syncPending}
						googleEnabled={googleEnabled}
					/>
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
