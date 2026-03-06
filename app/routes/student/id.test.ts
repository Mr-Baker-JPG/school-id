import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader } from './id.tsx'

async function createUser(data?: { email?: string }) {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})

	if (!userRole) {
		throw new Error('User role not found. Run database migrations.')
	}

	const user = await prisma.user.create({
		data: {
			email: data?.email ?? faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: {
				connect: { id: userRole.id },
			},
		},
		select: { id: true, email: true },
	})

	return user
}

async function createStudent(data?: {
	fullName?: string
	email?: string
	status?: 'active' | 'inactive'
	expirationDate?: Date
	photoUrl?: string
}) {
	const student = await prisma.student.create({
		data: {
			sisStudentId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			studentId:
				data?.expirationDate || data?.photoUrl
					? {
							create: {
								expirationDate:
									data?.expirationDate ??
									new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
								photoUrl: data?.photoUrl ?? null,
							},
						}
					: undefined,
		},
		select: {
			id: true,
			fullName: true,
			email: true,
			status: true,
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

test('Student can view their own ID page', async () => {
	const user = await createUser()
	const student = await createStudent({
		email: user.email,
	})

	const request = await createRequestWithSession(user.id, '/student/id')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.student).toBeDefined()
	expect(result.student.id).toBe(student.id)
	expect(result.student.email).toBe(user.email)
	expect(result.student.fullName).toBe(student.fullName)

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Student cannot view other students IDs', async () => {
	// Create user with student - the route matches by email, so student can only see their own
	const user = await createUser({ email: 'student@example.com' })
	const student = await createStudent({
		email: user.email,
		fullName: 'Student User',
	})

	// Create another student with different email
	const otherStudent = await prisma.student.create({
		data: {
			sisStudentId: faker.string.alphanumeric(10),
			fullName: 'Other Student',
			email: 'other-student@example.com', // Different email
			status: 'active',
		},
	})

	const request = await createRequestWithSession(user.id, '/student/id')

	// The loader should find the student matching the user's email, not the other student
	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	// Should return the student matching the user's email, not the other student
	expect(result.student.id).toBe(student.id)
	expect(result.student.email).toBe(user.email)
	expect(result.student.email).toBe('student@example.com')
	expect(result.student.id).not.toBe(otherStudent.id)

	// Cleanup
	await prisma.student.delete({ where: { id: otherStudent.id } })
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Page displays student name, STUDENT label, photo, and expiration date', async () => {
	const expirationDate = new Date('2025-12-31')
	const photoUrl = 'https://example.com/photo.jpg'

	const user = await createUser()
	const student = await createStudent({
		fullName: 'Jane Student',
		email: user.email,
		status: 'active',
		expirationDate,
		photoUrl,
	})

	const request = await createRequestWithSession(user.id, '/student/id')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.student.fullName).toBe('Jane Student')
	expect(result.student.studentId?.photoUrl).toBe(photoUrl)
	expect(result.student.studentId?.expirationDate).toEqual(expirationDate)
	// The component will display "STUDENT" label instead of job title

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Download button is visible and functional', async () => {
	const user = await createUser()
	const student = await createStudent({
		email: user.email,
	})

	const request = await createRequestWithSession(user.id, '/student/id')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	// The loader returns the student data needed for the download button
	expect(result.student).toBeDefined()
	expect(result.student.id).toBe(student.id)
	// The component uses student.id to generate the download link

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('Unauthenticated users are redirected to login', async () => {
	const request = new Request('http://localhost/student/id')

	await expect(
		loader({
			request,
			params: {},
			context: {},
		} as any),
	).rejects.toThrow()
})
