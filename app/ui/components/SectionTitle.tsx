import * as React from 'react'
import { cn } from '#app/utils/misc.tsx'

interface SectionTitleProps {
	number: string
	children: React.ReactNode
	className?: string
}

/**
 * Dossier-style numbered section heading with gold accent.
 *
 *   01 — Personnel Record ————————————
 */
export function SectionTitle({ number, children, className }: SectionTitleProps) {
	return (
		<h2
			className={cn(
				'text-brand-gold mb-5 flex items-center gap-2 border-b border-border pb-2 font-mono text-[0.65rem] uppercase tracking-[0.12em]',
				className,
			)}
		>
			<span className="text-primary font-medium">{number}</span>
			<span className="text-brand-gold">—</span>
			<span>{children}</span>
			<span className="h-px flex-1 bg-border" aria-hidden="true" />
		</h2>
	)
}
