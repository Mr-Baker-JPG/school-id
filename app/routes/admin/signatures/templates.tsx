import * as React from 'react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, useNavigation, useActionData } from 'react-router'
import { z } from 'zod'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Textarea } from '#app/components/ui/textarea.tsx'
import { Badge } from '#app/components/ui/badge.tsx'
import { SignatureEditor } from '#app/components/signature-editor.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { getSchoolSettingsForSignatures } from '#app/utils/system-settings.server.ts'
import { type Route } from './+types/templates.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

// Supported placeholders for signature templates
export const TEMPLATE_PLACEHOLDERS = [
	{ key: '{{fullName}}', description: 'Full name (e.g. John Smith)' },
	{ key: '{{firstName}}', description: 'First name (e.g. John)' },
	{ key: '{{lastName}}', description: 'Last name (e.g. Smith)' },
	{ key: '{{jobTitle}}', description: 'Job title (e.g. Teacher)' },
	{ key: '{{department}}', description: 'Department (e.g. Mathematics)' },
	{ key: '{{email}}', description: 'Email address' },
	{ key: '{{phone}}', description: 'School phone number' },
	{ key: '{{schoolName}}', description: 'School name' },
	{ key: '{{schoolAddress}}', description: 'School address' },
	{ key: '{{schoolWebsite}}', description: 'School website URL' },
	{ key: '{{schoolLogoUrl}}', description: 'School logo image URL' },
] as const

// Sample employee data (school settings come from loader)
export const SAMPLE_EMPLOYEE_BASE = {
	fullName: 'Jane A. Smith',
	firstName: 'Jane',
	lastName: 'Smith',
	jobTitle: 'Mathematics Teacher',
	department: 'Mathematics',
	email: 'jane.smith@jpgacademy.org',
}

// Full sample with default school settings (for backward compatibility with tests)
export const SAMPLE_EMPLOYEE = {
	...SAMPLE_EMPLOYEE_BASE,
	phone: '(555) 123-4567',
	schoolName: 'JPG Academy',
	schoolAddress: '123 Education Lane, City, ST 12345',
	schoolWebsite: 'https://www.jpgacademy.org',
	schoolLogoUrl: 'https://www.jpgacademy.org/logo.png',
}

/**
 * Render a signature template with placeholder data
 */
export function renderTemplate(
	htmlContent: string,
	data: Record<string, string>,
): string {
	let rendered = htmlContent
	for (const [key, value] of Object.entries(data)) {
		rendered = rendered.replaceAll(`{{${key}}}`, value)
	}
	return rendered
}

const CreateSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255),
	htmlContent: z.string().min(1, 'HTML content is required'),
	isDefault: z.preprocess((v) => v === 'on' || v === 'true', z.boolean().default(false)),
})

const UpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1, 'Name is required').max(255),
	htmlContent: z.string().min(1, 'HTML content is required'),
	isDefault: z.preprocess((v) => v === 'on' || v === 'true', z.boolean().default(false)),
})

const DeleteSchema = z.object({
	id: z.string().min(1),
})

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	const [templates, schoolSettings] = await Promise.all([
		prisma.signatureTemplate.findMany({
			orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
		}),
		getSchoolSettingsForSignatures(),
	])

	return { templates, schoolSettings }
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')

	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'create') {
		const result = CreateSchema.safeParse(Object.fromEntries(formData))
		if (!result.success) {
			return {
				status: 'error' as const,
				errors: result.error.flatten().fieldErrors,
			}
		}

		const { name, htmlContent, isDefault } = result.data

		// Check uniqueness
		const existing = await prisma.signatureTemplate.findUnique({
			where: { name },
		})
		if (existing) {
			return {
				status: 'error' as const,
				errors: { name: ['A template with this name already exists'] },
			}
		}

		// If setting as default, unset other defaults
		if (isDefault) {
			await prisma.signatureTemplate.updateMany({
				where: { isDefault: true },
				data: { isDefault: false },
			})
		}

		await prisma.signatureTemplate.create({
			data: { name, htmlContent, isDefault },
		})

		return redirectWithToast('/admin/signatures/templates', {
			type: 'success',
			title: 'Template created',
			description: `"${name}" has been created.`,
		})
	}

	if (intent === 'update') {
		const result = UpdateSchema.safeParse(Object.fromEntries(formData))
		if (!result.success) {
			return {
				status: 'error' as const,
				errors: result.error.flatten().fieldErrors,
			}
		}

		const { id, name, htmlContent, isDefault } = result.data

		// Check uniqueness (exclude self)
		const existing = await prisma.signatureTemplate.findFirst({
			where: { name, NOT: { id } },
		})
		if (existing) {
			return {
				status: 'error' as const,
				errors: { name: ['A template with this name already exists'] },
			}
		}

		// If setting as default, unset other defaults
		if (isDefault) {
			await prisma.signatureTemplate.updateMany({
				where: { isDefault: true, NOT: { id } },
				data: { isDefault: false },
			})
		}

		await prisma.signatureTemplate.update({
			where: { id },
			data: { name, htmlContent, isDefault },
		})

		return redirectWithToast('/admin/signatures/templates', {
			type: 'success',
			title: 'Template updated',
			description: `"${name}" has been updated.`,
		})
	}

	if (intent === 'delete') {
		const result = DeleteSchema.safeParse(Object.fromEntries(formData))
		if (!result.success) {
			return {
				status: 'error' as const,
				errors: { id: ['Invalid template ID'] },
			}
		}

		const template = await prisma.signatureTemplate.findUnique({
			where: { id: result.data.id },
		})
		if (!template) {
			return {
				status: 'error' as const,
				errors: { id: ['Template not found'] },
			}
		}

		await prisma.signatureTemplate.delete({
			where: { id: result.data.id },
		})

		return redirectWithToast('/admin/signatures/templates', {
			type: 'success',
			title: 'Template deleted',
			description: `"${template.name}" has been deleted.`,
		})
	}

	return { status: 'error' as const, errors: { intent: ['Unknown action'] } }
}

