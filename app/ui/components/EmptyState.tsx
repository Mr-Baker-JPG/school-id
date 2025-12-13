import * as React from 'react'
import { CardSection } from './CardSection.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { cn } from '#app/utils/misc.tsx'

interface EmptyStateProps {
	icon?: React.ReactNode
	title: string
	description?: string
	actions?: React.ReactNode
	className?: string
}

export function EmptyState({
	icon,
	title,
	description,
	actions,
	className,
}: EmptyStateProps) {
	return (
		<CardSection className={cn('text-center', className)}>
			{icon && (
				<div className="mb-4 flex justify-center">
					<div className="text-muted-foreground">{icon}</div>
				</div>
			)}
			<h3 className="text-h3 mb-2">{title}</h3>
			{description && (
				<p className="text-body-md text-muted-foreground mb-6">{description}</p>
			)}
			{actions && <div className="flex justify-center gap-2">{actions}</div>}
		</CardSection>
	)
}
