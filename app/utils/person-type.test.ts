import { describe, it, expect } from 'vitest'
import { getEmployeePersonType } from './person-type.ts'

describe('getEmployeePersonType', () => {
	it('returns FACULTY for Upper School department', () => {
		expect(getEmployeePersonType('Upper School')).toBe('FACULTY')
	})

	it('returns FACULTY for Lower School department', () => {
		expect(getEmployeePersonType('Lower School')).toBe('FACULTY')
	})

	it('returns FACULTY for Preschool department', () => {
		expect(getEmployeePersonType('Preschool')).toBe('FACULTY')
	})

	it('returns STAFF for Administrator department', () => {
		expect(getEmployeePersonType('Administrator')).toBe('STAFF')
	})

	it('returns STAFF for Staff department', () => {
		expect(getEmployeePersonType('Staff')).toBe('STAFF')
	})

	it('returns FACULTY for legacy values containing "faculty"', () => {
		expect(getEmployeePersonType('Faculty')).toBe('FACULTY')
		expect(getEmployeePersonType('Faculty/Staff')).toBe('FACULTY')
	})

	it('returns STAFF as default for empty or undefined department', () => {
		expect(getEmployeePersonType('')).toBe('STAFF')
		expect(getEmployeePersonType(undefined)).toBe('STAFF')
		expect(getEmployeePersonType(null)).toBe('STAFF')
	})

	it('returns STAFF for unknown department values', () => {
		expect(getEmployeePersonType('Administration')).toBe('STAFF')
		expect(getEmployeePersonType('Maintenance')).toBe('STAFF')
	})
})
