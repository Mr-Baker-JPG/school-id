import { Img } from 'openimg/react'
import * as React from 'react'
import { Form, Link, useFetcher, useRouteLoaderData } from 'react-router'
import { UserSettingsModal } from '#app/components/UserSettingsModal.tsx'
import { Button } from '#app/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Dialog, DialogContent } from '#app/components/ui/dialog.tsx'
import { cn } from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user.ts'
import { APP_NAME, HEADER_LOGO_SRC, headerAccent, LOGO_SRC } from '../brand.ts'
import { type loader as rootLoader } from '#app/root.tsx'

interface BrandHeaderProps {
	variant?: 'marketing' | 'app' | 'admin'
	rightSlot?: React.ReactNode
	className?: string
}

function usePersonType() {
	const data = useRouteLoaderData<typeof rootLoader>('root')
	return data?.personType ?? null
}

function getHomePath(personType: 'admin' | 'employee' | 'student' | null): string {
	switch (personType) {
		case 'admin':
			return '/admin'
		case 'employee':
			return '/employee/id'
		case 'student':
			return '/student/id'
		default:
			return '/'
	}
}

export function BrandHeader({
	variant = 'marketing',
	rightSlot,
	className,
}: BrandHeaderProps) {
	const user = useOptionalUser()
	const personType = usePersonType()
	const homePath = getHomePath(personType)
	const formRef = React.useRef<HTMLFormElement>(null)
	const [settingsOpen, setSettingsOpen] = React.useState(false)
	const settingsFetcher = useFetcher()

	// Fetch settings data when modal opens
	React.useEffect(() => {
		if (settingsOpen && settingsFetcher.state === 'idle' && !settingsFetcher.data) {
			settingsFetcher.load('/resources/user-settings')
		}
	}, [settingsOpen, settingsFetcher])

	return (
		<>
			<header
				className={cn(
					'w-full shrink-0 bg-brand-navy',
					headerAccent,
					className,
				)}
			>
				<div className="flex h-14 items-center justify-between px-4">
					<Link to={homePath} className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-full bg-[#F5F2EB] shadow-sm">
							<Img
								src={LOGO_SRC}
								alt={APP_NAME}
								className="h-7 w-auto object-contain"
								width={64}
								height={64}
							/>
						</div>
						<span className="font-display text-sm font-semibold tracking-wide text-brand-gold md:text-base">
							{APP_NAME}
						</span>
					</Link>

					<div className="flex items-center gap-2">
						{rightSlot}

						{user && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="text-brand-gold/70 hover:bg-white/10 hover:text-brand-gold"
									>
										<Icon name="avatar" />
										<span className="sr-only">User menu</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									side="left"
									sideOffset={98}
									avoidCollisions={false}
								>
									<DropdownMenuLabel className="font-body">
										{user.name || 'User'}
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => setSettingsOpen(true)}
										className="font-body cursor-pointer"
									>
										<Icon className="text-body-md mr-2" name="settings">
											Settings
										</Icon>
									</DropdownMenuItem>
									<Form action="/logout" method="POST" ref={formRef}>
										<DropdownMenuItem asChild>
											<button type="submit" className="w-full font-body">
												<Icon className="text-body-md" name="exit">
													Logout
												</Icon>
											</button>
										</DropdownMenuItem>
									</Form>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</div>
			</header>

			{/* Settings Modal */}
			{settingsFetcher.data ? (
				<UserSettingsModal
					open={settingsOpen}
					onOpenChange={setSettingsOpen}
					settingsData={settingsFetcher.data as any}
				/>
			) : settingsOpen ? (
				<Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
					<DialogContent className="max-w-md overflow-visible p-0 gap-0 border-brand-gold/20 bg-[#FDFBF7] dark:bg-slate-950 rounded-xl">
						<div className="flex items-center justify-center py-20">
							<div className="flex flex-col items-center gap-3">
								<div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-gold/40 border-t-brand-gold" />
								<p className="font-body text-sm text-slate-400">Loading…</p>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			) : null}
		</>
	)
}
