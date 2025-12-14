import { faker } from '@faker-js/faker'
import { expect, test } from '#tests/playwright-utils.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	getPasswordHash,
	getSessionExpirationDate,
	sessionKey,
} from '#app/utils/auth.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import * as setCookieParser from 'set-cookie-parser'

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
async function createEmployeeUser() {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})

	if (!userRole) {
		throw new Error('User role not found. Run database migrations.')
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
	await page.goto('/login')
	await page.getByLabel(/^username$/i).fill(username)
	await page.getByLabel(/^password$/i).fill(password)
	await page.getByRole('button', { name: /log in/i }).click()
}

test('Unauthenticated user can view landing page with login form', async ({
	page,
}) => {
	await page.goto('/')

	// Check for landing page content
	await expect(
		page.getByRole('heading', { name: /Employee ID System/i }),
	).toBeVisible()
	await expect(
		page.getByText(/Access your official employee ID card/i),
	).toBeVisible()
	await expect(
		page.getByText(/This system is for internal use by school employees/i),
	).toBeVisible()

	// Check for Google OAuth login button
	await expect(
		page.getByRole('button', { name: /login with google/i }),
	).toBeVisible()
})

test('Authenticated employee can navigate to "My ID" from header', async ({
	page,
	login,
}) => {
	const user = await createEmployeeUser()
	await login(user)

	await page.goto('/')

	// Check for "My ID" link in header
	const myIdLink = page.getByRole('link', { name: /my id/i })
	await expect(myIdLink).toBeVisible()

	// Click the link and verify navigation
	await myIdLink.click()
	await expect(page).toHaveURL(/\/employee\/id/)
})

test('Authenticated admin can navigate to "Admin Dashboard" from header', async ({
	page,
	login,
}) => {
	const admin = await createAdminUser()
	await login(admin)

	await page.goto('/')

	// Check for "Admin Dashboard" link in header
	const adminDashboardLink = page.getByRole('link', {
		name: /admin dashboard/i,
	})
	await expect(adminDashboardLink).toBeVisible()

	// Click the link and verify navigation
	await adminDashboardLink.click()
	await expect(page).toHaveURL(/\/admin\/employees/)
})

test('Header navigation hides search bar', async ({ page }) => {
	await page.goto('/')

	// Search bar should not be visible
	const searchInput = page.getByRole('searchbox', { name: /search/i })
	await expect(searchInput).not.toBeVisible()
})

test('Footer does not display theme switcher', async ({ page }) => {
	await page.goto('/')

	// Theme switcher should not be visible in footer
	const themeSwitch = page.getByRole('button', { name: /theme/i })
	await expect(themeSwitch).not.toBeVisible()
})

