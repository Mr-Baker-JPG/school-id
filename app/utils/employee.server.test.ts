import { faker } from '@faker-js/faker'
import { describe, expect, test, beforeEach, vi } from 'vitest'
import { prisma } from './db.server.ts'
import {
	getDefaultExpirationDate,
	fetchAndCacheFactsProfilePicture,
} from './employee.server.ts'
import * as factsApi from './facts-api.server.ts'
import * as storage from './storage.server.ts'

describe('Employee Server Utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Set mock environment variables for testing
		process.env.FACTS_SUBSCRIPTION_KEY = 'MOCK_SUBSCRIPTION_KEY'
		process.env.FACTS_API_KEY = 'MOCK_API_KEY'
		process.env.FACTS_BASE_URL = 'https://api.factsmgt.com'
	})

	describe('getDefaultExpirationDate', () => {
		test('returns July 1 of current year', () => {
			const expirationDate = getDefaultExpirationDate()
			const now = new Date()
			const currentYear = now.getFullYear()

			expect(expirationDate.getFullYear()).toBe(currentYear)
			expect(expirationDate.getMonth()).toBe(6) // July is month 6 (0-indexed)
			expect(expirationDate.getDate()).toBe(1)
		})

		test('returns valid date', () => {
			const expirationDate = getDefaultExpirationDate()
			expect(expirationDate instanceof Date).toBe(true)
			expect(isNaN(expirationDate.getTime())).toBe(false)
		})
	})

	describe('fetchAndCacheFactsProfilePicture', () => {
		let fetchProfilePictureSpy: ReturnType<typeof vi.spyOn>
		let uploadEmployeePhotoSpy: ReturnType<typeof vi.spyOn>

		beforeEach(() => {
			fetchProfilePictureSpy = vi.spyOn(factsApi, 'fetchProfilePicture')
			uploadEmployeePhotoSpy = vi.spyOn(storage, 'uploadEmployeePhoto')
		})

		async function createEmployee(data?: {
			sisEmployeeId?: string
			hasPhoto?: boolean
		}) {
			const employee = await prisma.employee.create({
				data: {
					sisEmployeeId: data?.sisEmployeeId ?? '123',
					fullName: faker.person.fullName(),
					jobTitle: faker.person.jobTitle(),
					email: faker.internet.email(),
					status: 'active',
					employeeId: data?.hasPhoto
						? {
								create: {
									photoUrl: 'employees/test/uploaded-photo.jpg',
									expirationDate: getDefaultExpirationDate(),
								},
							}
						: undefined,
				},
				select: {
					id: true,
					sisEmployeeId: true,
				},
			})

			return employee
		}

		test('Service function caches fetched FACTS photo to storage and updates EmployeeID record', async () => {
			const employee = await createEmployee({ sisEmployeeId: '456' })
			const mockImageBuffer = Buffer.from('fake-image-data')
			const mockObjectKey = 'employees/test/facts-photo.jpg'

			fetchProfilePictureSpy.mockResolvedValue(mockImageBuffer)
			uploadEmployeePhotoSpy.mockResolvedValue(mockObjectKey)

			const result = await fetchAndCacheFactsProfilePicture(
				employee.id,
				employee.sisEmployeeId,
			)

			expect(result).toBe(mockObjectKey)
			expect(fetchProfilePictureSpy).toHaveBeenCalledWith(456)
			expect(uploadEmployeePhotoSpy).toHaveBeenCalled()

			// Verify EmployeeID record was updated
			const employeeId = await prisma.employeeID.findUnique({
				where: { employeeId: employee.id },
				select: { photoUrl: true },
			})

			expect(employeeId?.photoUrl).toBe(mockObjectKey)

			// Cleanup
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Photo fetching logic prioritizes uploaded photo over FACTS photo', async () => {
			const employee = await createEmployee({
				sisEmployeeId: '789',
				hasPhoto: true,
			})

			const result = await fetchAndCacheFactsProfilePicture(
				employee.id,
				employee.sisEmployeeId,
			)

			expect(result).toBeNull()
			expect(fetchProfilePictureSpy).not.toHaveBeenCalled()
			expect(uploadEmployeePhotoSpy).not.toHaveBeenCalled()

			// Cleanup
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Returns null when FACTS API returns null (no profile picture)', async () => {
			const employee = await createEmployee({ sisEmployeeId: '999' })

			fetchProfilePictureSpy.mockResolvedValue(null)

			const result = await fetchAndCacheFactsProfilePicture(
				employee.id,
				employee.sisEmployeeId,
			)

			expect(result).toBeNull()
			expect(fetchProfilePictureSpy).toHaveBeenCalledWith(999)
			expect(uploadEmployeePhotoSpy).not.toHaveBeenCalled()

			// Cleanup
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Returns null when FACTS API call fails', async () => {
			const employee = await createEmployee({ sisEmployeeId: '888' })

			fetchProfilePictureSpy.mockResolvedValue(null)

			const result = await fetchAndCacheFactsProfilePicture(
				employee.id,
				employee.sisEmployeeId,
			)

			expect(result).toBeNull()
			expect(uploadEmployeePhotoSpy).not.toHaveBeenCalled()

			// Cleanup
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Returns null when storage upload fails', async () => {
			const employee = await createEmployee({ sisEmployeeId: '777' })
			const mockImageBuffer = Buffer.from('fake-image-data')
			const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

			fetchProfilePictureSpy.mockResolvedValue(mockImageBuffer)
			uploadEmployeePhotoSpy.mockRejectedValue(
				new Error('Storage upload failed'),
			)

			const result = await fetchAndCacheFactsProfilePicture(
				employee.id,
				employee.sisEmployeeId,
			)

			expect(result).toBeNull()
			expect(fetchProfilePictureSpy).toHaveBeenCalledWith(777)
			expect(uploadEmployeePhotoSpy).toHaveBeenCalled()
			expect(consoleWarn).toHaveBeenCalled()
			consoleWarn.mockRestore()

			// Cleanup
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Handles invalid sisEmployeeId gracefully', async () => {
			const employee = await createEmployee({ sisEmployeeId: 'invalid' })
			const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

			const result = await fetchAndCacheFactsProfilePicture(
				employee.id,
				employee.sisEmployeeId,
			)

			expect(result).toBeNull()
			expect(fetchProfilePictureSpy).not.toHaveBeenCalled()
			expect(uploadEmployeePhotoSpy).not.toHaveBeenCalled()
			expect(consoleWarn).toHaveBeenCalled()
			consoleWarn.mockRestore()

			// Cleanup
			await prisma.employee.delete({ where: { id: employee.id } })
		})

		test('Creates EmployeeID record if it does not exist', async () => {
			const employee = await createEmployee({ sisEmployeeId: '555' })
			const mockImageBuffer = Buffer.from('fake-image-data')
			const mockObjectKey = 'employees/test/facts-photo.jpg'

			fetchProfilePictureSpy.mockResolvedValue(mockImageBuffer)
			uploadEmployeePhotoSpy.mockResolvedValue(mockObjectKey)

			const result = await fetchAndCacheFactsProfilePicture(
				employee.id,
				employee.sisEmployeeId,
			)

			expect(result).toBe(mockObjectKey)

			// Verify EmployeeID record was created
			const employeeId = await prisma.employeeID.findUnique({
				where: { employeeId: employee.id },
				select: { photoUrl: true, expirationDate: true },
			})

			expect(employeeId).toBeDefined()
			expect(employeeId?.photoUrl).toBe(mockObjectKey)
			expect(employeeId?.expirationDate).toBeDefined()

			// Cleanup
			await prisma.employee.delete({ where: { id: employee.id } })
		})
	})
})
