import * as React from 'react'
import { Form, Link } from 'react-router'
import { Img } from 'openimg/react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { APP_NAME, LOGO_SRC, headerAccent } from '../brand.ts'
import { cn } from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user.ts'

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
		<header className={cn('w-full', headerAccent, className)}>
			<div className="container flex h-16 items-center justify-between px-4">
				<Link to="/" className="flex items-center gap-3">
					<Img
						src={LOGO_SRC}
						alt={APP_NAME}
						className="h-8 w-auto object-contain"
						width={128}
						height={32}
					/>
					<span className="text-h4 font-semibold">{APP_NAME}</span>
				</Link>

				<div className="flex items-center gap-4">
					{(variant === 'app' || variant === 'admin') && (
						<nav className="hidden items-center gap-4 md:flex">
							{variant === 'app' && (
								<>
									<Link
										to="/employee/id"
										className="text-body-sm hover:text-foreground text-muted-foreground transition-colors"
									>
										My ID
									</Link>
									<Link
										to="/settings/profile"
										className="text-body-sm hover:text-foreground text-muted-foreground transition-colors"
									>
										Settings
									</Link>
								</>
							)}
							{variant === 'admin' && (
								<>
									<Link
										to="/employee/id"
										className="text-body-sm hover:text-foreground text-muted-foreground transition-colors"
									>
										My ID
									</Link>
									<Link
										to="/admin/employees"
										className="text-body-sm hover:text-foreground text-muted-foreground transition-colors"
									>
										Employees
									</Link>
									<Link
										to="/admin/sync-status"
										className="text-body-sm hover:text-foreground text-muted-foreground transition-colors"
									>
										Sync Status
									</Link>
								</>
							)}
						</nav>
					)}

					{rightSlot}

					{user && (
						<DropdownMenu modal={true}>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon">
									<Icon name="avatar" />
									<span className="sr-only">User menu</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								onCloseAutoFocus={(e) => e.preventDefault()}
							>
								<DropdownMenuLabel>{user.name || 'User'}</DropdownMenuLabel>
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
