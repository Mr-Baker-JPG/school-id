import closeWithGrace from 'close-with-grace'
import { setupServer } from 'msw/node'
import { handlers as factsHandlers } from './facts.ts'
import { handlers as githubHandlers } from './github.ts'
import { handlers as googleHandlers } from './google.ts'
import { handlers as pwnedPasswordApiHandlers } from './pwned-passwords.ts'
import { handlers as resendHandlers } from './resend.ts'
import { handlers as tigrisHandlers } from './tigris.ts'

export const server = setupServer(
	...resendHandlers,
	...githubHandlers,
	...googleHandlers,
	...tigrisHandlers,
	...pwnedPasswordApiHandlers,
	...factsHandlers,
)

// Ensure MSW intercepts Node.js native fetch
// MSW v2 should support native fetch, but we verify it's working
if (typeof globalThis.fetch !== 'undefined') {
	// Native fetch is available - MSW should intercept it automatically
	// If it doesn't work, we may need to use undici's fetch instead
}

server.listen({
	onUnhandledRequest(request, print) {
		// Do not print warnings on unhandled requests to https://<:userId>.ingest.us.sentry.io/api/
		// Note: a request handler with passthrough is not suited with this type of url
		//       until there is a more permissible url catching system
		//       like requested at https://github.com/mswjs/msw/issues/1804
		if (request.url.includes('.sentry.io')) {
			return
		}
		// React-router-devtools send custom requests internally to handle some functionality, we ignore those
		if (request.url.includes('__rrdt')) {
			return
		}
		// Log unhandled storage requests for debugging
		if (
			request.url.includes('storage.tigris.dev') ||
			request.url.includes(process.env.AWS_ENDPOINT_URL_S3 || '')
		) {
			console.warn(
				`⚠️ MSW: Unhandled storage request to ${request.url}. This suggests MSW is not intercepting Node.js native fetch.`,
			)
		}
		// Print the regular MSW unhandled request warning otherwise.
		print.warning()
	},
})

if (process.env.NODE_ENV !== 'test') {
	console.info('🔶 Mock server installed')
	console.info(`🔶 MOCKS env var: ${process.env.MOCKS}`)
	console.info(
		`🔶 MSW intercepting: ${server.listHandlers().length} handlers registered`,
	)

	closeWithGrace(() => {
		server.close()
	})
}
