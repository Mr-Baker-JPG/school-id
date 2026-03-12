import * as React from 'react'
import { type IconName } from '#app/components/ui/icon.tsx'
import { BrandHeader } from '../components/BrandHeader.tsx'
import { SidebarNav } from '../components/SidebarNav.tsx'
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

	const personalNavItems: NavItem[] = [
		{ to: '/employee/id', label: 'My ID', icon: 'user' },
	]

	const adminNavItems: NavItem[] = isAdmin
		? [
				{ to: '/admin/employees', label: 'Employees', icon: 'user' },
				{ to: '/admin/students', label: 'Students', icon: 'user' },
				{ to: '/admin/users', label: 'Users', icon: 'user' },
				{ to: '/admin/sync-status', label: 'Sync Status', icon: 'cloud-sync' },
				{ to: '/admin/card-designs', label: 'Card Designs', icon: 'pencil-1' },
				{ to: '/admin/layout-explorations', label: 'Layout Explorations', icon: 'pencil-1' },
				{ to: '/admin/cache', label: 'Cache', icon: 'settings' },
			]
		: []

	const navGroups: NavGroup[] = [
		{ label: 'Personal', items: personalNavItems },
		...(isAdmin ? [{ label: 'Administration', items: adminNavItems }] : []),
	]

	return (
		<div className="flex min-h-screen flex-col">
			<BrandHeader
				variant="admin"
				rightSlot={
					<div className="flex items-center gap-2">
						<SidebarNav groups={navGroups} showDesktopSidebar={false} />
						{headerActions}
					</div>
				}
			/>
			<div className="flex flex-1">
				<SidebarNav groups={navGroups} />
				<main className="flex-1 px-6 py-6">{children}</main>
			</div>
		</div>
	)
}
