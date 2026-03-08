import { prisma } from './app/utils/db.server.ts'
import { fetchProfilePicture } from './app/utils/facts-api.server.ts'
import { uploadStudentPhoto } from './app/utils/storage.server.ts'

async function testPhotoFetch() {
	// Get a sample student
	const student = await prisma.student.findFirst({
		select: {
			id: true,
			sisStudentId: true,
			fullName: true,
		},
	})

	if (!student) {
		console.log('No students found')
		return
	}

	console.log('Testing photo fetch for student:', {
		id: student.id,
		sisStudentId: student.sisStudentId,
		fullName: student.fullName,
	})

	const personId = parseInt(student.sisStudentId, 10)
	console.log('Parsed personId:', personId, 'isValid:', !isNaN(personId))

	// Try to fetch the profile picture
	console.log('\nFetching profile picture from FACTS API...')
	try {
		const photoBuffer = await fetchProfilePicture(personId)
		if (photoBuffer) {
			console.log('✅ Photo fetched successfully!')
			console.log('Buffer size:', photoBuffer.length, 'bytes')
			
			// Try to upload it
			console.log('\nUploading to storage...')
			const objectKey = await uploadStudentPhoto(
				student.id,
				photoBuffer,
				'image/jpeg',
			)
			console.log('✅ Photo uploaded successfully!')
			console.log('Object key:', objectKey)

			// Update the database
			await prisma.studentID.update({
				where: { studentId: student.id },
				data: { photoUrl: objectKey },
			})
			console.log('✅ Database updated!')
		} else {
			console.log('❌ No photo returned from FACTS API (null)')
		}
	} catch (error) {
		console.error('❌ Error fetching photo:', error)
	}

	await prisma.$disconnect()
}

testPhotoFetch().catch(console.error)
