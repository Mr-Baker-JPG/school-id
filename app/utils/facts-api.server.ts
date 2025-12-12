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
 */
function getFactsConfig() {
	// When MOCKS=true, use a default mock key if no credentials are provided
	const useMocks = process.env.MOCKS === 'true'
	const subscriptionKey =
		process.env.FACTS_SUBSCRIPTION_KEY ||
		(useMocks ? 'MOCK_SUBSCRIPTION_KEY' : undefined)
	const apiKey =
		process.env.FACTS_API_KEY || (useMocks ? 'MOCK_API_KEY' : undefined)
	const baseUrl = process.env.FACTS_BASE_URL || 'https://api.factsmgt.com'

	return {
		subscriptionKey,
		apiKey,
		baseUrl,
	}
}

/**
 * Create authenticated headers for FACTS API requests
 */
function createAuthHeaders(): HeadersInit {
	const config = getFactsConfig()
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	}

	if (config.subscriptionKey) {
		headers['Ocp-Apim-Subscription-Key'] = config.subscriptionKey
	}

	if (config.apiKey) {
		headers['Ocp-Apim-Api-Key'] = config.apiKey
	}

	return headers
}

/**
 * Fetch staff data from FACTS API with pagination support
 */
async function fetchStaffPage(
	page: number = 1,
	pageSize: number = 100,
	includes?: string,
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

	if (includes) {
		url.searchParams.set('includes', includes)
	}

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: createAuthHeaders(),
	})

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
 */
export async function fetchAllStaff(
	includes?: string,
): Promise<FactsEmployeeData[]> {
	const pageSize = 100
	let currentPage = 1
	let hasMorePages = true
	const allEmployees: FactsEmployeeData[] = []

	while (hasMorePages) {
		try {
			const pageResult = await fetchStaffPage(currentPage, pageSize, includes)

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
 */
export async function fetchStaffById(
	staffId: number,
	includes?: string,
): Promise<FactsEmployeeData | null> {
	const config = getFactsConfig()

	invariantResponse(
		config.subscriptionKey || config.apiKey,
		'FACTS API credentials not configured. Set FACTS_SUBSCRIPTION_KEY or FACTS_API_KEY environment variables.',
		{ status: 500 },
	)

	const url = new URL(`${config.baseUrl}/People/Staff/${staffId}`)
	url.searchParams.set('api-version', '1.1')

	if (includes) {
		url.searchParams.set('includes', includes)
	}

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: createAuthHeaders(),
	})

	if (response.status === 404) {
		return null
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
