import { ProviderConnectionForm, GOOGLE_PROVIDER_NAME } from '#app/utils/connections.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { type Route } from './+types/index.ts'

export const meta: Route.MetaFunction = () => [
	{ title: 'Employee ID System' },
	{ name: 'description', content: 'View and download your official employee ID card' },
]

export default function Index() {
	return (
		<main className="flex min-h-full flex-col items-center justify-center px-4 py-16">
			<div className="mx-auto w-full max-w-md">
				<div className="flex flex-col gap-6 text-center">
					<h1 className="text-h1">Employee ID System</h1>
					<p className="text-body-md text-muted-foreground">
						Access your official employee ID card. View, download, and verify your
						employment status.
					</p>
					<p className="text-body-sm text-muted-foreground">
						This system is for internal use by school employees. External parties
						can verify employee status using the QR code on ID cards.
					</p>
				</div>
				<Spacer size="md" />
				<div className="mx-auto w-full max-w-md">
					<ProviderConnectionForm
						type="Login"
						providerName={GOOGLE_PROVIDER_NAME}
					/>
				</div>
			</div>
		</main>
	)
}
