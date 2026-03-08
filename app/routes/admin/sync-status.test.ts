import { faker } from '@faker-js/faker'
import { expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader } from './sync-status.tsx'

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
	updatedAt?: Date
}) {
	const employeeData: any = {
		sisEmployeeId: faker.string.alphanumeric(10),
		fullName: data?.fullName ?? faker.person.fullName(),
		jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
		email: data?.email ?? faker.internet.email(),
		status: data?.status ?? 'active',
	}

	if (data?.updatedAt) {
		// Use raw SQL to set updatedAt since Prisma doesn't allow setting it directly
		const employee = await prisma.employee.create({
			data: employeeData,
			select: { id: true },
		})

		await prisma.$executeRaw`
			UPDATE Employee 
			SET updatedAt = ${data.updatedAt} 
			WHERE id = ${employee.id}
		`

		return prisma.employee.findUnique({
			where: { id: employee.id },
			select: {
				id: true,
				fullName: true,
				email: true,
				jobTitle: true,
				status: true,
				updatedAt: true,
			},
		})
	}

	return prisma.employee.create({
		data: employeeData,
		select: {
			id: true,
			fullName: true,
			email: true,
			jobTitle: true,
			status: true,
			updatedAt: true,
		},
	})
}

async function createStudent(data?: {
	fullName?: string
	email?: string
	grade?: string
	status?: 'active' | 'inactive'
	updatedAt?: Date
}) {
	const studentData: any = {
		sisStudentId: faker.string.alphanumeric(10),
		fullName: data?.fullName ?? faker.person.fullName(),
		email: data?.email ?? faker.internet.email(),
		grade: data?.grade ?? '10',
		status: data?.status ?? 'active',
	}

	if (data?.updatedAt) {
		// Use raw SQL to set updatedAt since Prisma doesn't allow setting it directly
		const student = await prisma.student.create({
			data: studentData,
			select: { id: true },
		})

		await prisma.$executeRaw`
			UPDATE Student 
			SET updatedAt = ${data.updatedAt} 
			WHERE id = ${student.id}
		`

		return prisma.student.findUnique({
			where: { id: student.id },
			select: {
				id: true,
				fullName: true,
				email: true,
				status: true,
				updatedAt: true,
			},
		})
	}

	return prisma.student.create({
		data: studentData,
		select: {
			id: true,
			fullName: true,
			email: true,
			status: true,
			updatedAt: true,
		},
	})
}

