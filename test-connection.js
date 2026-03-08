const subscriptionKey = process.env.FACTS_SUBSCRIPTION_KEY
const apiKey = process.env.FACTS_API_KEY

async function testConnection() {
	console.log('Testing FACTS API connection...')
	console.log('Subscription key:', subscriptionKey ? `${subscriptionKey.substring(0, 10)}...` : 'NOT SET')
	console.log('API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET')
	
	// Test with a simple staff endpoint that we know works
	const endpoint = 'https://api.factsmgt.com/People/Staff?api-version=1.1&PageSize=1'
	
	try {
		const response = await fetch(endpoint, {
			headers: {
				'Ocp-Apim-Subscription-Key': subscriptionKey,
				'Facts-Api-Key': apiKey,
			},
		})
		console.log(`\nStatus: ${response.status} ${response.statusText}`)
		console.log(`Content-Type: ${response.headers.get('content-type')}`)
		
		if (response.ok) {
			const data = await response.json()
			console.log('Success! Found', data.results?.length || 0, 'staff members')
		} else {
			const text = await response.text()
			console.log('Error response:', text.substring(0, 500))
		}
	} catch (error) {
		console.error('Fetch error:', error)
		console.error('Error details:', {
			message: error.message,
			code: error.code,
			cause: error.cause,
		})
	}
}

testConnection().catch(console.error)
