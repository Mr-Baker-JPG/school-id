import { type Route } from './+types/layout-explorations.ts'
import { requireAdmin } from '#app/utils/auth.server.ts'
import { PAGE_LAYOUTS } from '#app/components/page-layout-explorations.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'

export async function loader({ request }: Route.LoaderArgs) {
	await requireAdmin(request)
	return {}
}

export default function LayoutExplorationsPage() {
	return (
		<div className="space-y-14 pb-20">
			<PageTitle
				title="Page Layout Explorations"
				subtitle="5 structural approaches to the app shell — header, sidebar, content area, and navigation patterns. Hover over Layout 3 to see the drawer expand."
			/>

			{PAGE_LAYOUTS.map((layout) => {
				const Component = layout.component
				return (
					<div key={layout.id}>
						<Component />
					</div>
				)
			})}
		</div>
	)
}
