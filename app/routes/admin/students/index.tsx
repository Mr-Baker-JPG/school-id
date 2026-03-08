import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useState, useMemo, useCallback } from 'react'
import { redirect, Form, Link, useSearchParams, useSubmit } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card } from '#app/components/ui/card.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { BulkActionsBar } from '#app/ui/components/BulkActionsBar.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { syncStudentsFromFacts } from '#app/utils/student-sync.server.ts'
import {
	getExpirationStatus,
	type ExpirationStatus,
} from '#app/utils/student.server.ts'
import {
	cn,
	useDebounce,
	useDelayedIsPending,
	useIsPending,
} from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/index.ts'
import { createColumns } from './columns.tsx'
import { DataTable } from './data-table.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const searchParams = new URL(request.url).searchParams
	const search = searchParams.get('search')
	const status = searchParams.get('status') // 'active', 'inactive', or null for all

	// Redirect if search is empty string
	if (search === '') {
		searchParams.delete('search')
		return redirect(`/admin/students?${searchParams.toString()}`)
	}

	// Build where clause for filtering
	const where: {
		OR?: Array<
			{ fullName: { contains: string } } | { email: { contains: string } }
		>
		status?: string
	} = {}

	// Add search filter (name or email)
	if (search) {
		where.OR = [
			{ fullName: { contains: search } },
			{ email: { contains: search } },
		]
	}

	// Add status filter
	if (status === 'active' || status === 'inactive') {
		where.status = status
	}

	// Fetch students with their StudentID data
	const students = await prisma.student.findMany({
		where,
		select: {
			id: true,
			sisStudentId: true,
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
		orderBy: {
			fullName: 'asc',
		},
	})

	// Calculate expiration status for each student
	const studentsWithExpirationStatus = students.map((student) => {
		let expirationStatus: ExpirationStatus | null = null
		if (student.studentId?.expirationDate) {
			expirationStatus = getExpirationStatus(student.studentId.expirationDate)
		}

		return {
			...student,
			expirationStatus,
		}
	})

	// Calculate summary statistics
	const expiringCount = studentsWithExpirationStatus.filter(
		(s) => s.expirationStatus?.type === 'expiring',
	).length
	const expiredCount = studentsWithExpirationStatus.filter(
		(s) => s.expirationStatus?.type === 'expired',
	).length

	return {
		students: studentsWithExpirationStatus,
		search: search ?? '',
		status: status ?? 'all',
		expiringCount,
		expiredCount,
	}
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'sync') {
		const result = await syncStudentsFromFacts()
		console.log('result', JSON.stringify(result, null, 2))

		// Preserve search params
		const searchParams = new URL(request.url).searchParams
		const redirectUrl = `/admin/students${
			searchParams.toString() ? `?${searchParams.toString()}` : ''
		}`

		if (result.success) {
			const parts: string[] = []
			if (result.created > 0) parts.push(`${result.created} created`)
			if (result.updated > 0) parts.push(`${result.updated} updated`)
			if (result.errors > 0) parts.push(`${result.errors} errors`)

			const message =
				parts.length > 0
					? `Sync completed: ${parts.join(', ')}`
					: 'Sync completed: No changes needed'

			return redirectWithToast(redirectUrl, {
				type: 'success',
				title: 'Sync Successful',
				description: message,
			})
		} else {
			return redirectWithToast(redirectUrl, {
				type: 'error',
				title: 'Sync Failed',
				description: result.errorMessage || 'An error occurred during sync',
			})
		}
	}

	const searchParams = new URL(request.url).searchParams
	const redirectUrl = `/admin/students${
		searchParams.toString() ? `?${searchParams.toString()}` : ''
	}`
	return redirect(redirectUrl)
}

