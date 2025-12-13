/**
 * Device Detection Utilities
 * 
 * Detects device type (iOS, Android, etc.) from user agent strings
 * for wallet pass generation
 */

/**
 * Detects if the user agent is from an iOS device
 */
export function isIOSDevice(userAgent: string | null): boolean {
	if (!userAgent) return false
	return /iPhone|iPad|iPod/i.test(userAgent)
}

/**
 * Detects if the user agent is from an Android device
 */
export function isAndroidDevice(userAgent: string | null): boolean {
	if (!userAgent) return false
	return /Android/i.test(userAgent)
}

/**
 * Gets the device type from a user agent string
 * @returns 'ios', 'android', or 'unknown'
 */
export function getDeviceType(userAgent: string | null): 'ios' | 'android' | 'unknown' {
	if (isIOSDevice(userAgent)) return 'ios'
	if (isAndroidDevice(userAgent)) return 'android'
	return 'unknown'
}

/**
 * Gets the device type from a Request object
 * @returns 'ios', 'android', or 'unknown'
 */
export function getDeviceTypeFromRequest(request: Request): 'ios' | 'android' | 'unknown' {
	const userAgent = request.headers.get('user-agent')
	return getDeviceType(userAgent)
}
