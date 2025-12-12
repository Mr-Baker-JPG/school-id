import { describe, expect, test, beforeEach, afterEach } from 'vitest'
import { prisma } from './db.server.ts'
import { syncEmployeesFromFacts } from './employee-sync.server.ts'
import { server } from '#tests/mocks/index.ts'
import { clearMockStaff, insertMockStaff } from '#tests/mocks/facts.ts'
import { http, HttpResponse } from 'msw'
import { FactsApiError } from './facts-api.server.ts'
import { consoleError } from '#tests/setup/setup-test-env.ts'

describe('Employee Sync Background Job', () => {
	beforeEach(async () => {
		// Clear database
		await prisma.employeeID.deleteMany()
		await prisma.employee.deleteMany()
		clearMockStaff()

		// Set mock environment variables
		process.env.FACTS_SUBSCRIPTION_KEY = 'MOCK_SUBSCRIPTION_KEY'
		process.env.FACTS_API_KEY = 'MOCK_API_KEY'
		process.env.FACTS_BASE_URL = 'https://api.factsmgt.com'
	})

	afterEach(async () => {
		// Clean up database
		await prisma.employeeID.deleteMany()
		await prisma.employee.deleteMany()
	})

	describe('Job successfully runs on schedule', () => {
		test('Sync completes successfully with valid data', async () => {
			insertMockStaff({
				staffId: 1,
				firstName: 'John',
				lastName: 'Doe',
				email: 'john.doe@school.edu',
				department: 'Mathematics',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(1)
			expect(result.updated).toBe(0)
			expect(result.errors).toBe(0)
		})
	})

	describe('New employees from SIS are created in database', () => {
		test('Creates new employee when not in database', async () => {
			insertMockStaff({
				staffId: 123,
				firstName: 'Jane',
				lastName: 'Smith',
				email: 'jane.smith@school.edu',
				department: 'Science',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(1)
			expect(result.updated).toBe(0)

			const employee = await prisma.employee.findUnique({
				where: { sisEmployeeId: '123' },
			})

			expect(employee).not.toBeNull()
			expect(employee?.fullName).toBe('Jane Smith')
			expect(employee?.email).toBe('jane.smith@school.edu')
			expect(employee?.jobTitle).toBe('Science')
			expect(employee?.status).toBe('active')
		})

		test('Creates multiple new employees', async () => {
			insertMockStaff({
				staffId: 1,
				firstName: 'Alice',
				lastName: 'Johnson',
				email: 'alice.johnson@school.edu',
				department: 'English',
				active: true,
			})
			insertMockStaff({
				staffId: 2,
				firstName: 'Bob',
				lastName: 'Williams',
				email: 'bob.williams@school.edu',
				department: 'History',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(2)
			expect(result.updated).toBe(0)

			const employees = await prisma.employee.findMany()
			expect(employees).toHaveLength(2)
		})
	})

	describe('Existing employees are updated with latest SIS data', () => {
		test('Updates existing employee when data changes', async () => {
			// Create existing employee
			await prisma.employee.create({
				data: {
					sisEmployeeId: '456',
					fullName: 'Old Name',
					jobTitle: 'Old Title',
					email: 'old.email@school.edu',
					status: 'active',
				},
			})

			// Mock updated data from SIS
			insertMockStaff({
				staffId: 456,
				firstName: 'New',
				lastName: 'Name',
				email: 'new.email@school.edu',
				department: 'New Department',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(0)
			expect(result.updated).toBe(1)

			const employee = await prisma.employee.findUnique({
				where: { sisEmployeeId: '456' },
			})

			expect(employee?.fullName).toBe('New Name')
			expect(employee?.email).toBe('new.email@school.edu')
			expect(employee?.jobTitle).toBe('New Department')
		})

		test('Updates multiple existing employees', async () => {
			// Create existing employees
			await prisma.employee.create({
				data: {
					sisEmployeeId: '1',
					fullName: 'Employee One',
					jobTitle: 'Title One',
					email: 'one@school.edu',
					status: 'active',
				},
			})
			await prisma.employee.create({
				data: {
					sisEmployeeId: '2',
					fullName: 'Employee Two',
					jobTitle: 'Title Two',
					email: 'two@school.edu',
					status: 'active',
				},
			})

			// Mock updated data
			insertMockStaff({
				staffId: 1,
				firstName: 'Updated',
				lastName: 'One',
				email: 'one@school.edu',
				department: 'Updated Department',
				active: true,
			})
			insertMockStaff({
				staffId: 2,
				firstName: 'Updated',
				lastName: 'Two',
				email: 'two@school.edu',
				department: 'Another Department',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(0)
			expect(result.updated).toBe(2)
		})
	})

	describe('Inactive employees have status updated correctly', () => {
		test('Updates employee status from active to inactive', async () => {
			// Create active employee
			await prisma.employee.create({
				data: {
					sisEmployeeId: '789',
					fullName: 'Active Employee',
					jobTitle: 'Teacher',
					email: 'active@school.edu',
					status: 'active',
				},
			})

			// Mock SIS data showing employee is now inactive
			insertMockStaff({
				staffId: 789,
				firstName: 'Active',
				lastName: 'Employee',
				email: 'active@school.edu',
				department: 'Teacher',
				active: false,
			})

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(true)
			expect(result.updated).toBe(1)

			const employee = await prisma.employee.findUnique({
				where: { sisEmployeeId: '789' },
			})

			expect(employee?.status).toBe('inactive')
		})

		test('Updates employee status from inactive to active', async () => {
			// Create inactive employee
			await prisma.employee.create({
				data: {
					sisEmployeeId: '101',
					fullName: 'Inactive Employee',
					jobTitle: 'Staff',
					email: 'inactive@school.edu',
					status: 'inactive',
				},
			})

			// Mock SIS data showing employee is now active
			insertMockStaff({
				staffId: 101,
				firstName: 'Inactive',
				lastName: 'Employee',
				email: 'inactive@school.edu',
				department: 'Staff',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(true)
			expect(result.updated).toBe(1)

			const employee = await prisma.employee.findUnique({
				where: { sisEmployeeId: '101' },
			})

			expect(employee?.status).toBe('active')
		})
	})

	describe('Job handles failures without crashing', () => {
		test('Handles FACTS API errors gracefully', async () => {
			// Mock console.error since we expect errors to be logged
			consoleError.mockImplementation(() => {})

			// Mock API error
			server.use(
				http.get('https://api.factsmgt.com/People/Staff', () => {
					return HttpResponse.json(
						{ detail: 'API authentication failed' },
						{ status: 401 },
					)
				}),
			)

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(false)
			expect(result.errorMessage).toContain('FACTS API error')
			expect(result.created).toBe(0)
			expect(result.updated).toBe(0)
		})

		test('Handles network errors gracefully', async () => {
			// Mock console.error since we expect errors to be logged
			consoleError.mockImplementation(() => {})

			// Mock network error
			server.use(
				http.get('https://api.factsmgt.com/People/Staff', () => {
					return HttpResponse.error()
				}),
			)

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(false)
			expect(result.errorMessage).toBeDefined()
		})

		test('Continues processing other employees when one fails', async () => {
			// Mock console.error since individual employee errors are logged
			consoleError.mockImplementation(() => {})

			// Create one valid employee
			insertMockStaff({
				staffId: 1,
				firstName: 'Valid',
				lastName: 'Employee',
				email: 'valid@school.edu',
				department: 'Math',
				active: true,
			})

			// Create one employee with invalid data (missing email in demographics)
			// The mock staff generator creates email in demographics.person.email
			// So we need to create a staff member that will fail transformation
			// Actually, let's create a staff member that will cause a database error instead
			// by trying to create with duplicate email
			await prisma.employee.create({
				data: {
					sisEmployeeId: '999',
					fullName: 'Existing',
					jobTitle: 'Title',
					email: 'duplicate@school.edu',
					status: 'active',
				},
			})

			insertMockStaff({
				staffId: 1,
				firstName: 'Valid',
				lastName: 'Employee',
				email: 'valid@school.edu',
				department: 'Math',
				active: true,
			})
			insertMockStaff({
				staffId: 888,
				firstName: 'Duplicate',
				lastName: 'Email',
				email: 'duplicate@school.edu', // Same email as existing
				department: 'Title',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			// Should succeed overall, but one employee will fail due to duplicate email
			expect(result.success).toBe(true)
			expect(result.created).toBe(1) // Only the valid one
			expect(result.errors).toBe(1) // One error for duplicate email

			const employees = await prisma.employee.findMany({
				where: { email: 'valid@school.edu' },
			})
			expect(employees).toHaveLength(1)
			expect(employees[0]?.email).toBe('valid@school.edu')
		})

		test('Handles database constraint violations gracefully', async () => {
			// Mock console.error since we expect errors to be logged
			consoleError.mockImplementation(() => {})

			// Create an employee with a specific email
			await prisma.employee.create({
				data: {
					sisEmployeeId: '999',
					fullName: 'Existing',
					jobTitle: 'Title',
					email: 'unique@school.edu',
					status: 'active',
				},
			})

			// Try to sync an employee with the same email but different sisEmployeeId
			// This will cause a unique constraint violation on email
			insertMockStaff({
				staffId: 888,
				firstName: 'New',
				lastName: 'Employee',
				email: 'unique@school.edu', // Same email, different ID
				department: 'Title',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			// The job should handle the error gracefully
			// It should succeed overall but report the error
			expect(result.success).toBe(true)
			expect(result.errors).toBe(1) // One error for constraint violation
			expect(result.created).toBe(0) // No new employees created
		})
	})

	describe('Mixed scenarios', () => {
		test('Handles mix of new and existing employees', async () => {
			// Create one existing employee
			await prisma.employee.create({
				data: {
					sisEmployeeId: '100',
					fullName: 'Existing Employee',
					jobTitle: 'Teacher',
					email: 'existing@school.edu',
					status: 'active',
				},
			})

			// Mock SIS data with existing and new employees
			insertMockStaff({
				staffId: 100,
				firstName: 'Existing',
				lastName: 'Employee',
				email: 'existing@school.edu',
				department: 'Updated Teacher',
				active: true,
			})
			insertMockStaff({
				staffId: 200,
				firstName: 'New',
				lastName: 'Employee',
				email: 'new@school.edu',
				department: 'New Teacher',
				active: true,
			})

			const result = await syncEmployeesFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(1)
			expect(result.updated).toBe(1)

			const employees = await prisma.employee.findMany()
			expect(employees).toHaveLength(2)
		})
	})
})
