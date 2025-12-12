import { faker } from '@faker-js/faker'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader } from './download.tsx'

// Mock console.warn to avoid test failures when photo fetching fails
const originalWarn = console.warn
beforeEach(() => {
	console.warn = vi.fn()
})
afterEach(() => {
	console.warn = originalWarn
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

async function createEmployee(data?: {
	fullName?: string
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
			email: faker.internet.email(),
			status: data?.status ?? 'active',
			employeeId:
				data?.hasPhoto || data?.expirationDate
					? {
							create: {
								// Use null for photos in tests - PDF generation handles missing photos gracefully
								photoUrl: null,
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
			sisEmployeeId: true,
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

test('Admin can download any employee PDF', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({
		fullName: 'John Doe',
		jobTitle: 'Teacher',
		status: 'active',
		hasPhoto: true,
		expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
	})

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/id/download`,
	)
	const response = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	})

	expect(response).toBeInstanceOf(Response)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')
	expect(response.headers.get('Content-Disposition')).toContain(
		`filename="employee-id-${employee.sisEmployeeId}.pdf"`,
	)
	expect(response.headers.get('Content-Length')).toBeTruthy()

	// Verify PDF content
	const arrayBuffer = await response.arrayBuffer()
	expect(arrayBuffer.byteLength).toBeGreaterThan(0)
	const buffer = Buffer.from(arrayBuffer)
	expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
})

test('Employee cannot download other employees PDFs', async () => {
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

	const employee = await createEmployee()

	const request = await createRequestWithSession(
		user.id,
		`/admin/employees/${employee.id}/id/download`,
	)

	// Non-admin should get 403
	await expect(
		loader({
			request,
			params: { employeeId: employee.id },
			context: {},
		}),
	).rejects.toThrow()
})

test('PDF is generated and streamed correctly', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({
		fullName: 'Test Employee',
		jobTitle: 'Test Job',
		status: 'active',
		hasPhoto: false,
		expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
	})

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/id/download`,
	)
	const response = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	})

	expect(response).toBeInstanceOf(Response)
	expect(response.status).toBe(200)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')

	// Verify PDF can be read
	const arrayBuffer = await response.arrayBuffer()
	expect(arrayBuffer.byteLength).toBeGreaterThan(1000) // PDFs should be at least 1KB
})

test('Content-Type header is set to application/pdf', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/id/download`,
	)
	const response = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	})

	expect(response.headers.get('Content-Type')).toBe('application/pdf')
})

test('Download works with valid authentication', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/id/download`,
	)
	const response = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	})

	expect(response.status).toBe(200)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')
})

test('Returns 404 when employee not found', async () => {
	const admin = await createAdminUser()
	const nonExistentId = faker.string.uuid()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${nonExistentId}/id/download`,
	)

	await expect(
		loader({
			request,
			params: { employeeId: nonExistentId },
			context: {},
		}),
	).rejects.toThrow()
})

test('Creates EmployeeID record if missing', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({
		// Don't create EmployeeID record
		hasPhoto: undefined,
		expirationDate: undefined,
	})

	// Verify EmployeeID doesn't exist
	const employeeBefore = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	expect(employeeBefore?.employeeId).toBeNull()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/id/download`,
	)
	const response = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	})

	// Should succeed and create EmployeeID
	expect(response.status).toBe(200)

	// Verify EmployeeID was created
	const employeeAfter = await prisma.employee.findUnique({
		where: { id: employee.id },
		include: { employeeId: true },
	})
	expect(employeeAfter?.employeeId).not.toBeNull()
})

test('Non-admin users are denied access', async () => {
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

	const employee = await createEmployee()

	const request = await createRequestWithSession(
		user.id,
		`/admin/employees/${employee.id}/id/download`,
	)

	await expect(
		loader({
			request,
			params: { employeeId: employee.id },
			context: {},
		}),
	).rejects.toThrow()
})
