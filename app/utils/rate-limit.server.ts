import rateLimit from 'express-rate-limit'
import type { Request, Response } from 'express'

/**
 * Creates a rate limiter specifically for the verification endpoint.
 * This rate limiter is designed to prevent abuse and scraping of the public
 * verification endpoint while allowing reasonable access.
 *
 * @param options - Configuration options for the rate limiter
 * @returns Express rate limit middleware
 */
export function createVerificationRateLimiter(options?: {
	windowMs?: number
	maxRequests?: number
	isProduction?: boolean
	isTest?: boolean
}) {
	const {
		windowMs = 60 * 1000, // 1 minute default
		maxRequests = 30, // 30 requests per minute default
		isProduction = process.env.NODE_ENV === 'production',
		isTest = process.env.NODE_ENV === 'test' ||
			!!process.env.PLAYWRIGHT_TEST_BASE_URL,
	} = options ?? {}

	// In test environments, use a very high limit to effectively disable rate limiting
	// This prevents test failures due to rate limiting
	const effectiveMaxRequests = isTest ? 10_000 : maxRequests

	// Allow configuration via environment variables
	// Environment variables are parsed as numbers by Zod schema, but we need to handle them safely
	const envWindowMs = process.env.VERIFICATION_RATE_LIMIT_WINDOW_MS
		? Number.parseInt(process.env.VERIFICATION_RATE_LIMIT_WINDOW_MS, 10)
		: undefined
	const envMaxRequests = process.env.VERIFICATION_RATE_LIMIT_MAX_REQUESTS
		? Number.parseInt(process.env.VERIFICATION_RATE_LIMIT_MAX_REQUESTS, 10)
		: undefined

	const configuredWindowMs =
		envWindowMs && !Number.isNaN(envWindowMs) ? envWindowMs : windowMs
	const configuredMaxRequests =
		envMaxRequests && !Number.isNaN(envMaxRequests)
			? envMaxRequests
			: effectiveMaxRequests

	return rateLimit({
		windowMs: configuredWindowMs,
		limit: configuredMaxRequests,
		standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
		legacyHeaders: false, // Disable `X-RateLimit-*` headers
		validate: { trustProxy: false },
		// Use Fly.io's fly-client-ip header for accurate IP detection
		// When behind a CDN, replace with CDN-specific header (e.g., cf-connecting-ip)
		keyGenerator: (req: Request) => {
			return req.get('fly-client-ip') ?? `${req.ip}`
		},
		// Custom handler for rate limit exceeded
		handler: (req: Request, res: Response) => {
			res.status(429).json({
				error: 'Too Many Requests',
				message: 'Rate limit exceeded. Please try again later.',
				retryAfter: Math.ceil(configuredWindowMs / 1000), // seconds
			})
		},
		// Skip rate limiting for certain conditions (e.g., health checks)
		skip: (req: Request) => {
			// Skip rate limiting for health check endpoints
			return req.path.includes('/resources/healthcheck')
		},
	})
}
