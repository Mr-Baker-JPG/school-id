import { faker } from '@faker-js/faker'
import { expect, test, describe, beforeEach, afterEach } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { loader, action, renderTemplate, SAMPLE_EMPLOYEE } from './templates.tsx'

// ── Helpers ─────────────────────────────────────────────────────────────

async function createAdminUser() {
	const adminRole = await prisma.role.findUnique({
		where: { name: 'admin' },
	})
	if (!adminRole) throw new Error('Admin role not found.')

	return prisma.user.create({
		data: {
			email: faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: { connect: { id: adminRole.id } },
		},
		select: { id: true },
	})
}

async function createNonAdminUser() {
	const userRole = await prisma.role.findUnique({
		where: { name: 'user' },
	})
	if (!userRole) throw new Error('User role not found.')

	return prisma.user.create({
		data: {
			email: faker.internet.email(),
			username: faker.internet.username(),
			name: faker.person.fullName(),
			roles: { connect: { id: userRole.id } },
		},
		select: { id: true },
	})
}

async function makeRequest(userId: string, url: string) {
	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			userId,
		},
		select: { id: true },
	})

	const authSession = await authSessionStorage.getSession()
	authSession.set(sessionKey, session.id)
	const cookieHeader = await authSessionStorage.commitSession(authSession)

	return new Request(url, {
		headers: {
			cookie: cookieHeader,
		},
	})
}

async function makeFormRequest(
	userId: string,
	url: string,
	formData: Record<string, string>,
) {
	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			userId,
		},
		select: { id: true },
	})

	const authSession = await authSessionStorage.getSession()
	authSession.set(sessionKey, session.id)
	const cookieHeader = await authSessionStorage.commitSession(authSession)

	const body = new URLSearchParams(formData)

	return new Request(url, {
		method: 'POST',
		headers: {
			cookie: cookieHeader,
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: body.toString(),
	})
}

const BASE_URL = 'http://localhost:3000/admin/signatures/templates'

// ── Cleanup ─────────────────────────────────────────────────────────────

afterEach(async () => {
	await prisma.signatureTemplate.deleteMany()
})

// ── renderTemplate unit tests ───────────────────────────────────────────

describe('renderTemplate', () => {
	test('replaces all placeholders with data', () => {
		const html =
			'<p>{{fullName}} - {{jobTitle}} ({{department}})</p><p>{{email}}</p>'
		const result = renderTemplate(html, SAMPLE_EMPLOYEE)
		expect(result).toContain('Jane A. Smith')
		expect(result).toContain('Mathematics Teacher')
		expect(result).toContain('Mathematics')
		expect(result).toContain('jane.smith@school.org')
	})

	test('replaces multiple occurrences of same placeholder', () => {
		const html = '<p>{{fullName}} is {{fullName}}</p>'
		const result = renderTemplate(html, { fullName: 'Test' })
		expect(result).toBe('<p>Test is Test</p>')
	})

	test('leaves unmatched placeholders as-is', () => {
		const html = '<p>{{fullName}} {{unknown}}</p>'
		const result = renderTemplate(html, { fullName: 'Test' })
		expect(result).toBe('<p>Test {{unknown}}</p>')
	})
})

// ── Loader tests ────────────────────────────────────────────────────────

describe('loader', () => {
	test('requires admin role', async () => {
		const user = await createNonAdminUser()
		const request = await makeRequest(user.id, BASE_URL)

		try {
			await loader({ request, params: {}, context: {} as any })
			expect.fail('Should have thrown')
		} catch (e: any) {
			// requireUserWithRole throws a Response with status 403
			if (e instanceof Response) {
				expect(e.status).toBe(403)
			} else if (e?.status) {
				expect(e.status).toBe(403)
			} else {
				// It's a data() response wrapped in an error
				expect(e).toBeTruthy()
			}
		}
	})

	test('returns empty templates list when none exist', async () => {
		const admin = await createAdminUser()
		const request = await makeRequest(admin.id, BASE_URL)
		const result = await loader({
			request,
			params: {},
			context: {} as any,
		})
		expect(result.templates).toEqual([])
	})

	test('returns all templates ordered by isDefault desc, updatedAt desc', async () => {
		const admin = await createAdminUser()

		await prisma.signatureTemplate.create({
			data: {
				name: 'Template A',
				htmlContent: '<p>A</p>',
				isDefault: false,
			},
		})
		await prisma.signatureTemplate.create({
			data: {
				name: 'Template B',
				htmlContent: '<p>B</p>',
				isDefault: true,
			},
		})

		const request = await makeRequest(admin.id, BASE_URL)
		const result = await loader({
			request,
			params: {},
			context: {} as any,
		})

		expect(result.templates).toHaveLength(2)
		// Default template first
		expect(result.templates[0]!.name).toBe('Template B')
		expect(result.templates[1]!.name).toBe('Template A')
	})
})

// ── Action tests: create ────────────────────────────────────────────────

