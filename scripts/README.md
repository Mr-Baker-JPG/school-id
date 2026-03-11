# Google Workspace Photo Sync

Syncs employee and student photos from the ID system to Google Workspace user accounts.

## Setup

### 1. Google Cloud Project Setup

1. Create a Google Cloud project (or use existing)
2. Enable the Admin SDK API
3. Create a Service Account with domain-wide delegation
4. Download the service account JSON key
5. In Google Admin Console, grant domain-wide delegation to the service account with the following OAuth scopes:
   - `https://www.googleapis.com/auth/admin.directory.user`

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Google Workspace Integration
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
GOOGLE_ADMIN_EMAIL="admin@jpgacademy.org"
```

**Important:** 
- The `GOOGLE_ADMIN_EMAIL` should be a super admin account that the service account will impersonate
- The private key should include the `\n` characters for line breaks

## Usage

### Sync all photos (employees and students)
```bash
npm run sync-photos:google
```

### Sync only employees
```bash
npm run sync-photos:google -- --employees-only
```

### Sync only students
```bash
npm run sync-photos:google -- --students-only
```

### Dry-run mode (preview changes without updating)
```bash
npm run sync-photos:google -- --dry-run
```

### Sync a specific user by email
```bash
npm run sync-photos:google -- --email=user@jpgacademy.org
```

### Combine options
```bash
# Dry-run for a specific employee
npm run sync-photos:google -- --employees-only --email=teacher@jpgacademy.org --dry-run
```

## Output

The script provides detailed feedback:

```
Starting Google Workspace photo sync...
Options: { employeesOnly: false, studentsOnly: false, dryRun: false }

=== Sync Results ===
Updated: 15
Skipped: 5
Failed: 2

Updated users:
  ✓ teacher1@jpgacademy.org
  ✓ teacher2@jpgacademy.org
  ...

Skipped users (no photo):
  - teacher10@jpgacademy.org
  - teacher11@jpgacademy.org
  ...

Failed users:
  ✗ teacher20@jpgacademy.org: User not found in Google Workspace
  ✗ teacher21@jpgacademy.org: Failed to fetch photo from storage
```

## How It Works

1. **Fetches users from database**: Queries employees and/or students with photos
2. **Downloads photos**: Retrieves photos from Tigris storage
3. **Converts to base64**: Prepares photos for Google API
4. **Updates Google Workspace**: Calls Admin SDK to update user photos
5. **Reports results**: Shows success/failure/skipped for each user

## Error Handling

The script continues processing even if individual users fail:

- **Missing photo**: Skips user, continues with next
- **Google user not found**: Reports error, continues with next
- **Photo fetch failure**: Reports error, continues with next
- **API rate limit**: Will fail individual request, continue with next

## Exit Codes

- `0`: All users processed successfully (or skipped)
- `1`: One or more users failed to process

## Testing

Run the test suite:

```bash
npm run test -- scripts/sync-google-photos.test.ts
```

## Troubleshooting

### "Authentication error"
- Verify service account credentials are correct
- Check that domain-wide delegation is enabled
- Ensure the admin email has necessary permissions

### "User not found"
- The email in the ID system doesn't match a Google Workspace user
- Check for typos or domain mismatches

### "Failed to fetch photo"
- Photo URL exists but file is inaccessible in storage
- Check storage permissions and file integrity

### "Permission denied"
- Service account lacks domain-wide delegation
- OAuth scope not granted in Admin Console
- Admin email doesn't have sufficient privileges

## Security Notes

- Service account credentials should be kept secure
- Never commit `.env` file to version control
- Use environment variables in production
- Regularly rotate service account keys
- Audit domain-wide delegation permissions periodically
