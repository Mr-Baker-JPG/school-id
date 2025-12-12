import { describe, expect, test } from 'vitest'
import { getVerificationStatus } from './verification.server.ts'

describe('getVerificationStatus', () => {
	test('Valid status returned for active employee with future expiration', () => {
		const futureDate = new Date()
		futureDate.setFullYear(futureDate.getFullYear() + 1)

		const status = getVerificationStatus('active', futureDate)

		expect(status.isValid).toBe(true)
		expect(status.reason).toBe('Valid ID')
	})

	test('Invalid status returned for inactive employee', () => {
		const futureDate = new Date()
		futureDate.setFullYear(futureDate.getFullYear() + 1)

		const status = getVerificationStatus('inactive', futureDate)

		expect(status.isValid).toBe(false)
		expect(status.reason).toBe('Employee is not active')
	})

	test('Invalid status returned for expired ID (past expiration date)', () => {
		const pastDate = new Date()
		pastDate.setFullYear(pastDate.getFullYear() - 1)

		const status = getVerificationStatus('active', pastDate)

		expect(status.isValid).toBe(false)
		expect(status.reason).toBe('ID has expired')
	})

	test('Invalid status returned when expiration date is null', () => {
		const status = getVerificationStatus('active', null)

		expect(status.isValid).toBe(false)
		expect(status.reason).toBe('Expiration date not set')
	})

	test('Status calculation uses current date correctly', () => {
		// Test with a specific current date
		const currentDate = new Date('2024-06-15')
		const expirationDate = new Date('2024-07-01')

		// Should be valid (expiration is in the future)
		const status1 = getVerificationStatus('active', expirationDate, currentDate)
		expect(status1.isValid).toBe(true)

		// Test with expiration date in the past
		const pastExpiration = new Date('2024-06-01')
		const status2 = getVerificationStatus('active', pastExpiration, currentDate)
		expect(status2.isValid).toBe(false)
		expect(status2.reason).toBe('ID has expired')

		// Test with expiration date exactly on current date (should be valid)
		const sameDate = new Date('2024-06-15')
		const status3 = getVerificationStatus('active', sameDate, currentDate)
		expect(status3.isValid).toBe(true)
	})

	test('Handles edge case: expiration date exactly on current date', () => {
		const currentDate = new Date('2024-07-01T12:00:00Z')
		const expirationDate = new Date('2024-07-01T12:00:00Z')

		const status = getVerificationStatus('active', expirationDate, currentDate)

		// Should be valid (current date <= expiration date)
		expect(status.isValid).toBe(true)
	})

	test('Handles edge case: expiration date one day before current date', () => {
		const currentDate = new Date('2024-07-02T12:00:00Z')
		const expirationDate = new Date('2024-07-01T12:00:00Z')

		const status = getVerificationStatus('active', expirationDate, currentDate)

		expect(status.isValid).toBe(false)
		expect(status.reason).toBe('ID has expired')
	})

	test('Handles different status values', () => {
		const futureDate = new Date()
		futureDate.setFullYear(futureDate.getFullYear() + 1)

		// Test with 'active' (should be valid)
		const activeStatus = getVerificationStatus('active', futureDate)
		expect(activeStatus.isValid).toBe(true)

		// Test with 'inactive' (should be invalid)
		const inactiveStatus = getVerificationStatus('inactive', futureDate)
		expect(inactiveStatus.isValid).toBe(false)

		// Test with empty string (should be invalid)
		const emptyStatus = getVerificationStatus('', futureDate)
		expect(emptyStatus.isValid).toBe(false)

		// Test with any other value (should be invalid)
		const otherStatus = getVerificationStatus('pending', futureDate)
		expect(otherStatus.isValid).toBe(false)
	})
})
