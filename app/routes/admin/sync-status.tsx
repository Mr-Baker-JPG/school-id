import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useState } from 'react'
import { Form, Link, redirect, useRevalidator } from 'react-router'
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
import { prisma } from '#app/utils/db.server.ts'
import { syncEmployeesFromFacts } from '#app/utils/employee-sync.server.ts'
import { gmailSignatureService } from '#app/utils/gmail-signature.server.ts'
import { syncPhotosToGoogle } from '#app/utils/google-photo-sync.server.ts'
import { syncStudentsFromFacts } from '#app/utils/student-sync.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
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

	return redirect('/admin/sync-status')
}

function SyncStatusCard({
	title,
	lastSync,
	statistics,
	recentErrors,
	personsWithSyncIssues,
	personType,
	syncPending,
	googleSyncPending,
	onSyncClick,
	onGoogleSyncClick,
	confirmDialogOpen,
	setConfirmDialogOpen,
	confirmationChecked,
	setConfirmationChecked,
	formAction,
	googleFormAction,
	googleDialogOpen,
	setGoogleDialogOpen,
	googleConfirmationChecked,
	setGoogleConfirmationChecked,
}: {
	title: string
	lastSync: any
	statistics: { total: number; active: number; inactive: number }
	recentErrors: any[]
	personsWithSyncIssues: any[]
	personType: 'staff' | 'students'
	syncPending: boolean
	googleSyncPending: boolean
	onSyncClick: () => void
	onGoogleSyncClick: () => void
	confirmDialogOpen: boolean
	setConfirmDialogOpen: (open: boolean) => void
	confirmationChecked: boolean
	setConfirmationChecked: (checked: boolean) => void
	formAction: string
	googleFormAction: string
	googleDialogOpen: boolean
	setGoogleDialogOpen: (open: boolean) => void
	googleConfirmationChecked: boolean
	setGoogleConfirmationChecked: (checked: boolean) => void
}) {
	const revalidator = useRevalidator()
	const personLinkBase = personType === 'staff' ? '/admin/employees' : '/admin/students'

	return (
		<div className="space-y-6">
			{/* Action Buttons */}
			<div className="flex flex-col gap-2 sm:flex-row">
				<StatusButton
					type="button"
					variant="outline"
					status={revalidator.state === 'loading' ? 'pending' : 'idle'}
					disabled={revalidator.state === 'loading'}
					onClick={() => revalidator.revalidate()}
				>
					Refresh
				</StatusButton>
				<StatusButton
					type="button"
					status={syncPending ? 'pending' : 'idle'}
					disabled={syncPending}
					onClick={onSyncClick}
				>
					Sync {title} Now
				</StatusButton>
				<StatusButton
					type="button"
					variant="secondary"
					status={googleSyncPending ? 'pending' : 'idle'}
					disabled={googleSyncPending}
					onClick={onGoogleSyncClick}
				>
					<Icon name="update" className="mr-2" />
					Sync to Google
				</StatusButton>
			</div>

			{/* Last Sync Status */}
			<CardSection title="Last Sync" className="border-muted/50 shadow-sm">
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
			</CardSection>

			{/* Statistics */}
			<CardSection
				title="Sync Statistics"
				className="border-muted/50 shadow-sm"
			>
				<div className="grid grid-cols-3 gap-4">
					<div>
						<div className="text-2xl font-bold">{statistics.total}</div>
						<div className="text-muted-foreground text-sm">Total {title}</div>
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
			</CardSection>

			{/* Recent Errors */}
			{recentErrors.length > 0 && (
				<CardSection
					title="Recent Sync Errors"
					className="border-muted/50 shadow-sm"
				>
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
				</CardSection>
			)}

			{/* Persons with Sync Issues */}
			{personsWithSyncIssues.length > 0 && (
				<CardSection
					title={`${title} Pending Sync (${personsWithSyncIssues.length})`}
					description={`${title} that haven't been updated in the last 7 days`}
					className="border-muted/50 shadow-sm"
				>
					<div className="space-y-2">
						{personsWithSyncIssues.map((person) => (
							<div
								key={person.id}
								className="border-border flex items-center justify-between rounded border p-2"
							>
								<div>
									<Link
										to={`${personLinkBase}/${person.id}`}
										className="font-medium hover:underline"
									>
										{person.fullName}
									</Link>
									<div className="text-muted-foreground text-sm">
										{person.email} • Last updated:{' '}
										{new Date(person.updatedAt).toLocaleDateString()}
									</div>
								</div>
								<span
									className={`rounded px-2 py-1 text-xs ${
										person.status === 'active'
											? 'bg-success/20 text-success'
											: 'bg-muted text-muted-foreground'
									}`}
								>
									{person.status}
								</span>
							</div>
						))}
					</div>
				</CardSection>
			)}

			{/* Confirmation Dialog */}
			<Dialog
				open={confirmDialogOpen}
				onOpenChange={(open) => {
					setConfirmDialogOpen(open)
					if (!open) {
						setConfirmationChecked(false)
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Sync {title} from FACTS SIS</DialogTitle>
						<DialogDescription>
							This will pull the latest {title.toLowerCase()} data from FACTS
							and may overwrite local changes.
						</DialogDescription>
					</DialogHeader>

					{/* Warning Callout */}
					<div className="bg-destructive/10 border-destructive/20 text-destructive rounded-md border p-3 text-sm">
						<div className="flex items-start gap-2">
							<Icon name="cross-1" className="mt-0.5 size-4 flex-shrink-0" />
							<div>
								<p className="font-semibold">Warning: Potential Data Overwrite</p>
								<p className="mt-1">
									Local changes to {title.toLowerCase()} records may be
									overwritten by data from FACTS SIS. This action cannot be
									undone.
								</p>
							</div>
						</div>
					</div>

					<div className="bg-muted/50 border-border rounded-md border p-3 text-sm">
						<p className="text-foreground font-medium">
							<strong>What will happen:</strong>
						</p>
						<ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
							<li>{title} records will be updated from FACTS</li>
							<li>New {title.toLowerCase()} may be added</li>
							<li>Local changes may be overwritten</li>
							<li>Profile pictures may be refreshed</li>
						</ul>
					</div>

					{/* Confirmation Checkbox */}
					<div className="flex items-start gap-2">
						<input
							type="checkbox"
							id={`sync-confirmation-${personType}`}
							checked={confirmationChecked}
							onChange={(e) => setConfirmationChecked(e.target.checked)}
							className="mt-1 h-4 w-4 rounded border-gray-300"
						/>
						<label
							htmlFor={`sync-confirmation-${personType}`}
							className="text-foreground text-sm leading-relaxed"
						>
							I understand that local changes may be overwritten by this sync
							operation.
						</label>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setConfirmDialogOpen(false)
								setConfirmationChecked(false)
							}}
							disabled={syncPending}
						>
							Cancel
						</Button>
						<Form method="post" action="/admin/sync-status">
							<input type="hidden" name="intent" value={formAction} />
							<Button
								type="submit"
								disabled={syncPending || !confirmationChecked}
							>
								{syncPending ? (
									<>
										<Icon name="update" className="mr-2 animate-spin" />
										Syncing...
									</>
								) : (
									`Sync ${title} Now`
								)}
							</Button>
						</Form>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Google Photo Sync Confirmation Dialog */}
			<Dialog
				open={googleDialogOpen}
				onOpenChange={(open) => {
					setGoogleDialogOpen(open)
					if (!open) {
						setGoogleConfirmationChecked(false)
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Sync {title} Photos to Google Workspace</DialogTitle>
						<DialogDescription>
							This will update profile photos in Google Workspace for all{' '}
							{title.toLowerCase()} that have photos in the ID system.
						</DialogDescription>
					</DialogHeader>

					<div className="bg-muted/50 border-border rounded-md border p-3 text-sm">
						<p className="text-foreground font-medium">
							<strong>What will happen:</strong>
						</p>
						<ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
							<li>Photos from the ID system will be uploaded to Google</li>
							<li>Users without photos will be skipped</li>
							<li>Existing Google profile photos may be replaced</li>
							<li>This may take a few minutes for large batches</li>
						</ul>
					</div>

					{/* Confirmation Checkbox */}
					<div className="flex items-start gap-2">
						<input
							type="checkbox"
							id={`google-sync-confirmation-${personType}`}
							checked={googleConfirmationChecked}
							onChange={(e) => setGoogleConfirmationChecked(e.target.checked)}
							className="mt-1 h-4 w-4 rounded border-gray-300"
						/>
						<label
							htmlFor={`google-sync-confirmation-${personType}`}
							className="text-foreground text-sm leading-relaxed"
						>
							I understand that Google Workspace profile photos will be updated.
						</label>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setGoogleDialogOpen(false)
								setGoogleConfirmationChecked(false)
							}}
							disabled={googleSyncPending}
						>
							Cancel
						</Button>
						<Form method="post" action="/admin/sync-status">
							<input type="hidden" name="intent" value={googleFormAction} />
							<Button
								type="submit"
								disabled={googleSyncPending || !googleConfirmationChecked}
							>
								{googleSyncPending ? (
									<>
										<Icon name="update" className="mr-2 animate-spin" />
										Syncing...
									</>
								) : (
									'Sync to Google'
								)}
							</Button>
						</Form>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

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

	const staffSyncPending = useIsPending({ formAction: '/admin/sync-status' })
	const [staffDialogOpen, setStaffDialogOpen] = useState(false)
	const [staffConfirmationChecked, setStaffConfirmationChecked] = useState(false)

	const [studentDialogOpen, setStudentDialogOpen] = useState(false)
	const [studentConfirmationChecked, setStudentConfirmationChecked] =
		useState(false)

	// Google photo sync dialogs
	const [staffGoogleDialogOpen, setStaffGoogleDialogOpen] = useState(false)
	const [staffGoogleConfirmationChecked, setStaffGoogleConfirmationChecked] =
		useState(false)

	const [studentGoogleDialogOpen, setStudentGoogleDialogOpen] = useState(false)
	const [studentGoogleConfirmationChecked, setStudentGoogleConfirmationChecked] =
		useState(false)

	return (
		<div>
			<PageTitle title="SIS Sync Status" />

			{/* Help text */}
			<div className="bg-muted/30 border-border mt-4 rounded-md border p-3 text-sm">
				<p className="text-muted-foreground">
					<strong>Refresh</strong> reloads the status page without making
					changes. <strong>Sync Now</strong> pulls the latest data from FACTS
					and may overwrite local changes.
				</p>
			</div>

			{/* Tabs for Staff and Students */}
			<div className="mt-6">
				<div className="border-b border-gray-200">
					<nav className="-mb-px flex space-x-8" aria-label="Tabs">
						<button
							onClick={() => {
								document
									.getElementById('staff-section')
									?.scrollIntoView({ behavior: 'smooth' })
							}}
							className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium"
						>
							Staff ({staffStatistics.total})
						</button>
						<button
							onClick={() => {
								document
									.getElementById('students-section')
									?.scrollIntoView({ behavior: 'smooth' })
							}}
							className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium"
						>
							Students ({studentStatistics.total})
						</button>
					</nav>
				</div>
			</div>

			{/* Staff Section */}
			<div id="staff-section" className="mt-6">
				<h2 className="mb-4 text-xl font-semibold">Staff Sync</h2>
				<SyncStatusCard
					title="Staff"
					lastSync={lastStaffSync}
					statistics={staffStatistics}
					recentErrors={recentStaffErrors}
					personsWithSyncIssues={staffWithSyncIssues}
					personType="staff"
					syncPending={staffSyncPending}
					googleSyncPending={staffSyncPending}
					onSyncClick={() => setStaffDialogOpen(true)}
					onGoogleSyncClick={() => setStaffGoogleDialogOpen(true)}
					confirmDialogOpen={staffDialogOpen}
					setConfirmDialogOpen={setStaffDialogOpen}
					confirmationChecked={staffConfirmationChecked}
					setConfirmationChecked={setStaffConfirmationChecked}
					formAction="sync-staff"
					googleFormAction="sync-google-photos-staff"
					googleDialogOpen={staffGoogleDialogOpen}
					setGoogleDialogOpen={setStaffGoogleDialogOpen}
					googleConfirmationChecked={staffGoogleConfirmationChecked}
					setGoogleConfirmationChecked={setStaffGoogleConfirmationChecked}
				/>
			</div>

			{/* Students Section */}
			<div id="students-section" className="mt-12">
				<h2 className="mb-4 text-xl font-semibold">Student Sync</h2>
				<SyncStatusCard
					title="Students"
					lastSync={lastStudentSync}
					statistics={studentStatistics}
					recentErrors={recentStudentErrors}
					personsWithSyncIssues={studentsWithSyncIssues}
					personType="students"
					syncPending={staffSyncPending}
					googleSyncPending={staffSyncPending}
					onSyncClick={() => setStudentDialogOpen(true)}
					onGoogleSyncClick={() => setStudentGoogleDialogOpen(true)}
					confirmDialogOpen={studentDialogOpen}
					setConfirmDialogOpen={setStudentDialogOpen}
					confirmationChecked={studentConfirmationChecked}
					setConfirmationChecked={setStudentConfirmationChecked}
					formAction="sync-students"
					googleFormAction="sync-google-photos-students"
					googleDialogOpen={studentGoogleDialogOpen}
					setGoogleDialogOpen={setStudentGoogleDialogOpen}
					googleConfirmationChecked={studentGoogleConfirmationChecked}
					setGoogleConfirmationChecked={setStudentGoogleConfirmationChecked}
				/>
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
