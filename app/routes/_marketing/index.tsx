import { Img } from 'openimg/react'
import { redirect } from 'react-router'
import {
	ProviderConnectionForm,
	GOOGLE_PROVIDER_NAME,
} from '#app/utils/connections.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { APP_NAME, SCHOOL_NAME, CREST_SRC } from '#app/ui/brand.ts'
import { type Route } from './+types/index.ts'
import { getUserId, getRedirectPathForUser } from '#app/utils/auth.server.ts'

export const meta: Route.MetaFunction = () => [
	{ title: APP_NAME },
	{
		name: 'description',
		content: 'View and download your official ID card',
	},
]

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await getUserId(request)
	if (userId) {
		const redirectPath = await getRedirectPathForUser(userId)
		throw redirect(redirectPath)
	}
	return {}
}

export default function Index() {
	return (
		<div className="font-body">
			{/* Hero */}
			<section className="relative overflow-hidden border border-border bg-card py-16 md:py-24">
				{/* Gold accent top */}
				<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-brand-gold to-transparent" />

				{/* Subtle background pattern */}
				<div className="pointer-events-none absolute inset-0 opacity-[0.03]">
					<div
						className="h-full w-full"
						style={{
							backgroundImage:
								'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
							backgroundSize: '24px 24px',
						}}
					/>
				</div>

				<div className="relative mx-auto max-w-2xl px-6 text-center">
					{/* Crest */}
					<div className="mx-auto mb-8 flex size-24 items-center justify-center md:size-28">
						<Img
							src={CREST_SRC}
							alt={SCHOOL_NAME}
							className="h-full w-auto object-contain drop-shadow-sm"
							width={112}
							height={112}
						/>
					</div>

					<h1 className="font-display text-2xl font-bold tracking-wide text-primary md:text-4xl">
						{APP_NAME}
					</h1>

					<div className="mx-auto my-5 h-px w-16 bg-brand-gold/60" />

					<p className="font-body text-base text-muted-foreground md:text-lg">
						Access your official digital ID card.
						<br className="hidden sm:block" />
						View, download, and verify your status.
					</p>

					<p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground/70">
						Faculty · Staff · Students
					</p>

					{/* Login */}
					<div className="mx-auto mt-10 w-full max-w-xs">
						<ProviderConnectionForm
							type="Login"
							providerName={GOOGLE_PROVIDER_NAME}
						/>
					</div>

					<p className="mt-4 font-body text-xs text-muted-foreground/60">
						Sign in with your {SCHOOL_NAME} Google account
					</p>
				</div>
			</section>

			{/* Features */}
			<section className="mt-12 md:mt-16">
				<h2 className="mb-6 text-center font-display text-lg font-semibold text-primary md:text-xl">
					What You Can Do
				</h2>

				<div className="grid gap-4 md:grid-cols-3">
					<FeatureCard
						icon="file-text"
						title="Digital ID Cards"
						description="View and download your official ID card in PDF format — wallet-sized for easy printing and access."
					/>
					<FeatureCard
						icon="link-2"
						title="QR Verification"
						description="Each ID card includes a QR code linking to a public verification page confirming active status."
					/>
					<FeatureCard
						icon="cloud-sync"
						title="Automatic Sync"
						description="Data stays current through automatic synchronization with the school's FACTS Student Information System."
					/>
				</div>
			</section>

			{/* Verification callout */}
			<section className="mt-12 border border-border bg-muted/30 p-6 md:mt-16 md:p-8">
				<div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
					<div className="flex size-12 shrink-0 items-center justify-center bg-brand-navy/10">
						<Icon name="check" className="size-6 text-brand-navy" />
					</div>
					<div>
						<h3 className="font-display text-sm font-semibold text-primary">
							External Verification
						</h3>
						<p className="mt-1 font-body text-sm text-muted-foreground">
							Need to verify someone's status? Scan the QR code on their ID card
							to access the public verification page — no account required.
						</p>
					</div>
				</div>
			</section>
		</div>
	)
}

/* ----------------------------------------------------------------
 * Feature card
 * ---------------------------------------------------------------- */

function FeatureCard({
	icon,
	title,
	description,
}: {
	icon: Parameters<typeof Icon>[0]['name']
	title: string
	description: string
}) {
	return (
		<div className="group border border-border bg-card p-5 shadow-sm transition-all hover:border-brand-gold/40 hover:shadow-md">
			<div className="mb-3 inline-flex bg-brand-navy/10 p-2">
				<Icon name={icon} className="size-5 text-brand-navy" />
			</div>
			<div className="font-display text-sm font-semibold text-foreground">
				{title}
			</div>
			<p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
				{description}
			</p>
		</div>
	)
}
