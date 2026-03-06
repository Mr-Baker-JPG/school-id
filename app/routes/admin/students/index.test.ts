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

async function createStudent(data?: {
	fullName?: string
	email?: string
	status?: 'active' | 'inactive'
	hasPhoto?: boolean
	expirationDate?: Date
}) {
	const student = await prisma.student.create({
		data: {
			sisStudentId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			studentId:
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

test('Admin can view list of all students', async () => {
	const admin = await createAdminUser()
	const student1 = await createStudent({
		fullName: 'John Student',
		email: 'john@student.com',
		status: 'active',
	})
	const student2 = await createStudent({
		fullName: 'Jane Student',
		email: 'jane@student.com',
		status: 'active',
	})

	const request = await createRequestWithSession(admin.id, '/admin/students')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.students).toHaveLength(2)
	expect(result.students).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				fullName: 'John Student',
				email: 'john@student.com',
			}),
			expect.objectContaining({
				fullName: 'Jane Student',
				email: 'jane@student.com',
			}),
		]),
	)

	// Cleanup
	await prisma.student.deleteMany({
		where: { id: { in: [student1.id, student2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('List displays student name, status, and expiration date', async () => {
	const admin = await createAdminUser()
	const expirationDate = new Date('2025-12-31')
	const student = await createStudent({
		fullName: 'Test Student',
		status: 'active',
		expirationDate,
		hasPhoto: true,
	})

	const request = await createRequestWithSession(admin.id, '/admin/students')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	const foundStudent = result.students.find((s) => s.id === student.id)
	expect(foundStudent).toBeDefined()
	expect(foundStudent?.fullName).toBe('Test Student')
	expect(foundStudent?.status).toBe('active')
	expect(foundStudent?.studentId?.expirationDate).toEqual(expirationDate)
	expect(foundStudent?.studentId?.photoUrl).toBeTruthy()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Search filters students by name', async () => {
	const admin = await createAdminUser()
	const student1 = await createStudent({ fullName: 'John Student' })
	const student2 = await createStudent({ fullName: 'Jane Student' })

	const request = await createRequestWithSession(
		admin.id,
		'/admin/students?search=John',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.students).toHaveLength(1)
	expect(result.students[0].fullName).toBe('John Student')

	// Cleanup
	await prisma.student.deleteMany({
		where: { id: { in: [student1.id, student2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Search filters students by email', async () => {
	const admin = await createAdminUser()
	const student1 = await createStudent({
		fullName: 'John Student',
		email: 'john@student.com',
	})
	const student2 = await createStudent({
		fullName: 'Jane Student',
		email: 'jane@student.com',
	})

	const request = await createRequestWithSession(
		admin.id,
		'/admin/students?search=jane@student.com',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.students).toHaveLength(1)
	expect(result.students[0].email).toBe('jane@student.com')

	// Cleanup
	await prisma.student.deleteMany({
		where: { id: { in: [student1.id, student2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Filter by status (active) works correctly', async () => {
	const admin = await createAdminUser()
	const student1 = await createStudent({
		fullName: 'Active Student',
		status: 'active',
	})
	const student2 = await createStudent({
		fullName: 'Inactive Student',
		status: 'inactive',
	})

	const request = await createRequestWithSession(
		admin.id,
		'/admin/students?status=active',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.students).toHaveLength(1)
	expect(result.students[0].status).toBe('active')
	expect(result.students[0].fullName).toBe('Active Student')

	// Cleanup
	await prisma.student.deleteMany({
		where: { id: { in: [student1.id, student2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Filter by status (inactive) works correctly', async () => {
	const admin = await createAdminUser()
	const student1 = await createStudent({
		fullName: 'Active Student',
		status: 'active',
	})
	const student2 = await createStudent({
		fullName: 'Inactive Student',
		status: 'inactive',
	})

	const request = await createRequestWithSession(
		admin.id,
		'/admin/students?status=inactive',
	)

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.students).toHaveLength(1)
	expect(result.students[0].status).toBe('inactive')
	expect(result.students[0].fullName).toBe('Inactive Student')

	// Cleanup
	await prisma.student.deleteMany({
		where: { id: { in: [student1.id, student2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Non-admin users cannot access this route', async () => {
	const nonAdmin = await createNonAdminUser()

	const request = await createRequestWithSession(
		nonAdmin.id,
		'/admin/students',
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
	const request = new Request('http://localhost/admin/students')

	await expect(
		loader({
			request,
			params: {},
			context: {},
		} as any),
	).rejects.toThrow()
})
