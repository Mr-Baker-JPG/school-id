import { describe, expect, test, beforeEach, afterEach } from 'vitest'
import { prisma } from './db.server.ts'
import { syncStudentsFromFacts } from './student-sync.server.ts'
import { server } from '#tests/mocks/index.ts'
import { clearMockStudents, insertMockStudent } from '#tests/mocks/facts.ts'
import { http, HttpResponse } from 'msw'
import { FactsApiError } from './facts-api.server.ts'
import { consoleError } from '#tests/setup/setup-test-env.ts'

describe('Student Sync Background Job', () => {
	beforeEach(async () => {
		// Clear database
		await prisma.studentID.deleteMany()
		await prisma.student.deleteMany()
		clearMockStudents()

		// Set mock environment variables
		process.env.FACTS_SUBSCRIPTION_KEY = 'MOCK_SUBSCRIPTION_KEY'
		process.env.FACTS_API_KEY = 'MOCK_API_KEY'
		process.env.FACTS_BASE_URL = 'https://api.factsmgt.com'
	})

	afterEach(async () => {
		// Clean up database
		await prisma.studentID.deleteMany()
		await prisma.student.deleteMany()
	})

	describe('Job successfully syncs students on schedule', () => {
		test('Sync completes successfully with valid data', async () => {
			insertMockStudent({
				studentId: 1,
				firstName: 'John',
				lastName: 'Doe',
				email: 'john.doe@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(1)
			expect(result.updated).toBe(0)
			expect(result.errors).toBe(0)
		})
	})

	describe('New students from SIS are created in database', () => {
		test('Creates new student when not in database', async () => {
			insertMockStudent({
				studentId: 123,
				firstName: 'Jane',
				lastName: 'Smith',
				email: 'jane.smith@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(1)
			expect(result.updated).toBe(0)

			const student = await prisma.student.findUnique({
				where: { sisStudentId: '123' },
			})

			expect(student).not.toBeNull()
			expect(student?.fullName).toBe('Jane Smith')
			expect(student?.email).toBe('jane.smith@school.org')
			expect(student?.status).toBe('active')
			expect(student?.isNameEdited).toBe(false)
		})

		test('Creates multiple new students', async () => {
			insertMockStudent({
				studentId: 1,
				firstName: 'Alice',
				lastName: 'Johnson',
				email: 'alice.johnson@school.org',
				active: true,
			})
			insertMockStudent({
				studentId: 2,
				firstName: 'Bob',
				lastName: 'Williams',
				email: 'bob.williams@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(2)
			expect(result.updated).toBe(0)

			const students = await prisma.student.findMany()
			expect(students).toHaveLength(2)
		})
	})

	describe('Existing students are updated with latest SIS data', () => {
		test('Updates existing student when data changes', async () => {
			// Create existing student
			await prisma.student.create({
				data: {
					sisStudentId: '456',
					fullName: 'Old Name',
					email: 'old.email@school.org',
					status: 'active',
					isNameEdited: false,
				},
			})

			// Mock updated data from SIS
			insertMockStudent({
				studentId: 456,
				firstName: 'New',
				lastName: 'Name',
				email: 'new.email@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(0)
			expect(result.updated).toBe(1)

			const student = await prisma.student.findUnique({
				where: { sisStudentId: '456' },
			})

			expect(student?.fullName).toBe('New Name')
			expect(student?.email).toBe('new.email@school.org')
		})

		test('Updates multiple existing students', async () => {
			// Create existing students
			await prisma.student.create({
				data: {
					sisStudentId: '1',
					fullName: 'Student One',
					email: 'student1@school.org',
					status: 'active',
					isNameEdited: false,
				},
			})
			await prisma.student.create({
				data: {
					sisStudentId: '2',
					fullName: 'Student Two',
					email: 'student2@school.org',
					status: 'active',
					isNameEdited: false,
				},
			})

			// Mock updated data from SIS
			insertMockStudent({
				studentId: 1,
				firstName: 'Updated',
				lastName: 'One',
				email: 'updated1@school.org',
				active: true,
			})
			insertMockStudent({
				studentId: 2,
				firstName: 'Updated',
				lastName: 'Two',
				email: 'updated2@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.created).toBe(0)
			expect(result.updated).toBe(2)

			const students = await prisma.student.findMany({
				orderBy: { sisStudentId: 'asc' },
			})
			expect(students[0]?.fullName).toBe('Updated One')
			expect(students[1]?.fullName).toBe('Updated Two')
		})
	})

	describe('Admin-edited names are preserved during sync', () => {
		test('Preserves admin-edited name when isNameEdited is true', async () => {
			// Create existing student with admin-edited name
			await prisma.student.create({
				data: {
					sisStudentId: '789',
					fullName: 'Admin Edited Name',
					email: 'old.email@school.org',
					status: 'active',
					isNameEdited: true,
				},
			})

			// Mock updated data from SIS with different name
			insertMockStudent({
				studentId: 789,
				firstName: 'SIS',
				lastName: 'Name',
				email: 'new.email@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.updated).toBe(1)

			const student = await prisma.student.findUnique({
				where: { sisStudentId: '789' },
			})

			// Name should remain the admin-edited name, not the SIS name
			expect(student?.fullName).toBe('Admin Edited Name')
			// But email should still be updated
			expect(student?.email).toBe('new.email@school.org')
			// isNameEdited flag should remain true
			expect(student?.isNameEdited).toBe(true)
		})

		test('Updates name when isNameEdited is false', async () => {
			// Create existing student without admin-edited name
			await prisma.student.create({
				data: {
					sisStudentId: '101',
					fullName: 'Old SIS Name',
					email: 'old.email@school.org',
					status: 'active',
					isNameEdited: false,
				},
			})

			// Mock updated data from SIS
			insertMockStudent({
				studentId: 101,
				firstName: 'New',
				lastName: 'SIS Name',
				email: 'new.email@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.updated).toBe(1)

			const student = await prisma.student.findUnique({
				where: { sisStudentId: '101' },
			})

			// Name should be updated from SIS
			expect(student?.fullName).toBe('New SIS Name')
			expect(student?.email).toBe('new.email@school.org')
			expect(student?.isNameEdited).toBe(false)
		})
	})

	describe('Inactive students have status updated correctly', () => {
		test('Updates status from active to inactive', async () => {
			// Create active student
			await prisma.student.create({
				data: {
					sisStudentId: '202',
					fullName: 'Becoming Inactive',
					email: 'inactive@school.org',
					status: 'active',
					isNameEdited: false,
				},
			})

			// Mock inactive status from SIS
			insertMockStudent({
				studentId: 202,
				firstName: 'Becoming',
				lastName: 'Inactive',
				email: 'inactive@school.org',
				active: false,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.updated).toBe(1)

			const student = await prisma.student.findUnique({
				where: { sisStudentId: '202' },
			})

			expect(student?.status).toBe('inactive')
		})

		test('Updates status from inactive to active', async () => {
			// Create inactive student
			await prisma.student.create({
				data: {
					sisStudentId: '303',
					fullName: 'Becoming Active',
					email: 'active@school.org',
					status: 'inactive',
					isNameEdited: false,
				},
			})

			// Mock active status from SIS
			insertMockStudent({
				studentId: 303,
				firstName: 'Becoming',
				lastName: 'Active',
				email: 'active@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.updated).toBe(1)

			const student = await prisma.student.findUnique({
				where: { sisStudentId: '303' },
			})

			expect(student?.status).toBe('active')
		})
	})

	describe('Job handles failures without crashing', () => {
		test('Handles FACTS API errors gracefully', async () => {
			const consoleErrorSpy = consoleError.mockImplementation(() => {})

			server.use(
				http.get('https://api.factsmgt.com/Students', () => {
					return HttpResponse.json(
						{
							type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
							title: 'Internal Server Error',
							status: 500,
							detail: 'Internal server error',
						},
						{ status: 500 },
					)
				}),
			)

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(false)
			expect(result.errorMessage).toContain('FACTS API error')

			consoleErrorSpy.mockRestore()
		})

		test('Handles network errors gracefully', async () => {
			const consoleErrorSpy = consoleError.mockImplementation(() => {})

			server.use(
				http.get('https://api.factsmgt.com/Students', () => {
					return HttpResponse.error()
				}),
			)

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(false)
			expect(result.errorMessage).toContain('FACTS API error')

			consoleErrorSpy.mockRestore()
		})

		test('Continues processing other students when one fails', async () => {
			// This test ensures that even if one student fails to sync,
			// the job continues and syncs other students
			insertMockStudent({
				studentId: 1,
				firstName: 'Valid',
				lastName: 'Student',
				email: 'valid@school.org',
				active: true,
			})

			// Add a student that will fail validation (no email)
			insertMockStudent({
				studentId: 2,
				firstName: 'Invalid',
				lastName: 'Student',
				email: '',
				active: true,
			})

			insertMockStudent({
				studentId: 3,
				firstName: 'Another',
				lastName: 'Valid',
				email: 'another.valid@school.org',
				active: true,
			})

			const result = await syncStudentsFromFacts()

			// The job should succeed overall
			expect(result.success).toBe(true)
			// Should have created 2 valid students (skipped the invalid one)
			expect(result.created).toBe(2)
		})

		test('Handles database constraint violations gracefully', async () => {
			// Create a student with duplicate email
			await prisma.student.create({
				data: {
					sisStudentId: '1',
					fullName: 'Existing Student',
					email: 'duplicate@school.org',
					status: 'active',
					isNameEdited: false,
				},
			})

			// Try to create another student with same email
			insertMockStudent({
				studentId: 2,
				firstName: 'New',
				lastName: 'Student',
				email: 'duplicate@school.org',
				active: true,
			})

			// This should not crash, but should log an error
			const consoleErrorSpy = consoleError.mockImplementation(() => {})

			const result = await syncStudentsFromFacts()

			expect(result.success).toBe(true)
			expect(result.errors).toBeGreaterThan(0)

			consoleErrorSpy.mockRestore()
		})
	})
})
