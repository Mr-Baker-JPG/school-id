/**
 * Tests for Google Workspace photo sync script
 * 
 * Tests verify behavior through the public interface (syncPhotosToGoogle)
 * and use mocks for Google Admin SDK and database to avoid actual API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { google } from 'googleapis'

// Mock dependencies
vi.mock('googleapis', () => ({
	google: {
		auth: {
			GoogleAuth: vi.fn(),
		},
		admin: vi.fn(),
	},
}))

vi.mock('#app/utils/db.server.ts', () => ({
	prisma: {
		employee: {
			findMany: vi.fn(),
		},
		student: {
			findMany: vi.fn(),
		},
		$disconnect: vi.fn(),
	},
}))

vi.mock('#app/utils/storage.server.ts', () => ({
	getSignedGetRequestInfo: vi.fn(),
}))

describe('syncPhotosToGoogle', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('Employee sync', () => {
		it('syncs employee with photo to Google Workspace', async () => {
			// Setup: Mock employee with photo
			const { prisma } = await import('#app/utils/db.server.ts')
			const { getSignedGetRequestInfo } = await import(
				'#app/utils/storage.server.ts'
			)

			const mockEmployee = {
				id: 'emp123',
				email: 'teacher@jpgacademy.org',
				fullName: 'Test Teacher',
				jobTitle: 'Teacher',
				status: 'active',
				sisEmployeeId: 'SIS123',
				employeeId: {
					id: 'eid123',
					photoUrl: 'employees/test123/photos/photo.jpg',
					expirationDate: new Date('2025-07-01'),
				},
			}

			vi.mocked(prisma.employee.findMany).mockResolvedValue([mockEmployee])

			// Mock storage to return photo data
			vi.mocked(getSignedGetRequestInfo).mockReturnValue({
				url: 'https://storage.example.com/photo.jpg',
				headers: {},
			})

			// Mock fetch for photo
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () =>
					Promise.resolve(new TextEncoder().encode('fake-image-data').buffer),
			})

			// Mock Google Admin SDK
			const mockUpdate = vi.fn().mockResolvedValue({ data: {} })
			vi.mocked(google.admin).mockReturnValue({
				users: {
					photos: {
						update: mockUpdate,
					},
				},
			} as any)

			// Execute
			const { syncPhotosToGoogle } = await import('./sync-google-photos.js')
			const result = await syncPhotosToGoogle({
				employeesOnly: true,
				studentsOnly: false,
				dryRun: false,
			})

			// Verify behavior: employee was updated
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				email: mockEmployee.email,
				success: true,
				action: 'updated',
			})

			// Verify Google API was called with photo data
			expect(mockUpdate).toHaveBeenCalledWith({
				userKey: mockEmployee.email,
				resource: {
					photoData: expect.any(String), // Base64 encoded photo
				},
			})
		})

		it('skips employee without photo', async () => {
			// Setup: Mock employee without photo
			const { prisma } = await import('#app/utils/db.server.ts')

			const mockEmployee = {
				id: 'emp123',
				email: 'teacher@jpgacademy.org',
				fullName: 'Test Teacher',
				jobTitle: 'Teacher',
				status: 'active',
				sisEmployeeId: 'SIS123',
				employeeId: {
					id: 'eid123',
					photoUrl: null, // No photo
					expirationDate: new Date('2025-07-01'),
				},
			}

			vi.mocked(prisma.employee.findMany).mockResolvedValue([mockEmployee])

			// Mock Google Admin SDK
			const mockUpdate = vi.fn().mockResolvedValue({ data: {} })
			vi.mocked(google.admin).mockReturnValue({
				users: {
					photos: {
						update: mockUpdate,
					},
				},
			} as any)

			// Execute
			const { syncPhotosToGoogle } = await import('./sync-google-photos.js')
			const result = await syncPhotosToGoogle({
				employeesOnly: true,
				studentsOnly: false,
				dryRun: false,
			})

			// Verify behavior: employee was skipped
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				email: mockEmployee.email,
				success: true,
				action: 'skipped',
			})

			// Verify Google API was NOT called
			expect(mockUpdate).not.toHaveBeenCalled()
		})
	})

	describe('Student sync', () => {
		it('syncs student with photo to Google Workspace', async () => {
			// Setup: Mock student with photo
			const { prisma } = await import('#app/utils/db.server.ts')
			const { getSignedGetRequestInfo } = await import(
				'#app/utils/storage.server.ts'
			)

			const mockStudent = {
				id: 'stu123',
				email: 'student@jpgacademy.org',
				fullName: 'Test Student',
				status: 'active',
				sisStudentId: 'SIS456',
				grade: '10',
				studentId: {
					id: 'sid123',
					photoUrl: 'students/stu456/photos/photo.jpg',
					expirationDate: new Date('2025-07-01'),
				},
			}

			vi.mocked(prisma.student.findMany).mockResolvedValue([mockStudent])

			// Mock storage to return photo data
			vi.mocked(getSignedGetRequestInfo).mockReturnValue({
				url: 'https://storage.example.com/photo.jpg',
				headers: {},
			})

			// Mock fetch for photo
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () =>
					Promise.resolve(new TextEncoder().encode('fake-image-data').buffer),
			})

			// Mock Google Admin SDK
			const mockUpdate = vi.fn().mockResolvedValue({ data: {} })
			vi.mocked(google.admin).mockReturnValue({
				users: {
					photos: {
						update: mockUpdate,
					},
				},
			} as any)

			// Execute
			const { syncPhotosToGoogle } = await import('./sync-google-photos.js')
			const result = await syncPhotosToGoogle({
				employeesOnly: false,
				studentsOnly: true,
				dryRun: false,
			})

			// Verify behavior: student was updated
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				email: mockStudent.email,
				success: true,
				action: 'updated',
			})

			// Verify Google API was called with photo data
			expect(mockUpdate).toHaveBeenCalledWith({
				userKey: mockStudent.email,
				resource: {
					photoData: expect.any(String), // Base64 encoded photo
				},
			})
		})
	})

	describe('Error handling', () => {
		it('handles Google user not found', async () => {
			// Setup: Mock employee with photo
			const { prisma } = await import('#app/utils/db.server.ts')
			const { getSignedGetRequestInfo } = await import(
				'#app/utils/storage.server.ts'
			)

			const mockEmployee = {
				id: 'emp123',
				email: 'nonexistent@jpgacademy.org',
				fullName: 'Nonexistent User',
				jobTitle: 'Teacher',
				status: 'active',
				sisEmployeeId: 'SIS123',
				employeeId: {
					id: 'eid123',
					photoUrl: 'employees/test123/photos/photo.jpg',
					expirationDate: new Date('2025-07-01'),
				},
			}

			vi.mocked(prisma.employee.findMany).mockResolvedValue([mockEmployee])

			// Mock storage
			vi.mocked(getSignedGetRequestInfo).mockReturnValue({
				url: 'https://storage.example.com/photo.jpg',
				headers: {},
			})

			// Mock fetch for photo
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () =>
					Promise.resolve(new TextEncoder().encode('fake-image-data').buffer),
			})

			// Mock Google API to return "not found" error
			const mockUpdate = vi.fn().mockRejectedValue({
				response: {
					status: 404,
					data: {
						error: {
							message: 'User not found',
						},
					},
				},
			})
			vi.mocked(google.admin).mockReturnValue({
				users: {
					photos: {
						update: mockUpdate,
					},
				},
			} as any)

			// Execute
			const { syncPhotosToGoogle } = await import('./sync-google-photos.js')
			const result = await syncPhotosToGoogle({
				employeesOnly: true,
				studentsOnly: false,
				dryRun: false,
			})

			// Verify behavior: failed but continued processing
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				email: mockEmployee.email,
				success: false,
				action: 'failed',
				error: expect.any(String),
			})
		})

		it('handles photo fetch failure', async () => {
			// Setup: Mock employee with photo
			const { prisma } = await import('#app/utils/db.server.ts')
			const { getSignedGetRequestInfo } = await import(
				'#app/utils/storage.server.ts'
			)

			const mockEmployee = {
				id: 'emp123',
				email: 'teacher@jpgacademy.org',
				fullName: 'Test Teacher',
				jobTitle: 'Teacher',
				status: 'active',
				sisEmployeeId: 'SIS123',
				employeeId: {
					id: 'eid123',
					photoUrl: 'employees/test123/photos/photo.jpg',
					expirationDate: new Date('2025-07-01'),
				},
			}

			vi.mocked(prisma.employee.findMany).mockResolvedValue([mockEmployee])

			// Mock storage
			vi.mocked(getSignedGetRequestInfo).mockReturnValue({
				url: 'https://storage.example.com/photo.jpg',
				headers: {},
			})

			// Mock fetch to fail
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				statusText: 'Not Found',
			})

			// Mock Google API
			const mockUpdate = vi.fn().mockResolvedValue({ data: {} })
			vi.mocked(google.admin).mockReturnValue({
				users: {
					photos: {
						update: mockUpdate,
					},
				},
			} as any)

			// Execute
			const { syncPhotosToGoogle } = await import('./sync-google-photos.js')
			const result = await syncPhotosToGoogle({
				employeesOnly: true,
				studentsOnly: false,
				dryRun: false,
			})

			// Verify behavior: failed but continued processing
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				email: mockEmployee.email,
				success: false,
				action: 'failed',
				error: expect.stringContaining('Failed to fetch photo'),
			})

			// Verify Google API was NOT called
			expect(mockUpdate).not.toHaveBeenCalled()
		})
	})

	describe('Dry-run mode', () => {
		it('reports what would be updated without actually updating', async () => {
			// Setup: Mock employee with photo
			const { prisma } = await import('#app/utils/db.server.ts')
			const { getSignedGetRequestInfo } = await import(
				'#app/utils/storage.server.ts'
			)

			const mockEmployee = {
				id: 'emp123',
				email: 'teacher@jpgacademy.org',
				fullName: 'Test Teacher',
				jobTitle: 'Teacher',
				status: 'active',
				sisEmployeeId: 'SIS123',
				employeeId: {
					id: 'eid123',
					photoUrl: 'employees/test123/photos/photo.jpg',
					expirationDate: new Date('2025-07-01'),
				},
			}

			vi.mocked(prisma.employee.findMany).mockResolvedValue([mockEmployee])

			// Mock storage
			vi.mocked(getSignedGetRequestInfo).mockReturnValue({
				url: 'https://storage.example.com/photo.jpg',
				headers: {},
			})

			// Mock fetch for photo
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () =>
					Promise.resolve(new TextEncoder().encode('fake-image-data').buffer),
			})

			// Mock Google API
			const mockUpdate = vi.fn().mockResolvedValue({ data: {} })
			vi.mocked(google.admin).mockReturnValue({
				users: {
					photos: {
						update: mockUpdate,
					},
				},
			} as any)

			// Execute with dry-run
			const { syncPhotosToGoogle } = await import('./sync-google-photos.js')
			const result = await syncPhotosToGoogle({
				employeesOnly: true,
				studentsOnly: false,
				dryRun: true, // DRY RUN MODE
			})

			// Verify behavior: reports as updated
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				email: mockEmployee.email,
				success: true,
				action: 'updated',
			})

			// Verify Google API was NOT called (dry-run)
			expect(mockUpdate).not.toHaveBeenCalled()
		})
	})

	describe('Email filtering', () => {
		it('filters by email address', async () => {
			// Setup: Mock multiple employees
			const { prisma } = await import('#app/utils/db.server.ts')
			const { getSignedGetRequestInfo } = await import(
				'#app/utils/storage.server.ts'
			)

			const mockEmployee = {
				id: 'emp1',
				email: 'teacher1@jpgacademy.org',
				fullName: 'Teacher One',
				jobTitle: 'Teacher',
				status: 'active',
				sisEmployeeId: 'SIS1',
				employeeId: {
					id: 'eid1',
					photoUrl: 'employees/1/photos/photo.jpg',
					expirationDate: new Date('2025-07-01'),
				},
			}

			// Mock to return only the filtered employee
			vi.mocked(prisma.employee.findMany).mockResolvedValue([mockEmployee])

			// Mock storage
			vi.mocked(getSignedGetRequestInfo).mockReturnValue({
				url: 'https://storage.example.com/photo.jpg',
				headers: {},
			})

			// Mock fetch
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: () =>
					Promise.resolve(new TextEncoder().encode('fake-image-data').buffer),
			})

			// Mock Google API
			const mockUpdate = vi.fn().mockResolvedValue({ data: {} })
			vi.mocked(google.admin).mockReturnValue({
				users: {
					photos: {
						update: mockUpdate,
					},
				},
			} as any)

			// Execute with email filter
			const { syncPhotosToGoogle } = await import('./sync-google-photos.js')
			const result = await syncPhotosToGoogle({
				employeesOnly: true,
				studentsOnly: false,
				dryRun: false,
				email: 'teacher1@jpgacademy.org', // Filter by email
			})

			// Verify behavior: only filtered user was processed
			expect(result).toHaveLength(1)
			expect(result[0].email).toBe('teacher1@jpgacademy.org')

			// Verify database query was filtered
			expect(prisma.employee.findMany).toHaveBeenCalledWith({
				where: { email: 'teacher1@jpgacademy.org' },
				include: { employeeId: true },
			})
		})
	})
})
