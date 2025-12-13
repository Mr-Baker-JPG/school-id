import { Outlet } from 'react-router'
import { MarketingShell } from '#app/ui/shells/MarketingShell.tsx'

export default function MarketingLayout() {
	return (
		<MarketingShell>
			<Outlet />
		</MarketingShell>
	)
}
