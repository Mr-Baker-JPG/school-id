// Test different possible endpoints for student photos
const studentId = '1639'
const subscriptionKey = process.env.FACTS_SUBSCRIPTION_KEY
const apiKey = process.env.FACTS_API_KEY

async function testEndpoints() {
	const endpoints = [
		`https://api.factsmgt.com/People/${studentId}/ProfilePicture?api-version=1`,
		`https://api.factsmgt.com/Students/${studentId}/ProfilePicture?api-version=1.3`,
		`https://api.factsmgt.com/Students/${studentId}/Photo?api-version=1.3`,
		`https://api.factsmgt.com/Students/${studentId}?api-version=1.3`,
	]

	for (const endpoint of endpoints) {
		console.log(`\nTesting: ${endpoint}`)
		try {
			const response = await fetch(endpoint, {
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
					console.log('JSON keys:', Object.keys(data))
					if ('photoUrl' in data || 'profilePicture' in data || 'photo' in data) {
						console.log('Found photo field!')
					}
				} else {
					console.log('Non-JSON response')
				}
			}
		} catch (error) {
			console.error('Error:', error.message)
		}
	}
}

testEndpoints().catch(console.error)
