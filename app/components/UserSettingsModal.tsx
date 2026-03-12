import { Img } from 'openimg/react'
import * as React from 'react'
import { Link, useFetcher } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '#app/components/ui/dialog.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { cn, getUserImgSrc, useDoubleCheck } from '#app/utils/misc.tsx'

// Define the settings data type inline
interface SettingsUserData {
	user: {
		id: string
		name: string | null
		username: string
		email: string
		image: { objectKey: string } | null
		_count: { sessions: number }
	}
	hasPassword: boolean
	isTwoFactorEnabled: boolean
}

interface UserSettingsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	settingsData: SettingsUserData
}

const signOutOfSessionsActionIntent = 'sign-out-of-sessions'

export function UserSettingsModal({
	open,
	onOpenChange,
	settingsData,
}: UserSettingsModalProps) {
	const handleOpenChange = (newOpen: boolean) => {
		onOpenChange(newOpen)
	}

	const { user, hasPassword, isTwoFactorEnabled } = settingsData
	const otherSessionsCount = user._count.sessions - 1

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-md overflow-visible p-0 gap-0 border-brand-gold/20 bg-[#FDFBF7] dark:bg-slate-950 rounded-xl shadow-2xl">
				<DialogHeader className="sr-only">
					<DialogTitle>Account Settings</DialogTitle>
				</DialogHeader>

				{/* ── Profile Card ── */}
				<div className="relative px-6 pt-7 pb-5 text-center">
					{/* Subtle decorative top border */}
					<div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" />

					<div className="relative mx-auto mb-4 w-fit">
						<div className="size-20 rounded-full border-2 border-brand-gold/30 shadow-md overflow-hidden bg-white dark:bg-slate-900">
							<Img
								src={getUserImgSrc(user.image?.objectKey)}
								alt={user.name ?? user.username}
								className="h-full w-full object-cover object-top"
								width={256}
								height={256}
							/>
						</div>
						<Link
							preventScrollReset
							to="/settings/profile/photo"
							onClick={() => handleOpenChange(false)}
							className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-[#FDFBF7] bg-brand-navy text-white shadow-sm transition-transform hover:scale-110 dark:border-slate-950"
							title="Change photo"
						>
							<Icon name="camera" className="size-3.5" />
						</Link>
					</div>

					<h2 className="font-display text-lg tracking-wide text-brand-navy dark:text-brand-gold">
						{user.name ?? user.username}
					</h2>
					<p className="mt-0.5 font-body text-sm text-slate-500 dark:text-slate-400">
						{user.email}
					</p>
				</div>

				{/* ── Divider ── */}
				<div className="mx-6 border-t border-brand-gold/15" />

				{/* ── Security Items ── */}
				<div className="px-6 py-5 space-y-1">
					<h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-3">
						Security
					</h3>

					<SecurityRow
						icon={isTwoFactorEnabled ? 'check' : 'lock-open-1'}
						label="Two-Factor Auth"
						value={isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
						variant={isTwoFactorEnabled ? 'success' : 'warning'}
						href="/settings/profile/two-factor"
						onNavigate={() => handleOpenChange(false)}
					/>

					<SecurityRow
						icon={hasPassword ? 'lock-closed' : 'lock-open-1'}
						label="Password"
						value={hasPassword ? '••••••••' : 'Not set'}
						variant={hasPassword ? 'neutral' : 'warning'}
						href={
							hasPassword
								? '/settings/profile/password'
								: '/settings/profile/password/create'
						}
						onNavigate={() => handleOpenChange(false)}
					/>

					<SecurityRow
						icon="link-2"
						label="Connected Accounts"
						href="/settings/profile/connections"
						onNavigate={() => handleOpenChange(false)}
					/>

					<SecurityRow
						icon="passkey"
						label="Passkeys"
						href="/settings/profile/passkeys"
						onNavigate={() => handleOpenChange(false)}
					/>
				</div>

				{/* ── Sessions ── */}
				{otherSessionsCount > 0 && (
					<>
						<div className="mx-6 border-t border-brand-gold/15" />
						<SessionsSection
							otherSessionsCount={otherSessionsCount}
						/>
					</>
				)}

				{/* Bottom spacing */}
				<div className="h-2" />
			</DialogContent>
		</Dialog>
	)
}

/* ────────────────────────────────────────────── */

type IconName =
	| 'check'
	| 'lock-open-1'
	| 'lock-closed'
	| 'link-2'
	| 'passkey'

function SecurityRow({
	icon,
	label,
	value,
	variant = 'neutral',
	href,
	onNavigate,
}: {
	icon: IconName
	label: string
	value?: string
	variant?: 'success' | 'warning' | 'neutral'
	href: string
	onNavigate: () => void
}) {
	return (
		<Link
			to={href}
			onClick={onNavigate}
			className="group flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-1 transition-colors hover:bg-brand-navy/[0.04] dark:hover:bg-white/[0.04]"
		>
			<div
				className={cn(
					'flex size-8 items-center justify-center rounded-md',
					variant === 'success'
						? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
						: variant === 'warning'
							? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
							: 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
				)}
			>
				<Icon name={icon} className="size-4" />
			</div>

			<div className="flex-1 min-w-0">
				<span className="font-body text-sm font-medium text-slate-800 dark:text-slate-200">
					{label}
				</span>
			</div>

			{value && (
				<span
					className={cn(
						'font-body text-xs',
						variant === 'success'
							? 'text-emerald-600 dark:text-emerald-400'
							: variant === 'warning'
								? 'text-amber-600 dark:text-amber-400'
								: 'text-slate-400 dark:text-slate-500',
					)}
				>
					{value}
				</span>
			)}

			<Icon
				name="arrow-right"
				className="size-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400 dark:text-slate-600"
			/>
		</Link>
	)
}

function SessionsSection({
	otherSessionsCount,
}: {
	otherSessionsCount: number
}) {
	const dc = useDoubleCheck()
	const sessionsFetcher = useFetcher()

	return (
		<div className="px-6 py-5">
			<h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-3">
				Sessions
			</h3>

			<div className="flex items-center gap-3 rounded-lg bg-amber-50/60 border border-amber-200/40 px-3 py-3 dark:bg-amber-950/20 dark:border-amber-800/30">
				<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
					<Icon name="avatar" className="size-4" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="font-body text-sm text-slate-700 dark:text-slate-300">
						{otherSessionsCount} other active session{otherSessionsCount > 1 ? 's' : ''}
					</p>
				</div>
				<sessionsFetcher.Form method="POST" action="/settings/profile">
					<StatusButton
						{...dc.getButtonProps({
							type: 'submit',
							name: 'intent',
							value: signOutOfSessionsActionIntent,
						})}
						variant={dc.doubleCheck ? 'destructive' : 'outline'}
						size="sm"
						status={sessionsFetcher.state !== 'idle' ? 'pending' : 'idle'}
						className="text-xs h-7 px-2.5"
					>
						{dc.doubleCheck ? 'Confirm?' : 'Sign out'}
					</StatusButton>
				</sessionsFetcher.Form>
			</div>
		</div>
	)
}
