import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Icon } from '#app/components/ui/icon.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

/**
 * Employee index route — shown in the right panel when no employee is selected.
 * The employee list is rendered by the parent layout route (employees.tsx).
 */
export default function EmployeesIndexRoute() {
	return (
		<div className="flex h-full flex-col items-center justify-center py-20 text-center">
			<div className="bg-muted/50 mb-4 inline-flex rounded-full p-4">
				<Icon name="user" className="text-muted-foreground size-8" />
			</div>
			<h2 className="text-foreground text-lg font-semibold">
				Select an Employee
			</h2>
			<p className="text-muted-foreground mt-2 max-w-xs text-sm">
				Choose an employee from the list to view their details, manage
				photos, and download ID cards.
			</p>
		</div>
	)
}
