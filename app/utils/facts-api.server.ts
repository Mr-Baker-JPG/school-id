/**
 * FACTS SIS API Client Service
 *
 * This service handles authentication, data fetching, and transformation
 * for the FACTS SIS REST API.
 */

import { invariantResponse } from '@epic-web/invariant'

// FACTS API Types based on OpenAPI spec
export interface FactsPersonVM {
	firstName?: string
	lastName?: string
	middleName?: string
	nickName?: string
	email?: string
	email2?: string
	personId: number
}

export interface FactsDemographicsModel {
	person?: FactsPersonVM
	address?: unknown
}

export interface FactsStaffVmOutV1_1 {
	staffId: number
	name?: string
	firstName?: string
	lastName?: string
	middleName?: string
	active: boolean
	department?: string
	demographics?: FactsDemographicsModel
}

export interface FactsPagedResult<T> {
	results: T[]
	currentPage: number
	pageCount: number
	pageSize: number
	rowCount: number
	nextPage?: string
}

export interface FactsEmployeeData {
	sisEmployeeId: string
	fullName: string
	jobTitle: string
	email: string
	status: 'active' | 'inactive'
}

export class FactsApiError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public response?: unknown,
	) {
		super(message)
		this.name = 'FactsApiError'
	}
}

/**
 * Get FACTS API configuration from environment variables
 * Supports sandbox mode by using "SandboxKey" as the API key
 */
function getFactsConfig() {
	// When MOCKS=true, use a default mock key if no credentials are provided
	const useMocks = process.env.MOCKS === 'true'
	const subscriptionKey =
		process.env.FACTS_SUBSCRIPTION_KEY ||
		(useMocks ? 'MOCK_SUBSCRIPTION_KEY' : undefined)

	// Support sandbox mode: if FACTS_USE_SANDBOX=true, use "SandboxKey"
	// Otherwise use the provided API key or mock key
	const useSandbox = process.env.FACTS_USE_SANDBOX === 'true'
	const apiKey = useSandbox
		? 'SandboxKey'
		: process.env.FACTS_API_KEY || (useMocks ? 'MOCK_API_KEY' : undefined)

	const baseUrl = process.env.FACTS_BASE_URL || 'https://api.factsmgt.com'

	return {
		subscriptionKey,
		apiKey,
		baseUrl,
	}
}

/**
 * Create authenticated headers for FACTS API requests with optional cache bypass
 */
function createAuthHeaders(bypassCache?: boolean): HeadersInit {
	const config = getFactsConfig()
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	}

	if (config.subscriptionKey) {
		headers['Ocp-Apim-Subscription-Key'] = config.subscriptionKey
	}

	if (config.apiKey) {
		headers['Facts-Api-Key'] = config.apiKey
	}

	// Support cache bypass per FACTS API documentation
	if (bypassCache) {
		headers['x-bypass-cache'] = Math.floor(Date.now() / 1000).toString()
	}

	return headers
}

/**
 * Fetch staff data from FACTS API with pagination, filtering, and sorting support
 */
