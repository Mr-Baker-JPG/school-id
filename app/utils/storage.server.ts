import { createHash, createHmac } from 'crypto'
import { type FileUpload } from '@mjackson/form-data-parser'
import { createId } from '@paralleldrive/cuid2'

const STORAGE_ENDPOINT = process.env.AWS_ENDPOINT_URL_S3
const STORAGE_BUCKET = process.env.BUCKET_NAME
const STORAGE_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const STORAGE_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY
const STORAGE_REGION = process.env.AWS_REGION

// #region agent log
fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		location: 'storage.server.ts:9',
		message: 'Storage env vars check',
		data: {
			endpoint: STORAGE_ENDPOINT
				? `${STORAGE_ENDPOINT.substring(0, 30)}...`
				: 'undefined',
			bucket: STORAGE_BUCKET || 'undefined',
			accessKeyDefined: !!STORAGE_ACCESS_KEY,
			accessKeyLength: STORAGE_ACCESS_KEY?.length || 0,
			secretKeyDefined: !!STORAGE_SECRET_KEY,
			region: STORAGE_REGION || 'undefined',
		},
		timestamp: Date.now(),
		sessionId: 'debug-session',
		runId: 'initial',
		hypothesisId: 'A',
	}),
}).catch(() => {})
// #endregion

