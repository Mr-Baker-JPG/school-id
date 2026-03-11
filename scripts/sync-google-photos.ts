/**
 * Google Workspace Photo Sync Script
 * 
 * Syncs employee and student photos from the ID system to Google Workspace.
 * Matches users by email address and updates their profile photos.
 * 
 * Usage:
 *   npm run sync-photos:google
 *   npm run sync-photos:google -- --employees-only
 *   npm run sync-photos:google -- --students-only
 *   npm run sync-photos:google -- --dry-run
 *   npm run sync-photos:google -- --email=user@example.com
 */

import { google } from 'googleapis'
import { prisma } from '#app/utils/db.server.ts'
import { getSignedGetRequestInfo } from '#app/utils/storage.server.ts'

export interface SyncOptions {
	employeesOnly: boolean
	studentsOnly: boolean
	dryRun: boolean
	email?: string
}

export interface SyncResult {
	email: string
	success: boolean
	action: 'updated' | 'skipped' | 'failed'
	error?: string
}

/**
 * Authenticate with Google Workspace using service account
 */
async function getGoogleAdminClient() {
	const auth = new google.auth.GoogleAuth({
		credentials: {
			client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
			private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
				/\\n/g,
				'\n',
			),
		},
		scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
		clientOptions: {
			subject: process.env.GOOGLE_ADMIN_EMAIL, // Impersonate admin
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
async function updateGoogleUserPhoto(
	adminClient: ReturnType<typeof google.admin>,
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
	options: SyncOptions,
): Promise<SyncResult[]> {
	const results: SyncResult[] = []

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
				results.push({
					email: employee.email,
					success: false,
					action: 'failed',
					error: error instanceof Error ? error.message : 'Unknown error',
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
				results.push({
					email: student.email,
					success: false,
					action: 'failed',
					error: error instanceof Error ? error.message : 'Unknown error',
				})
			}
		}
	}

	return results
}

/**
 * CLI entry point
 */
async function main() {
	const args = process.argv.slice(2)
	const options: SyncOptions = {
		employeesOnly: args.includes('--employees-only'),
		studentsOnly: args.includes('--students-only'),
		dryRun: args.includes('--dry-run'),
		email: args.find((arg) => arg.startsWith('--email='))?.split('=')[1],
	}

	console.log('Starting Google Workspace photo sync...')
	console.log('Options:', options)

	try {
		const results = await syncPhotosToGoogle(options)

		// Report results
		const updated = results.filter((r) => r.action === 'updated')
		const skipped = results.filter((r) => r.action === 'skipped')
		const failed = results.filter((r) => r.action === 'failed')

		console.log('\n=== Sync Results ===')
		console.log(`Updated: ${updated.length}`)
		console.log(`Skipped: ${skipped.length}`)
		console.log(`Failed: ${failed.length}`)

		if (updated.length > 0) {
			console.log('\nUpdated users:')
			updated.forEach((r) => console.log(`  ✓ ${r.email}`))
		}

		if (skipped.length > 0) {
			console.log('\nSkipped users (no photo):')
			skipped.forEach((r) => console.log(`  - ${r.email}`))
		}

		if (failed.length > 0) {
			console.log('\nFailed users:')
			failed.forEach((r) =>
				console.log(`  ✗ ${r.email}: ${r.error || 'Unknown error'}`),
			)
		}

		process.exit(failed.length > 0 ? 1 : 0)
	} catch (error) {
		console.error('Sync failed:', error)
		process.exit(1)
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
