import { faker } from '@faker-js/faker'
import { expect, test, vi } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader } from './$employeeId.tsx'

// Mock the FACTS profile picture fetcher to prevent API calls during tests
vi.mock('#app/utils/employee.server.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('#app/utils/employee.server.ts')>()
	return {
		...original,
		fetchAndCacheFactsProfilePicture: vi.fn(() => Promise.resolve(null)),
	}
})

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
		select: { id: true },
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
		select: { id: true },
	})

	return user
}

async function createEmployee(data?: {
	fullName?: string
	email?: string
	jobTitle?: string
	status?: 'active' | 'inactive'
	hasPhoto?: boolean
	hasEmployeeId?: boolean
}) {
	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			employeeId:
				data?.hasEmployeeId !== false
					? data?.hasPhoto
						? {
								create: {
									photoUrl: 'employees/test/photo.jpg',
									expirationDate: new Date(
										Date.now() + 365 * 24 * 60 * 60 * 1000,
									),
								},
							}
						: {
								create: {
									expirationDate: new Date(
										Date.now() + 365 * 24 * 60 * 60 * 1000,
									),
								},
							}
					: undefined,
		},
		select: {
			id: true,
			fullName: true,
			email: true,
			jobTitle: true,
			status: true,
			sisEmployeeId: true,
		},
	})

	return employee
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

test('Admin can view employee detail page', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	expect(result.employee).toBeDefined()
	expect(result.employee.id).toBe(employee.id)
	expect(result.employee.fullName).toBe(employee.fullName)
	expect(result.employee.email).toBe(employee.email)
	expect(result.employee.jobTitle).toBe(employee.jobTitle)
	expect(result.employee.status).toBe(employee.status)
	expect(result.employee.sisEmployeeId).toBe(employee.sisEmployeeId)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Page displays all employee information', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({
		fullName: 'John Doe',
		email: 'john.doe@example.com',
		jobTitle: 'Teacher',
		status: 'active',
	})

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	expect(result.employee.fullName).toBe('John Doe')
	expect(result.employee.email).toBe('john.doe@example.com')
	expect(result.employee.jobTitle).toBe('Teacher')
	expect(result.employee.status).toBe('active')
	expect(result.employee.sisEmployeeId).toBeDefined()
	expect(result.employee.createdAt).toBeDefined()
	expect(result.employee.updatedAt).toBeDefined()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Page shows photo upload interface', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({ hasPhoto: false })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// EmployeeID should exist (created automatically if missing)
	expect(result.employee.employeeId).toBeDefined()
	// Photo URL should be null or undefined
	expect(result.employee.employeeId?.photoUrl).toBeFalsy()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Page shows expiration date editing', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({ hasEmployeeId: true })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// EmployeeID should exist with expiration date
	expect(result.employee.employeeId).toBeDefined()
	expect(result.employee.employeeId?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Page includes download/view ID button', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Employee data should be available for ID generation
	expect(result.employee).toBeDefined()
	expect(result.employee.id).toBeDefined()
	expect(result.employee.fullName).toBeDefined()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Non-admin users cannot access employee detail pages', async () => {
	const nonAdmin = await createNonAdminUser()
	const employee = await createEmployee()

	const request = await createRequestWithSession(
		nonAdmin.id,
		`/admin/employees/${employee.id}`,
	)

	await expect(
		loader({
			request,
			params: { employeeId: employee.id },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: nonAdmin.id } })
})

test('Returns 404 for non-existent employee', async () => {
	const admin = await createAdminUser()
	const fakeEmployeeId = faker.string.alphanumeric(20)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${fakeEmployeeId}`,
	)

	await expect(
		loader({
			request,
			params: { employeeId: fakeEmployeeId },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Creates EmployeeID record if missing', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({ hasEmployeeId: false })

	// Verify EmployeeID doesn't exist
	const beforeLoad = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
	})
	expect(beforeLoad).toBeNull()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// EmployeeID should be created automatically
	expect(result.employee.employeeId).toBeDefined()
	expect(result.employee.employeeId?.expirationDate).toBeDefined()

	// Verify EmployeeID exists in database
	const afterLoad = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
	})
	expect(afterLoad).toBeDefined()
	expect(afterLoad?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Shows SIS sync status (last updated time)', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	// Wait a moment to ensure updatedAt is different from createdAt
	await new Promise((resolve) => setTimeout(resolve, 10))

	// Update employee to change updatedAt
	await prisma.employee.update({
		where: { id: employee.id },
		data: { jobTitle: 'Updated Title' },
	})

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Should have updatedAt timestamp
	expect(result.employee.updatedAt).toBeDefined()
	expect(result.employee.updatedAt instanceof Date).toBe(true)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Shows employee with photo', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({ hasPhoto: true })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// EmployeeID should exist with photo
	expect(result.employee.employeeId).toBeDefined()
	expect(result.employee.employeeId?.photoUrl).toBeTruthy()
	expect(result.employee.employeeId?.photoUrl).toBe('employees/test/photo.jpg')

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Shows employee without photo', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({ hasPhoto: false })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// EmployeeID should exist but without photo
	expect(result.employee.employeeId).toBeDefined()
	expect(result.employee.employeeId?.photoUrl).toBeFalsy()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})
