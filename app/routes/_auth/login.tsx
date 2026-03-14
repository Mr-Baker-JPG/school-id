import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { data, Form } from 'react-router'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { login, requireAnonymous } from '#app/utils/auth.server.ts'
import { checkHoneypot } from '#app/utils/honeypot.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { PasswordSchema, UsernameSchema } from '#app/utils/user-validation.ts'
import { type Route } from './+types/login.ts'
import { handleNewSession } from './login.server.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const LoginFormSchema = z.object({
	username: UsernameSchema,
	password: PasswordSchema,
	redirectTo: z.string().optional(),
})

export async function loader({ request }: Route.LoaderArgs) {
	await requireAnonymous(request)
	return {}
}

export async function action({ request }: Route.ActionArgs) {
	await requireAnonymous(request)
	const formData = await request.formData()
	await checkHoneypot(formData)
	const submission = await parseWithZod(formData, {
		schema: (intent) =>
			LoginFormSchema.transform(async (data, ctx) => {
				if (intent !== null) return { ...data, session: null }

				const session = await login(data)
				if (!session) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'Invalid username or password',
					})
					return z.NEVER
				}

				return { ...data, session }
			}),
		async: true,
	})

	if (submission.status !== 'success' || !submission.value.session) {
		return data(
			{ result: submission.reply({ hideFields: ['password'] }) },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { session, redirectTo } = submission.value

	return handleNewSession({
		request,
		session,
		remember: true,
		redirectTo,
	})
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'login-form',
		constraint: getZodConstraint(LoginFormSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: LoginFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex flex-col gap-5">
			<div className="text-center">
				<h2 className="font-display text-base font-semibold tracking-wide text-primary">
					Sign In
				</h2>
				<p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/60">
					Enter your credentials
				</p>
			</div>

			<Form method="POST" {...getFormProps(form)}>
				<HoneypotInputs />

				<Field
					labelProps={{ children: 'Username' }}
					inputProps={{
						...getInputProps(fields.username, { type: 'text' }),
						autoFocus: true,
						className: 'lowercase',
						autoComplete: 'username',
						placeholder: 'your.username',
					}}
					errors={fields.username.errors}
				/>

				<Field
					labelProps={{ children: 'Password' }}
					inputProps={{
						...getInputProps(fields.password, {
							type: 'password',
						}),
						autoComplete: 'current-password',
					}}
					errors={fields.password.errors}
				/>

				<input
					{...getInputProps(fields.redirectTo, { type: 'hidden' })}
				/>
				<ErrorList errors={form.errors} id={form.errorId} />

				<div className="pt-2">
					<StatusButton
						className="w-full"
						status={
							isPending ? 'pending' : (form.status ?? 'idle')
						}
						type="submit"
						disabled={isPending}
					>
						Log In
					</StatusButton>
				</div>
			</Form>
		</div>
	)
}

export const meta: Route.MetaFunction = () => {
	return [{ title: 'Sign In' }]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
