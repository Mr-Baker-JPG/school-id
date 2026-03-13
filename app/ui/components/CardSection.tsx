import * as React from 'react'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '#app/components/ui/card.tsx'
import { cn } from '#app/utils/misc.tsx'

interface CardSectionProps {
	title?: string
	description?: string
	children: React.ReactNode
	className?: string
	/** Show a gold accent line at the top */
	goldAccent?: boolean
}

/**
 * Elevated card section — paper-like container with optional gold top accent.
 */
export function CardSection({
	title,
	description,
	children,
	className,
	goldAccent = false,
}: CardSectionProps) {
	return (
		<Card
			className={cn(
				'relative border-border bg-card shadow-sm',
				goldAccent && 'overflow-hidden',
				className,
			)}
		>
			{goldAccent && (
				<div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-gold via-brand-gold/70 to-brand-gold" />
			)}
			{(title || description) && (
				<CardHeader>
					{title && (
						<CardTitle className="font-display text-lg font-semibold text-primary">
							{title}
						</CardTitle>
					)}
					{description && <CardDescription>{description}</CardDescription>}
				</CardHeader>
			)}
			<CardContent>{children}</CardContent>
		</Card>
	)
}
