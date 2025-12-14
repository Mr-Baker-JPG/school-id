import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getBrandingConfig } from './branding.server.ts'

describe('getBrandingConfig', () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Reset environment variables
		process.env = { ...originalEnv }
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it('returns default values when no environment variables are set', () => {
		delete process.env.SCHOOL_NAME
		delete process.env.SCHOOL_BRAND_NAME
		delete process.env.SCHOOL_LOGO_URL
		delete process.env.SCHOOL_PRIMARY_COLOR
		delete process.env.SCHOOL_SECONDARY_COLOR

		const config = getBrandingConfig()

		// Should use SCHOOL_NAME from brand.ts as fallback
		expect(config.schoolName).toBe('John Paul the Great Academy')
		expect(config.logoUrl).toBeUndefined()
		expect(config.primaryColor).toBe('#1a1a1a')
		expect(config.secondaryColor).toBe('#ffffff')
	})

	it('uses SCHOOL_NAME when set', () => {
		process.env.SCHOOL_NAME = 'My School'

		const config = getBrandingConfig()

		expect(config.schoolName).toBe('My School')
	})

	it('uses SCHOOL_BRAND_NAME as fallback when SCHOOL_NAME is not set', () => {
		delete process.env.SCHOOL_NAME
		process.env.SCHOOL_BRAND_NAME = 'Brand Name'

		const config = getBrandingConfig()

		expect(config.schoolName).toBe('Brand Name')
	})

	it('falls back to brand.ts SCHOOL_NAME when environment variables are not set', () => {
		delete process.env.SCHOOL_NAME
		delete process.env.SCHOOL_BRAND_NAME

		const config = getBrandingConfig()

		// Should use SCHOOL_NAME from brand.ts
		expect(config.schoolName).toBe('John Paul the Great Academy')
	})

	it('prefers SCHOOL_NAME over SCHOOL_BRAND_NAME', () => {
		process.env.SCHOOL_NAME = 'School Name'
		process.env.SCHOOL_BRAND_NAME = 'Brand Name'

		const config = getBrandingConfig()

		expect(config.schoolName).toBe('School Name')
	})

	it('uses SCHOOL_LOGO_URL when set', () => {
		process.env.SCHOOL_LOGO_URL = 'https://example.com/logo.png'

		const config = getBrandingConfig()

		expect(config.logoUrl).toBe('https://example.com/logo.png')
	})

	it('uses SCHOOL_PRIMARY_COLOR when set', () => {
		process.env.SCHOOL_PRIMARY_COLOR = '#ff0000'

		const config = getBrandingConfig()

		expect(config.primaryColor).toBe('#ff0000')
	})

	it('uses SCHOOL_SECONDARY_COLOR when set', () => {
		process.env.SCHOOL_SECONDARY_COLOR = '#00ff00'

		const config = getBrandingConfig()

		expect(config.secondaryColor).toBe('#00ff00')
	})

	it('returns all configured values', () => {
		process.env.SCHOOL_NAME = 'Test School'
		process.env.SCHOOL_LOGO_URL = 'https://example.com/logo.png'
		process.env.SCHOOL_PRIMARY_COLOR = '#123456'
		process.env.SCHOOL_SECONDARY_COLOR = '#abcdef'

		const config = getBrandingConfig()

		expect(config).toEqual({
			schoolName: 'Test School',
			logoUrl: 'https://example.com/logo.png',
			primaryColor: '#123456',
			secondaryColor: '#abcdef',
		})
	})
})

