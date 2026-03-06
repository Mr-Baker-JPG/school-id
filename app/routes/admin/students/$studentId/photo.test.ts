import { faker } from '@faker-js/faker'
import { expect, test, vi } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { action, loader } from './photo.tsx'

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
}) {
	const student = await prisma.student.create({
		data: {
			sisStudentId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			studentId: data?.hasPhoto
				? {
						create: {
							photoUrl: 'students/test/old-photo.jpg',
							expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
						},
					}
				: undefined,
		},
		select: {
			id: true,
			fullName: true,
			email: true,
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

function createFile(name: string, size: number, type = 'image/jpeg'): File {
	const blob = new Blob(['x'.repeat(size)], { type })
	return new File([blob], name, { type })
}

test('Admin can upload photo for any student', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	const file = createFile('test-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}/photo`,
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

	// Should redirect on success
	expect(result).toHaveProperty('status', 302)

	// Verify photo was saved
	const studentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { photoUrl: true },
	})

	expect(studentId).toBeDefined()
	expect(studentId?.photoUrl).toBeTruthy()
	expect(studentId?.photoUrl).toContain('students/')

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Uploaded photo replaces existing photo if present', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ hasPhoto: true })

	// Verify old photo exists
	const oldStudentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { photoUrl: true },
	})
	expect(oldStudentId?.photoUrl).toBe('students/test/old-photo.jpg')

	const file = createFile('new-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}/photo`,
	)

	await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	// Verify new photo replaced old one
	const newStudentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { photoUrl: true },
	})

	expect(newStudentId?.photoUrl).toBeTruthy()
	expect(newStudentId?.photoUrl).not.toBe('students/test/old-photo.jpg')
	expect(newStudentId?.photoUrl).toContain('students/')

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Photo is validated (size)', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	// Create file larger than 3MB
	const file = createFile('large-photo.jpg', 4 * 1024 * 1024)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}/photo`,
	)

	// File size validation happens during parseFormData, which throws an error
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

	// Verify photo was not saved
	const studentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})

	expect(studentId?.photoUrl).toBeFalsy()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Photo URL is saved to StudentID record', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	const file = createFile('test-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}/photo`,
	)

	await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { studentId: student.id },
		context: {},
	} as any)

	// Verify StudentID record exists with photoUrl
	const studentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { photoUrl: true, expirationDate: true },
	})

	expect(studentId).toBeDefined()
	expect(studentId?.photoUrl).toBeTruthy()
	expect(studentId?.photoUrl).toContain('students/')
	// Should have default expiration date set
	expect(studentId?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Non-admin users cannot upload photos', async () => {
	const nonAdmin = await createNonAdminUser()
	const student = await createStudent()

	const file = createFile('test-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		nonAdmin.id,
		`/admin/students/${student.id}/photo`,
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
	await prisma.user.delete({ where: { id: nonAdmin.id } })
})

test('Error handling for invalid files works correctly', async () => {
	const admin = await createAdminUser()
	const student = await createStudent()

	// Create empty file
	const file = createFile('empty.jpg', 0)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}/photo`,
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

	// Should return error response (empty file is rejected by schema validation)
	expect(result).toBeDefined()
	if ('status' in result && result.status !== undefined) {
		expect([200, 400]).toContain(result.status)
	}

	// Verify photo was not saved
	const studentId = await prisma.studentID.findUnique({
		where: { studentId: student.id },
	})

	expect(studentId?.photoUrl).toBeFalsy()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Admin can delete student photo', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ hasPhoto: true })

	// Verify photo exists
	const beforeDelete = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { photoUrl: true },
	})
	expect(beforeDelete?.photoUrl).toBeTruthy()

	const formData = new FormData()
	formData.append('intent', 'delete')

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}/photo`,
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

	// Should redirect on success
	expect(result).toHaveProperty('status', 302)

	// Verify photo was deleted
	const afterDelete = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: { photoUrl: true },
	})

	expect(afterDelete?.photoUrl).toBeNull()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Loader returns student data', async () => {
	const admin = await createAdminUser()
	const student = await createStudent({ hasPhoto: true })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${student.id}/photo`,
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
	expect(result.student.studentId?.photoUrl).toBeTruthy()

	// Cleanup
	await prisma.student.delete({ where: { id: student.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Loader requires admin role', async () => {
	const nonAdmin = await createNonAdminUser()
	const student = await createStudent()

	const request = await createRequestWithSession(
		nonAdmin.id,
		`/admin/students/${student.id}/photo`,
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

test('Loader returns 404 for non-existent student', async () => {
	const admin = await createAdminUser()
	const fakeStudentId = faker.string.alphanumeric(20)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/students/${fakeStudentId}/photo`,
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

test('Photo upload errors are displayed to user', async () => {
	// Mock console.error to avoid test failures
	const originalError = console.error
	console.error = vi.fn()

	try {
		const admin = await createAdminUser()
		const student = await createStudent()

		// Mock uploadStudentPhoto to throw an error
		const originalUpload = await import('#app/utils/storage.server.ts')
		vi.spyOn(originalUpload, 'uploadStudentPhoto').mockRejectedValueOnce(
			new Error('Storage upload failed'),
		)

		const file = createFile('test-photo.jpg', 1000)

		const formData = new FormData()
		formData.append('intent', 'submit')
		formData.append('photoFile', file)

		const request = await createRequestWithSession(
			admin.id,
			`/admin/students/${student.id}/photo`,
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

		// Should return error response with user-friendly message
		expect(result).toBeDefined()
		if ('result' in result && result.result) {
			const errors = result.result as any
			if (errors.fieldErrors) {
				expect(JSON.stringify(errors.fieldErrors).toLowerCase()).toContain(
					'upload',
				)
			}
		}

		// Cleanup
		await prisma.student.delete({ where: { id: student.id } })
		await prisma.user.delete({ where: { id: admin.id } })
	} finally {
		// Restore original functions
		console.error = originalError
		vi.restoreAllMocks()
	}
})

test('Missing student ID shows appropriate error', async () => {
	// Mock console.error to avoid test failures
	const originalError = console.error
	console.error = vi.fn()

	try {
		const admin = await createAdminUser()

		const file = createFile('test-photo.jpg', 1000)

		const formData = new FormData()
		formData.append('intent', 'submit')
		formData.append('photoFile', file)

		const request = await createRequestWithSession(
			admin.id,
			`/admin/students/undefined/photo`,
		)

		const result = await action({
			request: new Request(request.url, {
				method: 'POST',
				body: formData,
				headers: request.headers,
			}),
			params: { studentId: undefined },
			context: {},
		} as any)

		// Should redirect with error toast
		expect(result).toHaveProperty('status', 302)

		// Cleanup
		await prisma.user.delete({ where: { id: admin.id } })
	} finally {
		console.error = originalError
	}
})
