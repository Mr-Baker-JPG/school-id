import * as React from 'react'
import { cn } from '#app/utils/misc.tsx'

interface KeyValueItem {
	key: string
	value: React.ReactNode
	mono?: boolean
}

interface KeyValueListProps {
	items: KeyValueItem[]
	className?: string
}

/**
 * Dossier-style key/value list — labeled rows with a consistent left column.
 */
export function KeyValueList({ items, className }: KeyValueListProps) {
	return (
		<dl
			className={cn(
				'grid grid-cols-1 gap-0 sm:grid-cols-[160px_1fr]',
				className,
			)}
		>
			{items.map((item, index) => (
				<React.Fragment key={index}>
					<dt className="border-b border-border py-2.5 font-mono text-xs font-normal tracking-wide text-muted-foreground">
						{item.key}
					</dt>
					<dd
						className={cn(
							'border-b border-border py-2.5 font-body text-[0.9rem]',
							item.mono &&
								'font-mono text-[0.82rem] tracking-wide text-primary/80',
						)}
					>
						{item.value}
					</dd>
				</React.Fragment>
			))}
		</dl>
	)
}
