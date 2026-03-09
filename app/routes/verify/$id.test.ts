import { faker } from '@faker-js/faker'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '#app/utils/db.server.ts'
import { loader, meta } from './$id.tsx'

// Mock the FACTS profile picture fetch to avoid console warnings in tests
vi.mock('#app/utils/employee.server.ts', () => ({
	fetchAndCacheFactsProfilePicture: vi.fn(() => Promise.resolve()),
}))

vi.mock('#app/utils/student.server.ts', () => ({
	fetchAndCacheFactsProfilePicture: vi.fn(() => Promise.resolve()),
}))

beforeEach(() => {
	vi.clearAllMocks()
})

afterEach(() => {
	vi.clearAllMocks()
})

async function createEmployee(data?: {
	fullName?: string
	email?: string
	jobTitle?: string
	status?: 'active' | 'inactive'
	sisEmployeeId?: string
}) {
	const employee = await prisma.employee.create({
		data: {
			sisEmployeeId: data?.sisEmployeeId ?? faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			jobTitle: data?.jobTitle ?? faker.person.jobTitle(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
		},
		select: {
			id: true,
			sisEmployeeId: true,
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

async function createStudent(data?: {
	fullName?: string
	email?: string
	status?: 'active' | 'inactive'
	sisStudentId?: string
}) {
	const student = await prisma.student.create({
		data: {
			sisStudentId: data?.sisStudentId ?? faker.string.alphanumeric(10),
			fullName: data?.fullName ?? faker.person.fullName(),
			email: data?.email ?? faker.internet.email(),
			status: data?.status ?? 'active',
		},
		select: {
			id: true,
			sisStudentId: true,
			fullName: true,
			email: true,
			status: true,
		},
	})

	return student
}

async function createStudentId(data: {
	studentId: string
	expirationDate: Date
	photoUrl?: string | null
}) {
	const studentId = await prisma.studentID.create({
		data: {
			studentId: data.studentId,
			expirationDate: data.expirationDate,
			photoUrl: data.photoUrl ?? null,
		},
		select: {
			id: true,
			studentId: true,
			expirationDate: true,
			photoUrl: true,
		},
	})

	return studentId
}

describe('verify/$id route', () => {
	describe('Employee Verification', () => {
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
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			expect(data).toBeDefined()
			expect(data.person).toBeDefined()
			expect(data.person.id).toBe(employee.id)
			expect(data.personType).toBe('employee')

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
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			expect(data.person.fullName).toBe('Jane Smith')
			expect(data.person.jobTitle).toBe('Principal')

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: employee.id },
			})
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Page shows active/inactive status correctly for employees', async () => {
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
				params: { id: activeEmployee.id },
				request: request1,
				context: {},
			} as any)

			expect(data1.person.status).toBe('active')

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
				params: { id: inactiveEmployee.id },
				request: request2,
				context: {},
			} as any)

			expect(data2.person.status).toBe('inactive')
			expect(data2.verificationStatus.isValid).toBe(false)

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: { in: [activeEmployee.id, inactiveEmployee.id] } },
			})
			await prisma.employee.deleteMany({
				where: { id: { in: [activeEmployee.id, inactiveEmployee.id] } },
			})
		})

		test('Page displays expiration date for employees', async () => {
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
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			expect(data.person.expirationDate).toBe(expirationDate.toISOString())

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: employee.id },
			})
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Page shows valid/invalid badge based on status and expiration for employees', async () => {
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
				params: { id: validEmployee.id },
				request: request1,
				context: {},
			} as any)

			expect(data1.verificationStatus.isValid).toBe(true)
			expect(data1.verificationStatus.reason).toBe('Valid ID')

			// Test invalid ID (inactive)
			const invalidEmployee1 = await createEmployee({
				fullName: 'Inactive Employee',
				jobTitle: 'Teacher',
				email: 'inactive2@school.edu',
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
				params: { id: invalidEmployee1.id },
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
				params: { id: expiredEmployee.id },
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
	})

	describe('Student Verification', () => {
		test('Verification page works for students', async () => {
			const student = await createStudent({
				fullName: 'John Student',
				email: 'john.student@school.edu',
				status: 'active',
			})

			await createStudentId({
				studentId: student.id,
				expirationDate: new Date('2025-07-01'),
			})

			const request = new Request('http://localhost/verify/' + student.id)

			const data = await loader({
				params: { id: student.id },
				request,
				context: {},
			} as any)

			expect(data).toBeDefined()
			expect(data.person).toBeDefined()
			expect(data.person.id).toBe(student.id)
			expect(data.personType).toBe('student')

			// Cleanup
			await prisma.studentID.deleteMany({
				where: { studentId: student.id },
			})
			await prisma.student.delete({ where: { id: student.id } })
		})

		test('Page displays correct person type label for students', async () => {
			const student = await createStudent({
				fullName: 'Jane Student',
				email: 'jane.student@school.edu',
				status: 'active',
			})

			await createStudentId({
				studentId: student.id,
				expirationDate: new Date('2025-07-01'),
			})

			const request = new Request('http://localhost/verify/' + student.id)

			const data = await loader({
				params: { id: student.id },
				request,
				context: {},
			} as any)

			expect(data.personType).toBe('student')
			expect(data.person.fullName).toBe('Jane Student')

			// Cleanup
			await prisma.studentID.deleteMany({
				where: { studentId: student.id },
			})
			await prisma.student.delete({ where: { id: student.id } })
		})

		test('Page shows active/inactive status correctly for students', async () => {
			// Test active student
			const activeStudent = await createStudent({
				fullName: 'Active Student',
				email: 'active.student@school.edu',
				status: 'active',
			})

			await createStudentId({
				studentId: activeStudent.id,
				expirationDate: new Date('2025-07-01'),
			})

			const request1 = new Request('http://localhost/verify/' + activeStudent.id)
			const data1 = await loader({
				params: { id: activeStudent.id },
				request: request1,
				context: {},
			} as any)

			expect(data1.person.status).toBe('active')

			// Test inactive student
			const inactiveStudent = await createStudent({
				fullName: 'Inactive Student',
				email: 'inactive.student@school.edu',
				status: 'inactive',
			})

			await createStudentId({
				studentId: inactiveStudent.id,
				expirationDate: new Date('2025-07-01'),
			})

			const request2 = new Request(
				'http://localhost/verify/' + inactiveStudent.id,
			)
			const data2 = await loader({
				params: { id: inactiveStudent.id },
				request: request2,
				context: {},
			} as any)

			expect(data2.person.status).toBe('inactive')
			expect(data2.verificationStatus.isValid).toBe(false)

			// Cleanup
			await prisma.studentID.deleteMany({
				where: { studentId: { in: [activeStudent.id, inactiveStudent.id] } },
			})
			await prisma.student.deleteMany({
				where: { id: { in: [activeStudent.id, inactiveStudent.id] } },
			})
		})

		test('Page displays expiration date for students', async () => {
			const expirationDate = new Date('2025-07-01')
			const student = await createStudent({
				fullName: 'Test Student',
				email: 'test.student@school.edu',
				status: 'active',
			})

			await createStudentId({
				studentId: student.id,
				expirationDate,
			})

			const request = new Request('http://localhost/verify/' + student.id)

			const data = await loader({
				params: { id: student.id },
				request,
				context: {},
			} as any)

			expect(data.person.expirationDate).toBe(expirationDate.toISOString())

			// Cleanup
			await prisma.studentID.deleteMany({
				where: { studentId: student.id },
			})
			await prisma.student.delete({ where: { id: student.id } })
		})

		test('Page shows valid/invalid badge based on status and expiration for students', async () => {
			// Test valid ID (active + future expiration)
			const validStudent = await createStudent({
				fullName: 'Valid Student',
				email: 'valid.student@school.edu',
				status: 'active',
			})

			const futureDate = new Date()
			futureDate.setFullYear(futureDate.getFullYear() + 1)

			await createStudentId({
				studentId: validStudent.id,
				expirationDate: futureDate,
			})

			const request1 = new Request('http://localhost/verify/' + validStudent.id)
			const data1 = await loader({
				params: { id: validStudent.id },
				request: request1,
				context: {},
			} as any)

			expect(data1.verificationStatus.isValid).toBe(true)
			expect(data1.verificationStatus.reason).toBe('Valid ID')

			// Test invalid ID (inactive)
			const invalidStudent = await createStudent({
				fullName: 'Inactive Student',
				email: 'inactive.student2@school.edu',
				status: 'inactive',
			})

			await createStudentId({
				studentId: invalidStudent.id,
				expirationDate: futureDate,
			})

			const request2 = new Request(
				'http://localhost/verify/' + invalidStudent.id,
			)
			const data2 = await loader({
				params: { id: invalidStudent.id },
				request: request2,
				context: {},
			} as any)

			expect(data2.verificationStatus.isValid).toBe(false)
			expect(data2.verificationStatus.reason).toBe('Employee is not active')

			// Test invalid ID (expired)
			const expiredStudent = await createStudent({
				fullName: 'Expired Student',
				email: 'expired.student@school.edu',
				status: 'active',
			})

			const pastDate = new Date()
			pastDate.setFullYear(pastDate.getFullYear() - 1)

			await createStudentId({
				studentId: expiredStudent.id,
				expirationDate: pastDate,
			})

			const request3 = new Request(
				'http://localhost/verify/' + expiredStudent.id,
			)
			const data3 = await loader({
				params: { id: expiredStudent.id },
				request: request3,
				context: {},
			} as any)

			expect(data3.verificationStatus.isValid).toBe(false)
			expect(data3.verificationStatus.reason).toBe('ID has expired')

			// Cleanup
			await prisma.studentID.deleteMany({
				where: {
					studentId: {
						in: [validStudent.id, invalidStudent.id, expiredStudent.id],
					},
				},
			})
			await prisma.student.deleteMany({
				where: {
					id: { in: [validStudent.id, invalidStudent.id, expiredStudent.id] },
				},
			})
		})
	})

	describe('Error Handling', () => {
		test('Invalid IDs show appropriate error message', async () => {
			const nonExistentId = 'non-existent-id'

			const request = new Request('http://localhost/verify/' + nonExistentId)

			try {
				await loader({
					params: { id: nonExistentId },
					request,
					context: {},
				} as any)
				expect.fail('Should have thrown')
			} catch (error) {
				expect(error).toBeInstanceOf(Response)
				if (error instanceof Response) {
					expect(error.status).toBe(404)
					const text = await error.text()
					expect(text).toBe('Person not found')
				}
			}
		})

		test('Missing ID parameter shows appropriate error', async () => {
			const request = new Request('http://localhost/verify/')

			try {
				await loader({
					params: { id: undefined },
					request,
					context: {},
				} as any)
				expect.fail('Should have thrown')
			} catch (error) {
				expect(error).toBeInstanceOf(Response)
				if (error instanceof Response) {
					expect(error.status).toBe(400)
					const text = await error.text()
					expect(text).toBe('ID is required')
				}
			}
		})
	})

	describe('Branding', () => {
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
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			expect(data.branding).toBeDefined()
			expect(data.branding.schoolName).toBeDefined()
			expect(data.branding.primaryColor).toBeDefined()
			expect(data.branding.secondaryColor).toBeDefined()
			expect(data.branding).toHaveProperty('logoUrl')
			expect(data.branding.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
			expect(data.branding.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: employee.id },
			})
			await prisma.employee.delete({ where: { id: employee.id } })
		})
	})

	describe('SEO Metadata', () => {
		test('Verification page has appropriate title tag', async () => {
			const employee = await createEmployee({
				fullName: 'John Doe',
				jobTitle: 'Teacher',
				email: 'john.doe@school.edu',
				status: 'active',
			})

			const futureDate = new Date()
			futureDate.setFullYear(futureDate.getFullYear() + 1)

			await createEmployeeId({
				employeeId: employee.id,
				expirationDate: futureDate,
			})

			const request = new Request('http://localhost/verify/' + employee.id)
			const data = await loader({
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			const metaTags = meta({
				data,
				params: { id: employee.id },
			} as any)

			const titleTag = metaTags.find((tag) => 'title' in tag)
			expect(titleTag).toBeDefined()
			expect(titleTag?.title).toContain('John Doe')
			expect(titleTag?.title).toContain('Valid')

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: employee.id },
			})
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Page includes meta description', async () => {
			const employee = await createEmployee({
				fullName: 'Jane Smith',
				jobTitle: 'Principal',
				email: 'jane.smith@school.edu',
				status: 'active',
			})

			const futureDate = new Date()
			futureDate.setFullYear(futureDate.getFullYear() + 1)

			await createEmployeeId({
				employeeId: employee.id,
				expirationDate: futureDate,
			})

			const request = new Request('http://localhost/verify/' + employee.id)
			const data = await loader({
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			const metaTags = meta({
				data,
				params: { id: employee.id },
			} as any)

			const descriptionTag = metaTags.find(
				(tag) => 'name' in tag && tag.name === 'description',
			)
			expect(descriptionTag).toBeDefined()
			expect(descriptionTag?.content).toContain('Jane Smith')

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: employee.id },
			})
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Student metadata shows correct type label', async () => {
			const student = await createStudent({
				fullName: 'Test Student',
				email: 'test.student@school.edu',
				status: 'active',
			})

			const futureDate = new Date()
			futureDate.setFullYear(futureDate.getFullYear() + 1)

			await createStudentId({
				studentId: student.id,
				expirationDate: futureDate,
			})

			const request = new Request('http://localhost/verify/' + student.id)
			const data = await loader({
				params: { id: student.id },
				request,
				context: {},
			} as any)

			const metaTags = meta({
				data,
				params: { id: student.id },
			} as any)

			const titleTag = metaTags.find((tag) => 'title' in tag)
			expect(titleTag).toBeDefined()
			expect(titleTag?.title).toContain('Student Verification')

			const descriptionTag = metaTags.find(
				(tag) => 'name' in tag && tag.name === 'description',
			)
			expect(descriptionTag).toBeDefined()
			expect(descriptionTag?.content).toContain('Student verification')

			// Cleanup
			await prisma.studentID.deleteMany({
				where: { studentId: student.id },
			})
			await prisma.student.delete({ where: { id: student.id } })
		})

		test('Employee metadata shows correct type label', async () => {
			const employee = await createEmployee({
				fullName: 'Test Employee',
				jobTitle: 'Teacher',
				email: 'test.employee@school.edu',
				status: 'active',
			})

			const futureDate = new Date()
			futureDate.setFullYear(futureDate.getFullYear() + 1)

			await createEmployeeId({
				employeeId: employee.id,
				expirationDate: futureDate,
			})

			const request = new Request('http://localhost/verify/' + employee.id)
			const data = await loader({
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			const metaTags = meta({
				data,
				params: { id: employee.id },
			} as any)

			const titleTag = metaTags.find((tag) => 'title' in tag)
			expect(titleTag).toBeDefined()
			expect(titleTag?.title).toContain('Employee Verification')

			const descriptionTag = metaTags.find(
				(tag) => 'name' in tag && tag.name === 'description',
			)
			expect(descriptionTag).toBeDefined()
			expect(descriptionTag?.content).toContain('Employee verification')

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: employee.id },
			})
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Returns default metadata when data is missing', () => {
			const metaTags = meta({ data: undefined } as any)

			const titleTag = metaTags.find((tag) => 'title' in tag)
			expect(titleTag).toBeDefined()
			expect(titleTag?.title).toBe('ID Verification')

			const descriptionTag = metaTags.find(
				(tag) => 'name' in tag && tag.name === 'description',
			)
			expect(descriptionTag).toBeDefined()
			expect(descriptionTag?.content).toBe('Verify ID status')
		})
	})

	describe('Handles missing ID records', () => {
		test('Handles employee without EmployeeID record', async () => {
			const employee = await createEmployee({
				fullName: 'No ID Employee',
				jobTitle: 'Teacher',
				email: 'noid@school.edu',
				status: 'active',
			})

			const request = new Request('http://localhost/verify/' + employee.id)

			const data = await loader({
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			expect(data.person).toBeDefined()
			expect(data.person.expirationDate).toBeNull()
			expect(data.verificationStatus.isValid).toBe(false)
			expect(data.verificationStatus.reason).toBe('Expiration date not set')

			// Cleanup
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Handles student without StudentID record', async () => {
			const student = await createStudent({
				fullName: 'No ID Student',
				email: 'noid.student@school.edu',
				status: 'active',
			})

			const request = new Request('http://localhost/verify/' + student.id)

			const data = await loader({
				params: { id: student.id },
				request,
				context: {},
			} as any)

			expect(data.person).toBeDefined()
			expect(data.person.expirationDate).toBeNull()
			expect(data.verificationStatus.isValid).toBe(false)
			expect(data.verificationStatus.reason).toBe('Expiration date not set')

			// Cleanup
			await prisma.student.delete({ where: { id: student.id } })
		})
	})

	describe('Verification by SIS ID', () => {
		test('Verification page works with employee SIS ID', async () => {
			const employee = await createEmployee({
				fullName: 'Samantha Baker',
				jobTitle: 'Teacher',
				email: 'samantha.baker@school.edu',
				status: 'active',
				sisEmployeeId: '1201702',
			})

			await createEmployeeId({
				employeeId: employee.id,
				expirationDate: new Date('2025-07-01'),
			})

			// Use SIS ID instead of database ID
			const request = new Request(
				'http://localhost/verify/' + employee.sisEmployeeId,
			)

			const data = await loader({
				params: { id: employee.sisEmployeeId },
				request,
				context: {},
			} as any)

			expect(data).toBeDefined()
			expect(data.person).toBeDefined()
			expect(data.person.fullName).toBe('Samantha Baker')
			expect(data.personType).toBe('employee')

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: employee.id },
			})
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Verification page works with student SIS ID', async () => {
			const student = await createStudent({
				fullName: 'Test Student',
				email: 'test.student@school.edu',
				status: 'active',
				sisStudentId: '9876543',
			})

			await createStudentId({
				studentId: student.id,
				expirationDate: new Date('2025-07-01'),
			})

			// Use SIS ID instead of database ID
			const request = new Request(
				'http://localhost/verify/' + student.sisStudentId,
			)

			const data = await loader({
				params: { id: student.sisStudentId },
				request,
				context: {},
			} as any)

			expect(data).toBeDefined()
			expect(data.person).toBeDefined()
			expect(data.person.fullName).toBe('Test Student')
			expect(data.personType).toBe('student')

			// Cleanup
			await prisma.studentID.deleteMany({
				where: { studentId: student.id },
			})
			await prisma.student.delete({ where: { id: student.id } })
		})

		test('Verification still works with database ID (backward compatibility)', async () => {
			const employee = await createEmployee({
				fullName: 'Backward Compat Employee',
				jobTitle: 'Teacher',
				email: 'backward@school.edu',
				status: 'active',
			})

			await createEmployeeId({
				employeeId: employee.id,
				expirationDate: new Date('2025-07-01'),
			})

			// Use database ID (UUID format)
			const request = new Request('http://localhost/verify/' + employee.id)

			const data = await loader({
				params: { id: employee.id },
				request,
				context: {},
			} as any)

			expect(data).toBeDefined()
			expect(data.person).toBeDefined()
			expect(data.person.fullName).toBe('Backward Compat Employee')
			expect(data.personType).toBe('employee')

			// Cleanup
			await prisma.employeeID.deleteMany({
				where: { employeeId: employee.id },
			})
			await prisma.employee.delete({ where: { id: employee.id } })
		})
	})
})
