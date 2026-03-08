/**
 * @vitest-environment jsdom
 */
import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { meta } from './index.tsx'
import Index from './index.tsx'

test('Landing page displays brief system information', () => {
	const App = createRoutesStub([
		{
			path: '/',
			Component: Index,
		},
	])

	render(<App initialEntries={['/']} />)

	expect(screen.getByText('JPG ID System')).toBeInTheDocument()
	expect(
		screen.getByText(/Access your official ID card\. View, download/i),
	).toBeInTheDocument()
	expect(
		screen.getByText(/This system is for internal use by school/i),
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
	expect(metaData).toContainEqual({ title: 'JPG ID System' })
})


