import * as React from 'react'
import { Link, useLocation } from 'react-router'
import { Sheet, SheetContent, SheetTrigger } from '#app/components/ui/sheet.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon, IconName } from '#app/components/ui/icon.tsx'
import { cn } from '#app/utils/misc.tsx'

interface NavItem {
	to: string
	label: string
	icon?: IconName
}

interface SidebarNavProps {
	items: NavItem[]
	mobileTriggerLabel?: string
	className?: string
	showDesktopSidebar?: boolean
}

export function SidebarNav({
	items,
	mobileTriggerLabel = 'Menu',
	className,
	showDesktopSidebar = true,
}: SidebarNavProps) {
	const location = useLocation()

	const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
		<nav className={cn('flex flex-col gap-1', mobile ? 'mt-8' : '', className)}>
			{items.map((item) => {
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
						<Icon name="hamburger" />
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
