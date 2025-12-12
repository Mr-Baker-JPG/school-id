import { SetCookie } from '@mjackson/headers'
import { createId as cuid } from '@paralleldrive/cuid2'
import { redirect } from 'react-router'
import { type Strategy } from 'remix-auth/strategy'
import { GoogleStrategy } from 'remix-auth-google'
import { z } from 'zod'
import { cache, cachified } from '../cache.server.ts'
import { validateEmailDomain } from '../email-domain-validation.server.ts'
import { type Timings } from '../timing.server.ts'
import { MOCK_CODE_GOOGLE_HEADER, MOCK_CODE_GOOGLE } from './constants.ts'
import { type AuthProvider, type ProviderUser } from './provider.ts'

const GoogleUserSchema = z.object({ email: z.string() })
const GoogleUserParseResult = z
	.object({
		success: z.literal(true),
		data: GoogleUserSchema,
	})
	.or(
		z.object({
			success: z.literal(false),
		}),
	)

const shouldMock =
	process.env.GOOGLE_CLIENT_ID?.startsWith('MOCK_') ||
	process.env.NODE_ENV === 'test'

export class GoogleProvider implements AuthProvider {
	getAuthStrategy(): Strategy<ProviderUser, any> | null {
		if (
			!process.env.GOOGLE_CLIENT_ID ||
			!process.env.GOOGLE_CLIENT_SECRET ||
			!process.env.GOOGLE_REDIRECT_URI
		) {
			console.log(
				'Google OAuth strategy not available because environment variables are not set',
			)
			return null
		}

		return new GoogleStrategy(
			{
				clientID: process.env.GOOGLE_CLIENT_ID,
				clientSecret: process.env.GOOGLE_CLIENT_SECRET,
				callbackURL: process.env.GOOGLE_REDIRECT_URI,
			},
			async ({
				accessToken,
				profile,
			}: {
				accessToken: string
				profile: any
			}) => {
				// Google profile includes email, name, and picture
				const email = profile.emails?.[0]?.value
				if (!email) {
					throw new Error('Email not found in Google profile')
				}

				// Validate email domain restriction
				if (!validateEmailDomain(email)) {
					const allowedDomain = getAllowedEmailDomain()
					throw new Error(
						`Email domain not allowed. Only ${allowedDomain} email addresses are permitted.`,
					)
				}

				return {
					id: profile.id,
					email: email.toLowerCase(),
					name: profile.displayName,
					username: profile.emails?.[0]?.value.split('@')[0],
					imageUrl: profile.photos?.[0]?.value,
				}
			},
		) as unknown as Strategy<ProviderUser, any>
	}

	async resolveConnectionData(
		providerId: string,
		{ timings }: { timings?: Timings } = {},
	) {
		// Google doesn't provide a public API endpoint to fetch user by ID
		// without additional scopes, so we'll return a basic response
		const result = await cachified({
			key: `connection-data:google:${providerId}`,
			cache,
			timings,
			ttl: 1000 * 60,
			swr: 1000 * 60 * 60 * 24 * 7,
			async getFreshValue(context) {
				// Since we can't easily fetch Google user data by ID without tokens,
				// we'll return a basic structure
				const result = GoogleUserSchema.safeParse({ email: 'unknown' })
				if (!result.success) {
					context.metadata.ttl = 0
				}
				return result
			},
			checkValue: GoogleUserParseResult,
		})
		return {
			displayName: result.success ? result.data.email : 'Unknown',
			link: null,
		} as const
	}

	async handleMockAction(request: Request): Promise<void> {
		if (!shouldMock) return

		const state = cuid()
		// allows us to inject a code when running e2e tests,
		// but falls back to a pre-defined 🐨 constant
		const code =
			request.headers.get(MOCK_CODE_GOOGLE_HEADER) || MOCK_CODE_GOOGLE
		const searchParams = new URLSearchParams({ code, state })
		let cookie = new SetCookie({
			name: 'google',
			value: searchParams.toString(),
			path: '/',
			sameSite: 'Lax',
			httpOnly: true,
			maxAge: 60 * 10,
			secure: process.env.NODE_ENV === 'production' || undefined,
		})
		throw redirect(`/auth/google/callback?${searchParams}`, {
			headers: {
				'Set-Cookie': cookie.toString(),
			},
		})
	}
}
