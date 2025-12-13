import * as React from 'react'
import { Separator } from '#app/components/ui/separator.tsx'
import { cn } from '#app/utils/misc.tsx'

interface ActionBarProps {
	leftSlot?: React.ReactNode
	rightSlot?: React.ReactNode
	showSeparator?: boolean
	className?: string
}

export function ActionBar({
	leftSlot,
	rightSlot,
	showSeparator = false,
	className,
}: ActionBarProps) {
	return (
		<>
			<div className={cn('flex items-center justify-between gap-4', className)}>
				{leftSlot && <div className="flex-1">{leftSlot}</div>}
				{rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
			</div>
			{showSeparator && <Separator className="mt-4" />}
		</>
	)
}
