import { describe, expect, test, afterEach } from 'vitest'
import {
	validateEmailDomain,
	getAllowedEmailDomain,
} from './email-domain-validation.server.ts'

describe('Email Domain Validation', () => {
	const originalEnv = {
		SCHOOL_EMAIL_DOMAIN: process.env.SCHOOL_EMAIL_DOMAIN,
	}

	afterEach(() => {
		// Restore original env values
		process.env.SCHOOL_EMAIL_DOMAIN = originalEnv.SCHOOL_EMAIL_DOMAIN
	})

	test('Only school email domain users can authenticate when domain is configured', () => {
		process.env.SCHOOL_EMAIL_DOMAIN = 'school.edu'
		expect(validateEmailDomain('user@school.edu')).toBe(true)
		expect(validateEmailDomain('teacher@school.edu')).toBe(true)
		expect(validateEmailDomain('admin@school.edu')).toBe(true)
	})

	test('Non-school email users are rejected when domain is configured', () => {
		process.env.SCHOOL_EMAIL_DOMAIN = 'school.edu'
		expect(validateEmailDomain('user@example.com')).toBe(false)
		expect(validateEmailDomain('user@gmail.com')).toBe(false)
		expect(validateEmailDomain('user@other-school.edu')).toBe(false)
	})

	test('All emails are allowed when no domain restriction is configured', () => {
		delete process.env.SCHOOL_EMAIL_DOMAIN
		expect(validateEmailDomain('user@example.com')).toBe(true)
		expect(validateEmailDomain('user@gmail.com')).toBe(true)
		expect(validateEmailDomain('user@school.edu')).toBe(true)
	})

	test('Email domain validation is case-insensitive', () => {
		process.env.SCHOOL_EMAIL_DOMAIN = 'School.Edu'
		expect(validateEmailDomain('user@school.edu')).toBe(true)
		expect(validateEmailDomain('user@SCHOOL.EDU')).toBe(true)
		expect(validateEmailDomain('user@School.Edu')).toBe(true)
	})

	test('Email validation handles mixed case emails correctly', () => {
		process.env.SCHOOL_EMAIL_DOMAIN = 'school.edu'
		expect(validateEmailDomain('User@School.Edu')).toBe(true)
		expect(validateEmailDomain('USER@SCHOOL.EDU')).toBe(true)
		expect(validateEmailDomain('user@school.edu')).toBe(true)
	})

	test('getAllowedEmailDomain returns configured domain', () => {
		process.env.SCHOOL_EMAIL_DOMAIN = 'school.edu'
		expect(getAllowedEmailDomain()).toBe('school.edu')
	})

	test('getAllowedEmailDomain returns null when not configured', () => {
		delete process.env.SCHOOL_EMAIL_DOMAIN
		expect(getAllowedEmailDomain()).toBeNull()
	})
})


