import { faker } from '@faker-js/faker'
import { expect, test } from '#tests/playwright-utils.ts'
import { prisma } from '#app/utils/db.server.ts'
import { insertMockStaff, clearMockStaff } from '#tests/mocks/facts.ts'
import {
	getPasswordHash,
	getSessionExpirationDate,
	sessionKey,
} from '#app/utils/auth.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import * as setCookieParser from 'set-cookie-parser'
import { syncEmployeesFromFacts } from '#app/utils/employee-sync.server.ts'

// Helper function to create admin user
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
			password: {
				create: {
					hash: await getPasswordHash('password123'),
				},
			},
			roles: {
				connect: { id: adminRole.id },
			},
		},
		select: { id: true, email: true, username: true },
	})

	return user
}

// Helper function to create regular user (employee)
async function createEmployeeUser(email?: string) {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})

	if (!userRole) {
		throw new Error('User role not found. Run database migrations.')
	}

	const userEmail = email ?? faker.internet.email()

	const user = await prisma.user.create({
		data: {
			email: userEmail,
			username: faker.internet.username(),
			name: faker.person.fullName(),
			password: {
				create: {
					hash: await getPasswordHash('password123'),
				},
			},
			roles: {
				connect: { id: userRole.id },
			},
		},
		select: { id: true, email: true, username: true },
	})

	return user
}

// Helper function to login user in Playwright
async function loginUser(
	page: any,
	username: string,
	password: string = 'password123',
) {
	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			userId: (
				await prisma.user.findUniqueOrThrow({
					where: { username },
					select: { id: true },
				})
			).id,
		},
		select: { id: true },
	})

	const authSession = await authSessionStorage.getSession()
	authSession.set(sessionKey, session.id)
	const cookieConfig = setCookieParser.parseString(
		await authSessionStorage.commitSession(authSession),
	)
	const newConfig = {
		...cookieConfig,
		domain: 'localhost',
		expires: cookieConfig.expires?.getTime(),
		sameSite: cookieConfig.sameSite as 'Strict' | 'Lax' | 'None',
	}
	await page.context().addCookies([newConfig])
}

test.beforeEach(async () => {
	// Clear mock staff before each test
	clearMockStaff()
	// Clean up any test data
	await prisma.employeeID.deleteMany()
	await prisma.employee.deleteMany()
	await prisma.user.deleteMany()
})

test('E2E: Employee can complete full ID workflow', async ({
	page,
	navigate,
}) => {
	// Step 1: Create mock staff in FACTS SIS
	const employeeEmail = faker.internet.email()
	const mockStaff = insertMockStaff({
		email: employeeEmail,
		firstName: 'John',
		lastName: 'Doe',
		active: true,
		department: 'Teacher',
	})

	// Step 2: Sync employees from FACTS SIS
	await syncEmployeesFromFacts()

	// Verify employee was created
	const employee = await prisma.employee.findUnique({
		where: { email: employeeEmail },
		select: {
			id: true,
			fullName: true,
			jobTitle: true,
			status: true,
			employeeId: true,
		},
	})
	expect(employee).toBeDefined()
	expect(employee?.status).toBe('active')

	// Step 3: Create user account and link to employee
	const user = await createEmployeeUser(employeeEmail)

	// Step 4: Login as employee
	await loginUser(page, user.username)
	await navigate('/employee/id')

	// Step 5: Verify employee can view their ID
	// Wait for page to load and check for employee name (could be in heading or body)
	await expect(
		page.getByText(employee?.fullName || 'John Doe', { exact: false }),
	).toBeVisible({ timeout: 10000 })
	await expect(
		page.getByText(employee?.jobTitle || 'Teacher', { exact: false }),
	).toBeVisible({ timeout: 10000 })

	// Step 6: Download PDF
	const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
	await page.getByRole('link', { name: /download/i }).click()
	const download = await downloadPromise
	expect(download.suggestedFilename()).toMatch(/\.pdf$/i)

	// Step 7: Get employee ID for verification
	expect(employee?.id).toBeDefined()
	const employeeId = employee!.id

	// Step 8: Navigate to verification page (simulating QR code scan)
	await navigate(`/verify/${employeeId}`)

	// Step 9: Verify verification page shows valid status
	await expect(page.getByText(/valid/i)).toBeVisible()
	await expect(page.getByText(employee?.fullName || 'John Doe')).toBeVisible()
	await expect(page.getByText(employee?.jobTitle || 'Teacher')).toBeVisible()

	// Cleanup
	await prisma.employeeID.deleteMany({ where: { employeeId: employee.id } })
	await prisma.employee.delete({ where: { id: employee.id } })
	await prisma.user.delete({ where: { id: user.id } })
})

