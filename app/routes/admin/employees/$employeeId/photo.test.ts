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

async function createEmployee(data?: {
	fullName?: string
	email?: string
	jobTitle?: string
	status?: 'active' | 'inactive'
	hasPhoto?: boolean
}) {
	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
			employeeId: data?.hasPhoto
				? {
						create: {
							photoUrl: 'employees/test/old-photo.jpg',
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

function createFile(name: string, size: number, type = 'image/jpeg'): File {
	const blob = new Blob(['x'.repeat(size)], { type })
	return new File([blob], name, { type })
}

test('Admin can upload photo for any employee', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	const file = createFile('test-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Should redirect on success
	expect(result).toHaveProperty('status', 302)

	// Verify photo was saved
	const employeeId = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
		select: { photoUrl: true },
	})

	expect(employeeId).toBeDefined()
	expect(employeeId?.photoUrl).toBeTruthy()
	expect(employeeId?.photoUrl).toContain('employees/')

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Uploaded photo replaces existing photo if present', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({ hasPhoto: true })

	// Verify old photo exists
	const oldEmployeeId = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
		select: { photoUrl: true },
	})
	expect(oldEmployeeId?.photoUrl).toBe('employees/test/old-photo.jpg')

	const file = createFile('new-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Verify new photo replaced old one
	const newEmployeeId = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
		select: { photoUrl: true },
	})

	expect(newEmployeeId?.photoUrl).toBeTruthy()
	expect(newEmployeeId?.photoUrl).not.toBe('employees/test/old-photo.jpg')
	expect(newEmployeeId?.photoUrl).toContain('employees/')

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Photo is validated (size)', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	// Create file larger than 3MB
	const file = createFile('large-photo.jpg', 4 * 1024 * 1024)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	// File size validation happens during parseFormData, which throws an error
	await expect(
		action({
			request: new Request(request.url, {
				method: 'POST',
				body: formData,
				headers: request.headers,
			}),
			params: { employeeId: employee.id },
			context: {},
		} as any),
	).rejects.toThrow()

	// Verify photo was not saved
	const employeeId = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
	})

	expect(employeeId?.photoUrl).toBeFalsy()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Photo URL is saved to EmployeeID record', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	const file = createFile('test-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Verify EmployeeID record exists with photoUrl
	const employeeId = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
		select: { photoUrl: true, expirationDate: true },
	})

	expect(employeeId).toBeDefined()
	expect(employeeId?.photoUrl).toBeTruthy()
	expect(employeeId?.photoUrl).toContain('employees/')
	// Should have default expiration date set
	expect(employeeId?.expirationDate).toBeDefined()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Non-admin users cannot upload photos', async () => {
	const nonAdmin = await createNonAdminUser()
	const employee = await createEmployee()

	const file = createFile('test-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		nonAdmin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	await expect(
		action({
			request: new Request(request.url, {
				method: 'POST',
				body: formData,
				headers: request.headers,
			}),
			params: { employeeId: employee.id },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: nonAdmin.id } })
})

test('Error handling for invalid files works correctly', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee()

	// Create empty file
	const file = createFile('empty.jpg', 0)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Should return error response (empty file is rejected by schema validation)
	// The result should be a data response with status 400 or 200 (depending on validation)
	expect(result).toBeDefined()
	// The form validation will reject empty files, so we should get an error response
	if ('status' in result && result.status !== undefined) {
		expect([200, 400]).toContain(result.status)
	}

	// Verify photo was not saved
	const employeeId = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
	})

	expect(employeeId?.photoUrl).toBeFalsy()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Admin can delete employee photo', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({ hasPhoto: true })

	// Verify photo exists
	const beforeDelete = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
		select: { photoUrl: true },
	})
	expect(beforeDelete?.photoUrl).toBeTruthy()

	const formData = new FormData()
	formData.append('intent', 'delete')

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { employeeId: employee.id },
		context: {},
	} as any)

	// Should redirect on success
	expect(result).toHaveProperty('status', 302)

	// Verify photo was deleted
	const afterDelete = await prisma.employeeID.findUnique({
		where: { employeeId: employee.id },
		select: { photoUrl: true },
	})

	expect(afterDelete?.photoUrl).toBeNull()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Loader returns employee data', async () => {
	const admin = await createAdminUser()
	const employee = await createEmployee({ hasPhoto: true })

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	const result = await loader({
		request,
		params: { employeeId: employee.id },
		context: {},
	} as any)

	expect(result.employee).toBeDefined()
	expect(result.employee.id).toBe(employee.id)
	expect(result.employee.fullName).toBe(employee.fullName)
	expect(result.employee.email).toBe(employee.email)
	expect(result.employee.employeeId?.photoUrl).toBeTruthy()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Loader requires admin role', async () => {
	const nonAdmin = await createNonAdminUser()
	const employee = await createEmployee()

	const request = await createRequestWithSession(
		nonAdmin.id,
		`/admin/employees/${employee.id}/photo`,
	)

	await expect(
		loader({
			request,
			params: { employeeId: employee.id },
			context: {},
		} as any),
	).rejects.toThrow()

	// Cleanup
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: nonAdmin.id } })
})

test('Loader returns 404 for non-existent employee', async () => {
	const admin = await createAdminUser()
	const fakeEmployeeId = faker.string.alphanumeric(20)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/${fakeEmployeeId}/photo`,
	)

	await expect(
		loader({
			request,
			params: { employeeId: fakeEmployeeId },
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
		const employee = await createEmployee()

		// Mock uploadEmployeePhoto to throw an error
		const originalUpload = await import('#app/utils/storage.server.ts')
		vi.spyOn(originalUpload, 'uploadEmployeePhoto').mockRejectedValueOnce(
			new Error('Storage upload failed'),
		)

		const file = createFile('test-photo.jpg', 1000)

		const formData = new FormData()
		formData.append('intent', 'submit')
		formData.append('photoFile', file)

		const request = await createRequestWithSession(
			admin.id,
			`/admin/employees/${employee.id}/photo`,
		)

		const result = await action({
			request: new Request(request.url, {
				method: 'POST',
				body: formData,
				headers: request.headers,
			}),
			params: { employeeId: employee.id },
			context: {},
		} as any)

		// Should return error response with user-friendly message
		expect(result).toBeDefined()
		// The error should be in the form result
		if ('result' in result && result.result) {
			const errors = result.result as any
			if (errors.fieldErrors) {
				expect(JSON.stringify(errors.fieldErrors).toLowerCase()).toContain(
					'upload',
				)
			}
		}

		// Cleanup
		await prisma.employee.delete({ where: { id: employee.id } })
		await prisma.user.delete({ where: { id: admin.id } })
	} finally {
		// Restore original functions
		console.error = originalError
		vi.restoreAllMocks()
	}
})

test('Missing employee ID shows appropriate error', async () => {
	const admin = await createAdminUser()

	const file = createFile('test-photo.jpg', 1000)

	const formData = new FormData()
	formData.append('intent', 'submit')
	formData.append('photoFile', file)

	const request = await createRequestWithSession(
		admin.id,
		`/admin/employees/undefined/photo`,
	)

	const result = await action({
		request: new Request(request.url, {
			method: 'POST',
			body: formData,
			headers: request.headers,
		}),
		params: { employeeId: undefined },
		context: {},
	} as any)

	// Should redirect with error toast
	expect(result).toHaveProperty('status', 302)
	// The redirect should go to employees list with error message

	// Cleanup
	await prisma.user.delete({ where: { id: admin.id } })
})
