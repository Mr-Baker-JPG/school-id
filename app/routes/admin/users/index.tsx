import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useState } from 'react'
import { Form, useNavigation } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card } from '#app/components/ui/card.tsx'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '#app/components/ui/dialog.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { requireSuperAdmin } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/index.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	await requireSuperAdmin(request)

	// Fetch all users with their roles
	const users = await prisma.user.findMany({
		select: {
			id: true,
			email: true,
			username: true,
			name: true,
			roles: {
				select: {
					name: true,
				},
			},
		},
		orderBy: { email: 'asc' },
	})

	return { users }
}

export async function action({ request }: Route.ActionArgs) {
	const currentUserId = await requireSuperAdmin(request)
	const formData = await request.formData()
	const intent = formData.get('intent')
	const userId = formData.get('userId')

	if (!userId || typeof userId !== 'string') {
		return redirectWithToast('/admin/users', {
			type: 'error',
			title: 'Error',
			description: 'User ID is required',
		})
	}

	// Prevent self-demotion
	if (intent === 'remove-admin' && userId === currentUserId) {
		return redirectWithToast('/admin/users', {
			type: 'error',
			title: 'Error',
			description: 'You cannot remove your own admin role',
		})
	}

	if (intent === 'add-admin') {
		await prisma.user.update({
			where: { id: userId },
			data: {
				roles: {
					connect: { name: 'admin' },
				},
			},
		})

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, name: true },
		})

		return redirectWithToast('/admin/users', {
			type: 'success',
			title: 'Admin Role Added',
			description: `${user?.name || user?.email || 'User'} now has admin access`,
		})
	}

	if (intent === 'remove-admin') {
		await prisma.user.update({
			where: { id: userId },
			data: {
				roles: {
					disconnect: { name: 'admin' },
				},
			},
		})

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, name: true },
		})

		return redirectWithToast('/admin/users', {
			type: 'success',
			title: 'Admin Role Removed',
			description: `Admin access removed from ${user?.name || user?.email || 'user'}`,
		})
	}

	return redirectWithToast('/admin/users', {
		type: 'error',
		title: 'Error',
		description: 'Invalid action',
	})
}

