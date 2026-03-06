import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { parseFormData } from '@mjackson/form-data-parser'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { data, redirect, Form, Link } from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { getNextJuly1ExpirationDate } from '#app/utils/student.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/expiration.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const ExpirationFormSchema = z.object({
	expirationDate: z
		.string()
		.refine((val) => {
			const date = new Date(val)
			return !isNaN(date.getTime())
		}, 'Invalid date format'),
})

export async function loader({ request, params }: Route.LoaderArgs) {
	await requireUserWithRole(request, 'admin')
	const { studentId } = params

	invariantResponse(studentId, 'Student ID is required', { status: 400 })

	const student = await prisma.student.findUnique({
		where: { id: studentId },
		select: {
			id: true,
			fullName: true,
			email: true,
			studentId: {
				select: {
					expirationDate: true,
				},
			},
		},
	})

	invariantResponse(student, 'Student not found', { status: 404 })

	return { student }
}

export async function action({ request, params }: Route.ActionArgs) {
	await requireUserWithRole(request, 'admin')
	const { studentId } = params
	const formData = await parseFormData(request.clone('POST'))

	invariantResponse(studentId, 'Student ID is required', { status: 400 })

	const submission = parseWithZod(formData, { schema: ExpirationFormSchema })

	if (submission.status !== 'success') {
		return data(
		 { result: submission.reply() },
		 { status: submission.status === 'error' ? 400 : 200 },
        )
    }

	const { expirationDate } = submission.value

	// Update or create StudentID record with new expiration date
	await prisma.studentID.upsert({
		where: { studentId },
		create: {
			studentId,
			expirationDate: new Date(expirationDate),
		},
		update: {
			expirationDate: new Date(expirationDate),
		},
	})

	return redirectWithToast(`/admin/students/${studentId}/expiration`, {
		type: 'success',
		title: 'Expiration Date Updated',
		description: 'Expiration date has been updated successfully.',
	})
}

export default function StudentExpirationRoute({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const navigation = useNavigation()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'student-expiration',
		constraint: getZodConstraint(ExpirationFormSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ExpirationFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	// Format the current expiration date for the input
	const currentExpiration = loaderData.student.studentId?.expirationDate
		? new Date(loaderData.student.studentId.expirationDate).toISOString().split('T')[0]
		: ''

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
			<div className="mb-6">
				<h1 className="text-h1">Manage Expiration Date</h1>
				<p className="text-muted-foreground">
					{loaderData.student.fullName} ({loaderData.student.email})
				</p>
			</div>
			<Form method="POST" {...getFormProps(form)}>
				<Field
					labelProps={{ children: 'Expiration Date' }}
					inputProps={{
						...getInputProps(fields.expirationDate, { type: 'date' }),
						defaultValue: currentExpiration,
					}}
					errors={fields.expirationDate.errors}
				/>
				<ErrorList errors={form.errors} id={form.errorId} />
				<div className="mt-4 flex gap-4">
					<StatusButton
						type="submit"
						status={isPending ? 'pending' : 'idle'}
						disabled={isPending}
					>
						Save Expiration Date
					</StatusButton>
					<Button type="button" variant="secondary" asChild>
						<Link to="/admin/students">Cancel</Link>
					</Button>
				</div>
			</Form>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<div className="container">
			<h1 className="text-h1">Error</h1>
			<p>An error occurred while updating the expiration date.</p>
		</div>
	)
}
