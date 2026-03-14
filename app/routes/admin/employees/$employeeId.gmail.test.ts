import { faker } from '@faker-js/faker'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader } from './$employeeId'
import { consoleError, consoleWarn } from '#tests/setup/setup-test-env.ts'

// Create mock function BEFORE using it in vi.mock
const mockFetchAndCacheSignature = vi.fn(() => Promise.resolve())

// Mock Gmail signature service
vi.mock('#app/utils/gmail-signature.server.ts', () => ({
	GmailSignatureService: vi.fn().mockImplementation(() => ({
		fetchAndCacheSignature: () => Promise.resolve(),
	})),
	gmailSignatureService: {
		fetchAndCacheSignature: (employeeId: string, email: string) => mockFetchAndCacheSignature(employeeId, email),
	},
}))

async function createAdminUser() {
	const adminRole = await prisma.role.findUnique({
		where: { name: 'admin' },
	})

	if (!adminRole) {
		throw new Error('Admin role not found. Run database migrations.')
	}

	const user = await prisma.user.create({
		data: {
			email: faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: {
				connect: { id: adminRole.id },
			},
		},
		select: { id: true },
	})

	return user
}

describe('Admin Employee Detail - Gmail Signature Display', () => {
	let employee: any
	let adminUser: any
	let session: any
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(async () => {
		originalEnv = { ...process.env }
		
		// Allow console output
		consoleWarn.mockImplementation(() => {})
		consoleError.mockImplementation(() => {})
		mockFetchAndCacheSignature.mockReset()

		// Create admin user and session
		adminUser = await createAdminUser()
		session = await prisma.session.create({
			data: {
				userId: adminUser.id,
				expirationDate: getSessionExpirationDate(),
			},
		})

		// Create test employee
		employee = await prisma.employee.create({
			data: {
				sisEmployeeId: 'GMAIL001',
				fullName: 'Gmail Test User',
				jobTitle: 'Faculty - Science',
				email: 'gmailtest@school.org',
				status: 'active',
			},
		})

		// Create EmployeeID with cached signature
		await prisma.employeeID.create({
			data: {
				employeeId: employee.id,
				expirationDate: new Date('2026-07-01'),
				gmailSignature: '<div>Best,<br>Gmail Test User</div>',
				gmailSignatureFetchedAt: new Date(),
			},
		})
	})

	afterEach(async () => {
		// Cleanup
		await prisma.session.deleteMany({ where: { id: session.id } })
		await prisma.user.deleteMany({ where: { id: adminUser.id } })
		await prisma.employeeID.deleteMany({ where: { employeeId: employee.id } })
		await prisma.employee.delete({ where: { id: employee.id } })
		process.env = originalEnv
		vi.clearAllMocks()
	})

	async function createRequest(employeeId: string) {
		const cookieSession = await authSessionStorage.getSession()
		cookieSession.set(sessionKey, session.id)
		const cookie = await authSessionStorage.commitSession(cookieSession)

		return new Request(
			`http://localhost:3000/admin/employees/${employeeId}`,
			{
				headers: { cookie },
			},
		)
	}

	test('displays Gmail signature when cached in database', async () => {
		const request = await createRequest(employee.id)

		const data = await loader({
			request,
			params: { employeeId: employee.id },
			context: {},
		})

		expect(data.employee.employeeId.gmailSignature).toBe(
			'<div>Best,<br>Gmail Test User</div>',
		)
		expect(data.employee.employeeId.gmailSignatureFetchedAt).toBeTruthy()
	})

	test('fetches signature in background if not cached', async () => {
		// Remove signature from database
		await prisma.employeeID.update({
			where: { employeeId: employee.id },
			data: {
				gmailSignature: null,
				gmailSignatureFetchedAt: null,
			},
		})

		const request = await createRequest(employee.id)

		await loader({
			request,
			params: { employeeId: employee.id },
			context: {},
		})

		// Should trigger background fetch
		expect(mockFetchAndCacheSignature).toHaveBeenCalledWith(
			employee.id,
			employee.email,
		)
	})

	test('fetches signature in background if cache is stale (> 7 days)', async () => {
		// Set fetchedAt to 8 days ago
		const staleDate = new Date()
		staleDate.setDate(staleDate.getDate() - 8)

		await prisma.employeeID.update({
			where: { employeeId: employee.id },
			data: {
				gmailSignatureFetchedAt: staleDate,
			},
		})

		const request = await createRequest(employee.id)

		await loader({
			request,
			params: { employeeId: employee.id },
			context: {},
		})

		// Should trigger background refresh
		expect(mockFetchAndCacheSignature).toHaveBeenCalledWith(
			employee.id,
			employee.email,
		)
	})

	test('does not fetch signature if cache is fresh (< 7 days)', async () => {
		// Signature was fetched yesterday (fresh)
		const freshDate = new Date()
		freshDate.setDate(freshDate.getDate() - 1)

		await prisma.employeeID.update({
			where: { employeeId: employee.id },
			data: {
				gmailSignatureFetchedAt: freshDate,
			},
		})

		const request = await createRequest(employee.id)

		await loader({
			request,
			params: { employeeId: employee.id },
			context: {},
		})

		// Should NOT trigger fetch
		expect(mockFetchAndCacheSignature).not.toHaveBeenCalled()
	})
})
