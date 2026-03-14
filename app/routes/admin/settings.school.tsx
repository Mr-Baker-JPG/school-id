import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useState, useRef } from 'react'
import { data, Form, useActionData, useNavigation } from 'react-router'
import { z } from 'zod'
import { parseWithZod } from '@conform-to/zod'
import { Button } from '#app/components/ui/button.tsx'
import { Card } from '#app/components/ui/card.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Separator } from '#app/components/ui/separator.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	setSchoolConfigValues,
	invalidateSchoolConfigCache,
	getSchoolConfig,
} from '#app/utils/school-config.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/settings.school.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

// ─── Validation Schemas ──────────────────────────────────────────────────────

const SectionSchema = z.discriminatedUnion('section', [
	z.object({
		section: z.literal('branding'),
		schoolName: z.string().min(1, 'School name is required'),
		schoolShortName: z.string().min(1, 'Short name is required').max(10),
		addressLine1: z.string().optional().default(''),
		addressLine2: z.string().optional().default(''),
		phone: z.string().optional().default(''),
		emailDomain: z.string().optional().default(''),
		schoolWebsite: z
			.string()
			.url('Must be a valid URL')
			.optional()
			.or(z.literal('')),
		primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color'),
		secondaryColor: z
			.string()
			.regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color'),
		accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color'),
	}),
	z.object({
		section: z.literal('facts'),
		factsSubscriptionKey: z.string().min(1, 'Subscription key is required'),
		factsApiKey: z.string().min(1, 'API key is required'),
		factsBaseUrl: z.string().url('Must be a valid URL'),
	}),
	z.object({
		section: z.literal('google'),
		googleEnabled: z.enum(['true', 'false']),
		googleClientId: z.string().optional().default(''),
		googleClientSecret: z.string().optional().default(''),
		googleRedirectUri: z.string().optional().default(''),
		googleServiceAccountEmail: z.string().optional().default(''),
		googleServiceAccountKey: z.string().optional().default(''),
		googleAdminEmail: z.string().optional().default(''),
	}),
])

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	const schoolConfig = await getSchoolConfig()

	// Load FACTS settings from SystemSetting table
	const factsSettings = await prisma.systemSetting.findMany({
		where: {
			key: {
				in: ['facts_subscription_key', 'facts_api_key', 'facts_base_url'],
			},
		},
	})

	const factsConfig: Record<string, string> = {}
	for (const s of factsSettings) {
		factsConfig[s.key] = s.value
	}

	// Load Google settings
	const googleSettings = await prisma.systemSetting.findMany({
		where: {
			key: {
				in: [
					'google_enabled',
					'google_client_id',
					'google_client_secret',
					'google_redirect_uri',
					'google_service_account_email',
					'google_service_account_key',
					'google_admin_email',
				],
			},
		},
	})

	const googleConfig: Record<string, string> = {}
	for (const s of googleSettings) {
		googleConfig[s.key] = s.value
	}

	return {
		schoolConfig,
		factsConfig,
		googleConfig,
	}
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')

	const formData = await request.formData()
	const section = formData.get('section')

	if (section === 'branding') {
		const submission = parseWithZod(formData, {
			schema: SectionSchema.options[0],
		})
		if (submission.status !== 'success') {
			return data(
				{ section: 'branding', result: submission.reply(), success: false },
				{ status: 400 },
			)
		}
		const v = submission.value
		await setSchoolConfigValues({
			school_name: v.schoolName,
			school_short_name: v.schoolShortName,
			school_address_line1: v.addressLine1 || '',
			school_address_line2: v.addressLine2 || '',
			school_phone: v.phone || '',
			school_email_domain: v.emailDomain || '',
			school_website: v.schoolWebsite || '',
			school_primary_color: v.primaryColor,
			school_secondary_color: v.secondaryColor,
			school_accent_color: v.accentColor,
		})
		invalidateSchoolConfigCache()
		return redirectWithToast('/admin/settings/school', {
			type: 'success',
			title: 'Branding Updated',
			description: 'School branding settings have been saved.',
		})
	}

	if (section === 'facts') {
		const submission = parseWithZod(formData, {
			schema: SectionSchema.options[1],
		})
		if (submission.status !== 'success') {
			return data(
				{ section: 'facts', result: submission.reply(), success: false },
				{ status: 400 },
			)
		}
		const v = submission.value
		await setSchoolConfigValues({
			facts_subscription_key: v.factsSubscriptionKey,
			facts_api_key: v.factsApiKey,
			facts_base_url: v.factsBaseUrl,
		})
		invalidateSchoolConfigCache()
		return redirectWithToast('/admin/settings/school', {
			type: 'success',
			title: 'FACTS Settings Updated',
			description: 'FACTS SIS connection settings have been saved.',
		})
	}

	if (section === 'google') {
		const submission = parseWithZod(formData, {
			schema: SectionSchema.options[2],
		})
		if (submission.status !== 'success') {
			return data(
				{ section: 'google', result: submission.reply(), success: false },
				{ status: 400 },
			)
		}
		const v = submission.value
		const enabled = v.googleEnabled === 'true'
		const values: Record<string, string> = {
			google_enabled: String(enabled),
		}
		if (enabled) {
			values.google_client_id = v.googleClientId || ''
			values.google_client_secret = v.googleClientSecret || ''
			values.google_redirect_uri = v.googleRedirectUri || ''
			values.google_service_account_email =
				v.googleServiceAccountEmail || ''
			values.google_service_account_key = v.googleServiceAccountKey || ''
			values.google_admin_email = v.googleAdminEmail || ''
		}
		await setSchoolConfigValues(values)
		invalidateSchoolConfigCache()
		return redirectWithToast('/admin/settings/school', {
			type: 'success',
			title: 'Google Settings Updated',
			description: 'Google Workspace settings have been saved.',
		})
	}

	return data(
		{ section: 'unknown', result: null, success: false },
		{ status: 400 },
	)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminSettingsSchool({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { schoolConfig, factsConfig, googleConfig } = loaderData
	const navigation = useNavigation()
	const isPending = navigation.state === 'submitting'

	return (
		<div className="h-full overflow-y-auto px-6 py-6 font-body">
			<div className="mx-auto max-w-2xl space-y-8">
				<PageTitle
					title="School Settings"
					subtitle="Configure school branding, FACTS SIS connection, and Google Workspace integration"
				/>

				{/* Branding Section */}
				<BrandingSection
					schoolConfig={schoolConfig}
					isPending={isPending}
					actionData={
						actionData?.section === 'branding' ? actionData : undefined
					}
				/>

				{/* FACTS Section */}
				<FactsSection
					factsConfig={factsConfig}
					isPending={isPending}
					actionData={
						actionData?.section === 'facts' ? actionData : undefined
					}
				/>

				{/* Google Section */}
				<GoogleSection
					googleConfig={googleConfig}
					isPending={isPending}
					actionData={
						actionData?.section === 'google' ? actionData : undefined
					}
				/>
			</div>
		</div>
	)
}

// ─── Section Components ──────────────────────────────────────────────────────

function BrandingSection({
	schoolConfig,
	isPending,
	actionData,
}: {
	schoolConfig: Awaited<ReturnType<typeof getSchoolConfig>>
	isPending: boolean
	actionData: any
}) {
	return (
		<Card>
			<div className="p-6">
				<div className="mb-4">
					<h2 className="font-display text-lg font-semibold text-primary">
						School Branding
					</h2>
					<p className="text-body-sm text-muted-foreground">
						Name, contact info, and brand colors shown on ID cards and
						throughout the system.
					</p>
				</div>

				<Form method="POST">
					<input type="hidden" name="section" value="branding" />

					<div className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label htmlFor="schoolName">School Name *</Label>
								<Input
									id="schoolName"
									name="schoolName"
									defaultValue={schoolConfig.schoolName}
									required
								/>
							</div>
							<div>
								<Label htmlFor="schoolShortName">Short Name *</Label>
								<Input
									id="schoolShortName"
									name="schoolShortName"
									maxLength={10}
									defaultValue={schoolConfig.schoolShortName}
									required
								/>
							</div>
						</div>

						<div>
							<Label htmlFor="emailDomain">Email Domain</Label>
							<Input
								id="emailDomain"
								name="emailDomain"
								placeholder="school.org"
								defaultValue={schoolConfig.emailDomain}
							/>
							<p className="mt-1 text-xs text-muted-foreground">
								Used to restrict OAuth logins to your school's domain
							</p>
						</div>

						<div>
							<Label htmlFor="schoolWebsite">Website URL</Label>
							<Input
								id="schoolWebsite"
								name="schoolWebsite"
								placeholder="https://school.org"
								defaultValue={schoolConfig.schoolWebsite}
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label htmlFor="addressLine1">Address Line 1</Label>
								<Input
									id="addressLine1"
									name="addressLine1"
									defaultValue={schoolConfig.addressLine1}
								/>
							</div>
							<div>
								<Label htmlFor="addressLine2">City, State ZIP</Label>
								<Input
									id="addressLine2"
									name="addressLine2"
									defaultValue={schoolConfig.addressLine2}
								/>
							</div>
						</div>

						<div>
							<Label htmlFor="phone">Phone</Label>
							<Input
								id="phone"
								name="phone"
								defaultValue={schoolConfig.phone}
							/>
						</div>

						<Separator className="my-2" />

						<p className="text-body-sm font-semibold">Brand Colors</p>
						<div className="grid grid-cols-3 gap-3">
							<ColorField
								id="primaryColor"
								label="Primary"
								defaultValue={schoolConfig.primaryColor}
							/>
							<ColorField
								id="secondaryColor"
								label="Secondary"
								defaultValue={schoolConfig.secondaryColor}
							/>
							<ColorField
								id="accentColor"
								label="Accent"
								defaultValue={schoolConfig.accentColor}
							/>
						</div>
					</div>

					<div className="mt-4">
						<StatusButton
							status={isPending ? 'pending' : 'idle'}
							type="submit"
							disabled={isPending}
						>
							Save Branding
						</StatusButton>
					</div>
				</Form>
			</div>
		</Card>
	)
}

function FactsSection({
	factsConfig,
	isPending,
	actionData,
}: {
	factsConfig: Record<string, string>
	isPending: boolean
	actionData: any
}) {
	const formRef = useRef<HTMLFormElement>(null)
	const [testResult, setTestResult] = useState<{
		status: 'idle' | 'testing' | 'success' | 'error'
		message?: string
	}>({ status: 'idle' })

	async function handleTestConnection() {
		if (!formRef.current) return
		setTestResult({ status: 'testing' })
		const fd = new FormData(formRef.current)
		try {
			const resp = await fetch('/install/test-facts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscriptionKey: fd.get('factsSubscriptionKey'),
					apiKey: fd.get('factsApiKey'),
					baseUrl: fd.get('factsBaseUrl'),
				}),
			})
			const result = (await resp.json()) as {
				success: boolean
				count?: number
				error?: string
			}
			if (result.success) {
				setTestResult({
					status: 'success',
					message: `Connected! Found ${result.count} people.`,
				})
			} else {
				setTestResult({
					status: 'error',
					message: result.error || 'Connection failed',
				})
			}
		} catch {
			setTestResult({
				status: 'error',
				message: 'Network error — could not reach test endpoint',
			})
		}
	}

	return (
		<Card>
			<div className="p-6">
				<div className="mb-4">
					<h2 className="font-display text-lg font-semibold text-primary">
						FACTS SIS Connection
					</h2>
					<p className="text-body-sm text-muted-foreground">
						Connect to your FACTS Student Information System to sync
						students and employees.
					</p>
				</div>

				<Form ref={formRef} method="POST">
					<input type="hidden" name="section" value="facts" />

					<div className="space-y-3">
						<div>
							<Label htmlFor="factsBaseUrl">FACTS API Base URL *</Label>
							<Input
								id="factsBaseUrl"
								name="factsBaseUrl"
								defaultValue={
									factsConfig.facts_base_url ||
									'https://api.factsmgt.com'
								}
								required
							/>
						</div>

						<div>
							<Label htmlFor="factsSubscriptionKey">
								Subscription Key *
							</Label>
							<Input
								id="factsSubscriptionKey"
								name="factsSubscriptionKey"
								defaultValue={
									factsConfig.facts_subscription_key || ''
								}
								required
							/>
							<p className="mt-1 text-xs text-muted-foreground">
								Found in the FACTS Developer Portal under your
								subscription
							</p>
						</div>

						<div>
							<Label htmlFor="factsApiKey">API Key *</Label>
							<Input
								id="factsApiKey"
								name="factsApiKey"
								type="password"
								defaultValue={factsConfig.facts_api_key || ''}
								required
							/>
						</div>

						{/* Test Connection */}
						<div className="flex items-center gap-3">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleTestConnection}
								disabled={testResult.status === 'testing'}
							>
								{testResult.status === 'testing'
									? 'Testing...'
									: 'Test Connection'}
							</Button>
							{testResult.status === 'success' && (
								<span className="text-sm text-green-600">
									✓ {testResult.message}
								</span>
							)}
							{testResult.status === 'error' && (
								<span className="text-sm text-red-500">
									✗ {testResult.message}
								</span>
							)}
						</div>
					</div>

					<div className="mt-4">
						<StatusButton
							status={isPending ? 'pending' : 'idle'}
							type="submit"
							disabled={isPending}
						>
							Save FACTS Settings
						</StatusButton>
					</div>
				</Form>
			</div>
		</Card>
	)
}

