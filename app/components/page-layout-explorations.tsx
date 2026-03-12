/**
 * 5 Page Layout Explorations
 *
 * Each demonstrates a distinct approach to the shell + content structure
 * of the app's admin and employee-facing pages. These are rendered as
 * scaled-down "mini-browser" previews showing both desktop and the
 * structural philosophy of each layout.
 *
 * Layouts:
 *  1. "Anchored Sidebar" — Fixed sidebar with content scroll, dense header
 *  2. "Top Nav + Breadcrumb Rail" — No sidebar; horizontal nav + breadcrumbs
 *  3. "Collapsible Drawer" — Icon-only rail that expands on hover/click
 *  4. "Command Center" — Dashboard grid with card-based navigation
 *  5. "Split Focus" — 2-panel master-detail with persistent list
 */

import * as React from 'react'
import { cn } from '#app/utils/misc.tsx'

/* ================================================================
 * Miniature primitives for preview rendering
 * ================================================================ */

const PREVIEW_W = 720
const PREVIEW_H = 460

function MiniFrame({
	children,
	label,
	description,
}: {
	children: React.ReactNode
	label: string
	description: string
}) {
	return (
		<div className="space-y-3">
			<div className="border-l-4 border-primary pl-4">
				<h3 className="text-lg font-bold tracking-tight">{label}</h3>
				<p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
					{description}
				</p>
			</div>
			<div
				className="overflow-hidden rounded-lg border shadow-lg"
				style={{ width: PREVIEW_W, height: PREVIEW_H }}
			>
				{children}
			</div>
		</div>
	)
}

/** Fake header bar */
function MiniHeader({
	variant = 'default',
	children,
}: {
	variant?: 'default' | 'compact' | 'dark'
	children?: React.ReactNode
}) {
	return (
		<div
			className={cn(
				'flex items-center justify-between px-4 shrink-0',
				variant === 'dark'
					? 'bg-[var(--brand-navy)] text-white'
					: 'bg-card border-b',
				variant === 'compact' ? 'h-10' : 'h-11',
			)}
		>
			<div className="flex items-center gap-2">
				<div className="size-5 rounded bg-[var(--brand-gold)]/60" />
				<span
					className={cn(
						'text-xs font-semibold',
						variant === 'dark' ? 'text-white/90' : 'text-foreground',
					)}
				>
					JPG ID System
				</span>
			</div>
			{children ?? (
				<div className="flex items-center gap-2">
					<div className="bg-muted h-2 w-12 rounded" />
					<div className="bg-muted h-2 w-12 rounded" />
					<div className="bg-muted size-5 rounded-full" />
				</div>
			)}
		</div>
	)
}

/** Fake sidebar */
function MiniSidebar({
	variant = 'full',
	items = 6,
}: {
	variant?: 'full' | 'icon-only' | 'expanded'
	items?: number
}) {
	const w = variant === 'icon-only' ? 40 : variant === 'expanded' ? 180 : 150
	return (
		<div
			className="bg-muted/40 flex shrink-0 flex-col gap-1.5 border-r p-2"
			style={{ width: w }}
		>
			{variant === 'icon-only' ? (
				<>
					{Array.from({ length: items }).map((_, i) => (
						<div
							key={i}
							className={cn(
								'mx-auto size-6 rounded',
								i === 0 ? 'bg-primary/20' : 'bg-muted-foreground/10',
							)}
						/>
					))}
				</>
			) : (
				<>
					<div className="text-muted-foreground mb-1 px-1 text-[7px] font-bold uppercase tracking-widest">
						Admin
					</div>
					{['Employees', 'Students', 'Users', 'Sync', 'Cards', 'Cache']
						.slice(0, items)
						.map((label, i) => (
							<div
								key={label}
								className={cn(
									'flex items-center gap-1.5 rounded px-2 py-1',
									i === 0
										? 'bg-primary/10 text-foreground'
										: 'text-muted-foreground',
								)}
							>
								<div
									className={cn(
										'size-3 rounded-sm',
										i === 0
											? 'bg-primary/30'
											: 'bg-muted-foreground/15',
									)}
								/>
								<span className="text-[8px] font-medium">{label}</span>
							</div>
						))}
				</>
			)}
		</div>
	)
}

