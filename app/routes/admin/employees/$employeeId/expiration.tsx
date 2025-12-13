import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { parseFormData } from '@mjackson/form-data-parser'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { data, redirect, Form, useNavigation, Link } from 'react-router'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { type Route } from './+types/expiration.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const ExpirationFormSchema = z.object({
	expirationDate: z
		.string()
		.min(1, 'Expiration date is required')
		.refine((dateString) => {
			const date = new Date(dateString)
			return !isNaN(date.getTime())
		}, 'Invalid date format')
		.refine((dateString) => {
			const date = new Date(dateString)
			// Allow dates in the past (for expired IDs) but ensure it's a valid date
			return date instanceof Date && !isNaN(date.getTime())
		}, 'Invalid date'),
})

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
					expirationDate: true,
				},
			},
		},
	})

	invariantResponse(employee, 'Employee not found', { status: 404 })

	// Compute default expiration date in loader for use in component
	const defaultExpirationDate = getDefaultExpirationDate()

	return { employee, defaultExpirationDate }
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

	const formData = await parseFormData(request)
	const submission = await parseWithZod(formData, {
		schema: ExpirationFormSchema,
	})

	if (submission.status !== 'success') {
		return data(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { expirationDate } = submission.value
	const expirationDateObj = new Date(expirationDate)

	// Validate the date is valid
	if (isNaN(expirationDateObj.getTime())) {
		return data(
			{
				result: submission.reply({
					formErrors: ['Invalid date provided'],
				}),
			},
			{ status: 400 },
		)
	}

	// Ensure EmployeeID record exists, then update expirationDate
	await prisma.employeeID.upsert({
		where: { employeeId },
		create: {
			employeeId,
			expirationDate: expirationDateObj,
			photoUrl: null,
		},
		update: {
			expirationDate: expirationDateObj,
		},
	})

	return redirect(`/admin/employees/${employeeId}/expiration`)
}

export default function EmployeeExpirationRoute({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const navigation = useNavigation()

	const [form, fields] = useForm({
		id: 'employee-expiration',
		constraint: getZodConstraint(ExpirationFormSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: ExpirationFormSchema })
		},
		shouldRevalidate: 'onBlur',
		defaultValue: {
			expirationDate: loaderData.employee.employeeId?.expirationDate
				? new Date(loaderData.employee.employeeId.expirationDate)
						.toISOString()
						.split('T')[0]
				: new Date(loaderData.defaultExpirationDate).toISOString().split('T')[0],
		},
	})

	const isPending = navigation.state !== 'idle'

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
			<h1 className="text-h1">Manage Expiration Date</h1>
			<p className="text-muted-foreground mb-6">
				{loaderData.employee.fullName} ({loaderData.employee.email})
			</p>
			<Form method="POST" {...getFormProps(form)}>
				<Field
					labelProps={{ children: 'Expiration Date' }}
					inputProps={{
						...getInputProps(fields.expirationDate, { type: 'date' }),
						disabled: isPending,
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
						<Link to="/admin/employees">Cancel</Link>
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
