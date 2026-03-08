import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { prisma } from './db.server.ts'
import { sendExpirationNotifications } from './expiration-notifications.server.tsx'
import { sendEmail } from './email.server.ts'
import { consoleError, consoleWarn } from '#app/utils/misc.tsx'

// Mock the sendEmail function
vi.mock('./email.server.ts', () => ({
	sendEmail: vi.fn(),
}))

// Mock console functions
vi.mock('#app/utils/misc.tsx', async () => {
	const actual = await vi.importActual('#app/utils/misc.tsx')
	return {
		...actual,
		consoleError: vi.fn(),
		consoleWarn: vi.fn(),
	}
})

describe('sendExpirationNotifications', () => {
	beforeEach(async () => {
		// Clean up test data
		await prisma.studentID.deleteMany()
		await prisma.student.deleteMany()
		await prisma.employeeID.deleteMany()
		await prisma.employee.deleteMany()
		await prisma.user.deleteMany()

		// Reset mocks
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it('sends notification with both employee and student expirations', async () => {
		const now = new Date()
		const expiringDate = new Date(now)
		expiringDate.setDate(expiringDate.getDate() + 15) // 15 days from now

		// Create admin user
		await prisma.user.create({
			data: {
				email: 'admin@example.com',
				username: 'admin',
				roles: {
					connectOrCreate: {
						where: { name: 'admin' },
						create: { name: 'admin' },
					},
				},
			},
		})

		// Create employee with expiring ID
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'EMP001',
				fullName: 'Test Employee',
				jobTitle: 'Teacher',
				email: 'employee@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		// Create student with expiring ID
		await prisma.student.create({
			data: {
				sisStudentId: 'STU001',
				fullName: 'Test Student',
				email: 'student@example.com',
				status: 'active',
				studentId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		// Mock sendEmail to resolve successfully
		vi.mocked(sendEmail).mockResolvedValue({ id: 'test-email-id' })

		const result = await sendExpirationNotifications(30, now)

		expect(result.success).toBe(true)
		expect(sendEmail).toHaveBeenCalledTimes(1)

		// Verify email was sent with correct data
		const emailCall = vi.mocked(sendEmail).mock.calls[0]
		expect(emailCall[0].to).toBe('admin@example.com')
		expect(emailCall[0].subject).toContain('2 expiring')
	})

	it('sends notification with expired employee and student IDs', async () => {
		const now = new Date()
		const expiredDate = new Date(now)
		expiredDate.setDate(expiredDate.getDate() - 10) // 10 days ago

		// Create admin user
		await prisma.user.create({
			data: {
				email: 'admin@example.com',
				username: 'admin',
				roles: {
					connectOrCreate: {
						where: { name: 'admin' },
						create: { name: 'admin' },
					},
				},
			},
		})

		// Create employee with expired ID
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'EMP002',
				fullName: 'Expired Employee',
				jobTitle: 'Teacher',
				email: 'expired-emp@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: expiredDate,
					},
				},
			},
		})

		// Create student with expired ID
		await prisma.student.create({
			data: {
				sisStudentId: 'STU002',
				fullName: 'Expired Student',
				email: 'expired-stu@example.com',
				status: 'active',
				studentId: {
					create: {
						expirationDate: expiredDate,
					},
				},
			},
		})

		vi.mocked(sendEmail).mockResolvedValue({ id: 'test-email-id' })

		const result = await sendExpirationNotifications(30, now)

		expect(result.success).toBe(true)
		expect(sendEmail).toHaveBeenCalledTimes(1)

		const emailCall = vi.mocked(sendEmail).mock.calls[0]
		expect(emailCall[0].subject).toContain('2 expired')
	})

	it('sends notification with mixed expiring and expired IDs', async () => {
		const now = new Date()
		const expiringDate = new Date(now)
		expiringDate.setDate(expiringDate.getDate() + 15)
		const expiredDate = new Date(now)
		expiredDate.setDate(expiredDate.getDate() - 5)

		// Create admin user
		await prisma.user.create({
			data: {
				email: 'admin@example.com',
				username: 'admin',
				roles: {
					connectOrCreate: {
						where: { name: 'admin' },
						create: { name: 'admin' },
					},
				},
			},
		})

		// Create expiring employee
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'EMP003',
				fullName: 'Expiring Employee',
				jobTitle: 'Teacher',
				email: 'expiring-emp@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		// Create expired student
		await prisma.student.create({
			data: {
				sisStudentId: 'STU003',
				fullName: 'Expired Student',
				email: 'expired-stu@example.com',
				status: 'active',
				studentId: {
					create: {
						expirationDate: expiredDate,
					},
				},
			},
		})

		vi.mocked(sendEmail).mockResolvedValue({ id: 'test-email-id' })

		const result = await sendExpirationNotifications(30, now)

		expect(result.success).toBe(true)
		expect(sendEmail).toHaveBeenCalledTimes(1)

		const emailCall = vi.mocked(sendEmail).mock.calls[0]
		expect(emailCall[0].subject).toContain('1 expiring')
		expect(emailCall[0].subject).toContain('1 expired')
	})

	it('does not send notification when no expiring or expired IDs', async () => {
		const now = new Date()
		const validDate = new Date(now)
		validDate.setDate(validDate.getDate() + 60) // 60 days from now

		// Create admin user
		await prisma.user.create({
			data: {
				email: 'admin@example.com',
				username: 'admin',
				roles: {
					connectOrCreate: {
						where: { name: 'admin' },
						create: { name: 'admin' },
					},
				},
			},
		})

		// Create employee with valid ID
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'EMP004',
				fullName: 'Valid Employee',
				jobTitle: 'Teacher',
				email: 'valid-emp@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: validDate,
					},
				},
			},
		})

		// Create student with valid ID
		await prisma.student.create({
			data: {
				sisStudentId: 'STU004',
				fullName: 'Valid Student',
				email: 'valid-stu@example.com',
				status: 'active',
				studentId: {
					create: {
						expirationDate: validDate,
					},
				},
			},
		})

		const result = await sendExpirationNotifications(30, now)

		expect(result.success).toBe(true)
		expect(sendEmail).not.toHaveBeenCalled()
	})

	it('returns error when no admin users found', async () => {
		const now = new Date()
		const expiringDate = new Date(now)
		expiringDate.setDate(expiringDate.getDate() + 15)

		// Create employee with expiring ID (but no admin users)
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'EMP005',
				fullName: 'Test Employee',
				jobTitle: 'Teacher',
				email: 'employee5@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		const result = await sendExpirationNotifications(30, now)

		expect(result.success).toBe(false)
		expect(result.error).toBe('No admin users found')
		expect(sendEmail).not.toHaveBeenCalled()
	})

	it('only includes active employees and students', async () => {
		const now = new Date()
		const expiringDate = new Date(now)
		expiringDate.setDate(expiringDate.getDate() + 15)

		// Create admin user
		await prisma.user.create({
			data: {
				email: 'admin@example.com',
				username: 'admin',
				roles: {
					connectOrCreate: {
						where: { name: 'admin' },
						create: { name: 'admin' },
					},
				},
			},
		})

		// Create inactive employee with expiring ID
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'EMP006',
				fullName: 'Inactive Employee',
				jobTitle: 'Teacher',
				email: 'inactive-emp@example.com',
				status: 'inactive',
				employeeId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		// Create inactive student with expiring ID
		await prisma.student.create({
			data: {
				sisStudentId: 'STU006',
				fullName: 'Inactive Student',
				email: 'inactive-stu@example.com',
				status: 'inactive',
				studentId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		const result = await sendExpirationNotifications(30, now)

		// Should not send notification because inactive users are filtered out
		expect(result.success).toBe(true)
		expect(sendEmail).not.toHaveBeenCalled()
	})

	it('sends notification to multiple admin users', async () => {
		const now = new Date()
		const expiringDate = new Date(now)
		expiringDate.setDate(expiringDate.getDate() + 15)

		// Create multiple admin users
		await prisma.user.create({
			data: {
				email: 'admin1@example.com',
				username: 'admin1',
				roles: {
					connectOrCreate: {
						where: { name: 'admin' },
						create: { name: 'admin' },
					},
				},
			},
		})

		await prisma.user.create({
			data: {
				email: 'admin2@example.com',
				username: 'admin2',
				roles: {
					connectOrCreate: {
						where: { name: 'admin' },
						create: { name: 'admin' },
					},
				},
			},
		})

		// Create employee with expiring ID
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'EMP007',
				fullName: 'Test Employee',
				jobTitle: 'Teacher',
				email: 'employee7@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		vi.mocked(sendEmail).mockResolvedValue({ id: 'test-email-id' })

		const result = await sendExpirationNotifications(30, now)

		expect(result.success).toBe(true)
		expect(sendEmail).toHaveBeenCalledTimes(2)
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'admin1@example.com' }),
		)
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'admin2@example.com' }),
		)
	})

	it('handles email sending failures gracefully', async () => {
		const now = new Date()
		const expiringDate = new Date(now)
		expiringDate.setDate(expiringDate.getDate() + 15)

		// Create admin user
		await prisma.user.create({
			data: {
				email: 'admin@example.com',
				username: 'admin',
				roles: {
					connectOrCreate: {
						where: { name: 'admin' },
						create: { name: 'admin' },
					},
				},
			},
		})

		// Create employee with expiring ID
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'EMP008',
				fullName: 'Test Employee',
				jobTitle: 'Teacher',
				email: 'employee8@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		// Mock sendEmail to reject
		vi.mocked(sendEmail).mockRejectedValue(new Error('Email service down'))

		const result = await sendExpirationNotifications(30, now)

		expect(result.success).toBe(false)
		expect(result.error).toContain('failed to send')
	})
})
