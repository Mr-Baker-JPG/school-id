import * as React from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { Icon, type IconName } from '#app/components/ui/icon.tsx'
import { Sheet, SheetContent, SheetTrigger } from '#app/components/ui/sheet.tsx'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#app/components/ui/tooltip.tsx'
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

interface CollapsibleSidebarProps {
	items?: NavItem[]
	groups?: NavGroup[]
	className?: string
}

interface MobileSidebarTriggerProps {
	items?: NavItem[]
	groups?: NavGroup[]
	triggerLabel?: string
}

const STORAGE_KEY = 'sidebar-pinned'
const COLLAPSED_W = 'w-14'
const EXPANDED_W = 'w-56'

function useNavGroups(
	groups?: NavGroup[],
	items?: NavItem[],
): NavGroup[] {
	return React.useMemo(() => {
		if (groups) return groups
		if (items) return [{ label: '', items }]
		return []
	}, [groups, items])
}

/**
 * Mobile sidebar trigger — renders just the hamburger + Sheet.
 * Place this in the header's rightSlot.
 */
export function MobileSidebarTrigger({
	items,
	groups,
	triggerLabel = 'Menu',
}: MobileSidebarTriggerProps) {
	const location = useLocation()
	const allGroups = useNavGroups(groups, items)

	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon" className="md:hidden">
					<Icon name="menu" />
					<span className="sr-only">{triggerLabel}</span>
				</Button>
			</SheetTrigger>
			<SheetContent side="left" className="w-64">
				<nav className="mt-8 flex flex-col gap-4">
					{allGroups.map((group, groupIndex) => (
						<div key={group.label || groupIndex}>
							{group.label && (
								<div className="text-muted-foreground mb-2 px-3 text-xs font-medium uppercase tracking-widest">
									{group.label}
								</div>
							)}
							<div className="flex flex-col gap-1">
								{group.items.map((item) => {
									const isActive =
										location.pathname === item.to ||
										(item.to !== '/' &&
											item.to !== '/admin' &&
											location.pathname.startsWith(item.to + '/'))
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
							{groupIndex < allGroups.length - 1 && (
								<div className="border-border my-2 border-t" />
							)}
						</div>
					))}
				</nav>
			</SheetContent>
		</Sheet>
	)
}

/**
 * Desktop collapsible sidebar — renders the aside with collapse/expand.
 * Hidden on mobile (md:flex). Place this in the body layout alongside <main>.
 */
export function CollapsibleSidebar({
	items,
	groups,
	className,
}: CollapsibleSidebarProps) {
	const location = useLocation()
	const allGroups = useNavGroups(groups, items)

	const [pinned, setPinned] = React.useState(() => {
		if (typeof window === 'undefined') return false
		try {
			return localStorage.getItem(STORAGE_KEY) === '1'
		} catch {
			return false
		}
	})
	const [hovered, setHovered] = React.useState(false)

	const expanded = pinned || hovered

	const togglePin = React.useCallback(() => {
		setPinned((prev) => {
			const next = !prev
			try {
				localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
			} catch {
				// ignore
			}
			return next
		})
	}, [])

	const NavLink = React.useCallback(
		({ item }: { item: NavItem }) => {
			// Exact match, or prefix match for non-root paths
			// Special case: /admin should only match exactly (not /admin/employees)
			const isActive =
				location.pathname === item.to ||
				(item.to !== '/' &&
					item.to !== '/admin' &&
					location.pathname.startsWith(item.to + '/'))

			const linkContent = (
				<Link
					to={item.to}
					className={cn(
						'relative flex items-center gap-3 rounded-md px-3 py-2 font-medium transition-colors',
						isActive
							? 'bg-primary/10 text-foreground'
							: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
						isActive &&
							'before:bg-primary before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full',
					)}
				>
					{item.icon && (
						<Icon
							name={item.icon}
							className={cn(
								'size-4 shrink-0',
								isActive && 'text-primary',
							)}
						/>
					)}
					<span
						className={cn(
							'text-body-sm whitespace-nowrap transition-[opacity,max-width] duration-200',
							expanded
								? 'max-w-48 opacity-100'
								: 'max-w-0 opacity-0 overflow-hidden',
						)}
					>
						{item.label}
					</span>
				</Link>
			)

			if (!expanded && item.icon) {
				return (
					<Tooltip delayDuration={100}>
						<TooltipTrigger asChild>{linkContent}</TooltipTrigger>
						<TooltipContent side="right" className="text-xs">
							{item.label}
						</TooltipContent>
					</Tooltip>
				)
			}

			return linkContent
		},
		[location.pathname, expanded],
	)

	return (
		<aside
			className={cn(
				'bg-muted/40 hidden shrink-0 border-r md:flex md:flex-col transition-[width] duration-200 ease-in-out',
				expanded ? EXPANDED_W : COLLAPSED_W,
				className,
			)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
				<nav className="flex flex-1 flex-col gap-4 p-2 pt-4">
					{allGroups.map((group, groupIndex) => (
						<div key={group.label || groupIndex}>
							{group.label && (
								<div
									className={cn(
										'mb-2 px-3 text-xs font-semibold tracking-wider uppercase text-muted-foreground transition-opacity duration-200',
										expanded
											? 'opacity-100'
											: 'opacity-0 h-0 mb-0 overflow-hidden',
									)}
								>
									{group.label}
								</div>
							)}
							<div className="flex flex-col gap-0.5">
								{group.items.map((item) => (
									<NavLink key={item.to} item={item} />
								))}
							</div>
							{groupIndex < allGroups.length - 1 && (
								<div className="border-border mx-2 my-2 border-t" />
							)}
						</div>
					))}
				</nav>

				{/* Pin toggle */}
				<div className="border-t p-2">
					<Tooltip delayDuration={100}>
						<TooltipTrigger asChild>
							<button
								onClick={togglePin}
								className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
								aria-label={
									pinned ? 'Unpin sidebar' : 'Pin sidebar'
								}
							>
								<Icon
									name={pinned ? 'arrow-left' : 'arrow-right'}
									className="size-4 shrink-0"
								/>
								<span
									className={cn(
										'text-body-sm whitespace-nowrap transition-[opacity,max-width] duration-200',
										expanded
											? 'max-w-48 opacity-100'
											: 'max-w-0 opacity-0 overflow-hidden',
									)}
								>
									{pinned ? 'Unpin sidebar' : 'Pin sidebar'}
								</span>
							</button>
						</TooltipTrigger>
						{!expanded && (
							<TooltipContent side="right" className="text-xs">
								{pinned ? 'Unpin sidebar' : 'Pin sidebar'}
							</TooltipContent>
						)}
					</Tooltip>
				</div>
			</div>
		</aside>
	)
}
