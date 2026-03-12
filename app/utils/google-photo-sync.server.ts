/**
 * Google Workspace Photo Sync Service
 *
 * Syncs employee and student photos from the ID system to Google Workspace.
 * Matches users by email address and updates their profile photos.
 */

import { google } from 'googleapis'
import { prisma } from './db.server.ts'
import { getSignedGetRequestInfo } from './storage.server.ts'

export interface GooglePhotoSyncOptions {
	employeesOnly: boolean
	studentsOnly: boolean
	dryRun: boolean
	email?: string
}

export interface GooglePhotoSyncResult {
	email: string
	success: boolean
	action: 'updated' | 'skipped' | 'failed'
	error?: string
}

export interface GooglePhotoSyncSummary {
	success: boolean
	updated: number
	skipped: number
	failed: number
	errors: string[]
}

/**
 * Authenticate with Google Workspace using service account
 */
async function getGoogleAdminClient() {
	const auth = new google.auth.GoogleAuth({
		credentials: {
			client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
			private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(
				/\\n/g,
				'\n',
			),
		},
		scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
		clientOptions: {
			subject: process.env.GOOGLE_ADMIN_EMAIL?.trim(), // Impersonate admin
		},
	})

	return google.admin({ version: 'directory_v1', auth })
}

/**
 * Fetch photo from storage and convert to base64
 */
async function fetchPhotoAsBase64(photoUrl: string): Promise<string> {
	const { url, headers } = getSignedGetRequestInfo(photoUrl)
	const response = await fetch(url, { headers })

	if (!response.ok) {
		throw new Error(`Failed to fetch photo: ${response.statusText}`)
	}

	const arrayBuffer = await response.arrayBuffer()
	const buffer = Buffer.from(arrayBuffer)
	return buffer.toString('base64')
}

/**
 * Update user photo in Google Workspace
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateGoogleUserPhoto(
	adminClient: any,
	email: string,
	photoData: string,
): Promise<void> {
	await adminClient.users.photos.update({
		userKey: email,
		resource: {
			photoData,
		},
	})
}

/**
 * Sync photos to Google Workspace
 */
export async function syncPhotosToGoogle(
	options: GooglePhotoSyncOptions,
): Promise<GooglePhotoSyncSummary> {
	const results: GooglePhotoSyncResult[] = []
	const errors: string[] = []

	try {
		// Get Google Admin client
		const adminClient = await getGoogleAdminClient()

		// Sync employees
		if (!options.studentsOnly) {
			const employees = await prisma.employee.findMany({
				where: options.email ? { email: options.email } : {},
				include: {
					employeeId: true,
				},
			})

			for (const employee of employees) {
				// Skip if no photo
				if (!employee.employeeId?.photoUrl) {
					results.push({
						email: employee.email,
						success: true,
						action: 'skipped',
					})
					continue
				}

				try {
					// Fetch photo from storage
					const photoData = await fetchPhotoAsBase64(
						employee.employeeId.photoUrl,
					)

					// Update Google Workspace (or simulate in dry-run)
					if (!options.dryRun) {
						await updateGoogleUserPhoto(adminClient, employee.email, photoData)
					}

					results.push({
						email: employee.email,
						success: true,
						action: 'updated',
					})
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : 'Unknown error'
					errors.push(`${employee.email}: ${errorMessage}`)
					results.push({
						email: employee.email,
						success: false,
						action: 'failed',
						error: errorMessage,
					})
				}
			}
		}

		// Sync students
		if (!options.employeesOnly) {
			const students = await prisma.student.findMany({
				where: options.email ? { email: options.email } : {},
				include: {
					studentId: true,
				},
			})

			for (const student of students) {
				// Skip if no photo
				if (!student.studentId?.photoUrl) {
					results.push({
						email: student.email,
						success: true,
						action: 'skipped',
					})
					continue
				}

				try {
					// Fetch photo from storage
					const photoData = await fetchPhotoAsBase64(student.studentId.photoUrl)

					// Update Google Workspace (or simulate in dry-run)
					if (!options.dryRun) {
						await updateGoogleUserPhoto(adminClient, student.email, photoData)
					}

					results.push({
						email: student.email,
						success: true,
						action: 'updated',
					})
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : 'Unknown error'
					errors.push(`${student.email}: ${errorMessage}`)
					results.push({
						email: student.email,
						success: false,
						action: 'failed',
						error: errorMessage,
					})
				}
			}
		}

		const updated = results.filter((r) => r.action === 'updated').length
		const skipped = results.filter((r) => r.action === 'skipped').length
		const failed = results.filter((r) => r.action === 'failed').length

		return {
			success: failed === 0,
			updated,
			skipped,
			failed,
			errors,
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error'
		return {
			success: false,
			updated: 0,
			skipped: 0,
			failed: 0,
			errors: [errorMessage],
		}
	}
}