function GoogleSection({
	googleConfig,
	isPending,
	actionData,
}: {
	googleConfig: Record<string, string>
	isPending: boolean
	actionData: any
}) {
	const [enabled, setEnabled] = useState(
		googleConfig.google_enabled === 'true',
	)

	return (
		<Card>
			<div className="p-6">
				<div className="mb-4">
					<h2 className="font-display text-lg font-semibold text-primary">
						Google Workspace
					</h2>
					<p className="text-body-sm text-muted-foreground">
						Enable Google OAuth login, Gmail signature management, and
						photo sync to Google Workspace.
					</p>
				</div>

				<Form method="POST">
					<input type="hidden" name="section" value="google" />
					<input
						type="hidden"
						name="googleEnabled"
						value={enabled ? 'true' : 'false'}
					/>

					<div className="space-y-3">
						<label className="flex cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								checked={enabled}
								onChange={(e) => setEnabled(e.target.checked)}
								className="h-4 w-4 rounded border-gray-300"
							/>
							<span className="text-body-sm font-medium">
								Enable Google Workspace Integration
							</span>
						</label>

						{enabled && (
							<>
								<Separator className="my-2" />
								<p className="text-body-xs font-semibold">
									OAuth (User Login)
								</p>

								<div>
									<Label htmlFor="googleClientId">Client ID</Label>
									<Input
										id="googleClientId"
										name="googleClientId"
										placeholder="xxx.apps.googleusercontent.com"
										defaultValue={
											googleConfig.google_client_id || ''
										}
									/>
								</div>

								<div>
									<Label htmlFor="googleClientSecret">
										Client Secret
									</Label>
									<Input
										id="googleClientSecret"
										name="googleClientSecret"
										type="password"
										defaultValue={
											googleConfig.google_client_secret || ''
										}
									/>
								</div>

								<div>
									<Label htmlFor="googleRedirectUri">
										Redirect URI
									</Label>
									<Input
										id="googleRedirectUri"
										name="googleRedirectUri"
										placeholder="https://your-app.fly.dev/auth/google/callback"
										defaultValue={
											googleConfig.google_redirect_uri || ''
										}
									/>
								</div>

								<Separator className="my-2" />
								<p className="text-body-xs font-semibold">
									Service Account (Photo Sync & Signatures)
								</p>

								<div>
									<Label htmlFor="googleServiceAccountEmail">
										Service Account Email
									</Label>
									<Input
										id="googleServiceAccountEmail"
										name="googleServiceAccountEmail"
										placeholder="sa@project.iam.gserviceaccount.com"
										defaultValue={
											googleConfig.google_service_account_email ||
											''
										}
									/>
								</div>

								<div>
									<Label htmlFor="googleServiceAccountKey">
										Private Key (PEM)
									</Label>
									<textarea
										id="googleServiceAccountKey"
										name="googleServiceAccountKey"
										rows={3}
										className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
										placeholder={
											'-----BEGIN PRIVATE KEY-----\n...'
										}
										defaultValue={
											googleConfig.google_service_account_key ||
											''
										}
									/>
								</div>

								<div>
									<Label htmlFor="googleAdminEmail">
										Domain Admin Email
									</Label>
									<Input
										id="googleAdminEmail"
										name="googleAdminEmail"
										placeholder="admin@school.org"
										defaultValue={
											googleConfig.google_admin_email || ''
										}
									/>
									<p className="mt-1 text-xs text-muted-foreground">
										Admin email for domain-wide delegation
									</p>
								</div>
							</>
						)}
					</div>

					<div className="mt-4">
						<StatusButton
							status={isPending ? 'pending' : 'idle'}
							type="submit"
							disabled={isPending}
						>
							Save Google Settings
						</StatusButton>
					</div>
				</Form>
			</div>
		</Card>
	)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ColorField({
	id,
	label,
	defaultValue,
}: {
	id: string
	label: string
	defaultValue: string
}) {
	const [color, setColor] = useState(defaultValue)

	return (
		<div>
			<Label htmlFor={id}>{label}</Label>
			<div className="flex items-center gap-2">
				<input
					type="color"
					id={id}
					name={id}
					value={color}
					onChange={(e) => setColor(e.target.value)}
					className="h-9 w-12 cursor-pointer rounded border"
				/>
				<Input
					readOnly
					tabIndex={-1}
					className="font-mono text-xs"
					value={color}
				/>
			</div>
		</div>
	)
}

export const meta: Route.MetaFunction = () => [
	{ title: 'School Settings | Admin' },
	{ name: 'description', content: 'Configure school settings' },
]

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