/** Fake page title row */
function MiniPageTitle({
	title,
	hasAction = true,
}: {
	title: string
	hasAction?: boolean
}) {
	return (
		<div className="flex items-center justify-between">
			<div className="text-foreground text-xs font-bold">{title}</div>
			{hasAction && (
				<div className="flex gap-1.5">
					<div className="bg-primary/80 h-5 w-16 rounded text-center text-[7px] font-semibold leading-5 text-white">
						Action
					</div>
				</div>
			)}
		</div>
	)
}

/** Fake filter bar */
function MiniFilterBar() {
	return (
		<div className="flex gap-2">
			<div className="bg-background h-5 flex-1 rounded border px-1.5 text-[7px] leading-5 text-gray-400">
				Search…
			</div>
			<div className="bg-background h-5 w-14 rounded border text-center text-[7px] leading-5 text-gray-400">
				Status ▾
			</div>
			<div className="bg-background h-5 w-14 rounded border text-center text-[7px] leading-5 text-gray-400">
				Photo ▾
			</div>
		</div>
	)
}

/** Fake table rows */
function MiniTable({ rows = 6 }: { rows?: number }) {
	return (
		<div className="overflow-hidden rounded border">
			{/* Header */}
			<div className="bg-muted/60 flex gap-3 border-b px-2 py-1">
				{['Name', 'Email', 'Status', 'Exp.'].map((h) => (
					<div
						key={h}
						className="text-muted-foreground text-[7px] font-semibold"
						style={{ flex: h === 'Name' ? 2 : h === 'Email' ? 2 : 1 }}
					>
						{h}
					</div>
				))}
			</div>
			{/* Rows */}
			{Array.from({ length: rows }).map((_, i) => (
				<div
					key={i}
					className={cn(
						'flex gap-3 px-2 py-1.5 border-b last:border-0',
						i === 0 && 'bg-primary/5',
					)}
				>
					<div className="flex flex-2 items-center gap-1">
						<div className="bg-muted size-4 rounded-full" />
						<div className="bg-foreground/10 h-1.5 w-16 rounded" />
					</div>
					<div className="flex-2">
						<div className="bg-foreground/8 h-1.5 w-20 rounded" />
					</div>
					<div className="flex-1">
						<div
							className={cn(
								'h-3 w-10 rounded-full text-center text-[6px] leading-3 font-medium',
								i % 3 === 2
									? 'bg-red-100 text-red-600'
									: 'bg-green-100 text-green-700',
							)}
						>
							{i % 3 === 2 ? 'inactive' : 'active'}
						</div>
					</div>
					<div className="flex-1">
						<div className="bg-foreground/8 h-1.5 w-12 rounded" />
					</div>
				</div>
			))}
		</div>
	)
}

/** Fake card grid */
function MiniCardGrid({
	cards = 4,
	cols = 2,
}: {
	cards?: number
	cols?: number
}) {
	return (
		<div
			className="grid gap-2"
			style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
		>
			{Array.from({ length: cards }).map((_, i) => (
				<div key={i} className="rounded-lg border bg-card p-2.5 shadow-sm">
					<div className="bg-muted mb-1.5 h-1.5 w-16 rounded" />
					<div className="bg-muted-foreground/10 h-1 w-24 rounded" />
					<div className="bg-muted-foreground/8 mt-1 h-1 w-20 rounded" />
				</div>
			))}
		</div>
	)
}

/** Fake ID card placeholder */
function MiniIDCard() {
	return (
		<div className="mx-auto h-24 w-36 rounded-md border bg-white shadow-sm">
			<div className="h-1 rounded-t bg-[var(--brand-red)]" />
			<div className="flex gap-2 p-2">
				<div className="size-10 shrink-0 rounded border bg-gray-100" />
				<div className="flex flex-col gap-1 pt-0.5">
					<div className="h-1 w-12 rounded bg-gray-200" />
					<div className="h-2 w-16 rounded bg-[var(--brand-navy)]" />
					<div className="mt-auto h-2 w-8 rounded bg-[var(--brand-red)]/50" />
				</div>
			</div>
		</div>
	)
}

/* ================================================================
 * LAYOUT 1: "Anchored Sidebar"
 *
 * The current layout refined: persistent sidebar with grouped nav,
 * but the header is compressed (smaller height), the sidebar gets
 * subtle section dividers, and the content area has a visible
 * inset/padding that creates a "paper on desk" feel.
 *
 * Best for: Admin-heavy apps where sidebar nav is frequently used.
 * ================================================================ */
