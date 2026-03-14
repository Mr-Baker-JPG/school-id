import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useState, useRef, useEffect } from 'react'
import {
	data,
	redirect,
	Form,
	useActionData,
	useNavigation,
	useFetcher,
} from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { Card } from '#app/components/ui/card.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Separator } from '#app/components/ui/separator.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { invalidateFactsConfigCache } from '#app/utils/facts-api.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import {
	EmailSchema,
	PasswordSchema,
	UsernameSchema,
} from '#app/utils/user-validation.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import {
	setSchoolConfigValues,
	invalidateSchoolConfigCache,
} from '#app/utils/school-config.server.ts'
import { GoogleWorkspaceHelp } from '#app/ui/components/GoogleWorkspaceHelp.tsx'
import { type Route } from './+types/install.ts'
import bcrypt from 'bcryptjs'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

// ─── Validation Schemas ──────────────────────────────────────────────────────

const BrandingSchema = z.object({
	step: z.literal('branding'),
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
})

const AdminSchema = z.object({
	step: z.literal('admin'),
	username: UsernameSchema,
	email: EmailSchema,
	password: PasswordSchema,
	name: z.string().min(1, 'Display name is required'),
})

const FactsSchema = z.object({
	step: z.literal('facts'),
	factsSubscriptionKey: z.string().min(1, 'Subscription key is required'),
	factsApiKey: z.string().min(1, 'API key is required'),
	factsBaseUrl: z.string().url('Must be a valid URL'),
})

const GoogleSchema = z.object({
	step: z.literal('google'),
	googleEnabled: z.enum(['true', 'false']),
	googleClientId: z.string().optional().default(''),
	googleClientSecret: z.string().optional().default(''),
	googleRedirectUri: z.string().optional().default(''),
	googleServiceAccountEmail: z.string().optional().default(''),
	googleServiceAccountKey: z.string().optional().default(''),
	googleAdminEmail: z.string().optional().default(''),
})

const CompleteSchema = z.object({
	step: z.literal('complete'),
})

