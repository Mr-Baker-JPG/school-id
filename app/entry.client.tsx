import { startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'
import { NonceProvider } from './utils/nonce-provider.ts'

if (ENV.MODE === 'production' && ENV.SENTRY_DSN) {
	void import('./utils/monitoring.client.tsx').then(({ init }) => init())
}

// Extract nonce from the first script tag in the document
// This ensures client-side rendering matches server-side nonce values
const nonce = document.querySelector('script[nonce]')?.getAttribute('nonce') ?? ''

startTransition(() => {
	hydrateRoot(
		document,
		<NonceProvider value={nonce}>
			<HydratedRouter />
		</NonceProvider>,
	)
})
