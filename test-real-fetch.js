import { prisma } from './app/utils/db.server.ts'
import { fetchAndCacheFactsProfilePicture } from './app/utils/student.server.ts'

async function testRealFetch() {
	// Get a real JPG Academy student
	const student = await prisma.student.findFirst({
		where: {
			email: { endsWith: '@jpgacademy.org' },
		},
		select: {
			id: true,
			sisStudentId: true,
			fullName: true,
			email: true,
		},
	})

	if (!student) {
		console.log('No JPG Academy student found')
		return
	}

	console.log('Testing with real student:', {
		id: student.id,
		sisStudentId: student.sisStudentId,
		fullName: student.fullName,
		email: student.email,
	})

	// Force fetch to bypass rate limiting
	console.log('\nFetching and caching profile picture (force=true)...')
	const result = await fetchAndCacheFactsProfilePicture(
		student.id,
		student.sisStudentId,
		true, // Force fetch
	)

	console.log('\nResult:', result)

	// Check if it was saved
	const updatedStudent = await prisma.studentID.findUnique({
		where: { studentId: student.id },
		select: {
			photoUrl: true,
			factsPhotoCheckedAt: true,
		},
	})

	console.log('\nUpdated StudentID record:', updatedStudent)

	await prisma.$disconnect()
}

testRealFetch().catch(console.error)
