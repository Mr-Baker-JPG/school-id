import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader } from './index.tsx'

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
	expirationDate?: Date
}) {
	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			employeeId: data?.hasPhoto || data?.expirationDate
				? {
						create: {
							photoUrl: data?.hasPhoto
								? faker.internet.url()
								: null,
							expirationDate:
								data?.expirationDate ??
								new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
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
			employeeId: {
				select: {
					expirationDate: true,
					photoUrl: true,
				},
			},
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

test('Admin can view list of all employees', async () => {
	const admin = await createAdminUser()
	const employee1 = await createEmployee({
		fullName: 'John Doe',
		email: 'john@example.com',
		jobTitle: 'Teacher',
		status: 'active',
	})
	const employee2 = await createEmployee({
		fullName: 'Jane Smith',
		email: 'jane@example.com',
		jobTitle: 'Principal',
		status: 'active',
	})

	const request = await createRequestWithSession(
		admin.id,
		'/admin/employees',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.employees).toHaveLength(2)
	expect(result.employees).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				fullName: 'John Doe',
				email: 'john@example.com',
			}),
			expect.objectContaining({
				fullName: 'Jane Smith',
				email: 'jane@example.com',
			}),
		]),
	)

	// Cleanup
	await prisma.employee.deleteMany({
		where: { id: { in: [employee1.id, employee2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('List displays employee name, job title, status, and expiration date', async () => {
	const admin = await createAdminUser()
	const expirationDate = new Date('2025-12-31')
	const employee = await createEmployee({
		fullName: 'Test Employee',
		jobTitle: 'Test Job',
		status: 'active',
		expirationDate,
		hasPhoto: true,
	})

	const request = await createRequestWithSession(
		admin.id,
		'/admin/employees',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	const foundEmployee = result.employees.find((e) => e.id === employee.id)
	expect(foundEmployee).toBeDefined()
	expect(foundEmployee?.fullName).toBe('Test Employee')
	expect(foundEmployee?.jobTitle).toBe('Test Job')
	expect(foundEmployee?.status).toBe('active')
	expect(foundEmployee?.employeeId?.expirationDate).toEqual(expirationDate)
	expect(foundEmployee?.employeeId?.photoUrl).toBeTruthy()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Search filters employees by name', async () => {
	const admin = await createAdminUser()
	const employee1 = await createEmployee({ fullName: 'John Doe' })
	const employee2 = await createEmployee({ fullName: 'Jane Smith' })

	const request = await createRequestWithSession(
		admin.id,
		'/admin/employees?search=John',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.employees).toHaveLength(1)
	expect(result.employees[0].fullName).toBe('John Doe')

	// Cleanup
	await prisma.employee.deleteMany({
		where: { id: { in: [employee1.id, employee2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Search filters employees by email', async () => {
	const admin = await createAdminUser()
	const employee1 = await createEmployee({
		fullName: 'John Doe',
		email: 'john@example.com',
	})
	const employee2 = await createEmployee({
		fullName: 'Jane Smith',
		email: 'jane@example.com',
	})

	const request = await createRequestWithSession(
		admin.id,
		'/admin/employees?search=jane@example.com',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.employees).toHaveLength(1)
	expect(result.employees[0].email).toBe('jane@example.com')

	// Cleanup
	await prisma.employee.deleteMany({
		where: { id: { in: [employee1.id, employee2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Filter by status (active) works correctly', async () => {
	const admin = await createAdminUser()
	const employee1 = await createEmployee({
		fullName: 'Active Employee',
		status: 'active',
	})
	const employee2 = await createEmployee({
		fullName: 'Inactive Employee',
		status: 'inactive',
	})

	const request = await createRequestWithSession(
		admin.id,
		'/admin/employees?status=active',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.employees).toHaveLength(1)
	expect(result.employees[0].status).toBe('active')
	expect(result.employees[0].fullName).toBe('Active Employee')

	// Cleanup
	await prisma.employee.deleteMany({
		where: { id: { in: [employee1.id, employee2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Filter by status (inactive) works correctly', async () => {
	const admin = await createAdminUser()
	const employee1 = await createEmployee({
		fullName: 'Active Employee',
		status: 'active',
	})
	const employee2 = await createEmployee({
		fullName: 'Inactive Employee',
		status: 'inactive',
	})

	const request = await createRequestWithSession(
		admin.id,
		'/admin/employees?status=inactive',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.employees).toHaveLength(1)
	expect(result.employees[0].status).toBe('inactive')
	expect(result.employees[0].fullName).toBe('Inactive Employee')

	// Cleanup
	await prisma.employee.deleteMany({
		where: { id: { in: [employee1.id, employee2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Non-admin users cannot access this route', async () => {
	const nonAdmin = await createNonAdminUser()

	const request = await createRequestWithSession(
		nonAdmin.id,
		'/admin/employees',
	)

	await expect(
		loader({
			request,
			params: {},
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.user.delete({ where: { id: nonAdmin.id } })
})

test('Unauthenticated users cannot access this route', async () => {
	const request = new Request('http://localhost/admin/employees')

	await expect(
		loader({
			request,
			params: {},
			context: {},
		} as any),
	).rejects.toThrow()
})
