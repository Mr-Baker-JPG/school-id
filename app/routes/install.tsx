import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { data, redirect, Form, FormProps } from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { Card } from '#app/components/ui/card.tsx'
import { CardSection } from '#app/ui/components/CardSection.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { EmailSchema } from '#app/utils/user-validation.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { type Route } from './+types/install.ts'
import { getFormProps, getInputProps, useForm } from '@conform-to/react'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const InstallSchema = z.object({
	email: EmailSchema,
})

export async function loader({ request }: Route.LoaderArgs) {
	// Check if any super admin already exists (any user with admin role)
	const superAdmin = await prisma.user.findFirst({
		where: {
			roles: {
				some: {
					name: 'admin',
				},
			},
		},
		select: { id: true, email: true },
	})

	// If super admin exists, redirect to home
	if (superAdmin) {
		throw redirect('/')
	}

	return {}
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	await checkHoneypot(formData)

	const submission = await parseWithZod(formData, {
		schema: InstallSchema,
	})

	if (submission.status !== 'success') {
		return data(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { email } = submission.value
	const emailLower = email.toLowerCase()

	// Check if user already exists
	const existingUser = await prisma.user.findUnique({
		where: { email: emailLower },
		select: { id: true, roles: { select: { name: true } } },
	})

	if (existingUser) {
		// Update existing user to have admin role if they don't already
		const hasAdminRole = existingUser.roles.some(
			(role) => role.name === 'admin',
		)
		if (!hasAdminRole) {
			await prisma.user.update({
				where: { id: existingUser.id },
				data: {
					roles: {
						connect: { name: 'admin' },
					},
				},
			})
		}
	} else {
		// Create new user with admin role
		// Note: This creates a user without password - they'll need to sign up via OAuth or set password later
		await prisma.user.create({
			data: {
				email: emailLower,
				username: emailLower.split('@')[0] ?? '',
				name: emailLower.split('@')[0],
				roles: {
					connect: [{ name: 'user' }, { name: 'admin' }],
				},
			},
		})
	}

	return redirectWithToast('/', {
		type: 'success',
		title: 'Super Admin Configured',
		description: `Super admin has been set up for ${emailLower}`,
	})
}

export default function InstallRoute({ actionData }: Route.ComponentProps) {
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'install-form',
		constraint: getZodConstraint(InstallSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: InstallSchema })
		},
		shouldRevalidate: 'onBlur',
		defaultValue: {
			email: 'cbaker@jpgacademy.org',
		},
	})

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardSection>
					<div className="flex flex-col gap-6">
						<div className="text-center">
							<h1 className="text-h1">Initial Setup</h1>
							<p className="text-body-md text-muted-foreground mt-3">
								Configure the super admin email for the system.
							</p>
						</div>
						<Form method="POST" {...getFormProps(form)}>
							<HoneypotInputs />
							<Field
								labelProps={{
									htmlFor: fields.email.id,
									children: 'Super Admin Email',
								}}
								inputProps={{
									...getInputProps(fields.email, { type: 'email' }),
									autoFocus: true,
									autoComplete: 'email',
								}}
								errors={fields.email.errors}
							/>
							<ErrorList errors={form.errors} id={form.errorId} />
							<StatusButton
								className="w-full"
								status={isPending ? 'pending' : (form.status ?? 'idle')}
								type="submit"
								disabled={isPending}
							>
								Set Up Super Admin
							</StatusButton>
						</Form>
						<p className="text-body-xs text-muted-foreground text-center">
							Once configured, this user will have full administrative access to
							manage other admin users.
						</p>
					</div>
				</CardSection>
			</Card>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
