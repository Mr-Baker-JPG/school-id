import * as React from 'react'
import {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from '#app/components/ui/dialog.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { cn } from '#app/utils/misc.tsx'

interface HelpStepProps {
	number: number
	title: string
	children: React.ReactNode
}

function HelpStep({ number, title, children }: HelpStepProps) {
	return (
		<div className="relative pl-10">
			<div className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
				{number}
			</div>
			<h4 className="font-display text-sm font-semibold text-primary">
				{title}
			</h4>
			<div className="mt-1 text-body-xs text-muted-foreground [&>p]:mb-1.5 [&>p:last-child]:mb-0">
				{children}
			</div>
		</div>
	)
}

interface CodeBlockProps {
	children: string
	language?: string
}

function CodeBlock({ children, language }: CodeBlockProps) {
	const [copied, setCopied] = React.useState(false)

	async function handleCopy() {
		await navigator.clipboard.writeText(children)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<div className="group relative mt-2 rounded-md bg-muted/50">
			<button
				onClick={handleCopy}
				className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
				aria-label="Copy code"
			>
				{copied ? (
					<Icon name="check" size="xs" className="text-green-600" />
				) : (
					<span className="text-body-2xs text-muted-foreground">Copy</span>
				)}
			</button>
			{language && (
				<span className="absolute left-2 top-1 text-[10px] font-mono text-muted-foreground">
					{language}
				</span>
			)}
			<pre className="overflow-x-auto p-3 pt-6 text-xs font-mono">
				<code>{children}</code>
			</pre>
		</div>
	)
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-1 text-brand-gold underline decoration-brand-gold/30 underline-offset-2 transition-colors hover:text-brand-gold/80 hover:decoration-brand-gold/50"
		>
			{children}
			<Icon name="link-2" size="xs" className="shrink-0" />
		</a>
	)
}

type HelpTab = 'oauth' | 'service-account' | 'permissions'

interface GoogleWorkspaceHelpProps {
	trigger?: React.ReactNode
	className?: string
	/** Initial tab to show */
	defaultTab?: HelpTab
}

export function GoogleWorkspaceHelp({
	trigger,
	className,
	defaultTab = 'oauth',
}: GoogleWorkspaceHelpProps) {
	const [activeTab, setActiveTab] = React.useState<HelpTab>(defaultTab)

	const tabs: { id: HelpTab; label: string }[] = [
		{ id: 'oauth', label: 'OAuth Setup' },
		{ id: 'service-account', label: 'Service Account' },
		{ id: 'permissions', label: 'Permissions' },
	]

	return (
		<Dialog>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="ghost" size="sm" className="gap-1.5">
						<Icon name="question-mark-circled" size="sm" />
						<span className="text-body-xs">Setup Guide</span>
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className={cn('max-w-2xl', className)}>
				<DialogHeader>
					<DialogTitle>Google Workspace Setup</DialogTitle>
					<DialogDescription>
						Follow these steps to configure Google Workspace integration for
						OAuth login, Gmail signatures, and photo sync.
					</DialogDescription>
				</DialogHeader>

				{/* Tab navigation */}
				<div className="flex gap-1 border-b border-border">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								'px-4 py-2 text-body-xs font-medium transition-colors',
								activeTab === tab.id
									? 'border-b-2 border-brand-gold text-primary'
									: 'text-muted-foreground hover:text-primary',
							)}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Tab content */}
				<div className="max-h-[50vh] overflow-y-auto px-6 pb-6">
					{activeTab === 'oauth' && <OAuthSetupContent />}
					{activeTab === 'service-account' && <ServiceAccountContent />}
					{activeTab === 'permissions' && <PermissionsContent />}
				</div>
			</DialogContent>
		</Dialog>
	)
}

