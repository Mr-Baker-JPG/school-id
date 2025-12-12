# 🏗️ Architecture & System Design

**Stack:** Epic Stack (Remix / React Router v7) **Hosting:** Fly.io **Auth:**
Google OAuth **SIS:** FACTS REST API

---

## 1. High-Level Architecture

```
Browser
  └── Remix App (Epic Stack)
        ├── Auth (Google OAuth)
        ├── Employee ID UI
        ├── Admin Dashboard
        ├── Public Verification Routes
        └── API Routes
              ├── FACTS SIS Sync
              ├── ID Generation
              └── QR Verification
```

Epic Stack provides a production-ready Remix architecture with authentication,
database, and deployment conventions .

---

## 2. Authentication & Identity

### Employee/Admin Login

- Google OAuth
- Email must match SIS employee email
- Role determined via local DB mapping (`isAdmin` flag)

Remix Auth integrates cleanly with OAuth providers and session storage .

---

## 3. Data Model (Proposed)

### Employee (local mirror of SIS)

```ts
Employee {
  id: string
  sisEmployeeId: string
  fullName: string
  jobTitle: string
  email: string
  status: "active" | "inactive"
}
```

### EmployeeID

```ts
EmployeeID {
  employeeId: string
  expirationDate: Date
  photoUrl: string
  createdAt: Date
  updatedAt: Date
}
```

---

## 4. SIS Integration (FACTS)

### Sync Strategy

- Scheduled background job (daily or hourly)
- Pull employee roster via FACTS REST API
- Update local `Employee.status`

FACTS supports REST-based personnel access used by integrated systems .

---

## 5. ID Generation Pipeline

1. Fetch employee + ID metadata.
2. Generate layout (React-based PDF renderer).
3. Embed QR code pointing to verification route.
4. Stream PDF response.

Recommended libraries:

- `@react-pdf/renderer` (PDF)
- `qrcode` or `qr-image`

React-based PDF rendering is a standard approach for server-side ID generation .

---

## 6. Verification Route

```
GET /verify/:employeeId
```

Server-side loader:

- Fetch employee + ID
- Validate status + expiration
- Render verification page (no auth)

---

## 7. File Storage

- Photos stored in object storage (Fly.io volume or S3-compatible store).
- URLs stored in DB.

Fly.io supports persistent volumes and external object storage patterns .

---

## 8. Deployment (Fly.io)

- Single Remix app
- LiteFS optional (if SQLite is used)
- Secrets:
  - Google OAuth credentials
  - FACTS API token

Fly.io is well-suited for Remix apps with low-to-moderate traffic .

---

## 9. Security Considerations

- Public verification route is read-only.
- Admin routes protected by role checks.
- Rate limiting on `/verify`.
- No SIS writes allowed.

---

## 10. Future Enhancements

- Mobile wallet passes
- Expiration reminders
- Audit logs for admin actions
- Multi-campus branding variants

---

## References

- Epic Stack Repository:
  [https://github.com/epicweb-dev/epic-stack](https://github.com/epicweb-dev/epic-stack)
- Remix Authentication Docs:
  [https://remix.run/docs/en/main/utils/sessions](https://remix.run/docs/en/main/utils/sessions)
- Fly.io Documentation: [https://fly.io/docs](https://fly.io/docs)
- FACTS SIS Overview: [https://factsmgt.com](https://factsmgt.com)
- React PDF Renderer: [https://react-pdf.org](https://react-pdf.org)
