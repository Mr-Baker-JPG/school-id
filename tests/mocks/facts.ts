import { faker } from '@faker-js/faker'
import { HttpResponse, passthrough, http, type HttpHandler } from 'msw'

const { json } = HttpResponse

// Mock staff data generator
function createMockStaff(overrides?: {
	staffId?: number
	firstName?: string
	lastName?: string
	email?: string
	active?: boolean
	department?: string
	administrator?: boolean
	faculty?: boolean
	highSchool?: boolean
	middleSchool?: boolean
	elementary?: boolean
	preschool?: boolean
}) {
	const staffId = overrides?.staffId ?? faker.number.int({ min: 1, max: 10000 })
	const firstName = overrides?.firstName ?? faker.person.firstName()
	const lastName = overrides?.lastName ?? faker.person.lastName()
	const email = overrides?.email ?? faker.internet.email()

	return {
		staffId,
		name: `${firstName} ${lastName}`,
		firstName,
		lastName,
		middleName: faker.person.middleName(),
		active: overrides?.active ?? true,
		department: overrides?.department ?? faker.person.jobTitle(),
		administrator: overrides?.administrator ?? false,
		blockSurvey: false,
		districtUser: false,
		districtWideUser: false,
		dualEnrolledUser: false,
		elementary: overrides?.elementary ?? false,
		faculty: overrides?.faculty ?? true,
		fullTime: true,
		highSchool: overrides?.highSchool ?? false,
		middleSchool: overrides?.middleSchool ?? false,
		preschool: overrides?.preschool ?? false,
		staffDirectoryBlock: false,
		substitute: false,
		unsubscribeRenWebEmail: false,
		demographics: {
			person: {
				personId: faker.number.int({ min: 1, max: 100000 }),
				firstName,
				lastName,
				email,
				email2: faker.internet.email(),
				homePhone: faker.phone.number(),
				cellPhone: faker.phone.number(),
			},
			address: {
				addressID: faker.number.int(),
				address1: faker.location.streetAddress(),
				city: faker.location.city(),
				state: faker.location.state({ abbreviated: true }),
				zip: faker.location.zipCode(),
			},
		},
	}
}

// Mock student data generator
function createMockStudent(overrides?: {
	studentId?: number
	firstName?: string
	lastName?: string
	middleName?: string
	email?: string
	active?: boolean
	grade?: string
}) {
	const studentId = overrides?.studentId ?? faker.number.int({ min: 1, max: 10000 })
	const firstName = overrides?.firstName ?? faker.person.firstName()
	const lastName = overrides?.lastName ?? faker.person.lastName()
	const middleName = overrides?.middleName !== undefined ? overrides.middleName : faker.person.middleName()
	// Use empty string if explicitly passed, otherwise generate random email
	const email = overrides?.email !== undefined ? overrides.email : faker.internet.email()
	// If email is explicitly empty, also make email2 empty for proper testing
	const email2 = overrides?.email === '' ? '' : faker.internet.email()

	// Map active boolean to school.status string
	// FACTS API uses "Enrolled" for active students
	const status = overrides?.active !== false ? 'Enrolled' : 'Withdrawn'

	return {
		studentId,
		school: {
			status,
			gradeLevel: overrides?.grade ?? '9',
		},
		demographics: {
			person: {
				personId: faker.number.int({ min: 1, max: 100000 }),
				firstName,
				lastName,
				email,
				email2,
				homePhone: faker.phone.number(),
				cellPhone: faker.phone.number(),
			},
			address: {
				addressID: faker.number.int(),
				address1: faker.location.streetAddress(),
				city: faker.location.city(),
				state: faker.location.state({ abbreviated: true }),
				zip: faker.location.zipCode(),
			},
		},
	}
}

// In-memory store for mock staff
const mockStaffStore: Array<ReturnType<typeof createMockStaff>> = []

// In-memory store for mock students
const mockStudentStore: Array<ReturnType<typeof createMockStudent>> = []

// Initialize with some default staff
for (let i = 0; i < 5; i++) {
	mockStaffStore.push(createMockStaff())
}

// Initialize with some default students
for (let i = 0; i < 5; i++) {
	mockStudentStore.push(createMockStudent())
}

