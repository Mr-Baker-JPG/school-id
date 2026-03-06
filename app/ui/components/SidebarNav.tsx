import * as React from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { Icon, type IconName } from '#app/components/ui/icon.tsx'
import { Sheet, SheetContent, SheetTrigger } from '#app/components/ui/sheet.tsx'
import { cn } from '#app/utils/misc.tsx'

interface NavItem {
	to: string
	label: string
	icon?: IconName
}

interface NavGroup {
	label: string
	items: NavItem[]
}

interface SidebarNavProps {
	items?: NavItem[]
	groups?: NavGroup[]
	mobileTriggerLabel?: string
	className?: string
	showDesktopSidebar?: boolean
}

export function SidebarNav({
	items,
	groups,
	mobileTriggerLabel = 'Menu',
	className,
	showDesktopSidebar = true,
}: SidebarNavProps) {
	const location = useLocation()

	const NavContent = ({ mobile = false }: { mobile?: boolean }) => {
		// If groups are provided, render grouped navigation
		if (groups) {
			return (
				<nav
					className={cn('flex flex-col gap-4', mobile ? 'mt-8' : '', className)}
				>
					{groups.map((group, groupIndex) => (
						<div key={group.label}>
							<div className="text-muted-foreground mb-2 px-3 text-xs font-medium tracking-widest uppercase md:font-semibold md:tracking-wider">
								{group.label}
							</div>
							<div className="flex flex-col gap-1">
								{group.items.map((item) => {
									const isActive = location.pathname === item.to
									return (
										<Link
											key={item.to}
											to={item.to}
											className={cn(
												'text-body-sm flex items-center gap-3 rounded-md px-3 py-2 font-medium transition-colors',
												isActive
													? 'bg-muted text-foreground'
													: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
											)}
										>
											{item.icon && (
												<Icon name={item.icon} className="size-4" />
											)}
											{item.label}
										</Link>
									)
								})}
							</div>
							{groupIndex < groups.length - 1 && (
								<div className="border-border my-2 border-t" />
							)}
						</div>
					))}
				</nav>
			)
		}

		// Fallback to flat items list
		return (
			<nav
				className={cn('flex flex-col gap-1', mobile ? 'mt-8' : '', className)}
			>
				{items?.map((item) => {
					const isActive = location.pathname === item.to
					return (
						<Link
							key={item.to}
							to={item.to}
							className={cn(
								'text-body-sm flex items-center gap-3 rounded-md px-3 py-2 font-medium transition-colors',
								isActive
									? 'bg-muted text-foreground'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
							)}
						>
							{item.icon && <Icon name={item.icon} className="size-4" />}
							{item.label}
						</Link>
					)
				})}
			</nav>
		)
	}

	return (
		<>
			{/* Desktop Sidebar */}
			{showDesktopSidebar && (
				<aside className="bg-muted/40 hidden w-64 border-r md:block">
					<div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-4">
						<NavContent />
					</div>
				</aside>
			)}

			{/* Mobile Sheet */}
			<Sheet>
				<SheetTrigger asChild>
					<Button variant="ghost" size="icon" className="md:hidden">
						<Icon name="menu" />
						<span className="sr-only">{mobileTriggerLabel}</span>
					</Button>
				</SheetTrigger>
				<SheetContent side="left" className="w-64">
					<NavContent mobile />
				</SheetContent>
			</Sheet>
		</>
	)
}
