import * as React from 'react'
import { BrandHeader } from '../components/BrandHeader.tsx'
import { SidebarNav } from '../components/SidebarNav.tsx'
import { IconName } from '#app/components/ui/icon.tsx'

interface AdminShellProps {
	children: React.ReactNode
	headerActions?: React.ReactNode
}

interface NavItem {
	to: string
	label: string
	icon?: IconName
}

const adminNavItems: NavItem[] = [
	{ to: '/admin/employees', label: 'Employees', icon: 'user' },
	{ to: '/admin/sync-status', label: 'Sync Status', icon: 'cloud-sync' },
	{ to: '/admin/cache', label: 'Cache', icon: 'settings' },
]

export function AdminShell({ children, headerActions }: AdminShellProps) {
	return (
		<div className="flex min-h-screen flex-col">
			<BrandHeader
				variant="admin"
				rightSlot={
					<div className="flex items-center gap-2">
						<SidebarNav items={adminNavItems} showDesktopSidebar={false} />
						{headerActions}
					</div>
				}
			/>
			<div className="flex flex-1">
				<SidebarNav items={adminNavItems} />
				<main className="flex-1 px-6 py-6">{children}</main>
			</div>
		</div>
	)
}
