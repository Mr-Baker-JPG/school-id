import * as React from 'react'
import { type IconName } from '#app/components/ui/icon.tsx'
import { BrandHeader } from '../components/BrandHeader.tsx'
import {
	CollapsibleSidebar,
	MobileSidebarTrigger,
} from '../components/CollapsibleSidebar.tsx'

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
		<div className="flex h-screen flex-col overflow-hidden">
			<BrandHeader
				variant="app"
				rightSlot={
					<div className="flex items-center gap-2">
						<MobileSidebarTrigger groups={navGroups} />
					</div>
				}
			/>
			<div className="flex min-h-0 flex-1">
				<CollapsibleSidebar groups={navGroups} />
				<main className="mx-auto w-full max-w-5xl min-h-0 flex-1 overflow-y-auto px-4 py-8">
					{children}
				</main>
			</div>
		</div>
	)
}
