import * as React from 'react'
import { cn } from '#app/utils/misc.tsx'

interface PageTitleProps {
	title: string
	subtitle?: string
	rightSlot?: React.ReactNode
	className?: string
}

export function PageTitle({
	title,
	subtitle,
	rightSlot,
	className,
}: PageTitleProps) {
	return (
		<div
			className={cn(
				'flex items-start justify-between gap-4',
				subtitle && 'flex-col sm:flex-row',
				className,
			)}
		>
			<div className="flex-1">
				<h1 className="text-h1">{title}</h1>
				{subtitle && (
					<p className="text-body-md text-muted-foreground mt-2">{subtitle}</p>
				)}
			</div>
			{rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
		</div>
	)
}