async function fetchStaffPage(
	page: number = 1,
	pageSize: number = 100,
	options?: {
		includes?: string
		filters?: string
		sorts?: string
		bypassCache?: boolean
	},
): Promise<FactsPagedResult<FactsStaffVmOutV1_1>> {
	const config = getFactsConfig()

	invariantResponse(
		config.subscriptionKey || config.apiKey,
		'FACTS API credentials not configured. Set FACTS_SUBSCRIPTION_KEY or FACTS_API_KEY environment variables.',
		{ status: 500 },
	)

	const url = new URL(`${config.baseUrl}/People/Staff`)
	url.searchParams.set('api-version', '1.1')
	url.searchParams.set('Page', page.toString())
	url.searchParams.set('PageSize', pageSize.toString())

	if (options?.includes) {
		url.searchParams.set('includes', options.includes)
	}

	if (options?.filters) {
		url.searchParams.set('Filters', options.filters)
	}

	if (options?.sorts) {
		url.searchParams.set('Sorts', options.sorts)
	}

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: createAuthHeaders(options?.bypassCache),
	})

	// Handle rate limiting (429 Too Many Requests)
	if (response.status === 429) {
		throw new FactsApiError(
			'FACTS API rate limit exceeded. Please retry after the rate limit window.',
			429,
		)
	}

	if (!response.ok) {
		let errorMessage = `FACTS API request failed with status ${response.status}`
		let errorData: unknown

		try {
			errorData = await response.json()
			if (
				typeof errorData === 'object' &&
				errorData !== null &&
				'detail' in errorData &&
				typeof errorData.detail === 'string'
			) {
				errorMessage = errorData.detail
			}
		} catch {
			// If JSON parsing fails, use the status text
			errorMessage = `${errorMessage}: ${response.statusText}`
		}

		throw new FactsApiError(errorMessage, response.status, errorData)
	}

	const data = await response.json()
	return data as FactsPagedResult<FactsStaffVmOutV1_1>
}

/**
 * Transform FACTS API staff data to Employee schema format
 */
function transformStaffToEmployee(
	staff: FactsStaffVmOutV1_1,
): FactsEmployeeData | null {
	// Validate required fields
	if (!staff.staffId) {
		return null
	}

	// Get email from demographics.person.email or fallback
	const email =
		staff.demographics?.person?.email ||
		staff.demographics?.person?.email2 ||
		''

	if (!email) {
		// Email is required in our schema
		return null
	}

	// Build full name from available fields
	const firstName = staff.firstName || ''
	const lastName = staff.lastName || ''
	const middleName = staff.middleName || ''
	const name = staff.name || ''

	let fullName = name
	if (!fullName) {
		const nameParts = [firstName, middleName, lastName]
			.filter(Boolean)
			.join(' ')
		fullName = nameParts || 'Unknown'
	}

	// Get job title from department
	const jobTitle = staff.department || 'Staff'

	// Determine status from active flag
	const status: 'active' | 'inactive' = staff.active ? 'active' : 'inactive'

	return {
		sisEmployeeId: staff.staffId.toString(),
		fullName: fullName.trim(),
		jobTitle: jobTitle.trim(),
		email: email.trim(),
		status,
	}
}

/**
 * Fetch all staff members from FACTS API with automatic pagination
 * Supports filtering, sorting, and cache bypass options
 */
