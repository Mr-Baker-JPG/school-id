import * as React from 'react'
import { BrandHeader } from '../components/BrandHeader.tsx'

interface AppShellProps {
	children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
	return (
		<div className="flex min-h-screen flex-col">
			<BrandHeader variant="app" />
			<main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
				{children}
			</main>
		</div>
	)
}
