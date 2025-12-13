# Application Route Structure

This document describes the functionality of each route in the Employee ID
System application. This is intended for use with UX designers to develop the
application layout.

## Table of Contents

1. [Public/Marketing Routes](#publicmarketing-routes)
2. [Authentication Routes](#authentication-routes)
3. [Employee Routes](#employee-routes)
4. [Admin Routes](#admin-routes)
5. [User Profile & Settings Routes](#user-profile--settings-routes)
6. [Verification Routes](#verification-routes)
7. [Resource Routes](#resource-routes)
8. [Utility Routes](#utility-routes)

---

## Public/Marketing Routes

### `/` (Home/Landing Page)

**Route:** `app/routes/_marketing/index.tsx`

**Purpose:** Public landing page for the Employee ID System

**Functionality:**

- Displays welcome message and system description
- Explains that the system is for internal school employee use
- Mentions that external parties can verify employee status via QR codes
- Provides Google OAuth login button for employees
- No authentication required

**UI Elements:**

- Page title: "Employee ID System"
- Description text explaining the system purpose
- Google OAuth login button/form

---

### `/about`

**Route:** `app/routes/_marketing/about.tsx`

**Purpose:** About page (currently minimal implementation)

**Functionality:**

- Basic about page placeholder
- No authentication required

---

### `/privacy`

**Route:** `app/routes/_marketing/privacy.tsx`

**Purpose:** Privacy policy page

**Functionality:**

- Displays privacy policy information
- No authentication required

---

### `/tos`

**Route:** `app/routes/_marketing/tos.tsx`

**Purpose:** Terms of Service page

**Functionality:**

- Displays terms of service
- No authentication required

---

### `/support`

**Route:** `app/routes/_marketing/support.tsx`

**Purpose:** Support/help page

**Functionality:**

- Displays support information
- No authentication required

---

## Authentication Routes

### `/login`

**Route:** `app/routes/_auth/login.tsx`

**Purpose:** User login page

**Functionality:**

- Username/password login form
- "Remember me" checkbox
- "Forgot password?" link
- Passkey/WebAuthn login option
- OAuth provider login options (Google, etc.)
- Link to signup page
- Supports `redirectTo` query parameter for post-login navigation
- Requires user to be anonymous (redirects if already logged in)

**UI Elements:**

- Page title: "Welcome back!"
- Username input field
- Password input field
- Remember me checkbox
- Forgot password link
- Passkey login button
- OAuth provider buttons
- "New here? Create an account" link

---

### `/signup`

**Route:** `app/routes/_auth/signup.tsx`

**Purpose:** User signup/registration page

**Functionality:**

- Email input form
- Sends verification email with OTP code
- OAuth provider signup options
- Redirects to verification page after email submission
- Requires user to be anonymous

**UI Elements:**

- Page title: "Let's start your journey!"
- Email input field
- Submit button
- OAuth provider signup buttons

---

### `/forgot-password`

**Route:** `app/routes/_auth/forgot-password.tsx`

**Purpose:** Password recovery initiation

**Functionality:**

- Username or email input
- Sends password reset email with OTP code
- Redirects to verification page after submission
- Link back to login page

**UI Elements:**

- Page title: "Forgot Password"
- Username or email input field
- "Recover password" button
- "Back to Login" link

---

### `/reset-password`

**Route:** `app/routes/_auth/reset-password.tsx`

**Purpose:** Password reset form (after email verification)

**Functionality:**

- New password input
- Confirm password input
- Validates password strength (checks against common passwords)
- Requires valid verification session from email link
- Redirects to login after successful reset

**UI Elements:**

- Page title: "Password Reset"
- Greeting with username
- New password input
- Confirm password input
- "Reset password" button

---

### `/verify`

**Route:** `app/routes/_auth/verify.tsx`

**Purpose:** Email/OTP verification page

**Functionality:**

- 6-digit OTP code input
- Supports multiple verification types:
  - `onboarding`: New user account setup
  - `reset-password`: Password reset
  - `change-email`: Email change verification
  - `2fa`: Two-factor authentication
- Validates code and redirects based on verification type
- Accepts code via query parameter or form input

**UI Elements:**

- Dynamic heading based on verification type
- 6-digit OTP input field
- Submit button
- Error messages for invalid codes

---

### `/onboarding`

**Route:** `app/routes/_auth/onboarding/index.tsx`

**Purpose:** New user account setup (after email verification)

**Functionality:**

- Username input (must be unique, lowercase)
- Name input
- Password and confirm password inputs
- Terms of Service and Privacy Policy agreement checkbox
- "Remember me" checkbox
- Creates user account and logs them in
- Requires valid verification session from email
- Supports `redirectTo` query parameter

**UI Elements:**

- Page title: "Welcome aboard {email}!"
- Username input
- Name input
- Password input
- Confirm password input
- Terms agreement checkbox
- Remember me checkbox
- "Create an account" button

---

### `/logout`

**Route:** `app/routes/_auth/logout.tsx`

**Purpose:** User logout endpoint

**Functionality:**

- POST endpoint that destroys user session
- Redirects to home page or specified redirect URL
- No UI (action-only route)

---

## Employee Routes

### `/employee/id`

**Route:** `app/routes/employee/id.tsx`

**Purpose:** Employee's own ID card preview page

**Functionality:**

- Displays employee's own ID card preview (front and back)
- Shows employee photo, name, job title, email
- Displays QR code on back of card
- Shows expiration date
- Download button for PDF ID card
- Automatically fetches employee record by matching authenticated user's email
- Creates EmployeeID record if it doesn't exist
- Attempts to fetch photo from FACTS if no uploaded photo exists
- Requires authentication

**UI Elements:**

- Page title: "My Employee ID"
- ID card front preview (with photo, name, job title, branding)
- ID card back preview (with QR code)
- Expiration date display
- "Download ID Card (PDF)" button

**Data Displayed:**

- Employee full name
- Job title
- Email
- Photo (if available)
- Expiration date
- QR code for verification

---

### `/employee/id/download`

**Route:** `app/routes/employee/id/download.tsx`

**Purpose:** PDF download endpoint for employee's own ID card

**Functionality:**

- Generates and downloads PDF of employee's ID card
- Only accessible to the employee themselves (enforced by email matching)
- Creates EmployeeID record if missing
- Returns PDF file with proper headers
- Requires authentication

**Response:**

- PDF file download
- Filename: `employee-id-{sisEmployeeId}.pdf`

---

## Admin Routes

### `/admin/employees`

**Route:** `app/routes/admin/employees/index.tsx`

**Purpose:** Employee management dashboard for administrators

**Functionality:**

- Lists all employees in a table
- Search functionality (by name or email)
- Status filter (all/active/inactive)
- Displays employee information:
  - Name (clickable link to detail page)
  - Job title
  - Email
  - Status badge (active/inactive)
  - Expiration date (clickable link to expiration page)
  - Expiration status warnings (expiring within 30 days, expired)
  - Photo status (has photo/no photo)
- "Sync from FACTS" button to manually trigger employee sync
- "Recheck" button per employee to refresh FACTS profile picture
- Expiration warnings banner showing count of expiring/expired IDs
- Requires admin role

**UI Elements:**

- Page title: "Employee Management"
- "Sync from FACTS" button (top right)
- Expiration warnings banner (if any expiring/expired IDs)
- Search input field
- Status filter dropdown
- Employee table with columns:
  - Name
  - Job Title
  - Email
  - Status
  - Expiration Date
  - Photo
  - Actions (Recheck button)
- Empty state message if no employees found

**Actions:**

- `sync`: Triggers manual sync from FACTS SIS
- `recheck-facts-photo`: Forces refresh of employee's FACTS profile picture

---

### `/admin/employees/:employeeId`

**Route:** `app/routes/admin/employees/$employeeId.tsx`

**Purpose:** Individual employee detail page for administrators

**Functionality:**

- Displays comprehensive employee information
- Shows employee photo (or placeholder)
- Employee information section:
  - Full name
  - Job title
  - Email
  - SIS Employee ID
  - Status badge
- SIS Sync Status section:
  - Last updated timestamp
- ID Card Information section:
  - Expiration date (with update button)
- Actions section:
  - Upload/Change Photo button
  - Update Expiration Date button
  - Download ID Card button
  - Recheck FACTS Photo button
- Creates EmployeeID record if missing
- Attempts to fetch photo from FACTS if no uploaded photo exists
- Requires admin role

**UI Elements:**

- "Back to Employees" link
- Page title: "Employee Details"
- Employee name subtitle
- "Download ID Card" button (top right)
- Two-column grid layout:
  - Left: Photo section with photo preview, "Change Photo" button, "Recheck
    FACTS Photo" button
  - Right: Information section with all employee details
- SIS Sync Status section
- ID Card Information section
- Actions section with multiple action buttons

**Actions:**

- `recheck-facts-photo`: Forces refresh of employee's FACTS profile picture

---

### `/admin/employees/:employeeId/photo`

**Route:** `app/routes/admin/employees/$employeeId/photo.tsx`

**Purpose:** Employee photo upload/management page

**Functionality:**

- Displays current employee photo (or placeholder)
- File upload input for new photo (max 3MB)
- Image preview before submission
- "Save Photo" button
- "Reset" button to cancel changes
- "Delete Photo" button (if photo exists, requires double confirmation)
- Uploads photo to storage and updates EmployeeID record
- Creates EmployeeID record if missing
- Requires admin role

**UI Elements:**

- "Back to Employees" link
- Page title: "Upload Employee Photo"
- Employee name and email subtitle
- "Download ID Card" button (top right)
- Large photo preview (centered)
- File input (hidden, styled as button)
- "Change Photo" button
- "Save Photo" button (appears after file selection)
- "Reset" button (appears after file selection)
- "Delete Photo" button (if photo exists)

**Actions:**

- `submit`: Uploads new photo
- `delete`: Deletes existing photo

---

### `/admin/employees/:employeeId/expiration`

**Route:** `app/routes/admin/employees/$employeeId/expiration.tsx`

**Purpose:** Employee ID expiration date management

**Functionality:**

- Date picker for expiration date
- Displays current expiration date (or default if not set)
- "Save Expiration Date" button
- "Cancel" button to return to employee list
- Updates EmployeeID record with new expiration date
- Creates EmployeeID record if missing
- Requires admin role

**UI Elements:**

- "Back to Employees" link
- Page title: "Manage Expiration Date"
- Employee name and email subtitle
- Date input field
- "Save Expiration Date" button
- "Cancel" button

**Actions:**

- Updates expiration date in EmployeeID record

---

### `/admin/employees/:employeeId/download`

**Route:** `app/routes/admin/employees/$employeeId/download.tsx`

**Purpose:** PDF download endpoint for any employee's ID card (admin only)

**Functionality:**

- Generates and downloads PDF of any employee's ID card
- Only accessible to administrators
- Creates EmployeeID record if missing
- Returns PDF file with proper headers
- Requires admin role

**Response:**

- PDF file download
- Filename: `employee-id-{sisEmployeeId}.pdf`

---

### `/admin/sync-status`

**Route:** `app/routes/admin/sync-status.tsx`

**Purpose:** SIS sync status and monitoring dashboard

**Functionality:**

- Displays last sync information:
  - Success/failure status
  - Timestamp
  - Counts: created, updated, errors
  - Error messages (if any)
- Sync statistics:
  - Total employees
  - Active employees
  - Inactive employees
- Recent sync errors list (last 10 syncs with errors)
- Employees with sync issues (not updated in last 7 days)
- "Sync Now" button to trigger manual sync
- "Refresh" button to reload status
- Requires admin role

**UI Elements:**

- Page title: "SIS Sync Status"
- "Refresh" and "Sync Now" buttons (top right)
- "Last Sync" card with status, timestamp, and statistics
- "Sync Statistics" card with employee counts
- "Recent Sync Errors" card (if errors exist)
- "Employees Pending Sync" card (if employees need sync)

**Actions:**

- `sync`: Triggers manual sync from FACTS SIS

---

### `/admin/cache`

**Route:** `app/routes/admin/cache/index.tsx`

**Purpose:** Cache management interface for administrators

**Functionality:**

- Search cache keys (SQLite and LRU caches)
- Filter by instance (for multi-instance deployments)
- Limit results (default 100, max 10000)
- Display cache keys from both SQLite and LRU caches
- Delete individual cache keys (with confirmation)
- View cache key values (links to detail pages)
- Requires admin role

**UI Elements:**

- Page title: "Cache Admin"
- Search input field
- Limit input field
- Instance selector dropdown
- Results count display
- "LRU Cache" section with list of keys
- "SQLite Cache" section with list of keys
- Each key has:
  - Delete button (with confirmation)
  - Link to view key value

**Actions:**

- Deletes cache keys (SQLite or LRU)

---

## User Profile & Settings Routes

### `/me`

**Route:** `app/routes/me.tsx`

**Purpose:** Redirect endpoint to user's profile page

**Functionality:**

- Redirects authenticated user to their profile page (`/users/{username}`)
- Requires authentication

---

### `/users`

**Route:** `app/routes/users/index.tsx`

**Purpose:** User search and discovery page

**Functionality:**

- Search bar for finding users
- Displays search results as user cards
- Each card shows:
  - User avatar
  - User name (if set)
  - Username
- Clickable cards link to user profile
- Auto-submits search on input
- No authentication required

**UI Elements:**

- Page title: "Epic Notes Users"
- Search bar (auto-focus, auto-submit)
- Grid of user cards
- Empty state if no users found

---

### `/users/:username`

**Route:** `app/routes/users/$username/index.tsx`

**Purpose:** User profile page

**Functionality:**

- Displays user profile information:
  - User avatar
  - Display name (or username if no name)
  - Join date
- "Logout" button (if viewing own profile)
- "My notes" button (if viewing own profile)
- "Edit profile" button (if viewing own profile)
- "{Username}'s notes" button (if viewing other user's profile)
- No authentication required (but shows different options for logged-in user)

**UI Elements:**

- Large circular avatar
- User display name
- Join date
- Action buttons (context-dependent)

---

### `/users/:username/notes`

**Route:** `app/routes/users/$username/notes/index.tsx`

**Purpose:** User's notes listing page

**Functionality:**

- Displays list of user's notes
- "Select a note" message if no note selected
- Links to individual note pages
- No authentication required

**UI Elements:**

- "Select a note" message
- Note list (if implemented)

---

### `/settings/profile`

**Route:** `app/routes/settings/profile/index.tsx`

**Purpose:** User profile settings page

**Functionality:**

- Displays user profile photo (with edit button overlay)
- Profile update form:
  - Username input
  - Name input
  - "Save changes" button
- Links to other settings pages:
  - Change email
  - Two-factor authentication (enable/disable)
  - Password management (change/create)
  - Manage connections (OAuth providers)
  - Manage passkeys
  - Download user data
- Sign out of other sessions button
- Delete all data button (with confirmation)
- Requires authentication

**UI Elements:**

- Large circular profile photo with camera icon overlay
- Username and name input fields
- "Save changes" button
- List of settings links with icons
- "Sign out of other sessions" button
- "Delete all your data" button (destructive)

**Actions:**

- `update-profile`: Updates username and name
- `sign-out-of-sessions`: Signs out all other sessions
- `delete-data`: Deletes user account and all data

---

### `/settings/profile/photo`

**Route:** `app/routes/settings/profile/photo.tsx`

**Purpose:** User profile photo upload page

**Functionality:**

- Displays current profile photo (or placeholder)
- File upload input for new photo (max 3MB)
- Image preview before submission
- "Save Photo" button
- "Reset" button to cancel changes
- "Delete" button (if photo exists, requires double confirmation)
- Uploads photo to storage and updates user record
- Requires authentication

**UI Elements:**

- Large photo preview (centered)
- File input (hidden, styled as button)
- "Change" button
- "Save Photo" button (appears after file selection)
- "Reset" button (appears after file selection)
- "Delete" button (if photo exists)

**Actions:**

- `submit`: Uploads new photo
- `delete`: Deletes existing photo

---

### `/settings/profile/change-email`

**Route:** `app/routes/settings/profile/change-email.tsx`

**Purpose:** Change user email address

**Functionality:**

- Email change form
- Sends verification email to new address
- Requires authentication

---

### `/settings/profile/password`

**Route:** `app/routes/settings/profile/password.tsx`

**Purpose:** Change user password

**Functionality:**

- Password change form
- Current password input
- New password input
- Confirm password input
- Validates password strength
- Requires authentication

---

### `/settings/profile/password/create`

**Route:** `app/routes/settings/profile/password_.create.tsx`

**Purpose:** Create password for users who don't have one (OAuth-only users)

**Functionality:**

- New password form
- Confirm password input
- Validates password strength
- Requires authentication

---

### `/settings/profile/two-factor`

**Route:** `app/routes/settings/profile/two-factor/index.tsx`

**Purpose:** Two-factor authentication management

**Functionality:**

- Enable/disable 2FA
- QR code display for setup
- Verification code input
- Requires authentication

---

### `/settings/profile/connections`

**Route:** `app/routes/settings/profile/connections.tsx`

**Purpose:** OAuth provider connections management

**Functionality:**

- List of connected OAuth providers
- Connect/disconnect provider buttons
- Requires authentication

---

### `/settings/profile/passkeys`

**Route:** `app/routes/settings/profile/passkeys.tsx`

**Purpose:** Passkey/WebAuthn management

**Functionality:**

- List of registered passkeys
- Add new passkey button
- Delete passkey buttons
- Requires authentication

---

## Verification Routes

### `/verify/:employeeId`

**Route:** `app/routes/verify/$employeeId.tsx`

**Purpose:** Public employee ID verification page (accessed via QR code)

**Functionality:**

- Public page (no authentication required)
- Displays employee verification information:
  - School logo (if configured)
  - School name
  - Employee photo (or initial letter if no photo)
  - Employee name
  - Job title
  - Status badge (active/inactive)
  - Expiration date
- Validity badge (Valid/Invalid) with reason if invalid
- Validates employee status and expiration date
- Attempts to fetch photo from FACTS if no uploaded photo exists
- SEO-optimized with Open Graph and Twitter Card meta tags
- Rate-limited to prevent abuse

**UI Elements:**

- School logo (top)
- School name heading
- "Employee Verification" subheading
- Large employee photo (or initial letter)
- Validity badge (green for valid, red for invalid)
- Employee information:
  - Name
  - Job title
  - Status
  - Expiration date
- Invalid reason message (if ID is invalid)

**Validation Logic:**

- Valid if: employee status is "active" AND expiration date is in the future
- Invalid if: employee status is "inactive" OR expiration date has passed

---

## Resource Routes

### `/resources/admin/employee-pdf/:employeeId`

**Route:** `app/routes/resources/admin/employee-pdf.$employeeId.tsx`

**Purpose:** PDF generation resource endpoint for admin employee ID cards

**Functionality:**

- Generates PDF of employee ID card
- Used by admin interface for downloading ID cards
- Requires admin role

---

### `/resources/download-user-data`

**Route:** `app/routes/resources/download-user-data.tsx`

**Purpose:** User data export endpoint

**Functionality:**

- Downloads user's personal data as JSON file
- Includes all user information
- Requires authentication

---

### `/resources/healthcheck`

**Route:** `app/routes/resources/healthcheck.tsx`

**Purpose:** Application health check endpoint

**Functionality:**

- Returns application health status
- Used for monitoring and load balancers
- No authentication required

---

### `/resources/images`

**Route:** `app/routes/resources/images.tsx`

**Purpose:** Image serving endpoint

**Functionality:**

- Serves images from storage
- Handles signed URLs for secure access
- No authentication required (but URLs are signed)

---

### `/resources/theme-switch`

**Route:** `app/routes/resources/theme-switch.tsx`

**Purpose:** Theme switching endpoint

**Functionality:**

- Toggles between light/dark themes
- Sets theme preference cookie
- No authentication required

---

## Utility Routes

### `$` (Catch-all/404)

**Route:** `app/routes/$.tsx`

**Purpose:** 404 Not Found page

**Functionality:**

- Catches all unmatched routes
- Displays 404 error page
- Shows error boundary with "Not found" message

**UI Elements:**

- Error message
- Link back to home or navigation

---

## Route Groups & Layouts

### `_auth` Route Group

Routes in this group handle authentication flows:

- Login, signup, password reset
- Email verification
- Onboarding
- WebAuthn/passkey authentication

### `_marketing` Route Group

Routes in this group are public marketing/informational pages:

- Landing page
- About, privacy, terms, support

### `_seo` Route Group

Routes in this group handle SEO-related endpoints:

- `robots.txt`
- `sitemap.xml`

---

## Authentication & Authorization

### Public Routes (No Authentication Required)

- `/` (home)
- `/about`, `/privacy`, `/tos`, `/support`
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify`
- `/verify/:employeeId` (public verification)
- `/users`, `/users/:username`
- `/resources/healthcheck`, `/resources/theme-switch`

### Authenticated Routes (Require Login)

- `/employee/id`, `/employee/id/download`
- `/me`
- `/settings/profile/*`
- `/users/:username/notes/*`

### Admin Routes (Require Admin Role)

- `/admin/employees/*`
- `/admin/sync-status`
- `/admin/cache/*`
- `/resources/admin/*`

---

## Key Features by Route Category

### Employee Self-Service

- View own ID card preview
- Download own ID card PDF
- View profile and settings

### Admin Management

- Employee list with search and filters
- Individual employee detail pages
- Photo upload/management
- Expiration date management
- Manual FACTS sync
- Sync status monitoring
- Cache management

### Public Verification

- QR code-based employee verification
- No authentication required
- SEO-optimized for sharing

### User Management

- Profile editing
- Photo management
- Password management
- OAuth connections
- Passkey/WebAuthn setup
- Two-factor authentication

---

## Data Flow Patterns

### Employee ID Card Generation

1. Employee or admin requests ID card
2. System checks for EmployeeID record (creates if missing)
3. System attempts to fetch photo from FACTS if no uploaded photo
4. System generates PDF with employee data, photo, and QR code
5. PDF is returned as download

### Employee Sync Process

1. Admin triggers sync from `/admin/employees` or `/admin/sync-status`
2. System fetches employee data from FACTS SIS API
3. System creates/updates employee records
4. System attempts to fetch and cache profile pictures
5. Sync results are logged and displayed

### Photo Management

1. Admin uploads photo via `/admin/employees/:employeeId/photo`
2. Photo is uploaded to storage (S3-compatible)
3. Storage key is saved to EmployeeID.photoUrl
4. Photo can be fetched from FACTS if no uploaded photo exists
5. Photos are served via signed URLs

---

## UI/UX Considerations

### Navigation Patterns

- Admin routes use breadcrumb navigation ("Back to Employees")
- Settings routes use tab/link navigation within profile
- Employee routes are simple, focused pages

### Loading States

- Forms show pending states during submission
- Search uses debounced input with loading indicators
- Sync operations show progress and results

### Error Handling

- Form validation errors displayed inline
- Toast notifications for success/error messages
- Error boundaries for unexpected errors
- Specific error pages for 400, 403, 404, 500 status codes

### Responsive Design

- Container-based layouts with max-widths
- Mobile-friendly forms and tables
- Responsive grid layouts for cards and lists

---

## Integration Points

### FACTS SIS Integration

- Employee data sync
- Profile picture fetching
- Employee status updates

### Storage Integration

- Photo uploads (S3-compatible)
- Signed URL generation for secure access

### PDF Generation

- React-based PDF rendering
- QR code generation
- Branding configuration

### Authentication Providers

- Google OAuth
- WebAuthn/Passkeys
- Username/password
- Two-factor authentication

---

This document should be used as a reference when designing the user interface
and user experience for each route. Each route's functionality, data
requirements, and user interactions are detailed to ensure consistent and
intuitive design across the application.