async function uploadToStorage(
	file: File | FileUpload | Buffer,
	key: string,
	contentType: string = 'application/octet-stream',
) {
	// Handle Buffer separately - use same structure as File upload
	if (Buffer.isBuffer(file)) {
		const uploadDate = new Date().toISOString()
		const { url, baseHeaders } = getBaseSignedRequestInfo({
			method: 'PUT',
			key,
			contentType,
			uploadDate,
		})

		// Use exact same header structure as getSignedPutRequestInfo
		const headers = {
			...baseHeaders,
			'Content-Type': contentType,
			'X-Amz-Meta-Upload-Date': uploadDate,
		}

		const uploadResponse = await fetch(url, {
			method: 'PUT',
			headers,
			body: file,
		})

		if (!uploadResponse.ok) {
			const errorMessage = `Failed to upload file to storage. Server responded with ${uploadResponse.status}: ${uploadResponse.statusText}`
			const errorBody = await uploadResponse
				.text()
				.catch(() => 'Unable to read error body')
			console.error(errorMessage)
			console.error('Error details:', errorBody)
			console.error('Upload URL:', url)
			console.error('Headers sent:', JSON.stringify(headers, null, 2))
			throw new Error(`Failed to upload object: ${key}`)
		}

		return key
	}

	// Handle File or FileUpload
	const { url, headers } = getSignedPutRequestInfo(file, key)

	// #region agent log
	const authHeader = headers.Authorization || headers.authorization || ''
	const accessKeyFromAuth =
		authHeader.match(/Credential=([^/]+)/)?.[1] || 'not found'
	const mocksEnabled = process.env.MOCKS === 'true'
	const isMockKey = STORAGE_ACCESS_KEY === 'mock-access-key'
	fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'storage.server.ts:57',
			message: 'Before File upload - auth header check',
			data: {
				key,
				url,
				accessKeyFromAuth,
				accessKeyMatches: accessKeyFromAuth === STORAGE_ACCESS_KEY,
				authHeaderPrefix: authHeader.substring(0, 100),
				mocksEnabled,
				isMockKey,
				storageEndpoint: STORAGE_ENDPOINT,
				storageBucket: STORAGE_BUCKET,
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'B',
		}),
	}).catch(() => {})
	// #endregion

	// Warn if using mock credentials but MSW might not be intercepting
	if (isMockKey && !mocksEnabled) {
		console.warn(
			`⚠️ Storage: Using mock credentials (${STORAGE_ACCESS_KEY}) but MOCKS=false. ` +
				`MSW may not intercept requests. If upload fails, ensure MOCKS=true is set.`,
		)
	}

	// #region agent log
	fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'storage.server.ts:111',
			message: 'About to call fetch for storage upload',
			data: {
				url,
				key,
				fileSize: file instanceof File ? file.size : 'unknown',
				fileType: file instanceof File ? file.type : 'unknown',
				headersKeys: Object.keys(headers),
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'E',
		}),
	}).catch(() => {})
	// #endregion

	// Convert File to ArrayBuffer for MSW compatibility
	// MSW may not intercept requests with ReadableStream bodies properly
	// For large files, we need to handle this efficiently
	let body: ArrayBuffer | ReadableStream<Uint8Array>
	if (file instanceof File) {
		// Convert File to ArrayBuffer - MSW can intercept this
		// For large files, this conversion might take time, but it's necessary for MSW
		try {
			body = await file.arrayBuffer()
		} catch (error) {
			throw new Error(
				`Failed to read file for upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	} else {
		// For FileUpload, use the stream (this should work for real storage)
		body = file.stream()
	}

	// Add timeout to prevent hanging (increased for large files)
	const controller = new AbortController()
	const timeoutDuration =
		file instanceof File && file.size > 500000 ? 30000 : 10000 // 30s for large files, 10s otherwise
	const timeoutId = setTimeout(() => controller.abort(), timeoutDuration)

	let uploadResponse: Response
	try {
		uploadResponse = await fetch(url, {
			method: 'PUT',
			headers,
			body,
			signal: controller.signal,
		})
		clearTimeout(timeoutId)
	} catch (error) {
		clearTimeout(timeoutId)
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(
				`Storage upload timed out after ${timeoutDuration / 1000} seconds. This suggests MSW is not intercepting the request to ${url}. ` +
					`Ensure MOCKS=true is set and MSW is properly configured.`,
			)
		}
		throw error
	}

	// #region agent log
	fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'storage.server.ts:130',
			message: 'Fetch completed for storage upload',
			data: {
				url,
				key,
				status: uploadResponse.status,
				statusText: uploadResponse.statusText,
				ok: uploadResponse.ok,
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'E',
		}),
	}).catch(() => {})
	// #endregion

	if (!uploadResponse.ok) {
		const errorMessage = `Failed to upload file to storage. Server responded with ${uploadResponse.status}: ${uploadResponse.statusText}`
		const errorBody = await uploadResponse
			.text()
			.catch(() => 'Unable to read error body')

		// #region agent log
		const authHeader = headers.Authorization || headers.authorization || ''
		const accessKeyFromAuth =
			authHeader.match(/Credential=([^/]+)/)?.[1] || 'not found'
		const mocksEnabled = process.env.MOCKS === 'true'
		const isMockKey = STORAGE_ACCESS_KEY === 'mock-access-key'
		fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'storage.server.ts:68',
				message: 'Upload failed - error details',
				data: {
					status: uploadResponse.status,
					statusText: uploadResponse.statusText,
					errorBody: errorBody.substring(0, 500),
					key,
					url,
					accessKeyFromAuth,
					accessKeyMatches: accessKeyFromAuth === STORAGE_ACCESS_KEY,
					mocksEnabled,
					isMockKey,
					nodeEnv: process.env.NODE_ENV,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'initial',
				hypothesisId: 'D',
			}),
		}).catch(() => {})
		// #endregion

		// Provide helpful error message when using mock credentials but MSW isn't intercepting
		if (isMockKey && !mocksEnabled && uploadResponse.status === 403) {
			const helpfulError = new Error(
				`Storage upload failed: Using mock credentials but MSW is not intercepting requests. ` +
					`Ensure MOCKS=true is set and MSW is properly configured. ` +
					`Original error: ${errorBody.substring(0, 200)}`,
			)
			console.error(helpfulError.message)
			throw helpfulError
		}

		console.error(errorMessage)
		console.error('Error details:', errorBody)
		throw new Error(`Failed to upload object: ${key}`)
	}

	return key
}

export async function uploadProfileImage(
	userId: string,
	file: File | FileUpload,
) {
	const fileId = createId()
	const fileExtension = file.name.split('.').pop() || ''
	const timestamp = Date.now()
	const key = `users/${userId}/profile-images/${timestamp}-${fileId}.${fileExtension}`
	return uploadToStorage(file, key)
}

export async function uploadNoteImage(
	userId: string,
	noteId: string,
	file: File | FileUpload,
) {
	const fileId = createId()
	const fileExtension = file.name.split('.').pop() || ''
	const timestamp = Date.now()
	const key = `users/${userId}/notes/${noteId}/images/${timestamp}-${fileId}.${fileExtension}`
	return uploadToStorage(file, key)
}

export async function uploadEmployeePhoto(
	employeeId: string,
	file: File | FileUpload | Buffer,
	contentType: string = 'image/jpeg',
) {
	const fileId = createId()
	let fileExtension = 'jpg'

	if (Buffer.isBuffer(file)) {
		// For Buffer, use the provided contentType to determine extension
		if (contentType.includes('jpeg') || contentType.includes('jpg')) {
			fileExtension = 'jpg'
		} else if (contentType.includes('png')) {
			fileExtension = 'png'
		} else if (contentType.includes('gif')) {
			fileExtension = 'gif'
		}
	} else {
		fileExtension = file.name.split('.').pop() || 'jpg'
	}

	const timestamp = Date.now()
	const key = `employees/${employeeId}/photos/${timestamp}-${fileId}.${fileExtension}`
	return uploadToStorage(file, key, contentType)
}

export async function uploadStudentPhoto(
	studentId: string,
	file: File | FileUpload | Buffer,
	contentType: string = 'image/jpeg',
) {
	const fileId = createId()
	let fileExtension = 'jpg'

	if (Buffer.isBuffer(file)) {
		// For Buffer, use the provided contentType to determine extension
		if (contentType.includes('jpeg') || contentType.includes('jpg')) {
			fileExtension = 'jpg'
		} else if (contentType.includes('png')) {
			fileExtension = 'png'
		} else if (contentType.includes('gif')) {
			fileExtension = 'gif'
		}
	} else {
		fileExtension = file.name.split('.').pop() || 'jpg'
	}

	const timestamp = Date.now()
	const key = `students/${studentId}/photos/${timestamp}-${fileId}.${fileExtension}`
	return uploadToStorage(file, key, contentType)
}

function hmacSha256(key: string | Buffer, message: string) {
	const hmac = createHmac('sha256', key)
	hmac.update(message)
	return hmac.digest()
}

function sha256(message: string) {
	const hash = createHash('sha256')
	hash.update(message)
	return hash.digest('hex')
}

function getSignatureKey(
	key: string,
	dateStamp: string,
	regionName: string,
	serviceName: string,
) {
	const kDate = hmacSha256(`AWS4${key}`, dateStamp)
	const kRegion = hmacSha256(kDate, regionName)
	const kService = hmacSha256(kRegion, serviceName)
	const kSigning = hmacSha256(kService, 'aws4_request')
	return kSigning
}

function getBaseSignedRequestInfo({
	method,
	key,
	contentType,
	uploadDate,
}: {
	method: 'GET' | 'PUT'
	key: string
	contentType?: string
	uploadDate?: string
}) {
	const url = `${STORAGE_ENDPOINT}/${STORAGE_BUCKET}/${key}`
	const endpoint = new URL(url)

	// Prepare date strings
	const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
	const dateStamp = amzDate.slice(0, 8)

	// Build headers array conditionally
	const headers = [
		...(contentType ? [`content-type:${contentType}`] : []),
		`host:${endpoint.host}`,
		`x-amz-content-sha256:UNSIGNED-PAYLOAD`,
		`x-amz-date:${amzDate}`,
		...(uploadDate ? [`x-amz-meta-upload-date:${uploadDate}`] : []),
	]

	const canonicalHeaders = headers.join('\n') + '\n'
	const signedHeaders = headers.map((h) => h.split(':')[0]).join(';')

	const canonicalRequest = [
		method,
		`/${STORAGE_BUCKET}/${key}`,
		'', // canonicalQueryString
		canonicalHeaders,
		signedHeaders,
		'UNSIGNED-PAYLOAD',
	].join('\n')

	// Prepare string to sign
	const algorithm = 'AWS4-HMAC-SHA256'
	const credentialScope = `${dateStamp}/${STORAGE_REGION}/s3/aws4_request`
	const stringToSign = [
		algorithm,
		amzDate,
		credentialScope,
		sha256(canonicalRequest),
	].join('\n')

	// Calculate signature
	const signingKey = getSignatureKey(
		STORAGE_SECRET_KEY,
		dateStamp,
		STORAGE_REGION,
		's3',
	)
	const signature = createHmac('sha256', signingKey)
		.update(stringToSign)
		.digest('hex')

	const baseHeaders = {
		'X-Amz-Date': amzDate,
		'X-Amz-Content-SHA256': 'UNSIGNED-PAYLOAD',
		Authorization: [
			`${algorithm} Credential=${STORAGE_ACCESS_KEY}/${credentialScope}`,
			`SignedHeaders=${signedHeaders}`,
			`Signature=${signature}`,
		].join(', '),
	}

	// #region agent log
	fetch('http://127.0.0.1:7243/ingest/f8fd9c48-202b-4515-856c-d25a50a2f184', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'storage.server.ts:220',
			message: 'Signature generation complete',
			data: {
				key,
				accessKey: STORAGE_ACCESS_KEY || 'undefined',
				accessKeyLength: STORAGE_ACCESS_KEY?.length || 0,
				credentialScope,
				algorithm,
				url,
				secretKeyDefined: !!STORAGE_SECRET_KEY,
				secretKeyLength: STORAGE_SECRET_KEY?.length || 0,
			},
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'initial',
			hypothesisId: 'C',
		}),
	}).catch(() => {})
	// #endregion

	return { url, baseHeaders }
}

function getSignedPutRequestInfo(file: File | FileUpload, key: string) {
	const uploadDate = new Date().toISOString()
	const { url, baseHeaders } = getBaseSignedRequestInfo({
		method: 'PUT',
		key,
		contentType: file.type,
		uploadDate,
	})

	return {
		url,
		headers: {
			...baseHeaders,
			'Content-Type': file.type,
			'X-Amz-Meta-Upload-Date': uploadDate,
		},
	}
}

export function getSignedGetRequestInfo(key: string) {
	const { url, baseHeaders } = getBaseSignedRequestInfo({
		method: 'GET',
		key,
	})

	return {
		url,
		headers: baseHeaders,
	}
}
