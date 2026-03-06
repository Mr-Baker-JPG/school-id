import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getNextJuly1ExpirationDate } from '#app/utils/student.server.ts'
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
		select: { id: true },
	})

	return user
}

async function createStudent(data?: {
	fullName?: string
	email?: string
	status?: 'active' | 'inactive'
	expirationDate?: Date
}) {
	const student = await prisma.student.create({
		data: {
			sisStudentId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			studentId: data?.expirationDate
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
			studentId: {
				select: {
					expirationDate: true,
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

test('loader requires admin role', async () => {
	const student = await createStudent()
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
		`/admin/students/${student.id}/expiration`,
	)

	await expect(
		loader({
			request,
			params: { studentId: student.id },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: nonAdminUser.id } })
})

test('loader returns student data with expiration date', async () => {
	const adminUser = await createAdminUser()
	const expirationDate = new Date('2025-12-31')
	const student = await createStudent({ expirationDate })

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	expect(result.student.id).toBe(student.id)
	expect(result.student.fullName).toBe(student.fullName)
	expect(result.student.email).toBe(student.email)
	expect(result.student.studentId?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('loader returns student without StudentID record', async () => {
	const adminUser = await createAdminUser()
	const student = await createStudent()

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	expect(result.student.id).toBe(student.id)
	expect(result.student.studentId).toBeNull()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('loader returns 404 for non-existent student', async () => {
	const adminUser = await createAdminUser()
	const fakeStudentId = faker.string.uuid()

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${fakeStudentId}/expiration`,
	)

	await expect(
		loader({
			request,
			params: { studentId: fakeStudentId },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action requires admin role', async () => {
	const student = await createStudent()
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
		`/admin/students/${student.id}/expiration`,
	)

	await expect(
		action({
			request: new Request(request.url, {
				method: 'POST',
				body: formData,
				headers: request.headers,
			}),
			params: { studentId: student.id },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: nonAdminUser.id } })
})

test('action updates expiration date for existing StudentID', async () => {
	const adminUser = await createAdminUser()
	const oldExpirationDate = new Date('2024-12-31')
	const student = await createStudent({ expirationDate: oldExpirationDate })

	const newExpirationDate = '2026-12-31'
	const formData = new FormData()
	formData.append('expirationDate', newExpirationDate)

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should redirect
	expect(result).toBeInstanceOf(Response)
	expect(result.status).toBe(302)

	// Verify expiration date was updated
	const updatedStudent = await prisma.student.findUnique({
		where: { id: student.id },
		select: {
			studentId: {
				select: {
					expirationDate: true,
				},
			},
		},
	})

	expect(updatedStudent?.studentId?.expirationDate).toBeDefined()
	const updatedDate = new Date(updatedStudent!.studentId!.expirationDate)
	expect(updatedDate.toISOString().split('T')[0]).toBe(newExpirationDate)

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action creates StudentID record if it does not exist', async () => {
	const adminUser = await createAdminUser()
	const student = await createStudent() // No StudentID record

	const newExpirationDate = '2026-12-31'
	const formData = new FormData()
	formData.append('expirationDate', newExpirationDate)

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should redirect
	expect(result).toBeInstanceOf(Response)
	expect(result.status).toBe(302)

	// Verify StudentID record was created
	const updatedStudent = await prisma.student.findUnique({
		where: { id: student.id },
		select: {
			studentId: {
				select: {
					expirationDate: true,
				},
			},
		},
	})

	expect(updatedStudent?.studentId).toBeDefined()
	expect(updatedStudent?.studentId?.expirationDate).toBeDefined()
	const updatedDate = new Date(updatedStudent!.studentId!.expirationDate)
	expect(updatedDate.toISOString().split('T')[0]).toBe(newExpirationDate)

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action validates expiration date format', async () => {
	const adminUser = await createAdminUser()
	const student = await createStudent()

	const formData = new FormData()
	formData.append('expirationDate', 'invalid-date')

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should return form error (not redirect)
	// Note: data() returns DataWithResponseInit with init.status property
	const resultAny = result as any
	expect(resultAny.init?.status).toBe(400)
	expect(resultAny.data?.result?.status).toBe('error')

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action requires expiration date', async () => {
	const adminUser = await createAdminUser()
	const student = await createStudent()

	const formData = new FormData()
	// No expirationDate field

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should return form error (not redirect)
	// Note: data() returns DataWithResponseInit with init.status property
	const resultAny = result as any
	expect(resultAny.init?.status).toBe(400)
	expect(resultAny.data?.result?.status).toBe('error')

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action returns 404 for non-existent student', async () => {
	const adminUser = await createAdminUser()
	const fakeStudentId = faker.string.uuid()

	const formData = new FormData()
	formData.append('expirationDate', '2026-12-31')

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${fakeStudentId}/expiration`,
	)

	await expect(
		action({
			request: new Request(request.url, {
				method: 'POST',
				body: formData,
				headers: request.headers,
			}),
			params: { studentId: fakeStudentId },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('action accepts past dates (for expired IDs)', async () => {
	const adminUser = await createAdminUser()
	const student = await createStudent()

	// Set expiration date to a past date
	const pastDate = '2020-01-01'
	const formData = new FormData()
	formData.append('expirationDate', pastDate)

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should redirect (success)
	expect(result).toBeInstanceOf(Response)
	expect(result.status).toBe(302)

	// Verify expiration date was set
	const updatedStudent = await prisma.student.findUnique({
		where: { id: student.id },
		select: {
			studentId: {
				select: {
					expirationDate: true,
				},
			},
		},
	})

	expect(updatedStudent?.studentId?.expirationDate).toBeDefined()
	const updatedDate = new Date(updatedStudent!.studentId!.expirationDate)
	expect(updatedDate.toISOString().split('T')[0]).toBe(pastDate)

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('default expiration date is set to July 1 of current school year', async () => {
	const adminUser = await createAdminUser()
	const student = await createStudent()

	// Verify no StudentID exists yet
	const beforeStudentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(beforeStudentId).toBeNull()

	const formData = new FormData()
	formData.append('expirationDate', getNextJuly1ExpirationDate().toISOString().split('T')[0])

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should redirect (success)
	expect(result).toBeInstanceOf(Response)
	expect(result.status).toBe(302)

	// Verify StudentID was created with default expiration
	const afterStudentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { expirationDate: true },
	})
	expect(afterStudentId).toBeDefined()
	const expectedExpiration = getNextJuly1ExpirationDate()
	const actualExpiration = new Date(afterStudentId!.expirationDate)
	// Compare ISO date strings to avoid timezone issues
	expect(actualExpiration.toISOString().split('T')[0]).toBe(expectedExpiration.toISOString().split('T')[0])

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})
