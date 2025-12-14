import { useState } from 'react'
import { Button } from '#app/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { cn } from '#app/utils/misc.tsx'

interface PrimaryActionBarProps {
	primaryAction: React.ReactNode
	secondaryActions?: Array<{
		label: string
		icon?: string
		onClick?: () => void
		href?: string
		asChild?: boolean
	}>
	className?: string
}

export function PrimaryActionBar({
	primaryAction,
	secondaryActions = [],
	className,
}: PrimaryActionBarProps) {
	const [isOpen, setIsOpen] = useState(false)

	if (secondaryActions.length === 0) {
		return (
			<div className={cn('flex flex-col gap-2 sm:flex-row', className)}>
				{primaryAction}
			</div>
		)
	}

	return (
		<div
			className={cn(
				'flex flex-col gap-2 sm:flex-row sm:items-center',
				className,
			)}
		>
			{/* Primary action - always visible */}
			<div className="flex-1">{primaryAction}</div>

			{/* Secondary actions - visible on larger screens, in menu on small */}
			<div className="hidden gap-2 sm:flex">
				{secondaryActions.map((action, index) => {
					if (action.asChild && action.href) {
						return (
							<Button key={index} variant="outline" size="lg" asChild>
								<a href={action.href}>
									{action.icon && <Icon name={action.icon as any} />}
									{action.label}
								</a>
							</Button>
						)
					}
					return (
						<Button
							key={index}
							variant="outline"
							size="lg"
							onClick={action.onClick}
						>
							{action.icon && <Icon name={action.icon as any} />}
							{action.label}
						</Button>
					)
				})}
			</div>

			{/* More actions menu for small screens */}
			{secondaryActions.length > 0 && (
				<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="lg" className="sm:hidden">
							<Icon name="dots-horizontal" />
							More actions
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{secondaryActions.map((action, index) => (
							<DropdownMenuItem
								key={index}
								onClick={() => {
									if (action.onClick) action.onClick()
									if (action.href && !action.asChild) {
										window.location.href = action.href
									}
									setIsOpen(false)
								}}
								asChild={action.asChild}
							>
								{action.asChild && action.href ? (
									<a href={action.href}>
										{action.icon && (
											<Icon name={action.icon as any} className="mr-2" />
										)}
										{action.label}
									</a>
								) : (
									<>
										{action.icon && (
											<Icon name={action.icon as any} className="mr-2" />
										)}
										{action.label}
									</>
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	)
}
