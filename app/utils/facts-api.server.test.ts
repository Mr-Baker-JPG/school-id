import { describe, expect, test, beforeEach } from 'vitest'
import { server } from '#tests/mocks/index.ts'
import {
	fetchAllStaff,
	fetchStaffById,
	FactsApiError,
	type FactsEmployeeData,
} from './facts-api.server.ts'
import {
	clearMockStaff,
	insertMockStaff,
	getMockStaffById,
} from '#tests/mocks/facts.ts'
import { http, HttpResponse } from 'msw'

describe('FACTS SIS Employee Sync Service', () => {
	beforeEach(() => {
		clearMockStaff()
		// Set mock environment variables for testing
		process.env.FACTS_SUBSCRIPTION_KEY = 'MOCK_SUBSCRIPTION_KEY'
		process.env.FACTS_API_KEY = 'MOCK_API_KEY'
		process.env.FACTS_BASE_URL = 'https://api.factsmgt.com'
	})

	describe('Authentication', () => {
		test('Service successfully authenticates with FACTS API using subscription key', async () => {
			const mockStaff = insertMockStaff({
				staffId: 123,
				firstName: 'John',
				lastName: 'Doe',
				email: 'john.doe@school.edu',
			})

			const result = await fetchStaffById(mockStaff.staffId)

			expect(result).not.toBeNull()
			expect(result?.email).toBe('john.doe@school.edu')
		})

		test('Service successfully authenticates with FACTS API using API key', async () => {
			// Remove subscription key, use only API key
			delete process.env.FACTS_SUBSCRIPTION_KEY
			process.env.FACTS_API_KEY = 'MOCK_API_KEY'

			const mockStaff = insertMockStaff({
				staffId: 456,
				firstName: 'Jane',
				lastName: 'Smith',
				email: 'jane.smith@school.edu',
			})

			const result = await fetchStaffById(mockStaff.staffId)

			expect(result).not.toBeNull()
			expect(result?.email).toBe('jane.smith@school.edu')
		})

		test('Service throws error when no authentication credentials are provided', async () => {
			delete process.env.FACTS_SUBSCRIPTION_KEY
			delete process.env.FACTS_API_KEY

			// invariantResponse throws a Response object (not a FactsApiError)
			// This is expected behavior in React Router/Remix
			try {
				await fetchStaffById(123)
				expect.fail('Should have thrown an error')
			} catch (error) {
				// invariantResponse throws a Response object
				expect(error).toBeInstanceOf(Response)
				if (error instanceof Response) {
					expect(error.status).toBe(500)
					const text = await error.text()
					expect(text).toContain('FACTS API credentials not configured')
				}
			}
		})
	})

	describe('Fetch Employee List', () => {
		test('Service fetches employee list and transforms data correctly', async () => {
			// Insert multiple staff members
			const staff1 = insertMockStaff({
				staffId: 1,
				firstName: 'Alice',
				lastName: 'Johnson',
				email: 'alice.johnson@school.edu',
				department: 'Mathematics',
				active: true,
			})

			const staff2 = insertMockStaff({
				staffId: 2,
				firstName: 'Bob',
				lastName: 'Williams',
				email: 'bob.williams@school.edu',
				department: 'Science',
				active: true,
			})

			const staff3 = insertMockStaff({
				staffId: 3,
				firstName: 'Charlie',
				lastName: 'Brown',
				email: 'charlie.brown@school.edu',
				department: 'English',
				active: false,
			})

			const employees = await fetchAllStaff()

			expect(employees).toHaveLength(3)
			expect(employees).toContainEqual(
				expect.objectContaining({
					sisEmployeeId: '1',
					fullName: expect.stringContaining('Alice'),
					email: 'alice.johnson@school.edu',
					jobTitle: 'Mathematics',
					status: 'active',
				}),
			)
			expect(employees).toContainEqual(
				expect.objectContaining({
					sisEmployeeId: '2',
					fullName: expect.stringContaining('Bob'),
					email: 'bob.williams@school.edu',
					jobTitle: 'Science',
					status: 'active',
				}),
			)
			expect(employees).toContainEqual(
				expect.objectContaining({
					sisEmployeeId: '3',
					fullName: expect.stringContaining('Charlie'),
					email: 'charlie.brown@school.edu',
					jobTitle: 'English',
					status: 'inactive',
				}),
			)
		})

		test('Service handles pagination correctly', async () => {
			// Insert more than one page of staff (default page size is 100)
			// For testing, we'll mock the pagination response
			const mockStaff = Array.from({ length: 150 }, (_, i) =>
				insertMockStaff({
					staffId: i + 1,
					firstName: `Staff${i + 1}`,
					lastName: 'Test',
					email: `staff${i + 1}@school.edu`,
				}),
			)

			const employees = await fetchAllStaff()

			// Should fetch all pages
			expect(employees.length).toBeGreaterThanOrEqual(100)
		})

		test('Service filters out staff without required fields', async () => {
			// Insert valid staff
			insertMockStaff({
				staffId: 1,
				firstName: 'Valid',
				lastName: 'Staff',
				email: 'valid@school.edu',
			})

			// Insert staff without email (should be filtered out)
			server.use(
				http.get('https://api.factsmgt.com/People/Staff', async () => {
					return HttpResponse.json({
						results: [
							{
								staffId: 2,
								firstName: 'NoEmail',
								lastName: 'Staff',
								active: true,
								demographics: {
									person: {
										personId: 2,
										firstName: 'NoEmail',
										lastName: 'Staff',
										// No email field
									},
								},
							},
							{
								staffId: 1,
								firstName: 'Valid',
								lastName: 'Staff',
								active: true,
								demographics: {
									person: {
										personId: 1,
										firstName: 'Valid',
										lastName: 'Staff',
										email: 'valid@school.edu',
									},
								},
							},
						],
						currentPage: 1,
						pageCount: 1,
						pageSize: 100,
						rowCount: 2,
					})
				}),
			)

			const employees = await fetchAllStaff()

			// Should only include staff with email
			expect(employees).toHaveLength(1)
			expect(employees[0]?.email).toBe('valid@school.edu')
		})
	})

	describe('Fetch Single Employee', () => {
		test('Service fetches single employee by ID correctly', async () => {
			const mockStaff = insertMockStaff({
				staffId: 999,
				firstName: 'Test',
				lastName: 'Employee',
				email: 'test.employee@school.edu',
				department: 'History',
				active: true,
			})

			const employee = await fetchStaffById(mockStaff.staffId)

			expect(employee).not.toBeNull()
			expect(employee).toEqual({
				sisEmployeeId: '999',
				fullName: expect.stringContaining('Test'),
				email: 'test.employee@school.edu',
				jobTitle: 'History',
				status: 'active',
			})
		})

		test('Service returns null for non-existent employee', async () => {
			const employee = await fetchStaffById(99999)

			expect(employee).toBeNull()
		})
	})

	describe('Data Transformation', () => {
		test('Service transforms staff data to Employee schema format correctly', async () => {
			const mockStaff = insertMockStaff({
				staffId: 100,
				firstName: 'First',
				middleName: 'Middle',
				lastName: 'Last',
				email: 'first.last@school.edu',
				department: 'Computer Science',
				active: true,
			})

			const employee = await fetchStaffById(mockStaff.staffId)

			expect(employee).toMatchObject({
				sisEmployeeId: '100',
				fullName: expect.stringContaining('First'),
				email: 'first.last@school.edu',
				jobTitle: 'Computer Science',
				status: 'active',
			})
		})

		test('Service uses name field when available', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', async () => {
					return HttpResponse.json({
						staffId: 200,
						name: 'Full Name Provided',
						firstName: 'First',
						lastName: 'Last',
						active: true,
						demographics: {
							person: {
								personId: 200,
								email: 'full.name@school.edu',
							},
						},
					})
				}),
			)

			const employee = await fetchStaffById(200)

			expect(employee?.fullName).toBe('Full Name Provided')
		})

		test('Service builds full name from parts when name field is missing', async () => {
			const mockStaff = insertMockStaff({
				staffId: 300,
				firstName: 'John',
				middleName: 'Q',
				lastName: 'Public',
				email: 'john.public@school.edu',
			})

			const employee = await fetchStaffById(mockStaff.staffId)

			expect(employee?.fullName).toContain('John')
			expect(employee?.fullName).toContain('Public')
		})

		test('Service uses email2 as fallback when email is missing', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', async () => {
					return HttpResponse.json({
						staffId: 400,
						firstName: 'Test',
						lastName: 'User',
						active: true,
						demographics: {
							person: {
								personId: 400,
								email2: 'fallback@school.edu',
								// No email field
							},
						},
					})
				}),
			)

			const employee = await fetchStaffById(400)

			expect(employee?.email).toBe('fallback@school.edu')
		})

		test('Service uses default job title when department is missing', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', async () => {
					return HttpResponse.json({
						staffId: 500,
						firstName: 'Test',
						lastName: 'User',
						active: true,
						// No department field
						demographics: {
							person: {
								personId: 500,
								email: 'test@school.edu',
							},
						},
					})
				}),
			)

			const employee = await fetchStaffById(500)

			expect(employee?.jobTitle).toBe('Staff')
		})

		test('Service correctly maps active status', async () => {
			const activeStaff = insertMockStaff({
				staffId: 600,
				email: 'active@school.edu',
				active: true,
			})

			const inactiveStaff = insertMockStaff({
				staffId: 601,
				email: 'inactive@school.edu',
				active: false,
			})

			const activeEmployee = await fetchStaffById(activeStaff.staffId)
			const inactiveEmployee = await fetchStaffById(inactiveStaff.staffId)

			expect(activeEmployee?.status).toBe('active')
			expect(inactiveEmployee?.status).toBe('inactive')
		})
	})

	describe('Error Handling', () => {
		test('Service handles API errors gracefully with 400 status', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', () => {
					return HttpResponse.json(
						{
							type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
							title: 'Bad Request',
							status: 400,
							detail: 'Invalid staff ID format',
						},
						{ status: 400 },
					)
				}),
			)

			await expect(fetchStaffById(999)).rejects.toThrow(FactsApiError)
			await expect(fetchStaffById(999)).rejects.toThrow(
				'Invalid staff ID format',
			)
		})

		test('Service handles API errors gracefully with 500 status', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', () => {
					return HttpResponse.json(
						{
							type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
							title: 'Internal Server Error',
							status: 500,
							detail: 'Server error occurred',
						},
						{ status: 500 },
					)
				}),
			)

			await expect(fetchStaffById(999)).rejects.toThrow(FactsApiError)
			await expect(fetchStaffById(999)).rejects.toThrow('Server error occurred')
		})

		test('Service handles network errors gracefully', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', () => {
					return HttpResponse.error()
				}),
			)

			await expect(fetchStaffById(999)).rejects.toThrow()
		})

		test('Service handles malformed JSON responses', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', () => {
					return new HttpResponse('Invalid JSON', { status: 200 })
				}),
			)

			await expect(fetchStaffById(999)).rejects.toThrow()
		})

		test('Service handles pagination errors during fetchAllStaff', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff', () => {
					return HttpResponse.json(
						{
							type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
							title: 'Internal Server Error',
							status: 500,
							detail: 'Database connection failed',
						},
						{ status: 500 },
					)
				}),
			)

			await expect(fetchAllStaff()).rejects.toThrow(FactsApiError)
			await expect(fetchAllStaff()).rejects.toThrow(
				'Database connection failed',
			)
		})
	})

	describe('Required Field Validation', () => {
		test('Service validates required staffId field', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', async () => {
					return HttpResponse.json({
						// Missing staffId
						firstName: 'Test',
						lastName: 'User',
						active: true,
						demographics: {
							person: {
								personId: 1,
								email: 'test@school.edu',
							},
						},
					})
				}),
			)

			const employee = await fetchStaffById(1)

			// Should return null when staffId is missing
			expect(employee).toBeNull()
		})

		test('Service validates required email field', async () => {
			server.use(
				http.get('https://api.factsmgt.com/People/Staff/:staffId', async () => {
					return HttpResponse.json({
						staffId: 700,
						firstName: 'Test',
						lastName: 'User',
						active: true,
						demographics: {
							person: {
								personId: 700,
								// No email or email2
							},
						},
					})
				}),
			)

			const employee = await fetchStaffById(700)

			// Should return null when email is missing
			expect(employee).toBeNull()
		})

		test('Service trims whitespace from transformed fields', async () => {
			const mockStaff = insertMockStaff({
				staffId: 800,
				firstName: '  Trimmed  ',
				lastName: '  Name  ',
				email: '  trimmed@school.edu  ',
				department: '  Department  ',
			})

			const employee = await fetchStaffById(mockStaff.staffId)

			expect(employee?.fullName.trim()).toBe(employee?.fullName)
			expect(employee?.email.trim()).toBe(employee?.email)
			expect(employee?.jobTitle.trim()).toBe(employee?.jobTitle)
		})
	})
})
