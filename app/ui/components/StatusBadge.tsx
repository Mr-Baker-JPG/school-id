import * as React from 'react'
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
	active:
		'border-emerald-700 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400',
	inactive:
		'border-muted-foreground text-muted-foreground',
	valid:
		'border-emerald-700 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400',
	invalid:
		'border-destructive text-destructive',
	expiring:
		'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400',
	expired:
		'border-destructive text-destructive',
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
		<span
			className={cn(
				// Dossier "stamp" style: outlined, uppercase, mono, slight rotate
				'inline-flex items-center gap-1 border-2 px-2 py-0.5 font-mono text-[0.62rem] font-medium uppercase tracking-[0.1em]',
				'-rotate-[1.5deg]',
				variantStyles[variant],
				className,
			)}
		>
			{showIcon && iconName && (
				<Icon name={iconName as any} className="size-2.5" />
			)}
			{children}
		</span>
	)
}
