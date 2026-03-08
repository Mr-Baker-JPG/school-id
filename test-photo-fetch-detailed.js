import { prisma } from './app/utils/db.server.ts'

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
	console.log('Parsed personId:', personId)

	// Manually call the FACTS API to see the raw response
	const config = {
		subscriptionKey: process.env.FACTS_SUBSCRIPTION_KEY,
		apiKey: process.env.FACTS_API_KEY,
		baseUrl: process.env.FACTS_BASE_URL || 'https://api.factsmgt.com',
	}

	const headers = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	}
	if (config.subscriptionKey) {
		headers['Ocp-Apim-Subscription-Key'] = config.subscriptionKey
	}
	if (config.apiKey) {
		headers['Facts-Api-Key'] = config.apiKey
	}

	const url = `${config.baseUrl}/People/${personId}/ProfilePicture?api-version=1`
	console.log('\nFetching from URL:', url)
	console.log('Headers:', JSON.stringify(headers, null, 2))

	try {
		const response = await fetch(url, { method: 'GET', headers })
		console.log('\nResponse status:', response.status, response.statusText)
		console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))

		if (response.ok) {
			const contentType = response.headers.get('content-type') || ''
			console.log('Content-Type:', contentType)

			if (contentType.includes('application/json')) {
				const jsonData = await response.json()
				console.log('\nJSON Response type:', typeof jsonData)
				if (typeof jsonData === 'object' && jsonData !== null) {
					console.log('JSON keys:', Object.keys(jsonData))
					if ('value' in jsonData) {
						console.log('Value property length:', String(jsonData.value).length)
						console.log('Value property preview:', String(jsonData.value).substring(0, 100))
					}
				} else {
					console.log('JSON preview:', String(jsonData).substring(0, 200))
				}
			} else {
				console.log('Non-JSON response, content-type:', contentType)
				const text = await response.text()
				console.log('Response preview:', text.substring(0, 200))
			}
		}
	} catch (error) {
		console.error('Error:', error)
	}

	await prisma.$disconnect()
}

testPhotoFetch().catch(console.error)
