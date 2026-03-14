# School ID System

A self-hosted digital ID card platform for K–12 schools. Syncs students and employees from [FACTS SIS](https://factsmgt.com), generates printable and mobile-wallet ID cards, and optionally integrates with Google Workspace for OAuth login, Gmail signature management, and profile photo sync.

Built on the [Epic Stack](https://www.epicweb.dev/epic-stack) with React Router v7, Prisma, SQLite, and Tailwind CSS v4. Deploys to [Fly.io](https://fly.io) with persistent volume storage.

---

## Features

### ID Cards
- **12 card designs** — Classic Band, Full-Height Photo, Dark Executive, Heritage Frame, and more
- **PDF export** — Individual download or bulk print sheets for entire rosters
- **Mobile wallet passes** — Apple Wallet (.pkpass) and Google Pay support
- **QR verification** — Each card includes a QR code linking to a public verification page

### Data Sync
- **FACTS SIS integration** — Automatically imports and updates students and employees
- **Photo management** — Upload, crop, and store photos in S3-compatible storage; sync to Google Workspace
- **Sync dashboard** — View history, trigger manual syncs, monitor status

### Google Workspace *(optional)*
- **OAuth login** — Sign in with school Google accounts
- **Gmail signatures** — Design templates with a rich editor, push to users via domain-wide delegation
- **Profile photo sync** — Push ID photos to Google Workspace profiles

### Administration
- **Setup wizard** — Guided first-run configuration at `/install`
- **School branding** — Name, crest, colors, address — stored in DB, editable anytime
- **User management** — Role-based access (admin, user)
- **Card design picker** — Preview and activate any of the 12 built-in designs
- **Signature templates** — WYSIWYG editor with placeholders (`{{name}}`, `{{title}}`, etc.)
- **Cache management** — View and clear server-side caches

### Auth
- **Username/password login** — Always available, no external dependencies
- **Google OAuth** — Optional, configured via wizard or admin settings
- **Passkeys/WebAuthn** — Passwordless login support

---

## Quick Start

### Prerequisites

- **Node.js 22+**
- **FACTS SIS** API credentials (subscription key + API key)
- **S3-compatible storage** for photos (e.g., [Tigris](https://www.tigrisdata.com/) on Fly.io)

### 1. Clone & Install

```bash
git clone <repo-url>
cd school-id
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | Cookie encryption (random string) |
| `HONEYPOT_SECRET` | Spam protection (random string) |
| `INTERNAL_COMMAND_TOKEN` | Internal API auth (random string) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `BUCKET_NAME` | S3-compatible photo storage |

FACTS credentials and Google Workspace settings can be set via environment variables **or** through the setup wizard (stored in DB). See `.env.example` for all options.

### 3. Initialize Database

```bash
npx prisma migrate deploy
npx prisma db seed
```

### 4. Run

```bash
npm run dev          # Dev server with mocks at http://localhost:3000
npm run dev:no-mocks # Dev server hitting real FACTS API
```

Visit `http://localhost:3000/install` on first run to configure your school.

---

## Deploy to Fly.io

```bash
# 1. Create app
fly launch --no-deploy

# 2. Set secrets
fly secrets set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  HONEYPOT_SECRET="$(openssl rand -hex 32)" \
  INTERNAL_COMMAND_TOKEN="$(openssl rand -hex 32)"

# 3. Create Tigris storage (auto-sets AWS_* and BUCKET_NAME)
fly storage create

# 4. Deploy
fly deploy

# 5. Run setup wizard
# Visit https://<your-app>.fly.dev/install
```

FACTS credentials are entered in the setup wizard and stored in the database — no need to set them as Fly secrets unless you prefer environment variables.

---

## Google Workspace Integration (Optional)

Enable Google OAuth login, Gmail signature management, and/or photo sync:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Admin SDK API** and **Gmail API**
3. Create **OAuth 2.0 credentials** (for user login)
4. Create a **Service Account** with domain-wide delegation (for signatures and photo sync)
5. Enter credentials in the setup wizard or under Admin → Settings

### Photo Sync Script

Push ID photos to Google Workspace profiles:

```bash
npm run sync-photos:google           # Sync all
npm run sync-photos:google -- --dry-run  # Preview changes
```

---

## Project Structure

```
app/
├── components/           # UI primitives, forms, ID card designs (12 designs)
├── routes/
│   ├── install.tsx       # First-run setup wizard
│   ├── admin/            # Dashboard, employees, students, sync, print,
│   │   │                   card designs, signatures, settings, cache
│   │   ├── employees/    # Employee list, detail, photo, expiration
│   │   ├── students/     # Student list, detail, photo, expiration
│   │   ├── signatures/   # Template editor, push, history
│   │   └── print.tsx     # Bulk ID card printing
│   ├── _auth/            # Login, logout, password reset, WebAuthn
│   ├── _marketing/       # Landing page, about, privacy, ToS
│   ├── employee/         # Employee self-service (view ID, download, wallet)
│   ├── student/          # Student ID view
│   ├── verify/           # Public QR verification page
│   └── resources/        # PDF generation, image serving, theme toggle
├── ui/                   # Shells, brand components, layout primitives
└── utils/                # Server utilities
    ├── facts-api.server.ts        # FACTS SIS API client
    ├── employee-sync.server.ts    # Employee sync logic
    ├── student-sync.server.ts     # Student sync logic
    ├── school-config.server.ts    # DB-backed school configuration
    ├── gmail-signature.server.ts  # Gmail signature push via Google API
    ├── wallet-pass.server.ts      # Apple Wallet + Google Pay generation
    └── s3.server.ts               # S3-compatible storage
prisma/
├── schema.prisma         # Database schema
├── seed.ts               # Seed data (roles, test users)
└── migrations/           # SQLite migrations
scripts/
└── sync-google-photos.ts # CLI script for Google photo sync
```

---

## Configuration

School settings are stored in the `SystemSetting` database table and editable through:

1. **Setup Wizard** (`/install`) — First-run: school info, admin account, FACTS credentials, Google Workspace
2. **Admin Settings** (`/admin/settings`) — Update branding, FACTS config, Google config anytime
3. **Environment Variables** — Fallbacks when DB values are not set (see `.env.example`)

| Setting | Configured via | Notes |
|---------|---------------|-------|
| School name, colors, logo | Wizard → DB | Used on ID cards, UI, and verification pages |
| FACTS API credentials | Wizard → DB or env vars | Required for student/employee sync |
| Google Workspace | Wizard → DB or env vars | Optional: OAuth, signatures, photo sync |
| S3 storage | Environment only | Required for photo uploads |
| Session/honeypot secrets | Environment only | Required for security |
| Apple Wallet certs | Environment only | Optional: for .pkpass generation |

---

## Development

```bash
npm run dev            # Dev server (mocks enabled)
npm run dev:no-mocks   # Dev server (real APIs)
npm run build          # Production build
npm run test           # Run unit/integration tests (Vitest)
npm run test:e2e:dev   # Playwright E2E tests (UI mode)
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint
npm run validate       # Run all checks
npx prisma studio      # Browse database
```

---

## Credits

Built on the [Epic Stack](https://www.epicweb.dev/epic-stack) by Kent C. Dodds.
