import { redirect } from 'react-router'
import { authenticator } from '#app/utils/auth.server.ts'
import {
	handleMockAction,
	googleProviderInitPromise,
} from '#app/utils/connections.server.ts'
import {
	GOOGLE_PROVIDER_NAME,
	ProviderNameSchema,
} from '#app/utils/connections.tsx'
import { getReferrerRoute } from '#app/utils/misc.tsx'
import { getRedirectCookieHeader } from '#app/utils/redirect-cookie.server.ts'
import { type Route } from './+types/index.ts'

export async function loader() {
	return redirect('/')
}

export async function action({ request, params }: Route.ActionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)

	// Wait for Google provider to load and ensure strategy is registered if this is a Google request
	if (providerName === GOOGLE_PROVIDER_NAME) {
		const googleProvider = await googleProviderInitPromise
		// Check if we got a no-op provider (meaning the real provider failed to load)
		if ('_isNoOp' in googleProvider && googleProvider._isNoOp) {
			console.error(
				'GoogleProvider failed to load due to dependency issues. Check server logs for details.',
			)
			throw new Response(
				'Google OAuth is not available. The GoogleProvider module failed to load due to dependency resolution issues. Please check server logs.',
				{ status: 503 },
			)
		}

		const strategy = googleProvider.getAuthStrategy()
		if (!strategy) {
			throw new Response(
				'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.',
				{ status: 503 },
			)
		}

		// Register the strategy if it hasn't been registered yet
		// This ensures it's available even if the async registration in auth.server.ts hasn't completed
		try {
			authenticator.use(strategy, GOOGLE_PROVIDER_NAME)
		} catch {
			// Strategy might already be registered, which is fine - continue
		}
	}

	try {
		await handleMockAction(providerName, request)
		return await authenticator.authenticate(providerName, request)
	} catch (error: unknown) {
		if (error instanceof Response) {
			const formData = await request.formData()
			const rawRedirectTo = formData.get('redirectTo')
			const redirectTo =
				typeof rawRedirectTo === 'string'
					? rawRedirectTo
					: getReferrerRoute(request)
			const redirectToCookie = getRedirectCookieHeader(redirectTo)
			if (redirectToCookie) {
				error.headers.append('set-cookie', redirectToCookie)
			}
		}
		throw error
	}
}
