import * as React from 'react'
import { useRouteLoaderData } from 'react-router'
import { type IconName } from '#app/components/ui/icon.tsx'
import { BrandHeader } from '../components/BrandHeader.tsx'
import {
	CollapsibleSidebar,
	MobileSidebarTrigger,
} from '../components/CollapsibleSidebar.tsx'
import { useOptionalUser } from '#app/utils/user.ts'
import { userHasRole } from '#app/utils/user.ts'

interface AdminShellProps {
	children: React.ReactNode
	headerActions?: React.ReactNode
}

interface NavItem {
	to: string
	label: string
	icon?: IconName
}

interface NavGroup {
	label: string
	items: NavItem[]
}

export function AdminShell({ children, headerActions }: AdminShellProps) {
	const user = useOptionalUser()
	const isAdmin = user ? userHasRole(user, 'admin') : false
	const rootData = useRouteLoaderData('root') as
		| { schoolConfig?: { googleEnabled?: boolean } }
		| undefined
	const googleEnabled = rootData?.schoolConfig?.googleEnabled ?? false

	const personalNavItems: NavItem[] = [
		{ to: '/employee/id', label: 'My ID', icon: 'avatar' },
	]

	const adminNavItems: NavItem[] = isAdmin
		? [
				{ to: '/admin', label: 'Dashboard', icon: 'laptop' },
				{ to: '/admin/employees', label: 'Employees', icon: 'user' },
				{ to: '/admin/students', label: 'Students', icon: 'graduation-cap' },
				{ to: '/admin/print', label: 'Print IDs', icon: 'file-text' },
				{ to: '/admin/users', label: 'Users', icon: 'lock-closed' },
				{ to: '/admin/sync-status', label: 'Sync Status', icon: 'cloud-sync' },
				...(googleEnabled
					? [
							{
								to: '/admin/signatures/templates',
								label: 'Signatures',
								icon: 'mail' as IconName,
							},
						]
					: []),
				{ to: '/admin/card-designs', label: 'Card Designs', icon: 'pencil-1' },
				{ to: '/admin/cache', label: 'Cache', icon: 'settings' },
			]
		: []

	// Build nav groups dynamically based on feature flags
	const dashboardItem = adminNavItems.find((i) => i.to === '/admin')
	const employeesItem = adminNavItems.find((i) => i.to === '/admin/employees')
	const studentsItem = adminNavItems.find((i) => i.to === '/admin/students')
	const printItem = adminNavItems.find((i) => i.to === '/admin/print')
	const signaturesItem = adminNavItems.find((i) =>
		i.to.includes('signatures'),
	)
	const cardDesignsItem = adminNavItems.find(
		(i) => i.to === '/admin/card-designs',
	)
	const usersItem = adminNavItems.find((i) => i.to === '/admin/users')
	const syncItem = adminNavItems.find((i) => i.to === '/admin/sync-status')
	const cacheItem = adminNavItems.find((i) => i.to === '/admin/cache')

	const toolsItems: NavItem[] = [
		printItem,
		signaturesItem,
		cardDesignsItem,
	].filter((i): i is NavItem => !!i)

	const navGroups: NavGroup[] = [
		{ label: 'Personal', items: personalNavItems },
		...(isAdmin
			? [
					{
						label: 'People',
						items: [dashboardItem!, employeesItem!, studentsItem!],
					},
					{
						label: 'Tools',
						items: toolsItems,
					},
					{
						label: 'System',
						items: [usersItem!, syncItem!, cacheItem!].filter(
							(i): i is NavItem => !!i,
						),
					},
				]
			: []),
	]

	return (
		<div className="flex h-screen flex-col overflow-hidden">
			<BrandHeader
				variant="admin"
				rightSlot={
					<div className="flex items-center gap-2">
						<MobileSidebarTrigger groups={navGroups} />
						{headerActions}
					</div>
				}
			/>
			<div className="flex min-h-0 flex-1">
				<CollapsibleSidebar groups={navGroups} />
				<main className="min-h-0 min-w-0 flex-1 overflow-hidden">
					{children}
				</main>
			</div>
		</div>
	)
}