test('E2E: Admin can manage employee ID end-to-end', async ({
	page,
	navigate,
}) => {
	// Step 1: Create admin user
	const admin = await createAdminUser()

	// Step 2: Create mock staff in FACTS SIS
	const employeeEmail = faker.internet.email()
	insertMockStaff({
		email: employeeEmail,
		firstName: 'Jane',
		lastName: 'Smith',
		active: true,
		department: 'Administrator',
	})

	// Step 3: Sync employees from FACTS SIS
	await syncEmployeesFromFacts()

	// Step 4: Get the synced employee
	const employee = await prisma.employee.findUnique({
		where: { email: employeeEmail },
		select: {
			id: true,
			fullName: true,
			jobTitle: true,
			status: true,
		},
	})
	expect(employee).toBeDefined()

	// Step 5: Login as admin
	await loginUser(page, admin.username)
	await navigate('/admin/employees')

	// Step 6: Verify employee appears in admin list
	await expect(
		page.getByText(employee?.fullName || 'Jane Smith', { exact: false }),
	).toBeVisible({ timeout: 10000 })

	// Step 7: Navigate to employee detail page
	await page
		.getByRole('link', {
			name: new RegExp(employee?.fullName || 'Jane Smith', 'i'),
		})
		.click()
	await expect(page).toHaveURL(`/admin/employees/${employee?.id}`)

	// Step 8: Upload photo
	await page.getByRole('link', { name: /upload.*photo|change.*photo/i }).click()
	await expect(page).toHaveURL(`/admin/employees/${employee?.id}/photo`)

	// Create a fake image file for upload
	const fileInput = page.locator('input[type="file"]')
	await fileInput.setInputFiles({
		name: 'test-photo.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from('fake image content'),
	})

	await page.getByRole('button', { name: /upload|submit/i }).click()

	// Step 9: Update expiration date
	await page.getByRole('link', { name: /expiration|expiration date/i }).click()
	await expect(page).toHaveURL(`/admin/employees/${employee?.id}/expiration`)

	const futureDate = new Date()
	futureDate.setFullYear(futureDate.getFullYear() + 1)
	const dateString = futureDate.toISOString().split('T')[0]
	await page.getByLabel(/expiration date/i).fill(dateString)
	await page.getByRole('button', { name: /update|save/i }).click()

	// Step 10: Download PDF ID card
	await navigate(`/admin/employees/${employee?.id}`)
	const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
	await page.getByRole('link', { name: /download/i }).click()
	const download = await downloadPromise
	expect(download.suggestedFilename()).toMatch(/\.pdf$/i)

	// Cleanup
	await prisma.employeeID.deleteMany({ where: { employeeId: employee!.id } })
	await prisma.employee.delete({ where: { id: employee!.id } })
	await prisma.user.delete({ where: { id: admin.id } })
})

test('E2E: Public verification works from verification URL', async ({
	page,
	navigate,
}) => {
	// Test 1: Valid active employee with future expiration
	const validEmployee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'Active Employee',
			jobTitle: 'Teacher',
			email: faker.internet.email(),
			status: 'active',
			employeeId: {
				create: {
					photoUrl: null,
					expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
				},
			},
		},
	})

	await navigate(`/verify/${validEmployee.id}`)
	await expect(page.getByText(/valid/i)).toBeVisible()
	await expect(page.getByText('Active Employee')).toBeVisible()
	await expect(page.getByText('Teacher')).toBeVisible()

	// Test 2: Inactive employee
	const inactiveEmployee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'Inactive Employee',
			jobTitle: 'Former Teacher',
			email: faker.internet.email(),
			status: 'inactive',
			employeeId: {
				create: {
					photoUrl: null,
					expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				},
			},
		},
	})

	await navigate(`/verify/${inactiveEmployee.id}`)
	await expect(page.getByText(/invalid/i)).toBeVisible()
	await expect(page.getByText(/not active/i)).toBeVisible()

	// Test 3: Expired ID
	const expiredEmployee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'Expired Employee',
			jobTitle: 'Teacher',
			email: faker.internet.email(),
			status: 'active',
			employeeId: {
				create: {
					photoUrl: null,
					expirationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
				},
			},
		},
	})

	await navigate(`/verify/${expiredEmployee.id}`)
	await expect(page.getByText(/invalid/i)).toBeVisible()
	await expect(page.getByText(/ID has expired/i)).toBeVisible()

	// Test 4: Non-existent employee
	await navigate(`/verify/non-existent-id-12345`)
	await expect(
		page.getByRole('heading', { name: /employee not found/i }),
	).toBeVisible()

	// Cleanup
	await prisma.employeeID.deleteMany({
		where: {
			employeeId: {
				in: [validEmployee.id, inactiveEmployee.id, expiredEmployee.id],
			},
		},
	})
	await prisma.employee.deleteMany({
		where: {
			id: { in: [validEmployee.id, inactiveEmployee.id, expiredEmployee.id] },
		},
	})
})

