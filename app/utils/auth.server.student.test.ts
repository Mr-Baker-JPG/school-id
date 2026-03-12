import { faker } from '@faker-js/faker'
import { beforeEach, expect, test } from 'vitest'
import { getRedirectPathForUser, signup } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { createUser } from '#tests/db-utils.ts'

beforeEach(async () => {
	// Clean up test data
	await prisma.user.deleteMany({
		where: {
			email: {
				contains: 'test-redirect',
			},
		},
	})
	await prisma.student.deleteMany({
		where: {
			email: {
				contains: 'test-redirect',
			},
		},
	})
	await prisma.employee.deleteMany({
		where: {
			email: {
				contains: 'test-redirect',
			},
		},
	})
})

/**
 * Helper to create a student in the database
 */
async function createStudent(overrides: Partial<{
	email: string
	fullName: string
	firstName: string
	lastName: string
	sisStudentId: string
	status: string
}> = {}) {
	const email = overrides.email ?? `test-redirect-student-${faker.string.uuid()}@jpgacademy.org`
	const firstName = overrides.firstName ?? faker.person.firstName()
	const lastName = overrides.lastName ?? faker.person.lastName()
	return prisma.student.create({
		data: {
			email,
			fullName: overrides.fullName ?? `${firstName} ${lastName}`,
			firstName,
			lastName,
			sisStudentId: overrides.sisStudentId ?? faker.string.uuid(),
			status: (overrides.status as 'active' | 'inactive') ?? 'active',
		},
	})
}

/**
 * Helper to create an employee in the database
 */
async function createEmployee(overrides: Partial<{
	email: string
	fullName: string
	firstName: string
	lastName: string
	sisEmployeeId: string
	jobTitle: string
	status: string
}> = {}) {
	const email = overrides.email ?? `test-redirect-employee-${faker.string.uuid()}@jpgacademy.org`
	const firstName = overrides.firstName ?? faker.person.firstName()
	const lastName = overrides.lastName ?? faker.person.lastName()
	return prisma.employee.create({
		data: {
			email,
			fullName: overrides.fullName ?? `${firstName} ${lastName}`,
			firstName,
			lastName,
			sisEmployeeId: overrides.sisEmployeeId ?? faker.string.uuid(),
			jobTitle: overrides.jobTitle ?? 'Teacher',
			status: (overrides.status as 'active' | 'inactive') ?? 'active',
		},
	})
}

/**
 * Helper to create a user with specific roles
 */
async function createUserWithRoles(
	email: string,
	roles: string[] = ['user'],
) {
	const userData = createUser()
	const user = await prisma.user.create({
		data: {
			...userData,
			email: email.toLowerCase(),
			username: email.split('@')[0],
			roles: {
				connect: roles.map((role) => ({ name: role })),
			},
		},
	})
	return user
}

// ============================================================================
// TESTS: getRedirectPathForUser
// ============================================================================

test('redirects admin users to /admin', async () => {
	const email = `test-redirect-admin-${faker.string.uuid()}@jpgacademy.org`
	const user = await createUserWithRoles(email, ['user', 'admin'])

	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/admin')
})

test('redirects employees to /employee/id', async () => {
	const email = `test-redirect-employee-${faker.string.uuid()}@jpgacademy.org`
	await createEmployee({ email })
	const user = await createUserWithRoles(email, ['user'])

	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/employee/id')
})

test('redirects students to /student/id', async () => {
	const email = `test-redirect-student-${faker.string.uuid()}@jpgacademy.org`
	await createStudent({ email })
	const user = await createUserWithRoles(email, ['user'])

	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/student/id')
})

test('prioritizes admin role over employee record', async () => {
	const email = `test-redirect-admin-employee-${faker.string.uuid()}@jpgacademy.org`
	await createEmployee({ email })
	const user = await createUserWithRoles(email, ['user', 'admin'])

	// Admin role should take precedence
	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/admin')
})

test('prioritizes admin role over student record', async () => {
	const email = `test-redirect-admin-student-${faker.string.uuid()}@jpgacademy.org`
	await createStudent({ email })
	const user = await createUserWithRoles(email, ['user', 'admin'])

	// Admin role should take precedence
	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/admin')
})

test('prioritizes employee over student when both exist', async () => {
	const email = `test-redirect-both-${faker.string.uuid()}@jpgacademy.org`
	await createEmployee({ email })
	await createStudent({ email })
	const user = await createUserWithRoles(email, ['user'])

	// Employee should take precedence (checked first)
	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/employee/id')
})

test('redirects to / for user without employee or student record', async () => {
	const email = `test-redirect-none-${faker.string.uuid()}@example.com`
	// Don't create employee or student
	const user = await createUserWithRoles(email, ['user'])

	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/')
})

test('returns / for non-existent user', async () => {
	const redirectPath = await getRedirectPathForUser('non-existent-user-id')
	expect(redirectPath).toBe('/')
})

test('handles inactive employee correctly', async () => {
	const email = `test-redirect-inactive-employee-${faker.string.uuid()}@jpgacademy.org`
	await createEmployee({ email, status: 'inactive' })
	const user = await createUserWithRoles(email, ['user'])

	// Should still redirect to employee ID page even if inactive
	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/employee/id')
})

test('handles inactive student correctly', async () => {
	const email = `test-redirect-inactive-student-${faker.string.uuid()}@jpgacademy.org`
	await createStudent({ email, status: 'inactive' })
	const user = await createUserWithRoles(email, ['user'])

	// Should still redirect to student ID page even if inactive
	const redirectPath = await getRedirectPathForUser(user.id)
	expect(redirectPath).toBe('/student/id')
})
