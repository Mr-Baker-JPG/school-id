import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { Img } from 'openimg/react'
import * as React from 'react'
import { Link, useFetcher } from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
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
import { NameSchema, UsernameSchema } from '#app/utils/user-validation.ts'

const ProfileFormSchema = z.object({
	name: NameSchema.nullable().default(null),
	username: UsernameSchema,
})

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

const profileUpdateActionIntent = 'update-profile'
const signOutOfSessionsActionIntent = 'sign-out-of-sessions'
const deleteDataActionIntent = 'delete-data'

export function UserSettingsModal({
	open,
	onOpenChange,
	settingsData,
}: UserSettingsModalProps) {
	const [activeSection, setActiveSection] = React.useState<
		'profile' | 'security' | 'danger'
	>('profile')

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			// Reset to profile section when closing
			setActiveSection('profile')
		}
		onOpenChange(newOpen)
	}

	const sections = [
		{ id: 'profile' as const, label: 'Profile', icon: 'user' as const },
		{ id: 'security' as const, label: 'Security', icon: 'lock-closed' as const },
		{ id: 'danger' as const, label: 'Danger Zone', icon: 'cross-1' as const },
	]

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl overflow-visible p-0 gap-0 bg-gradient-to-br from-white via-slate-50/50 to-amber-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
				<DialogHeader className="sr-only">
					<DialogTitle>Account Settings</DialogTitle>
				</DialogHeader>

				{/* Avatar positioned at very top edge of modal */}
				<div className="relative z-10 mx-6 -mb-10 w-fit">
					<div className="relative">
						<div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-brand-gold via-amber-400 to-brand-gold opacity-80 blur-md" />
						<div className="relative size-20 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white">
							<Img
								src={getUserImgSrc(settingsData.user.image?.objectKey)}
								alt={settingsData.user.name ?? settingsData.user.username}
								className="h-full w-full object-cover object-top"
								width={256}
								height={256}
							/>
						</div>
						<Link
							preventScrollReset
							to="/settings/profile/photo"
							onClick={() => handleOpenChange(false)}
							className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-brand-gold text-brand-navy shadow-lg transition-all hover:scale-110 hover:bg-amber-400"
							title="Change photo"
						>
							<Icon name="camera" className="size-4" />
						</Link>
					</div>
				</div>

				{/* Header */}
				<div className="relative bg-gradient-to-r from-brand-navy via-brand-navy to-slate-800 pt-16 pb-6 px-6">
					{/* Decorative pattern */}
					<div className="absolute inset-0 opacity-10">
						<div
							className="absolute inset-0"
							style={{
								backgroundImage: `
									linear-gradient(45deg, transparent 48%, rgba(255,255,255,0.05) 49%, rgba(255,255,255,0.05) 51%, transparent 52%),
									linear-gradient(-45deg, transparent 48%, rgba(255,255,255,0.05) 49%, rgba(255,255,255,0.05) 51%, transparent 52%)
								`,
								backgroundSize: '20px 20px',
							}}
						/>
					</div>

					{/* User info */}
					<div className="relative min-w-0 ml-24">
						<h2 className="text-xl font-semibold text-white truncate tracking-tight">
							{settingsData.user.name ?? settingsData.user.username}
						</h2>
						<p className="text-sm text-brand-gold/80 truncate font-medium">
							{settingsData.user.email}
						</p>
						<div className="mt-2 flex items-center gap-2">
							{settingsData.isTwoFactorEnabled ? (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
									<Icon name="check" className="size-3" />
									2FA Enabled
								</span>
							) : (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
									<Icon name="lock-open-1" className="size-3" />
									2FA Disabled
								</span>
							)}
							{settingsData.hasPassword ? (
									<span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300">
										<Icon name="lock-closed" className="size-3" />
										Password Set
									</span>
								) : null}
							</div>
						</div>

					{/* Section tabs */}
					<div className="mt-6 -mb-px flex gap-1">
						{sections.map((section) => (
							<button
								key={section.id}
								onClick={() => setActiveSection(section.id)}
								className={cn(
									'relative flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-all',
									activeSection === section.id
										? 'bg-white text-brand-navy shadow-sm'
										: 'text-white/70 hover:bg-white/10 hover:text-white',
								)}
							>
								<Icon name={section.icon} className="size-4" />
								{section.label}
							</button>
						))}
					</div>
				</div>

				{/* Content area */}
				<div className="min-h-[300px] p-6 overflow-auto">
					{activeSection === 'profile' && (
						<ProfileSection settingsData={settingsData} />
					)}
					{activeSection === 'security' && (
						<SecuritySection
							settingsData={settingsData}
							onClose={() => handleOpenChange(false)}
						/>
					)}
					{activeSection === 'danger' && (
						<DangerSection settingsData={settingsData} />
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

function ProfileSection({ settingsData }: { settingsData: SettingsUserData }) {
	const fetcher = useFetcher<{ result?: any }>()

	const [form, fields] = useForm({
		id: 'edit-profile',
		constraint: getZodConstraint(ProfileFormSchema),
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ProfileFormSchema })
		},
		defaultValue: {
			username: settingsData.user.username,
			name: settingsData.user.name,
		},
	})

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
					Profile Information
				</h3>
				<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
					Update your display name and username.
				</p>
			</div>

			<fetcher.Form method="POST" action="/settings/profile" {...getFormProps(form)}>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field
						labelProps={{
							htmlFor: fields.username.id,
							children: 'Username',
						}}
						inputProps={{
							...getInputProps(fields.username, { type: 'text' }),
							className: 'bg-white dark:bg-slate-900',
						}}
						errors={fields.username.errors}
					/>
					<Field
						labelProps={{ htmlFor: fields.name.id, children: 'Display Name' }}
						inputProps={{
							...getInputProps(fields.name, { type: 'text' }),
							className: 'bg-white dark:bg-slate-900',
						}}
						errors={fields.name.errors}
					/>
				</div>

				<ErrorList errors={form.errors} id={form.errorId} />

				<div className="mt-6 flex justify-end">
					<StatusButton
						type="submit"
						name="intent"
						value={profileUpdateActionIntent}
						status={
							fetcher.state !== 'idle' ? 'pending' : (form.status ?? 'idle')
						}
						className="bg-brand-navy hover:bg-slate-800"
					>
						Save Changes
					</StatusButton>
				</div>
			</fetcher.Form>
		</div>
	)
}