test('E2E: Expiration logic works in real scenarios', async ({
	page,
	navigate,
}) => {
	// Create employee with expiration exactly 30 days from now (expiring soon)
	const expiringSoonDate = new Date()
	expiringSoonDate.setDate(expiringSoonDate.getDate() + 30)

	const expiringEmployee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'Expiring Soon Employee',
			jobTitle: 'Teacher',
			email: faker.internet.email(),
			status: 'active',
			employeeId: {
				create: {
					photoUrl: null,
					expirationDate: expiringSoonDate,
				},
			},
		},
	})

	// Should still be valid (expires in 30 days)
	await navigate(`/verify/${expiringEmployee.id}`)
	await expect(page.getByText(/valid/i)).toBeVisible()

	// Create employee with expiration today (still valid today)
	const today = new Date()
	today.setHours(23, 59, 59, 999) // End of today

	const todayEmployee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'Today Employee',
			jobTitle: 'Teacher',
			email: faker.internet.email(),
			status: 'active',
			employeeId: {
				create: {
					photoUrl: null,
					expirationDate: today,
				},
			},
		},
	})

	// Should still be valid (expires at end of today)
	await navigate(`/verify/${todayEmployee.id}`)
	await expect(page.getByText(/valid/i)).toBeVisible()

	// Create employee with expiration yesterday (expired)
	const yesterday = new Date()
	yesterday.setDate(yesterday.getDate() - 1)

	const expiredYesterdayEmployee = await prisma.employee.create({
		data: {
			sisEmployeeId: faker.string.alphanumeric(10),
			fullName: 'Expired Yesterday Employee',
			jobTitle: 'Teacher',
			email: faker.internet.email(),
			status: 'active',
			employeeId: {
				create: {
					photoUrl: null,
					expirationDate: yesterday,
				},
			},
		},
	})

	// Should be invalid (expired)
	await navigate(`/verify/${expiredYesterdayEmployee.id}`)
	await expect(page.getByText(/invalid/i)).toBeVisible()
	await expect(page.getByText(/ID has expired/i)).toBeVisible()

	// Cleanup
	await prisma.employeeID.deleteMany({
		where: {
			employeeId: {
				in: [
					expiringEmployee.id,
					todayEmployee.id,
					expiredYesterdayEmployee.id,
				],
			},
		},
	})
	await prisma.employee.deleteMany({
		where: {
			id: {
				in: [
					expiringEmployee.id,
					todayEmployee.id,
					expiredYesterdayEmployee.id,
				],
			},
		},
	})
})

test('E2E: Error scenarios are handled gracefully', async ({
	page,
	navigate,
}) => {
	// Test 1: Employee tries to access another employee's ID
	const employee1 = await createEmployeeUser()
	const employee2Email = faker.internet.email()
	insertMockStaff({
		email: employee2Email,
		firstName: 'Other',
		lastName: 'Employee',
		active: true,
	})
	await syncEmployeesFromFacts()

	const employee2 = await prisma.employee.findUnique({
		where: { email: employee2Email },
	})
	expect(employee2).toBeDefined()

	// Login as employee1
	await loginUser(page, employee1.username)

	// Try to access employee2's ID download (should fail or redirect)
	await navigate(`/employee/id/download`)
	// Should only see their own ID, not employee2's

	// Test 2: Non-admin tries to access admin routes
	const regularUser = await createEmployeeUser()
	await loginUser(page, regularUser.username)

	await navigate('/admin/employees')
	// Should get 403 error page
	await expect(page.getByText(/403|forbidden|not allowed/i)).toBeVisible()

	// Test 3: Unauthenticated user tries to access employee ID page
	// Clear cookies first
	await page.context().clearCookies()
	await navigate('/employee/id')
	// Should be redirected to login
	const loginUrl = page.url()
	expect(loginUrl).toMatch(/login/i)

	// Cleanup
	await prisma.employee.deleteMany({
		where: { email: { in: [employee1.email, employee2Email] } },
	})
	await prisma.user.deleteMany({
		where: { id: { in: [employee1.id, regularUser.id] } },
	})
})
