import { faker } from '@faker-js/faker'
import { describe, expect, test } from 'vitest'
import { prisma } from '#app/utils/db.server.ts'
import { loader } from './$employeeId.tsx'

async function createEmployee(data?: {
	fullName?: string
	email?: string
	jobTitle?: string
	status?: 'active' | 'inactive'
}) {
	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
		},
		select: {
			id: true,
			fullName: true,
			jobTitle: true,
			email: true,
			status: true,
		},
	})

	return employee
}

async function createEmployeeId(data: {
	employeeId: string
	expirationDate: Date
	photoUrl?: string | null
}) {
	const employeeId = await prisma.employeeID.create({
		data: {
			employeeId: data.employeeId,
			expirationDate: data.expirationDate,
			photoUrl: data.photoUrl ?? null,
		},
		select: {
			id: true,
			employeeId: true,
			expirationDate: true,
			photoUrl: true,
		},
	})

	return employeeId
}

describe('verify/$employeeId route', () => {
	test('Verification page is publicly accessible without authentication', async () => {
		const employee = await createEmployee({
			fullName: 'John Doe',
			jobTitle: 'Teacher',
			email: 'john.doe@school.edu',
			status: 'active',
		})

		await createEmployeeId({
			employeeId: employee.id,
			expirationDate: new Date('2025-07-01'),
		})

		const request = new Request('http://localhost/verify/' + employee.id)

		const data = await loader({
			params: { employeeId: employee.id },
			request,
			context: {},
		} as any)

		expect(data).toBeDefined()
		expect(data.employee).toBeDefined()
		expect(data.employee.id).toBe(employee.id)

		// Cleanup
		await prisma.employeeID.deleteMany({
			where: { employeeId: employee.id },
		})
		await prisma.employee.delete({ where: { id: employee.id } })
	})

	test('Page displays employee name and job title', async () => {
		const employee = await createEmployee({
			fullName: 'Jane Smith',
			jobTitle: 'Principal',
			email: 'jane.smith@school.edu',
			status: 'active',
		})

		await createEmployeeId({
			employeeId: employee.id,
			expirationDate: new Date('2025-07-01'),
		})

		const request = new Request('http://localhost/verify/' + employee.id)

		const data = await loader({
			params: { employeeId: employee.id },
			request,
			context: {},
		} as any)

		expect(data.employee.fullName).toBe('Jane Smith')
		expect(data.employee.jobTitle).toBe('Principal')

		// Cleanup
		await prisma.employeeID.deleteMany({
			where: { employeeId: employee.id },
		})
		await prisma.employee.delete({ where: { id: employee.id } })
	})

	test('Page shows active/inactive status correctly', async () => {
		// Test active employee
		const activeEmployee = await createEmployee({
			fullName: 'Active Employee',
			jobTitle: 'Teacher',
			email: 'active@school.edu',
			status: 'active',
		})

		await createEmployeeId({
			employeeId: activeEmployee.id,
			expirationDate: new Date('2025-07-01'),
		})

		const request1 = new Request('http://localhost/verify/' + activeEmployee.id)
		const data1 = await loader({
			params: { employeeId: activeEmployee.id },
			request: request1,
			context: {},
		} as any)

		expect(data1.employee.status).toBe('active')

		// Test inactive employee
		const inactiveEmployee = await createEmployee({
			fullName: 'Inactive Employee',
			jobTitle: 'Teacher',
			email: 'inactive@school.edu',
			status: 'inactive',
		})

		await createEmployeeId({
			employeeId: inactiveEmployee.id,
			expirationDate: new Date('2025-07-01'),
		})

		const request2 = new Request(
			'http://localhost/verify/' + inactiveEmployee.id,
		)
		const data2 = await loader({
			params: { employeeId: inactiveEmployee.id },
			request: request2,
			context: {},
		} as any)

		expect(data2.employee.status).toBe('inactive')
		expect(data2.verificationStatus.isValid).toBe(false)

		// Cleanup
		await prisma.employeeID.deleteMany({
			where: { employeeId: { in: [activeEmployee.id, inactiveEmployee.id] } },
		})
		await prisma.employee.deleteMany({
			where: { id: { in: [activeEmployee.id, inactiveEmployee.id] } },
		})
	})

	test('Page displays expiration date', async () => {
		const expirationDate = new Date('2025-07-01')
		const employee = await createEmployee({
			fullName: 'Test Employee',
			jobTitle: 'Teacher',
			email: 'test@school.edu',
			status: 'active',
		})

		await createEmployeeId({
			employeeId: employee.id,
			expirationDate,
		})

		const request = new Request('http://localhost/verify/' + employee.id)

		const data = await loader({
			params: { employeeId: employee.id },
			request,
			context: {},
		} as any)

		expect(data.employee.expirationDate).toBe(expirationDate.toISOString())

		// Cleanup
		await prisma.employeeID.deleteMany({
			where: { employeeId: employee.id },
		})
		await prisma.employee.delete({ where: { id: employee.id } })
	})

	test('Page shows valid/invalid badge based on status and expiration', async () => {
		// Test valid ID (active + future expiration)
		const validEmployee = await createEmployee({
			fullName: 'Valid Employee',
			jobTitle: 'Teacher',
			email: 'valid@school.edu',
			status: 'active',
		})

		const futureDate = new Date()
		futureDate.setFullYear(futureDate.getFullYear() + 1)

		await createEmployeeId({
			employeeId: validEmployee.id,
			expirationDate: futureDate,
		})

		const request1 = new Request('http://localhost/verify/' + validEmployee.id)
		const data1 = await loader({
			params: { employeeId: validEmployee.id },
			request: request1,
			context: {},
		} as any)

		expect(data1.verificationStatus.isValid).toBe(true)
		expect(data1.verificationStatus.reason).toBe('Valid ID')

		// Test invalid ID (inactive)
		const invalidEmployee1 = await createEmployee({
			fullName: 'Inactive Employee',
			jobTitle: 'Teacher',
			email: 'inactive@school.edu',
			status: 'inactive',
		})

		await createEmployeeId({
			employeeId: invalidEmployee1.id,
			expirationDate: futureDate,
		})

		const request2 = new Request(
			'http://localhost/verify/' + invalidEmployee1.id,
		)
		const data2 = await loader({
			params: { employeeId: invalidEmployee1.id },
			request: request2,
			context: {},
		} as any)

		expect(data2.verificationStatus.isValid).toBe(false)
		expect(data2.verificationStatus.reason).toBe('Employee is not active')

		// Test invalid ID (expired)
		const expiredEmployee = await createEmployee({
			fullName: 'Expired Employee',
			jobTitle: 'Teacher',
			email: 'expired@school.edu',
			status: 'active',
		})

		const pastDate = new Date()
		pastDate.setFullYear(pastDate.getFullYear() - 1)

		await createEmployeeId({
			employeeId: expiredEmployee.id,
			expirationDate: pastDate,
		})

		const request3 = new Request(
			'http://localhost/verify/' + expiredEmployee.id,
		)
		const data3 = await loader({
			params: { employeeId: expiredEmployee.id },
			request: request3,
			context: {},
		} as any)

		expect(data3.verificationStatus.isValid).toBe(false)
		expect(data3.verificationStatus.reason).toBe('ID has expired')

		// Cleanup
		await prisma.employeeID.deleteMany({
			where: {
				employeeId: {
					in: [validEmployee.id, invalidEmployee1.id, expiredEmployee.id],
				},
			},
		})
		await prisma.employee.deleteMany({
			where: {
				id: { in: [validEmployee.id, invalidEmployee1.id, expiredEmployee.id] },
			},
		})
	})

	test('Invalid employee IDs show appropriate error message', async () => {
		const nonExistentId = 'non-existent-id'

		const request = new Request('http://localhost/verify/' + nonExistentId)

		try {
			await loader({
				params: { employeeId: nonExistentId },
				request,
				context: {},
			} as any)
			expect.fail('Should have thrown')
		} catch (error) {
			expect(error).toBeInstanceOf(Response)
			if (error instanceof Response) {
				expect(error.status).toBe(404)
				const text = await error.text()
				expect(text).toBe('Employee not found')
			}
		}
	})

	test('Page includes school branding', async () => {
		const employee = await createEmployee({
			fullName: 'Test Employee',
			jobTitle: 'Teacher',
			email: 'test@school.edu',
			status: 'active',
		})

		await createEmployeeId({
			employeeId: employee.id,
			expirationDate: new Date('2025-07-01'),
		})

		const request = new Request('http://localhost/verify/' + employee.id)

		const data = await loader({
			params: { employeeId: employee.id },
			request,
			context: {},
		} as any)

		expect(data.branding).toBeDefined()
		expect(data.branding.schoolName).toBeDefined()
		expect(data.branding.primaryColor).toBeDefined()
		expect(data.branding.secondaryColor).toBeDefined()
		// Logo URL is optional, so we just check the structure
		expect(data.branding).toHaveProperty('logoUrl')
		// Verify colors are valid hex colors
		expect(data.branding.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
		expect(data.branding.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)

		// Cleanup
		await prisma.employeeID.deleteMany({
			where: { employeeId: employee.id },
		})
		await prisma.employee.delete({ where: { id: employee.id } })
	})

	test('Branding colors are applied correctly', async () => {
		const employee = await createEmployee({
			fullName: 'Color Test Employee',
			jobTitle: 'Teacher',
			email: 'color@school.edu',
			status: 'active',
		})

		await createEmployeeId({
			employeeId: employee.id,
			expirationDate: new Date('2025-07-01'),
		})

		const request = new Request('http://localhost/verify/' + employee.id)

		const data = await loader({
			params: { employeeId: employee.id },
			request,
			context: {},
		} as any)

		// Verify branding colors are present and valid
		expect(data.branding.primaryColor).toBeDefined()
		expect(data.branding.secondaryColor).toBeDefined()
		expect(data.branding.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
		expect(data.branding.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
		// Colors should be different from each other (or at least valid)
		expect(data.branding.primaryColor).toBeTruthy()
		expect(data.branding.secondaryColor).toBeTruthy()

		// Cleanup
		await prisma.employeeID.deleteMany({
			where: { employeeId: employee.id },
		})
		await prisma.employee.delete({ where: { id: employee.id } })
	})

	test('Handles employee without EmployeeID record', async () => {
		const employee = await createEmployee({
			fullName: 'No ID Employee',
			jobTitle: 'Teacher',
			email: 'noid@school.edu',
			status: 'active',
		})

		// Don't create EmployeeID record

		const request = new Request('http://localhost/verify/' + employee.id)

		const data = await loader({
			params: { employeeId: employee.id },
			request,
			context: {},
		} as any)

		expect(data.employee).toBeDefined()
		expect(data.employee.expirationDate).toBeNull()
		expect(data.verificationStatus.isValid).toBe(false)
		expect(data.verificationStatus.reason).toBe('Expiration date not set')

		// Cleanup
		await prisma.employee.delete({ where: { id: employee.id } })
	})

	test('Handles missing employeeId parameter', async () => {
		const request = new Request('http://localhost/verify/')

		try {
			await loader({
				params: { employeeId: undefined },
				request,
				context: {},
			} as any)
			expect.fail('Should have thrown')
		} catch (error) {
			expect(error).toBeInstanceOf(Response)
			if (error instanceof Response) {
				expect(error.status).toBe(400)
				const text = await error.text()
				expect(text).toBe('Employee ID is required')
			}
		}
	})
})
