import * as React from 'react'
import { Link } from 'react-router'
import { Separator } from '#app/components/ui/separator.tsx'
import { SCHOOL_NAME } from '../brand.ts'
import { cn } from '#app/utils/misc.tsx'

interface BrandFooterProps {
	className?: string
}

export function BrandFooter({ className }: BrandFooterProps) {
	return (
		<footer className={cn('bg-muted/40 w-full border-t', className)}>
			<div className="container px-4 py-8">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-body-sm text-muted-foreground">
							© {new Date().getFullYear()} {SCHOOL_NAME}
						</p>
					</div>
					<nav className="flex flex-wrap gap-4">
						<Link
							to="/privacy"
							className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							Privacy
						</Link>
						<Link
							to="/tos"
							className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							Terms of Service
						</Link>
						<Link
							to="/support"
							className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							Support
						</Link>
					</nav>
				</div>
			</div>
		</footer>
	)
}