export default function SignatureTemplatesPage({
	loaderData,
}: Route.ComponentProps) {
	const { templates, schoolSettings } = loaderData
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const isSubmitting = navigation.state !== 'idle'

	const [editingId, setEditingId] = React.useState<string | null>(null)
	const [showCreate, setShowCreate] = React.useState(false)
	const [previewHtml, setPreviewHtml] = React.useState<string>('')
	const [previewName, setPreviewName] = React.useState<string>('Preview')

	// Build sample employee with school settings
	const sampleEmployee = React.useMemo(() => ({
		...SAMPLE_EMPLOYEE_BASE,
		phone: schoolSettings.schoolPhone,
		schoolName: schoolSettings.schoolName,
		schoolAddress: schoolSettings.schoolAddress,
		schoolWebsite: schoolSettings.schoolWebsite,
		schoolLogoUrl: schoolSettings.schoolLogoUrl,
	}), [schoolSettings])

	// Reset form state after successful action
	React.useEffect(() => {
		if (actionData && 'status' in actionData && actionData.status !== 'error') {
			setEditingId(null)
			setShowCreate(false)
		}
	}, [actionData])

	function handlePreview(htmlContent: string, name: string) {
		const rendered = renderTemplate(htmlContent, sampleEmployee)
		setPreviewHtml(rendered)
		setPreviewName(name || 'Preview')
	}

	return (
		<div className="h-full overflow-y-auto px-6 py-6">
			<div className="mx-auto max-w-4xl space-y-6">
				{/* Navigation Tabs */}
				<div className="flex items-center gap-4 border-b pb-4">
					<a
						href="/admin/signatures/templates"
						className="text-primary font-semibold"
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
						className="text-muted-foreground hover:text-foreground"
					>
						Settings
					</a>
				</div>

				<div className="flex items-center justify-between">
					<PageTitle
						title="Signature Templates"
						subtitle="Create and manage HTML email signature templates with placeholder support."
					/>
					{!showCreate && (
						<Button onClick={() => setShowCreate(true)}>
							<Icon name="plus" className="mr-2 size-4" />
							New Template
						</Button>
					)}
				</div>

				{/* Placeholder Reference */}
				<div className="bg-muted/50 rounded-lg border p-4">
					<h3 className="mb-2 text-sm font-semibold">
						Available Placeholders
					</h3>
					<div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
						{TEMPLATE_PLACEHOLDERS.map((p) => (
							<div key={p.key} className="flex items-center gap-2 text-sm">
								<code className="bg-background rounded px-1.5 py-0.5 text-xs font-mono">
									{p.key}
								</code>
								<span className="text-muted-foreground">{p.description}</span>
							</div>
						))}
					</div>
				</div>

				{/* Create Form */}
				{showCreate && (
					<TemplateForm
						intent="create"
						onCancel={() => setShowCreate(false)}
						onPreview={handlePreview}
						isSubmitting={isSubmitting}
						errors={
							actionData && 'errors' in actionData
								? actionData.errors
								: undefined
						}
					/>
				)}

				{/* Templates List */}
				{templates.length === 0 && !showCreate ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="bg-muted/50 mb-4 inline-flex rounded-full p-4">
							<Icon
								name="mail"
								className="text-muted-foreground size-8"
							/>
						</div>
						<h2 className="text-foreground text-lg font-semibold">
							No Templates Yet
						</h2>
						<p className="text-muted-foreground mt-2 max-w-xs text-sm">
							Create your first email signature template to get
							started.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{templates.map((template) => (
							<div
								key={template.id}
								className="rounded-lg border"
							>
								{editingId === template.id ? (
									<TemplateForm
										intent="update"
										template={template}
										onCancel={() => setEditingId(null)}
										onPreview={handlePreview}
										isSubmitting={isSubmitting}
										errors={
											actionData &&
											'errors' in actionData
												? actionData.errors
												: undefined
										}
									/>
								) : (
									<div className="p-4">
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<h3 className="text-base font-semibold">
														{template.name}
													</h3>
													{template.isDefault && (
														<Badge variant="secondary">
															Default
														</Badge>
													)}
												</div>
												<p className="text-muted-foreground mt-1 text-xs">
													Last updated:{' '}
													{new Date(
														template.updatedAt,
													).toLocaleDateString()}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														handlePreview(
															template.htmlContent,
															template.name,
														)
													}
												>
													Preview
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														setEditingId(
															template.id,
														)
													}
												>
													<Icon
														name="pencil-1"
														className="mr-1 size-3"
													/>
													Edit
												</Button>
												<Form method="post">
													<input
														type="hidden"
														name="intent"
														value="delete"
													/>
													<input
														type="hidden"
														name="id"
														value={template.id}
													/>
													<Button
														variant="destructive"
														size="sm"
														type="submit"
														onClick={(e) => {
															if (
																!confirm(
																	`Delete "${template.name}"?`,
																)
															) {
																e.preventDefault()
															}
														}}
													>
														<Icon
															name="trash"
															className="size-3"
														/>
													</Button>
												</Form>
											</div>
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{/* Live Preview Panel */}
				{previewHtml && (
					<div className="rounded-lg border">
						<div className="flex items-center justify-between border-b px-4 py-3">
							<h3 className="text-sm font-semibold">
								Preview: {previewName}
							</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setPreviewHtml('')}
							>
								<Icon name="cross-1" className="size-3" />
							</Button>
						</div>
						<div className="bg-white p-4">
							<div
								className="prose prose-sm max-w-none"
								dangerouslySetInnerHTML={{
									__html: previewHtml,
								}}
							/>
						</div>
						<div className="bg-muted/30 border-t px-4 py-2">
							<p className="text-muted-foreground text-xs">
								Rendered with sample data: {sampleEmployee.fullName} ({sampleEmployee.email})
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

interface TemplateFormProps {
	intent: 'create' | 'update'
	template?: {
		id: string
		name: string
		htmlContent: string
		isDefault: boolean
	}
	onCancel: () => void
	onPreview: (html: string, name: string) => void
	isSubmitting: boolean
	errors?: Record<string, string[] | undefined>
}

function TemplateForm({
	intent,
	template,
	onCancel,
	onPreview,
	isSubmitting,
	errors,
}: TemplateFormProps) {
	const [name, setName] = React.useState(template?.name ?? '')
	const [htmlContent, setHtmlContent] = React.useState(
		template?.htmlContent ?? '',
	)
	const [isDefault, setIsDefault] = React.useState(
		template?.isDefault ?? false,
	)
	const [mode, setMode] = React.useState<'visual' | 'html'>('visual')

	return (
		<Form method="post" className="space-y-4 p-4">
			<input type="hidden" name="intent" value={intent} />
			{template && (
				<input type="hidden" name="id" value={template.id} />
			)}
			{/* Hidden input to submit the HTML content from the WYSIWYG editor */}
			<input type="hidden" name="htmlContent" value={htmlContent} />

			<div className="space-y-2">
				<Label htmlFor={`name-${template?.id ?? 'new'}`}>
					Template Name
				</Label>
				<Input
					id={`name-${template?.id ?? 'new'}`}
					name="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="e.g. Standard Faculty Signature"
					required
				/>
				{errors?.name && (
					<p className="text-destructive text-sm">
						{errors.name[0]}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label>Signature Content</Label>
					<div className="flex rounded-md border text-xs">
						<button
							type="button"
							onClick={() => setMode('visual')}
							className={`px-3 py-1 transition-colors ${
								mode === 'visual'
									? 'bg-accent text-accent-foreground'
									: 'hover:bg-muted'
							} rounded-l-md`}
						>
							Visual
						</button>
						<button
							type="button"
							onClick={() => setMode('html')}
							className={`px-3 py-1 transition-colors ${
								mode === 'html'
									? 'bg-accent text-accent-foreground'
									: 'hover:bg-muted'
							} rounded-r-md`}
						>
							HTML
						</button>
					</div>
				</div>

				{mode === 'visual' ? (
					<SignatureEditor
						content={htmlContent}
						onChange={setHtmlContent}
					/>
				) : (
					<Textarea
						value={htmlContent}
						onChange={(e) => setHtmlContent(e.target.value)}
						placeholder="<table>...</table>"
						rows={12}
						className="font-mono text-sm"
					/>
				)}

				{errors?.htmlContent && (
					<p className="text-destructive text-sm">
						{errors.htmlContent[0]}
					</p>
				)}
			</div>

			<div className="flex items-center gap-2">
				<input
					type="checkbox"
					id={`default-${template?.id ?? 'new'}`}
					name="isDefault"
					checked={isDefault}
					onChange={(e) => setIsDefault(e.target.checked)}
					className="size-4 rounded border"
				/>
				<Label htmlFor={`default-${template?.id ?? 'new'}`}>
					Set as default template
				</Label>
			</div>

			<div className="flex items-center gap-2">
				<Button type="submit" disabled={isSubmitting}>
					{intent === 'create' ? 'Create Template' : 'Save Changes'}
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => onPreview(htmlContent, name)}
					disabled={!htmlContent}
				>
					Preview
				</Button>
				<Button type="button" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</Form>
	)
}
