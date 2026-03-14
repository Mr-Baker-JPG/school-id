import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getBrandingConfig, brandingFromSchoolConfig } from './branding.server.ts'
import { type SchoolConfig } from './school-config.server.ts'

// Mock the school-config module
vi.mock('./school-config.server.ts', () => ({
	getSchoolConfig: vi.fn(),
}))

const { getSchoolConfig } = await import('./school-config.server.ts')
const mockGetSchoolConfig = vi.mocked(getSchoolConfig)

const DEFAULT_CONFIG: SchoolConfig = {
	schoolName: 'Your School',
	schoolShortName: 'School',
	addressLine1: '',
	addressLine2: '',
	phone: '',
	emailDomain: '',
	logoUrl: '/img/placeholder-logo.png',
	crestUrl: '/img/placeholder-crest.png',
	primaryColor: '#1B2A4A',
	secondaryColor: '#8B1A2B',
	accentColor: '#F5F0E8',
	schoolWebsite: '',
	googleEnabled: false,
}

describe('getBrandingConfig', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('returns default values when no config is set', async () => {
		mockGetSchoolConfig.mockResolvedValue(DEFAULT_CONFIG)

		const config = await getBrandingConfig()

		expect(config.schoolName).toBe('Your School')
		expect(config.primaryColor).toBe('#1B2A4A')
		expect(config.secondaryColor).toBe('#8B1A2B')
		expect(config.accentColor).toBe('#F5F0E8')
	})

	it('returns configured school name', async () => {
		mockGetSchoolConfig.mockResolvedValue({
			...DEFAULT_CONFIG,
			schoolName: 'Test Academy',
		})

		const config = await getBrandingConfig()

		expect(config.schoolName).toBe('Test Academy')
	})

	it('returns configured branding colors', async () => {
		mockGetSchoolConfig.mockResolvedValue({
			...DEFAULT_CONFIG,
			primaryColor: '#ff0000',
			secondaryColor: '#00ff00',
			accentColor: '#0000ff',
		})

		const config = await getBrandingConfig()

		expect(config.primaryColor).toBe('#ff0000')
		expect(config.secondaryColor).toBe('#00ff00')
		expect(config.accentColor).toBe('#0000ff')
	})

	it('returns address and contact info', async () => {
		mockGetSchoolConfig.mockResolvedValue({
			...DEFAULT_CONFIG,
			addressLine1: '123 Main St',
			addressLine2: 'City, ST 12345',
			phone: '555-1234',
		})

		const config = await getBrandingConfig()

		expect(config.addressLine1).toBe('123 Main St')
		expect(config.addressLine2).toBe('City, ST 12345')
		expect(config.phone).toBe('555-1234')
	})
})

describe('brandingFromSchoolConfig', () => {
	it('maps SchoolConfig to BrandingConfig correctly', () => {
		const schoolConfig: SchoolConfig = {
			...DEFAULT_CONFIG,
			schoolName: 'Test School',
			logoUrl: 'https://example.com/logo.png',
			primaryColor: '#123456',
			secondaryColor: '#abcdef',
			accentColor: '#fedcba',
			addressLine1: '456 Elm St',
			addressLine2: 'Town, ST 67890',
			phone: '555-9876',
			schoolWebsite: 'https://test.school',
		}

		const branding = brandingFromSchoolConfig(schoolConfig)

		expect(branding).toEqual({
			schoolName: 'Test School',
			logoUrl: 'https://example.com/logo.png',
			primaryColor: '#123456',
			secondaryColor: '#abcdef',
			accentColor: '#fedcba',
			addressLine1: '456 Elm St',
			addressLine2: 'Town, ST 67890',
			phone: '555-9876',
			schoolWebsite: 'https://test.school',
		})
	})
})
