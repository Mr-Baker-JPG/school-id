import { redirect } from 'react-router'
import {
	authenticator,
	getSessionExpirationDate,
	getUserId,
	getRedirectPathForUser,
	signupWithConnection,
} from '#app/utils/auth.server.ts'
import {
	ProviderNameSchema,
	providerLabels,
	GOOGLE_PROVIDER_NAME,
} from '#app/utils/connections.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { ensurePrimary } from '#app/utils/litefs.server.ts'
import { combineHeaders } from '#app/utils/misc.tsx'
import {
	normalizeEmail,
	normalizeUsername,
} from '#app/utils/providers/provider.ts'
import {
	destroyRedirectToHeader,
	getRedirectCookieValue,
} from '#app/utils/redirect-cookie.server.ts'
import {
	createToastHeaders,
	redirectWithToast,
} from '#app/utils/toast.server.ts'
import { verifySessionStorage } from '#app/utils/session.server.ts'
import { handleNewSession } from '../login.server.ts'
import { prefilledProfileKey, providerIdKey } from '../onboarding/$provider.tsx'
import { onboardingEmailSessionKey } from '../onboarding/index.tsx'
import { type Route } from './+types/callback.ts'

const destroyRedirectTo = { 'set-cookie': destroyRedirectToHeader }

export async function loader({ request, params }: Route.LoaderArgs) {
	// this loader performs mutations, so we need to make sure we're on the
	// primary instance to avoid writing to a read-only replica
	await ensurePrimary()

	const providerName = ProviderNameSchema.parse(params.provider)
	const redirectTo = getRedirectCookieValue(request)
	const label = providerLabels[providerName]

	const authResult = await authenticator
		.authenticate(providerName, request)
		.then(
			(data) =>
				({
					success: true,
					data,
				}) as const,
			(error) =>
				({
					success: false,
					error,
				}) as const,
		)

	if (!authResult.success) {
		console.error(authResult.error)
		throw await redirectWithToast(
			'/',
			{
				title: 'Auth Failed',
				description: `There was an error authenticating with ${label}.`,
				type: 'error',
			},
			{ headers: destroyRedirectTo },
		)
	}

	const { data: profile } = authResult

	const existingConnection = await prisma.connection.findUnique({
		select: { userId: true },
		where: {
			providerName_providerId: {
				providerName,
				providerId: String(profile.id),
			},
		},
	})

	const userId = await getUserId(request)

	if (existingConnection && userId) {
		const redirectPath = await getRedirectPathForUser(userId)
		if (existingConnection.userId === userId) {
			return redirectWithToast(
				redirectPath,
				{
					title: 'Already Connected',
					description: `Your "${profile.username}" ${label} account is already connected.`,
				},
				{ headers: destroyRedirectTo },
			)
		} else {
			return redirectWithToast(
				redirectPath,
				{
					title: 'Already Connected',
					description: `The "${profile.username}" ${label} account is already connected to another account.`,
				},
				{ headers: destroyRedirectTo },
			)
		}
	}

	// If we're already logged in, then link the account
	if (userId) {
		await prisma.connection.create({
			data: {
				providerName,
				providerId: String(profile.id),
				userId,
			},
		})
		const redirectPath = await getRedirectPathForUser(userId)
		return redirectWithToast(
			redirectPath,
			{
				title: 'Connected',
				type: 'success',
				description: `Your "${profile.username}" ${label} account has been connected.`,
			},
			{ headers: destroyRedirectTo },
		)
	}

	// Connection exists already? Make a new session
	if (existingConnection) {
		const redirectPath = await getRedirectPathForUser(existingConnection.userId)
		return makeSession({
			request,
			userId: existingConnection.userId,
			redirectTo: redirectPath,
		})
	}

	// if the email matches a user in the db, then link the account and
	// make a new session
	const user = await prisma.user.findUnique({
		select: { id: true },
		where: { email: profile.email.toLowerCase() },
	})
	if (user) {
		await prisma.connection.create({
			data: {
				providerName,
				providerId: String(profile.id),
				userId: user.id,
			},
		})
		const redirectPath = await getRedirectPathForUser(user.id)
		return makeSession(
			{ request, userId: user.id, redirectTo: redirectPath },
			{
				headers: await createToastHeaders({
					title: 'Connected',
					description: `Your "${profile.username}" ${label} account has been connected.`,
				}),
			},
		)
	}

	// For Google OAuth: Check if employee exists in SIS (local Employee table)
	// If they do, automatically create User record and log them in
	if (providerName === GOOGLE_PROVIDER_NAME) {
		const employee = await prisma.employee.findUnique({
			where: { email: profile.email.toLowerCase() },
			select: { id: true },
		})

		if (employee) {
			// Employee exists in SIS, create User record automatically
			const sessionData = await signupWithConnection({
				email: profile.email,
				username: (profile.username ?? profile.email.split('@')[0]) as string,
				name: (profile.name ?? profile.email.split('@')[0]) as string,
				providerId: String(profile.id),
				providerName,
				imageUrl: profile.imageUrl,
			})

			// Ensure EmployeeID record exists (create if missing)
			await prisma.employeeID.upsert({
				where: { employeeId: employee.id },
				create: {
					employeeId: employee.id,
					expirationDate: getDefaultExpirationDate(),
				},
				update: {},
			})

			// Get the user ID from the connection we just created
			const user = await prisma.user.findUnique({
				where: { email: profile.email.toLowerCase() },
				select: { id: true },
			})

			if (!user) {
				throw new Error('Failed to create user')
			}

			const session = {
				id: sessionData.id,
				userId: user.id,
				expirationDate: sessionData.expirationDate,
			}

			const redirectPath = redirectTo ?? (await getRedirectPathForUser(user.id))

			return handleNewSession(
				{ request, session, redirectTo: redirectPath, remember: true },
				{
					headers: combineHeaders(
						await createToastHeaders({
							title: 'Welcome!',
							description:
								'Your account has been created and linked to your employee record.',
							type: 'success',
						}),
						destroyRedirectTo,
					),
				},
			)
		}
	}

	// this is a new user, so let's get them onboarded
	const verifySession = await verifySessionStorage.getSession()
	verifySession.set(onboardingEmailSessionKey, profile.email)
	verifySession.set(prefilledProfileKey, {
		...profile,
		email: normalizeEmail(profile.email),
		username:
			typeof profile.username === 'string'
				? normalizeUsername(profile.username)
				: undefined,
	})
	verifySession.set(providerIdKey, profile.id)
	const onboardingRedirect = [
		`/onboarding/${providerName}`,
		redirectTo ? new URLSearchParams({ redirectTo }) : null,
	]
		.filter(Boolean)
		.join('?')
	return redirect(onboardingRedirect, {
		headers: combineHeaders(
			{ 'set-cookie': await verifySessionStorage.commitSession(verifySession) },
			destroyRedirectTo,
		),
	})
}

async function makeSession(
	{
		request,
		userId,
		redirectTo,
	}: { request: Request; userId: string; redirectTo?: string | null },
	responseInit?: ResponseInit,
) {
	redirectTo ??= '/'
	const session = await prisma.session.create({
		select: { id: true, expirationDate: true, userId: true },
		data: {
			expirationDate: getSessionExpirationDate(),
			userId,
		},
	})
	return handleNewSession(
		{ request, session, redirectTo, remember: true },
		{ headers: combineHeaders(responseInit?.headers, destroyRedirectTo) },
	)
}
