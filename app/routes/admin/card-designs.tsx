import { useEffect, useRef, useState } from 'react'
import { type Route } from './+types/card-designs.ts'
import { requireAdmin } from '#app/utils/auth.server.ts'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { getCurrentAcademicYear } from '#app/utils/employee.server.ts'
import { getActiveCardDesignId, setActiveCardDesignId } from '#app/utils/system-settings.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { DESIGNS, type CardDesignProps } from '#app/components/id-card-designs.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { data } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	await requireAdmin(request)
	const branding = getBrandingConfig()
	const academicYear = getCurrentAcademicYear()
	const activeDesignId = await getActiveCardDesignId()
	return { branding, academicYear, activeDesignId }
}

export async function action({ request }: Route.ActionArgs) {
	await requireAdmin(request)
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'select-design') {
		const designId = Number(formData.get('designId'))
		const design = DESIGNS.find((d) => d.id === designId)
		if (!design) {
			return data({ error: 'Invalid design' }, { status: 400 })
		}
		await setActiveCardDesignId(designId)
		return redirectWithToast('/admin/card-designs', {
			type: 'success',
			title: 'Design Updated',
			description: `"${design.name}" is now the active ID card design.`,
		})
	}

	return data({ error: 'Unknown intent' }, { status: 400 })
}

export default function CardDesignsPage({ loaderData }: Route.ComponentProps) {
	const { branding, academicYear, activeDesignId } = loaderData
	const [hoveredId, setHoveredId] = useState<number | null>(null)
	const [showingBack, setShowingBack] = useState<Record<number, boolean>>({})
	const activeRef = useRef<HTMLDivElement>(null)

	const sampleProps: CardDesignProps = {
		fullName: 'Samantha Marie Baker',
		personType: 'FACULTY',
		sisId: '100247',
		academicYear,
		photoUrl: null,
		logoUrl: branding.logoUrl ?? null,
		schoolName: branding.schoolName,
		qrCodeDataURL: undefined,
	}

	const toggleFace = (id: number) => {
		setShowingBack((prev) => ({ ...prev, [id]: !prev[id] }))
	}

	// Scroll active design into view on mount
	useEffect(() => {
		activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}, [])

	return (
		<div className="h-full overflow-y-auto">
			{/* Hero header */}
			<div className="relative overflow-hidden border-b border-neutral-200 bg-gradient-to-br from-slate-50 via-white to-stone-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:border-slate-800">
				{/* Decorative grid pattern */}
				<div
					className="pointer-events-none absolute inset-0 opacity-[0.03]"
					style={{
						backgroundImage: `
							linear-gradient(to right, currentColor 1px, transparent 1px),
							linear-gradient(to bottom, currentColor 1px, transparent 1px)
						`,
						backgroundSize: '24px 24px',
					}}
				/>
				<div className="relative px-8 pb-8 pt-10">
					<div className="flex items-start justify-between">
						<div>
							<p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
								Design System
							</p>
							<h1
								className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
								style={{ fontFamily: "'Georgia', 'Cambria', serif" }}
							>
								ID Card Designs
							</h1>
							<p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">
								Choose the official card layout for all printed IDs.
								The active design is used when generating PDFs for employees and students.
							</p>
						</div>
						<a
							href="/resources/card-design-sample-pdf"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
						>
							<Icon name="download" className="h-4 w-4" />
							Print Sample PDF
						</a>
					</div>
				</div>
			</div>

			{/* Design grid */}
			<div className="px-8 py-8">
				<div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
					{DESIGNS.map((d) => {
						const isActive = d.id === activeDesignId
						const isHovered = hoveredId === d.id
						const isBack = showingBack[d.id] ?? false

						return (
							<div
								key={d.id}
								ref={isActive ? activeRef : undefined}
								className={`
									group relative rounded-2xl border-2 transition-all duration-300
									${isActive
										? 'border-amber-400 bg-amber-50/30 shadow-lg shadow-amber-100/50 dark:border-amber-500 dark:bg-amber-950/20 dark:shadow-amber-900/20'
										: isHovered
											? 'border-slate-300 bg-white shadow-md dark:border-slate-600 dark:bg-slate-800/80'
											: 'border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800/40'
									}
								`}
								onMouseEnter={() => setHoveredId(d.id)}
								onMouseLeave={() => setHoveredId(null)}
							>
								{/* Active badge */}
								{isActive && (
									<div className="absolute -top-3 left-5 z-10 flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
										<Icon name="check" className="h-3 w-3" />
										Active
									</div>
								)}

								{/* Card header */}
								<div className="flex items-start justify-between px-5 pb-3 pt-5">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
												{d.id}
											</span>
											<h2
												className="truncate text-lg font-semibold text-slate-900 dark:text-white"
												style={{ fontFamily: "'Georgia', 'Cambria', serif" }}
											>
												{d.name}
											</h2>
										</div>
										<p className="mt-1 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
											{d.desc}
										</p>
									</div>
								</div>

								{/* Card preview area */}
								<div className="relative mx-5 mb-4 overflow-hidden rounded-xl bg-slate-100/80 p-6 dark:bg-slate-900/60">
									{/* Subtle dot pattern */}
									<div
										className="pointer-events-none absolute inset-0 opacity-[0.04]"
										style={{
											backgroundImage: 'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)',
											backgroundSize: '12px 12px',
										}}
									/>

									{/* Card with flip */}
									<div className="relative flex justify-center">
										<div
											className="cursor-pointer transition-transform duration-500"
											style={{
												perspective: '1000px',
												transformStyle: 'preserve-3d',
											}}
											onClick={() => toggleFace(d.id)}
											title="Click to flip"
										>
											<div
												className="relative transition-opacity duration-300"
												style={{ opacity: isBack ? 0 : 1, pointerEvents: isBack ? 'none' : 'auto' }}
											>
												<d.Front {...sampleProps} />
											</div>
											{isBack && (
												<div className="transition-opacity duration-300">
													<d.Back {...sampleProps} />
												</div>
											)}
										</div>

										{/* Flip hint */}
										<button
											onClick={() => toggleFace(d.id)}
											className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-medium text-slate-400 shadow-sm backdrop-blur transition-all hover:bg-white hover:text-slate-600 hover:shadow dark:bg-slate-800/90 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
										>
											{isBack ? '← Front' : 'Back →'}
										</button>
									</div>
								</div>

								{/* Actions */}
								<div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 dark:border-slate-700/50">
									{isActive ? (
										<span className="text-sm font-medium text-amber-600 dark:text-amber-400">
											Currently in use
										</span>
									) : (
										<form method="post">
											<input type="hidden" name="intent" value="select-design" />
											<input type="hidden" name="designId" value={d.id} />
											<button
												type="submit"
												className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
											>
												Set as Active
											</button>
										</form>
									)}

									<a
										href={`/resources/card-design-sample-pdf?design=${d.id}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
									>
										<Icon name="file-text" className="h-3.5 w-3.5" />
										PDF Preview
									</a>
								</div>
							</div>
						)
					})}
				</div>

				{/* Info footer */}
				<div className="mt-10 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 dark:border-slate-700 dark:bg-slate-800/30">
					<div className="flex gap-4">
						<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200/80 dark:bg-slate-700">
							<Icon name="pencil-1" className="h-5 w-5 text-slate-500 dark:text-slate-400" />
						</div>
						<div>
							<h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
								About Card Designs
							</h3>
							<p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
								All designs use the school's official navy and maroon palette with consistent branding.
								The active design applies to all newly generated employee and student ID PDFs.
								Existing printed cards are not affected until reprinted.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
