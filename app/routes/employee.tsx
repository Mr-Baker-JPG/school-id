import { Outlet } from 'react-router'
import { AppShell } from '#app/ui/shells/AppShell.tsx'

export default function EmployeeLayout() {
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	)
}