const StepSchema = z.discriminatedUnion('step', [
	BrandingSchema,
	AdminSchema,
	FactsSchema,
	GoogleSchema,
	CompleteSchema,
])

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
	const superAdmin = await prisma.user.findFirst({
		where: { roles: { some: { name: 'admin' } } },
		select: { id: true },
	})

	if (superAdmin) {
		throw redirect('/')
	}

	return {}
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	await checkHoneypot(formData)

	const stepValue = formData.get('step')

	// Parse based on step
	if (stepValue === 'branding') {
		const submission = parseWithZod(formData, { schema: BrandingSchema })
		if (submission.status !== 'success') {
			return data(
				{ step: 'branding', result: submission.reply(), success: false },
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
		return data({ step: 'branding', result: submission.reply(), success: true })
	}

	if (stepValue === 'admin') {
		const submission = parseWithZod(formData, { schema: AdminSchema })
		if (submission.status !== 'success') {
			return data(
				{
					step: 'admin',
					result: submission.reply({ hideFields: ['password'] }),
					success: false,
				},
				{ status: 400 },
			)
		}
		const { username, email, password, name } = submission.value

		const existingUser = await prisma.user.findFirst({
			where: { OR: [{ email: email.toLowerCase() }, { username }] },
		})
		if (existingUser) {
			return data(
				{
					step: 'admin',
					result: submission.reply({
						hideFields: ['password'],
						fieldErrors: {
							email: ['A user with this email or username already exists'],
						},
					}),
					success: false,
				},
				{ status: 400 },
			)
		}

		const hashedPassword = await bcrypt.hash(password, 10)
		// Ensure required roles exist (may not if DB was created without seed data)
		await prisma.role.upsert({
			where: { name: 'user' },
			update: {},
			create: { name: 'user' },
		})
		await prisma.role.upsert({
			where: { name: 'admin' },
			update: {},
			create: { name: 'admin' },
		})
		await prisma.user.create({
			data: {
				email: email.toLowerCase(),
				username: username.toLowerCase(),
				name,
				roles: { connect: [{ name: 'user' }, { name: 'admin' }] },
				password: { create: { hash: hashedPassword } },
			},
		})
		return data({
			step: 'admin',
			result: submission.reply({ hideFields: ['password'] }),
			success: true,
		})
	}

	if (stepValue === 'facts') {
		const submission = parseWithZod(formData, { schema: FactsSchema })
		if (submission.status !== 'success') {
			return data(
				{ step: 'facts', result: submission.reply(), success: false },
				{ status: 400 },
			)
		}
		const v = submission.value
		// Store FACTS config in SystemSetting (server reads these at runtime)
		await setSchoolConfigValues({
			facts_subscription_key: v.factsSubscriptionKey,
			facts_api_key: v.factsApiKey,
			facts_base_url: v.factsBaseUrl,
		})
		invalidateFactsConfigCache()
		return data({ step: 'facts', result: submission.reply(), success: true })
	}

	if (stepValue === 'google') {
		const submission = parseWithZod(formData, { schema: GoogleSchema })
		if (submission.status !== 'success') {
			return data(
				{ step: 'google', result: submission.reply(), success: false },
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
		return data({ step: 'google', result: submission.reply(), success: true })
	}

	if (stepValue === 'complete') {
		// Mark setup as complete
		await setSchoolConfigValues({ setup_complete: 'true' })
		invalidateSchoolConfigCache()
		return redirectWithToast('/login', {
			type: 'success',
			title: 'Setup Complete!',
			description:
				'Your School ID system is ready. Please log in to continue.',
		})
	}

	return data(
		{ step: 'unknown', result: null, success: false },
		{ status: 400 },
	)
}

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep =
	| 'welcome'
	| 'branding'
	| 'admin'
	| 'facts'
	| 'google'
	| 'review'

const STEPS: WizardStep[] = [
	'welcome',
	'branding',
	'admin',
	'facts',
	'google',
	'review',
]

const STEP_LABELS: Record<WizardStep, string> = {
	welcome: 'Welcome',
	branding: 'School Branding',
	admin: 'Admin Account',
	facts: 'FACTS SIS',
	google: 'Google (Optional)',
	review: 'Review & Finish',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InstallRoute({
	actionData,
}: Route.ComponentProps) {
	const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
	const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(
		new Set(),
	)
	const navigation = useNavigation()
	const isPending = navigation.state === 'submitting'

	// Track saved form data for review
	const [savedData, setSavedData] = useState<Record<string, any>>({})

	// Auto-advance on successful step submission
	useEffect(() => {
		if (actionData?.success && actionData?.step) {
			const stepName = actionData.step as WizardStep
			setCompletedSteps((prev) => new Set([...prev, stepName]))

			const currentIndex = STEPS.indexOf(stepName)
			if (currentIndex < STEPS.length - 1) {
				setCurrentStep(STEPS[currentIndex + 1]!)
			}
		}
	}, [actionData])

	const stepIndex = STEPS.indexOf(currentStep)

	function goBack() {
		if (stepIndex > 0) {
			setCurrentStep(STEPS[stepIndex - 1]!)
		}
	}

	function goNext() {
		if (stepIndex < STEPS.length - 1) {
			setCurrentStep(STEPS[stepIndex + 1]!)
		}
	}

	function handleFormDataCapture(formData: Record<string, any>) {
		setSavedData((prev) => ({ ...prev, ...formData }))
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-900 dark:to-slate-800">
			{/* Progress indicator */}
			<div className="mb-6 flex items-center gap-2">
				{STEPS.map((step, i) => (
					<div key={step} className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								// Allow navigating to completed steps or current step
								if (completedSteps.has(step) || step === currentStep) {
									setCurrentStep(step)
								}
							}}
							className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
								step === currentStep
									? 'bg-primary text-primary-foreground'
									: completedSteps.has(step)
										? 'bg-green-500 text-white'
										: 'bg-muted text-muted-foreground'
							} ${completedSteps.has(step) || step === currentStep ? 'cursor-pointer' : 'cursor-default'}`}
						>
							{completedSteps.has(step) ? '✓' : i + 1}
						</button>
						{i < STEPS.length - 1 && (
							<div
								className={`h-0.5 w-6 ${completedSteps.has(step) ? 'bg-green-500' : 'bg-muted'}`}
							/>
						)}
					</div>
				))}
			</div>

			{/* Step label */}
			<p className="text-muted-foreground mb-4 text-sm">
				Step {stepIndex + 1} of {STEPS.length} —{' '}
				{STEP_LABELS[currentStep]}
			</p>

			<Card className="w-full max-w-lg">
				<div className="p-6">
					{currentStep === 'welcome' && (
						<WelcomeStep onNext={goNext} />
					)}
					{currentStep === 'branding' && (
						<BrandingStep
							actionData={
								actionData?.step === 'branding' ? actionData : undefined
							}
							isPending={isPending}
							onCapture={handleFormDataCapture}
							savedData={savedData}
						/>
					)}
					{currentStep === 'admin' && (
						<AdminStep
							actionData={
								actionData?.step === 'admin' ? actionData : undefined
							}
							isPending={isPending}
							onCapture={handleFormDataCapture}
							savedData={savedData}
						/>
					)}
					{currentStep === 'facts' && (
						<FactsStep
							actionData={
								actionData?.step === 'facts' ? actionData : undefined
							}
							isPending={isPending}
							onCapture={handleFormDataCapture}
							savedData={savedData}
						/>
					)}
					{currentStep === 'google' && (
						<GoogleStep
							actionData={
								actionData?.step === 'google' ? actionData : undefined
							}
							isPending={isPending}
							onCapture={handleFormDataCapture}
							savedData={savedData}
						/>
					)}
					{currentStep === 'review' && (
						<ReviewStep
							savedData={savedData}
							isPending={isPending}
							completedSteps={completedSteps}
						/>
					)}

					{/* Back button for non-welcome, non-review steps */}
					{currentStep !== 'welcome' && currentStep !== 'review' && (
						<div className="mt-4 flex justify-start">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={goBack}
							>
								← Back
							</Button>
						</div>
					)}
				</div>
			</Card>
		</div>
	)
}

// ─── Step Components ─────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
	return (
		<div className="flex flex-col gap-6 text-center">
			<div>
				<h1 className="text-h1 mb-2">Welcome to School ID</h1>
				<p className="text-body-md text-muted-foreground">
					Set up your school's ID card system in just a few minutes.
				</p>
			</div>

			<div className="text-body-sm text-left space-y-3">
				<p className="font-semibold">Here's what you'll configure:</p>
				<ul className="ml-4 list-disc space-y-1.5 text-muted-foreground">
					<li>
						<strong>School Branding</strong> — Name, colors, logo
					</li>
					<li>
						<strong>Admin Account</strong> — Your first administrator
					</li>
					<li>
						<strong>FACTS SIS</strong> — Connect to your student
						information system
					</li>
					<li>
						<strong>Google Workspace</strong> — Optional OAuth & photo
						sync
					</li>
				</ul>
				<p className="text-muted-foreground text-xs mt-4">
					You'll need your FACTS API credentials. Google Workspace
					credentials are optional and can be configured later.
				</p>
			</div>

			<Button onClick={onNext} size="lg" className="w-full">
				Get Started →
			</Button>
		</div>
	)
}

function BrandingStep({
	actionData,
	isPending,
	onCapture,
	savedData,
}: {
	actionData: any
	isPending: boolean
	onCapture: (data: Record<string, any>) => void
	savedData: Record<string, any>
}) {
	const formRef = useRef<HTMLFormElement>(null)

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-h3 mb-1">School Branding</h2>
				<p className="text-body-sm text-muted-foreground">
					This information appears on ID cards and throughout the system.
				</p>
			</div>

			<Form
				ref={formRef}
				method="POST"
				onSubmit={() => {
					if (formRef.current) {
						const fd = new FormData(formRef.current)
						const obj: Record<string, any> = {}
						fd.forEach((v, k) => (obj[k] = v))
						onCapture(obj)
					}
				}}
			>
				<HoneypotInputs />
				<input type="hidden" name="step" value="branding" />

				<div className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label htmlFor="schoolName">School Name *</Label>
							<Input
								id="schoolName"
								name="schoolName"
								placeholder="Springfield Academy"
								defaultValue={
									savedData.schoolName || ''
								}
								required
							/>
						</div>
						<div>
							<Label htmlFor="schoolShortName">Short Name *</Label>
							<Input
								id="schoolShortName"
								name="schoolShortName"
								placeholder="SA"
								maxLength={10}
								defaultValue={
									savedData.schoolShortName || ''
								}
								required
							/>
						</div>
					</div>

					<div>
						<Label htmlFor="emailDomain">Email Domain</Label>
						<Input
							id="emailDomain"
							name="emailDomain"
							placeholder="springfieldacademy.org"
							defaultValue={savedData.emailDomain || ''}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Used to restrict OAuth logins to your school's domain
						</p>
					</div>

					<div>
						<Label htmlFor="schoolWebsite">Website URL</Label>
						<Input
							id="schoolWebsite"
							name="schoolWebsite"
							placeholder="https://springfieldacademy.org"
							defaultValue={savedData.schoolWebsite || ''}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label htmlFor="addressLine1">Address Line 1</Label>
							<Input
								id="addressLine1"
								name="addressLine1"
								placeholder="123 Main St"
								defaultValue={savedData.addressLine1 || ''}
							/>
						</div>
						<div>
							<Label htmlFor="addressLine2">City, State ZIP</Label>
							<Input
								id="addressLine2"
								name="addressLine2"
								placeholder="Springfield, IL 62701"
								defaultValue={savedData.addressLine2 || ''}
							/>
						</div>
					</div>

					<div>
						<Label htmlFor="phone">Phone</Label>
						<Input
							id="phone"
							name="phone"
							placeholder="(555) 123-4567"
							defaultValue={savedData.phone || ''}
						/>
					</div>

					<Separator className="my-2" />

					<p className="text-body-sm font-semibold">Brand Colors</p>
					<div className="grid grid-cols-3 gap-3">
						<div>
							<Label htmlFor="primaryColor">Primary</Label>
							<div className="flex items-center gap-2">
								<input
									type="color"
									id="primaryColor"
									name="primaryColor"
									defaultValue={
										savedData.primaryColor || '#1B2A4A'
									}
									className="h-9 w-12 cursor-pointer rounded border"
								/>
								<Input
									name="primaryColorText"
									readOnly
									tabIndex={-1}
									className="font-mono text-xs"
									defaultValue={
										savedData.primaryColor || '#1B2A4A'
									}
								/>
							</div>
						</div>
						<div>
							<Label htmlFor="secondaryColor">Secondary</Label>
							<div className="flex items-center gap-2">
								<input
									type="color"
									id="secondaryColor"
									name="secondaryColor"
									defaultValue={
										savedData.secondaryColor || '#8B1A2B'
									}
									className="h-9 w-12 cursor-pointer rounded border"
								/>
								<Input
									name="secondaryColorText"
									readOnly
									tabIndex={-1}
									className="font-mono text-xs"
									defaultValue={
										savedData.secondaryColor || '#8B1A2B'
									}
								/>
							</div>
						</div>
						<div>
							<Label htmlFor="accentColor">Accent</Label>
							<div className="flex items-center gap-2">
								<input
									type="color"
									id="accentColor"
									name="accentColor"
									defaultValue={
										savedData.accentColor || '#F5F0E8'
									}
									className="h-9 w-12 cursor-pointer rounded border"
								/>
								<Input
									name="accentColorText"
									readOnly
									tabIndex={-1}
									className="font-mono text-xs"
									defaultValue={
										savedData.accentColor || '#F5F0E8'
									}
								/>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-4">
					<StatusButton
						className="w-full"
						status={isPending ? 'pending' : 'idle'}
						type="submit"
						disabled={isPending}
					>
						Save & Continue →
					</StatusButton>
				</div>

				{actionData?.result?.error && (
					<div className="mt-2">
						<ErrorList
							errors={Object.values(
								actionData.result.error.fieldErrors || {},
							).flat() as string[]}
						/>
					</div>
				)}
			</Form>
		</div>
	)
}

function AdminStep({
	actionData,
	isPending,
	onCapture,
	savedData,
}: {
	actionData: any
	isPending: boolean
	onCapture: (data: Record<string, any>) => void
	savedData: Record<string, any>
}) {
	const formRef = useRef<HTMLFormElement>(null)

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-h3 mb-1">Admin Account</h2>
				<p className="text-body-sm text-muted-foreground">
					Create the first administrator who will manage the system.
				</p>
			</div>

			<Form
				ref={formRef}
				method="POST"
				onSubmit={() => {
					if (formRef.current) {
						const fd = new FormData(formRef.current)
						const obj: Record<string, any> = {}
						fd.forEach((v, k) => {
							if (k !== 'password') obj[k] = v
						})
						obj.adminEmail = fd.get('email')
						obj.adminName = fd.get('name')
						obj.adminUsername = fd.get('username')
						onCapture(obj)
					}
				}}
			>
				<HoneypotInputs />
				<input type="hidden" name="step" value="admin" />

				<div className="space-y-3">
					<div>
						<Label htmlFor="name">Display Name *</Label>
						<Input
							id="name"
							name="name"
							placeholder="John Smith"
							defaultValue={savedData.adminName || savedData.name || ''}
							required
						/>
					</div>

					<div>
						<Label htmlFor="username">Username *</Label>
						<Input
							id="username"
							name="username"
							placeholder="jsmith"
							autoComplete="username"
							className="lowercase"
							defaultValue={
								savedData.adminUsername || savedData.username || ''
							}
							required
						/>
					</div>

					<div>
						<Label htmlFor="email">Email *</Label>
						<Input
							id="email"
							name="email"
							type="email"
							placeholder="admin@school.org"
							autoComplete="email"
							defaultValue={
								savedData.adminEmail || savedData.email || ''
							}
							required
						/>
					</div>

					<div>
						<Label htmlFor="password">Password *</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autoComplete="new-password"
							placeholder="Min 6 characters"
							required
						/>
					</div>
				</div>

				<div className="mt-4">
					<StatusButton
						className="w-full"
						status={isPending ? 'pending' : 'idle'}
						type="submit"
						disabled={isPending}
					>
						Create Admin & Continue →
					</StatusButton>
				</div>

				{actionData?.result?.error && (
					<div className="mt-2">
						<ErrorList
							errors={Object.values(
								actionData.result.error.fieldErrors || {},
							).flat() as string[]}
						/>
					</div>
				)}
			</Form>
		</div>
	)
}

function FactsStep({
	actionData,
	isPending,
	onCapture,
	savedData,
}: {
	actionData: any
	isPending: boolean
	onCapture: (data: Record<string, any>) => void
	savedData: Record<string, any>
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
		} catch (e) {
			setTestResult({
				status: 'error',
				message: 'Network error — could not reach test endpoint',
			})
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-h3 mb-1">FACTS SIS Connection</h2>
				<p className="text-body-sm text-muted-foreground">
					Connect to your FACTS Student Information System to sync
					students and employees.
				</p>
			</div>

			<div className="rounded-md border border-blue-200 bg-blue-50/50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
				<p className="text-body-sm font-medium text-blue-900 dark:text-blue-300">
					Need to set up your FACTS API?
				</p>
				<ol className="mt-1.5 list-decimal ml-4 space-y-1 text-xs text-blue-800 dark:text-blue-400">
					<li>
						<a
							href="https://developers.factsmgt.com/sign-up"
							target="_blank"
							rel="noopener noreferrer"
							className="font-medium underline hover:no-underline"
						>
							Sign up for a FACTS Developer account
						</a>{' '}
						to get your API credentials.
					</li>
					<li>
						Follow the{' '}
						<a
							href="https://www.nbshubhelp.com/FACTS_SIS/System/API_Configuration"
							target="_blank"
							rel="noopener noreferrer"
							className="font-medium underline hover:no-underline"
						>
							FACTS API Configuration guide
						</a>{' '}
						to enable API access in your FACTS SIS.
					</li>
				</ol>
			</div>

			<Form
				ref={formRef}
				method="POST"
				onSubmit={() => {
					if (formRef.current) {
						const fd = new FormData(formRef.current)
						const obj: Record<string, any> = {}
						fd.forEach((v, k) => (obj[k] = v))
						onCapture(obj)
					}
				}}
			>
				<HoneypotInputs />
				<input type="hidden" name="step" value="facts" />

				<div className="space-y-3">
					<div>
						<Label htmlFor="factsBaseUrl">FACTS API Base URL *</Label>
						<Input
							id="factsBaseUrl"
							name="factsBaseUrl"
							placeholder="https://api.factsmgt.com"
							defaultValue={
								savedData.factsBaseUrl ||
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
							placeholder="Your FACTS API subscription key"
							defaultValue={savedData.factsSubscriptionKey || ''}
							required
						/>
						<p className="text-xs text-muted-foreground mt-1">
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
							placeholder="Your FACTS API key"
							defaultValue={savedData.factsApiKey || ''}
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
						className="w-full"
						status={isPending ? 'pending' : 'idle'}
						type="submit"
						disabled={isPending}
					>
						Save & Continue →
					</StatusButton>
				</div>
			</Form>
		</div>
	)
}

function GoogleStep({
	actionData,
	isPending,
	onCapture,
	savedData,
}: {
	actionData: any
	isPending: boolean
	onCapture: (data: Record<string, any>) => void
	savedData: Record<string, any>
}) {
	const formRef = useRef<HTMLFormElement>(null)
	const [enabled, setEnabled] = useState(
		savedData.googleEnabled === 'true',
	)

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-h3 mb-1">Google Workspace</h2>
					<p className="text-body-sm text-muted-foreground">
						Optional. Enable Google OAuth login, Gmail signature
						management, and photo sync to Google Workspace.
					</p>
				</div>
				<GoogleWorkspaceHelp />
			</div>

			<Form
				ref={formRef}
				method="POST"
				onSubmit={() => {
					if (formRef.current) {
						const fd = new FormData(formRef.current)
						const obj: Record<string, any> = {}
						fd.forEach((v, k) => (obj[k] = v))
						onCapture(obj)
					}
				}}
			>
				<HoneypotInputs />
				<input type="hidden" name="step" value="google" />
				<input
					type="hidden"
					name="googleEnabled"
					value={enabled ? 'true' : 'false'}
				/>

				<div className="space-y-3">
					<label className="flex items-center gap-3 cursor-pointer">
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
										savedData.googleClientId || ''
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
										savedData.googleClientSecret || ''
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
										savedData.googleRedirectUri || ''
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
										savedData.googleServiceAccountEmail || ''
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
									className="w-full rounded-md border px-3 py-2 text-xs font-mono bg-background"
									placeholder="-----BEGIN PRIVATE KEY-----&#10;..."
									defaultValue={
										savedData.googleServiceAccountKey || ''
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
										savedData.googleAdminEmail || ''
									}
								/>
								<p className="text-xs text-muted-foreground mt-1">
									Admin email for domain-wide delegation
								</p>
							</div>
						</>
					)}
				</div>

				<div className="mt-4">
					<StatusButton
						className="w-full"
						status={isPending ? 'pending' : 'idle'}
						type="submit"
						disabled={isPending}
					>
						{enabled ? 'Save & Continue →' : 'Skip & Continue →'}
					</StatusButton>
				</div>
			</Form>
		</div>
	)
}

function ReviewStep({
	savedData,
	isPending,
	completedSteps,
}: {
	savedData: Record<string, any>
	isPending: boolean
	completedSteps: Set<WizardStep>
}) {
	const requiredSteps: WizardStep[] = ['branding', 'admin', 'facts']
	const missingSteps = requiredSteps.filter((s) => !completedSteps.has(s))

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-h3 mb-1">Review & Finish</h2>
				<p className="text-body-sm text-muted-foreground">
					Here's a summary of your configuration.
				</p>
			</div>

			<div className="space-y-4 text-sm">
				<ReviewSection
					title="School"
					done={completedSteps.has('branding')}
					items={[
						['Name', savedData.schoolName],
						['Short Name', savedData.schoolShortName],
						['Domain', savedData.emailDomain],
						['Website', savedData.schoolWebsite],
					]}
				/>

				<ReviewSection
					title="Admin"
					done={completedSteps.has('admin')}
					items={[
						['Name', savedData.adminName || savedData.name],
						['Username', savedData.adminUsername || savedData.username],
						['Email', savedData.adminEmail || savedData.email],
					]}
				/>

				<ReviewSection
					title="FACTS SIS"
					done={completedSteps.has('facts')}
					items={[
						['Base URL', savedData.factsBaseUrl],
						[
							'Subscription Key',
							savedData.factsSubscriptionKey
								? '••••' +
									savedData.factsSubscriptionKey.slice(-4)
								: undefined,
						],
					]}
				/>

				<ReviewSection
					title="Google Workspace"
					done={completedSteps.has('google')}
					items={[
						[
							'Status',
							savedData.googleEnabled === 'true'
								? 'Enabled'
								: 'Disabled',
						],
					]}
				/>
			</div>

			{missingSteps.length > 0 && (
				<div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
					Please complete:{' '}
					{missingSteps.map((s) => STEP_LABELS[s]).join(', ')}
				</div>
			)}

			<Form method="POST">
				<HoneypotInputs />
				<input type="hidden" name="step" value="complete" />
				<StatusButton
					className="w-full"
					status={isPending ? 'pending' : 'idle'}
					type="submit"
					disabled={isPending || missingSteps.length > 0}
				>
					Complete Setup 🚀
				</StatusButton>
			</Form>
		</div>
	)
}

function ReviewSection({
	title,
	done,
	items,
}: {
	title: string
	done: boolean
	items: [string, string | undefined][]
}) {
	return (
		<div className="rounded-md border p-3">
			<div className="flex items-center gap-2 mb-1.5">
				<span
					className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}
				>
					{done ? '✓' : '—'}
				</span>
				<span className="font-semibold">{title}</span>
			</div>
			{items
				.filter(([, v]) => v)
				.map(([label, value]) => (
					<div
						key={label}
						className="flex justify-between text-xs py-0.5"
					>
						<span className="text-muted-foreground">{label}</span>
						<span className="font-medium">{value}</span>
					</div>
				))}
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
