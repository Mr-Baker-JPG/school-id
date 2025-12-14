import { describe, it, expect } from 'vitest'
import {
	isIOSDevice,
	isAndroidDevice,
	getDeviceType,
	getDeviceTypeFromRequest,
} from './device-detection.server.ts'

describe('device-detection.server', () => {
	describe('isIOSDevice', () => {
		it('should return true for iPhone user agent', () => {
			expect(
				isIOSDevice(
					'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
				),
			).toBe(true)
		})

		it('should return true for iPad user agent', () => {
			expect(
				isIOSDevice(
					'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
				),
			).toBe(true)
		})

		it('should return true for iPod user agent', () => {
			expect(
				isIOSDevice(
					'Mozilla/5.0 (iPod; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
				),
			).toBe(true)
		})

		it('should return false for Android user agent', () => {
			expect(
				isIOSDevice('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36'),
			).toBe(false)
		})

		it('should return false for desktop user agent', () => {
			expect(
				isIOSDevice(
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				),
			).toBe(false)
		})

		it('should return false for null user agent', () => {
			expect(isIOSDevice(null)).toBe(false)
		})
	})

	describe('isAndroidDevice', () => {
		it('should return true for Android user agent', () => {
			expect(
				isAndroidDevice('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36'),
			).toBe(true)
		})

		it('should return true for Android Chrome user agent', () => {
			expect(
				isAndroidDevice(
					'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36',
				),
			).toBe(true)
		})

		it('should return false for iPhone user agent', () => {
			expect(
				isAndroidDevice(
					'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
				),
			).toBe(false)
		})

		it('should return false for desktop user agent', () => {
			expect(
				isAndroidDevice(
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				),
			).toBe(false)
		})

		it('should return false for null user agent', () => {
			expect(isAndroidDevice(null)).toBe(false)
		})
	})

	describe('getDeviceType', () => {
		it('should return "ios" for iPhone user agent', () => {
			expect(
				getDeviceType(
					'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
				),
			).toBe('ios')
		})

		it('should return "android" for Android user agent', () => {
			expect(
				getDeviceType('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36'),
			).toBe('android')
		})

		it('should return "unknown" for desktop user agent', () => {
			expect(
				getDeviceType(
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				),
			).toBe('unknown')
		})

		it('should return "unknown" for null user agent', () => {
			expect(getDeviceType(null)).toBe('unknown')
		})
	})

	describe('getDeviceTypeFromRequest', () => {
		it('should return "ios" for iPhone request', () => {
			const request = new Request('https://example.com', {
				headers: {
					'user-agent':
						'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
				},
			})
			expect(getDeviceTypeFromRequest(request)).toBe('ios')
		})

		it('should return "android" for Android request', () => {
			const request = new Request('https://example.com', {
				headers: {
					'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
				},
			})
			expect(getDeviceTypeFromRequest(request)).toBe('android')
		})

		it('should return "unknown" for request without user agent', () => {
			const request = new Request('https://example.com')
			expect(getDeviceTypeFromRequest(request)).toBe('unknown')
		})
	})
})

