import { describe, it, expect } from 'vitest'
import { getFirstAndLastName, getFirstTwoNames } from './misc.tsx'

describe('getFirstAndLastName', () => {
	it('returns empty string for empty input', () => {
		expect(getFirstAndLastName('')).toBe('')
		expect(getFirstAndLastName('   ')).toBe('')
	})

	it('returns single name unchanged', () => {
		expect(getFirstAndLastName('John')).toBe('John')
	})

	it('returns first and last name for two-part names', () => {
		expect(getFirstAndLastName('John Smith')).toBe('John Smith')
	})

	it('skips middle names (space-separated)', () => {
		expect(getFirstAndLastName('Mary Jane Watson Smith')).toBe('Mary Smith')
		expect(getFirstAndLastName('John Michael Doe')).toBe('John Doe')
	})

	it('handles comma-separated format (Last, First)', () => {
		expect(getFirstAndLastName('Smith, John')).toBe('John Smith')
		expect(getFirstAndLastName('Smith, Mary Jane')).toBe('Mary Smith')
	})

	it('trims whitespace', () => {
		expect(getFirstAndLastName('  John Smith  ')).toBe('John Smith')
	})
})

describe('getFirstTwoNames', () => {
	it('returns empty string for empty input', () => {
		expect(getFirstTwoNames('')).toBe('')
		expect(getFirstTwoNames('   ')).toBe('')
	})

	it('returns single name unchanged', () => {
		expect(getFirstTwoNames('John')).toBe('John')
	})

	it('returns first and last name for two-part names', () => {
		expect(getFirstTwoNames('John Smith')).toBe('John Smith')
	})

	it('returns first two names for multi-part names (space-separated)', () => {
		// This is the key behavior for ID cards
		expect(getFirstTwoNames('Mary Jane Watson Smith')).toBe('Mary Jane')
		expect(getFirstTwoNames('John Michael Doe')).toBe('John Michael')
		expect(getFirstTwoNames('Ana Maria Garcia Lopez')).toBe('Ana Maria')
	})

	it('returns first two names after comma (comma-separated format)', () => {
		expect(getFirstTwoNames('Smith, Mary Jane')).toBe('Mary Jane')
		expect(getFirstTwoNames('Doe, John Michael')).toBe('John Michael')
	})

	it('returns first name only if only one name after comma', () => {
		expect(getFirstTwoNames('Smith, Mary')).toBe('Mary')
	})

	it('trims whitespace', () => {
		expect(getFirstTwoNames('  Mary Jane Watson Smith  ')).toBe('Mary Jane')
	})
})
