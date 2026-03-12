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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#app/components/ui/tooltip.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { type ExpirationStatus } from '#app/utils/employee.server.ts'

export type Employee = {
	id: string
	sisEmployeeId: string | null
	fullName: string
	jobTitle: string | null
	email: string
	status: string
	employeeId: {
		expirationDate: Date | null
		photoUrl: string | null
		gmailSignature: string | null
	} | null
	expirationStatus: ExpirationStatus | null
}

export function createColumns<TEmployee extends Employee>(
	_onRowClick: (employee: TEmployee) => void,
	onClearAllSelection?: () => void,
): ColumnDef<TEmployee>[] {
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
							console.log('toggleAllPageRowsSelected', value)
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
						console.log('toggleSelected', value)
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
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Employee
						<Icon
							name="chevron-up"
							className={`ml-2 size-4 ${
								column.getIsSorted() === 'asc'
									? ''
									: column.getIsSorted() === 'desc'
										? 'rotate-180'
										: 'opacity-40'
							}`}
						/>
					</Button>
				)
			},
			cell: ({ row }) => {
				const employee = row.original
				return (
					<div className="flex flex-col gap-0.5">
						<Link
							to={`/admin/employees/${employee.id}`}
							className="text-foreground focus:ring-primary rounded text-base font-semibold hover:underline focus:ring-2 focus:outline-none"
							onClick={(e) => e.stopPropagation()}
						>
							{employee.fullName}
						</Link>
						{employee.jobTitle && (
							<div className="text-muted-foreground text-sm">
								{employee.jobTitle}
							</div>
						)}
						<div className="text-muted-foreground text-sm">
							{employee.email}
						</div>
					</div>
				)
			},
		},
		{
			accessorKey: 'status',
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Status
						<Icon
							name="chevron-up"
							className={`ml-2 size-4 ${
								column.getIsSorted() === 'asc'
									? ''
									: column.getIsSorted() === 'desc'
										? 'rotate-180'
										: 'opacity-40'
							}`}
						/>
					</Button>
				)
			},
			cell: ({ row }) => {
				const employee = row.original
				return (
					<StatusBadge
						variant={employee.status === 'active' ? 'active' : 'inactive'}
					>
						{employee.status}
					</StatusBadge>
				)
			},
		},
		{
			id: 'expirationDate',
			accessorFn: (row) => {
				return row.employeeId?.expirationDate
					? new Date(row.employeeId.expirationDate).getTime()
					: 0
			},
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Expiration Date
						<Icon
							name="chevron-up"
							className={`ml-2 size-4 ${
								column.getIsSorted() === 'asc'
									? ''
									: column.getIsSorted() === 'desc'
										? 'rotate-180'
										: 'opacity-40'
							}`}
						/>
					</Button>
				)
			},
			cell: ({ row }) => {
				const employee = row.original
				return (
					<div className="flex flex-col gap-1">
						<Link
							to={`/admin/employees/${employee.id}/expiration`}
							className="text-foreground focus:ring-primary rounded hover:underline focus:ring-2 focus:outline-none"
							onClick={(e) => e.stopPropagation()}
						>
							{employee.employeeId?.expirationDate
								? new Date(
										employee.employeeId.expirationDate,
									).toLocaleDateString()
								: 'Not set'}
						</Link>
						{employee.expirationStatus &&
							employee.expirationStatus.type !== 'valid' && (
								<StatusBadge
									variant={
										employee.expirationStatus.type === 'expiring'
											? 'expiring'
											: 'expired'
									}
								>
									{employee.expirationStatus.type === 'expiring'
										? `Expires in ${employee.expirationStatus.daysUntilExpiration} day${employee.expirationStatus.daysUntilExpiration !== 1 ? 's' : ''}`
										: `Expired ${employee.expirationStatus.daysSinceExpiration} day${employee.expirationStatus.daysSinceExpiration !== 1 ? 's' : ''} ago`}
								</StatusBadge>
							)}
					</div>
				)
			},
		},
		{
			id: 'photo',
			accessorFn: (row) => (row.employeeId?.photoUrl ? 1 : 0),
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Photo
						<Icon
							name="chevron-up"
							className={`ml-2 size-4 ${
								column.getIsSorted() === 'asc'
									? ''
									: column.getIsSorted() === 'desc'
										? 'rotate-180'
										: 'opacity-40'
							}`}
						/>
					</Button>
				)
			},
			cell: ({ row }) => {
				const employee = row.original
				return (
					<Link
						to={`/admin/employees/${employee.id}/photo`}
						className="text-foreground focus:ring-primary flex items-center gap-1.5 rounded text-sm hover:underline focus:ring-2 focus:outline-none"
						onClick={(e) => e.stopPropagation()}
					>
						{employee.employeeId?.photoUrl ? (
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
			id: 'signature',
			accessorFn: (row) => (row.employeeId?.gmailSignature ? 1 : 0),
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
						className="-ml-4"
					>
						Signature
						<Icon
							name="chevron-up"
							className={`ml-2 size-4 ${
								column.getIsSorted() === 'asc'
									? ''
									: column.getIsSorted() === 'desc'
										? 'rotate-180'
										: 'opacity-40'
							}`}
						/>
					</Button>
				)
			},
			cell: ({ row }) => {
				const employee = row.original
				const hasSignature = !!employee.employeeId?.gmailSignature

				if (hasSignature) {
					return (
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center gap-1.5">
									<Icon
										name="check"
										className="size-4 text-green-600 dark:text-green-400"
									/>
									<span className="text-sm">Has signature</span>
								</div>
							</TooltipTrigger>
							<TooltipContent
								side="right"
								align="start"
								className="max-w-md p-3"
							>
								<div className="text-xs font-semibold text-gray-500 mb-2">
									Gmail Signature Preview:
								</div>
								<div
									className="prose prose-sm dark:prose-invert max-w-none overflow-auto"
									dangerouslySetInnerHTML={{
										__html: employee.employeeId?.gmailSignature || '',
									}}
								/>
							</TooltipContent>
						</Tooltip>
					)
				}

				return (
					<div className="flex items-center gap-1.5">
						<Icon name="cross-1" className="text-muted-foreground size-4" />
						<span className="text-muted-foreground text-sm">No signature</span>
					</div>
				)
			},
		},
		{
			id: 'actions',
			header: 'Actions',
			cell: ({ row }) => {
				const employee = row.original
				return <ActionsCell employee={employee} />
			},
		},
	]
}

function ActionsCell<TEmployee extends Employee>({
	employee,
}: {
	employee: TEmployee
}) {
	const navigation = useNavigation()
	const isPendingRecheck =
		navigation.state === 'submitting' &&
		navigation.formData?.get('employeeId') === employee.id

	return (
		<div onClick={(e) => e.stopPropagation()}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						aria-label={`Actions for ${employee.fullName}`}
					>
						<Icon name="dots-horizontal" className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem asChild>
						<Link to={`/admin/employees/${employee.id}`}>
							<Icon name="pencil-1" className="mr-2" />
							View Details
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to={`/admin/employees/${employee.id}/photo`}>
							<Icon name="camera" className="mr-2" />
							Manage Photo
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to={`/admin/employees/${employee.id}/expiration`}>
							<Icon name="calendar" className="mr-2" />
							Update Expiration
						</Link>
					</DropdownMenuItem>
					<Form method="post">
						<input type="hidden" name="intent" value="recheck-facts-photo" />
						<input type="hidden" name="employeeId" value={employee.id} />
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