function SecuritySection({
	settingsData,
	onClose,
}: {
	settingsData: SettingsUserData
	onClose: () => void
}) {
	type IconName = 'envelope-closed' | 'check' | 'lock-open-1' | 'lock-closed' | 'link-2' | 'passkey'

	const securityItems: Array<{
		label: string
		value: string
		href: string
		icon: IconName
		description: string
		variant?: 'success' | 'warning'
	}> = [
		{
			label: 'Email Address',
			value: settingsData.user.email,
			href: '/settings/profile/change-email',
			icon: 'envelope-closed',
			description: 'Change your account email',
		},
		{
			label: 'Two-Factor Authentication',
			value: settingsData.isTwoFactorEnabled ? 'Enabled' : 'Disabled',
			href: '/settings/profile/two-factor',
			icon: settingsData.isTwoFactorEnabled ? 'check' : 'lock-open-1',
			description: settingsData.isTwoFactorEnabled
				? 'Your account is protected'
				: 'Add an extra layer of security',
			variant: settingsData.isTwoFactorEnabled ? 'success' : 'warning',
		},
		{
			label: 'Password',
			value: settingsData.hasPassword ? '••••••••' : 'Not set',
			href: settingsData.hasPassword
				? '/settings/profile/password'
				: '/settings/profile/password/create',
			icon: settingsData.hasPassword ? 'lock-closed' : 'lock-open-1',
			description: settingsData.hasPassword
				? 'Change your password'
				: 'Create a password for your account',
		},
		{
			label: 'Connected Accounts',
			value: 'Manage',
			href: '/settings/profile/connections',
			icon: 'link-2',
			description: 'Manage third-party connections',
		},
		{
			label: 'Passkeys',
			value: 'Manage',
			href: '/settings/profile/passkeys',
			icon: 'passkey',
			description: 'Manage your security keys',
		},
	]

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
					Security Settings
				</h3>
				<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
					Manage your account security and authentication methods.
				</p>
			</div>

			<div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden">
				{securityItems.map((item) => (
					<Link
						key={item.href}
						to={item.href}
						onClick={onClose}
						className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
					>
						<div
							className={cn(
								'flex size-10 items-center justify-center rounded-lg',
								item.variant === 'success'
									? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
									: item.variant === 'warning'
										? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
										: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
							)}
						>
							<Icon name={item.icon} className="size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="font-medium text-slate-900 dark:text-slate-100">
									{item.label}
								</span>
								<span className="text-sm text-slate-500 dark:text-slate-400">
									{item.value}
								</span>
							</div>
							<p className="text-sm text-slate-500 dark:text-slate-400">
								{item.description}
							</p>
						</div>
						<Icon
							name="arrow-right"
							className="size-5 text-slate-400 transition-transform group-hover:translate-x-0.5"
						/>
					</Link>
				))}
			</div>
		</div>
	)
}