function Layout1() {
	return (
		<MiniFrame
			label="Anchored Sidebar"
			description="Persistent sidebar with grouped navigation, compact header, and inset content area. The content sits on a subtle recessed background creating a 'paper on desk' metaphor. Best for admin-heavy workflows with frequent nav switching."
		>
			<div className="flex h-full flex-col bg-[var(--muted)]/30">
				<MiniHeader variant="compact" />
				<div className="flex flex-1 overflow-hidden">
					<MiniSidebar />
					{/* Content recessed into muted bg */}
					<div className="flex-1 overflow-auto p-4">
						<div className="rounded-xl border bg-card p-4 shadow-sm">
							<div className="space-y-3">
								<MiniPageTitle title="Employee Management" />
								<MiniFilterBar />
								<MiniTable rows={5} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</MiniFrame>
	)
}

/* ================================================================
 * LAYOUT 2: "Top Nav + Breadcrumb Rail"
 *
 * No sidebar at all. Navigation lives in the header as horizontal
 * tabs. Below the header, a thin breadcrumb/context rail shows
 * current location. Content is full-width with generous max-width
 * centering.
 *
 * Best for: Simpler apps with fewer nav items. Maximizes content
 * width and feels less "enterprise."
 * ================================================================ */
function Layout2() {
	return (
		<MiniFrame
			label="Top Nav + Breadcrumb Rail"
			description="No sidebar. Horizontal navigation tabs in the header, thin breadcrumb rail below. Full-width centered content with generous max-width. Feels lightweight and less enterprise. Best for apps with fewer than 8 nav items."
		>
			<div className="flex h-full flex-col bg-background">
				{/* Header with inline nav */}
				<div className="flex h-11 items-center justify-between border-b bg-card px-4">
					<div className="flex items-center gap-3">
						<div className="size-5 rounded bg-[var(--brand-gold)]/60" />
						<span className="text-xs font-semibold">JPG ID System</span>
						<div className="mx-2 h-4 w-px bg-border" />
						{['Employees', 'Students', 'Sync', 'Settings'].map(
							(tab, i) => (
								<span
									key={tab}
									className={cn(
										'text-[8px] font-medium px-2 py-1 rounded',
										i === 0
											? 'bg-primary/10 text-primary font-semibold'
											: 'text-muted-foreground',
									)}
								>
									{tab}
								</span>
							),
						)}
					</div>
					<div className="bg-muted size-5 rounded-full" />
				</div>
				{/* Breadcrumb rail */}
				<div className="flex h-7 items-center gap-1.5 border-b bg-muted/30 px-4">
					<span className="text-muted-foreground text-[7px]">Admin</span>
					<span className="text-muted-foreground text-[7px]">/</span>
					<span className="text-foreground text-[7px] font-medium">
						Employees
					</span>
				</div>
				{/* Full-width centered content */}
				<div className="flex-1 overflow-auto">
					<div className="mx-auto max-w-[600px] space-y-3 p-4">
						<MiniPageTitle title="Employee Management" />
						<MiniFilterBar />
						<MiniTable rows={6} />
					</div>
				</div>
			</div>
		</MiniFrame>
	)
}

/* ================================================================
 * LAYOUT 3: "Collapsible Drawer"
 *
 * A thin icon-only rail on the left that expands into a full
 * sidebar on hover or click. When collapsed, only icons show.
 * When expanded, labels appear with smooth animation. Saves
 * horizontal space while keeping navigation accessible.
 *
 * Best for: Apps where content width matters but sidebar is still
 * needed for complex navigation.
 * ================================================================ */
