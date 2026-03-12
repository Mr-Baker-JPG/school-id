import { type Route } from './+types/card-designs.ts'
import { requireAdmin } from '#app/utils/auth.server.ts'
import { getBrandingConfig } from '#app/utils/branding.server.ts'
import { getCurrentAcademicYear } from '#app/utils/employee.server.ts'
import { DESIGNS, type CardDesignProps } from '#app/components/id-card-designs.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'

export async function loader({ request }: Route.LoaderArgs) {
	await requireAdmin(request)
	const branding = getBrandingConfig()
	const academicYear = getCurrentAcademicYear()
	return { branding, academicYear }
}

export default function CardDesignsPage({ loaderData }: Route.ComponentProps) {
	const { branding, academicYear } = loaderData

	const sampleProps: CardDesignProps = {
		fullName: 'Samantha Marie Baker',
		personType: 'FACULTY',
		sisId: '100247',
		academicYear,
		photoUrl: null,
		logoUrl: branding.logoUrl ?? null,
		schoolName: branding.schoolName,
		qrCodeDataURL: undefined,
	}

	return (
		<div className="h-full overflow-y-auto px-6 py-6">
		<div className="space-y-10">
			<PageTitle
				title="ID Card Designs"
				subtitle="Compare 5 redesigned card layouts. Each addresses hierarchy, spacing, branding, and back-side content."
			/>

			{DESIGNS.map((d) => (
				<div key={d.id} className="space-y-3">
					<div>
						<h2 className="text-lg font-semibold">
							Design {d.id}: {d.name}
						</h2>
						<p className="text-muted-foreground text-sm">{d.desc}</p>
					</div>
					<div className="flex flex-wrap gap-6">
						<div>
							<div className="text-muted-foreground mb-1 text-xs font-medium">FRONT</div>
							<d.Front {...sampleProps} />
						</div>
						<div>
							<div className="text-muted-foreground mb-1 text-xs font-medium">BACK</div>
							<d.Back {...sampleProps} />
						</div>
					</div>
				</div>
			))}
		</div>
		</div>
	)
}
