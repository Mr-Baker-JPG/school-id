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
	hasSignature?: boolean
}) {
	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			employeeId:
				data?.hasPhoto || data?.expirationDate || data?.hasSignature
					? {
							create: {
								photoUrl: data?.hasPhoto ? faker.internet.url() : null,
								expirationDate:
									data?.expirationDate ??
									new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
								gmailSignature: data?.hasSignature
									? '<div>Test Signature</div>'
									: null,
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
					gmailSignature: true,
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

	const request = await createRequestWithSession(admin.id, '/admin/employees')

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

	const request = await createRequestWithSession(admin.id, '/admin/employees')

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

test('Loader returns Gmail signature for employees', async () => {
	const admin = await createAdminUser()
	const employee1 = await createEmployee({
		fullName: 'Employee With Signature',
		hasSignature: true,
	})
	const employee2 = await createEmployee({
		fullName: 'Employee Without Signature',
		hasPhoto: true,
	})

	const request = await createRequestWithSession(admin.id, '/admin/employees')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	const foundEmployee1 = result.employees.find((e) => e.id === employee1.id)
	const foundEmployee2 = result.employees.find((e) => e.id === employee2.id)

	expect(foundEmployee1).toBeDefined()
	expect(foundEmployee1?.employeeId?.gmailSignature).toBe(
		'<div>Test Signature</div>',
	)

	expect(foundEmployee2).toBeDefined()
	expect(foundEmployee2?.employeeId?.gmailSignature).toBeNull()

	// Cleanup
	await prisma.employee.deleteMany({
		where: { id: { in: [employee1.id, employee2.id] } },
	})
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

test('System identifies IDs expiring within 30 days', async () => {
	const admin = await createAdminUser()
	const now = new Date()
	const expiringDate = new Date(now)
	expiringDate.setDate(expiringDate.getDate() + 15) // 15 days from now

	const employee = await createEmployee({
		fullName: 'Expiring Employee',
		status: 'active',
		expirationDate: expiringDate,
	})

	const request = await createRequestWithSession(admin.id, '/admin/employees')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	const foundEmployee = result.employees.find((e) => e.id === employee.id)
	expect(foundEmployee).toBeDefined()
	expect(foundEmployee?.expirationStatus?.type).toBe('expiring')
	if (foundEmployee?.expirationStatus?.type === 'expiring') {
		expect(foundEmployee.expirationStatus.daysUntilExpiration).toBe(15)
	}
	expect(result.expiringCount).toBe(1)
	expect(result.expiredCount).toBe(0)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('System identifies expired IDs', async () => {
	const admin = await createAdminUser()
	const now = new Date()
	const expiredDate = new Date(now)
	expiredDate.setDate(expiredDate.getDate() - 10) // 10 days ago

	const employee = await createEmployee({
		fullName: 'Expired Employee',
		status: 'active',
		expirationDate: expiredDate,
	})

	const request = await createRequestWithSession(admin.id, '/admin/employees')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	const foundEmployee = result.employees.find((e) => e.id === employee.id)
	expect(foundEmployee).toBeDefined()
	expect(foundEmployee?.expirationStatus?.type).toBe('expired')
	if (foundEmployee?.expirationStatus?.type === 'expired') {
		expect(foundEmployee.expirationStatus.daysSinceExpiration).toBe(10)
	}
	expect(result.expiringCount).toBe(0)
	expect(result.expiredCount).toBe(1)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Expiring IDs are displayed in admin interface', async () => {
	const admin = await createAdminUser()
	const now = new Date()
	const expiringDate = new Date(now)
	expiringDate.setDate(expiringDate.getDate() + 20) // 20 days from now

	const employee = await createEmployee({
		fullName: 'Expiring Employee',
		status: 'active',
		expirationDate: expiringDate,
	})

	const request = await createRequestWithSession(admin.id, '/admin/employees')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	const foundEmployee = result.employees.find((e) => e.id === employee.id)
	expect(foundEmployee).toBeDefined()
	expect(foundEmployee?.expirationStatus?.type).toBe('expiring')
	expect(result.expiringCount).toBe(1)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Already expired IDs are identified separately', async () => {
	const admin = await createAdminUser()
	const now = new Date()
	const expiredDate = new Date(now)
	expiredDate.setDate(expiredDate.getDate() - 5) // 5 days ago

	const employee = await createEmployee({
		fullName: 'Expired Employee',
		status: 'active',
		expirationDate: expiredDate,
	})

	const request = await createRequestWithSession(admin.id, '/admin/employees')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	const foundEmployee = result.employees.find((e) => e.id === employee.id)
	expect(foundEmployee).toBeDefined()
	expect(foundEmployee?.expirationStatus?.type).toBe('expired')
	expect(result.expiredCount).toBe(1)
	expect(result.expiringCount).toBe(0)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Expiration calculation uses correct date logic', async () => {
	const admin = await createAdminUser()
	const now = new Date()
	now.setHours(12, 0, 0, 0) // Set to noon for consistent testing

	// Test exactly 30 days
	const exactly30Days = new Date(now)
	exactly30Days.setDate(exactly30Days.getDate() + 30)
	exactly30Days.setHours(0, 0, 0, 0)

	const employee30 = await createEmployee({
		fullName: 'Employee 30 Days',
		status: 'active',
		expirationDate: exactly30Days,
	})

	// Test 31 days (should be valid, not expiring)
	const exactly31Days = new Date(now)
	exactly31Days.setDate(exactly31Days.getDate() + 31)
	exactly31Days.setHours(0, 0, 0, 0)

	const employee31 = await createEmployee({
		fullName: 'Employee 31 Days',
		status: 'active',
		expirationDate: exactly31Days,
	})

	const request = await createRequestWithSession(admin.id, '/admin/employees')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	const found30 = result.employees.find((e) => e.id === employee30.id)
	const found31 = result.employees.find((e) => e.id === employee31.id)

	expect(found30?.expirationStatus?.type).toBe('expiring')
	expect(found31?.expirationStatus?.type).toBe('valid')
	expect(result.expiringCount).toBe(1)

	// Cleanup
	await prisma.employee.deleteMany({
		where: { id: { in: [employee30.id, employee31.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})
