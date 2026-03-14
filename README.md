# School ID System

A self-hosted ID card management system for schools using **FACTS SIS**. Syncs students and employees from FACTS, generates printable ID cards (PDF), and optionally integrates with Google Workspace for OAuth login, Gmail signatures, and photo sync.

Built on the [Epic Stack](https://www.epicweb.dev/epic-stack) with React Router, Prisma, SQLite, and Tailwind CSS.

---

## Features

- **FACTS SIS Sync** — Automatically imports students and employees
- **ID Card Generation** — 12+ card designs, PDF export, bulk printing
- **Photo Management** — Upload, crop, and store photos in S3-compatible storage
- **Verification Pages** — Public QR-code verification for ID cards
- **Google Workspace** *(optional)* — OAuth login, Gmail signature management, photo sync
- **Admin Dashboard** — Manage users, sync status, card designs, and school settings
- **First-Run Setup Wizard** — Guided configuration on first deploy

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **FACTS SIS** API credentials (subscription key + API key)
- **S3-compatible storage** (e.g., [Tigris](https://www.tigrisdata.com/) on Fly.io)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/school-id.git
cd school-id
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values. At minimum you need:
- `SESSION_SECRET`, `HONEYPOT_SECRET`, `INTERNAL_COMMAND_TOKEN` — random strings
- `AWS_*` and `BUCKET_NAME` — S3-compatible storage credentials
- `FACTS_*` — your FACTS SIS API credentials

See `.env.example` for all available options. Most school-specific settings (branding, colors, etc.) are configured via the **setup wizard** on first run.

### 3. Initialize Database

```bash
npx prisma migrate deploy
npx prisma db seed
```

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000/install` to run the setup wizard.

---

## Deploy to Fly.io

### 1. Create Fly App

```bash
fly launch --no-deploy
```

### 2. Set Secrets

```bash
fly secrets set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  HONEYPOT_SECRET="$(openssl rand -hex 32)" \
  INTERNAL_COMMAND_TOKEN="$(openssl rand -hex 32)" \
  FACTS_SUBSCRIPTION_KEY="your-key" \
  FACTS_API_KEY="your-key" \
  FACTS_BASE_URL="https://api.factsmgt.com"
```

### 3. Create Tigris Storage

```bash
fly storage create
```

This auto-sets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, and `BUCKET_NAME`.

### 4. Deploy

```bash
fly deploy
```

### 5. Run Setup Wizard

Visit `https://your-app.fly.dev/install` to configure your school name, branding, admin account, and optional Google Workspace integration.

---

## Google Workspace Integration (Optional)

If you want Google OAuth login, Gmail signature management, or photo sync to Google Workspace:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Google+ API** and **Admin SDK API**
3. Create **OAuth 2.0 credentials** (for user login)
4. Create a **Service Account** with domain-wide delegation (for signatures + photos)
5. Enter these credentials in the setup wizard or admin settings

---

## Project Structure

```
app/
├── routes/           # React Router file-based routes
│   ├── admin/        # Admin dashboard, employees, students, sync
│   ├── _auth/        # Login, signup, password reset
│   ├── _marketing/   # Public pages
│   ├── employee/     # Employee ID view
│   ├── student/      # Student ID view
│   └── verify/       # Public ID verification
├── utils/            # Server utilities (auth, storage, sync, PDF)
├── ui/               # Shared UI components and shells
└── components/       # Form components, UI primitives
prisma/
├── schema.prisma     # Database schema
└── seed.ts           # Seed data
```

---

## Configuration

School-specific configuration is stored in the `SystemSetting` table and managed through:

1. **Setup Wizard** (`/install`) — First-run configuration
2. **Admin Settings** — Update branding, signatures, card designs
3. **Environment Variables** — Fallbacks (see `.env.example`)

### Key Settings

| Setting | Source | Description |
|---------|--------|-------------|
| School name/colors | Wizard → DB | Branding on ID cards and UI |
| FACTS credentials | Wizard → DB | Student/employee sync |
| Google Workspace | Wizard → DB | OAuth, signatures, photo sync |
| Storage (S3) | Environment | Photo and asset storage |
| Session secret | Environment | Cookie encryption |

---

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run tests
npx prisma studio    # Browse database
```

---

## Credits

Built on the [Epic Stack](https://www.epicweb.dev/epic-stack) by Kent C. Dodds.
