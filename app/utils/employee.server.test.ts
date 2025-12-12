import { expect, test } from 'vitest'
import { getDefaultExpirationDate } from './employee.server.ts'

test('getDefaultExpirationDate returns July 1 of current year', () => {
	const expirationDate = getDefaultExpirationDate()
	const now = new Date()
	const currentYear = now.getFullYear()

	expect(expirationDate.getFullYear()).toBe(currentYear)
	expect(expirationDate.getMonth()).toBe(6) // July is month 6 (0-indexed)
	expect(expirationDate.getDate()).toBe(1)
})

test('getDefaultExpirationDate returns valid date', () => {
	const expirationDate = getDefaultExpirationDate()
	expect(expirationDate instanceof Date).toBe(true)
	expect(isNaN(expirationDate.getTime())).toBe(false)
})
