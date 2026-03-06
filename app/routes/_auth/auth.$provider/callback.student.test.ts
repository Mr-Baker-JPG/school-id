import { faker } from '@faker-js/faker'
import { SetCookie } from '@mjackson/headers'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { GOOGLE_PROVIDER_NAME } from '#app/utils/connections.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { getNextJuly1ExpirationDate } from '#app/utils/student.server.ts'
import { BASE_URL, convertSetCookieToCookie } from '#tests/utils.ts'

const ROUTE_PATH = '/auth/google/callback'
const PARAMS = { provider: 'google' }

// Mock the authenticator module
vi.mock('#app/utils/auth.server.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('#app/utils/auth.server.ts')>()
	return {
		...original,
		authenticator: {
			authenticate: vi.fn(),
		},
	}
})

// Import the callback loader after mocks are set up
const { loader } = await import('./callback.ts')
const { authenticator } = await import('#app/utils/auth.server.ts')

afterEach(async () => {
	await deleteGoogleUsers()
	vi.clearAllMocks()
})

beforeEach(async () => {
	// Clean up test data
	await prisma.user.deleteMany({
		where: {
			email: {
				contains: 'test-student',
			},
		},
	})
	await prisma.student.deleteMany({
		where: {
			email: {
				contains: 'test-student',
			},
		},
	})
})

/**
 * Helper to delete test google users
 */
async function deleteGoogleUsers() {
	// This is a mock, so we don't need to do anything
}

/**
 * Helper to create a student in the database
 */
async function createStudent(overrides: Partial<{
	email: string
	fullName: string
	sisStudentId: string
	status: string
}> = {}) {
	const email = overrides.email ?? `test-student-${faker.string.uuid()}@jpgacademy.org`
	return prisma.student.create({
		data: {
			email,
			fullName: overrides.fullName ?? faker.person.fullName(),
			sisStudentId: overrides.sisStudentId ?? faker.string.uuid(),
			status: (overrides.status as 'active' | 'inactive') ?? 'active',
		},
	})
}

/**
 * Helper to setup the request for Google OAuth callback
 */
async function setupGoogleRequest({
	sessionId,
	code = faker.string.uuid(),
}: { sessionId?: string; code?: string } = {}) {
	const url = new URL(ROUTE_PATH, BASE_URL)
	const state = faker.string.uuid()
	url.searchParams.set('state', state)
	url.searchParams.set('code', code)
	const authSession = await authSessionStorage.getSession()
	if (sessionId) authSession.set(sessionKey, sessionId)
	const setSessionCookieHeader =
		await authSessionStorage.commitSession(authSession)
	const searchParams = new URLSearchParams({ code, state })
	let authCookie = new SetCookie({
		name: 'google',
		value: searchParams.toString(),
		path: '/',
		sameSite: 'Lax',
		httpOnly: true,
		maxAge: 60 * 10,
		secure: process.env.NODE_ENV === 'production' || undefined,
	})
	const request = new Request(url.toString(), {
		method: 'GET',
		headers: {
			cookie: [
				authCookie.toString(),
				convertSetCookieToCookie(setSessionCookieHeader),
			].join('; '),
		},
	})
	return request
}

/**
 * Helper to create a mock Google profile
 */
function createMockGoogleProfile(email: string, name?: string) {
	return {
		id: faker.string.uuid(),
		email: email.toLowerCase(),
		name: name ?? faker.person.fullName(),
		username: email.split('@')[0],
		// Don't include imageUrl to avoid downloadFile calls in tests
	}
}

// ============================================================================
// TESTS: Student OAuth Integration
// ============================================================================