async function createSyncHistory(data?: {
	syncType?: 'staff' | 'student'
	success?: boolean
	created?: number
	updated?: number
	errors?: number
	errorMessage?: string
	createdAt?: Date
}) {
	return prisma.syncHistory.create({
		data: {
			syncType: data?.syncType ?? 'staff',
			success: data?.success ?? true,
			created: data?.created ?? 0,
			updated: data?.updated ?? 0,
			errors: data?.errors ?? 0,
			errorMessage: data?.errorMessage ?? null,
			createdAt: data?.createdAt,
		},
	})
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

test('Dashboard displays last staff sync timestamp', async () => {
	const admin = await createAdminUser()
	const syncTime = new Date('2024-01-15T10:30:00Z')
	const lastSync = await createSyncHistory({
		syncType: 'staff',
		success: true,
		created: 5,
		updated: 10,
		errors: 0,
		createdAt: syncTime,
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.lastStaffSync).toBeDefined()
	expect(result.lastStaffSync?.id).toBe(lastSync.id)
	expect(result.lastStaffSync?.createdAt).toEqual(syncTime)
	expect(result.lastStaffSync?.success).toBe(true)
	expect(result.lastStaffSync?.created).toBe(5)
	expect(result.lastStaffSync?.updated).toBe(10)
	expect(result.lastStaffSync?.errors).toBe(0)

	// Cleanup
	await prisma.syncHistory.delete({ where: { id: lastSync.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard displays last student sync timestamp', async () => {
	const admin = await createAdminUser()
	const syncTime = new Date('2024-01-15T10:30:00Z')
	const lastSync = await createSyncHistory({
		syncType: 'student',
		success: true,
		created: 5,
		updated: 10,
		errors: 0,
		createdAt: syncTime,
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.lastStudentSync).toBeDefined()
	expect(result.lastStudentSync?.id).toBe(lastSync.id)
	expect(result.lastStudentSync?.createdAt).toEqual(syncTime)
	expect(result.lastStudentSync?.success).toBe(true)
	expect(result.lastStudentSync?.created).toBe(5)
	expect(result.lastStudentSync?.updated).toBe(10)
	expect(result.lastStudentSync?.errors).toBe(0)

	// Cleanup
	await prisma.syncHistory.delete({ where: { id: lastSync.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard shows staff sync errors if any occurred', async () => {
	const admin = await createAdminUser()
	const errorSync1 = await createSyncHistory({
		syncType: 'staff',
		success: false,
		created: 0,
		updated: 0,
		errors: 5,
		errorMessage: 'FACTS API error: Connection timeout',
		createdAt: new Date('2024-01-15T10:30:00Z'),
	})
	const errorSync2 = await createSyncHistory({
		syncType: 'staff',
		success: true,
		created: 10,
		updated: 5,
		errors: 2,
		errorMessage: undefined,
		createdAt: new Date('2024-01-15T11:00:00Z'),
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.recentStaffErrors).toBeDefined()
	expect(result.recentStaffErrors.length).toBeGreaterThanOrEqual(2)
	// Should include both errors (failed sync and sync with errors)
	expect(result.recentStaffErrors.map((e) => e.id)).toContain(errorSync1.id)
	expect(result.recentStaffErrors.map((e) => e.id)).toContain(errorSync2.id)
	// Should be sorted by createdAt desc
	expect(result.recentStaffErrors[0]?.id).toBe(errorSync2.id)
	expect(result.recentStaffErrors[0]?.errors).toBe(2)
	expect(result.recentStaffErrors[1]?.id).toBe(errorSync1.id)
	expect(result.recentStaffErrors[1]?.errors).toBe(5)
	expect(result.recentStaffErrors[1]?.errorMessage).toBe(
		'FACTS API error: Connection timeout',
	)

	// Cleanup
	await prisma.syncHistory.deleteMany({
		where: { id: { in: [errorSync1.id, errorSync2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard shows student sync errors if any occurred', async () => {
	const admin = await createAdminUser()
	const errorSync1 = await createSyncHistory({
		syncType: 'student',
		success: false,
		created: 0,
		updated: 0,
		errors: 3,
		errorMessage: 'FACTS API error: Connection timeout',
		createdAt: new Date('2024-01-15T10:30:00Z'),
	})
	const errorSync2 = await createSyncHistory({
		syncType: 'student',
		success: true,
		created: 20,
		updated: 10,
		errors: 1,
		errorMessage: undefined,
		createdAt: new Date('2024-01-15T11:00:00Z'),
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.recentStudentErrors).toBeDefined()
	expect(result.recentStudentErrors.length).toBeGreaterThanOrEqual(2)
	// Should include both errors (failed sync and sync with errors)
	expect(result.recentStudentErrors.map((e) => e.id)).toContain(errorSync1.id)
	expect(result.recentStudentErrors.map((e) => e.id)).toContain(errorSync2.id)
	// Should be sorted by createdAt desc
	expect(result.recentStudentErrors[0]?.id).toBe(errorSync2.id)
	expect(result.recentStudentErrors[0]?.errors).toBe(1)
	expect(result.recentStudentErrors[1]?.id).toBe(errorSync1.id)
	expect(result.recentStudentErrors[1]?.errors).toBe(3)
	expect(result.recentStudentErrors[1]?.errorMessage).toBe(
		'FACTS API error: Connection timeout',
	)

	// Cleanup
	await prisma.syncHistory.deleteMany({
		where: { id: { in: [errorSync1.id, errorSync2.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard lists staff with sync issues', async () => {
	const admin = await createAdminUser()
	const eightDaysAgo = new Date()
	eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)
	const threeDaysAgo = new Date()
	threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

	const oldEmployee1 = await createEmployee({
		fullName: 'Old Employee 1',
		email: 'old1@example.com',
		status: 'active',
		updatedAt: eightDaysAgo,
	})
	const oldEmployee2 = await createEmployee({
		fullName: 'Old Employee 2',
		email: 'old2@example.com',
		status: 'inactive',
		updatedAt: eightDaysAgo,
	})
	const recentEmployee = await createEmployee({
		fullName: 'Recent Employee',
		email: 'recent@example.com',
		status: 'active',
		updatedAt: threeDaysAgo,
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.staffWithSyncIssues).toBeDefined()
	expect(result.staffWithSyncIssues.length).toBeGreaterThanOrEqual(2)
	// Should include old employees but not recent ones
	const employeeIds = result.staffWithSyncIssues.map((e) => e.id)
	expect(employeeIds).toContain(oldEmployee1?.id)
	expect(employeeIds).toContain(oldEmployee2?.id)
	expect(employeeIds).not.toContain(recentEmployee?.id)

	// Should be sorted by updatedAt asc (oldest first)
	expect(
		result.staffWithSyncIssues[0]?.updatedAt.getTime(),
	).toBeLessThanOrEqual(
		result.staffWithSyncIssues[1]?.updatedAt.getTime() ?? 0,
	)

	// Cleanup
	await prisma.employee.deleteMany({
		where: {
			id: {
				in: [
					oldEmployee1?.id ?? '',
					oldEmployee2?.id ?? '',
					recentEmployee?.id ?? '',
				],
			},
		},
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard lists students with sync issues', async () => {
	const admin = await createAdminUser()
	const eightDaysAgo = new Date()
	eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)
	const threeDaysAgo = new Date()
	threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

	const oldStudent1 = await createStudent({
		fullName: 'Old Student 1',
		email: 'oldstudent1@example.com',
		status: 'active',
		updatedAt: eightDaysAgo,
	})
	const oldStudent2 = await createStudent({
		fullName: 'Old Student 2',
		email: 'oldstudent2@example.com',
		status: 'inactive',
		updatedAt: eightDaysAgo,
	})
	const recentStudent = await createStudent({
		fullName: 'Recent Student',
		email: 'recentstudent@example.com',
		status: 'active',
		updatedAt: threeDaysAgo,
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.studentsWithSyncIssues).toBeDefined()
	expect(result.studentsWithSyncIssues.length).toBeGreaterThanOrEqual(2)
	// Should include old students but not recent ones
	const studentIds = result.studentsWithSyncIssues.map((s) => s.id)
	expect(studentIds).toContain(oldStudent1?.id)
	expect(studentIds).toContain(oldStudent2?.id)
	expect(studentIds).not.toContain(recentStudent?.id)

	// Should be sorted by updatedAt asc (oldest first)
	expect(
		result.studentsWithSyncIssues[0]?.updatedAt.getTime(),
	).toBeLessThanOrEqual(
		result.studentsWithSyncIssues[1]?.updatedAt.getTime() ?? 0,
	)

	// Cleanup
	await prisma.student.deleteMany({
		where: {
			id: {
				in: [
					oldStudent1?.id ?? '',
					oldStudent2?.id ?? '',
					recentStudent?.id ?? '',
				],
			},
		},
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard shows staff statistics (total, active, inactive)', async () => {
	const admin = await createAdminUser()
	const active1 = await createEmployee({
		fullName: 'Active 1',
		status: 'active',
	})
	const active2 = await createEmployee({
		fullName: 'Active 2',
		status: 'active',
	})
	const inactive1 = await createEmployee({
		fullName: 'Inactive 1',
		status: 'inactive',
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.staffStatistics).toBeDefined()
	expect(result.staffStatistics.total).toBeGreaterThanOrEqual(3)
	expect(result.staffStatistics.active).toBeGreaterThanOrEqual(2)
	expect(result.staffStatistics.inactive).toBeGreaterThanOrEqual(1)

	// Cleanup
	await prisma.employee.deleteMany({
		where: {
			id: { in: [active1?.id ?? '', active2?.id ?? '', inactive1?.id ?? ''] },
		},
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard shows student statistics (total, active, inactive)', async () => {
	const admin = await createAdminUser()
	const active1 = await createStudent({
		fullName: 'Active Student 1',
		status: 'active',
	})
	const active2 = await createStudent({
		fullName: 'Active Student 2',
		status: 'active',
	})
	const inactive1 = await createStudent({
		fullName: 'Inactive Student 1',
		status: 'inactive',
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.studentStatistics).toBeDefined()
	expect(result.studentStatistics.total).toBeGreaterThanOrEqual(3)
	expect(result.studentStatistics.active).toBeGreaterThanOrEqual(2)
	expect(result.studentStatistics.inactive).toBeGreaterThanOrEqual(1)

	// Cleanup
	await prisma.student.deleteMany({
		where: {
			id: { in: [active1?.id ?? '', active2?.id ?? '', inactive1?.id ?? ''] },
		},
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard is only accessible to admins', async () => {
	const nonAdmin = await createNonAdminUser()

	const request = await createRequestWithSession(
		nonAdmin.id,
		'/admin/sync-status',
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
	const request = new Request('http://localhost/admin/sync-status')

	await expect(
		loader({
			request,
			params: {},
			context: {},
		} as any),
	).rejects.toThrow()
})

test('Dashboard shows no sync history when none exists', async () => {
	const admin = await createAdminUser()

	// Delete all sync history to ensure clean state
	await prisma.syncHistory.deleteMany({})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.lastStaffSync).toBeNull()
	expect(result.lastStudentSync).toBeNull()
	expect(result.recentStaffErrors).toEqual([])
	expect(result.recentStudentErrors).toEqual([])
	expect(result.staffStatistics).toBeDefined()
	expect(result.studentStatistics).toBeDefined()

	// Cleanup
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard limits staff with sync issues to 50', async () => {
	const admin = await createAdminUser()
	const eightDaysAgo = new Date()
	eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

	// Create 55 old employees
	const employees = []
	for (let i = 0; i < 55; i++) {
		const employee = await createEmployee({
			fullName: `Old Employee ${i}`,
			email: `old${i}@example.com`,
			status: 'active',
			updatedAt: eightDaysAgo,
		})
		employees.push(employee)
	}

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.staffWithSyncIssues).toHaveLength(50)

	// Cleanup
	await prisma.employee.deleteMany({
		where: { id: { in: employees.map((e) => e?.id ?? '') } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard limits students with sync issues to 50', async () => {
	const admin = await createAdminUser()
	const eightDaysAgo = new Date()
	eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

	// Create 55 old students
	const students = []
	for (let i = 0; i < 55; i++) {
		const student = await createStudent({
			fullName: `Old Student ${i}`,
			email: `oldstudent${i}@example.com`,
			status: 'active',
			updatedAt: eightDaysAgo,
		})
		students.push(student)
	}

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	expect(result.studentsWithSyncIssues).toHaveLength(50)

	// Cleanup
	await prisma.student.deleteMany({
		where: { id: { in: students.map((s) => s?.id ?? '') } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})

test('Dashboard separates staff and student sync history', async () => {
	const admin = await createAdminUser()

	// Create staff sync history
	const staffSync = await createSyncHistory({
		syncType: 'staff',
		success: true,
		created: 5,
		updated: 10,
		errors: 0,
		createdAt: new Date('2024-01-15T10:30:00Z'),
	})

	// Create student sync history
	const studentSync = await createSyncHistory({
		syncType: 'student',
		success: true,
		created: 20,
		updated: 30,
		errors: 0,
		createdAt: new Date('2024-01-15T11:00:00Z'),
	})

	const request = await createRequestWithSession(admin.id, '/admin/sync-status')

	const result = await loader({
		request,
		params: {},
		context: {},
	} as any)

	// Staff sync should not include student sync
	expect(result.lastStaffSync?.id).toBe(staffSync.id)
	expect(result.lastStaffSync?.created).toBe(5)

	// Student sync should not include staff sync
	expect(result.lastStudentSync?.id).toBe(studentSync.id)
	expect(result.lastStudentSync?.created).toBe(20)

	// Cleanup
	await prisma.syncHistory.deleteMany({
		where: { id: { in: [staffSync.id, studentSync.id] } },
	})
	await prisma.user.delete({ where: { id: admin.id } })
})
