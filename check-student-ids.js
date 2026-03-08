import { prisma } from './app/utils/db.server.ts'

async function checkStudentIds() {
	// Get sample students and check their IDs
	const students = await prisma.student.findMany({
		select: {
			id: true,
			sisStudentId: true,
			fullName: true,
			email: true,
		},
		take: 10,
	})

	console.log('Sample student IDs:')
	console.table(students.map(s => ({
		DB_ID: s.id.substring(0, 8) + '...',
		SIS_ID: s.sisStudentId,
		SIS_Type: typeof s.sisStudentId,
		Name: s.fullName,
		Email: s.email,
	})))

	// Also check if we have any employees to compare
	const employees = await prisma.employee.findMany({
		select: {
			id: true,
			sisEmployeeId: true,
			fullName: true,
			email: true,
		},
		take: 5,
	})

	console.log('\nSample employee IDs for comparison:')
	console.table(employees.map(e => ({
		DB_ID: e.id.substring(0, 8) + '...',
		SIS_ID: e.sisEmployeeId,
		SIS_Type: typeof e.sisEmployeeId,
		Name: e.fullName,
		Email: e.email,
	})))

	await prisma.$disconnect()
}

checkStudentIds().catch(console.error)