function DangerSection({ settingsData }: { settingsData: SettingsUserData }) {
	const dc = useDoubleCheck()
	const sessionsDc = useDoubleCheck()
	const sessionsFetcher = useFetcher()
	const deleteFetcher = useFetcher()
	const otherSessionsCount = settingsData.user._count.sessions - 1

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-base font-semibold text-red-600 dark:text-red-400">
					Danger Zone
				</h3>
				<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
					Irreversible and destructive actions.
				</p>
			</div>

			{/* Sessions */}
			<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
				<div className="flex items-start gap-4">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
						<Icon name="avatar" className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<h4 className="font-medium text-slate-900 dark:text-slate-100">
							Active Sessions
						</h4>
						<p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
							{otherSessionsCount > 0
								? `You have ${otherSessionsCount} other active session${otherSessionsCount > 1 ? 's' : ''}.`
								: 'This is your only active session.'}
						</p>
						{otherSessionsCount > 0 && (
							<sessionsFetcher.Form method="POST" action="/settings/profile" className="mt-3">
								<StatusButton
									{...sessionsDc.getButtonProps({
										type: 'submit',
										name: 'intent',
										value: signOutOfSessionsActionIntent,
									})}
									variant={sessionsDc.doubleCheck ? 'destructive' : 'outline'}
									size="sm"
									status={sessionsFetcher.state !== 'idle' ? 'pending' : 'idle'}
								>
									{sessionsDc.doubleCheck
										? 'Sign out of other sessions?'
										: 'Sign out of other sessions'}
								</StatusButton>
							</sessionsFetcher.Form>
						)}
					</div>
				</div>
			</div>

			{/* Delete data */}
			<div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
				<div className="flex items-start gap-4">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
						<Icon name="trash" className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<h4 className="font-medium text-slate-900 dark:text-slate-100">
							Delete Account
						</h4>
						<p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
							Permanently delete your account and all associated data. This action
							cannot be undone.
						</p>
						<deleteFetcher.Form method="POST" action="/settings/profile" className="mt-3">
							<StatusButton
								{...dc.getButtonProps({
									type: 'submit',
									name: 'intent',
									value: deleteDataActionIntent,
								})}
								variant={dc.doubleCheck ? 'destructive' : 'outline'}
								size="sm"
								status={deleteFetcher.state !== 'idle' ? 'pending' : 'idle'}
							>
								{dc.doubleCheck ? 'Click again to confirm' : 'Delete all data'}
							</StatusButton>
						</deleteFetcher.Form>
					</div>
				</div>
			</div>

			{/* Download data */}
			<div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
				<div className="flex items-start gap-4">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
						<Icon name="download" className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<h4 className="font-medium text-slate-900 dark:text-slate-100">
							Export Your Data
						</h4>
						<p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
							Download a copy of all your personal data.
						</p>
						<Link
							reloadDocument
							download="my-jpg-id-data.json"
							to="/resources/download-user-data"
							className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-navy hover:underline dark:text-brand-gold"
						>
							<Icon name="download" className="size-4" />
							Download data
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}
