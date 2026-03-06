'use client'

import * as React from 'react'
import {
	type ColumnDef,
	type ColumnFiltersState,
	type SortingState,
	type VisibilityState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import { cn } from '#app/utils/misc.tsx'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '#app/components/ui/table.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	onRowClick?: (row: TData) => void
	className?: string
	rowSelection?: Record<string, boolean>
	onRowSelectionChange?: (selection: Record<string, boolean>) => void
}

export function DataTable<TData, TValue>({
	columns,
	data,
	onRowClick,
	className,
	rowSelection: controlledRowSelection,
	onRowSelectionChange,
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = React.useState<SortingState>([])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	)
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({})
	const [internalRowSelection, setInternalRowSelection] = React.useState({})

	const rowSelection = controlledRowSelection ?? internalRowSelection

	// Handle both controlled and uncontrolled selection
	const handleRowSelectionChange = React.useCallback(
		(updater: any) => {
			if (onRowSelectionChange) {
				// Controlled mode: calculate new selection from current controlled state
				const currentSelection = controlledRowSelection ?? {}
				const newSelection =
					typeof updater === 'function' ? updater(currentSelection) : updater
				console.log('DataTable: currentSelection:', currentSelection)
				console.log('DataTable: newSelection:', newSelection)
				console.log('DataTable: calling onRowSelectionChange')
				onRowSelectionChange(newSelection)
			} else {
				// Uncontrolled mode: update internal state
				setInternalRowSelection(
					typeof updater === 'function'
						? updater(internalRowSelection)
						: updater,
				)
			}
		},
		[onRowSelectionChange, controlledRowSelection, internalRowSelection],
	)

	const table = useReactTable({
		data,
		columns,
		getRowId: (row) => (row as { id: string }).id,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: handleRowSelectionChange,
		enableRowSelection: true,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
	})

	return (
		<div className={cn('space-y-4', className)}>
			<div className="relative w-full overflow-auto rounded-md border">
				<table className="w-full caption-bottom border-collapse text-sm">
					<TableHeader className="bg-background sticky top-0 z-10 shadow-sm [&_tr]:border-b">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									)
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && 'selected'}
									className={cn(
										onRowClick && 'cursor-pointer',
										'hover:bg-muted/50 transition-colors',
									)}
									onClick={(e) => {
										// Don't trigger row click if clicking on checkbox or in checkbox column
										const target = e.target as HTMLElement

										// Check if clicking directly on checkbox elements
										if (
											target.closest('button[role="checkbox"]') ||
											target.closest('[data-slot="checkbox"]') ||
											target.closest('[data-slot="checkbox-indicator"]')
										) {
											return
										}

										// Check if clicking in the first column (checkbox column)
										const cell = target.closest('td')
										if (cell) {
											const row = cell.closest('tr')
											if (row) {
												const cells = Array.from(row.querySelectorAll('td'))
												if (cells[0] === cell) {
													// This is the checkbox column, don't open drawer
													return
												}
											}
										}

										onRowClick?.(row.original)
									}}
									onKeyDown={(e) => {
										if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
											e.preventDefault()
											onRowClick(row.original)
										}
									}}
									role={onRowClick ? 'button' : undefined}
									tabIndex={onRowClick ? 0 : undefined}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</table>
			</div>
			<div className="flex items-center justify-between">
				<div className="text-muted-foreground flex-1 text-sm">
					{table.getFilteredSelectedRowModel().rows.length} of{' '}
					{table.getFilteredRowModel().rows.length} row(s) selected.
				</div>
				<div className="flex items-center space-x-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<Icon name="arrow-left" className="mr-2 size-4" />
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
						<Icon name="arrow-right" className="ml-2 size-4" />
					</Button>
				</div>
			</div>
		</div>
	)
}

