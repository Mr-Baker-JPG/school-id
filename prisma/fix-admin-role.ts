import { prisma } from '../app/utils/db.server.ts'

async function fixAdminRole() {
	const email = 'cbaker@jpgacademy.org'

	console.log(`Checking user: ${email}`)

	const user = await prisma.user.findUnique({
		where: { email },
		select: { id: true, email: true, roles: { select: { name: true } } },
	})

	if (!user) {
		console.error(`User ${email} not found`)
		process.exit(1)
	}

	const hasAdminRole = user.roles.some((role) => role.name === 'admin')

	if (hasAdminRole) {
		console.log(`User ${email} already has admin role`)
		process.exit(0)
	}

	console.log(`Adding admin role to ${email}...`)

	await prisma.user.update({
		where: { id: user.id },
		data: {
			roles: {
				connect: { name: 'admin' },
			},
		},
	})

	console.log(`✅ Admin role added successfully to ${email}`)
}

fixAdminRole()
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