function Layout3() {
	const [expanded, setExpanded] = React.useState(false)

	return (
		<MiniFrame
			label="Collapsible Drawer"
			description="Icon-only rail that expands on hover into a full sidebar. Smooth transition between collapsed (40px) and expanded (180px) states. Maximizes content width while keeping deep navigation accessible. Click the rail to toggle."
		>
			<div className="flex h-full flex-col bg-background">
				<MiniHeader />
				<div className="flex flex-1 overflow-hidden">
					{/* Collapsible sidebar */}
					<div
						className="bg-muted/40 shrink-0 cursor-pointer border-r transition-all duration-300 ease-in-out"
						style={{ width: expanded ? 180 : 40 }}
						onClick={() => setExpanded(!expanded)}
						onMouseEnter={() => setExpanded(true)}
						onMouseLeave={() => setExpanded(false)}
					>
						<div className="flex flex-col gap-1.5 p-2">
							{[
								'Employees',
								'Students',
								'Users',
								'Sync',
								'Cards',
								'Cache',
							].map((label, i) => (
								<div
									key={label}
									className={cn(
										'flex items-center gap-2 rounded px-2 py-1 transition-all',
										i === 0
											? 'bg-primary/10 text-foreground'
											: 'text-muted-foreground',
									)}
								>
									<div
										className={cn(
											'size-4 shrink-0 rounded-sm',
											i === 0
												? 'bg-primary/30'
												: 'bg-muted-foreground/15',
										)}
									/>
									<span
										className={cn(
											'text-[8px] font-medium whitespace-nowrap transition-opacity duration-200',
											expanded ? 'opacity-100' : 'opacity-0 w-0',
										)}
									>
										{label}
									</span>
								</div>
							))}
						</div>
					</div>
					{/* Content */}
					<div className="flex-1 overflow-auto p-4">
						<div className="space-y-3">
							<MiniPageTitle title="Employee Management" />
							<MiniFilterBar />
							<MiniTable rows={6} />
						</div>
					</div>
				</div>
			</div>
		</MiniFrame>
	)
}

/* ================================================================
 * LAYOUT 4: "Command Center"
 *
 * A dashboard-style layout where the main page is a grid of
 * summary cards (employee count, sync status, expiring IDs, etc.)
 * that each link to their respective sections. Below the grid,
 * a "recent activity" or quick-access table. Navigation is
 * implicit through the cards themselves.
 *
 * Best for: Overview/home pages. Gives admins a bird's-eye view
 * and quick access to areas needing attention.
 * ================================================================ */
function Layout4() {
	return (
		<MiniFrame
			label="Command Center"
			description="Dashboard grid of summary cards that double as navigation. Each card shows a metric and links to its section. Quick-access table below for recent items. Navigation is contextual through the cards themselves. Best as the admin home/overview page."
		>
			<div className="flex h-full flex-col bg-background">
				<MiniHeader variant="dark" />
				{/* Stat cards as navigation */}
				<div className="flex-1 overflow-auto p-4">
					<div className="space-y-4">
						<div className="text-foreground text-xs font-bold">
							Dashboard
						</div>
						{/* Stat cards */}
						<div className="grid grid-cols-4 gap-2">
							{[
								{
									label: 'Active Employees',
									value: '47',
									color: 'bg-green-500/10 border-green-500/20',
								},
								{
									label: 'Expiring IDs',
									value: '3',
									color: 'bg-amber-500/10 border-amber-500/20',
								},
								{
									label: 'Missing Photos',
									value: '12',
									color: 'bg-red-500/10 border-red-500/20',
								},
								{
									label: 'Last Sync',
									value: '2h ago',
									color: 'bg-blue-500/10 border-blue-500/20',
								},
							].map((stat) => (
								<div
									key={stat.label}
									className={cn(
										'rounded-lg border p-2.5 cursor-pointer hover:shadow-sm transition-shadow',
										stat.color,
									)}
								>
									<div className="text-muted-foreground text-[6px] font-medium uppercase tracking-wider">
										{stat.label}
									</div>
									<div className="text-foreground mt-0.5 text-lg font-bold leading-tight">
										{stat.value}
									</div>
								</div>
							))}
						</div>
						{/* Quick section cards */}
						<div className="grid grid-cols-3 gap-2">
							{[
								'Employee List',
								'Student List',
								'Card Designs',
							].map((section) => (
								<div
									key={section}
									className="group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/30"
								>
									<div className="bg-primary/10 mb-1.5 inline-block rounded p-1">
										<div className="size-3 rounded-sm bg-primary/30" />
									</div>
									<div className="text-[8px] font-semibold">
										{section}
									</div>
									<div className="bg-muted-foreground/10 mt-1 h-1 w-20 rounded" />
								</div>
							))}
						</div>
						{/* Recent activity table */}
						<div>
							<div className="text-muted-foreground mb-1.5 text-[7px] font-bold uppercase tracking-widest">
								Needs Attention
							</div>
							<MiniTable rows={3} />
						</div>
					</div>
				</div>
			</div>
		</MiniFrame>
	)
}

/* ================================================================
 * LAYOUT 5: "Split Focus"
 *
 * A persistent master-detail split: the left panel shows a
 * scrollable, searchable employee list. Clicking an employee
 * loads their detail in the right panel. Both panels scroll
 * independently. The list stays visible while editing details.
 *
 * Best for: Workflows where you frequently switch between
 * records (e.g., reviewing employees one-by-one, updating photos).
 * ================================================================ */
