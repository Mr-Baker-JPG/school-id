import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { requireUserWithRole } from './permissions.server.ts'

async function createAdminUser() {
	const adminRole = await prisma.role.findUnique({
		where: { name: 'admin' },
	})

	if (!adminRole) {
		throw new Error('Admin role not found. Run database migrations.')
	}

	const user = await prisma.user.create({
		data: {
			email: faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: {
				connect: { id: adminRole.id },
			},
		},
		select: { id: true, email: true, roles: { select: { name: true } } },
	})

	return user
}

async function createNonAdminUser() {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})

	if (!userRole) {
		throw new Error('User role not found. Run database migrations.')
	}

	const user = await prisma.user.create({
		data: {
			email: faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: {
				connect: { id: userRole.id },
			},
		},
		select: { id: true, email: true, roles: { select: { name: true } } },
	})

	return user
}

async function createRequestWithSession(userId: string, path: string) {
	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			userId,
		},
		select: { id: true },
	})

	const authSession = await authSessionStorage.getSession()
	authSession.set(sessionKey, session.id)
	const cookieHeader = await authSessionStorage.commitSession(authSession)

	const url = path.startsWith('http') ? path : `http://localhost${path}`
	return new Request(url, {
		headers: {
			cookie: cookieHeader,
		},
	})
}

test('Admin role is stored and retrieved correctly', async () => {
	const admin = await createAdminUser()

	// Verify admin role is stored
	const userWithRoles = await prisma.user.findUnique({
		where: { id: admin.id },
		select: { id: true, roles: { select: { name: true } } },
	})

	expect(userWithRoles).toBeDefined()
	expect(userWithRoles?.roles).toHaveLength(1)
	expect(userWithRoles?.roles[0]?.name).toBe('admin')

	// Cleanup
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Non-admin user role is stored and retrieved correctly', async () => {
	const user = await createNonAdminUser()

	// Verify user role is stored
	const userWithRoles = await prisma.user.findUnique({
		where: { id: user.id },
		select: { id: true, roles: { select: { name: true } } },
	})

	expect(userWithRoles).toBeDefined()
	expect(userWithRoles?.roles).toHaveLength(1)
	expect(userWithRoles?.roles[0]?.name).toBe('user')

	// Cleanup
	await prisma.user.delete({ where: { id: user.id } })
})

test('requireUserWithRole allows admin users to access admin routes', async () => {
	const admin = await createAdminUser()
	const request = await createRequestWithSession(admin.id, '/admin/test')

	// Should not throw
	const userId = await requireUserWithRole(request, 'admin')
	expect(userId).toBe(admin.id)

	// Cleanup
	await prisma.user.delete({ where: { id: admin.id } })
})

test('requireUserWithRole denies non-admin users access to admin routes', async () => {
	const nonAdmin = await createNonAdminUser()
	const request = await createRequestWithSession(
		nonAdmin.id,
		'/admin/test',
	)

	// Should throw 403 error
	await expect(requireUserWithRole(request, 'admin')).rejects.toThrow()

	// Cleanup
	await prisma.user.delete({ where: { id: nonAdmin.id } })
})

test('requireUserWithRole throws 403 with correct error message for non-admin users', async () => {
	const nonAdmin = await createNonAdminUser()
	const request = await createRequestWithSession(
		nonAdmin.id,
		'/admin/test',
	)

	try {
		await requireUserWithRole(request, 'admin')
		expect.fail('Should have thrown an error')
	} catch (error: unknown) {
		expect(error).toBeDefined()
		// The error is a Response object from react-router's data() helper
		// It should have status 403
		if (error && typeof error === 'object' && 'status' in error) {
			expect(error.status).toBe(403)
		}
	}

	// Cleanup
	await prisma.user.delete({ where: { id: nonAdmin.id } })
})

test('User can have multiple roles', async () => {
	const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } })
	const userRole = await prisma.role.findUnique({ where: { name: 'user' } })

	if (!adminRole || !userRole) {
		throw new Error('Roles not found. Run database migrations.')
	}

	const user = await prisma.user.create({
		data: {
			email: faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: {
				connect: [{ id: adminRole.id }, { id: userRole.id }],
			},
		},
		select: { id: true, roles: { select: { name: true } } },
	})

	// Verify user has both roles
	expect(user.roles).toHaveLength(2)
	expect(user.roles.map((r) => r.name)).toContain('admin')
	expect(user.roles.map((r) => r.name)).toContain('user')

	// User with both roles should be able to access admin routes
	const request = await createRequestWithSession(user.id, '/admin/test')
	const userId = await requireUserWithRole(request, 'admin')
	expect(userId).toBe(user.id)

	// Cleanup
	await prisma.user.delete({ where: { id: user.id } })
})

test('Admin role exists in database', async () => {
	const adminRole = await prisma.role.findUnique({
		where: { name: 'admin' },
	})

	expect(adminRole).toBeDefined()
	expect(adminRole?.name).toBe('admin')
})

test('User role exists in database', async () => {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})

	expect(userRole).toBeDefined()
	expect(userRole?.name).toBe('user')
})
