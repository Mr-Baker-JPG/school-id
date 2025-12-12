// import { createCookieSessionStorage } from 'react-router'
import { type ProviderName } from './connections.tsx'
import { GitHubProvider } from './providers/github.server.ts'
import { type AuthProvider } from './providers/provider.ts'
import { type Timings } from './timing.server.ts'

// Lazy-load GoogleProvider to avoid dependency issues in test environment
let googleProvider: AuthProvider | null = null
function getGoogleProvider(): AuthProvider {
	if (!googleProvider) {
		// Only import GoogleProvider when actually needed (not in test mode)
		if (
			process.env.NODE_ENV === 'test' &&
			!process.env.GOOGLE_CLIENT_ID?.startsWith('MOCK_')
		) {
			// In test mode without mock credentials, return a no-op provider
			googleProvider = {
				getAuthStrategy: () => null,
				resolveConnectionData: async () => ({
					displayName: 'Unknown',
					link: null,
				}),
				handleMockAction: async () => {},
			}
		} else {
			const { GoogleProvider } = require('./providers/google.server.ts')
			googleProvider = new GoogleProvider()
		}
	}
	if (!googleProvider) {
		throw new Error('Failed to initialize GoogleProvider')
	}
	return googleProvider
}

export const providers: Record<ProviderName, AuthProvider> = {
	github: new GitHubProvider(),
	get google() {
		return getGoogleProvider()
	},
}

export function handleMockAction(providerName: ProviderName, request: Request) {
	return providers[providerName].handleMockAction(request)
}

export function resolveConnectionData(
	providerName: ProviderName,
	providerId: string,
	options?: { timings?: Timings },
) {
	return providers[providerName].resolveConnectionData(providerId, options)
}
