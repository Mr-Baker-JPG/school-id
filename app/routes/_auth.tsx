import { Outlet } from 'react-router'
import { AuthShell } from '#app/ui/shells/AuthShell.tsx'

export default function AuthLayout() {
	return (
		<AuthShell>
			<Outlet />
		</AuthShell>
	)
}
