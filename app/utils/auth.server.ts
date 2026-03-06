import crypto from 'node:crypto'
import { type Connection, type Password, type User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { data, redirect } from 'react-router'
import { Authenticator } from 'remix-auth'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { providers, googleProviderInitPromise } from './connections.server.ts'
import { prisma } from './db.server.ts'
import { combineHeaders, downloadFile } from './misc.tsx'
import { type ProviderUser } from './providers/provider.ts'
import { authSessionStorage } from './session.server.ts'
import { uploadProfileImage } from './storage.server.ts'

export const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30
export const getSessionExpirationDate = () =>
	new Date(Date.now() + SESSION_EXPIRATION_TIME)

export const sessionKey = 'sessionId'

export const authenticator = new Authenticator<ProviderUser>()

// Register strategies synchronously for providers that are available immediately
for (const [providerName, provider] of Object.entries(providers)) {
	// Skip google here - it will be registered after async load completes
	if (providerName === 'google') continue

	const strategy = provider.getAuthStrategy()
	if (strategy) {
		authenticator.use(strategy, providerName)
	}
}

// Register Google strategy after it loads asynchronously
googleProviderInitPromise
	.then((googleProvider) => {
		const strategy = googleProvider.getAuthStrategy()
		if (strategy) {
			authenticator.use(strategy, 'google')
		}
	})
	.catch(() => {
		// Google provider failed to load, strategy will remain unregistered
		// This is OK - authentication with Google will fail gracefully
	})

export async function getUserId(request: Request) {
	const authSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const sessionId = authSession.get(sessionKey)
	if (!sessionId) return null
	const session = await prisma.session.findUnique({
		select: { userId: true },
		where: { id: sessionId, expirationDate: { gt: new Date() } },
	})
	if (!session?.userId) {
		throw redirect('/', {
			headers: {
				'set-cookie': await authSessionStorage.destroySession(authSession),
			},
		})
	}
	return session.userId
}

export async function requireUserId(
	request: Request,
	{ redirectTo }: { redirectTo?: string | null } = {},
) {
	const userId = await getUserId(request)
	if (!userId) {
		const requestUrl = new URL(request.url)
		redirectTo =
			redirectTo === null
				? null
				: (redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`)
		const loginRedirect = ['/'].filter(Boolean).join('?')
		throw redirect(loginRedirect)
	}
	return userId
}

export async function requireAdmin(request: Request) {
	const userId = await getUserId(request)
	if (!userId) {
		throw redirect('/')
	}
	const user = await prisma.user.findFirst({
		where: { id: userId },
		select: { roles: true },
	})
	if (!user?.roles.some((role) => role.name == 'admin')) {
		// Redirect non-admin users to their appropriate destination
		const redirectPath = await getRedirectPathForUser(userId)
		throw redirect(redirectPath)
	}
	return userId
}

export async function requireSuperAdmin(request: Request) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true },
	})
	if (!user || user.email.toLowerCase() !== 'cbaker@jpgacademy.org') {
		throw data(
			{
				error: 'Unauthorized',
				message: 'Unauthorized: This action requires super admin access',
			},
			{ status: 403 },
		)
	}
	return userId
}

export async function requireAnonymous(request: Request) {
	const userId = await getUserId(request)
	if (userId) {
		throw redirect('/')
	}
}

/**
 * Determines the appropriate redirect path for a user after authentication.
 * Admin users go to /admin/employees, employees go to /employee/id, students go to /student/id.
 */
export async function getRedirectPathForUser(userId: string): Promise<string> {
	// Check if user is admin
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			email: true,
			roles: {
				select: { name: true },
			},
		},
	})

	if (!user) {
		return '/'
	}

	// Check if user has admin role
	const isAdmin = user.roles.some((role) => role.name === 'admin')
	if (isAdmin) {
		return '/admin/employees'
	}

	// Check if user has an employee record
	const employee = await prisma.employee.findUnique({
		where: { email: user.email },
		select: { id: true },
	})

	if (employee) {
		return '/employee/id'
	}

	// Check if user has a student record
	const student = await prisma.student.findUnique({
		where: { email: user.email },
		select: { id: true },
	})

	if (student) {
		return '/student/id'
	}

	return '/'
}

export async function login({
	username,
	password,
}: {
	username: User['username']
	password: string
}) {
	const user = await verifyUserPassword({ username }, password)
	if (!user) return null
	const session = await prisma.session.create({
		select: { id: true, expirationDate: true, userId: true },
		data: {
			expirationDate: getSessionExpirationDate(),
			userId: user.id,
		},
	})
	return session
}

export async function resetUserPassword({
	username,
	password,
}: {
	username: User['username']
	password: string
}) {
	const hashedPassword = await getPasswordHash(password)
	return prisma.user.update({
		where: { username },
		data: {
			password: {
				update: {
					hash: hashedPassword,
				},
			},
		},
	})
}

export async function signup({
	email,
	username,
	password,
	name,
}: {
	email: User['email']
	username: User['username']
	name: User['name']
	password: string
}) {
	const hashedPassword = await getPasswordHash(password)
	const emailLower = email.toLowerCase()
	const isSuperAdmin = emailLower === 'cbaker@jpgacademy.org'

	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			user: {
				create: {
					email: emailLower,
					username: username.toLowerCase(),
					name,
					roles: {
						connect: isSuperAdmin
							? [{ name: 'user' }, { name: 'admin' }]
							: [{ name: 'user' }],
					},
					password: {
						create: {
							hash: hashedPassword,
						},
					},
				},
			},
		},
		select: { id: true, expirationDate: true },
	})

	return session
}

export async function signupWithConnection({
	email,
	username,
	name,
	providerId,
	providerName,
	imageUrl,
}: {
	email: User['email']
	username: User['username']
	name: User['name']
	providerId: Connection['providerId']
	providerName: Connection['providerName']
	imageUrl?: string
}) {
	const emailLower = email.toLowerCase()
	const isSuperAdmin = emailLower === 'cbaker@jpgacademy.org'

	const user = await prisma.user.create({
		data: {
			email: emailLower,
			username: username.toLowerCase(),
			name,
			roles: {
				connect: isSuperAdmin
					? [{ name: 'user' }, { name: 'admin' }]
					: [{ name: 'user' }],
			},
			connections: { create: { providerId, providerName } },
		},
		select: { id: true },
	})

	if (imageUrl) {
		const imageFile = await downloadFile(imageUrl)
		await prisma.user.update({
			where: { id: user.id },
			data: {
				image: {
					create: {
						objectKey: await uploadProfileImage(user.id, imageFile),
					},
				},
			},
		})
	}

	// Create and return the session
	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			userId: user.id,
		},
		select: { id: true, expirationDate: true },
	})

	return session
}

export async function logout(
	{
		request,
		redirectTo = '/',
	}: {
		request: Request
		redirectTo?: string
	},
	responseInit?: ResponseInit,
) {
	const authSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const sessionId = authSession.get(sessionKey)
	// if this fails, we still need to delete the session from the user's browser
	// and it doesn't do any harm staying in the db anyway.
	if (sessionId) {
		// the .catch is important because that's what triggers the query.
		// learn more about PrismaPromise: https://www.prisma.io/docs/orm/reference/prisma-client-reference#prismapromise-behavior
		void prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {})
	}
	throw redirect(safeRedirect(redirectTo), {
		...responseInit,
		headers: combineHeaders(
			{ 'set-cookie': await authSessionStorage.destroySession(authSession) },
			responseInit?.headers,
		),
	})
}

export async function getPasswordHash(password: string) {
	const hash = await bcrypt.hash(password, 10)
	return hash
}

export async function verifyUserPassword(
	where: Pick<User, 'username'> | Pick<User, 'id'>,
	password: Password['hash'],
) {
	const userWithPassword = await prisma.user.findUnique({
		where,
		select: { id: true, password: { select: { hash: true } } },
	})

	if (!userWithPassword || !userWithPassword.password) {
		return null
	}

	const isValid = await bcrypt.compare(password, userWithPassword.password.hash)

	if (!isValid) {
		return null
	}

	return { id: userWithPassword.id }
}

export function getPasswordHashParts(password: string) {
	const hash = crypto
		.createHash('sha1')
		.update(password, 'utf8')
		.digest('hex')
		.toUpperCase()
	return [hash.slice(0, 5), hash.slice(5)] as const
}

export async function checkIsCommonPassword(password: string) {
	const [prefix, suffix] = getPasswordHashParts(password)

	try {
		const response = await fetch(
			`https://api.pwnedpasswords.com/range/${prefix}`,
			{ signal: AbortSignal.timeout(1000) },
		)

		if (!response.ok) return false

		const data = await response.text()
		return data.split(/\r?\n/).some((line) => {
			const [hashSuffix, ignoredPrevalenceCount] = line.split(':')
			return hashSuffix === suffix
		})
	} catch (error) {
		if (error instanceof DOMException && error.name === 'TimeoutError') {
			console.warn('Password check timed out')
			return false
		}

		console.warn('Unknown error during password check', error)
		return false
	}
}
