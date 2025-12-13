import { promises as fs, constants } from 'node:fs'
import { invariantResponse } from '@epic-web/invariant'
import { getImgResponse } from 'openimg/node'
import { getDomainUrl } from '#app/utils/misc.tsx'
import { getSignedGetRequestInfo } from '#app/utils/storage.server.ts'
import { type Route } from './+types/images'

let cacheDir: string | null = null

async function getCacheDir() {
	if (cacheDir) return cacheDir

	let dir = './tests/fixtures/openimg'
	if (process.env.NODE_ENV === 'production') {
		const isAccessible = await fs
			.access('/data', constants.W_OK)
			.then(() => true)
			.catch(() => false)

		if (isAccessible) {
			dir = '/data/images'
		}
	}

	return (cacheDir = dir)
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const searchParams = url.searchParams

	const headers = new Headers()
	// Set appropriate cache headers based on environment
	if (process.env.NODE_ENV === 'development') {
		headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
		headers.set('Pragma', 'no-cache')
		headers.set('Expires', '0')
	} else {
		headers.set('Cache-Control', 'public, max-age=31536000, immutable')
	}

	const objectKey = searchParams.get('objectKey')

	// #region agent log
	fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'resources/images.tsx:28',
			message: 'Image loader started',
			data: { objectKey, url: url.toString() },
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'F',
		}),
	}).catch(() => {})
	// #endregion

	try {
		// For storage images (objectKey), fetch directly from MSW to avoid getImgResponse hanging
		// This bypasses openimg optimization which seems to hang with MSW
		if (objectKey) {
			const { url: signedUrl, headers: signedHeaders } =
				getSignedGetRequestInfo(objectKey)

			// #region agent log
			fetch(
				'http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'resources/images.tsx:66',
						message:
							'Fetching image directly from storage (bypassing getImgResponse)',
						data: { objectKey, signedUrl },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'initial',
						hypothesisId: 'F',
					}),
				},
			).catch(() => {})
			// #endregion

			// Fetch directly from storage with timeout
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

			try {
				const imageResponse = await fetch(signedUrl, {
					headers: signedHeaders,
					signal: controller.signal,
				})
				clearTimeout(timeoutId)

				if (!imageResponse.ok) {
					throw new Response('Failed to fetch image', {
						status: imageResponse.status,
					})
				}

				// Get the content type and length from the response
				const contentType =
					imageResponse.headers.get('content-type') || 'image/jpeg'
				const contentLength = imageResponse.headers.get('content-length')

				// Convert to ArrayBuffer - this ensures the data is fully loaded
				const imageArrayBuffer = await imageResponse.arrayBuffer()

				// Validate image data - check for valid JPEG header (FF D8 FF)
				const uint8Array = new Uint8Array(imageArrayBuffer)
				const isValidJpeg =
					uint8Array.length >= 3 &&
					uint8Array[0] === 0xff &&
					uint8Array[1] === 0xd8 &&
					uint8Array[2] === 0xff

				// #region agent log
				fetch(
					'http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184',
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'resources/images.tsx:95',
							message: 'Image fetched successfully from storage',
							data: {
								objectKey,
								contentType,
								contentLength,
								imageSize: imageArrayBuffer.byteLength,
								isValidJpeg,
								firstBytes: Array.from(uint8Array.slice(0, 10)),
							},
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'initial',
							hypothesisId: 'F',
						}),
					},
				).catch(() => {})
				// #endregion

				if (!isValidJpeg && contentType.includes('jpeg')) {
					console.warn(
						`Invalid JPEG data for objectKey ${objectKey}: expected JPEG header (FF D8 FF), got ${Array.from(
							uint8Array.slice(0, 3),
						)
							.map((b) => `0x${b.toString(16).padStart(2, '0')}`)
							.join(' ')}`,
					)
				}

				// Return the image as Blob with proper headers
				// Note: Browser should handle JPEG even if AVIF was requested in query params
				// Using Blob ensures proper browser compatibility
				const imageBlob = new Blob([imageArrayBuffer], { type: contentType })

				// Create response headers explicitly
				const responseHeaders = new Headers(headers)
				responseHeaders.set('Content-Type', contentType)
				responseHeaders.set('Content-Length', imageBlob.size.toString())
				// Add CORS headers to ensure browser can load the image
				responseHeaders.set('Access-Control-Allow-Origin', '*')
				responseHeaders.set('Access-Control-Allow-Methods', 'GET')

				const response = new Response(imageBlob, {
					status: 200,
					statusText: 'OK',
					headers: responseHeaders,
				})

				// #region agent log
				fetch(
					'http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184',
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'resources/images.tsx:130',
							message: 'Response created, about to return',
							data: {
								objectKey,
								responseStatus: response.status,
								contentType: response.headers.get('content-type'),
								contentLength: response.headers.get('content-length'),
							},
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'initial',
							hypothesisId: 'F',
						}),
					},
				).catch(() => {})
				// #endregion

				// #region agent log
				fetch(
					'http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184',
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'resources/images.tsx:199',
							message: 'About to return response',
							data: {
								objectKey,
								responseStatus: response.status,
								contentType: response.headers.get('content-type'),
								contentLength: response.headers.get('content-length'),
								hasBody: !!response.body,
							},
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'initial',
							hypothesisId: 'F',
						}),
					},
				).catch(() => {})
				// #endregion

				return response
			} catch (error) {
				clearTimeout(timeoutId)
				if (error instanceof Error && error.name === 'AbortError') {
					throw new Response('Image fetch timeout', { status: 504 })
				}
				throw error
			}
		}

		// For non-storage images, use getImgResponse as normal
		const response = await getImgResponse(request, {
			headers,
			allowlistedOrigins: [
				getDomainUrl(request),
				process.env.AWS_ENDPOINT_URL_S3,
			].filter(Boolean),
			cacheFolder: await getCacheDir(),
			getImgSource: () => {
				const src = searchParams.get('src')
				invariantResponse(src, 'src query parameter is required', {
					status: 400,
				})

				if (URL.canParse(src)) {
					// Fetch image from external URL; will be matched against allowlist
					return {
						type: 'fetch',
						url: src,
					}
				}
				// Retrieve image from filesystem (public folder)
				if (src.startsWith('/assets')) {
					// Files managed by Vite
					return {
						type: 'fs',
						path: '.' + src,
					}
				}
				// Fallback to files in public folder
				return {
					type: 'fs',
					path: './public' + src,
				}
			},
		})

		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'resources/images.tsx:140',
				message: 'Image loader completed successfully (non-storage image)',
				data: { objectKey, status: response.status },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'initial',
				hypothesisId: 'F',
			}),
		}).catch(() => {})
		// #endregion

		return response
	} catch (error) {
		// #region agent log
		fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'resources/images.tsx:130',
				message: 'Image loader error',
				data: {
					objectKey,
					error: error instanceof Error ? error.message : 'Unknown error',
					errorName: error instanceof Error ? error.name : 'Unknown',
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'initial',
				hypothesisId: 'F',
			}),
		}).catch(() => {})
		// #endregion

		throw error
	}
}
