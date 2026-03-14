import { type Route } from './+types/install.test-facts.ts'

/**
 * POST /install/test-facts
 * Tests a FACTS SIS API connection with provided credentials
 */
export async function action({ request }: Route.ActionArgs) {
	if (request.method !== 'POST') {
		return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 })
	}

	try {
		const body = await request.json()
		const { subscriptionKey, apiKey, baseUrl } = body

		if (!subscriptionKey || !apiKey || !baseUrl) {
			return Response.json({
				success: false,
				error: 'Missing required fields',
			})
		}

		// Attempt to call the FACTS API people endpoint
		const url = `${baseUrl}/People`
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Ocp-Apim-Subscription-Key': subscriptionKey,
				'FACTS-Api-Key': apiKey,
				Accept: 'application/json',
			},
		})

		if (!response.ok) {
			const text = await response.text().catch(() => '')
			return Response.json({
				success: false,
				error: `FACTS API returned ${response.status}: ${response.statusText}. ${text.slice(0, 200)}`,
			})
		}

		const data = await response.json()
		const count = Array.isArray(data) ? data.length : data?.length ?? '?'

		return Response.json({
			success: true,
			count,
		})
	} catch (error) {
		return Response.json({
			success: false,
			error:
				error instanceof Error
					? error.message
					: 'Unknown error connecting to FACTS',
		})
	}
}
