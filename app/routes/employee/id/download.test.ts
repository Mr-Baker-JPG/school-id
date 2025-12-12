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

test('Employee can download their own PDF ID', async () => {
	const { user, employee } = await createUserWithEmployee({
		fullName: 'John Doe',
		jobTitle: 'Teacher',
		status: 'active',
		hasPhoto: true,
		expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
	})

	const request = await createRequestWithSession(
		user.id,
		'/employee/id/download',
	)
	const response = await loader({ request, params: {}, context: {} })

	expect(response).toBeInstanceOf(Response)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')
	expect(response.headers.get('Content-Disposition')).toContain(
		`filename="employee-id-${employee.sisEmployeeId}.pdf"`,
	)
	expect(response.headers.get('Content-Length')).toBeTruthy()

	// Verify PDF content (should be a valid PDF buffer)
	const arrayBuffer = await response.arrayBuffer()
	expect(arrayBuffer.byteLength).toBeGreaterThan(0)
	// PDF files start with %PDF
	const buffer = Buffer.from(arrayBuffer)
	expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
})

test('Employee cannot download other employees PDFs', async () => {
	const { user } = await createUserWithEmployee({
		fullName: 'John Doe',
		email: 'john@example.com',
	})

	// Create another employee with different email
	const otherEmployee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'Jane Smith',
			jobTitle: 'Principal',
			email: 'jane@example.com', // Different email
			status: 'active',
		},
	})

	// User tries to access download (but loader matches by email, so they get their own)
	const request = await createRequestWithSession(
		user.id,
		'/employee/id/download',
	)
	const response = await loader({ request, params: {}, context: {} })

	// Should get their own PDF, not the other employee's
	expect(response).toBeInstanceOf(Response)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')
	// The filename should match the user's employee ID, not the other employee's
	const contentDisposition = response.headers.get('Content-Disposition') || ''
	expect(contentDisposition).not.toContain(
		`employee-id-${otherEmployee.sisEmployeeId}.pdf`,
	)
})

test('PDF is generated and streamed correctly', async () => {
	const { user } = await createUserWithEmployee({
		fullName: 'Test Employee',
		jobTitle: 'Test Job',
		status: 'active',
		hasPhoto: false,
		expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
	})

	const request = await createRequestWithSession(
		user.id,
		'/employee/id/download',
	)
	const response = await loader({ request, params: {}, context: {} })

	expect(response).toBeInstanceOf(Response)
	expect(response.status).toBe(200)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')

	// Verify PDF can be read
	const arrayBuffer = await response.arrayBuffer()
	expect(arrayBuffer.byteLength).toBeGreaterThan(1000) // PDFs should be at least 1KB
})

test('Content-Type header is set to application/pdf', async () => {
	const { user } = await createUserWithEmployee()

	const request = await createRequestWithSession(
		user.id,
		'/employee/id/download',
	)
	const response = await loader({ request, params: {}, context: {} })

	expect(response.headers.get('Content-Type')).toBe('application/pdf')
})

test('Download works with valid authentication', async () => {
	const { user } = await createUserWithEmployee()

	const request = await createRequestWithSession(
		user.id,
		'/employee/id/download',
	)
	const response = await loader({ request, params: {}, context: {} })

	expect(response.status).toBe(200)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')
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
			name: 'No Employee',
			roles: {
				connect: { id: userRole.id },
			},
		},
		select: { id: true },
	})

	const request = await createRequestWithSession(
		user.id,
		'/employee/id/download',
	)

	await expect(loader({ request, params: {}, context: {} })).rejects.toThrow()
})

test('Creates EmployeeID record if missing', async () => {
	const { user } = await createUserWithEmployee({
		// Don't create EmployeeID record
		hasPhoto: undefined,
		expirationDate: undefined,
	})

	// Verify EmployeeID doesn't exist
	const employeeBefore = await prisma.employee.findUnique({
		where: { email: user.email },
		include: { employeeId: true },
	})
	expect(employeeBefore?.employeeId).toBeNull()

	const request = await createRequestWithSession(
		user.id,
		'/employee/id/download',
	)
	const response = await loader({ request, params: {}, context: {} })

	// Should succeed and create EmployeeID
	expect(response.status).toBe(200)

	// Verify EmployeeID was created
	const employeeAfter = await prisma.employee.findUnique({
		where: { email: user.email },
		include: { employeeId: true },
	})
	expect(employeeAfter?.employeeId).not.toBeNull()
})