function Layout5() {
	const [selected, setSelected] = React.useState(0)
	const names = [
		'Baker, Samantha',
		'Chen, David',
		'Rodriguez, Maria',
		'Thompson, James',
		'Williams, Sarah',
		'Kim, Jennifer',
		'Nguyen, Michael',
	]

	return (
		<MiniFrame
			label="Split Focus (Master-Detail)"
			description="Persistent two-panel layout: scrollable searchable list on the left, full detail view on the right. Both panels scroll independently. The list stays visible during editing. Best for review workflows — cycling through employees to update photos, check expirations, etc."
		>
			<div className="flex h-full flex-col bg-background">
				<MiniHeader />
				<div className="flex flex-1 overflow-hidden">
					{/* Master: Employee list */}
					<div className="flex w-52 shrink-0 flex-col border-r">
						{/* List search */}
						<div className="border-b p-2">
							<div className="bg-muted h-5 rounded px-1.5 text-[7px] leading-5 text-gray-400">
								Filter employees…
							</div>
						</div>
						{/* Scrollable list */}
						<div className="flex-1 overflow-auto">
							{names.map((name, i) => (
								<div
									key={name}
									className={cn(
										'flex items-center gap-2 px-3 py-2 cursor-pointer border-b transition-colors',
										i === selected
											? 'bg-primary/10 border-l-2 border-l-primary'
											: 'hover:bg-muted/50',
									)}
									onClick={() => setSelected(i)}
								>
									<div
										className={cn(
											'size-5 rounded-full shrink-0',
											i === selected
												? 'bg-primary/20'
												: 'bg-muted',
										)}
									/>
									<div>
										<div className="text-[8px] font-semibold">
											{name}
										</div>
										<div className="text-muted-foreground text-[6px]">
											Faculty
										</div>
									</div>
									<div className="ml-auto">
										<div className="h-2.5 w-8 rounded-full bg-green-100 text-center text-[5px] font-medium leading-[10px] text-green-700">
											active
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
					{/* Detail panel */}
					<div className="flex-1 overflow-auto p-4">
						<div className="space-y-3">
							<div className="flex items-start justify-between">
								<div>
									<div className="text-foreground text-sm font-bold">
										{names[selected]}
									</div>
									<div className="text-muted-foreground text-[8px]">
										Faculty · ID: 100247
									</div>
								</div>
								<div className="flex gap-1.5">
									<div className="h-5 w-14 rounded border bg-card text-center text-[7px] leading-5">
										Photo
									</div>
									<div className="bg-primary h-5 w-20 rounded text-center text-[7px] font-medium leading-5 text-white">
										Download
									</div>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-3">
								{/* Photo + info */}
								<div className="space-y-2 rounded-lg border bg-card p-2.5">
									<div className="text-[7px] font-semibold">Photo</div>
									<div className="mx-auto size-16 rounded-lg border bg-muted" />
								</div>
								<div className="space-y-2 rounded-lg border bg-card p-2.5">
									<div className="text-[7px] font-semibold">Info</div>
									{['Name', 'Title', 'Email', 'Status'].map(
										(field) => (
											<div key={field} className="flex justify-between">
												<span className="text-muted-foreground text-[6px]">
													{field}
												</span>
												<div className="bg-foreground/8 h-1.5 w-14 rounded" />
											</div>
										),
									)}
								</div>
							</div>
							{/* ID Preview */}
							<div className="rounded-lg border bg-card p-2.5">
								<div className="mb-2 text-[7px] font-semibold">
									ID Card Preview
								</div>
								<div className="flex justify-center gap-3">
									<MiniIDCard />
									<MiniIDCard />
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</MiniFrame>
	)
}

/* ================================================================
 * Export
 * ================================================================ */

export const PAGE_LAYOUTS = [
	{
		id: 1,
		name: 'Anchored Sidebar',
		component: Layout1,
	},
	{
		id: 2,
		name: 'Top Nav + Breadcrumb Rail',
		component: Layout2,
	},
	{
		id: 3,
		name: 'Collapsible Drawer',
		component: Layout3,
	},
	{
		id: 4,
		name: 'Command Center',
		component: Layout4,
	},
	{
		id: 5,
		name: 'Split Focus (Master-Detail)',
		component: Layout5,
	},
] as const
