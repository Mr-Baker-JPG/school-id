import { redirect } from 'react-router'
import {
	ProviderConnectionForm,
	GOOGLE_PROVIDER_NAME,
} from '#app/utils/connections.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { APP_NAME } from '#app/ui/brand.ts'
import { type Route } from './+types/index.ts'
import { getUserId, getRedirectPathForUser } from '#app/utils/auth.server.ts'

export const meta: Route.MetaFunction = () => [
	{ title: APP_NAME },
	{
		name: 'description',
		content: 'View and download your official employee ID card',
	},
]

export async function loader({ request }: Route.LoaderArgs) {
	// If user is logged in, redirect them to their appropriate page
	const userId = await getUserId(request)
	if (userId) {
		const redirectPath = await getRedirectPathForUser(userId)
		throw redirect(redirectPath)
	}
	// If not logged in, show the marketing page
	return {}
}

export default function Index() {
	return (
		<>
			{/* Hero Section */}
			<section className="bg-muted/40 rounded-xl p-8 text-center">
				<div className="mx-auto max-w-2xl">
					<p className="text-body-lg text-muted-foreground mb-6">
						Access your official employee ID card. View, download, and verify
						your employment status.
					</p>
					<p className="text-body-md text-muted-foreground mb-8">
						This system is for internal use by school employees. External
						parties can verify employee status using the QR code on ID cards.
					</p>
					<div className="flex justify-center">
						<div className="w-full max-w-xs">
							<ProviderConnectionForm
								type="Login"
								providerName={GOOGLE_PROVIDER_NAME}
							/>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section - Reduced prominence */}
			<section className="mt-12">
				<h2 className="text-h3 mb-4 text-center font-semibold">
					What you can do
				</h2>
				<div className="grid gap-4 md:grid-cols-3">
					<CardSection
						title="Digital ID Cards"
						description="Access your official employee ID card anytime, anywhere"
						className="border-muted/50"
					>
						<p className="text-body-sm text-muted-foreground">
							View and download your employee ID card in PDF format for easy
							access and printing.
						</p>
					</CardSection>
					<CardSection
						title="QR Code Verification"
						description="Secure verification for external parties"
						className="border-muted/50"
					>
						<p className="text-body-sm text-muted-foreground">
							Each ID card includes a QR code that links to a public
							verification page confirming your active employment status.
						</p>
					</CardSection>
					<CardSection
						title="Automatic Sync"
						description="Always up-to-date with FACTS SIS"
						className="border-muted/50"
					>
						<p className="text-body-sm text-muted-foreground">
							Employee data is automatically synchronized with the school's
							FACTS Student Information System.
						</p>
					</CardSection>
				</div>
			</section>
		</>
	)
}
