import { data } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { twoFAVerificationType } from '#app/routes/settings/profile/two-factor/_layout.tsx'
import { type Route } from './+types/user-settings'

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			username: true,
			email: true,
			image: {
				select: { objectKey: true },
			},
			_count: {
				select: {
					sessions: {
						where: {
							expirationDate: { gt: new Date() },
						},
					},
				},
			},
		},
	})

	const twoFactorVerification = await prisma.verification.findUnique({
		select: { id: true },
		where: { target_type: { type: twoFAVerificationType, target: userId } },
	})

	const password = await prisma.password.findUnique({
		select: { userId: true },
		where: { userId },
	})

	// Look up employee or student photo by matching email
	let photoUrl: string | null = null
	let personType: 'employee' | 'student' | null = null

	const employee = await prisma.employee.findUnique({
		where: { email: user.email },
		select: { employeeId: { select: { photoUrl: true } } },
	})

	if (employee?.employeeId?.photoUrl) {
		photoUrl = employee.employeeId.photoUrl
		personType = 'employee'
	} else {
		const student = await prisma.student.findUnique({
			where: { email: user.email },
			select: { studentId: { select: { photoUrl: true } } },
		})
		if (student?.studentId?.photoUrl) {
			photoUrl = student.studentId.photoUrl
			personType = 'student'
		}
	}

	return data({
		user,
		hasPassword: Boolean(password),
		isTwoFactorEnabled: Boolean(twoFactorVerification),
		photoUrl,
		personType,
	})
}
