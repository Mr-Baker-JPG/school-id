import * as React from 'react'
import { cn } from '#app/utils/misc.tsx'

interface PageTitleProps {
	title: string
	subtitle?: string
	rightSlot?: React.ReactNode
	className?: string
}

/**
 * Page-level title.
 * Uses Cinzel display font for the brand dossier aesthetic.
 */
export function PageTitle({
	title,
	subtitle,
	rightSlot,
	className,
}: PageTitleProps) {
	return (
		<div
			className={cn(
				'flex items-start justify-between gap-4 py-2 md:py-4',
				subtitle && 'flex-col sm:flex-row',
				className,
			)}
		>
			<div className="flex-1">
				<h1 className="font-display text-base font-semibold text-primary md:text-2xl">
					{title}
				</h1>
				{subtitle && (
					<p className="mt-1 font-body text-base italic text-muted-foreground">
						{subtitle}
					</p>
				)}
			</div>
			{rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
		</div>
	)
}
