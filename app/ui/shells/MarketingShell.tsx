import * as React from 'react'
import { BrandHeader } from '../components/BrandHeader.tsx'
import { BrandFooter } from '../components/BrandFooter.tsx'

interface MarketingShellProps {
	children: React.ReactNode
}

export function MarketingShell({ children }: MarketingShellProps) {
	return (
		<div className="flex min-h-screen flex-col">
			<BrandHeader variant="marketing" />
			<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
				{children}
			</main>
			<BrandFooter />
		</div>
	)
}
