import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '#app/utils/db.server.ts'
import { loader } from './print.tsx'

// Mock permissions
vi.mock('#app/utils/permissions.server.ts', () => ({
	requireUserWithRole: vi.fn(),
}))

// Mock person-type
vi.mock('#app/utils/person-type.ts', () => ({
	getEmployeePersonType: vi.fn((jobTitle: string) => {
		if (jobTitle?.toLowerCase().includes('faculty')) return 'FACULTY'
		return 'STAFF'
	}),
}))

function createRequest(params: Record<string, string> = {}) {
	const url = new URL('http://localhost/admin/print')
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v)
	}
	return new Request(url.toString())
}

describe('Admin Print Route', () => {
	beforeEach(async () => {
		await prisma.studentID.deleteMany()
		await prisma.student.deleteMany()
		await prisma.employeeID.deleteMany()
		await prisma.employee.deleteMany()
		// Verify cleanup
		const empCount = await prisma.employee.count()
		const stuCount = await prisma.student.count()
		if (empCount > 0 || stuCount > 0) {
			throw new Error(`Cleanup failed: ${empCount} employees, ${stuCount} students remaining`)
		}
	})

	it('returns employees and students by default', async () => {
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'E1',
				firstName: 'Jane',
				lastName: 'Doe',
				fullName: 'Jane Doe',
				jobTitle: 'Faculty',
				department: 'Math',
				email: 'jane@test.com',
				status: 'active',
			},
		})
		await prisma.student.create({
			data: {
				sisStudentId: 'S1',
				firstName: 'Bob',
				lastName: 'Smith',
				fullName: 'Bob Smith',
				email: 'bob@test.com',
				grade: '10',
				status: 'active',
			},
		})

		const response = await loader({
			request: createRequest(),
			params: {},
			context: {},
		} as any)

		expect(response.people).toHaveLength(2)
		expect(response.people.some((p: any) => p.type === 'employee')).toBe(true)
		expect(response.people.some((p: any) => p.type === 'student')).toBe(true)
	})

	it('filters to employees only', async () => {
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'E2',
				firstName: 'Jane',
				lastName: 'Doe',
				fullName: 'Jane Doe',
				jobTitle: 'Staff',
				email: 'jane2@test.com',
				status: 'active',
			},
		})
		await prisma.student.create({
			data: {
				sisStudentId: 'S2',
				firstName: 'Bob',
				lastName: 'Smith',
				fullName: 'Bob Smith',
				email: 'bob2@test.com',
				grade: '10',
				status: 'active',
			},
		})

		const response = await loader({
			request: createRequest({ type: 'employees' }),
			params: {},
			context: {},
		} as any)

		expect(response.people.every((p: any) => p.type === 'employee')).toBe(true)
	})

	it('filters students by grade', async () => {
		await prisma.student.create({
			data: {
				sisStudentId: 'S3',
				firstName: 'Alice',
				lastName: 'A',
				fullName: 'Alice A',
				email: 'alice@test.com',
				grade: '10',
				status: 'active',
			},
		})
		await prisma.student.create({
			data: {
				sisStudentId: 'S4',
				firstName: 'Charlie',
				lastName: 'C',
				fullName: 'Charlie C',
				email: 'charlie@test.com',
				grade: '11',
				status: 'active',
			},
		})

		const response = await loader({
			request: createRequest({ type: 'students', grade: '10' }),
			params: {},
			context: {},
		} as any)

		expect(response.people).toHaveLength(1)
		expect(response.people[0].fullName).toBe('Alice A')
	})

	it('filters employees by department and returns filter options', async () => {
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'E3',
				firstName: 'Math',
				lastName: 'Teacher',
				fullName: 'Math Teacher',
				jobTitle: 'Faculty',
				department: 'Math',
				email: 'math@test.com',
				status: 'active',
			},
		})
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'E4',
				firstName: 'Science',
				lastName: 'Teacher',
				fullName: 'Science Teacher',
				jobTitle: 'Faculty',
				department: 'Science',
				email: 'sci@test.com',
				status: 'active',
			},
		})
		await prisma.student.create({
			data: {
				sisStudentId: 'S-grade',
				firstName: 'Grade',
				lastName: 'Student',
				fullName: 'Grade Student',
				email: 'grade-stu@test.com',
				grade: '9',
				status: 'active',
			},
		})

		// Test department filter
		const filtered = await loader({
			request: createRequest({ type: 'employees', department: 'Math' }),
			params: {},
			context: {},
		} as any)

		expect(filtered.people).toHaveLength(1)
		expect(filtered.people[0].fullName).toBe('Math Teacher')

		// Test that departments and grades are returned as filter options
		const all = await loader({
			request: createRequest(),
			params: {},
			context: {},
		} as any)

		expect(all.departments).toEqual(expect.arrayContaining(['Math', 'Science']))
		expect(all.grades).toEqual(expect.arrayContaining(['9']))
	})

	it('filters employees by classification (faculty/staff)', async () => {
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'E5',
				firstName: 'Faculty',
				lastName: 'Member',
				fullName: 'Faculty Member',
				jobTitle: 'Faculty',
				email: 'fac@test.com',
				status: 'active',
			},
		})
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'E6',
				firstName: 'Staff',
				lastName: 'Member',
				fullName: 'Staff Member',
				jobTitle: 'Admin Staff',
				email: 'staff@test.com',
				status: 'active',
			},
		})

		const response = await loader({
			request: createRequest({ type: 'employees', classification: 'faculty' }),
			params: {},
			context: {},
		} as any)

		expect(response.people).toHaveLength(1)
		expect(response.people[0].personType).toBe('FACULTY')
	})

	it('filters by active status by default', async () => {
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'E8',
				firstName: 'Active',
				lastName: 'Person',
				fullName: 'Active Person',
				jobTitle: 'Staff',
				email: 'active@test.com',
				status: 'active',
			},
		})
		await prisma.employee.create({
			data: {
				sisEmployeeId: 'E9',
				firstName: 'Inactive',
				lastName: 'Person',
				fullName: 'Inactive Person',
				jobTitle: 'Staff',
				email: 'inactive@test.com',
				status: 'inactive',
			},
		})

		const response = await loader({
			request: createRequest(),
			params: {},
			context: {},
		} as any)

		// Only active people should be returned by default
		const testPeople = response.people.filter((p: any) =>
			p.email === 'active@test.com' || p.email === 'inactive@test.com'
		)
		expect(testPeople).toHaveLength(1)
		expect(testPeople[0].fullName).toBe('Active Person')
	})
})
