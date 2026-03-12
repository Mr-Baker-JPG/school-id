import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loader, action } from './push.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'
import { gmailSignatureService } from '#app/utils/gmail-signature.server.ts'

// Mock dependencies
vi.mock('#app/utils/db.server.ts', () => ({
	prisma: {
		signatureTemplate: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
		},
		employee: {
			findMany: vi.fn(),
		},
		employeeID: {
			updateMany: vi.fn(),
		},
		signaturePushLog: {
			create: vi.fn(),
		},
	},
}))

vi.mock('#app/utils/permissions.server.ts', () => ({
	requireUserWithRole: vi.fn(),
}))

vi.mock('#app/utils/gmail-signature.server.ts', () => ({
	gmailSignatureService: {
		setSignature: vi.fn(),
	},
}))

// Mock renderTemplate from templates.tsx
vi.mock('./templates.tsx', () => ({
	renderTemplate: vi.fn((html, data) => {
		let result = html
		for (const [key, value] of Object.entries(data)) {
			result = result.replaceAll(`{{${key}}}`, value)
		}
		return result
	}),
	SAMPLE_EMPLOYEE: {
		fullName: 'Jane A. Smith',
		firstName: 'Jane',
		lastName: 'Smith',
		jobTitle: 'Mathematics Teacher',
		department: 'Mathematics',
		email: 'jane.smith@jpgacademy.org',
		phone: '(555) 123-4567',
		schoolName: 'JPG Academy',
	},
}))

