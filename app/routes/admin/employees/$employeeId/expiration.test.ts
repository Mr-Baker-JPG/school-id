import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getDefaultExpirationDate } from '#app/utils/employee.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader, action } from './expiration.tsx'

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
		select: { id: true, email: true },
	})

	return user
}

async function createEmployee(data?: {
	fullName?: string
	email?: string
	jobTitle?: string
	status?: 'active' | 'inactive'
	expirationDate?: Date
}) {
	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			employeeId: data?.expirationDate
				? {
						create: {
							expirationDate: data.expirationDate,
							photoUrl: null,
						},
					}
				: undefined,
		},
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

test('loader requires admin role', async () => {
	const employee = await createEmployee()
	const userRole = await prisma.role.findUnique({ where: { name: 'user' } })
	if (!userRole) throw new Error('User role not found')

	const nonAdminUser = await prisma.user.create({
		data: {
			email: faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: { connect: { id: userRole.id } },
		},
		select: { id: true },
	})

	const request = await createRequestWithSession(
		nonAdminUser.id,
		`/admin/employees/${employee.id}/expiration`,
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
	await prisma.user.delete({ where: { id: nonAdminUser.id } })
})

test('loader returns employee data with expiration date', async () => {
	const adminUser = await createAdminUser()
	const expirationDate = new Date('2025-12-31')
	const employee = await createEmployee({ expirationDate })

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${employee.id}/expiration`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	expect(result.employee.id).toBe(employee.id)
	expect(result.employee.fullName).toBe(employee.fullName)
	expect(result.employee.email).toBe(employee.email)
	expect(result.employee.employeeId?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('loader returns employee without EmployeeID record', async () => {
	const adminUser = await createAdminUser()
	const employee = await createEmployee()

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${employee.id}/expiration`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	expect(result.employee.id).toBe(employee.id)
	expect(result.employee.employeeId).toBeNull()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('loader returns 404 for non-existent employee', async () => {
	const adminUser = await createAdminUser()
	const fakeEmployeeId = faker.string.uuid()

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${fakeEmployeeId}/expiration`,
	)

	await expect(
		loader({
			request,
			params: { employeeId: fakeEmployeeId },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action requires admin role', async () => {
	const employee = await createEmployee()
	const userRole = await prisma.role.findUnique({ where: { name: 'user' } })
	if (!userRole) throw new Error('User role not found')

	const nonAdminUser = await prisma.user.create({
		data: {
			email: faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: { connect: { id: userRole.id } },
		},
		select: { id: true },
	})

	const formData = new FormData()
	formData.append('expirationDate', '2025-12-31')

	const request = await createRequestWithSession(
		nonAdminUser.id,
		`/admin/employees/${employee.id}/expiration`,
	)

	await expect(
		action({
			request: new Request(request.url, {
				method: 'POST',
				body: formData,
				headers: request.headers,
			}),
			params: { employeeId: employee.id },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: nonAdminUser.id } })
})

test('action updates expiration date for existing EmployeeID', async () => {
	const adminUser = await createAdminUser()
	const oldExpirationDate = new Date('2024-12-31')
	const employee = await createEmployee({ expirationDate: oldExpirationDate })

	const newExpirationDate = '2026-12-31'
	const formData = new FormData()
	formData.append('expirationDate', newExpirationDate)

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${employee.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Consume the response to avoid unhandled promise rejection
	expect(result).toBeInstanceOf(Response)
	expect((result as Response).status).toBe(302) // Redirect

	// Verify expiration date was updated
	const updatedEmployee = await prisma.employee.findUnique({
		where: { id: employee.id },
		select: {
			employeeId: {
				select: {
					expirationDate: true,
				},
			},
		},
	})

	expect(updatedEmployee?.employeeId?.expirationDate).toBeDefined()
	const updatedDate = new Date(updatedEmployee!.employeeId!.expirationDate)
	expect(updatedDate.toISOString().split('T')[0]).toBe(newExpirationDate)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action creates EmployeeID record if it does not exist', async () => {
	const adminUser = await createAdminUser()
	const employee = await createEmployee() // No EmployeeID record

	const newExpirationDate = '2026-12-31'
	const formData = new FormData()
	formData.append('expirationDate', newExpirationDate)

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${employee.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Consume the response to avoid unhandled promise rejection
	expect(result).toBeInstanceOf(Response)
	expect((result as Response).status).toBe(302) // Redirect

	// Verify EmployeeID record was created
	const updatedEmployee = await prisma.employee.findUnique({
		where: { id: employee.id },
		select: {
			employeeId: {
				select: {
					expirationDate: true,
				},
			},
		},
	})

	expect(updatedEmployee?.employeeId).toBeDefined()
	expect(updatedEmployee?.employeeId?.expirationDate).toBeDefined()
	const updatedDate = new Date(updatedEmployee!.employeeId!.expirationDate)
	expect(updatedDate.toISOString().split('T')[0]).toBe(newExpirationDate)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action validates expiration date format', async () => {
	const adminUser = await createAdminUser()
	const employee = await createEmployee()

	const formData = new FormData()
	formData.append('expirationDate', 'invalid-date')

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${employee.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	expect((result as Response).status).toBe(200) // Form error, not redirect
	const responseData = await (result as Response).json()
	expect((responseData as any).result?.status).toBe('error')

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action requires expiration date', async () => {
	const adminUser = await createAdminUser()
	const employee = await createEmployee()

	const formData = new FormData()
	// No expirationDate field

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${employee.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	expect((result as Response).status).toBe(200) // Form error, not redirect
	const responseData = await (result as Response).json()
	expect((responseData as any).result?.status).toBe('error')

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action returns 404 for non-existent employee', async () => {
	const adminUser = await createAdminUser()
	const fakeEmployeeId = faker.string.uuid()

	const formData = new FormData()
	formData.append('expirationDate', '2026-12-31')

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${fakeEmployeeId}/expiration`,
	)

	await expect(
		action({
			request: new Request(request.url, {
				method: 'POST',
				body: formData,
			}),
			params: { employeeId: fakeEmployeeId },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action accepts past dates (for expired IDs)', async () => {
	const adminUser = await createAdminUser()
	const employee = await createEmployee()

	// Set expiration date to a past date
	const pastDate = '2020-01-01'
	const formData = new FormData()
	formData.append('expirationDate', pastDate)

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/employees/${employee.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Consume the response to avoid unhandled promise rejection
	expect(result).toBeInstanceOf(Response)
	expect((result as Response).status).toBe(302) // Redirect (success)

	// Verify expiration date was set
	const updatedEmployee = await prisma.employee.findUnique({
		where: { id: employee.id },
		select: {
			employeeId: {
				select: {
					expirationDate: true,
				},
			},
		},
	})

	expect(updatedEmployee?.employeeId?.expirationDate).toBeDefined()
	const updatedDate = new Date(updatedEmployee!.employeeId!.expirationDate)
	expect(updatedDate.toISOString().split('T')[0]).toBe(pastDate)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})
