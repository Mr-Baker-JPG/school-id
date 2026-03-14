import * as React from 'react'
import { Img } from 'openimg/react'
import { Link, useRouteLoaderData } from 'react-router'
import { Icon } from '#app/components/ui/icon.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { cn } from '#app/utils/misc.tsx'
import { LOGO_SRC } from '#app/ui/brand.ts'
import { type loader as rootLoader } from '#app/root.tsx'

interface DossierHeaderProps {
	/** Person's full name */
	name: string
	/** e.g. "Upper School Math Teacher · jdoe@school.org" */
	subtitle: string
	/** e.g. "Employee · Faculty" or "Student · Grade 10" */
	typeLabel: string
	/** Photo URL (null = show placeholder) */
	photoUrl: string | null
	/** Name used for alt text */
	photoAlt: string
	/** Status: 'active' | 'inactive' */
	status: string
	/** Is the ID currently valid? */
	idValid?: boolean
	/** Extra stamps (e.g. "Faculty", "Name Edited") */
	extraStamps?: Array<{
		label: string
		variant: 'active' | 'inactive' | 'expiring' | 'expired' | 'school'
	}>
	/** Photo action buttons */
	photoActions?: React.ReactNode
	/** Primary action buttons (download, edit) */
	actions?: React.ReactNode
	className?: string
}

export function DossierHeader({
	name,
	subtitle,
	typeLabel,
	photoUrl,
	photoAlt,
	status,
	idValid,
	extraStamps,
	photoActions,
	actions,
	className,
}: DossierHeaderProps) {
	const rootData = useRouteLoaderData<typeof rootLoader>('root')
	const logoSrc = rootData?.schoolConfig?.logoUrl || LOGO_SRC

	return (
		<div
			className={cn(
				'relative grid grid-cols-1 items-start gap-6 border-b-2 border-primary pb-6 sm:grid-cols-[160px_1fr]',
				className,
			)}
		>
			{/* Gold accent line under the navy border */}
			<div className="absolute -bottom-1 left-0 right-0 h-px bg-brand-gold" />

			{/* Watermark crest */}
			<div className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 opacity-[0.04] sm:block">
				<img
					src={logoSrc}
					alt=""
					aria-hidden="true"
					className="h-44 w-44 object-contain"
				/>
			</div>

			{/* Photo */}
			<div className="group relative mx-auto h-[200px] w-[160px] overflow-hidden border-2 border-primary bg-secondary shadow-sm sm:mx-0">
				{/* Gold inner border */}
				<div className="pointer-events-none absolute inset-[3px] z-10 border border-brand-gold/35" />
				{photoUrl ? (
					<Img
						src={photoUrl}
						alt={photoAlt}
						className="h-full w-full object-cover"
						width={160}
						height={200}
					/>
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
						<Icon name="avatar" className="size-10 opacity-30" />
						<span className="font-mono text-[0.65rem] uppercase tracking-[0.1em]">
							No Photo
						</span>
					</div>
				)}
				{/* Photo action overlay */}
				{photoActions && (
					<div className="absolute inset-x-0 bottom-0 z-20 flex gap-px">
						{photoActions}
					</div>
				)}
			</div>

			{/* Info */}
			<div className="pt-0.5 text-center sm:text-left">
				<span className="mb-2 inline-block bg-primary px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-brand-gold">
					{typeLabel}
				</span>
				<h1 className="mb-1 font-display text-[2rem] font-semibold leading-tight text-primary">
					{name}
				</h1>
				<p className="mb-3 text-base italic text-muted-foreground">{subtitle}</p>

				{/* Stamps */}
				<div className="mb-4 flex flex-wrap justify-center gap-2 sm:justify-start">
					<StatusBadge variant={status === 'active' ? 'active' : 'inactive'}>
						{status}
					</StatusBadge>
					{idValid !== undefined && (
						<StatusBadge variant={idValid ? 'valid' : 'expired'}>
							{idValid ? 'ID Valid' : 'ID Expired'}
						</StatusBadge>
					)}
					{extraStamps?.map((stamp) => (
						<StatusBadge key={stamp.label} variant={stamp.variant === 'school' ? 'active' : stamp.variant}>
							{stamp.label}
						</StatusBadge>
					))}
				</div>

				{/* Actions */}
				{actions && (
					<div className="flex flex-wrap justify-center gap-2 sm:justify-start">
						{actions}
					</div>
				)}
			</div>
		</div>
	)
}
