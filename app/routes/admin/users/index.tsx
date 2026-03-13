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

	// Fetch all employees (faculty/staff) with their User records if they exist
	const employees = await prisma.employee.findMany({
		select: {
			id: true,
			sisEmployeeId: true,
			firstName: true,
			lastName: true,
			fullName: true,
			jobTitle: true,
			email: true,
			status: true,
		},
		orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
	})

	// Get all users with admin role info
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
	})

	// Create a map of email -> user for quick lookup
	const userMap = new Map(users.map((user) => [user.email.toLowerCase(), user]))

	// Combine employee data with user/admin status
	const employeesWithUserStatus = employees.map((employee) => {
		const user = userMap.get(employee.email.toLowerCase())
		return {
			...employee,
			userId: user?.id ?? null,
			username: user?.username ?? null,
			userName: user?.name ?? null,
			isAdmin: user?.roles.some((role) => role.name === 'admin') ?? false,
			hasAccount: !!user,
		}
	})

	return { employees: employeesWithUserStatus }
}

// Generate a unique username from email
async function generateUniqueUsername(email: string): Promise<string> {
	// Extract username from email (part before @)
	const baseUsername = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
	
	// Check if username exists
	let username = baseUsername
	let counter = 1
	
	while (await prisma.user.findUnique({ where: { username } })) {
		username = `${baseUsername}${counter}`
		counter++
	}
	
	return username
}