export function insertMockStaff(
	overrides?: Parameters<typeof createMockStaff>[0],
) {
	const staff = createMockStaff(overrides)
	mockStaffStore.push(staff)
	return staff
}

export function insertMockStudent(
	overrides?: Parameters<typeof createMockStudent>[0],
) {
	const student = createMockStudent(overrides)
	mockStudentStore.push(student)
	return student
}

export function clearMockStaff() {
	mockStaffStore.length = 0
}

export function clearMockStudents() {
	mockStudentStore.length = 0
}

export function getMockStaffById(staffId: number) {
	return mockStaffStore.find((s) => s.staffId === staffId)
}

export function getMockStudentById(studentId: number) {
	return mockStudentStore.find((s) => s.studentId === studentId)
}

const passthroughFacts =
	!process.env.FACTS_SUBSCRIPTION_KEY?.startsWith('MOCK_') &&
	!process.env.FACTS_API_KEY?.startsWith('MOCK_') &&
	process.env.NODE_ENV !== 'test' &&
	process.env.MOCKS !== 'true'

export const handlers: Array<HttpHandler> = [
	// GET /People/Staff - List all staff with pagination
	http.get('https://api.factsmgt.com/People/Staff', async ({ request }) => {
		if (passthroughFacts) return passthrough()

		const url = new URL(request.url)
		const page = parseInt(url.searchParams.get('Page') || '1', 10)
		const pageSize = parseInt(url.searchParams.get('PageSize') || '100', 10)
		const includes = url.searchParams.get('includes')

		// Validate authentication headers
		const subscriptionKey = request.headers.get('Ocp-Apim-Subscription-Key')
		const apiKey =
			request.headers.get('Facts-Api-Key') ||
			request.headers.get('Ocp-Apim-Api-Key')

		if (!subscriptionKey && !apiKey) {
			return json(
				{
					type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
					title: 'Unauthorized',
					status: 401,
					detail: 'Authentication required',
				},
				{ status: 401 },
			)
		}

		// Pagination logic
		const startIndex = (page - 1) * pageSize
		const endIndex = startIndex + pageSize
		const allStaff = mockStaffStore.slice(startIndex, endIndex)
		const totalCount = mockStaffStore.length
		const pageCount = Math.ceil(totalCount / pageSize)

		// Transform staff based on includes parameter
		let results = allStaff
		if (includes && includes.includes('demographics')) {
			// Already included in our mock data
			results = allStaff
		}

		return json({
			results,
			currentPage: page,
			pageCount,
			pageSize,
			rowCount: totalCount,
			nextPage:
				page < pageCount
					? `${request.url.split('?')[0]}?Page=${page + 1}`
					: undefined,
		})
	}),

	// GET /People/Staff/{staffId} - Get single staff member
	http.get(
		'https://api.factsmgt.com/People/Staff/:staffId',
		async ({ request, params }) => {
			if (passthroughFacts) return passthrough()

			const staffId = parseInt(params.staffId as string, 10)

			// Validate authentication headers
			const subscriptionKey = request.headers.get('Ocp-Apim-Subscription-Key')
			const apiKey = request.headers.get('Facts-Api-Key')

			if (!subscriptionKey && !apiKey) {
				return json(
					{
						type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
						title: 'Unauthorized',
						status: 401,
						detail: 'Authentication required',
					},
					{ status: 401 },
				)
			}

			const staff = getMockStaffById(staffId)

			if (!staff) {
				return json(
					{
						type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
						title: 'Not Found',
						status: 404,
						detail: `Staff member with ID ${staffId} not found`,
					},
					{ status: 404 },
				)
			}

			return json(staff)
		},
	),

	// GET /People/{personId}/ProfilePicture - Get profile picture
	http.get(
		'https://api.factsmgt.com/People/:personId/ProfilePicture',
		async ({ request, params }) => {
			if (passthroughFacts) return passthrough()

			const personId = parseInt(params.personId as string, 10)

			// Validate authentication headers
			const subscriptionKey = request.headers.get('Ocp-Apim-Subscription-Key')
			const apiKey = request.headers.get('Facts-Api-Key')

			if (!subscriptionKey && !apiKey) {
				return json(
					{
						type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
						title: 'Unauthorized',
						status: 401,
						detail: 'Authentication required',
					},
					{ status: 401 },
				)
			}

			// For testing, return a mock image buffer for personId > 0
			// Return 404 for personId 999, 204 for personId 888, 500 for personId 777
			if (personId === 999) {
				return new HttpResponse(null, { status: 404 })
			}
			if (personId === 888) {
				return new HttpResponse(null, { status: 204 })
			}
			if (personId === 777) {
				return json(
					{
						type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
						title: 'Internal Server Error',
						status: 500,
						detail: 'Internal server error',
					},
					{ status: 500 },
				)
			}
			if (personId === 666) {
				// Network error simulation
				return HttpResponse.error()
			}

			// Return mock image data for valid personIds
			// FACTS API returns base64-encoded string in a JSON object with "value" property
			// Create a minimal valid JPEG image (1x1 pixel, gray)
			// This is a complete, valid JPEG that browsers can actually display
			// Base64 of a minimal valid JPEG (1x1 gray pixel)
			const minimalJpegBase64 =
				'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
			const minimalJpegBuffer = Buffer.from(minimalJpegBase64, 'base64')

			// For testing, use the minimal valid JPEG directly
			// This is a real, displayable JPEG that browsers can render
			// In production, real FACTS API will return actual profile pictures
			const mockImageData = minimalJpegBuffer
			const base64String = mockImageData.toString('base64')

			// FACTS API returns an object with "value" property containing the base64 string
			return json(
				{ value: base64String },
				{
					status: 200,
					headers: {
						'Content-Type': 'application/json',
					},
				},
			)
		},
	),

	// GET /Students - List all students with pagination
	http.get('https://api.factsmgt.com/Students', async ({ request }) => {
		if (passthroughFacts) return passthrough()

		const url = new URL(request.url)
		const page = parseInt(url.searchParams.get('Page') || '1', 10)
		const pageSize = parseInt(url.searchParams.get('PageSize') || '100', 10)
		const includes = url.searchParams.get('includes')

		// Validate authentication headers
		const subscriptionKey = request.headers.get('Ocp-Apim-Subscription-Key')
		const apiKey =
			request.headers.get('Facts-Api-Key') ||
			request.headers.get('Ocp-Apim-Api-Key')

		if (!subscriptionKey && !apiKey) {
			return json(
				{
					type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
					title: 'Unauthorized',
					status: 401,
					detail: 'Authentication required',
				},
				{ status: 401 },
			)
		}

		// Pagination logic
		const startIndex = (page - 1) * pageSize
		const endIndex = startIndex + pageSize
		const allStudents = mockStudentStore.slice(startIndex, endIndex)
		const totalCount = mockStudentStore.length
		const pageCount = Math.ceil(totalCount / pageSize)

		// Transform students based on includes parameter
		let results = allStudents
		if (includes && includes.includes('demographics')) {
			// Already included in our mock data
			results = allStudents
		}

		return json({
			results,
			currentPage: page,
			pageCount,
			pageSize,
			rowCount: totalCount,
			nextPage:
				page < pageCount
					? `${request.url.split('?')[0]}?Page=${page + 1}`
					: undefined,
		})
	}),

	// GET /Students/{studentId} - Get single student
	http.get(
		'https://api.factsmgt.com/Students/:studentId',
		async ({ request, params }) => {
			if (passthroughFacts) return passthrough()

			const studentId = parseInt(params.studentId as string, 10)

			// Validate authentication headers
			const subscriptionKey = request.headers.get('Ocp-Apim-Subscription-Key')
			const apiKey = request.headers.get('Facts-Api-Key')

			if (!subscriptionKey && !apiKey) {
				return json(
					{
						type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
						title: 'Unauthorized',
						status: 401,
						detail: 'Authentication required',
					},
					{ status: 401 },
				)
			}

			const student = getMockStudentById(studentId)

			if (!student) {
				return json(
					{
						type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
						title: 'Not Found',
						status: 404,
						detail: `Student with ID ${studentId} not found`,
					},
					{ status: 404 },
				)
			}

			return json(student)
		},
	),
]
