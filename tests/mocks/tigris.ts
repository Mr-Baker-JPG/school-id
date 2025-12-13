import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { invariantResponse } from '@epic-web/invariant'
import { lookup as getMimeType } from 'mime-types'
import { http, HttpResponse } from 'msw'

// Ensure we have a valid URL by explicitly creating it from the import.meta.url
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures')
const MOCK_STORAGE_DIR = path.join(FIXTURES_DIR, 'uploaded')
const FIXTURES_IMAGES_DIR = path.join(FIXTURES_DIR, 'images')
const STORAGE_ENDPOINT = process.env.AWS_ENDPOINT_URL_S3
const STORAGE_BUCKET = process.env.BUCKET_NAME
const STORAGE_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID

// Log the handler pattern for debugging
if (process.env.NODE_ENV !== 'test') {
	console.log(
		`🔶 MSW Tigris handler pattern: ${STORAGE_ENDPOINT}/${STORAGE_BUCKET}/:key*`,
	)
}

function validateAuth(headers: Headers) {
	const authHeader = headers.get('Authorization')
	const amzDate = headers.get('X-Amz-Date')
	const amzContentSha256 = headers.get('X-Amz-Content-SHA256')

	if (!authHeader || !amzDate || !amzContentSha256) return false
	if (!authHeader.startsWith('AWS4-HMAC-SHA256')) return false
	if (amzContentSha256 !== 'UNSIGNED-PAYLOAD') return false

	// For mocking purposes, we'll just verify the credential contains our access key
	// A full validation would verify the signature, but that's complex and unnecessary for tests
	if (authHeader.includes(`Credential=${STORAGE_ACCESS_KEY}/`)) return true

	return false
}

function assertKey(key: any): asserts key is Array<string> {
	invariantResponse(
		Array.isArray(key) && key.length && key.every((k) => typeof k === 'string'),
		'Key must contain a directory',
	)
}

export const handlers = [
	// Use the exact URL pattern - MSW should match this
	http.put(
		`${STORAGE_ENDPOINT}/${STORAGE_BUCKET}/:key*`,
		async ({ request, params }) => {
			console.log(
				`🔶 MSW Tigris PUT handler matched: ${request.url}, key: ${JSON.stringify(params.key)}`,
			)

			if (!validateAuth(request.headers)) {
				console.warn(`🔶 MSW Tigris: Auth validation failed for ${request.url}`)
				return new HttpResponse('Unauthorized', { status: 401 })
			}
			const { key } = params

			assertKey(key)

			const filePath = path.join(MOCK_STORAGE_DIR, ...key)
			const parentDir = path.dirname(filePath)
			await fs.mkdir(parentDir, { recursive: true })

			const fileBuffer = Buffer.from(await request.arrayBuffer())
			await fs.writeFile(filePath, fileBuffer)

			console.log(
				`🔶 MSW Tigris: Successfully saved file to ${filePath} (${fileBuffer.length} bytes)`,
			)
			return new HttpResponse(null, { status: 201 })
		},
	),

	http.get(
		`${STORAGE_ENDPOINT}/${STORAGE_BUCKET}/:key*`,
		async ({ request, params }) => {
			console.log(
				`🔶 MSW Tigris GET handler matched: ${request.url}, key: ${JSON.stringify(params.key)}`,
			)
			const { key } = params
			assertKey(key)

			const filePath = path.join(MOCK_STORAGE_DIR, ...key)

			// For employee photos, always return a valid minimal JPEG
			// This ensures browsers can display the image even if cached files are invalid
			if (key[0] === 'employees' && key[2] === 'photos') {
				const minimalJpegBase64 =
					'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
				const file = Buffer.from(minimalJpegBase64, 'base64')
				const contentType =
					getMimeType(key.at(-1) || '') || 'application/octet-stream'
				return new HttpResponse(file, {
					headers: {
						'Content-Type': contentType,
						'Content-Length': file.length.toString(),
						'Cache-Control': 'public, max-age=31536000, immutable',
					},
				})
			}

			// For other files, use the normal logic
			try {
				// Check tests/fixtures/images directory first
				const testFixturesPath = path.join(FIXTURES_IMAGES_DIR, ...key)
				let file: Buffer
				try {
					file = await fs.readFile(testFixturesPath)
				} catch {
					// If not found in test fixtures, try original path
					file = await fs.readFile(filePath)
				}

				const contentType =
					getMimeType(key.at(-1) || '') || 'application/octet-stream'
				return new HttpResponse(file, {
					headers: {
						'Content-Type': contentType,
						'Content-Length': file.length.toString(),
						'Cache-Control': 'public, max-age=31536000, immutable',
					},
				})
			} catch {
				return new HttpResponse('Not found', { status: 404 })
			}
		},
	),
]
