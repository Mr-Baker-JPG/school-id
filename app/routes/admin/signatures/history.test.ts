import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loader as historyLoader } from './history.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'

// Mock dependencies
vi.mock('#app/utils/db.server.ts', () => ({
	prisma: {
		signaturePushLog: {
			findMany: vi.fn(),
		},
		signatureTemplate: {
			findMany: vi.fn(),
		},
		employee: {
			findMany: vi.fn(),
		},
	},
}))

vi.mock('#app/utils/permissions.server.ts', () => ({
	requireUserWithRole: vi.fn(),
}))

describe('Signature Push History Route', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('loader', () => {
		it('requires admin role', async () => {
			vi.mocked(requireUserWithRole).mockRejectedValue(new Error('Unauthorized'))

			const request = new Request('http://localhost/admin/signatures/history')
			await expect(historyLoader({ request, params: {}, context: {} })).rejects.toThrow('Unauthorized')
			expect(requireUserWithRole).toHaveBeenCalledWith(request, 'admin')
		})

		it('returns push logs with employee and template data', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			
			const mockLogs = [
				{
					id: 'log1',
					employeeId: 'e1',
					templateId: 't1',
					success: true,
					error: null,
					pushedAt: new Date('2026-03-12T10:00:00Z'),
					employee: { id: 'e1', fullName: 'John Doe', email: 'john@example.com' },
					template: { id: 't1', name: 'Default' },
				},
			]
			
			vi.mocked(prisma.signaturePushLog.findMany).mockResolvedValue(mockLogs as any)
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany).mockResolvedValue([])

			const request = new Request('http://localhost/admin/signatures/history')
			const result = await historyLoader({ request, params: {}, context: {} })

			expect(result.pushLogs).toHaveLength(1)
			expect(result.pushLogs[0].employee.fullName).toBe('John Doe')
			expect(result.pushLogs[0].template?.name).toBe('Default')
		})

		it('filters by template', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signaturePushLog.findMany).mockResolvedValue([])
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany).mockResolvedValue([])

			const request = new Request('http://localhost/admin/signatures/history?templateId=t1')
			await historyLoader({ request, params: {}, context: {} })

			expect(prisma.signaturePushLog.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ templateId: 't1' }),
				}),
			)
		})

		it('filters by employee', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signaturePushLog.findMany).mockResolvedValue([])
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany).mockResolvedValue([])

			const request = new Request('http://localhost/admin/signatures/history?employeeId=e1')
			await historyLoader({ request, params: {}, context: {} })

			expect(prisma.signaturePushLog.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ employeeId: 'e1' }),
				}),
			)
		})

		it('filters by success status', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signaturePushLog.findMany).mockResolvedValue([])
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany).mockResolvedValue([])

			const request = new Request('http://localhost/admin/signatures/history?success=true')
			await historyLoader({ request, params: {}, context: {} })

			expect(prisma.signaturePushLog.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ success: true }),
				}),
			)
		})

		it('filters by failed status', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signaturePushLog.findMany).mockResolvedValue([])
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany).mockResolvedValue([])

			const request = new Request('http://localhost/admin/signatures/history?success=false')
			await historyLoader({ request, params: {}, context: {} })

			expect(prisma.signaturePushLog.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ success: false }),
				}),
			)
		})

		it('orders logs by pushedAt descending', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signaturePushLog.findMany).mockResolvedValue([])
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany).mockResolvedValue([])

			const request = new Request('http://localhost/admin/signatures/history')
			await historyLoader({ request, params: {}, context: {} })

			expect(prisma.signaturePushLog.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: { pushedAt: 'desc' },
				}),
			)
		})

		it('limits results to 100', async () => {
			vi.mocked(requireUserWithRole).mockResolvedValue({ id: 'admin1' } as any)
			vi.mocked(prisma.signaturePushLog.findMany).mockResolvedValue([])
			vi.mocked(prisma.signatureTemplate.findMany).mockResolvedValue([])
			vi.mocked(prisma.employee.findMany).mockResolvedValue([])

			const request = new Request('http://localhost/admin/signatures/history')
			await historyLoader({ request, params: {}, context: {} })

			expect(prisma.signaturePushLog.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 100,
				}),
			)
		})

		it('non-admin users cannot access this route', async () => {
			vi.mocked(requireUserWithRole).mockRejectedValue(new Error('Unauthorized'))

			const request = new Request('http://localhost/admin/signatures/history')
			await expect(historyLoader({ request, params: {}, context: {} })).rejects.toThrow('Unauthorized')
		})
	})
})
