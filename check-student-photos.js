import { prisma } from './app/utils/db.server.ts'

async function checkStudentPhotos() {
	const students = await prisma.student.findMany({
		select: {
			id: true,
			sisStudentId: true,
			fullName: true,
			email: true,
			studentId: {
				select: {
					photoUrl: true,
					factsPhotoCheckedAt: true,
				},
			},
		},
		take: 5,
	})

	console.log('Sample students:')
	for (const student of students) {
		console.log({
			id: student.id,
			sisStudentId: student.sisStudentId,
			sisStudentIdType: typeof student.sisStudentId,
			sisStudentIdParsed: parseInt(student.sisStudentId, 10),
			isValidNumber: !isNaN(parseInt(student.sisStudentId, 10)),
			fullName: student.fullName,
			photoUrl: student.studentId?.photoUrl,
			factsPhotoCheckedAt: student.studentId?.factsPhotoCheckedAt,
		})
	}

	await prisma.$disconnect()
}

checkStudentPhotos().catch(console.error)
