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

test('Landing page displays embedded login form', () => {
	const App = createRoutesStub([
		{
			path: '/',
			Component: Index,
		},
	])

	render(<App initialEntries={['/']} />)

	// Check for Google OAuth login button
	const loginButton = screen.getByRole('button', { name: /login with google/i })
	expect(loginButton).toBeInTheDocument()
})

test('Landing page has correct meta title', () => {
	const metaData = meta({ data: {}, params: {}, location: {} } as any)
	expect(metaData).toContainEqual({ title: APP_NAME })
})
