import * as React from 'react'
import { type IconName } from '#app/components/ui/icon.tsx'
import { BrandHeader } from '../components/BrandHeader.tsx'
import { SidebarNav } from '../components/SidebarNav.tsx'

interface AppShellProps {
	children: React.ReactNode
}

interface NavItem {
	to: string
	label: string
	icon?: IconName
}

const personalNavItems: NavItem[] = [
	{ to: '/employee/id', label: 'My ID', icon: 'user' },
]

const navGroups = [{ label: 'Personal', items: personalNavItems }]

export function AppShell({ children }: AppShellProps) {
	return (
		<div className="flex min-h-screen flex-col">
			<BrandHeader
				variant="app"
				rightSlot={
					<div className="flex items-center gap-2">
						<SidebarNav groups={navGroups} showDesktopSidebar={false} />
					</div>
				}
			/>
			<div className="flex flex-1">
				<SidebarNav groups={navGroups} />
				<main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
					{children}
				</main>
			</div>
		</div>
	)
}