test('student can authenticate with Google OAuth using @jpgacademy.org email', async () => {
	// Create a student in the database
	const student = await createStudent({
		email: 'test-student-auth@jpgacademy.org',
		fullName: 'Test Student',
	})

	// Mock the authenticator to return a Google profile
	const profile = createMockGoogleProfile(student.email, student.fullName)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	const response = await loader({ request, params: PARAMS, context: {} })

	// Should redirect to student ID page
	expect(response).toHaveRedirect('/student/id')

	// Verify user was created with correct email
	const user = await prisma.user.findUnique({
		where: { email: student.email },
	})
	expect(user).toBeTruthy()
	expect(user?.email).toBe(student.email)

	// Verify connection was created
	const connection = await prisma.connection.findFirst({
		where: {
			userId: user!.id,
			providerName: GOOGLE_PROVIDER_NAME,
		},
	})
	expect(connection).toBeTruthy()
})

test('first-time student login creates StudentID if in SIS', async () => {
	// Create a student in SIS (Student table)
	const student = await createStudent({
		email: 'test-student-first@jpgacademy.org',
	})

	// Mock the authenticator
	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	const response = await loader({ request, params: PARAMS, context: {} })

	// Should create User record and redirect to student ID page
	expect(response).toHaveRedirect('/student/id')

	// Verify User was created
	const user = await prisma.user.findUnique({
		where: { email: student.email },
	})
	expect(user).toBeTruthy()

	// Verify StudentID was created with default expiration
	const studentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(studentId).toBeTruthy()
	expect(studentId?.expirationDate).toBeTruthy()
})

test('returning students can log in successfully', async () => {
	// Create a student in SIS
	const student = await createStudent({
		email: 'test-student-return@jpgacademy.org',
	})

	// First login
	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request1 = await setupGoogleRequest()
	await loader({ request: request1, params: PARAMS, context: {} })

	// Verify user was created
	const user = await prisma.user.findUnique({
		where: { email: student.email },
	})
	expect(user).toBeTruthy()

	// Second login (connection already exists)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)
	const request2 = await setupGoogleRequest()
	const response = await loader({ request: request2, params: PARAMS, context: {} })

	// Should redirect to student ID page
	expect(response).toHaveRedirect('/student/id')

	// Verify no duplicate users
	const users = await prisma.user.findMany({
		where: { email: student.email },
	})
	expect(users).toHaveLength(1)
})

test('session is created and maintained correctly for students', async () => {
	const student = await createStudent({
		email: 'test-student-session@jpgacademy.org',
	})

	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	const response = await loader({ request, params: PARAMS, context: {} })

	// Get the user that was created
	const user = await prisma.user.findUnique({
		where: { email: student.email },
	})
	expect(user).toBeTruthy()

	// Verify session exists in response
	await expect(response).toHaveSessionForUser(user!.id)

	// Verify session was created in database with correct expiration
	const userWithSession = await prisma.user.findUnique({
		where: { email: student.email },
		include: { sessions: true },
	})
	expect(userWithSession).toBeTruthy()
	expect(userWithSession?.sessions.length).toBeGreaterThan(0)

	// Verify session has correct expiration
	const session = userWithSession?.sessions[0]
	expect(session?.expirationDate).toBeInstanceOf(Date)
	expect(session?.expirationDate.getTime()).toBeGreaterThan(Date.now())
})

test('students are distinguished from employees in the system', async () => {
	// Create a student
	const student = await createStudent({
		email: 'test-student-distinct@jpgacademy.org',
	})

	// Create an employee with different email
	await prisma.employee.create({
		data: {
			email: 'test-employee-distinct@jpgacademy.org',
			fullName: 'Test Employee',
			jobTitle: 'Teacher',
			sisEmployeeId: faker.string.uuid(),
			status: 'active',
		},
	})

	// Login as student
	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	const response = await loader({ request, params: PARAMS, context: {} })

	// Should redirect to student ID page (not employee ID page)
	expect(response).toHaveRedirect('/student/id')
	expect(response).not.toHaveRedirect('/employee/id')

	// Verify user is linked to student, not employee
	const user = await prisma.user.findUnique({
		where: { email: student.email },
	})

	const linkedStudent = await prisma.student.findUnique({
		where: { email: user!.email },
	})
	expect(linkedStudent).toBeTruthy()
	expect(linkedStudent?.id).toBe(student.id)

	// Verify employee is not affected
	const linkedEmployee = await prisma.employee.findUnique({
		where: { email: student.email },
	})
	expect(linkedEmployee).toBeNull()
})

