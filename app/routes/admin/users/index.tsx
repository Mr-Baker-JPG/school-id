import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, useNavigation } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Card } from '#app/components/ui/card.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { KeyValueList } from '#app/ui/components/KeyValueList.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { StatusBadge } from '#app/ui/components/StatusBadge.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { requireSuperAdmin } from '#app/utils/auth.server.ts'
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

	const isAdmin = (userId: string) => {
		const user = loaderData.users.find((u) => u.id === userId)
		return user?.roles.some((role) => role.name === 'admin') ?? false
	}

	return (
		<div>
			<PageTitle title="User Management" />

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
										<Card key={user.id} className="hover:bg-muted/50">
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
														<Form method="post" className="inline">
															<input
																type="hidden"
																name="intent"
																value={
																	hasAdminRole ? 'remove-admin' : 'add-admin'
																}
															/>
															<input
																type="hidden"
																name="userId"
																value={user.id}
															/>
															<StatusButton
																type="submit"
																variant={
																	hasAdminRole ? 'destructive' : 'default'
																}
																size="sm"
																status={isPending ? 'pending' : 'idle'}
																disabled={isPending}
															>
																<Icon
																	name={hasAdminRole ? 'cross-1' : 'plus'}
																	className="scale-75"
																/>
																{hasAdminRole ? 'Remove Admin' : 'Add Admin'}
															</StatusButton>
														</Form>
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
														<Form method="post" className="inline">
															<input
																type="hidden"
																name="intent"
																value={
																	hasAdminRole ? 'remove-admin' : 'add-admin'
																}
															/>
															<input
																type="hidden"
																name="userId"
																value={user.id}
															/>
															<StatusButton
																type="submit"
																variant={
																	hasAdminRole ? 'destructive' : 'default'
																}
																size="sm"
																status={isPending ? 'pending' : 'idle'}
																disabled={isPending}
															>
																<Icon
																	name={hasAdminRole ? 'cross-1' : 'plus'}
																	className="scale-75"
																/>
																{hasAdminRole ? 'Remove Admin' : 'Add Admin'}
															</StatusButton>
														</Form>
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
