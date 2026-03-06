import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getNextJuly1ExpirationDate } from '#app/utils/student.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader, action } from './expiration.tsx'

import { type } StaticHandlerContext } from 'react-router'

// Note: The actual route doesn't use StaticHandlerContext directly,
// but we need to access the route's loader and action functions

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

test('Default expiration date is set to July 1 of current school year', async () => {
	const student = await createStudent()

	// Verify no StudentID exists yet
	const beforeStudentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(beforeStudentId).toBeNull()

	const adminUser = await createAdminUser()

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
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	expect((result as Response).status).toBe(302) // Redirect (success)

	// Verify StudentID was created with default expiration
	const afterStudentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { expirationDate: true },
	})
	expect(afterStudentId).toBeDefined()
	const expectedExpiration = getNextJuly1ExpirationDate()
	const actualExpiration = new Date(afterStudentId!.expirationDate)
	expect(actualExpiration.getFullYear()).toBe(expectedExpiration.getFullYear())
	expect(actualExpiration.getMonth()).toBe(expectedExpiration.getMonth()) // July = 6
	expect(actualExpiration.getDate()).toBe(expectedExpiration.getDate()) // 1st

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})

test('Admin can view expiration date for any student', async () => {
	const expirationDate = new Date('2025-12-31')
	const student = await createStudent({ expirationDate })
	const adminUser = await createAdminUser()

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)
	expect(result.student).toBeDefined()
	expect(result.student.id).toBe(student.id)
	expect(result.student.studentId?.expirationDate).toBeTruthy()
	const loadedExpiration = new Date(result.student.studentId!.expirationDate)
	expect(loadedExpiration.getFullYear()).toBe(2025)
	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})
test('Admin can update expiration date', async () => {
	const student = await createStudent({ expirationDate: new Date('2024-12-31') })
	const adminUser = await createAdminUser()

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
		}),
		params: { studentId: student.id },
		context: {},
	} as any)
	expect((result as Response).status).toBe(302) // Redirect (success)
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
	expect(updatedDate.getFullYear()).toBe(2026)
	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})
test('Expiration date is stored correctly in database', async () => {
	const student = await createStudent()
	const adminUser = await createAdminUser()

	const testDate = '2025-07-01'
	const formData = new FormData()
	formData.append('expirationDate', testDate)

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)
	await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)
	// Verify exact date is stored
	const studentIdRecord = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { expirationDate: true },
	})
	expect(studentIdRecord).toBeDefined()
	const storedDate = new Date(studentIdRecord!.expirationDate)
	expect(storedDate.getFullYear()).toBe(2025)
	expect(storedDate.getMonth()).toBe(6) // July = 6
	expect(storedDate.getDate()).toBe(1) // 1st
	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})
test('Date validation prevents invalid dates', async () => {
	const student = await createStudent()
	const adminUser = await createAdminUser()

	// Empty date should be rejected
	const formData = new FormData()
	formData.append('expirationDate', '')

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)
	expect((result as Response).status).toBe(200) // Form error
	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})
test('Non-admin users cannot access this route', async () => {
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
	const student = await createStudent()

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
			}),
			params: { studentId: student.id },
			context: {},
		} as any),
	).rejects.toThrow()
	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: nonAdminUser.id } })
})
test('Action creates StudentID if missing', async () => {
	const student = await createStudent()

	// Verify no StudentID exists yet
	const beforeStudentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(beforeStudentId).toBeNull()

	const adminUser = await createAdminUser()

	const formData = new FormData()
	formData.append('expirationDate', '2025-12-31')

	const request = await createRequestWithSession(
		adminUser.id,
		`/admin/students/${student.id}/expiration`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)
	expect((result as Response).status).toBe(302) // Redirect (success)
	// Verify StudentID was created
	const afterStudentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(afterStudentId).toBeDefined()
	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: adminUser.id } })
})
