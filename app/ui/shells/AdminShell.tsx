import * as React from 'react'
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

	const personalNavItems: NavItem[] = [
		{ to: '/employee/id', label: 'My ID', icon: 'avatar' },
	]

	const adminNavItems: NavItem[] = isAdmin
		? [
				{ to: '/admin', label: 'Dashboard', icon: 'laptop' },
				{ to: '/admin/employees', label: 'Employees', icon: 'user' },
				{ to: '/admin/students', label: 'Students', icon: 'pencil-2' },
				{ to: '/admin/print', label: 'Print IDs', icon: 'file-text' },
				{ to: '/admin/users', label: 'Users', icon: 'lock-closed' },
				{ to: '/admin/sync-status', label: 'Sync Status', icon: 'cloud-sync' },
				{ to: '/admin/signatures/templates', label: 'Signatures', icon: 'mail' },
				{ to: '/admin/card-designs', label: 'Card Designs', icon: 'pencil-1' },
				{ to: '/admin/cache', label: 'Cache', icon: 'settings' },
			]
		: []

	const navGroups: NavGroup[] = [
		{ label: 'Personal', items: personalNavItems },
		...(isAdmin
			? [
					{
						label: 'People',
						items: [
							adminNavItems[0]!, // Dashboard
							adminNavItems[1]!, // Employees
							adminNavItems[2]!, // Students
						],
					},
					{
						label: 'Tools',
						items: [
							adminNavItems[3]!, // Print IDs
							adminNavItems[6]!, // Signatures
							adminNavItems[7]!, // Card Designs
						],
					},
					{
						label: 'System',
						items: [
							adminNavItems[4]!, // Users
							adminNavItems[5]!, // Sync Status
							adminNavItems[8]!, // Cache
						],
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
				<main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
			</div>
		</div>
	)
}
