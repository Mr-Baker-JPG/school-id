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
		administrator: false,
		blockSurvey: false,
		districtUser: false,
		districtWideUser: false,
		dualEnrolledUser: false,
		elementary: false,
		faculty: true,
		fullTime: true,
		highSchool: false,
		middleSchool: false,
		preschool: false,
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

// In-memory store for mock staff
const mockStaffStore: Array<ReturnType<typeof createMockStaff>> = []

// Initialize with some default staff
for (let i = 0; i < 5; i++) {
	mockStaffStore.push(createMockStaff())
}

export function insertMockStaff(
	overrides?: Parameters<typeof createMockStaff>[0],
) {
	const staff = createMockStaff(overrides)
	mockStaffStore.push(staff)
	return staff
}

export function clearMockStaff() {
	mockStaffStore.length = 0
}

export function getMockStaffById(staffId: number) {
	return mockStaffStore.find((s) => s.staffId === staffId)
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
		const apiKey = request.headers.get('Ocp-Apim-Api-Key')

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
			const apiKey = request.headers.get('Ocp-Apim-Api-Key')

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
]
