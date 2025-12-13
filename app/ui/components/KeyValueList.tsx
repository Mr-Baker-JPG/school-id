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

export function KeyValueList({ items, className }: KeyValueListProps) {
	return (
		<dl
			className={cn(
				'grid grid-cols-1 gap-4 sm:grid-cols-[max-content_1fr]',
				className,
			)}
		>
			{items.map((item, index) => (
				<React.Fragment key={index}>
					<dt className="text-body-sm text-muted-foreground font-medium">
						{item.key}
					</dt>
					<dd
						className={cn(
							'text-body-md',
							item.mono && 'font-mono tabular-nums',
						)}
					>
						{item.value}
					</dd>
				</React.Fragment>
			))}
		</dl>
	)
}
