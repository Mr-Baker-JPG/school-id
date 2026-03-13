import * as React from 'react'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Form, useActionData, useNavigation, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Checkbox } from '#app/components/ui/checkbox.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Badge } from '#app/components/ui/badge.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { PageTitle } from '#app/ui/components/PageTitle.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { gmailSignatureService } from '#app/utils/gmail-signature.server.ts'
import { getSchoolSettingsForSignatures } from '#app/utils/system-settings.server.ts'
import { renderTemplate, SAMPLE_EMPLOYEE_BASE } from './templates.tsx'
import { type Route } from './+types/push.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const PushSchema = z.object({
	templateId: z.string().min(1, 'Please select a template'),
	employeeIds: z.array(z.string()).min(1, 'Please select at least one employee'),
})

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')

	const url = new URL(request.url)
	const searchParams = {
		templateId: url.searchParams.get('templateId') || undefined,
		status: url.searchParams.get('status') || 'all',
		department: url.searchParams.get('department') || 'all',
		search: url.searchParams.get('search') || '',
	}

	// Fetch templates
	const templates = await prisma.signatureTemplate.findMany({
		orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
	})

	// Build employee filter
	const employeeWhere: any = {}
	if (searchParams.status !== 'all') {
		employeeWhere.status = searchParams.status
	}
	if (searchParams.department !== 'all') {
		employeeWhere.department = searchParams.department
	}
	if (searchParams.search) {
		employeeWhere.OR = [
			{ fullName: { contains: searchParams.search } },
			{ email: { contains: searchParams.search } },
		]
	}

	// Fetch employees with their IDs
	const employees = await prisma.employee.findMany({
		where: employeeWhere,
		include: {
			employeeId: true,
		},
		orderBy: [{ fullName: 'asc' }],
	})

	// Get unique departments for filter dropdown
	const departments = await prisma.employee.findMany({
		where: { department: { not: null } },
		select: { department: true },
		distinct: ['department'],
		orderBy: { department: 'asc' },
	})

	return {
		templates,
		employees,
		departments: departments.map((d) => d.department).filter(Boolean) as string[],
		searchParams,
		schoolSettings: await getSchoolSettingsForSignatures(),
	}
}

export async function action({ request }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')

	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'push') {
		const employeeIdsRaw = formData.getAll('employeeIds')
		const result = PushSchema.safeParse({
			templateId: formData.get('templateId'),
			employeeIds: employeeIdsRaw,
		})

		if (!result.success) {
			return {
				status: 'error' as const,
				errors: result.error.flatten().fieldErrors,
			}
		}

		const { templateId, employeeIds } = result.data

		// Fetch template
		const template = await prisma.signatureTemplate.findUnique({
			where: { id: templateId },
		})

		if (!template) {
			return {
				status: 'error' as const,
				errors: { templateId: ['Template not found'] },
			}
		}

		// Fetch employees
		const employees = await prisma.employee.findMany({
			where: { id: { in: employeeIds } },
			include: { employeeId: true },
		})

		// Fetch school settings for template rendering
		const schoolSettings = await getSchoolSettingsForSignatures()

		// Push signatures
		const results: {
			employeeId: string
			email: string
			fullName: string
			success: boolean
			error?: string
		}[] = []

		for (const employee of employees) {
			// Render template with employee data and school settings
			const renderedSignature = renderTemplate(template.htmlContent, {
				fullName: employee.fullName,
				firstName: employee.firstName,
				lastName: employee.lastName,
				jobTitle: employee.jobTitle,
				department: employee.department ?? '',
				email: employee.email,
				phone: schoolSettings.schoolPhone,
				schoolName: schoolSettings.schoolName,
				schoolAddress: schoolSettings.schoolAddress,
				schoolWebsite: schoolSettings.schoolWebsite,
				schoolLogoUrl: schoolSettings.schoolLogoUrl,
			})

			// Push to Gmail
			const pushResult = await gmailSignatureService.setSignature(
				employee.email,
				renderedSignature,
			)

			results.push({
				employeeId: employee.id,
				email: employee.email,
				fullName: employee.fullName,
				success: pushResult.success,
				error: pushResult.error,
			})

			// Create push log entry
			await prisma.signaturePushLog.create({
				data: {
					employeeId: employee.id,
					templateId: template.id,
					success: pushResult.success,
					error: pushResult.error,
				},
			})

			// Update cached signature in database if successful
			if (pushResult.success) {
				await prisma.employeeID.updateMany({
					where: { employeeId: employee.id },
					data: {
						gmailSignature: renderedSignature,
						gmailSignatureFetchedAt: new Date(),
					},
				})
			}

			// Small delay to avoid hitting rate limits (200ms between requests)
			await new Promise((resolve) => setTimeout(resolve, 200))
		}

		const successCount = results.filter((r) => r.success).length
		const failureCount = results.filter((r) => !r.success).length

		return {
			status: 'success' as const,
			results,
			summary: {
				total: results.length,
				success: successCount,
				failed: failureCount,
				templateName: template.name,
			},
		}
	}

	return { status: 'error' as const, errors: { intent: ['Unknown action'] } }
}

