import { describe, it, expect } from 'vitest'
import { getEmployeePersonType } from './person-type.ts'

describe('getEmployeePersonType', () => {
	it('returns FACULTY when job title contains "Faculty"', () => {
		expect(getEmployeePersonType('Faculty')).toBe('FACULTY')
	})

	it('returns STAFF when job title contains "Staff" but not "Faculty"', () => {
		expect(getEmployeePersonType('Staff')).toBe('STAFF')
	})

	it('returns STAFF for Administration and other titles', () => {
		expect(getEmployeePersonType('Administration')).toBe('STAFF')
		expect(getEmployeePersonType('Chief Accountability Producer')).toBe('STAFF')
	})

	it('returns FACULTY when both Faculty and Staff appear (faculty takes precedence)', () => {
		expect(getEmployeePersonType('Faculty/Staff')).toBe('FACULTY')
		expect(getEmployeePersonType('Faculty and Staff')).toBe('FACULTY')
	})

	it('matches case-insensitively', () => {
		expect(getEmployeePersonType('faculty')).toBe('FACULTY')
		expect(getEmployeePersonType('FACULTY')).toBe('FACULTY')
		expect(getEmployeePersonType('staff')).toBe('STAFF')
		expect(getEmployeePersonType('STAFF')).toBe('STAFF')
	})

	it('returns STAFF as default for empty or undefined job title', () => {
		expect(getEmployeePersonType('')).toBe('STAFF')
		expect(getEmployeePersonType(undefined)).toBe('STAFF')
		expect(getEmployeePersonType(null)).toBe('STAFF')
	})
})
