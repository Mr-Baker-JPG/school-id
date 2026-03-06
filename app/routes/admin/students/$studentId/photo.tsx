import { captureException } from '@sentry/react-router'
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
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { prisma } from '#app/utils/db.server.ts'
import {
	getStudentPhotoSrc,
	useDoubleCheck,
	useIsPending,
} from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { getNextJuly1ExpirationDate } from '#app/utils/student.server.ts'
import { uploadStudentPhoto } from '#app/utils/storage.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
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
	const { studentId } = params

	const student = await prisma.student.findUnique({
		where: { id: studentId },
		select: {
			id: true,
			fullName: true,
			email: true,
			studentId: {
				select: {
					photoUrl: true,
				},
			},
		},
	})

	invariantResponse(student, 'Student not found', { status: 404 })

	return { student }
}

export async function action({ request, params }: Route.ActionArgs) {
	try {
		await requireUserWithRole(request, 'admin')
		const { studentId } = params

		if (!studentId) {
			const error = new Error('Student ID is required')
			console.error('[Photo Upload] Missing student ID parameter')
			captureException(error, {
				tags: {
					route: 'admin/students/$studentId/photo',
					errorType: 'missing_student_id',
				},
			})
			return redirectWithToast(`/admin/students`, {
				type: 'error',
				title: 'Error',
				description: 'Student ID is required',
			})
		}

		// Verify student exists
		const student = await prisma.student.findUnique({
			where: { id: studentId },
			select: { id: true, fullName: true },
		})

		if (!student) {
			const error = new Error('Student not found')
			console.error('[Photo Upload] Student not found:', studentId)
			captureException(error, {
				tags: {
					route: 'admin/students/$studentId/photo',
					errorType: 'student_not_found',
					studentId,
				},
			})
			return redirectWithToast(`/admin/students`, {
				type: 'error',
				title: 'Student Not Found',
				description: 'The student you are trying to update does not exist.',
			})
		}

		const formData = await parseFormData(request, { maxFileSize: MAX_SIZE })
		const submission = await parseWithZod(formData, {
			schema: PhotoFormSchema.transform(async (data) => {
				if (data.intent === 'delete') return { intent: 'delete' }
				if (data.photoFile.size <= 0) return z.NEVER
				try {
					const objectKey = await uploadStudentPhoto(
						studentId,
						data.photoFile,
					)
					return {
						intent: data.intent,
						objectKey,
					}
				} catch (uploadError) {
					const error =
						uploadError instanceof Error
							? uploadError
							: new Error('Failed to upload photo')
					console.error('[Photo Upload] Upload failed:', error.message, {
						studentId,
						fileName: data.photoFile.name,
						fileSize: data.photoFile.size,
					})
					captureException(error, {
						tags: {
							route: 'admin/students/$studentId/photo',
							errorType: 'photo_upload_failed',
							studentId,
						},
						extra: {
							fileName: data.photoFile.name,
							fileSize: data.photoFile.size,
							fileType: data.photoFile.type,
						},
					})
					throw new z.ZodError([
						{
							code: 'custom',
							path: ['photoFile'],
							message:
								'Failed to upload photo. Please check the file format and size, then try again.',
						},
					])
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
			try {
				// Update StudentID to remove photoUrl
				await prisma.studentID.updateMany({
					where: { studentId },
					data: { photoUrl: null },
				})
				return redirectWithToast(`/admin/students/${studentId}/photo`, {
					type: 'success',
					title: 'Photo Deleted',
					description: `Photo for ${student.fullName} has been deleted successfully.`,
				})
			} catch (error) {
				console.error('[Photo Upload] Delete failed:', error)
				captureException(error, {
					tags: {
						route: 'admin/students/$studentId/photo',
						errorType: 'photo_delete_failed',
						studentId,
					},
				})
				return redirectWithToast(`/admin/students/${studentId}/photo`, {
					type: 'error',
					title: 'Error',
					description:
						'Failed to delete photo. Please try again or contact support.',
				})
			}
		}

		// Ensure StudentID record exists, then update photoUrl
		try {
			await prisma.studentID.upsert({
				where: { studentId },
				create: {
					studentId,
					photoUrl: objectKey,
					// Set default expiration date to July 1 of current school year
					expirationDate: getNextJuly1ExpirationDate(),
				},
				update: {
					photoUrl: objectKey,
				},
			})
			return redirectWithToast(`/admin/students/${studentId}/photo`, {
				type: 'success',
				title: 'Photo Uploaded',
				description: `Photo for ${student.fullName} has been uploaded successfully.`,
			})
		} catch (error) {
			console.error('[Photo Upload] Database update failed:', error)
			captureException(error, {
				tags: {
					route: 'admin/students/$studentId/photo',
					errorType: 'photo_database_update_failed',
					studentId,
				},
			})
			return redirectWithToast(`/admin/students/${studentId}/photo`, {
				type: 'error',
				title: 'Error',
				description:
					'Photo was uploaded but failed to save. Please try uploading again.',
			})
		}
	} catch (error) {
		// Handle unexpected errors
		console.error('[Photo Upload] Unexpected error:', error)
		captureException(error, {
			tags: {
				route: 'admin/students/$studentId/photo',
				errorType: 'unexpected_error',
			},
		})
		const studentId = params.studentId
		return redirectWithToast(
			studentId ? `/admin/students/${studentId}/photo` : '/admin/students',
			{
				type: 'error',
				title: 'Unexpected Error',
				description:
					'An unexpected error occurred. Please try again or contact support.',
			},
		)
	}
}

export default function StudentPhotoRoute({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const doubleCheckDeleteImage = useDoubleCheck()

	const navigation = useNavigation()

	const [form, fields] = useForm({
		id: 'student-photo',
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
					to="/admin/students"
					className="text-muted-foreground hover:text-foreground flex items-center gap-2"
				>
					<Icon name="arrow-left">Back to Students</Icon>
				</Link>
			</div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-h1">Upload Student Photo</h1>
					<p className="text-muted-foreground">
						{loaderData.student.fullName} ({loaderData.student.email})
					</p>
				</div>
			</div>
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
						getStudentPhotoSrc(loaderData.student.studentId?.photoUrl)
					}
					className="size-52 rounded-lg object-cover"
					alt={loaderData.student.fullName}
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
					{loaderData.student.studentId?.photoUrl ? (
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
		<GeneralErrorBoundary
			statusHandlers={{
				400: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Invalid Request</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data ||
									'Invalid request. Please check the file and try again.'}
							</p>
						</div>
					</div>
				),
				403: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Access Denied</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data || 'You do not have permission to upload photos.'}
							</p>
						</div>
					</div>
				),
				404: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Student Not Found</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data ||
									'The student you are trying to update does not exist.'}
							</p>
						</div>
					</div>
				),
				500: ({ error }) => (
					<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
						<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
							<h1 className="text-h2 mb-4">Upload Error</h1>
							<p className="text-body-lg text-muted-foreground">
								{error?.data ||
									'An error occurred while uploading the photo. Please try again or contact support.'}
							</p>
						</div>
					</div>
				),
			}}
			unexpectedErrorHandler={(error) => (
				<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
					<div className="bg-muted container flex flex-col items-center rounded-3xl p-12">
						<h1 className="text-h2 mb-4">Unexpected Error</h1>
						<p className="text-body-lg text-muted-foreground">
							An unexpected error occurred while uploading the photo. Please try
							again or contact support.
						</p>
					</div>
				</div>
			)}
		/>
	)
}
