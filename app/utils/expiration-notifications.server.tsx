import * as E from '@react-email/components'
import { sendEmail } from './email.server.ts'
import { getExpiringEmployees } from './employee.server.ts'
import { prisma } from './db.server.ts'

/**
 * Email template for expiration notifications
 */
export function ExpirationNotificationEmail({
	expiringCount,
	expiredCount,
	expiringEmployees,
	expiredEmployees,
}: {
	expiringCount: number
	expiredCount: number
	expiringEmployees: Array<{
		fullName: string
		email: string
		jobTitle: string
		expirationStatus: { type: 'expiring'; daysUntilExpiration: number }
	}>
	expiredEmployees: Array<{
		fullName: string
		email: string
		jobTitle: string
		expirationStatus: { type: 'expired'; daysSinceExpiration: number }
	}>
}) {
	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<E.Heading>Employee ID Expiration Notifications</E.Heading>
				<E.Text>
					This is an automated notification about employee ID expirations.
				</E.Text>
				{expiringCount > 0 && (
					<>
						<E.Heading as="h2">
							{expiringCount} ID{expiringCount !== 1 ? 's' : ''} expiring
							within 30 days:
						</E.Heading>
						<E.Section>
							{expiringEmployees.map((employee) => (
								<E.Text key={employee.email}>
									{employee.fullName} ({employee.jobTitle}) - Expires in{' '}
									{employee.expirationStatus.daysUntilExpiration} day
									{employee.expirationStatus.daysUntilExpiration !== 1
										? 's'
										: ''}
								</E.Text>
							))}
						</E.Section>
					</>
				)}
				{expiredCount > 0 && (
					<>
						<E.Heading as="h2">
							{expiredCount} ID{expiredCount !== 1 ? 's' : ''} expired:
						</E.Heading>
						<E.Section>
							{expiredEmployees.map((employee) => (
								<E.Text key={employee.email}>
									{employee.fullName} ({employee.jobTitle}) - Expired{' '}
									{employee.expirationStatus.daysSinceExpiration} day
									{employee.expirationStatus.daysSinceExpiration !== 1
										? 's'
										: ''}{' '}
									ago
								</E.Text>
							))}
						</E.Section>
					</>
				)}
				<E.Text>
					Please review and update expiration dates as needed in the admin
					interface.
				</E.Text>
			</E.Container>
		</E.Html>
	)
}

/**
 * Sends expiration notification emails to all admin users.
 * @param warningDays - Number of days before expiration to include (default: 30)
 * @returns Result indicating success or failure
 */
export async function sendExpirationNotifications(
	warningDays: number = 30,
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get expiring and expired employees
		const employees = await getExpiringEmployees(warningDays)

		if (employees.length === 0) {
			// No expiring or expired IDs, no need to send notifications
			return { success: true }
		}

		// Separate expiring and expired employees
		const expiringEmployees = employees.filter(
			(e) => e.expirationStatus?.type === 'expiring',
		) as Array<{
			fullName: string
			email: string
			jobTitle: string
			expirationStatus: { type: 'expiring'; daysUntilExpiration: number }
		}>

		const expiredEmployees = employees.filter(
			(e) => e.expirationStatus?.type === 'expired',
		) as Array<{
			fullName: string
			email: string
			jobTitle: string
			expirationStatus: { type: 'expired'; daysSinceExpiration: number }
		}>

		// Get all admin users
		const adminUsers = await prisma.user.findMany({
			where: {
				roles: {
					some: {
						name: 'admin',
					},
				},
			},
			select: {
				email: true,
			},
		})

		if (adminUsers.length === 0) {
			console.warn('No admin users found to send expiration notifications')
			return { success: false, error: 'No admin users found' }
		}

		// Send email to each admin
		const emailPromises = adminUsers.map((admin) =>
			sendEmail({
				to: admin.email,
				subject: `Employee ID Expiration Alert: ${expiringEmployees.length} expiring, ${expiredEmployees.length} expired`,
				react: (
					<ExpirationNotificationEmail
						expiringCount={expiringEmployees.length}
						expiredCount={expiredEmployees.length}
						expiringEmployees={expiringEmployees}
						expiredEmployees={expiredEmployees}
					/>
				),
			}),
		)

		const results = await Promise.allSettled(emailPromises)

		// Check if any emails failed
		const failures = results.filter((r) => r.status === 'rejected')
		if (failures.length > 0) {
			console.error(
				`Failed to send ${failures.length} expiration notification email(s)`,
			)
			return {
				success: false,
				error: `${failures.length} email(s) failed to send`,
			}
		}

		return { success: true }
	} catch (error) {
		console.error('Error sending expiration notifications:', error)
		return {
			success: false,
			error:
				error instanceof Error ? error.message : 'Unknown error occurred',
		}
	}
}
