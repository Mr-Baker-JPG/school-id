/**
 * Google Workspace Photo Sync Script
 *
 * CLI wrapper for syncing employee and student photos to Google Workspace.
 *
 * Usage:
 *   npm run sync-photos:google
 *   npm run sync-photos:google -- --employees-only
 *   npm run sync-photos:google -- --students-only
 *   npm run sync-photos:google -- --dry-run
 *   npm run sync-photos:google -- --email=user@example.com
 */

import {
	syncPhotosToGoogle,
	type GooglePhotoSyncOptions,
} from '#app/utils/google-photo-sync.server.ts'

/**
 * CLI entry point
 */
async function main() {
	const args = process.argv.slice(2)
	const options: GooglePhotoSyncOptions = {
		employeesOnly: args.includes('--employees-only'),
		studentsOnly: args.includes('--students-only'),
		dryRun: args.includes('--dry-run'),
		email: args.find((arg) => arg.startsWith('--email='))?.split('=')[1],
	}

	console.log('Starting Google Workspace photo sync...')
	console.log('Options:', options)

	const result = await syncPhotosToGoogle(options)

	console.log('\n=== Sync Results ===')
	console.log(`Updated: ${result.updated}`)
	console.log(`Skipped: ${result.skipped}`)
	console.log(`Failed: ${result.failed}`)

	if (result.errors.length > 0) {
		console.log('\nErrors:')
		result.errors.forEach((err) => console.log(`  ✗ ${err}`))
	}

	process.exit(result.success ? 0 : 1)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
