// import { createCookieSessionStorage } from 'react-router'
import { type ProviderName } from './connections.tsx'
import { GitHubProvider } from './providers/github.server.ts'
import { type AuthProvider } from './providers/provider.ts'
import { type Timings } from './timing.server.ts'

// Lazy-load GoogleProvider to avoid dependency issues (remix-auth-google has module resolution issues)
let googleProvider: AuthProvider | null = null

async function loadGoogleProvider(): Promise<AuthProvider> {
	// Only import GoogleProvider when actually needed (not in test mode)
	if (
		process.env.NODE_ENV === 'test' &&
		!process.env.GOOGLE_CLIENT_ID?.startsWith('MOCK_')
	) {
		// In test mode without mock credentials, return a no-op provider
		return {
			getAuthStrategy: () => null,
			resolveConnectionData: async () => ({
				displayName: 'Unknown',
				link: null,
			}),
			handleMockAction: async () => {},
		}
	} else {
		try {
			// Use dynamic import to avoid Vite processing remix-auth-google during SSR build
			const { GoogleProvider } = await import('./providers/google.server.ts')
			return new GoogleProvider()
		} catch (error) {
			// If GoogleProvider can't be loaded (e.g., due to remix-auth-google dependency issues),
			// return a no-op provider that returns null strategy
			console.warn(
				'Failed to load GoogleProvider, using no-op provider:',
				error instanceof Error ? error.message : String(error),
			)
			const noOpProvider = {
				getAuthStrategy: () => null,
				resolveConnectionData: async () => ({
					displayName: 'Google (unavailable)',
					link: null,
				}),
				handleMockAction: async () => {},
				_isNoOp: true as const, // Marker to detect this is a no-op provider
			}
			return noOpProvider
		}
	}
}

// Eagerly start loading GoogleProvider, but don't block module initialization
// Export the promise so auth.server.ts can register the strategy after it loads
export const googleProviderInitPromise = loadGoogleProvider()
	.then((provider) => {
		googleProvider = provider
		return provider
	})
	.catch(() => {
		// Provide a fallback no-op provider if loading fails
		googleProvider = {
			getAuthStrategy: () => null,
			resolveConnectionData: async () => ({
				displayName: 'Google (unavailable)',
				link: null,
			}),
			handleMockAction: async () => {},
		}
		return googleProvider
	})

function getGoogleProvider(): AuthProvider {
	if (!googleProvider) {
		// If accessed before async load completes, provide a temporary no-op
		// This should rarely happen as the init should complete quickly
		return {
			getAuthStrategy: () => null,
			resolveConnectionData: async () => ({
				displayName: 'Google (loading...)',
				link: null,
			}),
			handleMockAction: async () => {},
		}
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