export default function AdminStudentsRoute({
	loaderData,
}: Route.ComponentProps) {
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const search = searchParams.get('search') ?? loaderData.search
	const status = searchParams.get('status') ?? loaderData.status
	const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
		new Set(),
	)

	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/admin/students',
	})

	const syncPending = useIsPending({ formAction: '/admin/students' })

	const handleFormChange = useDebounce(async (form: HTMLFormElement) => {
		await submit(form)
	}, 400)

	const handleRowClick = useCallback(
		(student: (typeof loaderData.students)[0]) => {
			// Navigate to student detail page
			window.location.href = `/admin/students/${student.id}`
		},
		[],
	)

	const handleClearAllSelection = useCallback(() => {
		setSelectedStudents(new Set())
	}, [])

	const columns = useMemo(
		() => createColumns(handleRowClick, handleClearAllSelection),
		[handleRowClick, handleClearAllSelection],
	)

	// Convert selectedStudents Set to TanStack Table rowSelection format
	const rowSelection = useMemo(() => {
		const selection: Record<string, boolean> = {}
		selectedStudents.forEach((id) => {
			selection[id] = true
		})
		return selection
	}, [selectedStudents])

	const handleRowSelectionChange = useCallback(
		(selection: Record<string, boolean>) => {
			const newSelection = new Set<string>()
			Object.keys(selection).forEach((id) => {
				if (selection[id]) {
					newSelection.add(id)
				}
			})
			setSelectedStudents(newSelection)
		},
		[],
	)

	const handleSelectStudent = useCallback((studentId: string) => {
		setSelectedStudents((prev) => {
			const newSelection = new Set(prev)
			if (newSelection.has(studentId)) {
				newSelection.delete(studentId)
			} else {
				newSelection.add(studentId)
			}
			return newSelection
		})
	}, [])

	const syncButton = (
		<Form method="post" action="/admin/students">
			<input type="hidden" name="intent" value="sync" />
			<StatusButton
				type="submit"
				status={syncPending ? 'pending' : 'idle'}
				disabled={syncPending}
			>
				Sync from FACTS
			</StatusButton>
		</Form>
	)

	return (
		<div>
			<PageTitle
				title="Student Management"
				rightSlot={
					<div className="flex items-center gap-2">{syncButton}</div>
				}
			/>

			{(loaderData.expiringCount > 0 || loaderData.expiredCount > 0) && (
				<Card className="mt-6 border-amber-500/50 bg-amber-50/50 shadow-sm dark:bg-amber-950/20">
					<div className="p-4">
						<h2 className="text-h4 mb-2">Expiration Warnings</h2>
						<div className="flex flex-wrap gap-4">
							{loaderData.expiringCount > 0 && (
								<StatusBadge variant="expiring">
									{loaderData.expiringCount} ID
									{loaderData.expiringCount !== 1 ? 's' : ''} expiring within 30
									days
								</StatusBadge>
							)}
							{loaderData.expiredCount > 0 && (
								<StatusBadge variant="expired">
									{loaderData.expiredCount} ID
									{loaderData.expiredCount !== 1 ? 's' : ''} expired
								</StatusBadge>
							)}
						</div>
					</div>
				</Card>
			)}

			<div className="mt-6">
				<Form
					method="get"
					className="flex flex-col gap-4"
					onChange={(e) => handleFormChange(e.currentTarget)}
				>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
						<Field
							className="min-w-0 flex-1"
							labelProps={{ children: 'Search' }}
							inputProps={{
								type: 'search',
								name: 'search',
								defaultValue: search,
								placeholder: 'Search by name or email',
							}}
						/>
						<div className="flex flex-col gap-1 sm:w-auto">
							<label htmlFor="status-filter" className="text-body-xs">
								Status
							</label>
							<select
								id="status-filter"
								name="status"
								defaultValue={status}
								className="border-input bg-background h-10 rounded-md border px-3 py-2"
							>
								<option value="all">All</option>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</select>
						</div>
					</div>
				</Form>
			</div>

			{/* Bulk Action Bar */}
			<BulkActionsBar
				selectedCount={selectedStudents.size}
				onClearSelection={() => setSelectedStudents(new Set())}
				actions={[]}
			/>

			<div className="mt-6">
				<div className={cn('flex flex-col gap-4', isPending && 'opacity-50')}>
					{loaderData.students.length > 0 ? (
						<>
							{/* Mobile Card View */}
							<div className="flex flex-col gap-3 md:hidden">
								{loaderData.students.map((student) => (
									<Card
										key={student.id}
										className="border-muted/50 hover:bg-muted/50 shadow-sm"
									>
										<CardSection>
											<div className="flex flex-col gap-2.5">
												<div className="flex items-start gap-2.5">
													<input
														type="checkbox"
														checked={selectedStudents.has(student.id)}
														onChange={() => handleSelectStudent(student.id)}
														className="mt-0.5 h-4 w-4 rounded border-gray-300"
													/>
													<div className="min-w-0 flex-1">
														<Link
															to={`/admin/students/${student.id}`}
															className="text-foreground block truncate text-base font-semibold hover:underline"
														>
															{student.fullName}
														</Link>
														<div className="text-muted-foreground mt-0.5 truncate text-xs">
															{student.email}
														</div>
														{student.grade && (
															<div className="text-muted-foreground text-xs">
																Grade {student.grade}
															</div>
														)}
														<div className="mt-1.5 flex flex-wrap items-center gap-2">
															<StatusBadge
																variant={
																	student.status === 'active'
																		? 'active'
																		: 'inactive'
																}
																className="text-xs"
															>
																{student.status}
															</StatusBadge>
															{student.expirationStatus &&
																student.expirationStatus.type !== 'valid' && (
																	<>
																		<span className="text-muted-foreground">
																			·
																		</span>
																		<StatusBadge
																			variant={
																				student.expirationStatus.type ===
																				'expiring'
																					? 'expiring'
																					: 'expired'
																			}
																			className="text-xs"
																		>
																			{student.expirationStatus.type ===
																			'expiring'
																				? `Expires in ${student.expirationStatus.daysUntilExpiration}d`
																				: `Expired ${student.expirationStatus.daysSinceExpiration}d ago`}
																		</StatusBadge>
																	</>
																)}
														</div>
													</div>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="icon"
																className="h-8 w-8"
															>
																<Icon
																	name="dots-horizontal"
																	className="size-4"
																/>
																<span className="sr-only">More actions</span>
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem asChild>
																<Link to={`/admin/students/${student.id}`}>
																	View Details
																</Link>
															</DropdownMenuItem>
															<DropdownMenuItem asChild>
																<Link
																	to={`/admin/students/${student.id}/expiration`}
																>
																	Expiration
																</Link>
															</DropdownMenuItem>
															<DropdownMenuItem asChild>
																<Link
																	to={`/admin/students/${student.id}/photo`}
																>
																	{student.studentId?.photoUrl
																		? 'Update Photo'
																		: 'Add Photo'}
																</Link>
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</div>
											</div>
										</CardSection>
									</Card>
								))}
							</div>

							{/* Desktop Table View */}
							<div className="hidden md:block">
								<DataTable
									columns={columns}
									data={loaderData.students}
									onRowClick={handleRowClick}
									rowSelection={rowSelection}
									onRowSelectionChange={handleRowSelectionChange}
								/>
							</div>
						</>
					) : (
						<div className="bg-muted/30 border-border flex flex-col items-center justify-center rounded-lg border p-12 text-center">
							<Icon
								name="user"
								className="text-muted-foreground mb-4 size-12"
							/>
							<p className="text-foreground mb-2 text-lg font-semibold">
								No students found
							</p>
							<p className="text-muted-foreground text-sm">
								{search || status !== 'all'
									? 'Try adjusting your search or filter criteria'
									: 'No students have been added yet. Run a sync from FACTS to populate student data.'}
							</p>
						</div>
					)}
				</div>
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