export default function AdminUsersRoute({ loaderData }: Route.ComponentProps) {
	const navigation = useNavigation()
	const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
	const [pendingAction, setPendingAction] = useState<{
		userId: string
		userName: string
		userEmail: string
		intent: 'add-admin' | 'remove-admin'
	} | null>(null)

	const isAdmin = (userId: string) => {
		const user = loaderData.users.find((u) => u.id === userId)
		return user?.roles.some((role) => role.name === 'admin') ?? false
	}

	const handleActionClick = (
		userId: string,
		intent: 'add-admin' | 'remove-admin',
	) => {
		const user = loaderData.users.find((u) => u.id === userId)
		if (!user) return

		if (intent === 'remove-admin') {
			setPendingAction({
				userId,
				userName: user.name || user.email,
				userEmail: user.email,
				intent,
			})
			setConfirmDialogOpen(true)
		} else {
			// For add-admin, submit directly (less destructive)
			// We'll use a hidden form that gets submitted
		}
	}

	return (
		<div>
			<PageTitle title="User Management" />

			{/* Confirmation Dialog */}
			{pendingAction && (
				<Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Remove Admin Access</DialogTitle>
							<DialogDescription>
								Are you sure you want to remove admin access from{' '}
								<strong>{pendingAction.userName}</strong> (
								{pendingAction.userEmail})?
							</DialogDescription>
						</DialogHeader>
						<div className="bg-muted/50 border-border rounded-md border p-3 text-sm">
							<p className="text-foreground font-medium">
								This user will lose access to Administration pages.
							</p>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setConfirmDialogOpen(false)
									setPendingAction(null)
								}}
							>
								Cancel
							</Button>
							{pendingAction && (
								<Form method="post">
									<input
										type="hidden"
										name="intent"
										value={pendingAction.intent}
									/>
									<input
										type="hidden"
										name="userId"
										value={pendingAction.userId}
									/>
									<Button type="submit" variant="destructive">
										Remove Admin
									</Button>
								</Form>
							)}
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}

			<div className="mt-6">
				<div className="flex flex-col gap-4">
					{loaderData.users.length > 0 ? (
						<>
							{/* Mobile Card View */}
							<div className="flex flex-col gap-4 md:hidden">
								{loaderData.users.map((user) => {
									const hasAdminRole = isAdmin(user.id)
									const isPending =
										navigation.state === 'submitting' &&
										navigation.formData?.get('userId') === user.id

									return (
										<Card
											key={user.id}
											className="border-muted/50 hover:bg-muted/50 shadow-sm"
										>
											<CardSection>
												<div className="flex flex-col gap-4">
													<div>
														<div className="flex items-center gap-2">
															<span className="text-h4 text-foreground">
																{user.name || user.email}
															</span>
															{hasAdminRole && (
																<StatusBadge variant="active">
																	Admin
																</StatusBadge>
															)}
														</div>
													</div>
													<KeyValueList
														items={[
															{ key: 'Email', value: user.email },
															{
																key: 'Username',
																value: user.username,
															},
															{
																key: 'Name',
																value: user.name || 'Not set',
															},
															{
																key: 'Roles',
																value:
																	user.roles
																		.map((role) => role.name)
																		.join(', ') || 'None',
															},
														]}
													/>
													<div className="pt-2">
														{hasAdminRole ? (
															<StatusButton
																type="button"
																variant="destructive"
																size="sm"
																status={isPending ? 'pending' : 'idle'}
																disabled={isPending}
																onClick={() =>
																	handleActionClick(user.id, 'remove-admin')
																}
															>
																<Icon name="cross-1" className="scale-75" />
																Remove Admin
															</StatusButton>
														) : (
															<Form method="post" className="inline">
																<input
																	type="hidden"
																	name="intent"
																	value="add-admin"
																/>
																<input
																	type="hidden"
																	name="userId"
																	value={user.id}
																/>
																<StatusButton
																	type="submit"
																	variant="default"
																	size="sm"
																	status={isPending ? 'pending' : 'idle'}
																	disabled={isPending}
																>
																	<Icon name="plus" className="scale-75" />
																	Add Admin
																</StatusButton>
															</Form>
														)}
													</div>
												</div>
											</CardSection>
										</Card>
									)
								})}
							</div>

							{/* Desktop Table View */}
							<div className="hidden overflow-x-auto md:block">
								<table className="w-full border-collapse">
									<thead>
										<tr className="border-b">
											<th className="p-2 text-left">Email</th>
											<th className="p-2 text-left">Username</th>
											<th className="p-2 text-left">Name</th>
											<th className="p-2 text-left">Roles</th>
											<th className="p-2 text-left">Actions</th>
										</tr>
									</thead>
									<tbody>
										{loaderData.users.map((user) => {
											const hasAdminRole = isAdmin(user.id)
											const isPending =
												navigation.state === 'submitting' &&
												navigation.formData?.get('userId') === user.id

											return (
												<tr
													key={user.id}
													className="hover:bg-muted/50 border-b"
												>
													<td className="p-2">
														<div className="flex items-center gap-2">
															<span className="text-foreground">
																{user.email}
															</span>
															{hasAdminRole && (
																<StatusBadge variant="active">
																	Admin
																</StatusBadge>
															)}
														</div>
													</td>
													<td className="p-2">{user.username}</td>
													<td className="p-2">
														{user.name || (
															<span className="text-muted-foreground">
																Not set
															</span>
														)}
													</td>
													<td className="p-2">
														{user.roles.map((role) => role.name).join(', ') || (
															<span className="text-muted-foreground">
																None
															</span>
														)}
													</td>
													<td className="p-2">
														{hasAdminRole ? (
															<StatusButton
																type="button"
																variant="destructive"
																size="sm"
																status={isPending ? 'pending' : 'idle'}
																disabled={isPending}
																onClick={() =>
																	handleActionClick(user.id, 'remove-admin')
																}
															>
																<Icon name="cross-1" className="scale-75" />
																Remove Admin
															</StatusButton>
														) : (
															<Form method="post" className="inline">
																<input
																	type="hidden"
																	name="intent"
																	value="add-admin"
																/>
																<input
																	type="hidden"
																	name="userId"
																	value={user.id}
																/>
																<StatusButton
																	type="submit"
																	variant="default"
																	size="sm"
																	status={isPending ? 'pending' : 'idle'}
																	disabled={isPending}
																>
																	<Icon name="plus" className="scale-75" />
																	Add Admin
																</StatusButton>
															</Form>
														)}
													</td>
												</tr>
											)
										})}
									</tbody>
								</table>
							</div>
						</>
					) : (
						<p className="text-muted-foreground">No users found</p>
					)}
				</div>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: ({ error }) => (
					<p>You are not allowed to do that: {error?.data.message}</p>
				),
			}}
		/>
	)
}