test('student is redirected to student ID page, not employee ID page', async () => {
	const student = await createStudent({
		email: 'test-student-redirect@jpgacademy.org',
	})

	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	const response = await loader({ request, params: PARAMS, context: {} })

	// Verify redirect to student ID page
	expect(response).toHaveRedirect('/student/id')
	expect(response).not.toHaveRedirect('/employee/id')
})

test('student without existing StudentID gets one created automatically', async () => {
	const student = await createStudent({
		email: 'test-student-auto-id@jpgacademy.org',
	})

	// Verify no StudentID exists yet
	const existingId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(existingId).toBeNull()

	// Login via Google OAuth
	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	await loader({ request, params: PARAMS, context: {} })

	// Verify StudentID was created with default expiration
	const studentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(studentId).toBeTruthy()

	// Verify default expiration is July 1
	const expectedExpiration = getNextJuly1ExpirationDate()
	expect(studentId?.expirationDate.getMonth()).toBe(expectedExpiration.getMonth())
	expect(studentId?.expirationDate.getDate()).toBe(expectedExpiration.getDate())
})

test('existing StudentID is preserved on subsequent logins', async () => {
	const student = await createStudent({
		email: 'test-student-preserve-id@jpgacademy.org',
	})

	// Create StudentID with custom expiration
	const customExpiration = new Date('2027-12-31')
	await prisma.studentID.create({
		data: {
			studentId: student.id,
			expirationDate: customExpiration,
		},
	})

	// Login via Google OAuth
	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	await loader({ request, params: PARAMS, context: {} })

	// Verify StudentID expiration was not changed
	const studentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(studentId?.expirationDate.getTime()).toBe(customExpiration.getTime())
})

test('student with inactive status can still authenticate', async () => {
	const student = await createStudent({
		email: 'test-student-inactive@jpgacademy.org',
		status: 'inactive',
	})

	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	const response = await loader({ request, params: PARAMS, context: {} })

	// Should still be able to authenticate
	expect(response).toHaveRedirect('/student/id')

	// Verify user was created
	const user = await prisma.user.findUnique({
		where: { email: student.email },
	})
	expect(user).toBeTruthy()
})

test('student not in SIS goes to onboarding', async () => {
	// Don't create a student in SIS
	const email = 'test-student-not-in-sis@jpgacademy.org'

	const profile = createMockGoogleProfile(email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	const response = await loader({ request, params: PARAMS, context: {} })

	// Should redirect to onboarding since student doesn't exist in SIS
	expect(response).toHaveRedirect('/onboarding/google')
})

test('admin student goes to admin dashboard, not student ID page', async () => {
	const student = await createStudent({
		email: 'test-student-admin@jpgacademy.org',
	})

	// First, create user and login
	const profile = createMockGoogleProfile(student.email)
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)

	const request = await setupGoogleRequest()
	await loader({ request, params: PARAMS, context: {} })

	// Now give the user admin role
	const user = await prisma.user.findUnique({
		where: { email: student.email },
	})
	if (!user) throw new Error('User should exist')

	await prisma.user.update({
		where: { id: user.id },
		data: {
			roles: {
				connect: { name: 'admin' },
			},
		},
	})

	// Login again
	vi.mocked(authenticator.authenticate).mockResolvedValueOnce(profile)
	const request2 = await setupGoogleRequest()
	const response = await loader({ request: request2, params: PARAMS, context: {} })

	// Should redirect to admin dashboard
	expect(response).toHaveRedirect('/admin/employees')
})
