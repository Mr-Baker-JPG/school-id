# JPG ID System — Project Overview

## Project Overview

**Project Name:** JPG ID System

**Description:**  
A secure internal web application that allows school employees to view and
download official digital employee IDs, while enabling administrators to manage
photos and expiration dates. Each ID includes a QR code that links to a public
verification page confirming the employee’s active status. Employee data is
sourced from the school’s FACTS SIS and kept in sync automatically.

**Primary User / Use Case:**  
Teachers and school staff who need an official, verifiable employee ID for
discounts, identification, and institutional verification; administrators who
need a simple, centralized way to manage and validate employee IDs.

---

## Tech Stack

- **Framework:** React Router v7 (Epic Stack / Remix-style full-stack framework)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (Radix-based)
- **Database ORM:** Prisma
- **Database:** SQLite (local dev), production-compatible relational DB
- **Authentication:** Google OAuth (school email–based)
- **PDF Generation:** React-based PDF renderer (e.g. `@react-pdf/renderer`)
- **QR Codes:** Server-side QR generation library
- **Build Tool:** Vite
- **Testing:**
  - Unit/Integration: Vitest + React Testing Library
  - E2E/Browser: Playwright
- **Deployment:** Fly.io
- **External Integration:** FACTS SIS (REST API)

---

## Documentation

- **FACTS API Documentation:** See `docs/FACTS.md` for detailed FACTS SIS API
  integration documentation.

---

## Non-negotiable Workflow

**MUST follow rules in `.cursor/rules/` directory, especially
`.cursor/rules/ai-workflow.mdc`.**

**MUST always read at the start of each session:**

- `Claude.md` (this file)
- `features.json`
- `progress.md`

**MUST work feature-by-feature, in order**, implementing features sequentially
as defined in `features.json`.  
Only one feature may be implemented per iteration.

**Cursor Instructions:**

- Always check and follow rules in `.cursor/rules/` before starting any work
- Read context files (Claude.md, features.json, progress.md) at session start
- Implement features in the exact order listed in `features.json`
- Mark features complete only when tests pass and implementation is verified

---

## Core Product Rules (Hard Constraints)

- Employee identity and status are **read-only from SIS**
- Employment activation/deactivation is **driven solely by FACTS SIS status**
- Employees may **only** view/download their own ID
- Admins may manage **all** employee IDs
- Verification pages are **publicly accessible**
- Photos are **uploaded and managed by admins only**
- All IDs use a **single, uniform layout** across employee types
- Official school branding (logo + colors) is mandatory

---

## Testing

### Unit Tests

- **Command:** `npm test`
- **Tool:** Vitest with React Testing Library
- **Location:** `**/*.{test,spec}.{ts,tsx}`

### E2E / Browser Tests

- **Command:** `npm run test:e2e`
- **Tool:** Playwright
- **Location:** `tests/e2e/**/*.test.ts`

### Test Requirements

A feature may only be marked complete (`implemented=true`, `tests_passed=true`)
when:

1. Feature implementation is complete
2. All automated tests pass
3. Any required manual checks are completed and documented

### Manual Checks

- PDF layout renders correctly (branding, spacing, wallet size)
- QR code resolves to correct verification page
- Verification page shows correct status for:
  - Active employee
  - Inactive employee
  - Expired ID

Manual checks must be recorded in `progress.md`.

---

## Git & Commits

### Conventional Commit Style

- Feature commits: `feat: F00X short description`
- Bug fixes: `fix: F00X short description`
- Chores/setup: `chore: initialize JPG ID system`

### Commit Guidelines

- Always commit in a working, mergeable state
- One feature per commit
- Feature ID must be included in commit message

---

## Current State

This project is based on the **Epic Stack template**, which already includes:

- Authentication scaffolding
- Session management
- Database integration
- Example features and admin patterns

**Development Approach:**

- Preserve existing Epic Stack conventions
- Add employee ID features incrementally
- Prefer server loaders/actions over client-side data fetching
- Favor clarity and auditability over premature abstraction

---

## Data Model Overview (Conceptual)

- **Employee (SIS Mirror):**
  - SIS employee ID
  - Full name
  - Job title
  - Email
  - Active / inactive status

- **EmployeeID (Local):**
  - Employee reference
  - Photo URL
  - Expiration date (default July 1, admin-overridable)
  - Timestamps

---

## Planned Version: 1.1.0 – Quality & Trust Improvements

### Status

**PLANNED**

### Summary

Enhancements focused on trust, reliability, and usability of IDs for external
verification contexts.

### Potential Goals

- Visual “Valid / Invalid” badge on verification page
- Expiration reminder for admins
- Optional download formats (PNG)
- Basic audit log for admin actions
- Rate limiting and abuse protection on verification endpoint
