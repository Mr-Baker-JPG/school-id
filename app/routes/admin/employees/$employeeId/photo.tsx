import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { parseFormData } from '@mjackson/form-data-parser'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useState } from 'react'
import { data, redirect, Form, useNavigation, Link } from 'react-router'
import { z } from 'zod'
import { ErrorList } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import {
	getEmployeePhotoSrc,
	useDoubleCheck,
	useIsPending,
} from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { uploadEmployeePhoto } from '#app/utils/storage.server.ts'
import { type Route } from './+types/photo.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const MAX_SIZE = 1024 * 1024 * 3 // 3MB

const DeleteImageSchema = z.object({
	intent: z.literal('delete'),
})

const NewImageSchema = z.object({
	intent: z.literal('submit'),
	photoFile: z
		.instanceof(File)
		.refine((file) => file.size > 0, 'Image is required')
		.refine(
			(file) => file.size <= MAX_SIZE,
			'Image size must be less than 3MB',
		),
})

const PhotoFormSchema = z.discriminatedUnion('intent', [
	DeleteImageSchema,
	NewImageSchema,
])

export async function loader({ request, params }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const { employeeId } = params

	const employee = await prisma.employee.findUnique({
		where: { id: employeeId },
		select: {
			id: true,
			fullName: true,
			email: true,
			jobTitle: true,
			employeeId: {
				select: {
					photoUrl: true,
				},
			},
		},
	})

	invariantResponse(employee, 'Employee not found', { status: 404 })

	return { employee }
}

export async function action({ request, params }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const { employeeId } = params

	invariantResponse(employeeId, 'Employee ID is required', { status: 400 })

	// Verify employee exists
	const employee = await prisma.employee.findUnique({
		where: { id: employeeId },
		select: { id: true },
	})

	invariantResponse(employee, 'Employee not found', { status: 404 })

	const formData = await parseFormData(request, { maxFileSize: MAX_SIZE })
	const submission = await parseWithZod(formData, {
		schema: PhotoFormSchema.transform(async (data) => {
			if (data.intent === 'delete') return { intent: 'delete' }
			if (data.photoFile.size <= 0) return z.NEVER
			return {
				intent: data.intent,
				objectKey: await uploadEmployeePhoto(employeeId, data.photoFile),
			}
		}),
		async: true,
	})

	if (submission.status !== 'success') {
		return data(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { objectKey, intent } = submission.value

	if (intent === 'delete') {
		// Update EmployeeID to remove photoUrl
		await prisma.employeeID.updateMany({
			where: { employeeId },
			data: { photoUrl: null },
		})
		return redirect(`/admin/employees/${employeeId}/photo`)
	}

	// Ensure EmployeeID record exists, then update photoUrl
	await prisma.employeeID.upsert({
		where: { employeeId },
		create: {
			employeeId,
			photoUrl: objectKey,
			// Set default expiration date to July 1 of current school year
			expirationDate: new Date(
				new Date().getFullYear(),
				6, // July (0-indexed)
				1,
			),
		},
		update: {
			photoUrl: objectKey,
		},
	})

	return redirect(`/admin/employees/${employeeId}/photo`)
}

export default function EmployeePhotoRoute({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const doubleCheckDeleteImage = useDoubleCheck()

	const navigation = useNavigation()

	const [form, fields] = useForm({
		id: 'employee-photo',
		constraint: getZodConstraint(PhotoFormSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: PhotoFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	const isPending = useIsPending()
	const pendingIntent = isPending ? navigation.formData?.get('intent') : null
	const lastSubmissionIntent = fields.intent.value

	const [newImageSrc, setNewImageSrc] = useState<string | null>(null)

	return (
		<div className="container">
			<div className="mb-4">
				<Link
					to="/admin/employees"
					className="text-muted-foreground hover:text-foreground flex items-center gap-2"
				>
					<Icon name="arrow-left">Back to Employees</Icon>
				</Link>
			</div>
			<h1 className="text-h1">Upload Employee Photo</h1>
			<p className="text-muted-foreground mb-6">
				{loaderData.employee.fullName} ({loaderData.employee.email})
			</p>
			<Form
				method="POST"
				encType="multipart/form-data"
				className="flex flex-col items-center justify-center gap-10"
				onReset={() => setNewImageSrc(null)}
				{...getFormProps(form)}
			>
				<img
					src={
						newImageSrc ??
						getEmployeePhotoSrc(loaderData.employee.employeeId?.photoUrl)
					}
					className="size-52 rounded-lg object-cover"
					alt={loaderData.employee.fullName}
				/>
				<ErrorList errors={fields.photoFile.errors} id={fields.photoFile.id} />
				<div className="flex gap-4">
					<input
						{...getInputProps(fields.photoFile, { type: 'file' })}
						accept="image/*"
						className="peer sr-only"
						required
						tabIndex={newImageSrc ? -1 : 0}
						onChange={(e) => {
							const file = e.currentTarget.files?.[0]
							if (file) {
								const reader = new FileReader()
								reader.onload = (event) => {
									setNewImageSrc(event.target?.result?.toString() ?? null)
								}
								reader.readAsDataURL(file)
							}
						}}
					/>
					<Button
						asChild
						className="cursor-pointer peer-valid:hidden peer-focus-within:ring-2 peer-focus-visible:ring-2"
					>
						<label htmlFor={fields.photoFile.id}>
							<Icon name="pencil-1">Change Photo</Icon>
						</label>
					</Button>
					<StatusButton
						name="intent"
						value="submit"
						type="submit"
						className="peer-invalid:hidden"
						status={
							pendingIntent === 'submit'
								? 'pending'
								: lastSubmissionIntent === 'submit'
									? (form.status ?? 'idle')
									: 'idle'
						}
					>
						Save Photo
					</StatusButton>
					<Button
						variant="destructive"
						className="peer-invalid:hidden"
						{...form.reset.getButtonProps()}
					>
						<Icon name="trash">Reset</Icon>
					</Button>
					{loaderData.employee.employeeId?.photoUrl ? (
						<StatusButton
							className="peer-valid:hidden"
							variant="destructive"
							{...doubleCheckDeleteImage.getButtonProps({
								type: 'submit',
								name: 'intent',
								value: 'delete',
							})}
							status={
								pendingIntent === 'delete'
									? 'pending'
									: lastSubmissionIntent === 'delete'
										? (form.status ?? 'idle')
										: 'idle'
							}
						>
							<Icon name="trash">
								{doubleCheckDeleteImage.doubleCheck
									? 'Are you sure?'
									: 'Delete Photo'}
							</Icon>
						</StatusButton>
					) : null}
				</div>
				<ErrorList errors={form.errors} />
			</Form>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<div className="container">
			<h1 className="text-h1">Error</h1>
			<p>An error occurred while uploading the photo.</p>
		</div>
	)
}
