/**
 * @vitest-environment jsdom
 */
import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { meta } from './index.tsx'
import Index from './index.tsx'
import { APP_NAME } from '#app/ui/brand.ts'

test('Landing page displays brief system information', () => {
	const App = createRoutesStub([
		{
			path: '/',
			Component: Index,
		},
	])

	render(<App initialEntries={['/']} />)

	expect(screen.getByText(APP_NAME)).toBeInTheDocument()
	expect(
		screen.getByText(/Access your official.*ID card/i),
	).toBeInTheDocument()
})

test('Landing page displays login button when Google is not enabled', () => {
	const App = createRoutesStub([
		{
			path: '/',
			Component: Index,
		},
	])

	render(<App initialEntries={['/']} />)

	// When Google is not enabled, show a standard login link
	const loginLink = screen.getByRole('link', { name: /log in/i })
	expect(loginLink).toBeInTheDocument()
	expect(loginLink).toHaveAttribute('href', '/login')
})

test('Landing page has correct meta title', () => {
	const metaData = meta({ data: {}, params: {}, location: {} } as any)
	expect(metaData).toContainEqual({ title: APP_NAME })
})