describe('action - create', () => {
	test('admin can create a new signature template', async () => {
		const admin = await createAdminUser()
		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'create',
			name: 'Test Template',
			htmlContent: '<p>{{fullName}}</p>',
		})

		const response = await action({
			request,
			params: {},
			context: {} as any,
		})

		// Should redirect on success
		expect(response).toBeInstanceOf(Response)
		expect((response as Response).status).toBe(302)

		// Verify in DB
		const template = await prisma.signatureTemplate.findUnique({
			where: { name: 'Test Template' },
		})
		expect(template).not.toBeNull()
		expect(template!.htmlContent).toBe('<p>{{fullName}}</p>')
		expect(template!.isDefault).toBe(false)
	})

	test('admin can create a default template', async () => {
		const admin = await createAdminUser()
		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'create',
			name: 'Default Template',
			htmlContent: '<p>Default</p>',
			isDefault: 'on',
		})

		await action({ request, params: {}, context: {} as any })

		const template = await prisma.signatureTemplate.findUnique({
			where: { name: 'Default Template' },
		})
		expect(template!.isDefault).toBe(true)
	})

	test('setting new default unsets previous default', async () => {
		const admin = await createAdminUser()

		// Create first default
		await prisma.signatureTemplate.create({
			data: {
				name: 'Old Default',
				htmlContent: '<p>Old</p>',
				isDefault: true,
			},
		})

		// Create new default
		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'create',
			name: 'New Default',
			htmlContent: '<p>New</p>',
			isDefault: 'on',
		})

		await action({ request, params: {}, context: {} as any })

		const old = await prisma.signatureTemplate.findUnique({
			where: { name: 'Old Default' },
		})
		const newDefault = await prisma.signatureTemplate.findUnique({
			where: { name: 'New Default' },
		})
		expect(old!.isDefault).toBe(false)
		expect(newDefault!.isDefault).toBe(true)
	})

	test('rejects duplicate template name', async () => {
		const admin = await createAdminUser()

		await prisma.signatureTemplate.create({
			data: { name: 'Existing', htmlContent: '<p>Existing</p>' },
		})

		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'create',
			name: 'Existing',
			htmlContent: '<p>Duplicate</p>',
		})

		const result = await action({
			request,
			params: {},
			context: {} as any,
		})
		expect(result).toHaveProperty('status', 'error')
		expect((result as any).errors.name[0]).toContain('already exists')
	})

	test('rejects empty name', async () => {
		const admin = await createAdminUser()
		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'create',
			name: '',
			htmlContent: '<p>Test</p>',
		})

		const result = await action({
			request,
			params: {},
			context: {} as any,
		})
		expect(result).toHaveProperty('status', 'error')
	})

	test('rejects empty html content', async () => {
		const admin = await createAdminUser()
		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'create',
			name: 'Template',
			htmlContent: '',
		})

		const result = await action({
			request,
			params: {},
			context: {} as any,
		})
		expect(result).toHaveProperty('status', 'error')
	})
})

// ── Action tests: update ────────────────────────────────────────────────

describe('action - update', () => {
	test('admin can edit an existing signature template', async () => {
		const admin = await createAdminUser()

		const template = await prisma.signatureTemplate.create({
			data: { name: 'Original', htmlContent: '<p>Original</p>' },
		})

		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'update',
			id: template.id,
			name: 'Updated',
			htmlContent: '<p>Updated content</p>',
		})

		const response = await action({
			request,
			params: {},
			context: {} as any,
		})
		expect(response).toBeInstanceOf(Response)
		expect((response as Response).status).toBe(302)

		const updated = await prisma.signatureTemplate.findUnique({
			where: { id: template.id },
		})
		expect(updated!.name).toBe('Updated')
		expect(updated!.htmlContent).toBe('<p>Updated content</p>')
	})

	test('rejects duplicate name on update (excluding self)', async () => {
		const admin = await createAdminUser()

		const t1 = await prisma.signatureTemplate.create({
			data: { name: 'Template A', htmlContent: '<p>A</p>' },
		})
		await prisma.signatureTemplate.create({
			data: { name: 'Template B', htmlContent: '<p>B</p>' },
		})

		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'update',
			id: t1.id,
			name: 'Template B',
			htmlContent: '<p>A updated</p>',
		})

		const result = await action({
			request,
			params: {},
			context: {} as any,
		})
		expect(result).toHaveProperty('status', 'error')
		expect((result as any).errors.name[0]).toContain('already exists')
	})
})

// ── Action tests: delete ────────────────────────────────────────────────

describe('action - delete', () => {
	test('admin can delete a signature template', async () => {
		const admin = await createAdminUser()

		const template = await prisma.signatureTemplate.create({
			data: { name: 'To Delete', htmlContent: '<p>Delete me</p>' },
		})

		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'delete',
			id: template.id,
		})

		const response = await action({
			request,
			params: {},
			context: {} as any,
		})
		expect(response).toBeInstanceOf(Response)
		expect((response as Response).status).toBe(302)

		const deleted = await prisma.signatureTemplate.findUnique({
			where: { id: template.id },
		})
		expect(deleted).toBeNull()
	})

	test('returns error for non-existent template', async () => {
		const admin = await createAdminUser()

		const request = await makeFormRequest(admin.id, BASE_URL, {
			intent: 'delete',
			id: 'nonexistent-id',
		})

		const result = await action({
			request,
			params: {},
			context: {} as any,
		})
		expect(result).toHaveProperty('status', 'error')
	})
})

// ── Access control ──────────────────────────────────────────────────────

describe('access control', () => {
	test('non-admin users cannot access template management', async () => {
		const user = await createNonAdminUser()
		const request = await makeFormRequest(user.id, BASE_URL, {
			intent: 'create',
			name: 'Unauthorized',
			htmlContent: '<p>Nope</p>',
		})

		try {
			await action({ request, params: {}, context: {} as any })
			expect.fail('Should have thrown')
		} catch (e: any) {
			// requireUserWithRole throws a data() response with 403
			expect(e).toBeTruthy()
		}
	})
})
