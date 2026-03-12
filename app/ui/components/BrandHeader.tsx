import { Img } from 'openimg/react'
import * as React from 'react'
import { Form, Link } from 'react-router'
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
import { cn } from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user.ts'
import { APP_NAME, HEADER_LOGO_SRC, headerAccent, LOGO_SRC } from '../brand.ts'

interface BrandHeaderProps {
	variant?: 'marketing' | 'app' | 'admin'
	rightSlot?: React.ReactNode
	className?: string
}

export function BrandHeader({
	variant = 'marketing',
	rightSlot,
	className,
}: BrandHeaderProps) {
	const user = useOptionalUser()
	const formRef = React.useRef<HTMLFormElement>(null)

	return (
		<header
			className={cn(
				'w-full shrink-0',
				headerAccent,
				className,
			)}
		>
			<div className="flex h-16 items-center justify-between px-4">
				<Link to="/" className="flex items-center gap-3">
					<Img
						src={HEADER_LOGO_SRC}
						alt={APP_NAME}
						className="hidden h-8 w-auto object-contain md:block"
						width={128}
						height={32}
					/>
					<Img
						src={LOGO_SRC}
						alt={APP_NAME}
						className="block h-6 w-auto object-contain md:hidden"
						width={64}
						height={64}
					/>
					<span className="md:text-h4 text-lg font-semibold">
						{APP_NAME}
					</span>
				</Link>

				<div className="flex items-center gap-2">
					{rightSlot}

					{user && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon">
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
								<DropdownMenuLabel>
									{user.name || 'User'}
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link to="/settings/profile">Settings</Link>
								</DropdownMenuItem>
								<Form action="/logout" method="POST" ref={formRef}>
									<DropdownMenuItem asChild>
										<button type="submit" className="w-full">
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
	)
}
