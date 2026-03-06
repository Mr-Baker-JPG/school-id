'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { Link, Form, useNavigation } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { Checkbox } from '#app/components/ui/checkbox.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { type ExpirationStatus } from '#app/utils/student.server.ts'

export type Student = {
	id: string
	sisStudentId: string
	fullName: string
	email: string
	status: string
	studentId: {
		expirationDate: Date | null
		photoUrl: string | null
	} | null
	expirationStatus: ExpirationStatus | null
}

export function createColumns<TStudent extends Student>(
	_onRowClick: (student: TStudent) => void,
	onClearAllSelection?: () => void,
): ColumnDef<TStudent>[] {
	return [
		{
			id: 'select',
			header: ({ table }) => {
				const isAllSelected = table.getIsAllPageRowsSelected()
				const isSomeSelected = table.getIsSomePageRowsSelected()

				return (
					<Checkbox
						checked={isAllSelected || (isSomeSelected && 'indeterminate')}
						onCheckedChange={(value) => {
							// If unchecking and all rows on current page are selected, clear all selections
							if (!value && isAllSelected) {
								// Clear all selections across all pages if handler is provided
								if (onClearAllSelection) {
									onClearAllSelection()
								} else {
									// Otherwise just toggle current page
									table.toggleAllPageRowsSelected(false)
								}
							} else {
								// Toggle current page selection
								table.toggleAllPageRowsSelected(!!value)
							}
						}}
						aria-label="Select all"
					/>
				)
			},
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => {
						row.toggleSelected(!!value)
					}}
					aria-label={`Select ${row.original.fullName}`}
				/>
			),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: 'fullName',
			header: 'Student',
			cell: ({ row }) => {
				const student = row.original
				return (
					<div className="flex flex-col gap-0.5">
						<Link
							to={`/admin/students/${student.id}`}
							className="text-foreground focus:ring-primary rounded text-base font-semibold hover:underline focus:ring-2 focus:outline-none"
							onClick={(e) => e.stopPropagation()}
						>
							{student.fullName}
						</Link>
						<div className="text-muted-foreground text-sm">
							{student.email}
						</div>
					</div>
				)
			},
		},
		{
			accessorKey: 'status',
			header: 'Status',
			cell: ({ row }) => {
				const student = row.original
				return (
					<StatusBadge
						variant={student.status === 'active' ? 'active' : 'inactive'}
					>
						{student.status}
					</StatusBadge>
				)
			},
		},
		{
			id: 'expirationDate',
			header: 'Expiration Date',
			cell: ({ row }) => {
				const student = row.original
				return (
					<div className="flex flex-col gap-1">
						<Link
							to={`/admin/students/${student.id}/expiration`}
							className="text-foreground focus:ring-primary rounded hover:underline focus:ring-2 focus:outline-none"
							onClick={(e) => e.stopPropagation()}
						>
							{student.studentId?.expirationDate
								? new Date(
										student.studentId.expirationDate,
									).toLocaleDateString()
								: 'Not set'}
						</Link>
						{student.expirationStatus &&
							student.expirationStatus.type !== 'valid' && (
								<StatusBadge
									variant={
										student.expirationStatus.type === 'expiring'
											? 'expiring'
											: 'expired'
									}
								>
									{student.expirationStatus.type === 'expiring'
										? `Expires in ${student.expirationStatus.daysUntilExpiration} day${student.expirationStatus.daysUntilExpiration !== 1 ? 's' : ''}`
										: `Expired ${student.expirationStatus.daysSinceExpiration} day${student.expirationStatus.daysSinceExpiration !== 1 ? 's' : ''} ago`}
								</StatusBadge>
							)}
					</div>
				)
			},
		},
		{
			id: 'photo',
			header: 'Photo',
			cell: ({ row }) => {
				const student = row.original
				return (
					<Link
						to={`/admin/students/${student.id}/photo`}
						className="text-foreground focus:ring-primary flex items-center gap-1.5 rounded text-sm hover:underline focus:ring-2 focus:outline-none"
						onClick={(e) => e.stopPropagation()}
					>
						{student.studentId?.photoUrl ? (
							<>
								<Icon
									name="check"
									className="size-4 text-green-600 dark:text-green-400"
								/>
								<span>Has photo</span>
							</>
						) : (
							<>
								<Icon name="cross-1" className="text-muted-foreground size-4" />
								<span className="text-muted-foreground">No photo</span>
							</>
						)}
					</Link>
				)
			},
		},
		{
			id: 'actions',
			header: 'Actions',
			cell: ({ row }) => {
				const student = row.original
				return <ActionsCell student={student} />
			},
		},
	]
}

function ActionsCell<TStudent extends Student>({
	student,
}: {
	student: TStudent
}) {
	const navigation = useNavigation()
	const isPendingRecheck =
		navigation.state === 'submitting' &&
		navigation.formData?.get('studentId') === student.id

	return (
		<div onClick={(e) => e.stopPropagation()}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						aria-label={`Actions for ${student.fullName}`}
					>
						<Icon name="dots-horizontal" className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem asChild>
						<Link to={`/admin/students/${student.id}`}>
							<Icon name="pencil-1" className="mr-2" />
							View Details
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to={`/admin/students/${student.id}/photo`}>
							<Icon name="camera" className="mr-2" />
							Manage Photo
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to={`/admin/students/${student.id}/expiration`}>
							<Icon name="calendar" className="mr-2" />
							Update Expiration
						</Link>
					</DropdownMenuItem>
					<Form method="post">
						<input type="hidden" name="intent" value="recheck-facts-photo" />
						<input type="hidden" name="studentId" value={student.id} />
						<DropdownMenuItem asChild>
							<button
								type="submit"
								disabled={isPendingRecheck}
								className="w-full"
							>
								<Icon name="update" className="mr-2" />
								{isPendingRecheck ? 'Rechecking...' : 'Recheck Photo'}
							</button>
						</DropdownMenuItem>
					</Form>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
