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
}

export function CardSection({
	title,
	description,
	children,
	className,
}: CardSectionProps) {
	return (
		<Card className={cn(className)}>
			{(title || description) && (
				<CardHeader>
					{title && <CardTitle>{title}</CardTitle>}
					{description && <CardDescription>{description}</CardDescription>}
				</CardHeader>
			)}
			<CardContent>{children}</CardContent>
		</Card>
	)
}