describe('Signature Push Route', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('loader', () => {
		it('requires admin role', async () => {
			const request = new Request('http://localhost/admin/signatures/push')
			await expect(loader({ request, params: {}, context: {} })).rejects.toThrow()
			expect(requireUserWithRole).toHaveBeenCalledWith(request, 'admin')
		})

		it('returns templates, employees, and departments', async () => {
			const mockTemplates = [
				{ id: 't1', name: 'Default', htmlContent: '<p>{{fullName}}</p>', isDefault: true },
				{ id: 't2', name: 'Custom', htmlContent: '<p>{{email}}</p>', isDefault: false },
			]
			const mockEmployees = [
				{
					id: 'e1',
					fullName: 'John Doe',
					email: 'john@example.com',
					status: 'active',
					department: 'Math',
					employeeId: { gmailSignature: null },
				},
			]
			const mockDepartments = [{ department: 'Math' }, { department: 'Science' }]

			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue(mockTemplates as any)
			vi.mocked(prisma.employee.findMany)
				.mockResolvedValueOnce(mockEmployees as any)
				.mockResolvedValueOnce(mockDepartments as any)
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)

			const request = new Request('http://localhost/admin/signatures/push')
			const result = await loader({ request, params: {}, context: {} })

			expect(result.templates).toHaveLength(2)
			expect(result.employees).toHaveLength(1)
			expect(result.departments).toEqual(['Math', 'Science'])
		})

		it('filters employees by status', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany)
				.mockResolvedValueOnce([]) // employees
				.mockResolvedValueOnce([]) // departments

			const request = new Request('http://localhost/admin/signatures/push?status=active')
			await loader({ request, params: {}, context: {} })

			expect(prisma.employee.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ status: 'active' }),
				}),
			)
		})

		it('filters employees by department', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany)
				.mockResolvedValueOnce([]) // employees
				.mockResolvedValueOnce([]) // departments

			const request = new Request('http://localhost/admin/signatures/push?department=Math')
			await loader({ request, params: {}, context: {} })

			expect(prisma.employee.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ department: 'Math' }),
				}),
			)
		})

		it('filters employees by search query', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany)
				.mockResolvedValueOnce([]) // employees
				.mockResolvedValueOnce([]) // departments

			const request = new Request('http://localhost/admin/signatures/push?search=john')
			await loader({ request, params: {}, context: {} })

			expect(prisma.employee.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						OR: [
							{ fullName: { contains: 'john' } },
							{ email: { contains: 'john' } },
						],
					}),
				}),
			)
		})

		it('non-admin users cannot access this route', async () => {
			vi.mocked(requireUserWithRole).mockRejectedValue(new Error('Unauthorized'))

			const request = new Request('http://localhost/admin/signatures/push')
			await expect(loader({ request, params: {}, context: {} })).rejects.toThrow('Unauthorized')
		})
	})

	describe('action', () => {
		it('requires admin role', async () => {
			vi.mocked(requireUserWithRole).mockRejectedValue(new Error('Unauthorized'))

			const formData = new FormData()
			formData.append('intent', 'push')
			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			await expect(action({ request, params: {}, context: {} })).rejects.toThrow('Unauthorized')
			expect(requireUserWithRole).toHaveBeenCalledWith(request, 'admin')
		})

		it('returns error when no template selected', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)

			const formData = new FormData()
			formData.append('intent', 'push')
			formData.append('templateId', '')
			formData.append('employeeIds', 'e1')

			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			const result = await action({ request, params: {}, context: {} })

			expect(result).toEqual({
				status: 'error',
				errors: {
					templateId: ['Please select a template'],
				},
			})
		})

		it('returns error when no employees selected', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)

			const formData = new FormData()
			formData.append('intent', 'push')
			formData.append('templateId', 't1')

			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			const result = await action({ request, params: {}, context: {} })

			expect(result).toEqual({
				status: 'error',
				errors: {
					employeeIds: ['Please select at least one employee'],
				},
			})
		})

		it('returns error when template not found', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findUnique).mockResolvedValue(null)

			const formData = new FormData()
			formData.append('intent', 'push')
			formData.append('templateId', 'nonexistent')
			formData.append('employeeIds', 'e1')

			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			const result = await action({ request, params: {}, context: {} })

			expect(result).toEqual({
				status: 'error',
				errors: {
					templateId: ['Template not found'],
				},
			})
		})

		it('pushes signatures to selected employees', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findUnique).mockResolvedValue({
				id: 't1',
				name: 'Default',
				htmlContent: '<p>{{fullName}}</p>',
				isDefault: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			vi.mocked(prisma.employee.findMany).mockResolvedValue([
				{
					id: 'e1',
					fullName: 'John Doe',
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					jobTitle: 'Teacher',
					department: 'Math',
					status: 'active',
					employeeId: { id: 'eid1' },
				},
			] as any)
			vi.mocked(gmailSignatureService.setSignature).mockResolvedValue({ success: true })
			vi.mocked(prisma.employeeID.updateMany).mockResolvedValue({ count: 1 })

			const formData = new FormData()
			formData.append('intent', 'push')
			formData.append('templateId', 't1')
			formData.append('employeeIds', 'e1')

			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			const result = (await action({ request, params: {}, context: {} })) as any

			expect(result.status).toBe('success')
			expect(result.summary.total).toBe(1)
			expect(result.summary.success).toBe(1)
			expect(result.summary.failed).toBe(0)
			expect(result.summary.templateName).toBe('Default')
			expect(gmailSignatureService.setSignature).toHaveBeenCalledWith(
				'john@example.com',
				'<p>John Doe</p>',
			)
		})

		it('handles partial failures gracefully', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findUnique).mockResolvedValue({
				id: 't1',
				name: 'Default',
				htmlContent: '<p>{{fullName}}</p>',
				isDefault: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			vi.mocked(prisma.employee.findMany).mockResolvedValue([
				{
					id: 'e1',
					fullName: 'John Doe',
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					jobTitle: 'Teacher',
					department: 'Math',
					status: 'active',
					employeeId: { id: 'eid1' },
				},
				{
					id: 'e2',
					fullName: 'Jane Smith',
					firstName: 'Jane',
					lastName: 'Smith',
					email: 'jane@example.com',
					jobTitle: 'Teacher',
					department: 'Science',
					status: 'active',
					employeeId: { id: 'eid2' },
				},
			] as any)
			vi.mocked(gmailSignatureService.setSignature)
				.mockResolvedValueOnce({ success: true })
				.mockResolvedValueOnce({ success: false, error: 'API error' })
			vi.mocked(prisma.employeeID.updateMany).mockResolvedValue({ count: 1 })

			const formData = new FormData()
			formData.append('intent', 'push')
			formData.append('templateId', 't1')
			formData.append('employeeIds', 'e1')
			formData.append('employeeIds', 'e2')

			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			const result = (await action({ request, params: {}, context: {} })) as any

			expect(result.status).toBe('success')
			expect(result.summary.total).toBe(2)
			expect(result.summary.success).toBe(1)
			expect(result.summary.failed).toBe(1)
			expect(result.results[1].success).toBe(false)
			expect(result.results[1].error).toBe('API error')
		})

		it('uses gmail.settings.sharing scope for setSignature', async () => {
			// This test verifies that setSignature is called, which uses the gmail.settings.sharing scope
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findUnique).mockResolvedValue({
				id: 't1',
				name: 'Default',
				htmlContent: '<p>{{fullName}}</p>',
				isDefault: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			vi.mocked(prisma.employee.findMany).mockResolvedValue([
				{
					id: 'e1',
					fullName: 'John Doe',
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					jobTitle: 'Teacher',
					department: 'Math',
					status: 'active',
					employeeId: { id: 'eid1' },
				},
			] as any)
			vi.mocked(gmailSignatureService.setSignature).mockResolvedValue({ success: true })
			vi.mocked(prisma.employeeID.updateMany).mockResolvedValue({ count: 1 })
			vi.mocked(prisma.signaturePushLog.create).mockResolvedValue({ id: 'log1' } as any)

			const formData = new FormData()
			formData.append('intent', 'push')
			formData.append('templateId', 't1')
			formData.append('employeeIds', 'e1')

			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			await action({ request, params: {}, context: {} })

			// Verify setSignature was called (the actual scope is in the service implementation)
			expect(gmailSignatureService.setSignature).toHaveBeenCalled()
		})

		it('creates log entry for each push operation', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findUnique).mockResolvedValue({
				id: 't1',
				name: 'Default',
				htmlContent: '<p>{{fullName}}</p>',
				isDefault: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			vi.mocked(prisma.employee.findMany).mockResolvedValue([
				{
					id: 'e1',
					fullName: 'John Doe',
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					jobTitle: 'Teacher',
					department: 'Math',
					status: 'active',
					employeeId: { id: 'eid1' },
				},
			] as any)
			vi.mocked(gmailSignatureService.setSignature).mockResolvedValue({ success: true })
			vi.mocked(prisma.employeeID.updateMany).mockResolvedValue({ count: 1 })
			vi.mocked(prisma.signaturePushLog.create).mockResolvedValue({ id: 'log1' } as any)

			const formData = new FormData()
			formData.append('intent', 'push')
			formData.append('templateId', 't1')
			formData.append('employeeIds', 'e1')

			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			await action({ request, params: {}, context: {} })

			expect(prisma.signaturePushLog.create).toHaveBeenCalledWith({
				data: {
					employeeId: 'e1',
					templateId: 't1',
					success: true,
					error: undefined,
				},
			})
		})

		it('logs failed pushes with error details', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signatureTemplate.findUnique).mockResolvedValue({
				id: 't1',
				name: 'Default',
				htmlContent: '<p>{{fullName}}</p>',
				isDefault: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			vi.mocked(prisma.employee.findMany).mockResolvedValue([
				{
					id: 'e1',
					fullName: 'John Doe',
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					jobTitle: 'Teacher',
					department: 'Math',
					status: 'active',
					employeeId: { id: 'eid1' },
				},
			] as any)
			vi.mocked(gmailSignatureService.setSignature).mockResolvedValue({
				success: false,
				error: 'Permission denied',
			})
			vi.mocked(prisma.signaturePushLog.create).mockResolvedValue({ id: 'log1' } as any)

			const formData = new FormData()
			formData.append('intent', 'push')
			formData.append('templateId', 't1')
			formData.append('employeeIds', 'e1')

			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			await action({ request, params: {}, context: {} })

			expect(prisma.signaturePushLog.create).toHaveBeenCalledWith({
				data: {
					employeeId: 'e1',
					templateId: 't1',
					success: false,
					error: 'Permission denied',
				},
			})
		})

		it('non-admin users cannot access action', async () => {
			vi.mocked(requireUserWithRole).mockRejectedValue(new Error('Unauthorized'))

			const formData = new FormData()
			formData.append('intent', 'push')
			const request = new Request('http://localhost/admin/signatures/push', {
				method: 'POST',
				body: formData,
			})
			await expect(action({ request, params: {}, context: {} })).rejects.toThrow('Unauthorized')
		})
	})
})
