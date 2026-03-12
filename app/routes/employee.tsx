import { Outlet } from 'react-router'
import { AdminShell } from '#app/ui/shells/AdminShell.tsx'
import { AppShell } from '#app/ui/shells/AppShell.tsx'
import { useOptionalUser } from '#app/utils/user.ts'
import { userHasRole } from '#app/utils/user.ts'

/**
 * Employee layout route.
 * If the user is an admin, wrap with AdminShell so the full admin
 * sidebar stays visible (e.g. when viewing "My ID").
 * Otherwise, use the simpler AppShell.
 */
export default function EmployeeLayout() {
	const user = useOptionalUser()
	const isAdmin = user ? userHasRole(user, 'admin') : false

	if (isAdmin) {
		return (
			<AdminShell>
				<div className="h-full overflow-y-auto px-4 py-8 mx-auto max-w-5xl w-full">
					<Outlet />
				</div>
			</AdminShell>
		)
	}

	return (
		<AppShell>
			<Outlet />
		</AppShell>
	)
}
