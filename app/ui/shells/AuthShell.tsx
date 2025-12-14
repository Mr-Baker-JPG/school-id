import * as React from 'react'
import { Img } from 'openimg/react'
import { SCHOOL_NAME, HEADER_LOGO_SRC } from '../brand.ts'
import { Card } from '#app/components/ui/card.tsx'

interface AuthShellProps {
	children: React.ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
	return (
		<div className="bg-muted/20 flex min-h-screen flex-col items-center justify-center px-4 py-10">
			<div className="mx-auto w-full max-w-md">
				<div className="mb-6 flex flex-col items-center gap-3">
					<Img
						src={HEADER_LOGO_SRC}
						alt={SCHOOL_NAME}
						className="h-12 w-auto object-contain"
						width={128}
						height={48}
					/>
					<h1 className="text-h3 text-center">{SCHOOL_NAME}</h1>
				</div>
				<Card className="bg-card rounded-xl border p-6 shadow-sm">
					{children}
				</Card>
			</div>
		</div>
	)
}
