import { Outlet } from 'react-router'
import { AdminShell } from '#app/ui/shells/AdminShell.tsx'
import { requireAdmin } from '#app/utils/auth.server.ts'
import { type Route } from './+types/admin.ts'

export async function loader({ request }: Route.LoaderArgs) {
	await requireAdmin(request)
	return {}
}

export default function AdminLayout() {
	return (
		<AdminShell>
			<Outlet />
		</AdminShell>
	)
}
