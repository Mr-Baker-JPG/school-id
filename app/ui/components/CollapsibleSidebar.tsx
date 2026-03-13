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
				<Button
					variant="ghost"
					size="icon"
					className="text-brand-gold/70 hover:bg-white/10 hover:text-brand-gold md:hidden"
				>
					<Icon name="menu" />
					<span className="sr-only">{triggerLabel}</span>
				</Button>
			</SheetTrigger>
			<SheetContent side="left" className="w-64 bg-card">
				<nav className="mt-8 flex flex-col gap-5">
					{allGroups.map((group, groupIndex) => (
						<div key={group.label || groupIndex}>
							{group.label && (
								<div className="mb-1.5 px-3 font-mono text-[0.6rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
									{group.label}
								</div>
							)}
							<div className="flex flex-col gap-0">
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
												'flex items-center gap-3 px-3 py-2 font-body text-sm font-medium transition-colors',
												isActive
													? 'border-l-2 border-brand-gold bg-brand-navy/5 text-foreground'
													: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
											)}
										>
											{item.icon && (
												<Icon
													name={item.icon}
													className={cn(
														'size-4',
														isActive && 'text-brand-gold',
													)}
												/>
											)}
											{item.label}
										</Link>
									)
								})}
							</div>
						</div>
					))}
				</nav>
			</SheetContent>
		</Sheet>
	)
}

/**
 * Desktop collapsible sidebar — dossier-styled with warm cream tones.
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
			const isActive =
				location.pathname === item.to ||
				(item.to !== '/' &&
					item.to !== '/admin' &&
					location.pathname.startsWith(item.to + '/'))

			const linkContent = (
				<Link
					to={item.to}
					className={cn(
						'relative flex items-center gap-3 px-3 py-2 font-body text-sm font-medium transition-colors',
						isActive
							? 'border-l-2 border-brand-gold bg-brand-navy/5 text-foreground'
							: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
					)}
				>
					{item.icon && (
						<Icon
							name={item.icon}
							className={cn(
								'size-4 shrink-0',
								isActive && 'text-brand-gold',
							)}
						/>
					)}
					<span
						className={cn(
							'whitespace-nowrap transition-[opacity,max-width] duration-200',
							expanded
								? 'max-w-48 opacity-100'
								: 'max-w-0 overflow-hidden opacity-0',
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
						<TooltipContent side="right" className="font-body text-xs">
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
				'hidden shrink-0 border-r border-border bg-card transition-[width] duration-200 ease-in-out md:flex md:flex-col',
				expanded ? EXPANDED_W : COLLAPSED_W,
				className,
			)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
				<nav className="flex flex-1 flex-col gap-5 p-2 pt-4">
					{allGroups.map((group, groupIndex) => (
						<div key={group.label || groupIndex}>
							{group.label && (
								<div
									className={cn(
										'mb-1.5 px-3 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 transition-opacity duration-200',
										expanded
											? 'opacity-100'
											: 'mb-0 h-0 overflow-hidden opacity-0',
									)}
								>
									{group.label}
								</div>
							)}
							<div className="flex flex-col gap-0">
								{group.items.map((item) => (
									<NavLink key={item.to} item={item} />
								))}
							</div>
						</div>
					))}
				</nav>

				{/* Pin toggle */}
				<div className="border-t border-border p-2">
					<Tooltip delayDuration={100}>
						<TooltipTrigger asChild>
							<button
								onClick={togglePin}
								className="flex w-full items-center gap-3 px-3 py-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
										'whitespace-nowrap font-body text-sm transition-[opacity,max-width] duration-200',
										expanded
											? 'max-w-48 opacity-100'
											: 'max-w-0 overflow-hidden opacity-0',
									)}
								>
									{pinned ? 'Unpin sidebar' : 'Pin sidebar'}
								</span>
							</button>
						</TooltipTrigger>
						{!expanded && (
							<TooltipContent side="right" className="font-body text-xs">
								{pinned ? 'Unpin sidebar' : 'Pin sidebar'}
							</TooltipContent>
						)}
					</Tooltip>
				</div>
			</div>
		</aside>
	)
}