function OAuthSetupContent() {
	return (
		<div className="space-y-6">
			<HelpStep number={1} title="Create a Google Cloud Project">
				<p>
					Go to the{' '}
					<ExternalLink href="https://console.cloud.google.com/">
						Google Cloud Console
					</ExternalLink>{' '}
					and create a new project or select an existing one.
				</p>
				<p className="text-body-2xs">
					We recommend naming it something like "School ID Integration".
				</p>
			</HelpStep>

			<HelpStep number={2} title="Configure OAuth Consent Screen">
				<p>
					Navigate to <strong>APIs & Services → OAuth consent screen</strong>.
				</p>
				<ul className="ml-4 mt-1.5 list-disc space-y-1">
					<li>
						<strong>User Type:</strong> Select "Internal" if your organization
						is a Google Workspace customer (recommended), or "External" for
						testing.
					</li>
					<li>
						<strong>App name:</strong> "School ID" or your school's name
					</li>
					<li>
						<strong>Support email:</strong> Your admin email
					</li>
					<li>
						<strong>Authorized domains:</strong> Add your school's domain
					</li>
				</ul>
				<p className="mt-1.5">
					<strong>Scopes:</strong> Add these scopes (click "Add or remove scopes"):
				</p>
				<CodeBlock language="scopes">
					{`openid
email
profile
https://www.googleapis.com/auth/gmail.settings.basic
https://www.googleapis.com/auth/gmail.settings.sharing
https://www.googleapis.com/auth/directory.user
https://www.googleapis.com/auth/directory.user.readonly`}
				</CodeBlock>
			</HelpStep>

			<HelpStep number={3} title="Create OAuth 2.0 Credentials">
				<p>
					Go to <strong>APIs & Services → Credentials</strong> and click
					"Create Credentials → OAuth client ID".
				</p>
				<ul className="ml-4 mt-1.5 list-disc space-y-1">
					<li>
						<strong>Application type:</strong> Web application
					</li>
					<li>
						<strong>Name:</strong> "School ID Web Client"
					</li>
					<li>
						<strong>Authorized JavaScript origins:</strong> Your app's URL
						(e.g., https://your-app.fly.dev)
					</li>
					<li>
						<strong>Authorized redirect URIs:</strong> Add your callback URL
					</li>
				</ul>
				<CodeBlock language="uri">
					{`https://your-app.fly.dev/auth/google/callback`}
				</CodeBlock>
				<p className="mt-1.5">
					After creating, copy the <strong>Client ID</strong> and{' '}
					<strong>Client Secret</strong> into the form fields above.
				</p>
			</HelpStep>

			<HelpStep number={4} title="Enable Required APIs">
				<p>Enable the following APIs in your Google Cloud project:</p>
				<ul className="ml-4 mt-1.5 list-disc space-y-1">
					<li>
						<ExternalLink href="https://console.cloud.google.com/apis/library/gmail.googleapis.com">
							Gmail API
						</ExternalLink>
					</li>
					<li>
						<ExternalLink href="https://console.cloud.google.com/apis/library/admin.googleapis.com">
							Admin SDK API
						</ExternalLink>
					</li>
					<li>
						<ExternalLink href="https://console.cloud.google.com/apis/library/people.googleapis.com">
							People API
						</ExternalLink>
					</li>
				</ul>
			</HelpStep>
		</div>
	)
}

function ServiceAccountContent() {
	return (
		<div className="space-y-6">
			<div className="rounded-md border border-amber-200/50 bg-amber-50/50 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
				<p className="text-body-xs text-amber-700 dark:text-amber-300">
					<strong>Required for:</strong> Gmail signature management and Google
					Directory photo sync. OAuth-only setups can skip this section.
				</p>
			</div>

			<HelpStep number={1} title="Create a Service Account">
				<p>
					Go to <strong>APIs & Services → Credentials</strong> and click
					"Create Credentials → Service account".
				</p>
				<ul className="ml-4 mt-1.5 list-disc space-y-1">
					<li>
						<strong>Service account name:</strong> "school-id-service"
					</li>
					<li>
						<strong>Role:</strong> Skip for now (we'll set up domain-wide
						delegation instead)
					</li>
				</ul>
				<p className="mt-1.5">Click "Done" to create the service account.</p>
			</HelpStep>

			<HelpStep number={2} title="Generate a Private Key">
				<p>
					Click on the newly created service account to open its details, then
					go to the <strong>Keys</strong> tab.
				</p>
				<ul className="ml-4 mt-1.5 list-disc space-y-1">
					<li>Click "Add Key → Create new key"</li>
					<li>Select <strong>JSON</strong> format</li>
					<li>Download and save the JSON file securely</li>
				</ul>
				<p className="mt-1.5">
					From the downloaded JSON file, copy:
				</p>
				<ul className="ml-4 mt-1.5 list-disc space-y-1">
					<li>
						<code className="rounded bg-muted px-1 py-0.5 text-body-2xs font-mono">
							client_email
						</code>{' '}
						→ Service Account Email field
					</li>
					<li>
						<code className="rounded bg-muted px-1 py-0.5 text-body-2xs font-mono">
							private_key
						</code>{' '}
						→ Private Key field (include the full PEM including headers)
					</li>
				</ul>
			</HelpStep>

			<HelpStep number={3} title="Enable Domain-Wide Delegation">
				<p>
					In the service account details, find the <strong>"Domain-wide delegation"</strong> section and click "View Google Workspace Admin Console".
				</p>
				<p className="mt-1.5">
					This will take you to your Google Workspace Admin Console where you can authorize the service account to act on behalf of users in your domain.
				</p>
			</HelpStep>

			<HelpStep number={4} title="Configure Admin Email">
				<p>
					Enter an admin email address (e.g., admin@yourschool.org) that the
					service account will impersonate when making API calls.
				</p>
				<p className="mt-1.5 text-body-2xs">
					<strong>Note:</strong> This user must have the necessary admin
					privileges in Google Workspace to manage users and Gmail settings.
				</p>
			</HelpStep>
		</div>
	)
}

function PermissionsContent() {
	return (
		<div className="space-y-6">
			<div className="rounded-md border border-blue-200/50 bg-blue-50/50 p-3 dark:border-blue-800/30 dark:bg-blue-950/20">
				<p className="text-body-xs text-blue-700 dark:text-blue-300">
					<strong>Important:</strong> These permissions must be configured in the
					Google Workspace Admin Console, not the Google Cloud Console.
				</p>
			</div>

			<HelpStep number={1} title="Access Google Workspace Admin Console">
				<p>
					Go to{' '}
					<ExternalLink href="https://admin.google.com/">
						admin.google.com
					</ExternalLink>{' '}
					and sign in with an administrator account.
				</p>
			</HelpStep>

			<HelpStep number={2} title="Configure API Client Access">
				<p>
					Navigate to <strong>Security → API Controls → Domain-wide Delegation</strong>.
				</p>
				<p className="mt-1.5">Click "Add new" and enter:</p>
				<ul className="ml-4 mt-1.5 list-disc space-y-1">
					<li>
						<strong>Client ID:</strong> The "Client ID" from your service
						account (found in the JSON key file as{' '}
						<code className="rounded bg-muted px-1 py-0.5 text-body-2xs font-mono">
							client_id
						</code>
						, not the OAuth client ID)
					</li>
				</ul>
			</HelpStep>

			<HelpStep number={3} title="Add OAuth Scopes">
				<p>In the same dialog, add these OAuth scopes:</p>
				<CodeBlock language="scopes">
					{`https://www.googleapis.com/auth/gmail.settings.basic
https://www.googleapis.com/auth/gmail.settings.sharing
https://www.googleapis.com/auth/directory.user
https://www.googleapis.com/auth/directory.user.readonly
https://www.googleapis.com/auth/userinfo.profile`}
				</CodeBlock>
				<p className="mt-1.5">
					Click "Authorize" to save. Changes may take a few minutes to propagate.
				</p>
			</HelpStep>

			<HelpStep number={4} title="Verify Setup">
				<p>
					After configuring, save your settings in the form above. You can verify
					the integration is working by:
				</p>
				<ul className="ml-4 mt-1.5 list-disc space-y-1">
					<li>Trying to log in with Google OAuth</li>
					<li>Testing Gmail signature push from the Signatures page</li>
					<li>Syncing a user photo to Google Workspace</li>
				</ul>
			</HelpStep>

			<div className="mt-4 rounded-md border bg-muted/30 p-4">
				<h4 className="font-display text-sm font-semibold text-primary">
					Troubleshooting
				</h4>
				<ul className="mt-2 space-y-2 text-body-xs text-muted-foreground">
					<li className="flex gap-2">
						<Icon name="question-mark-circled" size="sm" className="mt-0.5 shrink-0 text-amber-500" />
						<span>
							<strong>403 Unauthorized:</strong> Verify the OAuth scopes match
							exactly in both the consent screen and domain-wide delegation.
						</span>
					</li>
					<li className="flex gap-2">
						<Icon name="question-mark-circled" size="sm" className="mt-0.5 shrink-0 text-amber-500" />
						<span>
							<strong>Invalid grant:</strong> The private key may be malformed.
							Ensure the full PEM block is copied, including headers.
						</span>
					</li>
					<li className="flex gap-2">
						<Icon name="question-mark-circled" size="sm" className="mt-0.5 shrink-0 text-amber-500" />
						<span>
							<strong>Admin not found:</strong> The admin email must be an
							active user in your Google Workspace domain.
						</span>
					</li>
				</ul>
			</div>
		</div>
	)
}

export default GoogleWorkspaceHelp