export async function fetchAllStaff(options?: {
	includes?: string
	filters?: string
	sorts?: string
	bypassCache?: boolean
}): Promise<FactsEmployeeData[]> {
	const pageSize = 100
	let currentPage = 1
	let hasMorePages = true
	const allEmployees: FactsEmployeeData[] = []

	while (hasMorePages) {
		try {
			const pageResult = await fetchStaffPage(currentPage, pageSize, options)

			// Transform and filter valid employees
			for (const staff of pageResult.results) {
				const employee = transformStaffToEmployee(staff)
				if (employee) {
					allEmployees.push(employee)
				}
			}

			// Check if there are more pages
			hasMorePages =
				currentPage < pageResult.pageCount && pageResult.nextPage !== undefined

			if (hasMorePages) {
				currentPage++
			}
		} catch (error) {
			if (error instanceof FactsApiError) {
				throw error
			}
			throw new FactsApiError(
				`Failed to fetch staff page ${currentPage}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	return allEmployees
}

/**
 * Fetch a single staff member by ID from FACTS API
 * Supports includes and cache bypass options
 */
export async function fetchStaffById(
	staffId: number,
	options?: {
		includes?: string
		bypassCache?: boolean
	},
): Promise<FactsEmployeeData | null> {
	const config = getFactsConfig()

	invariantResponse(
		config.subscriptionKey || config.apiKey,
		'FACTS API credentials not configured. Set FACTS_SUBSCRIPTION_KEY or FACTS_API_KEY environment variables.',
		{ status: 500 },
	)

	const url = new URL(`${config.baseUrl}/People/Staff/${staffId}`)
	url.searchParams.set('api-version', '1.1')

	if (options?.includes) {
		url.searchParams.set('includes', options.includes)
	}

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: createAuthHeaders(options?.bypassCache),
	})

	if (response.status === 404) {
		return null
	}

	// Handle rate limiting (429 Too Many Requests)
	if (response.status === 429) {
		throw new FactsApiError(
			'FACTS API rate limit exceeded. Please retry after the rate limit window.',
			429,
		)
	}

	if (!response.ok) {
		let errorMessage = `FACTS API request failed with status ${response.status}`
		let errorData: unknown

		try {
			errorData = await response.json()
			if (
				typeof errorData === 'object' &&
				errorData !== null &&
				'detail' in errorData &&
				typeof errorData.detail === 'string'
			) {
				errorMessage = errorData.detail
			}
		} catch {
			errorMessage = `${errorMessage}: ${response.statusText}`
		}

		throw new FactsApiError(errorMessage, response.status, errorData)
	}

	const staff = (await response.json()) as FactsStaffVmOutV1_1
	return transformStaffToEmployee(staff)
}

/**
 * Fetch a person's profile picture from FACTS API
 * The API returns the image as a base64-encoded string in JSON format
 * @param personId - The person ID (can be staffId, studentId, or personId)
 * @param options - Optional options including bypassCache
 * @returns The profile picture as a Buffer, or null if not found or error occurs
 */
export async function fetchProfilePicture(
	personId: number,
	options?: {
		bypassCache?: boolean
	},
): Promise<Buffer | null> {
	const config = getFactsConfig()

	invariantResponse(
		config.subscriptionKey || config.apiKey,
		'FACTS API credentials not configured. Set FACTS_SUBSCRIPTION_KEY or FACTS_API_KEY environment variables.',
		{ status: 500 },
	)

	const url = new URL(`${config.baseUrl}/People/${personId}/ProfilePicture`)
	url.searchParams.set('api-version', '1')

	let response: Response
	try {
		response = await fetch(url.toString(), {
			method: 'GET',
			headers: createAuthHeaders(options?.bypassCache),
		})
	} catch (error) {
		// Handle network errors gracefully
		console.warn(
			`Network error fetching profile picture for personId ${personId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}

	// Handle 404 (no profile picture) - return null gracefully
	if (response.status === 404 || response.status === 204) {
		return null
	}

	// Handle rate limiting (429 Too Many Requests)
	if (response.status === 429) {
		throw new FactsApiError(
			'FACTS API rate limit exceeded. Please retry after the rate limit window.',
			429,
		)
	}

	// Handle other errors
	if (!response.ok) {
		// For profile pictures, we want to return null on errors rather than throwing
		// This allows the application to gracefully fall back to "No Photo" placeholder
		console.warn(
			`Failed to fetch profile picture for personId ${personId}: ${response.status} ${response.statusText}`,
		)
		return null
	}

	// Get the image data - FACTS API returns base64-encoded string in JSON
	try {
		const contentType = response.headers.get('content-type') || ''
		
		// Check if response is JSON (base64 string) or binary
		if (contentType.includes('application/json')) {
			// Parse JSON response - FACTS API returns base64-encoded string directly
			const jsonData = await response.json()
			// The API returns a string (base64-encoded image), not an object
			const base64String = typeof jsonData === 'string' ? jsonData : String(jsonData)
			
			if (!base64String || base64String.trim() === '') {
				return null
			}
			
			// Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
			const base64Data = base64String.includes(',') 
				? base64String.split(',')[1] 
				: base64String.trim()
			
			// Decode base64 to buffer
			try {
				return Buffer.from(base64Data, 'base64')
			} catch (error) {
				console.warn(
					`Failed to decode base64 image for personId ${personId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
				)
				return null
			}
		} else {
			// Fallback: treat as binary data
			const arrayBuffer = await response.arrayBuffer()
			return Buffer.from(arrayBuffer)
		}
	} catch (error) {
		console.warn(
			`Error reading profile picture for personId ${personId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
		return null
	}
}
