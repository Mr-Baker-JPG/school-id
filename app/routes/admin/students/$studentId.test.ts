import { faker } from '@faker-js/faker'
import { expect, test, vi } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { action, loader } from './$studentId.tsx'

// Mock the FACTS profile picture fetcher to prevent API calls during tests
vi.mock('#app/utils/student.server.ts', () => ({
	getNextJuly1ExpirationDate: () => new Date(2025, 6, 1), // July 1, 2025
	fetchAndCacheFactsProfilePicture: vi.fn(),
}))

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
	isNameEdited?: boolean
	hasPhoto?: boolean
	hasStudentId?: boolean
}) {
	const student = await prisma.student.create({
		data: {
			sisStudentId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			isNameEdited: data?.isNameEdited ?? false,
			studentId:
				data?.hasStudentId !== false
					? data?.hasPhoto
						? {
								create: {
									photoUrl: 'students/test/photo.jpg',
									expirationDate: new Date(
										Date.now() + 365 * 24 * 60 * 60 * 1000,
									),
								},
							}
						: {
								create: {
									expirationDate: new Date(
										Date.now() + 365 * 24 * 60 * 60 * 1000,
									),
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
			isNameEdited: true,
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

test('Admin can view student detail page', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	expect(result.student).toBeDefined()
	expect(result.student.id).toBe(student.id)
	expect(result.student.fullName).toBe(student.fullName)
	expect(result.student.email).toBe(student.email)
	expect(result.student.status).toBe(student.status)
	expect(result.student.sisStudentId).toBe(student.sisStudentId)

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Page displays all student information', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({
		fullName: 'Jane Student',
		email: 'jane@student.com',
		status: 'active',
	})

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	expect(result.student.fullName).toBe('Jane Student')
	expect(result.student.email).toBe('jane@student.com')
	expect(result.student.status).toBe('active')
	expect(result.student.sisStudentId).toBeDefined()
	expect(result.student.createdAt).toBeDefined()
	expect(result.student.updatedAt).toBeDefined()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Admin can edit student name and save changes', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({
		fullName: 'Original Name',
	})

	const formData = new FormData()
	formData.append('intent', 'update-name')
	formData.append('fullName', 'Edited Name')

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)
	request.formData = async () => formData

	const result = await action({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should redirect
	expect(result).toBeInstanceOf(Response)
	expect(result.status).toBe(302)

	// Verify name was updated in database
	const updatedStudent = await prisma.student.findUnique({
		where: { id: student.id },
		select: { fullName: true, isNameEdited: true },
	})
	expect(updatedStudent?.fullName).toBe('Edited Name')

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Edited name persists across SIS syncs (isNameEdited flag set)', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({
		fullName: 'Original Name',
		isNameEdited: false,
	})

	// Verify initial state
	expect(student.isNameEdited).toBe(false)

	const formData = new FormData()
	formData.append('intent', 'update-name')
	formData.append('fullName', 'Edited Name')

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)
	request.formData = async () => formData

	await action({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// Verify isNameEdited flag was set
	const updatedStudent = await prisma.student.findUnique({
		where: { id: student.id },
		select: { fullName: true, isNameEdited: true },
	})
	expect(updatedStudent?.isNameEdited).toBe(true)

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Page shows photo upload interface', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ hasPhoto: false })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// StudentID should exist (created automatically if missing)
	expect(result.student.studentId).toBeDefined()
	// Photo URL should be null or undefined
	expect(result.student.studentId?.photoUrl).toBeFalsy()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Page shows expiration date editing', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ hasStudentId: true })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// StudentID should exist with expiration date
	expect(result.student.studentId).toBeDefined()
	expect(result.student.studentId?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Page includes download/view ID button (student data available)', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// Student data should be available for ID generation
	expect(result.student).toBeDefined()
	expect(result.student.id).toBeDefined()
	expect(result.student.fullName).toBeDefined()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Non-admin users cannot access student detail pages', async () => {
	const nonAdmin = await createNonAdminUser()
	const student = await createStudent()

	const request = await createRequestWithSession(
		nonAdmin.id,
		`/admin/students/${student.id}`,
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
	await prisma.user.delete({ where: { id: nonAdmin.id } })
})

test('Returns 404 for non-existent student', async () => {
	const admin = await createAdminUser()
	const fakeStudentId = faker.string.alphanumeric(20)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${fakeStudentId}`,
	)

	await expect(
		loader({
			request,
			params: { studentId: fakeStudentId },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Creates StudentID record if missing', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ hasStudentId: false })

	// Verify StudentID doesn't exist
	const beforeLoad = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(beforeLoad).toBeNull()

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// StudentID should be created automatically
	expect(result.student.studentId).toBeDefined()
	expect(result.student.studentId?.expirationDate).toBeDefined()

	// Verify StudentID exists in database
	const afterLoad = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})
	expect(afterLoad).toBeDefined()
	expect(afterLoad?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Shows SIS sync status (last updated time)', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	// Wait a moment to ensure updatedAt is different from createdAt
	await new Promise((resolve) => setTimeout(resolve, 10))

	// Update student to change updatedAt
	await prisma.student.update({
		where: { id: student.id },
		data: { email: 'updated@student.com' },
	})

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should have updatedAt timestamp
	expect(result.student.updatedAt).toBeDefined()
	expect(result.student.updatedAt instanceof Date).toBe(true)

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Shows student with photo', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ hasPhoto: true })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// StudentID should exist with photo
	expect(result.student.studentId).toBeDefined()
	expect(result.student.studentId?.photoUrl).toBeTruthy()
	expect(result.student.studentId?.photoUrl).toBe('students/test/photo.jpg')

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Shows student without photo', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ hasPhoto: false })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// StudentID should exist but without photo
	expect(result.student.studentId).toBeDefined()
	expect(result.student.studentId?.photoUrl).toBeFalsy()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Shows name edited status', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ isNameEdited: true })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)

	const result = await loader({
		request,
		params: { studentId: student.id },
		context: {},
	} as any)

	// Should show isNameEdited status
	expect(result.student.isNameEdited).toBe(true)

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Empty name is rejected', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	const formData = new FormData()
	formData.append('intent', 'update-name')
	formData.append('fullName', '   ') // Empty/whitespace name

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}`,
	)
	request.formData = async () => formData

	await expect(
		action({
			request,
			params: { studentId: student.id },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})
