import * as E from '@react-email/components'
import { sendEmail } from './email.server.ts'
import { getExpiringEmployees } from './employee.server.ts'
import { getExpiringStudents } from './student.server.ts'
import { prisma } from './db.server.ts'

/**
 * Email template for expiration notifications
 */
export function ExpirationNotificationEmail({
	expiringEmployeeCount,
	expiredEmployeeCount,
	expiringStudentCount,
	expiredStudentCount,
	expiringEmployees,
	expiredEmployees,
	expiringStudents,
	expiredStudents,
}: {
	expiringEmployeeCount: number
	expiredEmployeeCount: number
	expiringStudentCount: number
	expiredStudentCount: number
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
	expiringStudents: Array<{
		fullName: string
		email: string
		expirationStatus: { type: 'expiring'; daysUntilExpiration: number }
	}>
	expiredStudents: Array<{
		fullName: string
		email: string
		expirationStatus: { type: 'expired'; daysSinceExpiration: number }
	}>
}) {
	const totalExpiring = expiringEmployeeCount + expiringStudentCount
	const totalExpired = expiredEmployeeCount + expiredStudentCount

	return (
		<E.Html lang="en" dir="ltr">
			<E.Container>
				<E.Heading>ID Expiration Notifications</E.Heading>
				<E.Text>
					This is an automated notification about ID expirations for employees
					and students.
				</E.Text>

				{/* Faculty/Employee Expirations */}
				{expiringEmployeeCount > 0 && (
					<>
						<E.Heading as="h2">
							{expiringEmployeeCount} Faculty ID
							{expiringEmployeeCount !== 1 ? 's' : ''} expiring within 30
							days:
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

				{expiredEmployeeCount > 0 && (
					<>
						<E.Heading as="h2">
							{expiredEmployeeCount} Faculty ID
							{expiredEmployeeCount !== 1 ? 's' : ''} expired:
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

				{/* Student Expirations */}
				{expiringStudentCount > 0 && (
					<>
						<E.Heading as="h2">
							{expiringStudentCount} Student ID
							{expiringStudentCount !== 1 ? 's' : ''} expiring within 30
							days:
						</E.Heading>
						<E.Section>
							{expiringStudents.map((student) => (
								<E.Text key={student.email}>
									{student.fullName} - Expires in{' '}
									{student.expirationStatus.daysUntilExpiration} day
									{student.expirationStatus.daysUntilExpiration !== 1
										? 's'
										: ''}
								</E.Text>
							))}
						</E.Section>
					</>
				)}

				{expiredStudentCount > 0 && (
					<>
						<E.Heading as="h2">
							{expiredStudentCount} Student ID
							{expiredStudentCount !== 1 ? 's' : ''} expired:
						</E.Heading>
						<E.Section>
							{expiredStudents.map((student) => (
								<E.Text key={student.email}>
									{student.fullName} - Expired{' '}
									{student.expirationStatus.daysSinceExpiration} day
									{student.expirationStatus.daysSinceExpiration !== 1
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
	currentDate: Date = new Date(),
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get expiring and expired employees
		const employees = await getExpiringEmployees(warningDays, currentDate)

		// Get expiring and expired students
		const students = await getExpiringStudents(warningDays, currentDate)

		if (employees.length === 0 && students.length === 0) {
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

		// Separate expiring and expired students
		const expiringStudents = students.filter(
			(s) => s.expirationStatus?.type === 'expiring',
		) as Array<{
			fullName: string
			email: string
			expirationStatus: { type: 'expiring'; daysUntilExpiration: number }
		}>

		const expiredStudents = students.filter(
			(s) => s.expirationStatus?.type === 'expired',
		) as Array<{
			fullName: string
			email: string
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

		// Build subject line
		const totalExpiring = expiringEmployees.length + expiringStudents.length
		const totalExpired = expiredEmployees.length + expiredStudents.length
		const subjectParts: string[] = []

		if (totalExpiring > 0) {
			subjectParts.push(`${totalExpiring} expiring`)
		}
		if (totalExpired > 0) {
			subjectParts.push(`${totalExpired} expired`)
		}

		const subject = `ID Expiration Alert: ${subjectParts.join(', ')}`

		// Send email to each admin
		const emailPromises = adminUsers.map((admin) =>
			sendEmail({
				to: admin.email,
				subject,
				react: (
					<ExpirationNotificationEmail
						expiringEmployeeCount={expiringEmployees.length}
						expiredEmployeeCount={expiredEmployees.length}
						expiringStudentCount={expiringStudents.length}
						expiredStudentCount={expiredStudents.length}
						expiringEmployees={expiringEmployees}
						expiredEmployees={expiredEmployees}
						expiringStudents={expiringStudents}
						expiredStudents={expiredStudents}
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


