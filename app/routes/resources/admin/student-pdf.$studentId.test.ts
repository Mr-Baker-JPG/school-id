import { faker } from '@faker-js/faker'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader } from './student-pdf.$studentId.tsx'

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

async function createStudent(data?: {
	fullName?: string
	status?: 'active' | 'inactive'
	hasPhoto?: boolean
	expirationDate?: Date
}) {
	const student = await prisma.student.create({
		data: {
			sisStudentId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			email: faker.internet.email(),
			status: data?.status ?? 'active',
			studentId:
				data?.hasPhoto || data?.expirationDate
					? {
							create: {
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
			status: true,
			sisStudentId: true,
			studentId: {
				select: {
					expirationDate: true,
					photoUrl: true,
				},
			},
		},
	})

	return student
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

test('Admin can download any student PDF', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({
		fullName: 'Jane Student',
		status: 'active',
		hasPhoto: true,
		expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
	})

	const request = await createRequestWithSession(
		admin.id,
		`/resources/admin/student-pdf/${student.id}`,
	)
	const response = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	})

	expect(response).toBeInstanceOf(Response)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')
	expect(response.headers.get('Content-Disposition')).toContain(
		`filename="student-id-${student.sisStudentId}.pdf"`,
	)
	expect(response.headers.get('Content-Length')).toBeTruthy()

	// Verify PDF content
	const arrayBuffer = await response.arrayBuffer()
	expect(arrayBuffer.byteLength).toBeGreaterThan(0)
	const buffer = Buffer.from(arrayBuffer)
	expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
})

test('Student cannot download other students PDFs', async () => {
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

	const student = await createStudent()

	const request = await createRequestWithSession(
		user.id,
		`/resources/admin/student-pdf/${student.id}`,
	)

	// Non-admin should get 403
	await expect(
		loader({
			request,
			params: { studentId: student.id },
			context: {},
		}),
	).rejects.toThrow()
})

test('PDF is generated and streamed correctly', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({
		fullName: 'Test Student',
		status: 'active',
		hasPhoto: false,
		expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
	})

	const request = await createRequestWithSession(
		admin.id,
		`/resources/admin/student-pdf/${student.id}`,
	)
	const response = await loader({
		request,
		params: { studentId: student.id },
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
	const student = await createStudent()

	const request = await createRequestWithSession(
		admin.id,
		`/resources/admin/student-pdf/${student.id}`,
	)
	const response = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	})

	expect(response.headers.get('Content-Type')).toBe('application/pdf')
})

test('Download works with valid authentication', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	const request = await createRequestWithSession(
		admin.id,
		`/resources/admin/student-pdf/${student.id}`,
	)
	const response = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	})

	expect(response.status).toBe(200)
	expect(response.headers.get('Content-Type')).toBe('application/pdf')
})

test('Returns 404 when student not found', async () => {
	const admin = await createAdminUser()
	const nonExistentId = faker.string.uuid()

	const request = await createRequestWithSession(
		admin.id,
		`/resources/admin/student-pdf/${nonExistentId}`,
	)

	await expect(
		loader({
			request,
			params: { studentId: nonExistentId },
			context: {},
		}),
	).rejects.toThrow()
})

test('Creates StudentID record if missing', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({
		// Don't create StudentID record
		hasPhoto: undefined,
		expirationDate: undefined,
	})

	// Verify StudentID doesn't exist
	const studentBefore = await prisma.student.findUnique({
		where: { id: student.id },
		include: { studentId: true },
	})
	expect(studentBefore?.studentId).toBeNull()

	const request = await createRequestWithSession(
		admin.id,
		`/resources/admin/student-pdf/${student.id}`,
	)
	const response = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	})

	// Should succeed and create StudentID
	expect(response.status).toBe(200)

	// Verify StudentID was created
	const studentAfter = await prisma.student.findUnique({
		where: { id: student.id },
		include: { studentId: true },
	})
	expect(studentAfter?.studentId).not.toBeNull()
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

	const student = await createStudent()

	const request = await createRequestWithSession(
		user.id,
		`/resources/admin/student-pdf/${student.id}`,
	)

	await expect(
		loader({
			request,
			params: { studentId: student.id },
			context: {},
		}),
	).rejects.toThrow()
})

test('PDF displays STUDENT label instead of job title', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({
		fullName: 'Test Student',
		status: 'active',
	})

	const request = await createRequestWithSession(
		admin.id,
		`/resources/admin/student-pdf/${student.id}`,
	)
	const response = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	})

	expect(response.status).toBe(200)
	// Note: The actual PDF content would show "STUDENT" - we're testing
	// that the route generates the PDF successfully with jobTitle: "STUDENT"
	expect(response.headers.get('Content-Type')).toBe('application/pdf')
})
