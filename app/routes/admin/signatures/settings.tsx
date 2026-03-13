import * as React from 'react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, useActionData, useNavigation, useLoaderData } from 'react-router'
import { z } from 'zod'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Textarea } from '#app/components/ui/textarea.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import {
	getSchoolSettingsForSignatures,
	setSystemSettings,
	SYSTEM_SETTING_KEYS,
} from '#app/utils/system-settings.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/settings.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const SettingsSchema = z.object({
	schoolName: z.string().min(1, 'School name is required'),
	schoolPhone: z.string().optional(),
	schoolAddress: z.string().optional(),
	schoolWebsite: z.string().url('Must be a valid URL').optional().or(z.literal('')),
	schoolLogoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	const settings = await getSchoolSettingsForSignatures()
	return { settings }
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')

	const formData = await request.formData()
	const result = SettingsSchema.safeParse(Object.fromEntries(formData))

	if (!result.success) {
		return {
			status: 'error' as const,
			errors: result.error.flatten().fieldErrors,
		}
	}

	const { schoolName, schoolPhone, schoolAddress, schoolWebsite, schoolLogoUrl } = result.data

	await setSystemSettings({
		[SYSTEM_SETTING_KEYS.SCHOOL_NAME]: schoolName,
		[SYSTEM_SETTING_KEYS.SCHOOL_PHONE]: schoolPhone ?? '',
		[SYSTEM_SETTING_KEYS.SCHOOL_ADDRESS]: schoolAddress ?? '',
		[SYSTEM_SETTING_KEYS.SCHOOL_WEBSITE]: schoolWebsite ?? '',
		[SYSTEM_SETTING_KEYS.SCHOOL_LOGO_URL]: schoolLogoUrl ?? '',
	})

	return redirectWithToast('/admin/signatures/settings', {
		type: 'success',
		title: 'Settings saved',
		description: 'School information has been updated.',
	})
}

