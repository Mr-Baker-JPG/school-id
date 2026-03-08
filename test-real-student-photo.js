const subscriptionKey = process.env.FACTS_SUBSCRIPTION_KEY
const apiKey = process.env.FACTS_API_KEY

async function testRealStudentPhoto() {
	// Test with a real JPG Academy student ID (1201124)
	const studentId = '1201124'
	
	console.log(`Testing profile picture for real student ID: ${studentId}`)
	
	const url = `https://api.factsmgt.com/People/${studentId}/ProfilePicture?api-version=1`
	console.log(`URL: ${url}`)
	
	try {
		const response = await fetch(url, {
			headers: {
				'Ocp-Apim-Subscription-Key': subscriptionKey,
				'Facts-Api-Key': apiKey,
			},
		})
		
		console.log(`Status: ${response.status} ${response.statusText}`)
		console.log(`Content-Type: ${response.headers.get('content-type')}`)
		
		if (response.ok) {
			const contentType = response.headers.get('content-type') || ''
			if (contentType.includes('application/json')) {
				const data = await response.json()
				console.log('JSON Response:')
				console.log('- Type:', typeof data)
				console.log('- Keys:', Object.keys(data))
				
				if (data.value) {
					console.log('- Value length:', String(data.value).length)
					console.log('- Value preview:', String(data.value).substring(0, 100))
					console.log('✅ Photo found!')
				} else {
					console.log('❌ No value property in response')
					console.log('Full response:', JSON.stringify(data, null, 2))
				}
			} else {
				console.log('Binary response')
				const buffer = await response.arrayBuffer()
				console.log('Buffer size:', buffer.byteLength)
				console.log('✅ Photo found (binary)!')
			}
		} else if (response.status === 404) {
			console.log('❌ No photo found (404)')
		} else {
			const text = await response.text()
			console.log('Error response:', text)
		}
	} catch (error) {
		console.error('Fetch error:', error)
	}
}

testRealStudentPhoto().catch(console.error)
