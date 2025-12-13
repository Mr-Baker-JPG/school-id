import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from './db.server.ts'
import {
	getDefaultExpirationDate,
	getExpirationStatus,
	getExpiringEmployees,
	type ExpirationStatus,
} from './employee.server.ts'

describe('getDefaultExpirationDate', () => {
	it('returns July 1 of current year', () => {
		const date = getDefaultExpirationDate()
		expect(date.getMonth()).toBe(6) // July (0-indexed)
		expect(date.getDate()).toBe(1)
		expect(date.getFullYear()).toBe(new Date().getFullYear())
	})
})

describe('getExpirationStatus', () => {
	it('returns valid status for future expiration dates', () => {
		const futureDate = new Date()
		futureDate.setDate(futureDate.getDate() + 60) // 60 days in future

		const status = getExpirationStatus(futureDate)
		expect(status.type).toBe('valid')
		if (status.type === 'valid') {
			expect(status.daysUntilExpiration).toBeGreaterThan(30)
		}
	})

	it('returns expiring status for dates within 30 days', () => {
		const nearFutureDate = new Date()
		nearFutureDate.setDate(nearFutureDate.getDate() + 15) // 15 days in future

		const status = getExpirationStatus(nearFutureDate)
		expect(status.type).toBe('expiring')
		if (status.type === 'expiring') {
			expect(status.daysUntilExpiration).toBe(15)
		}
	})

	it('returns expiring status for dates exactly 30 days away', () => {
		const exactly30Days = new Date()
		exactly30Days.setDate(exactly30Days.getDate() + 30)

		const status = getExpirationStatus(exactly30Days)
		expect(status.type).toBe('expiring')
		if (status.type === 'expiring') {
			expect(status.daysUntilExpiration).toBe(30)
		}
	})

	it('returns expired status for past dates', () => {
		const pastDate = new Date()
		pastDate.setDate(pastDate.getDate() - 10) // 10 days ago

		const status = getExpirationStatus(pastDate)
		expect(status.type).toBe('expired')
		if (status.type === 'expired') {
			expect(status.daysSinceExpiration).toBe(10)
		}
	})

	it('returns expired status for today when expiration is today', () => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)

		const status = getExpirationStatus(today, today)
		expect(status.type).toBe('expiring')
		if (status.type === 'expiring') {
			expect(status.daysUntilExpiration).toBe(0)
		}
	})

	it('uses custom warning days', () => {
		const futureDate = new Date()
		futureDate.setDate(futureDate.getDate() + 15) // 15 days in future

		// With default 30 days, this should be expiring
		const status30 = getExpirationStatus(futureDate, new Date(), 30)
		expect(status30.type).toBe('expiring')

		// With 10 days warning, this should be valid
		const status10 = getExpirationStatus(futureDate, new Date(), 10)
		expect(status10.type).toBe('valid')
	})
})

describe('getExpiringEmployees', () => {
	beforeEach(async () => {
		// Clean up test data
		await prisma.employeeID.deleteMany()
		await prisma.employee.deleteMany()
	})

	it('returns employees with IDs expiring within warning period', async () => {
		const now = new Date()
		const expiringDate = new Date(now)
		expiringDate.setDate(expiringDate.getDate() + 15) // 15 days from now

		// Create employee with expiring ID
		const employee = await prisma.employee.create({
			data: {
				sisEmployeeId: '123',
				fullName: 'Test Employee',
				jobTitle: 'Teacher',
				email: 'test@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		const expiring = await getExpiringEmployees(30, now)
		expect(expiring.length).toBe(1)
		expect(expiring[0].id).toBe(employee.id)
		expect(expiring[0].expirationStatus?.type).toBe('expiring')
	})

	it('returns employees with expired IDs', async () => {
		const now = new Date()
		const expiredDate = new Date(now)
		expiredDate.setDate(expiredDate.getDate() - 10) // 10 days ago

		// Create employee with expired ID
		const employee = await prisma.employee.create({
			data: {
				sisEmployeeId: '456',
				fullName: 'Expired Employee',
				jobTitle: 'Teacher',
				email: 'expired@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: expiredDate,
					},
				},
			},
		})

		const expiring = await getExpiringEmployees(30, now)
		expect(expiring.length).toBe(1)
		expect(expiring[0].id).toBe(employee.id)
		expect(expiring[0].expirationStatus?.type).toBe('expired')
	})

	it('does not return employees with valid IDs', async () => {
		const now = new Date()
		const validDate = new Date(now)
		validDate.setDate(validDate.getDate() + 60) // 60 days from now

		// Create employee with valid ID
		await prisma.employee.create({
			data: {
				sisEmployeeId: '789',
				fullName: 'Valid Employee',
				jobTitle: 'Teacher',
				email: 'valid@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: validDate,
					},
				},
			},
		})

		const expiring = await getExpiringEmployees(30, now)
		expect(expiring.length).toBe(0)
	})

	it('only returns active employees', async () => {
		const now = new Date()
		const expiringDate = new Date(now)
		expiringDate.setDate(expiringDate.getDate() + 15)

		// Create inactive employee with expiring ID
		await prisma.employee.create({
			data: {
				sisEmployeeId: '999',
				fullName: 'Inactive Employee',
				jobTitle: 'Teacher',
				email: 'inactive@example.com',
				status: 'inactive',
				employeeId: {
					create: {
						expirationDate: expiringDate,
					},
				},
			},
		})

		const expiring = await getExpiringEmployees(30, now)
		expect(expiring.length).toBe(0)
	})

	it('orders results by expiration date ascending', async () => {
		const now = new Date()
		const date1 = new Date(now)
		date1.setDate(date1.getDate() + 5) // Expires in 5 days
		const date2 = new Date(now)
		date2.setDate(date2.getDate() + 20) // Expires in 20 days

		// Create employees with different expiration dates
		const employee1 = await prisma.employee.create({
			data: {
				sisEmployeeId: '111',
				fullName: 'Employee 1',
				jobTitle: 'Teacher',
				email: 'emp1@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: date1,
					},
				},
			},
		})

		const employee2 = await prisma.employee.create({
			data: {
				sisEmployeeId: '222',
				fullName: 'Employee 2',
				jobTitle: 'Teacher',
				email: 'emp2@example.com',
				status: 'active',
				employeeId: {
					create: {
						expirationDate: date2,
					},
				},
			},
		})

		const expiring = await getExpiringEmployees(30, now)
		expect(expiring.length).toBe(2)
		// Should be ordered by expiration date ascending (earliest first)
		expect(expiring[0].id).toBe(employee1.id)
		expect(expiring[1].id).toBe(employee2.id)
	})
})
