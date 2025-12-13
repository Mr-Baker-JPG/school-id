import * as React from 'react'
import { Badge } from '#app/components/ui/badge.tsx'
import { cn } from '#app/utils/misc.tsx'

type StatusBadgeVariant =
	| 'active'
	| 'inactive'
	| 'valid'
	| 'invalid'
	| 'expiring'
	| 'expired'

interface StatusBadgeProps {
	variant: StatusBadgeVariant
	children: React.ReactNode
	className?: string
}

const variantStyles: Record<StatusBadgeVariant, string> = {
	active: 'bg-emerald-600 text-white hover:bg-emerald-600 border-emerald-600',
	inactive: 'bg-slate-500 text-white hover:bg-slate-500 border-slate-500',
	valid: 'bg-emerald-600 text-white hover:bg-emerald-600 border-emerald-600',
	invalid: 'bg-red-600 text-white hover:bg-red-600 border-red-600',
	expiring: 'bg-amber-500 text-white hover:bg-amber-500 border-amber-500',
	expired: 'bg-red-600 text-white hover:bg-red-600 border-red-600',
}

export function StatusBadge({
	variant,
	children,
	className,
}: StatusBadgeProps) {
	return (
		<Badge variant="outline" className={cn(variantStyles[variant], className)}>
			{children}
		</Badge>
	)
}