export async function action({ request }: Route.ActionArgs) {
	const currentUserId = await requireSuperAdmin(request)
	const formData = await request.formData()
	const intent = formData.get('intent')
	const userId = formData.get('userId')
	const employeeEmail = formData.get('employeeEmail')

	if (!employeeEmail || typeof employeeEmail !== 'string') {
		return redirectWithToast('/admin/users', {
			type: 'error',
			title: 'Error',
			description: 'Employee email is required',
		})
	}

	// Create account for employee who doesn't have one
	if (intent === 'create-account') {
		// Check if user already exists
		const existingUser = await prisma.user.findUnique({
			where: { email: employeeEmail },
		})

		if (existingUser) {
			return redirectWithToast('/admin/users', {
				type: 'error',
				title: 'Error',
				description: 'User account already exists for this email.',
			})
		}

		// Get employee info for the name
		const employee = await prisma.employee.findUnique({
			where: { email: employeeEmail },
			select: { firstName: true, lastName: true, fullName: true },
		})

		// Generate unique username
		const username = await generateUniqueUsername(employeeEmail)

		// Create the user account
		const newUser = await prisma.user.create({
			data: {
				email: employeeEmail,
				username,
				name: employee ? `${employee.firstName} ${employee.lastName}` : null,
			},
		})

		return redirectWithToast('/admin/users', {
			type: 'success',
			title: 'Account Created',
			description: `Account created for ${newUser.name || newUser.email}. They can now log in with Google.`,
		})
	}

	// For add-admin, we need to find the user
	if (intent === 'add-admin') {
		// Find the user by email
		const user = await prisma.user.findUnique({
			where: { email: employeeEmail },
			select: { id: true, email: true, name: true },
		})

		if (!user) {
			return redirectWithToast('/admin/users', {
				type: 'error',
				title: 'Error',
				description:
					'User account not found. Create an account first.',
			})
		}

		// Prevent self-promotion (shouldn't happen but safety check)
		if (user.id === currentUserId) {
			return redirectWithToast('/admin/users', {
				type: 'error',
				title: 'Error',
				description: 'You cannot modify your own admin role',
			})
		}

		await prisma.user.update({
			where: { id: user.id },
			data: {
				roles: {
					connect: { name: 'admin' },
				},
			},
		})

		return redirectWithToast('/admin/users', {
			type: 'success',
			title: 'Admin Role Added',
			description: `${user.name || user.email} now has admin access`,
		})
	}

	if (intent === 'remove-admin') {
		if (!userId || typeof userId !== 'string') {
			return redirectWithToast('/admin/users', {
				type: 'error',
				title: 'Error',
				description: 'User ID is required',
			})
		}

		// Prevent self-demotion
		if (userId === currentUserId) {
			return redirectWithToast('/admin/users', {
				type: 'error',
				title: 'Error',
				description: 'You cannot remove your own admin role',
			})
		}

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
		employeeName: string
		employeeEmail: string
		intent: 'remove-admin'
	} | null>(null)

	const handleRemoveAdminClick = (
		userId: string,
		employeeName: string,
		employeeEmail: string,
	) => {
		setPendingAction({
			userId,
			employeeName,
			employeeEmail,
			intent: 'remove-admin',
		})
		setConfirmDialogOpen(true)
	}

	return (
		<div className="h-full overflow-y-auto px-6 py-6">
			<div>
				<PageTitle title="Staff Admin Management" />
				<p className="text-muted-foreground mt-1 text-sm">
					Manage admin access for faculty and staff. Create accounts for employees who haven't logged in yet, then grant admin privileges.
				</p>

				{/* Confirmation Dialog */}
				{pendingAction && (
					<Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Remove Admin Access</DialogTitle>
								<DialogDescription>
									Are you sure you want to remove admin access from{' '}
									<strong>{pendingAction.employeeName}</strong> (
									{pendingAction.employeeEmail})?
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
										<input
											type="hidden"
											name="employeeEmail"
											value={pendingAction.employeeEmail}
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
						{loaderData.employees.length > 0 ? (
							<>
								{/* Mobile Card View */}
								<div className="flex flex-col gap-4 md:hidden">
									{loaderData.employees.map((employee) => {
										const isPending =
											navigation.state === 'submitting' &&
											navigation.formData?.get('employeeEmail') ===
												employee.email

										return (
											<Card
												key={employee.id}
												className="border-muted/50 hover:bg-muted/50 shadow-sm"
											>
												<CardSection>
													<div className="flex flex-col gap-4">
														<div>
															<div className="flex flex-wrap items-center gap-2">
																<span className="text-h4 text-foreground">
																	{employee.firstName} {employee.lastName}
																</span>
																{employee.isAdmin && (
																	<StatusBadge variant="active">
																		Admin
																	</StatusBadge>
																)}
																<StatusBadge
																	variant={
																		employee.status === 'active'
																			? 'active'
																			: 'inactive'
																	}
																>
																	{employee.status}
																</StatusBadge>
															</div>
															<p className="text-muted-foreground text-sm">
																{employee.jobTitle}
															</p>
														</div>
														<KeyValueList
															items={[
																{ key: 'Email', value: employee.email },
																{
																	key: 'SIS ID',
																	value: employee.sisEmployeeId,
																},
																{
																	key: 'Account Status',
																	value: employee.hasAccount
																		? 'Has account'
																		: 'No account',
																},
															]}
														/>
														<div className="pt-2">
															{employee.isAdmin ? (
																<StatusButton
																	type="button"
																	variant="destructive"
																	size="sm"
																	status={isPending ? 'pending' : 'idle'}
																	disabled={isPending}
																	onClick={() =>
																		handleRemoveAdminClick(
																			employee.userId!,
																			`${employee.firstName} ${employee.lastName}`,
																			employee.email,
																		)
																	}
																>
																	<Icon name="cross-1" className="scale-75" />
																	Remove Admin
																</StatusButton>
															) : employee.hasAccount ? (
																<Form method="post" className="inline">
																	<input
																		type="hidden"
																		name="intent"
																		value="add-admin"
																	/>
																	<input
																		type="hidden"
																		name="employeeEmail"
																		value={employee.email}
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
															) : (
																<div className="flex gap-2">
																	<Form method="post" className="inline">
																		<input
																			type="hidden"
																			name="intent"
																			value="create-account"
																		/>
																		<input
																			type="hidden"
																			name="employeeEmail"
																			value={employee.email}
																		/>
																		<StatusButton
																			type="submit"
																			variant="outline"
																			size="sm"
																			status={isPending ? 'pending' : 'idle'}
																			disabled={isPending}
																		>
																			<Icon name="plus" className="scale-75" />
																			Create Account
																		</StatusButton>
																	</Form>
																</div>
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
												<th className="p-2 text-left">Name</th>
												<th className="p-2 text-left">Email</th>
												<th className="p-2 text-left">Job Title</th>
												<th className="p-2 text-left">Status</th>
												<th className="p-2 text-left">Account</th>
												<th className="p-2 text-left">Actions</th>
											</tr>
										</thead>
										<tbody>
											{loaderData.employees.map((employee) => {
												const isPending =
													navigation.state === 'submitting' &&
													navigation.formData?.get('employeeEmail') ===
														employee.email

												return (
													<tr
														key={employee.id}
														className="hover:bg-muted/50 border-b"
													>
														<td className="p-2">
															<div className="flex items-center gap-2">
																<span className="text-foreground">
																	{employee.firstName} {employee.lastName}
																</span>
																{employee.isAdmin && (
																	<StatusBadge variant="active">
																		Admin
																	</StatusBadge>
																)}
															</div>
														</td>
														<td className="text-muted-foreground p-2 text-sm">
															{employee.email}
														</td>
														<td className="text-muted-foreground p-2 text-sm">
															{employee.jobTitle}
														</td>
														<td className="p-2">
															<StatusBadge
																variant={
																	employee.status === 'active'
																		? 'active'
																		: 'inactive'
																}
															>
																{employee.status}
															</StatusBadge>
														</td>
														<td className="p-2">
															{employee.hasAccount ? (
																<span className="text-muted-foreground text-sm">
																	✓ Has account
																</span>
															) : (
																<span className="text-muted-foreground italic text-sm">
																	No account
																</span>
															)}
														</td>
														<td className="p-2">
															{employee.isAdmin ? (
																<StatusButton
																	type="button"
																	variant="destructive"
																	size="sm"
																	status={isPending ? 'pending' : 'idle'}
																	disabled={isPending}
																	onClick={() =>
																		handleRemoveAdminClick(
																			employee.userId!,
																			`${employee.firstName} ${employee.lastName}`,
																			employee.email,
																		)
																	}
																>
																	<Icon name="cross-1" className="scale-75" />
																	Remove Admin
																</StatusButton>
															) : employee.hasAccount ? (
																<Form method="post" className="inline">
																	<input
																		type="hidden"
																		name="intent"
																		value="add-admin"
																	/>
																	<input
																		type="hidden"
																		name="employeeEmail"
																		value={employee.email}
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
															) : (
																<Form method="post" className="inline">
																	<input
																		type="hidden"
																		name="intent"
																		value="create-account"
																	/>
																	<input
																		type="hidden"
																		name="employeeEmail"
																		value={employee.email}
																	/>
																	<StatusButton
																		type="submit"
																		variant="outline"
																		size="sm"
																		status={isPending ? 'pending' : 'idle'}
																		disabled={isPending}
																	>
																		<Icon name="plus" className="scale-75" />
																		Create Account
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
							<p className="text-muted-foreground">No employees found</p>
						)}
					</div>
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