export default function SignatureSettingsPage() {
	const { settings } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const isSubmitting = navigation.state !== 'idle'

	// Form state
	const [schoolName, setSchoolName] = React.useState(settings.schoolName)
	const [schoolPhone, setSchoolPhone] = React.useState(settings.schoolPhone)
	const [schoolAddress, setSchoolAddress] = React.useState(settings.schoolAddress)
	const [schoolWebsite, setSchoolWebsite] = React.useState(settings.schoolWebsite)
	const [schoolLogoUrl, setSchoolLogoUrl] = React.useState(settings.schoolLogoUrl)

	// Reset form when settings change from server
	React.useEffect(() => {
		setSchoolName(settings.schoolName)
		setSchoolPhone(settings.schoolPhone)
		setSchoolAddress(settings.schoolAddress)
		setSchoolWebsite(settings.schoolWebsite)
		setSchoolLogoUrl(settings.schoolLogoUrl)
	}, [settings])

	return (
		<div className="h-full overflow-y-auto px-6 py-6">
			<div className="mx-auto max-w-2xl space-y-6">
				{/* Navigation Tabs */}
				<div className="flex items-center gap-4 border-b pb-4">
					<a
						href="/admin/signatures/templates"
						className="text-muted-foreground hover:text-foreground"
					>
						Templates
					</a>
					<a
						href="/admin/signatures/push"
						className="text-muted-foreground hover:text-foreground"
					>
						Push to Gmail
					</a>
					<a
						href="/admin/signatures/history"
						className="text-muted-foreground hover:text-foreground"
					>
						Push History
					</a>
					<a
						href="/admin/signatures/settings"
						className="text-primary font-semibold"
					>
						Settings
					</a>
				</div>

				<PageTitle
					title="Signature Settings"
					subtitle="Configure school information used in email signature templates."
				/>

				<Form method="post" className="space-y-6">
					<div className="space-y-2">
						<Label htmlFor="schoolName">
							School Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="schoolName"
							name="schoolName"
							value={schoolName}
							onChange={(e) => setSchoolName(e.target.value)}
							placeholder="e.g. JPG Academy"
							required
						/>
						<p className="text-muted-foreground text-xs">
							Used for the {'{{schoolName}}'} placeholder in templates
						</p>
						{actionData && 'errors' in actionData && actionData.errors?.schoolName && (
							<p className="text-destructive text-sm">{actionData.errors.schoolName[0]}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="schoolPhone">School Phone</Label>
						<Input
							id="schoolPhone"
							name="schoolPhone"
							value={schoolPhone}
							onChange={(e) => setSchoolPhone(e.target.value)}
							placeholder="e.g. (555) 123-4567"
							type="tel"
						/>
						<p className="text-muted-foreground text-xs">
							Used for the {'{{phone}}'} placeholder in templates
						</p>
						{actionData && 'errors' in actionData && actionData.errors?.schoolPhone && (
							<p className="text-destructive text-sm">{actionData.errors.schoolPhone[0]}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="schoolAddress">School Address</Label>
						<Textarea
							id="schoolAddress"
							name="schoolAddress"
							value={schoolAddress}
							onChange={(e) => setSchoolAddress(e.target.value)}
							placeholder="e.g. 123 Education Lane, City, ST 12345"
							rows={2}
						/>
						<p className="text-muted-foreground text-xs">
							Used for the {'{{schoolAddress}}'} placeholder in templates
						</p>
						{actionData && 'errors' in actionData && actionData.errors?.schoolAddress && (
							<p className="text-destructive text-sm">{actionData.errors.schoolAddress[0]}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="schoolWebsite">School Website</Label>
						<Input
							id="schoolWebsite"
							name="schoolWebsite"
							value={schoolWebsite}
							onChange={(e) => setSchoolWebsite(e.target.value)}
							placeholder="e.g. https://www.jpgacademy.org"
							type="url"
						/>
						<p className="text-muted-foreground text-xs">
							Used for the {'{{schoolWebsite}}'} placeholder in templates
						</p>
						{actionData && 'errors' in actionData && actionData.errors?.schoolWebsite && (
							<p className="text-destructive text-sm">{actionData.errors.schoolWebsite[0]}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="schoolLogoUrl">School Logo URL</Label>
						<Input
							id="schoolLogoUrl"
							name="schoolLogoUrl"
							value={schoolLogoUrl}
							onChange={(e) => setSchoolLogoUrl(e.target.value)}
							placeholder="e.g. https://www.jpgacademy.org/logo.png"
							type="url"
						/>
						<p className="text-muted-foreground text-xs">
							URL to the school logo image for the {'{{schoolLogoUrl}}'} placeholder
						</p>
						{actionData && 'errors' in actionData && actionData.errors?.schoolLogoUrl && (
							<p className="text-destructive text-sm">{actionData.errors.schoolLogoUrl[0]}</p>
						)}
					</div>

					<div className="flex items-center gap-2 pt-4">
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? (
								<>
									<Icon name="update" className="mr-2 size-4 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<Icon name="check" className="mr-2 size-4" />
									Save Settings
								</>
							)}
						</Button>
					</div>
				</Form>

				{/* Info Box */}
				<div className="bg-muted/50 rounded-lg border p-4">
					<h3 className="mb-2 text-sm font-semibold">Available Placeholders</h3>
					<p className="text-muted-foreground mb-2 text-xs">
						These settings are used in signature templates with the following placeholders:
					</p>
					<div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
						<div className="flex items-center gap-2 text-sm">
							<code className="bg-background rounded px-1.5 py-0.5 text-xs font-mono">
								{'{{schoolName}}'}
							</code>
							<span className="text-muted-foreground">School name</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<code className="bg-background rounded px-1.5 py-0.5 text-xs font-mono">
								{'{{phone}}'}
							</code>
							<span className="text-muted-foreground">School phone</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<code className="bg-background rounded px-1.5 py-0.5 text-xs font-mono">
								{'{{schoolAddress}}'}
							</code>
							<span className="text-muted-foreground">School address</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<code className="bg-background rounded px-1.5 py-0.5 text-xs font-mono">
								{'{{schoolWebsite}}'}
							</code>
							<span className="text-muted-foreground">School website</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<code className="bg-background rounded px-1.5 py-0.5 text-xs font-mono">
								{'{{schoolLogoUrl}}'}
							</code>
							<span className="text-muted-foreground">School logo URL</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
