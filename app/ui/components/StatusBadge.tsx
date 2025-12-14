import * as React from 'react'
import { Badge } from '#app/components/ui/badge.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
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
	showIcon?: boolean
}

const variantStyles: Record<StatusBadgeVariant, string> = {
	active: 'bg-emerald-600 text-white hover:bg-emerald-600 border-emerald-600',
	inactive: 'bg-slate-500 text-white hover:bg-slate-500 border-slate-500',
	valid: 'bg-emerald-600 text-white hover:bg-emerald-600 border-emerald-600',
	invalid: 'bg-red-600 text-white hover:bg-red-600 border-red-600',
	expiring: 'bg-amber-500 text-white hover:bg-amber-500 border-amber-500',
	expired: 'bg-red-600 text-white hover:bg-red-600 border-red-600',
}

const variantIcons: Record<StatusBadgeVariant, string> = {
	active: 'check',
	inactive: 'cross-1',
	valid: 'check',
	invalid: 'cross-1',
	expiring: 'clock',
	expired: 'cross-1',
}

export function StatusBadge({
	variant,
	children,
	className,
	showIcon = true,
}: StatusBadgeProps) {
	const iconName = variantIcons[variant]

	return (
		<Badge variant="outline" className={cn(variantStyles[variant], className)}>
			{showIcon && iconName && (
				<Icon name={iconName as any} className="mr-1 size-3" />
			)}
			{children}
		</Badge>
	)
}
