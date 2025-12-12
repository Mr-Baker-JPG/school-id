import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader } from './id.tsx'

async function createUserWithEmployee(data?: {
	email?: string
	fullName?: string
	jobTitle?: string
	status?: 'active' | 'inactive'
	hasPhoto?: boolean
	expirationDate?: Date
}) {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})

	if (!userRole) {
		throw new Error('User role not found. Run database migrations.')
	}

	const email = data?.email ?? faker.internet.email()

	const user = await prisma.user.create({
		data: {
			email,
			username: faker.internet.username(),
			name: data?.fullName ?? faker.person.fullName(),
			roles: {
				connect: { id: userRole.id },
			},
		},
		select: { id: true, email: true },
	})

	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
			email: user.email, // Match user email
			status: data?.status ?? 'active',
			employeeId:
				data?.hasPhoto || data?.expirationDate
					? {
							create: {
								photoUrl: data?.hasPhoto ? faker.internet.url() : null,
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

	return { user, employee }
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

test('Employee can view their own ID page', async () => {
	const { user, employee } = await createUserWithEmployee({
		fullName: 'John Doe',
		jobTitle: 'Teacher',
		status: 'active',
	})

	const request = await createRequestWithSession(user.id, '/employee/id')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.employee).toBeDefined()
	expect(result.employee.id).toBe(employee.id)
	expect(result.employee.fullName).toBe('John Doe')
	expect(result.employee.jobTitle).toBe('Teacher')
	expect(result.employee.email).toBe(user.email)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Employee cannot view other employees IDs', async () => {
	// Create user with employee - the route matches by email, so employee can only see their own
	const { user, employee } = await createUserWithEmployee({
		email: 'employee@example.com',
		fullName: 'Employee User',
	})

	// Create another employee with different email
	const otherEmployee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'Other Employee',
			jobTitle: 'Principal',
			email: 'other@example.com', // Different email
			status: 'active',
		},
	})

	const request = await createRequestWithSession(user.id, '/employee/id')

	// The loader should find the employee matching the user's email, not the other employee
	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	// Should return the employee matching the user's email, not the other employee
	expect(result.employee.id).toBe(employee.id)
	expect(result.employee.email).toBe(user.email)
	expect(result.employee.email).toBe('employee@example.com')
	expect(result.employee.id).not.toBe(otherEmployee.id)

	// Cleanup
	await prisma.employee.delete({ where: { id: otherEmployee.id } })
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Page displays employee name, title, photo, and expiration date', async () => {
	const expirationDate = new Date('2025-12-31')
	const photoUrl = 'https://example.com/photo.jpg'

	const { user, employee } = await createUserWithEmployee({
		fullName: 'Jane Smith',
		jobTitle: 'Principal',
		status: 'active',
		hasPhoto: true,
		expirationDate,
	})

	// Update employee with photo URL
	await prisma.employeeID.update({
		where: { employeeId: employee.id },
		data: { photoUrl },
	})

	const request = await createRequestWithSession(user.id, '/employee/id')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.employee.fullName).toBe('Jane Smith')
	expect(result.employee.jobTitle).toBe('Principal')
	expect(result.employee.employeeId?.photoUrl).toBe(photoUrl)
	expect(result.employee.employeeId?.expirationDate).toEqual(expirationDate)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Page handles employee without EmployeeID record', async () => {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})

	if (!userRole) {
		throw new Error('User role not found. Run database migrations.')
	}

	const email = faker.internet.email()
	const user = await prisma.user.create({
		data: {
			email,
			username: faker.internet.username(),
			name: 'No EmployeeID Employee',
			roles: {
				connect: { id: userRole.id },
			},
		},
		select: { id: true, email: true },
	})

	// Create employee without EmployeeID record
	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'No EmployeeID Employee',
			jobTitle: 'Teacher',
			email: user.email,
			status: 'active',
			// No employeeId relation
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

	// Verify EmployeeID doesn't exist before
	const employeeBefore = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	expect(employeeBefore?.employeeId).toBeNull()

	const request = await createRequestWithSession(user.id, '/employee/id')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.employee.fullName).toBe('No EmployeeID Employee')
	// EmployeeID should now exist (created automatically)
	expect(result.employee.employeeId).not.toBeNull()
	expect(result.employee.employeeId?.expirationDate).toBeDefined()
	expect(result.employee.employeeId?.photoUrl).toBeNull()

	// Verify EmployeeID was created in database
	const employeeAfter = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	expect(employeeAfter?.employeeId).not.toBeNull()
	expect(employeeAfter?.employeeId?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('EmployeeID record created when employee first views their ID', async () => {
	const { user, employee } = await createUserWithEmployee({
		// Don't create EmployeeID record
		hasPhoto: undefined,
		expirationDate: undefined,
	})

	// Verify EmployeeID doesn't exist before
	const employeeBefore = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	expect(employeeBefore?.employeeId).toBeNull()

	const request = await createRequestWithSession(user.id, '/employee/id')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	// Should succeed and create EmployeeID
	expect(result.employee).toBeDefined()
	expect(result.employee.id).toBe(employee.id)
	expect(result.employee.employeeId).not.toBeNull()
	expect(result.employee.employeeId?.expirationDate).toBeDefined()
	expect(result.employee.employeeId?.photoUrl).toBeNull()

	// Verify EmployeeID was created in database
	const employeeAfter = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	expect(employeeAfter?.employeeId).not.toBeNull()
	expect(employeeAfter?.employeeId?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Default expiration date set to July 1 when EmployeeID created', async () => {
	const { user, employee } = await createUserWithEmployee({
		// Don't create EmployeeID record
		hasPhoto: undefined,
		expirationDate: undefined,
	})

	const request = await createRequestWithSession(user.id, '/employee/id')

	await loader({
		request,
		params: {},
		context: {},
	} as any)

	// Verify EmployeeID was created with default expiration date
	const employeeAfter = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	expect(employeeAfter?.employeeId).not.toBeNull()

	const expirationDate = employeeAfter?.employeeId?.expirationDate
	expect(expirationDate).toBeDefined()

	// Check that expiration date is July 1 of current year
	const now = new Date()
	const expectedYear = now.getFullYear()
	const expectedDate = new Date(expectedYear, 6, 1) // July 1 (month is 0-indexed)

	expect(expirationDate?.getFullYear()).toBe(expectedYear)
	expect(expirationDate?.getMonth()).toBe(6) // July
	expect(expirationDate?.getDate()).toBe(1)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Subsequent views do not recreate EmployeeID record', async () => {
	const { user, employee } = await createUserWithEmployee({
		// Don't create EmployeeID record
		hasPhoto: undefined,
		expirationDate: undefined,
	})

	const request1 = await createRequestWithSession(user.id, '/employee/id')
	const result1 = await loader({
		request: request1,
		params: {},
		context: {},
	} as any)

	// Get the EmployeeID ID that was created
	const employeeAfterFirst = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	const employeeIdRecordId = employeeAfterFirst?.employeeId?.id
	expect(employeeIdRecordId).toBeDefined()

	// View again
	const request2 = await createRequestWithSession(user.id, '/employee/id')
	const result2 = await loader({
		request: request2,
		params: {},
		context: {},
	} as any)

	// Verify same EmployeeID record exists (not recreated)
	const employeeAfterSecond = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	expect(employeeAfterSecond?.employeeId?.id).toBe(employeeIdRecordId)

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Unauthenticated users are redirected to login', async () => {
	const request = new Request('http://localhost/employee/id')

	await expect(
		loader({
			request,
			params: {},
			context: {},
		} as any),
	).rejects.toThrow()
})

test('Returns 404 when employee record not found', async () => {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})

	if (!userRole) {
		throw new Error('User role not found. Run database migrations.')
	}

	// Create user without matching employee
	const user = await prisma.user.create({
		data: {
			email: 'noemployee@example.com',
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: {
				connect: { id: userRole.id },
			},
		},
		select: { id: true },
	})

	const request = await createRequestWithSession(user.id, '/employee/id')

	// invariantResponse throws a Response object
	await expect(
		loader({
			request,
			params: {},
			context: {},
		} as any),
	).rejects.toThrow()

	// Verify it's a Response with 404 status
	try {
		await loader({
			request,
			params: {},
			context: {},
		} as any)
		expect.fail('Should have thrown')
	} catch (error) {
		expect(error).toBeInstanceOf(Response)
		if (error instanceof Response) {
			expect(error.status).toBe(404)
		}
	}

	// Cleanup
	await prisma.user.delete({ where: { id: user.id } })
})
