import * as React from 'react'
import { Img } from 'openimg/react'
import { useRouteLoaderData } from 'react-router'
import { SCHOOL_NAME, CREST_SRC } from '../brand.ts'
import { type loader as rootLoader } from '#app/root.tsx'

interface AuthShellProps {
	children: React.ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
	const rootData = useRouteLoaderData<typeof rootLoader>('root')
	const crestSrc = rootData?.schoolConfig?.crestUrl || CREST_SRC
	const schoolName = rootData?.schoolConfig?.schoolName || SCHOOL_NAME

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 font-body">
			{/* Subtle crosshatch background — matches landing page */}
			<div className="pointer-events-none fixed inset-0 opacity-[0.025]">
				<div
					className="h-full w-full"
					style={{
						backgroundImage:
							'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
						backgroundSize: '24px 24px',
					}}
				/>
			</div>

			<div className="relative z-10 mx-auto w-full max-w-sm">
				{/* Crest + school name */}
				<div className="mb-8 flex flex-col items-center gap-4">
					<div className="flex size-20 items-center justify-center">
						<Img
							src={crestSrc}
							alt={schoolName}
							className="h-full w-auto object-contain drop-shadow-sm"
							width={80}
							height={80}
						/>
					</div>
					<div className="text-center">
						<h1 className="font-display text-lg font-bold tracking-wide text-primary">
							{schoolName}
						</h1>
						<div className="mx-auto mt-2 h-px w-10 bg-brand-gold/50" />
					</div>
				</div>

				{/* Card */}
				<div className="relative border border-border bg-card shadow-sm">
					{/* Gold accent top edge */}
					<div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-brand-gold to-transparent" />
					<div className="p-6 pt-7">{children}</div>
				</div>

				{/* Footer mark */}
				<p className="mt-6 text-center font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/40">
					Authorized Access Only
				</p>
			</div>
		</div>
	)
}