export default function SignaturePushPage({ loaderData }: Route.ComponentProps) {
	const { templates, employees, departments, searchParams, schoolSettings } = loaderData
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const isSubmitting = navigation.state !== 'idle'

	const [searchParamsState, setSearchParamsState] = useSearchParams()
	const [selectedTemplate, setSelectedTemplate] = React.useState<string>(
		searchParams.templateId || '',
	)
	const [selectedEmployees, setSelectedEmployees] = React.useState<Set<string>>(
		new Set(),
	)
	const [searchQuery, setSearchQuery] = React.useState(searchParams.search)
	const [showPreview, setShowPreview] = React.useState<string | null>(null)

	// Build sample employee with school settings for preview
	const sampleEmployee = React.useMemo(() => ({
		...SAMPLE_EMPLOYEE_BASE,
		phone: schoolSettings.schoolPhone,
		schoolName: schoolSettings.schoolName,
		schoolAddress: schoolSettings.schoolAddress,
		schoolWebsite: schoolSettings.schoolWebsite,
		schoolLogoUrl: schoolSettings.schoolLogoUrl,
	}), [schoolSettings])

	// Update URL params when filters change
	function updateFilter(key: string, value: string) {
		const newParams = new URLSearchParams(searchParamsState)
		if (value && value !== 'all') {
			newParams.set(key, value)
		} else {
			newParams.delete(key)
		}
		setSearchParamsState(newParams)
	}

	// Get selected template object
	const template = templates.find((t) => t.id === selectedTemplate)

	// Toggle employee selection
	function toggleEmployee(employeeId: string) {
		const newSet = new Set(selectedEmployees)
		if (newSet.has(employeeId)) {
			newSet.delete(employeeId)
		} else {
			newSet.add(employeeId)
		}
		setSelectedEmployees(newSet)
	}

	// Select/deselect all filtered employees
	function toggleAll() {
		if (selectedEmployees.size === employees.length) {
			setSelectedEmployees(new Set())
		} else {
			setSelectedEmployees(new Set(employees.map((e) => e.id)))
		}
	}

	// Render preview for an employee
	function getPreviewForEmployee(employee: (typeof employees)[0]) {
		if (!template) return ''
		return renderTemplate(template.htmlContent, {
			fullName: employee.fullName,
			firstName: employee.firstName,
			lastName: employee.lastName,
			jobTitle: employee.jobTitle,
			department: employee.department ?? '',
			email: employee.email,
			phone: schoolSettings.schoolPhone,
			schoolName: schoolSettings.schoolName,
			schoolAddress: schoolSettings.schoolAddress,
			schoolWebsite: schoolSettings.schoolWebsite,
			schoolLogoUrl: schoolSettings.schoolLogoUrl,
		})
	}

	return (
		<div className="h-full overflow-y-auto px-6 py-6">
			<div className="mx-auto max-w-5xl space-y-6">
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
						className="text-primary font-semibold"
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

				<PageTitle
					title="Push Signatures"
					subtitle="Push email signature templates to employee Gmail accounts."
				/>

				{/* Push Results Summary */}
				{actionData && 'summary' in actionData && actionData.summary && (
					<div className="rounded-lg border bg-card p-4">
						<div className="mb-3 flex items-center gap-2">
							{actionData.summary.failed === 0 ? (
								<Icon name="check-circle" className="size-5 text-green-500" />
							) : (
								<Icon name="alert-circle" className="size-5 text-yellow-500" />
							)}
							<h3 className="font-semibold">Push Complete</h3>
						</div>
						<p className="text-muted-foreground text-sm">
							Template: <strong>{actionData.summary.templateName}</strong>
							<br />
							Successfully pushed to {actionData.summary.success} of{' '}
							{actionData.summary.total} employees
							{actionData.summary.failed > 0 &&
								` (${actionData.summary.failed} failed)`}
						</p>
						{actionData.results && actionData.results.some((r) => !r.success) && (
							<div className="mt-3 space-y-1">
								<p className="text-destructive text-sm font-medium">Failures:</p>
								<ul className="text-muted-foreground space-y-1 text-xs">
									{actionData.results
										.filter((r) => !r.success)
										.map((r) => (
											<li key={r.employeeId}>
												{r.fullName} ({r.email}): {r.error}
											</li>
										))}
								</ul>
							</div>
						)}
					</div>
				)}

				{/* Template Selection */}
				<div className="space-y-2">
					<Label htmlFor="templateId">Select Template</Label>
					{templates.length === 0 ? (
						<div className="text-muted-foreground rounded-lg border p-4 text-sm">
							No templates available.{' '}
							<a href="/admin/signatures/templates" className="text-primary underline">
								Create a template first
							</a>
						</div>
					) : (
						<select
							id="templateId"
							name="templateId"
							value={selectedTemplate}
							onChange={(e) => {
								setSelectedTemplate(e.target.value)
								updateFilter('templateId', e.target.value)
							}}
							className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="">Choose a template...</option>
							{templates.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
									{t.isDefault ? ' (Default)' : ''}
								</option>
							))}
						</select>
					)}
					{actionData && 'errors' in actionData && actionData.errors?.templateId && (
						<p className="text-destructive text-sm">{actionData.errors.templateId[0]}</p>
					)}
				</div>

				{/* Template Preview */}
				{template && (
					<div className="space-y-2">
						<Label>Template Preview (with sample data)</Label>
						<div className="rounded-lg border bg-white p-4">
							<div
								className="prose prose-sm max-w-none"
								dangerouslySetInnerHTML={{
									__html: renderTemplate(template.htmlContent, sampleEmployee),
								}}
							/>
						</div>
					</div>
				)}

				{/* Filters */}
				<div className="grid gap-4 sm:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="search">Search</Label>
						<Input
							id="search"
							placeholder="Name or email..."
							value={searchQuery}
							onChange={(e) => {
								setSearchQuery(e.target.value)
								updateFilter('search', e.target.value)
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="status">Status</Label>
						<select
							id="status"
							value={searchParams.status}
							onChange={(e) => updateFilter('status', e.target.value)}
							className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="all">All Statuses</option>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
						</select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="department">Department</Label>
						<select
							id="department"
							value={searchParams.department}
							onChange={(e) => updateFilter('department', e.target.value)}
							className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="all">All Departments</option>
							{departments.map((d) => (
								<option key={d} value={d}>
									{d}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Employee Selection */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Label>
								Recipients ({selectedEmployees.size} of {employees.length} selected)
							</Label>
							<Button variant="ghost" size="sm" onClick={toggleAll}>
								{selectedEmployees.size === employees.length
									? 'Deselect All'
									: 'Select All'}
							</Button>
						</div>
						{selectedEmployees.size > 0 && selectedTemplate && (
							<Button type="submit" form="push-form" disabled={isSubmitting}>
								{isSubmitting ? (
									<>
										<Icon name="update" className="mr-2 size-4 animate-spin" />
										Pushing...
									</>
								) : (
									<>
										<Icon name="paper-plane" className="mr-2 size-4" />
										Push to {selectedEmployees.size} Employee
										{selectedEmployees.size !== 1 ? 's' : ''}
									</>
								)}
							</Button>
						)}
					</div>

					{actionData && 'errors' in actionData && actionData.errors?.employeeIds && (
						<p className="text-destructive text-sm">{actionData.errors.employeeIds[0]}</p>
					)}

					{employees.length === 0 ? (
						<div className="text-muted-foreground py-8 text-center">
							No employees match the current filters.
						</div>
					) : (
						<div className="max-h-[500px] space-y-2 overflow-y-auto rounded-lg border">
							{employees.map((employee) => (
								<div
									key={employee.id}
									className="hover:bg-muted/50 flex items-center gap-3 border-b p-3 last:border-b-0"
								>
									<Checkbox
										id={`employee-${employee.id}`}
										checked={selectedEmployees.has(employee.id)}
										onCheckedChange={() => toggleEmployee(employee.id)}
									/>
									<label
										htmlFor={`employee-${employee.id}`}
										className="flex-1 cursor-pointer"
									>
										<div className="flex items-center gap-2">
											<span className="font-medium">{employee.fullName}</span>
											<Badge
												variant={
													employee.status === 'active' ? 'default' : 'secondary'
												}
												className="text-xs"
											>
												{employee.status}
											</Badge>
											{employee.department && (
												<Badge variant="outline" className="text-xs">
													{employee.department}
												</Badge>
											)}
										</div>
										<p className="text-muted-foreground text-sm">{employee.email}</p>
									</label>
									{selectedTemplate && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setShowPreview(employee.id)}
										>
											<Icon name="eye-open" className="mr-1 size-3" />
											Preview
										</Button>
									)}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Hidden form for submission */}
				<Form method="post" id="push-form" className="hidden">
					<input type="hidden" name="intent" value="push" />
					<input type="hidden" name="templateId" value={selectedTemplate} />
					{Array.from(selectedEmployees).map((id) => (
						<input key={id} type="hidden" name="employeeIds" value={id} />
					))}
				</Form>

				{/* Individual Preview Modal */}
				{showPreview && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
						<div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-white p-6">
							<div className="mb-4 flex items-center justify-between">
								<h3 className="text-lg font-semibold">
									Preview for{' '}
									{employees.find((e) => e.id === showPreview)?.fullName}
								</h3>
								<Button variant="ghost" size="sm" onClick={() => setShowPreview(null)}>
									<Icon name="cross-1" className="size-4" />
								</Button>
							</div>
							<div className="rounded-lg border bg-gray-50 p-4">
								<div
									className="prose prose-sm max-w-none"
									dangerouslySetInnerHTML={{
										__html: getPreviewForEmployee(
											employees.find((e) => e.id === showPreview)!,
										),
									}}
								/>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
